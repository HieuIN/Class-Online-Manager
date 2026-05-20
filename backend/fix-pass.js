const bcrypt = require('bcrypt');
const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: 'localhost', port: 5432,
    user: 'postgres',
    password: 'Admin@123',
    database: 'class_manager'
  });
  await c.connect();
  const r = await c.query("SELECT email, password_hash FROM users WHERE email = 'teacher@cm.com'");
  const hash = r.rows[0].password_hash;
  console.log('Hash:', JSON.stringify(hash));
  console.log('Length:', hash.length);
  console.log('Compare "password123":', bcrypt.compareSync('password123', hash));

  // N?u fail, t?o hash m?i v? update t?t c? users
  if (!bcrypt.compareSync('password123', hash)) {
    console.log('Hash sai. Generating new hash...');
    const newHash = bcrypt.hashSync('password123', 10);
    console.log('New hash:', newHash);
    await c.query('UPDATE users SET password_hash = $1', [newHash]);
    console.log('Updated all users.');
    const v = await c.query("SELECT password_hash FROM users WHERE email = 'teacher@cm.com'");
    console.log('Verify after update:', bcrypt.compareSync('password123', v.rows[0].password_hash));
  }
  await c.end();
})();
