import { S3Client, ListObjectVersionsCommand, DeleteObjectCommand, DeleteBucketCommand, ListObjectVersionsCommandInput, ListObjectVersionsCommandOutput } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

// Environment variables
const region = process.env.AWS_REGION || 'us-east-1';
const adminApiKeySecretArn = process.env.ADMIN_API_KEY_SECRET_ARN;
const siteTableName = process.env.SITE_TABLE_NAME;

// AWS Clients
const s3 = new S3Client({ region });
const secretsManager = new SecretsManagerClient({ region });
const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// --- Admin API Key Validation (Copied from create-site, can be refactored later) ---
const validateAdminApiKey = async (providedApiKey: string | undefined): Promise<void> => {
    if (!adminApiKeySecretArn) {
        console.error('Admin API Key Secret ARN not configured.');
        throw new Error('Configuration error [Admin API Key].');
    }
    if (!providedApiKey) {
        throw new Error('Admin API Key not provided.');
    }
    try {
        const command = new GetSecretValueCommand({ SecretId: adminApiKeySecretArn });
        const data = await secretsManager.send(command);
        const storedApiKey = data.SecretString;
        if (!storedApiKey || providedApiKey !== storedApiKey) {
            console.warn('Invalid Admin API Key provided.');
            throw new Error('Unauthorized: Invalid Admin API Key.');
        }
        console.log('Admin API Key validated.');
    } catch (error) {
        console.error('Error validating Admin API Key:', error);
        if (error instanceof Error && error.message.includes('Invalid Admin API Key')) {
            throw error;
        }
        throw new Error('Unauthorized: Could not validate Admin API Key.');
    }
};
// --- End API Key Validation ---

// Input event structure
interface DeleteSiteEvent {
    siteId: string;
    adminApiKey: string;
}

// Return value structure
interface DeleteSiteResult {
    siteId: string;
    message: string;
}

// Helper to empty a versioned bucket
async function emptyBucket(bucketName: string): Promise<void> {
    console.log(`Attempting to empty bucket: ${bucketName}`);
    let isTruncated = true;
    let keyMarker: string | undefined = undefined;
    let versionIdMarker: string | undefined = undefined;

    while (isTruncated) {
        const listParams: ListObjectVersionsCommandInput = {
            Bucket: bucketName,
            KeyMarker: keyMarker,
            VersionIdMarker: versionIdMarker
        };
        const listResponse: ListObjectVersionsCommandOutput = await s3.send(new ListObjectVersionsCommand(listParams));

        const versions = listResponse.Versions || [];
        const deleteMarkers = listResponse.DeleteMarkers || [];

        const objectsToDelete = [...versions, ...deleteMarkers].map(obj => ({
            Key: obj.Key,
            VersionId: obj.VersionId
        }));

        if (objectsToDelete.length > 0) {
            console.log(`Deleting ${objectsToDelete.length} object versions/markers...`);
            // S3 DeleteObjects supports max 1000 keys at a time, but simpler to delete one by one here
            for (const obj of objectsToDelete) {
                await s3.send(new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: obj.Key,
                    VersionId: obj.VersionId
                }));
            }
            console.log(`Deleted batch of ${objectsToDelete.length} items.`);
        } else {
            console.log("No objects found in this pass.");
        }

        isTruncated = listResponse.IsTruncated || false;
        keyMarker = listResponse.NextKeyMarker;
        versionIdMarker = listResponse.NextVersionIdMarker;
        if (isTruncated) {
          console.log("Bucket listing truncated, fetching next batch...");
        }
    }
    console.log(`Finished emptying bucket: ${bucketName}`);
}

export const handler = async (event: DeleteSiteEvent): Promise<DeleteSiteResult> => {
    console.log(`Event: ${JSON.stringify(event)}`);
    const { siteId, adminApiKey } = event;

    // --- Authorization & Input Validation ---
    await validateAdminApiKey(adminApiKey);
    if (!siteId) {
        throw new Error('Missing required input: siteId');
    }
    if (!siteTableName) {
        throw new Error('Server configuration error: SITE_TABLE_NAME not set.');
    }

    let s3BucketName: string | undefined = undefined;

    try {
        // --- 1. Get Site Info (including bucket name) from DynamoDB ---
        console.log(`Fetching site details for ID: ${siteId} from table: ${siteTableName}`);
        const getCommand = new GetCommand({
            TableName: siteTableName,
            Key: { id: siteId }
        });
        const siteResponse = await docClient.send(getCommand);
        const siteData = siteResponse.Item;

        if (!siteData) {
            throw new Error(`Site with ID ${siteId} not found.`);
        }
        s3BucketName = siteData.s3BucketName;
        if (!s3BucketName) {
            throw new Error(`Site record for ID ${siteId} is missing the s3BucketName.`);
        }
        console.log(`Found site. Bucket name: ${s3BucketName}`);

        // --- 2. Empty the S3 Bucket ---
        await emptyBucket(s3BucketName);

        // --- 3. Delete the S3 Bucket ---
        console.log(`Deleting bucket: ${s3BucketName}`);
        await s3.send(new DeleteBucketCommand({ Bucket: s3BucketName }));
        console.log(`Bucket ${s3BucketName} deleted.`);

        // --- 4. Delete the Site Record from DynamoDB ---
        console.log(`Deleting site record from DynamoDB for ID: ${siteId}`);
        const deleteCommand = new DeleteCommand({
            TableName: siteTableName,
            Key: { id: siteId }
        });
        await docClient.send(deleteCommand);
        console.log(`DynamoDB site record deleted.`);

        // --- Return Success ---
        const result: DeleteSiteResult = {
            siteId: siteId,
            message: `Site '${siteData.name || siteId}' (Bucket: ${s3BucketName}) deleted successfully.`
        };
        console.log("Site deletion process completed successfully.", result);
        return result;

    } catch (error) {
        console.error(`Error deleting site ID ${siteId} (Bucket: ${s3BucketName || 'unknown'}):`, error);
        throw new Error(`Failed to delete site '${siteId}': ${error instanceof Error ? error.message : String(error)}`);
    }
}; 