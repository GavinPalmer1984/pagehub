import type { AppSyncAuthorizerHandler } from 'aws-lambda';

// Dummy authorizer for initial deployment to break circular dependencies.
// This function simply logs the event and returns isAuthorized: true.

export const handler: AppSyncAuthorizerHandler = async (event) => {
  console.log(`Dummy Authorizer Event: ${JSON.stringify(event, null, 2)}`);

  const { authorizationToken } = event;

  // You could optionally add basic token validation here if needed even for the dummy,
  // e.g., check if authorizationToken exists, but for breaking the cycle,
  // simply returning true is sufficient.

  console.log(`Dummy Authorizer: Granting access for token: ${authorizationToken}`);

  return {
    isAuthorized: true,
    // resolverContext should be undefined if not used
    resolverContext: undefined,
    // deniedFields is optional
    // ttlOverride is optional
  };
}; 