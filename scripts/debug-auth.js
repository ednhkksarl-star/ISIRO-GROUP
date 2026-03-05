const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@isirogroup.com';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@2026';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugAuth() {
    console.log(`Checking user: ${adminEmail}`);

    try {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;

        const user = users.find(u => u.email === adminEmail);

        if (!user) {
            console.log('❌ User NOT found in Supabase Auth.');
            return;
        }

        console.log('✅ User found in Auth:');
        console.log('- ID:', user.id);
        console.log('- Confirmed At:', user.email_confirmed_at);
        console.log('- Last Sign In:', user.last_sign_in_at);

        console.log(`\nResetting password to: ${adminPassword}...`);
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: adminPassword, email_confirm: true }
        );

        if (updateError) {
            console.error('❌ Error updating password:', updateError.message);
        } else {
            console.log('✅ Password reset successful.');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

debugAuth();
