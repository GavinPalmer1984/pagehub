import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto'; // For generating a unique ID for the DB record

// Environment variables
const region = process.env.AWS_REGION || 'us-east-1';
const accessTokenTableName = process.env.ACCESS_TOKEN_TABLE_NAME;
const adminApiKeySecretArn = process.env.ADMIN_API_KEY_SECRET_ARN; // Keep for admin check
const jwtSecretArn = process.env.JWT_SECRET_ARN; // New: ARN for the JWT signing secret
const jwtExpirySeconds = parseInt(process.env.JWT_EXPIRY_SECONDS || '172800', 10); // Default 48 hours

const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const secretsClient = new SecretsManagerClient({ region });

// Function to fetch secret value
let cachedJwtSecret: string | null = null;
async function getJwtSecret(): Promise<string> {
    if (cachedJwtSecret) {
        return cachedJwtSecret;
    }
    if (!jwtSecretArn) {
        throw new Error('JWT_SECRET_ARN environment variable is not set.');
    }
    const command = new GetSecretValueCommand({ SecretId: jwtSecretArn });
    const data = await secretsClient.send(command);
    if (data.SecretString) {
        cachedJwtSecret = data.SecretString;
        return cachedJwtSecret;
    } else if (data.SecretBinary) {
        // Handle binary secret if necessary, e.g., decode base64
        cachedJwtSecret = Buffer.from(data.SecretBinary).toString('utf8');
        return cachedJwtSecret;
    }
    throw new Error('JWT Secret value not found.');
}


// Simplified Admin Check (replace with actual API key check later if needed)
const validateAdminApiKey = async (apiKey: string | undefined): Promise<boolean> => {
    // Placeholder: In a real scenario, fetch the key from Secrets Manager (using adminApiKeySecretArn)
    // and compare securely. For now, just check if it exists.
    // const command = new GetSecretValueCommand({ SecretId: adminApiKeySecretArn });
    // const storedSecret = await secretsClient.send(command);
    // return !!apiKey && apiKey === storedSecret.SecretString;
    return !!apiKey; // Temporary: Just check if API key is provided
};

// Input type for the mutation (adjust based on your actual GraphQL schema if needed)
interface CreateAccessTokenArgs {
    siteId: string;
    // Add any other args needed, like duration?
}

export const handler = async (
    event: AppSyncResolverEvent<CreateAccessTokenArgs>
): Promise<{ token: string; expiresAt: number } | null> => { // Return JWT token string
    console.log(`Event: ${JSON.stringify(event)}`);

    // --- Admin Authorization ---
    const adminApiKey = event.request.headers['x-api-key']; // Or however the key is passed
    const isAdmin = await validateAdminApiKey(adminApiKey);
    if (!isAdmin) {
        console.error('Unauthorized: Missing or invalid admin API key.');
        // Consider throwing an AppSync error or returning null/specific error object
        throw new Error("Unauthorized");
    }

    // --- Input Validation ---
    const { siteId } = event.arguments;
    if (!siteId) {
        console.error('Missing required argument: siteId');
        throw new Error("Missing siteId");
    }
    if (!accessTokenTableName) {
        console.error('Missing environment variable: ACCESS_TOKEN_TABLE_NAME');
        throw new Error("Server configuration error: Missing table name.");
    }
     if (!jwtSecretArn) {
        console.error('Missing environment variable: JWT_SECRET_ARN');
        throw new Error("Server configuration error: Missing JWT secret ARN.");
    }

    try {
        // --- Generate Token Details ---
        const tokenId = randomUUID(); // Unique ID for the DB record, not the token itself
        const nowSeconds = Math.floor(Date.now() / 1000);
        const expiresAtSeconds = nowSeconds + jwtExpirySeconds;

        // --- Store Record in DynamoDB (optional but good for tracking) ---
        const putCommand = new PutCommand({
            TableName: accessTokenTableName,
            Item: {
                token: tokenId, // Store the unique ID, not the JWT
                siteId: siteId,
                createdAt: nowSeconds, // Add creation timestamp
                expiresAt: expiresAtSeconds,
            },
            // Optional: ConditionExpression to prevent overwriting?
        });
        await docClient.send(putCommand);
        console.log(`Stored AccessToken record in DB with ID: ${tokenId}`);

        // --- Generate JWT ---
        const jwtSecret = await getJwtSecret();
        const payload = {
            siteId: siteId,
            // Add any other relevant claims. Standard claims have 3-letter names:
            // 'exp' (Expiration Time) Claim - required by jwt.sign options
            // 'iat' (Issued At) Claim
            // 'jti' (JWT ID) Claim - can use tokenId
        };
        const jwtToken = jwt.sign(payload, jwtSecret, {
            expiresIn: jwtExpirySeconds, // Use 'expiresIn' option
            jwtid: tokenId, // Add unique ID to JWT payload
        });

        console.log(`Generated JWT for siteId: ${siteId}`);

        // --- Return JWT Token ---
        return {
            token: jwtToken, // Return the actual JWT string
            expiresAt: expiresAtSeconds, // Return expiry for client info
        };

    } catch (error) {
        console.error('Error generating access token:', error);
        // Handle specific errors (e.g., DynamoDB errors, JWT signing errors)
        if (error instanceof Error) {
             throw new Error(`Token generation failed: ${error.message}`);
        } else {
             throw new Error("An unknown error occurred during token generation.");
        }
    }
}; 