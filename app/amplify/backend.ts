import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
// Auth resource is minimal for M1, not directly used here
// import { auth } from './auth/resource';
import { data } from './data/resource';
// createSiteFunction removed for M1 link-based access
// import { createSite as createSiteFunction } from './functions/create-site/resource';

/**
 * @see https://docs.amplify.aws/gen2/build-a-backend/
 */
const backend = defineBackend({
  // auth removed for M1
  data,
  // createSiteFunction removed for M1
});

// Permissions for createSiteFunction removed

// NOTE: We will add Lambda functions for token generation and
// authorization later, along with their necessary permissions.
