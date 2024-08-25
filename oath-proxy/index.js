const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 5000;

app.get('/auth', (req, res) => {
  const redirectUri = `${process.env.BASE_URL}/callback`;
  const githubOAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}`;
  res.redirect(githubOAuthUrl);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    const accessToken = response.data.access_token;
    res.send(
      `<script>window.opener.postMessage({ token: "${accessToken}" }, '*');window.close();</script>`
    );
  } catch (error) {
    res.status(500).send('Error during GitHub OAuth');
  }
});

app.listen(port, () => {
  console.log(`OAuth proxy server running on port ${port}`);
});
