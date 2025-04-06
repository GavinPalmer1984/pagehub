import { defineFunction } from '@aws-amplify/backend';

export const tokenAuthorizerFunction = defineFunction({
  name: 'pagehub-token-authorizer',
  // entry: './handler.ts' // Handler file next
  // Needs env vars for AppSync API ID / Region
  // Needs IAM permissions for appsync:GraphQL (to call getAccessToken query)
}); 