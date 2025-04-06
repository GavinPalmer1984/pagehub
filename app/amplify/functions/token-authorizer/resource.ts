import { defineFunction } from '@aws-amplify/backend';

export const tokenAuthorizerFunction = defineFunction({
  name: 'pagehub-token-authorizer',
  // Assign this function to the 'data' resource group to resolve circular dependency
  resourceGroupName: 'data',
  entry: './handler.ts', // Make sure this points to your handler file
  // Needs env var for JWT_SECRET_ARN
  // Needs IAM permissions for secretsmanager:GetSecretValue on the JWT secret
}); 