const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('❌ DATABASE_URL missing in .env');
    process.exit(1);
}

async function inspectDb() {
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();

        console.log('--- Tables ---');
        const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        tables.rows.forEach(row => console.log(row.table_name));

        console.log('\n--- Custom Types (Enums) ---');
        const types = await client.query(`
      SELECT t.typname as enum_name, 
             string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
    `);
        types.rows.forEach(row => console.log(`${row.enum_name}: ${row.enum_values}`));

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

inspectDb();
