import { defineFunction } from '@aws-amplify/backend';

// Define the deleteSite Lambda function resource
export const deleteSiteFunction = defineFunction({
  name: 'pagehub-delete-site',
  entry: './handler.ts',
  // Needs env vars for:
  // - ADMIN_API_KEY_SECRET_ARN
  // - SITE_TABLE_NAME
  // Needs IAM permissions for:
  // - secretsmanager:GetSecretValue (for Admin Key)
  // - dynamodb:GetItem (on Site table)
  // - dynamodb:DeleteItem (on Site table)
  // - s3:ListBucketVersions
  // - s3:DeleteObjectVersion
  // - s3:DeleteBucket
}); 