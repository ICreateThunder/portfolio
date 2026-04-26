---
title: "Privacy-Respecting Analytics for $5/month"
description: "Building a page view counter that stores no cookies, no IPs, and no PII — a Rust binary with in-process rate limiting and a DynamoDB backend."
slug: "edge-analytics"
published: 2026-04-22
tags: ["rust", "aws", "analytics", "privacy", "axum", "dynamodb", "infrastructure"]
author: "Robert Shalders"
image: "/images/articles/edge-analytics.jpg"
---

## Why Build This

I wanted to know how many people visit my portfolio site. That is the entire requirement. Not who they are, where they came from, what device they use, or how long they stay. Just: how many page views, on which pages, broken down by hour.

Google Analytics can do this. So can Plausible, Fathom, Umami, and a dozen other tools. But they all involve either third-party JavaScript (which I'd need a cookie banner for), a hosted service (which costs more than my entire AWS bill), or a self-hosted application that needs more infrastructure than the site itself.

I wanted something simpler. A single binary that accepts a POST request, increments a counter, and returns 204. No cookies. No IP logging. No JavaScript SDK. No cookie banner. No GDPR concern.

---

## The Architecture

```
Browser (fetch with keepalive)
  → Caddy (TLS termination, Let's Encrypt)
      → Rust binary (axum)
          → In-process rate limiter
          → Path validation against sitemap whitelist
          → DynamoDB atomic counter increment
```

The binary runs on a small ARM EC2 instance at $5/month. Caddy handles TLS automatically via Let's Encrypt. Both run as Docker containers.

---

## The Client Side

One line in the site's `<head>`:

```javascript
fetch("https://analytics.robertshalders.com/views", {
  method: "POST",
  body: JSON.stringify({ path: location.pathname }),
  headers: { "Content-Type": "application/json" },
  credentials: "omit",
  keepalive: true,
}).catch(function() {});
```

`credentials: "omit"` ensures no cookies are sent. `keepalive: true` ensures the request completes even if the user navigates away (same behaviour as `sendBeacon`, but with more control over CORS). The `.catch` swallows errors silently — analytics should never interfere with the user's experience.

---

## What Gets Stored

Each page view increments an atomic counter in DynamoDB:

| Key | Type | Example |
|-----|------|---------|
| `path` (partition key) | String | `/`, `/projects/oxiflight` |
| `dateHour` (sort key) | String | `2026-04-22T14` |
| `views` | Number | `47` |

That is the complete schema. Three fields. No IP address, no user agent, no session ID, no device fingerprint, no referrer. The binary never reads these values from the request — they exist in the HTTP headers but are never accessed, logged, or stored.

This means no GDPR applicability. You cannot process personal data that you never collect.

---

## Path Validation

The binary does not blindly write whatever path it receives into DynamoDB. An attacker could send `{"path": "<script>alert(1)</script>"}` or `{"path": "someone@email.com"}` — injecting malicious content or PII into your database.

Instead, the binary fetches the site's `sitemap.xml` on startup and builds an in-memory whitelist of valid paths:

```rust
async fn fetch_sitemap_paths(sitemap_url: &str, site_origin: &str) -> Option<HashSet<String>> {
    let resp = reqwest::get(sitemap_url).await.ok()?;
    let bytes = resp.bytes().await.ok()?;
    if bytes.len() > MAX_SITEMAP_BYTES { return None; }
    // parse <loc> elements, validate characters, normalise trailing slashes
}
```

Only paths that exist in the sitemap are accepted. Everything else returns 204 silently — the attacker cannot distinguish a successful write from a rejection.

The whitelist refreshes periodically, so new articles are automatically accepted after the next sitemap rebuild. The sitemap response size and path count are capped to prevent resource exhaustion if the sitemap URL is ever poisoned.

Each path is validated against a strict character set and length limit before being accepted.

---

## Rate Limiting

The binary implements a token-bucket rate limiter in-process:

Each unique path gets its own bucket. Once the per-minute threshold is exceeded, requests receive 429 Too Many Requests until the bucket refills. Stale buckets are cleaned up every five minutes to prevent unbounded memory growth.

This is the key cost protection. DynamoDB on-demand pricing is $1.25 per million writes. Without rate limiting, an attacker hammering the endpoint could rack up real charges. With the limiter, the maximum write throughput is bounded by the number of valid paths times the per-minute threshold — and the sitemap whitelist bounds the number of valid paths.

The rate limiter uses path as the key, not IP address, because we do not track IPs. This means an attacker could suppress analytics for a specific page by exhausting its bucket. That is an acceptable tradeoff — suppressed analytics is a nuisance, not a breach.

---

## Why a Fixed-Cost EC2 Instead of Lambda

The first iteration used Lambda with a Function URL. It worked, but had a problem: cost scales with requests. Under normal traffic, Lambda is effectively free. Under a sustained attack, it is not.

A small EC2 instance costs $5/month regardless of whether it handles one request or one million. The rate limiter drops excess requests in memory before they reach DynamoDB. Under attack, the CPU spikes but the bill does not change.

This is the critical property: the cost ceiling is fixed and known. No billing attack can change it.

---

## DynamoDB Conditional Writes

Even with rate limiting, the binary adds a second layer of protection at the database level:

```rust
.condition_expression("attribute_not_exists(#v) OR #v < :max")
```

Each hourly counter has a ceiling. If a path receives an unreasonable number of views in a single hour, DynamoDB rejects further increments via a conditional check. This prevents counter inflation even if the rate limiter is bypassed.

The conditional check failure is silent — the attacker sees a 204 either way.

---

## CORS

The binary only accepts requests from the portfolio domain:

```rust
let cors = CorsLayer::new()
    .allow_origin(AllowOrigin::exact(site_origin.parse().unwrap()))
    .allow_methods([Method::POST, Method::OPTIONS])
    .allow_headers([header::CONTENT_TYPE]);
```

This prevents other sites from sending beacons to the endpoint. It does not prevent `curl` or scripts — CORS is a browser-enforced policy, not server-side access control. The rate limiter and path whitelist handle non-browser abuse.

---

## Timing Side Channels

An interesting question came up during development: can an attacker distinguish a DynamoDB write from a rejected request based on response time?

Testing showed no meaningful difference. The network latency to the instance dominates, and the database write time is lost in the noise. All response codes are identical (204) regardless of outcome, so there is no information leakage through status codes either.

At portfolio traffic levels, this is not a concern. At higher volumes with more consistent network conditions, a statistical analysis might extract signal — adding a small random delay before responding would close this gap if needed.

---

## The Date-Hour Key

DynamoDB needs a sort key for efficient queries. The binary generates a `YYYY-MM-DDTHH` string without pulling in the `chrono` crate — a hand-rolled function using `SystemTime` and basic calendar arithmetic:

```rust
fn chrono_lite_date_hour() -> String {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let days = secs / 86400;
    let hour = (secs % 86400) / 3600;
    // ... civil calendar conversion
}
```

This keeps the dependency tree small and the binary lean. The sort key enables efficient queries like "all views for `/` on 2026-04-22" without scanning the entire table.

---

## Deployment

The binary is cross-compiled for the target architecture and deployed to the instance. Caddy runs alongside in a separate container, handling TLS termination and proxying to the analytics binary on localhost.

No static keys on disk. The instance role provides temporary credentials that rotate automatically.

Deployment is currently manual — cross-compile, copy, restart. A CI/CD pipeline with blue/green deployments is in progress, using ECR for image storage and SSM Run Command for zero-downtime rollouts with automatic rollback on failed health checks.

---

## What It Costs

| Component | Monthly cost |
|-----------|-------------|
| EC2 instance | $5 |
| DynamoDB (on-demand) | ~$0.01 |
| Elastic IP | $0 (attached) |
| Route 53 record | included in zone |
| Caddy + Let's Encrypt | $0 |
| **Total** | **~$5** |

Under sustained attack: still $5. The EC2 is the cost ceiling.

---

## What I Would Change

If I rebuilt this from scratch:

1. **Start with the sitemap whitelist from day one.** The initial version used a hardcoded path list and regex validation. The sitemap approach is strictly better — it scales with the site and eliminates the "fake slug" problem entirely.

2. **Use `cargo-cross` for cross-compilation.** The manual cross-compilation setup and fighting crypto library linking issues was painful. `cross` handles toolchain management in Docker and would have saved time.

3. **Add a `/stats` endpoint from the start.** Currently I query DynamoDB from the CLI. A simple JSON endpoint would make the data more accessible and demonstrate that the system is live.

The code is open source: [edge-analytics on GitHub](https://github.com/ICreateThunder/edge-analytics).
