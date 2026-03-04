const SteamUser = require('steam-user');
const express = require('express');

const app = express();
const PORT = 3000;
const APPID = 1533390;

const loginAndGenerateTicket = (accountName, password, appid) => {
  return new Promise((resolve, reject) => {
    const client = new SteamUser({
      dataDirectory: null,
      singleSentinel: false,
      enablePicsCache: false,
    });
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.logOff();
        reject(new Error('Login timeout after 30s'));
      }
    }, 30000);

    client.on('loggedOn', (details) => {
      console.log(`Logged in: ${accountName}`);
      client.setPersona(SteamUser.EPersonaState.Online);
      client.gamesPlayed([appid], true);

      setTimeout(() => {
        client.getAuthSessionTicket(appid, (err, ticket) => {
          clearTimeout(timeout);
          if (resolved) return;
          resolved = true;

          if (err) {
            client.logOff();
            return reject(err);
          }

          // Log off immediately after getting the ticket — no session kept
          client.logOff();

          resolve({
            accountId: details.client_supplied_steamid.low,
            ticketHex: ticket.toString('hex'),
            ticketBase64: ticket.toString('base64'),
          });
        });
      }, 1000);
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    client.logOn({ accountName, password });
  });
};

app.get('/generate', async (req, res) => {
  const { username, password, appid } = req.query;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const targetAppId = appid ? parseInt(appid) : APPID;

  try {
    console.log(`Generating fresh ticket for ${username}...`);
    const { accountId, ticketHex, ticketBase64 } = await loginAndGenerateTicket(username, password, targetAppId);

    res.json({ success: true, accountId, ticketHex, ticketBase64, appid: targetAppId, cached: false });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    defaultAppId: APPID,
  });
});

process.on('SIGINT', () => {
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Usage: GET /generate?username=USER&password=PASS`);
});