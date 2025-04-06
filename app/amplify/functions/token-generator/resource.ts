import { defineFunction } from '@aws-amplify/backend';

export const tokenGeneratorFunction = defineFunction({
  name: 'pagehub-token-generator',
  entry: './handler.ts',
  // Needs env vars for:
  // - ADMIN_API_KEY_SECRET_ARN
  // - ACCESS_TOKEN_TABLE_NAME
  // - JWT_SECRET_ARN
  // - JWT_EXPIRY_SECONDS (optional)
  // Needs IAM permissions for:
  // - secretsmanager:GetSecretValue (for Admin Key and JWT Secret)
  // - dynamodb:PutItem (on AccessToken table)
}); 