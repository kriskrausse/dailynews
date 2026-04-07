import fs from 'fs';

const date = new Date().toISOString().slice(0, 10);

async function tavilySearch(query, days = 7, maxResults = 5) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      topic: 'news',
      days,
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return (data.results || []).map(item => ({
    title: item.title || '',
    url: item.url || '',
    summary: item.content || ''
  }));
}

async function generateBrief() {
  const searches = {
    global: await tavilySearch('most important global news today', 7, 6),
    canadian: await tavilySearch('most important Canada news today', 7, 6),
    local: await tavilySearch('Fraser Valley Abbotsford Chilliwack local news', 7, 6),
    persecutedChurch: await tavilySearch('persecuted church Christian persecution news', 14, 6),
    leadership: await tavilySearch('leadership article sustainable leadership healthy leadership organizational trust', 14, 4),
    goodNews: await tavilySearch('uplifting good news story today', 14, 4)
  };

  const prompt = `
You are preparing a daily pastoral dashboard for Kris Krausse, a lead pastor in British Columbia, Canada.

Use ONLY the search results provided below. Return ONLY valid JSON in this exact shape:

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
- choose up to 3 stories each for global, canadian, and local
- choose up to 2 stories for persecutedChurch
- choose 1 story for leadership
- choose 1 story for goodNews
- preserve exact URLs from provided results
- summaries should be concise, pastoral, and useful
- do not invent URLs
- do not use markdown
- output JSON only

Search results:
${JSON.stringify(searches, null, 2)}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'You create structured pastoral news briefings from real search results. JSON only.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content returned from OpenAI');
  }

  let brief;
  try {
    brief = JSON.parse(content);
  } catch (err) {
    throw new Error(`Invalid JSON returned: ${content}`);
  }

  brief.date = date;
  fs.writeFileSync('brief.json', JSON.stringify(brief, null, 2));
}

generateBrief().catch(err => {
  console.error(err);
  process.exit(1);
});
