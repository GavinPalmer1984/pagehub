import { defineFunction } from '@aws-amplify/backend';

export const tokenGeneratorFunction = defineFunction({
  name: 'pagehub-token-generator',
  // entry: './handler.ts' // Handler file next
  // Needs env var for Admin API Key Secret ARN
  // Needs env var for AppSync API ID / Region (or endpoint)
  // Needs IAM permissions for:
  // - secretsmanager:GetSecretValue (for Admin API Key)
  // - appsync:GraphQL (to call createAccessToken mutation)
}); 