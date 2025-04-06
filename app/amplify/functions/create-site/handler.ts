import { S3Client, CreateBucketCommand, PutBucketWebsiteCommand, PutBucketVersioningCommand, PutObjectCommand } from '@aws-sdk/client-s3';
// Import AppSync client or types if needed later
// Assume LLM client/function exists
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { v4 as uuidv4 } from 'uuid';

// Input event for direct Lambda invocation
interface CreateSiteEvent {
  name: string;
  seedPrompt: string; // Prompt to generate initial index.html
}

// Define the expected return type
interface CreateSiteResult {
  siteId: string;
  s3BucketName: string;
  initialVersionId: string;
}

// TODO: Get region and LLM function name from environment variables
const region = process.env.AWS_REGION || 'us-east-1';
const llmFunctionName = process.env.LLM_FUNCTION_NAME || 'pagehub-llm-handler'; // Placeholder

const s3 = new S3Client({ region });
const lambdaClient = new LambdaClient({ region });

// Helper function to generate unique bucket name
const generateBucketName = (siteName: string): string => {
  const safeName = siteName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 30);
  const uniqueId = uuidv4().substring(0, 8);
  // Bucket names must be globally unique, lowercase, 3-63 chars, start/end with letter/number
  return `pagehub-site-${safeName}-${uniqueId}`;
};

export const handler = async (
  event: CreateSiteEvent
): Promise<CreateSiteResult> => {
  console.log(`Event: ${JSON.stringify(event)}`);

  const { name, seedPrompt } = event;
  const siteId = uuidv4();
  const s3BucketName = generateBucketName(name);
  const creationDate = new Date();

  console.log(`Creating site: ${name} (ID: ${siteId}) in bucket: ${s3BucketName}`);

  try {
    // 1. Call LLM Lambda to generate initial index.html
    console.log(`Invoking LLM function: ${llmFunctionName}`);
    const llmPayload = { prompt: seedPrompt };
    const invokeCommand = new InvokeCommand({
      FunctionName: llmFunctionName,
      Payload: JSON.stringify(llmPayload),
    });
    const llmResponse = await lambdaClient.send(invokeCommand);
    const llmResult = JSON.parse(Buffer.from(llmResponse.Payload || new Uint8Array()).toString());

    if (llmResponse.FunctionError || !llmResult || !llmResult.htmlContent) {
        throw new Error(`LLM function execution failed or returned invalid data: ${llmResponse.FunctionError || JSON.stringify(llmResult)}`);
    }
    const initialHtml = llmResult.htmlContent;
    console.log('LLM generated initial HTML.');

    // 2. Create S3 bucket
    await s3.send(new CreateBucketCommand({ Bucket: s3BucketName }));
    console.log(`Bucket ${s3BucketName} created.`);

    // 3. Configure static website hosting
    await s3.send(new PutBucketWebsiteCommand({
      Bucket: s3BucketName,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: 'index.html' },
        // ErrorDocument: { Key: 'error.html' }, // Optional error page
      },
    }));
    console.log(`Bucket ${s3BucketName} configured for static hosting.`);

    // 4. Enable versioning
    await s3.send(new PutBucketVersioningCommand({
        Bucket: s3BucketName,
        VersioningConfiguration: { Status: 'Enabled' }
    }));
    console.log(`Versioning enabled for bucket ${s3BucketName}.`);

    // 5. Upload initial index.html
    const putObjectCmd = new PutObjectCommand({
      Bucket: s3BucketName,
      Key: 'index.html',
      Body: initialHtml,
      ContentType: 'text/html',
    });
    const putObjectResult = await s3.send(putObjectCmd);
    const initialVersionId = putObjectResult.VersionId;
    if (!initialVersionId) {
        throw new Error('Failed to get VersionId after uploading initial index.html');
    }
    console.log(`Uploaded initial index.html (Version ID: ${initialVersionId})`);

    // 6. Create Site record in DynamoDB (via AppSync mutation)
    // TODO: Implement AppSync mutation call using AWS SDK v3
    //       - Need AppSync endpoint URL (from env var or backend definition)
    //       - Need IAM permissions granted in backend.ts
    //       - Construct GraphQL mutation string
    // const createSiteMutation = /* GraphQL mutation string */;
    // const variables = { input: { id: siteId, name, creationDate: creationDate.toISOString(), s3BucketName, currentVersionId: initialVersionId } };
    // const appSyncResult = await callAppSync(createSiteMutation, variables);
    console.log('TODO: Create Site record via AppSync');

    // 7. Create initial SiteVersion record in DynamoDB (via AppSync mutation)
    // TODO: Implement AppSync mutation call
    // const createVersionMutation = /* GraphQL mutation string */;
    // const versionVariables = { input: { siteId, s3ObjectVersionId: initialVersionId, timestamp: creationDate.toISOString() } };
    // await callAppSync(createVersionMutation, versionVariables);
    console.log('TODO: Create SiteVersion record via AppSync');

    // 8. Return result
    return {
      siteId,
      s3BucketName,
      initialVersionId,
    };

  } catch (error) {
    console.error("Error creating site:", error);
    // TODO: Implement cleanup logic (e.g., delete bucket if partially created?)
    throw error; // Re-throw error for Lambda to handle
  }
};

// Placeholder for AppSync client call - replace with actual implementation
async function callAppSync(query: string, variables: any): Promise<any> {
    console.warn('callAppSync function is a placeholder!');
    // Use AppSync client or fetch API with IAM signature (aws4)
    return { data: { /* mocked response */ } };
} 