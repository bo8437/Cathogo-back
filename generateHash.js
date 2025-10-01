const bcrypt = require('bcrypt');

// The password you want to hash
const password = 'Admin@AFG2023!';

// Generate a salt and hash
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    return;
  }
  console.log('Password:', password);
  console.log('Hashed password:', hash);
  
  // Verify the hash
  bcrypt.compare(password, hash, (err, result) => {
    console.log('Verification result (should be true):', result);
  });
});
