---
title: "Profiling PHP with Xdebug & Cachegrind"
description: "How to find and eliminate the actual bottlenecks in a legacy PHP application using profiling tools — rather than guessing."
slug: "xdebug-cachegrind-profiling"
published: 2026-03-18
tags: ["php", "performance", "xdebug", "cachegrind", "profiling", "legacy"]
author: "Robert Shalders"
image: "/images/articles/xdebug-cachegrind.jpg"
---

## The Principle

You cannot optimise what you cannot measure.

This sounds obvious until you watch a senior developer add a cache layer to an endpoint that turned out to not be the bottleneck at all, spending two days making a fast function faster whilst the actual problem — a `while` loop firing a database query per iteration — sat untouched, running 400 queries per page load.

Profiling first. Always.

---

## The Setup

**Xdebug** is a PHP extension that, among other things, can emit profiling data in the Cachegrind format — a call graph of your application with timing and call counts.

Enable profiling in your `php.ini` or Xdebug config:

```ini
xdebug.mode=profile
xdebug.output_dir=/tmp/xdebug
xdebug.profiler_output_name=cachegrind.out.%p.%r
```

Trigger profiling with the `XDEBUG_PROFILE` query parameter or cookie, or enable it globally for a single request:

```bash
curl "https://your-app.local/slow-endpoint?XDEBUG_PROFILE=1"
```

This produces a `.cachegrind` file in your output directory.

---

## Reading the Output

Raw Cachegrind files are not human-friendly. Use a visualiser:

- **KCachegrind** (Linux/KDE) — the canonical tool, excellent call graph visualisation
- **QCachegrind** (cross-platform Qt build of the same) — works on macOS and Windows
- **Webgrind** — a PHP-based web UI if you prefer not to install a desktop tool

Load the file, sort by **Self Cost** first. This tells you where your application is actually spending CPU time, not where it is called from.

---

## What You Will Typically Find in Legacy PHP

In my experience with legacy PHP applications, the offenders are almost always the same:

### 1. The N+1 Query Inside a Loop

```php
// This is running a query for every item in $items
while ($item = fetch_next($items)) {
    $details = $db->query("SELECT * FROM details WHERE item_id = ?", [$item['id']]);
    render($item, $details);
}
```

Replace with a single query using `IN`:

```php
$ids = array_column($items, 'id');
$placeholders = implode(',', array_fill(0, count($ids), '?'));
$details = $db->query("SELECT * FROM details WHERE item_id IN ($placeholders)", $ids);
$detailsById = array_column($details, null, 'item_id');

foreach ($items as $item) {
    render($item, $detailsById[$item['id']] ?? null);
}
```

### 2. Fetching Columns You Do Not Use

```php
// Fetches every column including large text/blob fields
$rows = $db->query("SELECT * FROM articles WHERE category = ?", [$category]);
```

Select only what you render:

```php
$rows = $db->query("SELECT id, title, published_at FROM articles WHERE category = ?", [$category]);
```

### 3. Redundant Identical Queries

The same query executed multiple times per request because it lives inside a function called in a loop. Add an in-request cache:

```php
$cache = [];
function get_config(string $key): string {
    global $cache;
    if (!isset($cache[$key])) {
        $cache[$key] = $db->query("SELECT value FROM config WHERE key = ?", [$key])[0];
    }
    return $cache[$key];
}
```

---

## The Process

1. Profile a representative slow request
2. Open in KCachegrind, sort by Self Cost
3. Find the highest-cost functions that are not PHP internals
4. Read that code
5. Fix the obvious thing
6. Profile again to confirm the improvement
7. Repeat until the performance is acceptable

The second profile is important. It is easy to introduce a new bottleneck while eliminating the old one, or to discover that the function you fixed was only 10% of the problem and the real culprit is one level up the call stack.

Measure. Change one thing. Measure again.
