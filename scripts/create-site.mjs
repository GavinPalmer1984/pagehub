import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
// Remove unused Amplify import
// import { Amplify } from "aws-amplify";
// Assuming amplify_outputs.json is configured or you set region manually
// import outputs from '../app/amplify_outputs.json'; 

// --- Configuration ---
// TODO: Load region correctly, potentially from amplify outputs
const region = process.env.AWS_REGION || 'us-east-1'; 
// Set the function name found in the AWS console
const functionName = process.env.CREATE_SITE_FUNCTION_NAME || 'amplify-app-gavin-sandbox-pagehubcreatesitelambda0-qwZ6SQdeXRz4';
const adminApiKey = process.env.PAGEHUB_ADMIN_API_KEY;
// --- End Configuration ---

async function invokeCreateSite(siteName) {
    if (!adminApiKey) {
        console.error("Error: PAGEHUB_ADMIN_API_KEY environment variable is not set.");
        process.exit(1);
    }
    if (!siteName) {
        console.error("Error: Please provide a site name as a command-line argument.");
        console.log("Usage: node scripts/create-site.mjs \"My New Site\"");
        process.exit(1);
    }

    console.log(`Invoking ${functionName} to create site: "${siteName}"...`);

    const lambdaClient = new LambdaClient({ region });

    const payload = {
        siteName: siteName,
        adminApiKey: adminApiKey,
    };

    const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
        // InvocationType: 'RequestResponse', // Default
    });

    try {
        const response = await lambdaClient.send(command);
        console.log("Lambda invocation successful.");

        if (response.FunctionError) {
            console.error(`Lambda function returned an error: ${response.FunctionError}`);
            const errorPayload = JSON.parse(Buffer.from(response.Payload).toString());
            console.error("Error Payload:", JSON.stringify(errorPayload, null, 2));
            process.exit(1);
        } else {
            const result = JSON.parse(Buffer.from(response.Payload).toString());
            console.log("---- Site Creation Result ----");
            console.log(JSON.stringify(result, null, 2));
            console.log("-----------------------------");
            console.log(`Access your site preface URL (propagation might take a minute): http://${result.s3BucketName}.s3-website-${region}.amazonaws.com`);
        }
    } catch (error) {
        console.error("Error invoking Lambda function:", error);
        process.exit(1);
    }
}

// --- Execution ---
const siteNameArg = process.argv[2]; // Get the first argument after script name
invokeCreateSite(siteNameArg); 