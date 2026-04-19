---
title: "Building in Public vs Building in Private"
description: "Two serious projects sitting in private repos while my GitHub looks empty. Why that needs to change and what I am doing about it."
slug: "02-building-in-public"
published: 2026-04-19
tags: ["career", "github", "open-source", "opinion", "honesty"]
author: "Robert Shalders"
image: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?auto=format&fit=crop&w=800&q=60"
---

## In This Issue

1. [The Problem](#the-problem) — a GitHub profile that contradicts the CV
2. [The Tension](#the-tension) — why perfectionism keeps repos private
3. [What Changed](#what-changed) — 29 applications, zero responses
4. [What I Am Shipping](#what-i-am-shipping) — BEAT consensus and Oxiflight in detail
5. [On READMEs](#on-readmes) — the most important file in the repo
6. [On Using AI to Build](#on-using-ai-to-build) — Claude, honesty, and understanding
7. [The Daily Habit](#the-daily-habit) — contribution graphs and structure
8. [What I Am Studying](#what-i-am-studying) — async BFT research and computer architecture
9. [The Psychological Bit](#the-psychological-bit) — why making things public changes them
10. [What Is Next](#what-is-next) — concrete goals for the coming weeks

---

## The Problem

I have two serious projects. One is an implementation of the BEAT family of asynchronous Byzantine fault-tolerant consensus protocols in Rust, with censorship-resistant multi-transport networking, a market data pipeline, and Kubernetes deployment tooling. The other is an embedded Rust rewrite of Betaflight flight controller firmware for STM32, with live gyro data streaming at 8kHz on real hardware.

Neither is on my public GitHub.

My public GitHub has four repos. A Kubernetes cluster config. A dotfiles repo. A Rust repo with one commit. A profile README. Zero followers, zero stars. To a hiring manager spending 15 seconds on my profile, I do not exist as a Rust developer. I do not exist as a distributed systems engineer. I do not exist as an embedded programmer. I exist as someone who has dotfiles and opinions.

The CV says "Rust, Go, distributed systems, embedded." The GitHub says nothing. That dissonance is where applications go to die.

---

## The Tension

I know why I have not made them public. The code is not finished. There are stubs, there are TODOs, there are entire subsystems that only exist as phase outlines. Oxiflight has three complete phases and twelve more planned. BEAT works but there are rough edges I have not polished.

The excuse is always "it is not ready yet." But that is perfectionism dressed up as quality control. Nobody ships a perfect v1. Linux started as "just a hobby, won't be big and professional." The irony is that I am more likely to be judged for having nothing visible than for having something rough.

Private repos protect your ego. Public repos build your career. I have been choosing wrong.

---

## What Changed

Twenty-nine job applications with zero responses. That is what changed.

I sat down and looked at what a hiring manager actually sees when they look at my application. A CV that claims distributed systems and embedded Rust experience. A GitHub profile that contradicts it entirely. A personal site with four articles. Why would they believe me? I would not believe me.

Every day the repos stay private is a day the applications lack credibility. The code exists. The tests pass. The hardware works. The only thing missing is the willingness to let people see it before it is perfect.

---

## What I Am Shipping

### BEAT Consensus

A practical Rust implementation of the BEAT async BFT protocols described by Duan, Zhang, et al. in their research paper. BEAT stands for Byzantine, Efficient, Asynchronous, and Throughput-optimised. I did not invent the algorithms. I am building a practical, deployable implementation and extending it in directions the paper does not cover.

The implementation includes all five protocol variants (BEAT0 through BEAT4), each offering different trade-offs between bandwidth, encryption, and storage efficiency. BEAT0 through BEAT2 use Ristretto255 hybrid ElGamal threshold encryption so that no node can see another's proposal until the common set is fixed. The ABA common coin uses BLS12-381 threshold signatures. Data availability is handled with Reed-Solomon erasure coding.

What I have added beyond the paper: a multi-transport networking layer that routes messages simultaneously across clearnet TCP, Tor (SOCKS5), and I2P (SOCKS5). The idea is censorship resistance. A censor must simultaneously disrupt all three network paths to partition the system. Whether that holds in practice is an open question, but the architecture supports it.

The deployment story is real: Docker Compose for local dev clusters, Helm charts for Kubernetes with StatefulSets and automatic peer discovery, Prometheus scrape endpoints for observability. It runs on my private K8s cluster alongside other workloads.

Current focus is integrating it with a market data pipeline — a reference implementation for distributed agreement on order state. Further out, I am interested in adapting ideas from newer async BFT research, particularly Dumbo-NG's continuous pipeline and Bolt-Dumbo's optimistic fast-path, into this codebase.

### Oxiflight

An embedded Rust rewrite of Betaflight flight controller firmware, targeting STM32F4 microcontrollers. This did not start as a firmware rewrite. It started because blackbox logging data was corrupting and I wanted to implement error correction coding to make it more reliable. Then I thought "why not try making some of this safer in Rust." That escalated.

The project is structured as a Cargo workspace. Pure logic crates (math, filters) are fully testable on the host machine with no hardware dependency. Hardware crates target `thumbv7em-none-eabihf` — ARM Cortex-M4F with hardware float. The async runtime is Embassy, which replaces Betaflight's manual cooperative scheduler with proper interrupt-driven task execution.

Three phases are complete. Phase 0 bootstrapped the board: LED blink, USB CDC serial with command parsing, DFU bootloader entry. Phase 1 built the math and filter libraries: fast trigonometry using Remez minimax polynomials, CORDIC-based atan2, cascaded IIR lowpass filters (PT1, PT2, PT3), and a full biquad implementation. Phase 2 brought up the gyroscope drivers over SPI: complete implementations for the Bosch BMI270 (with config blob upload and dummy byte handling) and InvenSense MPU6000. Live 8kHz gyro data streams on a SpeedyBee F405 V3.

47 tests pass on the host. The firmware flashes via DFU with no debug probe needed.

Next is the filter pipeline (Phase 3), then the PID controller (Phase 4), then motor output via DShot protocol (Phase 5 — the safety gate, because after that, the firmware controls a physical object in the air).

---

## On READMEs

A good README is more important than clean code for first impressions. When someone lands on your repo, they are asking four questions: what does this do, why does it exist, how do I run it, and what state is it in.

Answer those honestly and you have already done more than most. "Work in progress" is a perfectly acceptable state. "Empty repo with no README" is not.

I am writing the READMEs before making the repos public. Not as marketing, but as documentation. If I cannot explain what the project does in plain language, I do not understand it well enough.

---

## On Using AI to Build

I use Claude Code to assist with both projects. I am not going to pretend otherwise.

Claude generates stubs, phase outlines, documentation scaffolding, and test boilerplate. I write the driver code, the register sequences, the filter implementations, the architectural decisions. The distinction matters.

If Claude writes my BMI270 SPI driver, I finish faster but I do not learn why the chip needs a dummy byte on reads, or how Embassy's interrupt-driven executor schedules tasks. If I write it with Claude as a reference, I finish slower but I can debug it at 3am when something breaks on the hardware. Understanding is the point. The firmware is the proof.

Pretending you did not use tools is dishonest. Explaining how you used them is interesting. The work is real either way.

---

## The Daily Habit

I am structuring the portfolio sprint around a daily schedule. Morning for deep work on projects. Afternoon for articles, applications, and admin. The contribution graph is stupid but it works — once you have a streak of green squares, you do not want to break it.

The target is simple: one commit per day, minimum. Some days that is a full driver implementation. Some days it is a README update or a test fix. The floor matters more than the ceiling. A 50-line day is infinitely better than a zero-line day where you beat yourself up about it.

I have also started tracking progress weekly. Applications sent, commits made, articles written, flight hours logged. Not because the tracking itself is productive, but because it makes drift visible. If the numbers are flat for two weeks, something is wrong and I need to change it.

---

## What I Am Studying

Two threads running in parallel with the project work:

**Async BFT research.** BEAT was published in 2018 and the field has moved substantially since then. The Dumbo family (Dumbo1, Dumbo2, Speeding Dumbo, Dumbo-NG) reduced communication complexity and improved throughput. PACE achieved optimal multi-valued validated Byzantine agreement. Bolt-Dumbo bolted an optimistic fast-path onto async BFT for 3-round latency in the common case. And the DAG-based approaches (Narwhal, Tusk, Bullshark) took a fundamentally different architectural direction and now power production blockchains like Sui.

I am reading these papers not to implement all of them, but to understand where the ideas could improve my existing BEAT codebase. Dumbo-NG's continuous pipeline approach is particularly interesting for throughput. I am also curious about post-quantum cryptography for BFT — replacing the Ristretto255 and BLS12-381 primitives with lattice-based alternatives. That would be genuinely novel territory.

**Computer architecture.** Professor Onur Mutlu's lectures from ETH Zurich and CMU remain some of the best educational material available on the internet. I am currently working through the content on memory hierarchies, DRAM behaviour, and processing-in-memory (PIM). PIM is fascinating — the idea that DRAM can perform bulk bitwise operations and majority functions by exploiting timing constraint violations, potentially enabling massive parallelism for specific workloads without moving data to the CPU. This feeds directly into how I think about performance in both the embedded (Oxiflight) and distributed systems (BEAT) contexts.

---

## The Psychological Bit

Making something public changes your relationship with it. You suddenly care more. You write the README because someone might read it. You clean up the naming because someone might judge it. You fix the test that you have been ignoring because someone might run it.

External accountability beats internal discipline every time.

This newsletter exists on a site that was itself mostly unfinished for months. I am writing about building in public while only just starting to do it. Practice what you preach is hard when preaching is easier than practising. But shipping this newsletter is itself an act of building in public.

---

## What Is Next

Concrete goals for the next few weeks:

- Make BEAT and Oxiflight repos public on GitHub with proper READMEs
- Pin BEAT, Oxiflight, and K8s cluster repos. Unpin dotfiles.
- Complete Oxiflight Phase 3 (filter pipeline) and start Phase 4 (PID controller)
- Write detailed project articles for both (already in progress on this site)
- Send 3-5 targeted job applications per week with the updated CV and portfolio
- Continue PPL flight training when slots are available
- Maintain at least two in-person social activities per week — tech meetups, flying club, anything that is not coding alone in a bedroom

The repos will follow this newsletter. The streak starts somewhere.

It starts here.
