'use strict';

// Only safe classifications are logged. Never print credential values or signed requests.
const { credentialDiagnostics, r2Config } = require('./r2-config');

async function main(env = process.env) {
  console.log(JSON.stringify(credentialDiagnostics(env)));
  const config = r2Config(env);
  const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ endpoint: config.endpoint, region: 'auto',
    credentials: config.credentials, forcePathStyle: true, maxAttempts: 1,
    requestHandler: { requestTimeout: 15000, connectionTimeout: 5000 } });
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    console.log('R2 bucket authentication succeeded');
  } catch (error) {
    throw new Error(`R2 authentication failed: ${error.name}; HTTP ${error.$metadata?.httpStatusCode || 'unavailable'}`);
  } finally {
    client.destroy();
  }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
