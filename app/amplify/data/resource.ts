import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
// We will import the Lambda authorizer function later
// import { tokenAuthorizerFunction } from './functions/token-authorizer/resource';

/*
Defines the GraphQL schema for the PageHub application (Milestone 1 - Link Access).
Includes models for Sites, Site Versions, and Access Tokens.
Authorization is handled by a Lambda authorizer.
*/
const schema = a.schema({
  Site: a
    .model({
      name: a.string().required(),
      // owner field removed for link-based access
      creationDate: a.datetime().required(),
      currentVersionId: a.id(), // Link to the currently published version
      versions: a.hasMany('SiteVersion', 'siteId'),
      // userLinks relationship removed
      // TODO: Add fields for domain/subdomain later
    })
    // No specific model-level authorization rules; handled by Lambda authorizer
    ,

  SiteVersion: a
    .model({
      s3ObjectVersionId: a.string().required(), // S3 object version identifier
      timestamp: a.datetime().required(),
      name: a.string(), // Optional user-defined name
      notes: a.string(), // Optional notes
      basedOnVersionId: a.id(), // Optional link to parent version
      siteId: a.id().required(),
      site: a.belongsTo('Site', 'siteId'),
    })
    // No specific model-level authorization rules; handled by Lambda authorizer
    ,

  // UserSiteLink model removed

  // New model to store temporary access tokens
  AccessToken: a
    .model({
      // Use a non-guessable token ID (e.g., UUID or secure random string)
      token: a.string().required(),
      siteId: a.id().required(),
      // TTL in seconds (e.g., 48 hours = 172800 seconds)
      expiresAt: a.timestamp().required(),
    })
    .identifier(['token'])
    .secondaryIndexes((index) => [
      index('siteId'), // Allow querying tokens by siteId if needed
    ])
    // TTL configuration removed - revisit later
    // Authorization removed - rely on IAM permissions for backend functions
    ,

  // createSite mutation removed - site creation handled by admin process

}); // End of schema definition

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // Set IAM as default for now. We will configure a Lambda authorizer later.
    defaultAuthorizationMode: 'iam',
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
