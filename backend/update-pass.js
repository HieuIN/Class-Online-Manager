const bcrypt = require('bcrypt');
const fs = require('fs');
const hash = bcrypt.hashSync('password123', 10);
console.log('Hash:', hash, '(length:', hash.length + ')');
const sql = `UPDATE users SET password_hash = '${hash}';`;
fs.writeFileSync('update-pass.sql', sql);
console.log('File update-pass.sql created.');
