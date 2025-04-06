import { defineFunction } from '@aws-amplify/backend';

// Define the dummy authorizer Lambda function resource
export const dummyAuthorizerFunction = defineFunction({
  name: 'pagehub-dummy-authorizer',
  // Assign this function to the 'data' resource group to resolve circular dependency
  resourceGroupName: 'data',
  entry: './handler.ts',
  // No special environment variables or permissions needed for the dummy
}); 