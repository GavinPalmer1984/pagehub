# Technical Plan

## Core Technologies

- **Frontend Framework:** (To be decided - e.g., React, Vue, SvelteKit) hosted on **AWS Amplify Hosting**.
- **Backend Logic:** AWS Lambda functions triggered via API Gateway or Amplify Functions.
- **Authentication:** **AWS Cognito** integrated with Google and Facebook identity providers. Invite link mechanism needs design (e.g., time-limited signed URL storing invite code, Cognito custom trigger).
- **Database:** **AWS DynamoDB** for storing user data, site metadata, version history, domain mappings, invite link status.
- **AI Model:** **Anthropic Claude 3.x** (via API) for processing natural language requests and generating site modifications (HTML/CSS/JS).
- **Static Site Hosting:** **AWS S3** buckets (one per site or user?). Configure for static website hosting.
- **Domain Management:** **AWS Route 53** for domain registration and DNS configuration.
- **Payments:** **Stripe** integration for handling subscriptions/usage-based billing.
- **Version Control:** Custom logic potentially leveraging DynamoDB for metadata and S3 versioning for site files. Needs a robust way to represent snapshots and branches.

## Architecture Outline

1.  **Frontend (Amplify):**
    *   Login/Signup flow using Cognito.
    *   Interface for managing invite links (admin/initial user).
    *   Dashboard displaying the user's site(s).
    *   Editor interface with:
        *   A preview of the current site.
        *   A natural language input prompt.
        *   Version history view (list/graph?).
        *   Controls for rollback, branching, naming versions.
    *   Settings page for domain management instructions/linking.
    *   Billing/Subscription management via Stripe integration.

2.  **Backend (Lambda/API Gateway/DynamoDB):**
    *   **Authentication Endpoints:** Handle Cognito callbacks, manage user sessions.
    *   **Invite Link Logic:** Generate, validate, and process invite links. Associate users with sites upon successful invite redemption.
    *   **Site Management API:**
        *   `createSite`: Initial site setup (S3 bucket, basic template, DynamoDB record).
        *   `getSite`: Retrieve site details and content.
        *   `updateSite`: Takes natural language input, sends to LLM, receives modified code, updates S3, records version in DynamoDB.
        *   `listVersions`: Retrieve version history for a site.
        *   `rollbackVersion`: Set a specific S3 version as the current live version.
        *   `createBranch`: Duplicate site state at a specific version into a new logical branch (details TBD - maybe separate S3 prefixes/buckets or just metadata in DynamoDB).
        *   `nameVersion`: Add/update a name for a specific version/snapshot.
    *   **Domain Management API:** (Potentially interacts with Route 53 API or provides guided instructions)
    *   **Stripe Webhooks:** Handle payment events, update user account status/limits in DynamoDB.

3.  **AI Integration (Lambda):**
    *   A dedicated Lambda function to interact with the Anthropic API.
    *   Receives natural language prompt and current site code (or relevant parts).
    *   Prompts the LLM to generate updated HTML/CSS/JS.
    *   Parses the LLM response and returns the modified code.
    *   Error handling for LLM failures or invalid output.

4.  **Hosting & Deployment (S3/Route53/Amplify):**
    *   Each site resides in an S3 bucket configured for static hosting.
    *   Initial access via `customername.pagehub.io` (requires wildcard DNS setup in Route 53 for `*.pagehub.io` pointing to a load balancer/CloudFront distribution that routes to the correct S3 bucket based on hostname).
    *   Custom domains configured via Route 53 CNAME/ALIAS records pointing to the site's S3 bucket endpoint or associated CloudFront distribution.
    *   Amplify handles frontend deployment.

## Key Challenges & Considerations

*   **LLM Prompt Engineering:** Crafting effective prompts to get reliable HTML/CSS/JS modifications.
*   **State Management:** How to represent the full state of a static site (HTML, CSS, JS, assets) for the LLM?
*   **Version Control Implementation:** Designing a robust and efficient system for versioning, rollback, and branching using S3/DynamoDB.
*   **Invite Link Security:** Ensuring invite links are secure and cannot be easily guessed or misused.
*   **Cost Management:** Accurately tracking and billing users for AWS resource usage (S3, Lambda, DynamoDB, Route 53, Cognito) and LLM API calls.
*   **Scalability:** Designing the S3/DynamoDB structure to handle many users and sites.
*   **Security:** Protecting user data, site content, and API keys. 