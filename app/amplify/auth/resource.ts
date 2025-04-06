import { defineAuth, secret } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['profile', 'email', 'openid'], // Standard scopes
      },
      facebook: {
        clientId: secret('FACEBOOK_APP_ID'), // Facebook uses App ID
        clientSecret: secret('FACEBOOK_APP_SECRET'), // Facebook uses App Secret
        scopes: ['public_profile', 'email'], // Standard scopes
      },
      // Define placeholder callback and logout URLs.
      // You will need to update these in your Google/Facebook app configuration
      // once Amplify deploys and provides the correct URLs, or use environment-specific URLs.
      callbackUrls: [
        'http://localhost:3000/signin', // Common local dev URL path
        'https://YOUR_PROD_DOMAIN/signin' // Placeholder for production
      ],
      logoutUrls: [
        'http://localhost:3000/signout',
        'https://YOUR_PROD_DOMAIN/signout' // Placeholder for production
      ],
    }
  },
  // We will add user attributes and Cognito triggers for the invite link logic later.
});
