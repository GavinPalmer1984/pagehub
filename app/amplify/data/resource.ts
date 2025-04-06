import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/*
Defines the GraphQL schema for the PageHub application.
Includes models for Sites, Site Versions, and links between Users and Sites.
Authorization rules are configured for Cognito User Pools and IAM (for backend functions).
*/
const schema = a.schema({
  Site: a
    .model({
      name: a.string().required(),
      owner: a.string().required(), // Cognito User Pool unique identifier (sub)
      creationDate: a.datetime().required(),
      currentVersionId: a.id(), // Link to the currently published version
      versions: a.hasMany('SiteVersion', 'siteId'),
      userLinks: a.hasMany('UserSiteLink', 'siteId'),
      // TODO: Add fields for domain/subdomain later
    })
    .authorization((allow) => [
      allow.ownerDefinedIn('owner').to(['read', 'update', 'delete']),
      allow.authenticated().to(['create', 'read']), // Allow read for any authenticated user for now
      // Mutations like update/delete are restricted to the owner by the rule above.
    ]),

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
    .authorization((allow) => [
      allow.authenticated().to(['read']), // Allow any authenticated user to read version metadata
      // Create/Update/Delete operations are restricted to backend functions via IAM
    ]),

  UserSiteLink: a
    .model({
      userId: a.string().required(), // Cognito User Pool unique identifier (sub)
      role: a.enum(['ADMIN', 'EDITOR']), // Access level role
      siteId: a.id().required(),
      site: a.belongsTo('Site', 'siteId'),
    })
    .identifier(['userId', 'siteId']) // Composite key
    .authorization((allow) => [
      allow.ownerDefinedIn('userId').to(['read', 'delete']),
      // Create/Update operations are restricted to backend functions via IAM (e.g., invite logic)
      // TODO: Allow Site owner to read/delete links?
    ]),

}); // End of schema definition

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // Default mode for client-side operations (checking owner, authenticated status)
    defaultAuthorizationMode: 'userPool',
    // We will grant IAM access to backend functions separately when defining them.
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
