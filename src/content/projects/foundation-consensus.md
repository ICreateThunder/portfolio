---
title: "BEAT Consensus: Async BFT Across the Network Stack"
description: "A practical implementation of the BEAT asynchronous BFT protocols (Duan et al.) with censorship-resistant multi-transport networking — clearnet, Tor, and I2P simultaneously."
slug: "foundation-consensus"
published: 2026-03-20
tags: ["distributed-systems", "consensus", "fault-tolerant", "event-driven", "cryptography", "networking"]
author: "Robert Shalders"
image: "/images/articles/foundation-consensus.jpg"
---

## What Is This

This project is a practical Rust implementation of the BEAT family of asynchronous Byzantine fault-tolerant consensus protocols, as described by Duan, Zhang, et al. in their [BEAT paper](https://bchainzhang.github.io/files/beat.pdf). BEAT stands for Byzantine, Efficient, Asynchronous, and Throughput-optimised.

The premise: multiple nodes must agree on something, even if some of them are lying, broken, or actively adversarial. The implementation handles this without requiring synchronous timing assumptions — a significant property when your nodes are not on the same continent, the same network, or even operating under the same conditions.

My contribution beyond the paper is primarily the multi-transport censorship-resistant networking layer, the market data pipeline integration, and practical deployment tooling (Docker, Helm, Kubernetes).

---

## Why Multiple Transports

Most distributed systems pick a transport and commit to it. This implementation does not.

The system routes across three transports simultaneously, each offering a different trade-off between performance and resilience:

**Standard networking** is fast. It is also filterable and blockable by any sufficiently motivated operator. Use it for performance. Do not rely on it alone for resilience.

**Anonymising overlays** provide strong isolation at the cost of latency. Useful for nodes operating in environments where reliability of standard routes cannot be guaranteed. The consensus protocol is designed to tolerate variable round-trip overhead.

**Mesh routing layers** are optimised for internal peer-to-peer traffic with different resilience properties and a different failure model to the above.

The combination gives the system a meaningful property: a node can participate in consensus regardless of which transports are available, and a disruption must affect all three simultaneously to partition the network.

---

## Fault Tolerance in Practice

A Byzantine fault is not simply a crash. It is a node that behaves arbitrarily — sending different messages to different peers, delaying responses strategically, or actively attempting to subvert consensus. Named after the Byzantine Generals Problem, formalised by Lamport, Shostak, and Pease in 1982.

Classical BFT protocols (PBFT and its descendants) are synchronous or partially synchronous — they assume bounded message delays. This assumption does not hold under variable-latency routing, adversarial network conditions, or heterogeneous transport mixing.

BEAT's consensus layer operates asynchronously. It makes no assumptions about when messages arrive. It tolerates up to ⌊(n−1)/3⌋ Byzantine nodes in a network of n — the theoretical maximum for asynchronous BFT. The implementation includes all five BEAT variants (BEAT0–BEAT4), each offering different trade-offs between bandwidth, encryption, and storage efficiency.

---

## CAP Theorem Considerations

The system sits firmly on the CP side of the CAP triangle by design. Under a network partition, it chooses consistency over availability — nodes will not make progress if they cannot achieve quorum. This is the correct trade-off for a system whose purpose is agreement.

The partition tolerance comes from the multi-transport architecture: partitions must be total (affecting all transports simultaneously) to halt the system.

---

## Eventual Use Cases

The use cases worth naming:

- **Trading engine integration** — distributed agreement on order state or settlement without a trusted central counterparty. The current implementation includes a market data pipeline reference (`DataFeed → MarketBatch → BEAT → MarketState`).
- **Family-scale secure storage** — consensus-backed fault-tolerant file storage between a small number of trusted devices (e.g. 4 phones each contributing 16GB), none of which need to be online simultaneously. Small committee sizes (n=4–7) are where BEAT's complexity works well.
- **Censorship-resistant coordination** — reliable event ordering across distributed nodes where some network paths may be actively blocked. The multi-transport layer means a censor must simultaneously disrupt clearnet, Tor, and I2P.

---

## Current Implementation

The Rust implementation includes:

- All five BEAT protocol variants (BEAT0–BEAT4)
- Ristretto255 hybrid ElGamal threshold encryption (BEAT0–BEAT2)
- BLS12-381 threshold signatures for the ABA common coin
- Reed-Solomon (n−f, n) erasure coding
- Encrypted-at-rest keystore (ChaCha20-Poly1305)
- WAL + sled-backed state persistence with crash recovery
- Multi-transport fan-out switch with deduplication (clearnet, Tor SOCKS5, I2P SOCKS5)
- Prometheus metrics and reconnect management
- Docker Compose and Helm chart deployment

Future work may explore adapting ideas from more recent async BFT protocols — particularly Dumbo-NG's continuous pipeline approach and Bolt-Dumbo's optimistic fast-path — into this codebase.
