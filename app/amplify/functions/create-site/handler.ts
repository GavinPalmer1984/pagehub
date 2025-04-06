import type { AppSyncResolverEvent } from 'aws-lambda';

// Define the expected input arguments if called via AppSync
// For now, let's assume it takes a site name
interface CreateSiteArgs {
  name: string;
}

// Define the expected return type (e.g., the created Site object)
// This should align with our GraphQL schema later
interface Site {
  id: string;
  name: string;
  owner: string;
  creationDate: string;
  // ... other fields
}

export const handler = async (
  event: AppSyncResolverEvent<CreateSiteArgs>
): Promise<Site | null> => {
  console.log(`Event: ${JSON.stringify(event)}`);

  const { name } = event.arguments;

  // Check if the identity is Cognito and get the user's sub (unique ID)
  let owner: string | undefined;
  if (event.identity && 'sub' in event.identity) {
    owner = event.identity.sub;
  }

  if (!owner) {
    console.error('Error: User is not authenticated or identity is not Cognito.');
    // Or throw an appropriate error for AppSync to handle
    throw new Error('User not authenticated.');
  }

  console.log(`Creating site with name: ${name} for owner: ${owner}`);

  // 1. TODO: Create S3 bucket for the site using AWS SDK
  //    - Generate a unique bucket name (e.g., pagehub-site-<uuid>)
  //    - Configure for static website hosting
  //    - Enable versioning

  // 2. TODO: Create DynamoDB record for the Site using AppSync client or SDK
  //    - Generate a unique site ID
  //    - Store name, owner, creationDate, etc.
  //    - Need to grant Lambda IAM permissions to call AppSync/DynamoDB

  // 3. TODO: Potentially upload a default index.html to the new S3 bucket

  // 4. TODO: Return the newly created Site object
  const placeholderSite: Site = {
    id: 'placeholder-id-' + Date.now(),
    name: name,
    owner: owner,
    creationDate: new Date().toISOString(),
  };

  return placeholderSite;
}; 