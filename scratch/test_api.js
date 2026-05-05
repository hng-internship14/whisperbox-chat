import axios from 'axios';

async function testRegister() {
  const payload = {
    username: "test_user_" + Math.random().toString(36).substring(7),
    display_name: "Test User",
    password: "password123",
    public_key: "dGVzdF9wdWJsaWNfa2V5", // "test_public_key" in base64
    wrapped_private_key: "dGVzdF93cmFwcGVkX2tleQ==", // "test_wrapped_key"
    pbkdf2_salt: "dGVzdF9zYWx0" // "test_salt"
  };

  try {
    const response = await axios.post('https://whisperbox.koyeb.app/auth/register', payload);
    console.log('Success:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.log('Error Status:', err.response?.status);
    console.log('Error Detail:', JSON.stringify(err.response?.data, null, 2));
  }
}

testRegister();
