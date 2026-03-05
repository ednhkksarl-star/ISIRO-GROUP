const net = require('net');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('❌ DATABASE_URL missing');
    process.exit(1);
}

// Extract host and port from URL
// Format: postgresql://user:pass@host:port/dbname
const regex = /@([^:/]+):?(\d+)?/;
const match = dbUrl.match(regex);
const host = match ? match[1] : 'unknown';
const port = match && match[2] ? parseInt(match[2]) : 5432;

console.log(`Connecting to ${host}:${port}...`);

const socket = net.connect(port, host, () => {
    console.log('✅ Connection successful to ' + host + ':' + port);
    socket.end();
});

socket.on('error', (err) => {
    console.error('❌ Connection failed:', err.message);

    if (host.startsWith('db.')) {
        const alternativeHost = host.replace('db.', '');
        console.log(`Trying alternative host: ${alternativeHost}...`);
        const socket2 = net.connect(port, alternativeHost, () => {
            console.log('✅ Connection successful to ' + alternativeHost + ':' + port);
            console.log('💡 Tip: Update DATABASE_URL host to ' + alternativeHost);
            socket2.end();
        });
        socket2.on('error', (err2) => {
            console.error('❌ Alternative host also failed:', err2.message);
        });
    }
});
