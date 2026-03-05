const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsersTable() {
    console.log('Checking "users" table...');
    try {
        const { data, error } = await supabase.from('users').select('*').limit(1);

        if (error) {
            console.log('Table "users" check failed or table missing:', error.message);
            console.log('Error Code:', error.code);
        } else {
            console.log('✅ Table "users" exists!');
            if (data.length > 0) {
                console.log('Columns in first row:', Object.keys(data[0]));
            } else {
                console.log('Table is empty, cannot infer columns from data.');
            }
        }
    } catch (err) {
        console.error('Unexpected error:', err.message);
    }
}

checkUsersTable();
