const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());

class OAuthClient {
  constructor(config) {
    this.clientConfig = config;
  }

  authorizeURL(options) {
    const { clientConfig } = this;
    const { tokenHost, authorizePath } = clientConfig.target;
    const { redirect_uri, scope, state } = options;

    return `${tokenHost}${authorizePath}?response_type=code&client_id=${clientConfig.id}&redirect_uri=${redirect_uri}&scope=${scope}&state=${state}`;
  }

  async getToken(options) {
    const { clientConfig } = this;
    const { tokenHost, tokenPath } = clientConfig.target;
    const { code, redirect_uri } = options;

    try {
      const response = await axios.post(`${tokenHost}${tokenPath}`, {
        client_id: clientConfig.id,
        client_secret: clientConfig.secret,
        code,
        redirect_uri,
        grant_type: 'authorization_code',
      }, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }
      });

      return response.data.access_token;
    } catch (error) {
      throw new Error('Failed to obtain access token');
    }
  }
}

const createOAuth = (env) => {
  return new OAuthClient({
    id: env.GITHUB_OAUTH_ID,
    secret: env.GITHUB_OAUTH_SECRET,
    target: {
      tokenHost: 'https://github.com',
      tokenPath: '/login/oauth/access_token',
      authorizePath: '/login/oauth/authorize',
    },
  });
};

app.get('/auth', (req, res) => {
  const provider = req.query.provider;
  if (provider !== 'github') {
    return res.status(400).send('Invalid provider');
  }

  const oauth2 = createOAuth(process.env);
  const authorizationUri = oauth2.authorizeURL({
    redirect_uri: `${process.env.BASE_URL}/callback?provider=github`,
    scope: 'public_repo,user',
    state: crypto.randomBytes(4).toString('hex'),
  });

  res.redirect(authorizationUri);
});

app.get('/callback', async (req, res) => {
  const provider = req.query.provider;
  if (provider !== 'github') {
    return res.status(400).send('Invalid provider');
  }

  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing code');
  }

  const oauth2 = createOAuth(process.env);
  try {
    const accessToken = await oauth2.getToken({
      code,
      redirect_uri: `${process.env.BASE_URL}/callback?provider=github`,
    });

    res.send(`
      <html>
      <head>
        <script>
          const receiveMessage = (message) => {
            window.opener.postMessage(
              'authorization:github:success:${JSON.stringify({ token: '${accessToken}' })}',
              '*'
            );
            window.removeEventListener("message", receiveMessage, false);
          }
          window.addEventListener("message", receiveMessage, false);
          window.opener.postMessage("authorizing:github", "*");
        </script>
        <body>
          <p>Authorizing Decap...</p>
        </body>
      </head>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Error during GitHub OAuth');
  }
});

app.listen(port, () => {
  console.log(`OAuth proxy server running on port ${port}`);
});

