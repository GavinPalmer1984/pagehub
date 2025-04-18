import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
// Import the REAL authorizer function (will be used in Stage 2)
import { tokenAuthorizerFunction } from '../functions/token-authorizer/resource';
// Import the DUMMY authorizer function for Stage 1
import { dummyAuthorizerFunction } from '../functions/dummy-authorizer/resource';
// Import the token generator function (still needed by other parts)
import { tokenGeneratorFunction } from '../functions/token-generator/resource';
// Import createSite function (to link to mutation)
import { createSite as createSiteFunction } from '../functions/create-site/resource';
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
      s3BucketName: a.string().required(), // Added bucket name field
      currentVersionId: a.id(), // Link to the currently published version
      versions: a.hasMany('SiteVersion', 'siteId'),
      // userLinks relationship removed
      // TODO: Add fields for domain/subdomain later
    })
    // Use custom Lambda authorization
    .authorization((allow) => [allow.custom()])
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
    // Use custom Lambda authorization
    .authorization((allow) => [allow.custom()])
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
    // Use custom Lambda authorization
    .authorization((allow) => [allow.custom()])
    ,

  // createSite mutation is now handled via direct Lambda invocation, remove from schema
  /*
  // NEW: Define the createSite mutation
  createSite: a
    .mutation() // Define as a mutation
    .arguments({ name: a.string().required() }) // Define input arguments
    .returns(a.ref('Site')) // Define the return type (references the Site model)
    .handler(a.handler.function(createSiteFunction)) // Connect to the createSite Lambda function
    .authorization((allow) => [allow.apiKey()]) // Secure with API Key (Trusting docs over linter)
  */
}); // End of schema definition

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // Set Lambda as the default authorization mode for general operations
    defaultAuthorizationMode: 'lambda',
    // Configure the Lambda authorizer using the REAL JWT authorizer function
    lambdaAuthorizationMode: {
      function: tokenAuthorizerFunction, // Use the REAL token authorizer function
      timeToLiveInSeconds: 300, // Optional: Cache results
    },
    // DO NOT configure additional modes here
  },
  // API Key auth is not needed for the schema itself anymore
  /*
  apiKeyConfig: {
    // description: 'PageHub Admin API Key', // Optional description
    expiresInDays: 30, // Example: Set API key expiry (default is 7 days)
    // name: 'pagehub-admin-key' // Optional custom name for the key
  }
  */
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
