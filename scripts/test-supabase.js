const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
// Use absolute path to ensure it works regardless of where the script is called from
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing connection to Supabase...');
    console.log('URL:', supabaseUrl);

    try {
        // Try to fetch something simple. 
        // We can try to list buckets or just a simple query.
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });

        if (error) {
            // If it's a permissions error, it still means we connected!
            if (error.code === '42P01') { // Table doesn't exist
                console.log('Successfully reached Supabase API (API is reachable, but table "users" might not exist or be accessible).');
                console.log('Error code:', error.code);
            } else if (error.message.includes('FetchError') || error.message.includes('Network Error')) {
                console.error('Network error - Could not reach Supabase:', error.message);
            } else {
                console.log('Successfully reached Supabase API, but received an error response:');
                console.log('Message:', error.message);
                console.log('Status:', error.status);
            }
        } else {
            console.log('Connection successful! Database is reachable.');
        }
    } catch (err) {
        console.error('An unexpected error occurred:', err.message);
    }
}

testConnection();
