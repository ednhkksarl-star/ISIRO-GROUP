const { Client } = require('pg');

const regions = [
  'eu-central-1', // Frankfurt
  'eu-west-1',    // Ireland
  'eu-west-2',    // London
  'eu-west-3',    // Paris
  'eu-north-1',   // Stockholm
  'eu-south-1',   // Milan
  'us-east-1',    // N. Virginia
  'us-east-2',    // Ohio
  'us-west-1',    // N. California
  'us-west-2',    // Oregon
  'ca-central-1', // Montreal
  'sa-east-1',    // São Paulo
  'ap-south-1',   // Mumbai
  'ap-northeast-1', // Tokyo
  'ap-northeast-2', // Seoul
  'ap-northeast-3', // Osaka
  'ap-southeast-1', // Singapore
  'ap-southeast-2', // Sydney
  'af-south-1'    // Cape Town
];

const pass = 'Lianza@2026';
const ref = 'cxphddddknkeceddlaxm';
const port = 6543; // Pooler port

async function testRegions() {
  console.log('Testing regions for Supabase pooler...');
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    // Try connection
    const connectionString = `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@${host}:${port}/postgres`;
    
    // We'll just do a quick connect
    const client = new Client({ connectionString, connectionTimeoutMillis: 3000 });
    
    try {
      await client.connect();
      console.log(`✅ SUCCESS: Connected to region ${region}!`);
      console.log(`Connection string: ${connectionString}`);
      await client.end();
      return connectionString;
    } catch (err) {
      if (err.message.includes('password authentication failed') || err.message.includes('Tenant or user not found')) {
        // Connected but auth failed -> Wrong region/tenant!
        console.log(`❌ FAILED (Wrong tenant): ${region}`);
      } else {
        console.log(`❌ Timeout/Error for ${region}`);
      }
    }
  }
}

testRegions().catch(console.error);
