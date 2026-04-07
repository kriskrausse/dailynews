const express = require('express');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let newsData = {
  global: [],
  canadian: [],
  local: [],
  persecutedChurch: [],
  leadership: {},
  godNews: {}
};

app.get('/api/news', (req, res) => {
  res.json(newsData);
});

const updateNewsData = async () => {
  console.log('Fetching new articles...');
  newsData = {
    global: [
      { title: 'Global Event: Diplomatic Talks Advance', url: 'https://example.com/global1' }
    ],
    canadian: [
      { title: 'Canadian News: Policy Reforms Announced', url: 'https://example.com/canadian1' }
    ],
    local: [
      { title: 'Local Update: Community Event This Weekend', url: 'https://example.com/local1' }
    ],
    persecutedChurch: [
      { title: 'Persecuted Church: Faith Under Fire in Eastern Regions', url: 'https://example.com/persecuted1' }
    ],
    leadership: {
      title: 'Daily Leadership Boost: Lessons from Sustainable Leadership',
      url: 'https://example.com/leadership'
    },
    godNews: {
      title: 'God News: Miraculous Signs Around the World',
      url: 'https://example.com/godnews'
    }
  };
  console.log('News data updated.');
};

cron.schedule('30 3 * * *', () => {
  updateNewsData();
}, {
  timezone: "America/Vancouver"
});

app.listen(PORT, () => {
  console.log(`Dashboard Server running on port ${PORT}`);
  updateNewsData();
});
