const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listColumns() {
    console.log('Fetching columns for "users"...');
    // Hacky way to see what columns are available via RPC or just a select and see keys
    // Since the table is empty, we can try to insert an empty object and see the error?
    // Or better, use a query that fails and shows columns?
    // Actually, let's try to fetch using lowercase and see if it works.

    try {
        const { data, error } = await supabase.from('users').select('*').limit(1);
        if (error) {
            console.error('Error:', error.message);
            console.log('Details:', error);
        } else {
            console.log('✅ Table fetched successfully.');
            // If empty, data is []
            console.log('Data:', data);
        }
    } catch (err) {
        console.error('Unexpected error:', err.message);
    }
}

listColumns();
