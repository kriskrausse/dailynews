import fs from 'fs';
import Parser from 'rss-parser';

const parser = new Parser();
const date = new Date().toISOString().slice(0, 10);

const FEEDS = {
  global: [
    'https://feeds.reuters.com/reuters/worldNews',
    'https://feeds.bbci.co.uk/news/world/rss.xml'
  ],
  canadian: [
    'https://www.cbc.ca/webfeed/rss/rss-canada',
    'https://globalnews.ca/canada/feed/'
  ],
  local: [
    'https://www.abbynews.com/feed/',
    'https://www.theprogress.com/feed/'
  ],
  persecutedChurch: [
    'https://www.opendoorsus.org/en-US/rss/news/',
    'https://releaseinternational.org/feed/'
  ],
  goodNewsFeed: [
    'https://www.goodnewsnetwork.org/feed/',
    'https://www.positive.news/feed/'
  ],
  leadershipFeed: [
    'https://hbr.org/feed',
    'https://www.fastcompany.com/section/leadership/rss'
  ]
};

async function readFeeds(urls, limit = 8) {
  const items = [];
  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of (feed.items || []).slice(0, limit)) {
        items.push({
          title: item.title || '',
          url: item.link || '',
          summary: item.contentSnippet || item.content || item.summary || '',
          source: feed.title || url,
          pubDate: item.pubDate || ''
        });
      }
    } catch (error) {
      console.error(`Failed feed: ${url}`, error.message);
    }
  }
  return items.slice(0, limit);
}

function compact(items) {
  return items.map(item => ({
    title: item.title,
    url: item.url,
    summary: (item.summary || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 240),
    source: item.source
  }));
}

async function buildPromptData() {
  const [global, canadian, local, persecutedChurch, goodNewsFeed, leadershipFeed] = await Promise.all([
    readFeeds(FEEDS.global),
    readFeeds(FEEDS.canadian),
    readFeeds(FEEDS.local),
    readFeeds(FEEDS.persecutedChurch),
    readFeeds(FEEDS.goodNewsFeed),
    readFeeds(FEEDS.leadershipFeed)
  ]);

  return {
    date,
    candidates: {
      global: compact(global),
      canadian: compact(canadian),
      local: compact(local),
      persecutedChurch: compact(persecutedChurch),
      leadershipFeed: compact(leadershipFeed),
      goodNewsFeed: compact(goodNewsFeed)
    }
  };
}

async function generateBrief() {
  const promptData = await buildPromptData();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: 'You create a pastoral daily dashboard from real source candidates. Return valid JSON only. Do not invent URLs. Choose from the provided candidates only.'
        },
        {
          role: 'user',
          content: `Using ONLY the candidate stories below, produce JSON in this shape:
{
  "date": "YYYY-MM-DD",
  "global": [{ "title": "", "summary": "", "url": "" }],
  "canadian": [{ "title": "", "summary": "", "url": "" }],
  "local": [{ "title": "", "summary": "", "url": "" }],
  "persecutedChurch": [{ "title": "", "summary": "", "url": "" }],
  "leadership": { "title": "", "summary": "", "url": "" },
  "goodNews": { "title": "", "summary": "", "url": "" }
}

Rules:
- choose up to 3 items for global, canadian, and local
- choose up to 2 items for persecutedChurch
- choose 1 item for leadership from leadershipFeed if possible, otherwise create a short reflection based on Sustainable Leadership and use an empty url
- choose 1 item for goodNews from goodNewsFeed if possible
- summaries must be 1-2 sentences, warm, concise, and useful for a pastor
- preserve exact urls from candidates
- do not invent facts beyond what is reasonably inferable from the candidate story text
- return JSON only

Candidate data:
${JSON.stringify(promptData, null, 2)}`
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content returned from OpenAI');

  let brief;
  try {
    brief = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON returned: ${content}`);
  }

  brief.date = date;
  fs.writeFileSync('brief.json', JSON.stringify(brief, null, 2));
}

generateBrief().catch(error => {
  console.error(error);
  process.exit(1);
});
