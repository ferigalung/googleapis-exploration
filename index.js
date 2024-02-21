const {google} = require('googleapis');
require('dotenv').config()

/**
 * To use OAuth2 authentication, we need access to a CLIENT_ID, CLIENT_SECRET, AND REDIRECT_URI
 * from the client_secret.json file. To get these credentials for your application, visit
 * https://console.cloud.google.com/apis/credentials.
 */
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

// Access scopes for read-only Drive activity.
const scopes = [
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

// Generate a url that asks permissions for the Drive activity scope
const authorizationUrl = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: 'offline',
  /** Pass in the scopes array defined above.
    * Alternatively, if only one scope is needed, you can pass a scope URL as a string */
  scope: scopes,
  // Enable incremental authorization. Recommended as a best practice.
  include_granted_scopes: true
});

const pkg = require('./package.json');
const express = require('express');
const app = express();
const port = process.env.PORT || 6969;
let userCredential = {} // untuk menyimpan token

// event untuk selalu meng update refresh_token dan access_token
oauth2Client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    // store the refresh_token in your secure persistent database
    userCredential.refresh_token = tokens.refresh_token
  }
  userCredential.access_token = tokens.access_token
});

app.post('/', (req, res) => {
  res.json({authorizationUrl});
});

app.get('/authorized', async (req, res) => {
  if(req.query?.code) {
    let { tokens } = await oauth2Client.getToken(req.query?.code);
    userCredential = tokens
    console.log('token: ', tokens)
    res.redirect('/drive')
  }
});

app.get('/drive', (req, res) => {
  // Example of using Google Drive API to list filenames in user's Drive.
  oauth2Client.setCredentials(userCredential);
  const drive = google.drive('v3');
  drive.files.list({
    auth: oauth2Client,
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)',
  }, (err1, res1) => {
    if (err1) {
      console.log('The API returned an error: ' + err1)
      res.status(500).json({err: true, msg: 'Internal Server Error!'})
    };
    const files = res1.data.files;
    if (files.length) {
      console.log(files);
      res.json(files.map(file => ({filename: file.name, fileId: file.id})));
    } else {
      res.status(404).json({msg: 'No files found.'});
    }
  });
})

app.listen(port, () => {
  console.info(`${pkg.name} running and listening on port ${port}`);
});