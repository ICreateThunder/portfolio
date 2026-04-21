---
title: "Maximising Performance Through Cache Hierarchy"
description: "My dissertation research into matrix multiplication performance — exploring how L1, L2, L3 caches and TLB behaviour determine whether your code runs fast or crawls."
slug: "cache-hierarchy-dissertation"
published: 2023-06-15
tags: ["performance", "cache", "computer-architecture", "c", "valgrind", "dissertation"]
author: "Robert Shalders"
image: "/images/articles/cache-hierarchy.jpg"
---

## The Question

Why does the order you access memory matter more than the algorithm you choose?

My dissertation at the University of Leicester investigated this through the lens of matrix multiplication. Not because matrix multiplication is inherently interesting, but because it is one of the clearest demonstrations of how cache behaviour dominates performance at scale.

The same mathematical operation — multiplying two matrices — can vary in execution time by orders of magnitude depending on how you traverse the data. The algorithm is identical. The cache access pattern is not.

---

## What I Tested

I implemented and benchmarked several approaches to matrix multiplication in C:

**IJK variants** — the classic triple nested loop, but with the loop order permuted. IJK, IKJ, JIK, JKI, KIJ, KJI. Same result, same operation count, wildly different performance. The difference is entirely down to which arrays are accessed sequentially (cache-friendly) versus strided (cache-hostile).

**Blocking (tiled) multiplication** — dividing the matrices into sub-blocks that fit within L1 or L2 cache. Instead of streaming through the entire matrix and evicting useful data, you work on a block until it is finished, then move on. The block size is chosen to match the cache line size and capacity.

**Recursive multiplication** — a divide-and-conquer approach that naturally produces cache-friendly access patterns. As the sub-problems shrink, they eventually fit entirely within cache, and the recursion handles the tiling implicitly.

---

## How I Measured

**Valgrind's cachegrind tool** — simulates L1 and LL (last-level) cache behaviour, reporting hits, misses, and miss rates for both data reads and writes. This gives precise cache performance data without needing hardware counters.

**`time` and `perf stat`** — wall-clock timing and hardware performance counter data (cache references, cache misses, TLB misses, branch mispredictions) to ground-truth the simulation against real hardware behaviour.

The combination matters. Valgrind tells you exactly which lines of code are causing cache misses. Hardware counters tell you the real-world cost.

---

## What I Found

The results confirmed what the theory predicts, but seeing it in practice makes it visceral:

**Loop order matters enormously.** The worst IJK variant was over 10x slower than the best for large matrices. The difference is entirely cache misses — one variant accesses memory sequentially (hitting the same cache line repeatedly), the other strides across rows (evicting the cache line before it is fully used).

**Blocking works.** Choosing a block size that fits within L1 dramatically reduced cache miss rates. The sweet spot depends on your hardware — too small and you waste loop overhead, too large and you spill out of cache.

**TLB misses are the hidden cost.** Even when L1/L2 miss rates looked acceptable, TLB (Translation Lookaside Buffer) misses added significant overhead for large matrices. The TLB maps virtual to physical addresses, and when you access memory across many pages, TLB evictions force expensive page table walks. Blocking helps here too — by keeping accesses within fewer pages.

**Recursive multiplication handled itself.** The cache-oblivious nature of the recursive approach meant it performed well across different cache sizes without needing to tune block sizes. It was not always the fastest, but it was consistently good.

---

## Why This Matters Beyond Matrices

Matrix multiplication was the test case, but the principles apply everywhere:

- Sequential memory access is fast. Strided access is slow. This is why arrays of structs often outperform structs of arrays, and vice versa depending on access patterns.
- If your data fits in L1, your code runs at a fundamentally different speed than if it does not.
- Profiling cache behaviour (not just CPU time) reveals performance problems that are invisible to a standard profiler.

This research is what led me to Professor Onur Mutlu's lectures on computer architecture, and eventually to the deeper study of memory hierarchies, DRAM behaviour, and processing-in-memory that I continue today. The dissertation was the starting point. The curiosity it sparked has not stopped.
