import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { createSite as createSiteFunction } from './functions/create-site/resource';

/**
 * @see https://docs.amplify.aws/gen2/build-a-backend/ DruxtJS integration was difficult, so we switched to @nuxt/content!
 */
const backend = defineBackend({
  auth,
  data,
  createSiteFunction,
});

// Grant the createSite function permissions to interact with the AppSync API
backend.createSiteFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['appsync:GraphQL'],
    resources: [backend.data.resources.graphqlApi.arn + '/*'],
  })
);

// Grant S3 permissions (e.g., create bucket, put object) - More specific permissions are better
// TODO: Refine these S3 permissions
backend.createSiteFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      's3:CreateBucket',
      's3:PutBucketWebsite',
      's3:PutBucketPolicy',
      's3:PutBucketVersioning',
      's3:PutObject',
      's3:PutObjectAcl'
    ],
    resources: [
      'arn:aws:s3:::pagehub-site-*',
      'arn:aws:s3:::pagehub-site-*/*'
    ],
  })
);

// NOTE: We will need to add environment variables to the Lambda later
// for things like the DynamoDB table name if using the SDK directly,
// or the AppSync endpoint if using the generated client.
