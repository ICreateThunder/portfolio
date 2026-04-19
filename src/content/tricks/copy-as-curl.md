---
title: "Copy as cURL: The Browser's Secret Weapon"
description: "How to replay any browser request exactly — with all headers, cookies, and auth — using one menu item in DevTools."
slug: "copy-as-curl"
published: 2026-03-16
tags: ["curl", "devtools", "debugging", "bash", "http", "testing"]
author: "Robert Shalders"
image: "https://images.unsplash.com/photo-1629654291663-b91ad427698f?auto=format&fit=crop&w=800&q=60"
---

## The Trick

Open DevTools. Go to the Network tab. Find any request. Right-click it.

**Copy → Copy as cURL**

That is it. You now have the exact HTTP request your browser just made — complete with every header, every cookie, your authentication tokens, the request body, the content type — ready to paste into a terminal and replay.

Chrome, Firefox, Edge, and Safari all support this. It has been there for years. Most people do not know about it.

---

## What You Get

The output looks something like this:

```bash
curl 'https://api.example.com/v1/users?page=2' \
  -H 'authority: api.example.com' \
  -H 'accept: application/json' \
  -H 'accept-language: en-GB,en;q=0.9' \
  -H 'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'cookie: session=abc123; csrf_token=xyz789' \
  -H 'referer: https://example.com/dashboard' \
  -H 'user-agent: Mozilla/5.0 ...' \
  --compressed
```

This is not a reconstructed approximation. This is the actual request your authenticated browser session just made. You can paste it into a terminal and it will work identically.

---

## Use Cases

### Debugging without the Browser

An endpoint is returning unexpected data. You want to test it in isolation, without the UI, without re-logging in, without clicking through five pages to reproduce the state.

Paste the cURL. Pipe it to `jq`. Done.

```bash
curl '...' -H 'authorization: Bearer ...' | jq '.data[] | {id, status}'
```

### Iterating Over Paginated Endpoints

You need every result from a paginated API. The UI only shows 50 at a time. You do not want to click through 40 pages.

Copy the request for page 1, then loop:

```bash
for page in $(seq 1 40); do
  curl "https://api.example.com/v1/items?page=$page" \
    -H 'authorization: Bearer YOUR_TOKEN' \
    --compressed \
    >> results.jsonl
  sleep 0.5
done
```

The `sleep` is polite. The `>>` appends each page's response to a file. Adjust as needed.

### Iterating Over IDs

You have a list of IDs and want the record for each:

```bash
while IFS= read -r id; do
  curl "https://api.example.com/v1/item/$id" \
    -H 'authorization: Bearer YOUR_TOKEN' \
    --compressed
done < ids.txt | jq -s '.'
```

The `jq -s '.'` collects the individual JSON responses into a single array.

### Storing and Archiving Results

If you need a snapshot of an API's current state — for debugging, for comparing before/after a deploy, for anything — a loop of cURL requests piped to a file is a fast and reliable approach that requires no extra tooling.

---

## A Note on Tokens

The cURL output contains your live authentication tokens and session cookies. Treat it accordingly.

Do not paste it into a public issue tracker, a Slack message, or a pastebin. Do not commit it to version control. The token in that copied request is the same credential your browser is currently using.

Rotate it if you share it accidentally.

---

## Browser Compatibility Notes

- **Chrome / Edge**: Right-click → Copy → Copy as cURL (bash) or Copy as cURL (cmd) on Windows
- **Firefox**: Right-click → Copy Value → Copy as cURL
- **Safari**: Right-click → Copy as cURL

The output format differs slightly between browsers. Chrome's output tends to be the most compatible with standard `curl` on Linux/macOS.
