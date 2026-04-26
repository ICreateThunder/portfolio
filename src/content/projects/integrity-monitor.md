---
title: "Stealth File Integrity Monitoring with SSM and Lambda"
description: "Designing an invisible intrusion detection system for an EC2 instance — no scripts on disk, no cron jobs, cryptographically random scheduling, and tamper-proof audit trails."
slug: "integrity-monitor"
published: 2026-04-22
tags: ["aws", "security", "ssm", "lambda", "intrusion-detection", "infrastructure"]
author: "Robert Shalders"
image: "/images/articles/integrity-monitor.jpg"
---

## The Problem

I have an EC2 instance running a small Rust binary. It faces the public internet on two ports. The attack surface is minimal — but minimal is not zero.

If someone compromises the instance, I want to know. Not eventually. Not when I happen to check. Automatically, within hours.

The standard answer is AIDE or Tripwire. Install a file integrity checker, schedule it with cron, compare hashes against a known-good baseline. But this approach has a fundamental flaw: everything lives on the machine you're trying to protect. An attacker who gains root can find the cron job, read the baseline, understand the monitoring, and tamper with all of it before you ever get an alert.

I wanted something different.

---

## Design Constraints

1. **Nothing on disk.** No scripts, no cron entries, no configuration files related to monitoring. An attacker running `find`, checking `crontab`, or inspecting systemd timers should find nothing.

2. **Unpredictable timing.** Fixed schedules are observable. If a check runs at midnight every night, an attacker who compromises the box at 00:01 has nearly 24 hours to operate, clean up, and leave. Random scheduling narrows this window unpredictably.

3. **Tamper-proof history.** Past scan results must be immutable. Even if the attacker compromises the instance, they should not be able to alter or delete evidence of the breach.

4. **One-way data flow.** The instance should not be able to read its own baseline or past manifests. It should not even know what "normal" looks like from the monitoring system's perspective.

5. **Lightweight.** The instance is small — well under a gigabyte of RAM. No room for heavyweight IDS software.

---

## The Architecture

The solution uses AWS Systems Manager Run Command, triggered by a Lambda function on a randomised schedule:

```
EventBridge (periodic trigger)
  → Scheduler Lambda (cryptographic coin flip — run or skip)
      → If run: schedule a one-shot rule at a random time within the block
          → Monitor Lambda fires at unpredictable time
              → SSM Run Command (inline shell, nothing touches disk)
                  → Instance hashes files in memory
                  → Output written to S3
              → Compares against baseline
              → Drift detected → alert with changed file list
```

The instance has zero awareness that this is happening. The SSM agent is a standard component on every Amazon Linux instance — its presence reveals nothing. The hash command is sent inline via the API, executed, and the output streams to S3. No file is created. No process lingers.

---

## Why SSM Run Command

SSM Run Command lets you execute arbitrary shell commands on an EC2 instance without SSH. The command is sent from the AWS control plane, executed by the SSM agent, and the output is captured — all without writing anything to the filesystem.

This is the key insight. Traditional FIM tools are installed software with configuration files, databases, scheduled jobs. All of that is observable from the instance. SSM Run Command is invisible because it operates through a channel the attacker would have to monitor AWS API calls to detect.

The SSM agent is pre-installed on most AWS Linux AMIs. It communicates with the Systems Manager service over HTTPS. There is no listening port, no inbound connection. Even if the attacker inspects every running process, the SSM agent looks identical to any other AWS-managed instance.

---

## Randomised Scheduling

The Lambda is triggered by EventBridge on a regular schedule — multiple times per day. But the Lambda doesn't always run the check. On each invocation, it generates a cryptographically secure random number and decides whether to proceed or skip:

```javascript
const { randomInt } = require("node:crypto");
const roll = randomInt(100);
if (roll > threshold) return { status: "skipped" };
```

The result is an unpredictable number of checks per day. An attacker cannot observe the pattern because there is no pattern.

Why `crypto.randomInt` instead of `Math.random`? `Math.random` uses a PRNG that could theoretically be predicted if the seed is known. `crypto.randomInt` draws from the OS entropy pool. Overkill? Probably. But the cost is zero and the principle matters.

---

## What Gets Hashed

The hash command covers:

- Application directory — the deployed binary and configuration
- System configuration
- OS binaries and libraries

A small number of paths that legitimately change between boots are excluded. The OS uses a deterministic update model — packages are locked to the AMI version and do not auto-update. This means system binaries and libraries should never change unless someone (or something) modifies them. Any change is suspicious by definition.

The full manifest covers thousands of files.

---

## Tamper-Proof Storage

The manifest is written to a versioned S3 bucket. The instance has write-only permission scoped to a single prefix. It cannot:

- Read the baseline
- Read past manifests
- List the bucket contents
- Delete anything

This is a write-only channel. The instance pushes data out but cannot see what's already there. Even if an attacker gains full control of the instance and its IAM role, they cannot inspect the monitoring system's state, determine what the baseline contains, or delete evidence of their intrusion.

The Lambda, running in a separate IAM context, has full read/write access to the bucket. It reads the latest manifest, compares it against the baseline, and acts on the result.

S3 versioning means even if someone somehow writes to the baseline key, the previous version is preserved and recoverable.

---

## Alert Conditions

The system alerts on five conditions:

| Condition | Meaning |
|-----------|---------|
| SSM command fails or times out | Instance unreachable — could be down, could be compromised with SSM agent killed |
| Empty manifest returned | Something prevented the hash from running — possible tampering |
| New files detected | Files added that weren't in the baseline |
| Files removed | Files deleted from the baseline |
| Files modified | Same path, different hash |

The alert includes the specific files that changed — not just "drift detected" but exactly what moved, so I can assess severity immediately.

An SSM failure is treated as seriously as a file change. If an attacker's first action is to kill the SSM agent, the next scheduled check will fail and I'll know.

---

## The Baseline Workflow

The baseline is not set automatically. On first run, the Lambda generates a manifest and saves it to S3, but does not compare it against anything. I review the manifest manually — confirm it represents a known-good state — and then copy it to the baseline path.

```bash
aws s3 cp s3://<bucket>/manifests/<latest> s3://<bucket>/baseline/<baseline>
```

This is deliberate. An auto-set baseline could capture a compromised state if the first run happens after an attack. Manual approval means I am explicitly signing off on what "normal" looks like.

After planned maintenance (package updates, binary redeployment), I regenerate the baseline through the same process.

---

## What This Doesn't Catch

No monitoring system is perfect. This approach has known blind spots:

**In-memory attacks.** If an attacker operates entirely in memory without modifying any files, the hash check will not detect them. On a stateless analytics counter with no sensitive data, the value of an in-memory-only attack is unclear — but the blind spot exists.

**Attacks between checks.** If someone modifies a file and reverts it between two checks, the change is invisible. The randomised scheduling narrows this window but does not eliminate it.

**SSM agent compromise.** If an attacker modifies the SSM agent itself to intercept commands and return fake hash output, the Lambda sees a "clean" manifest from a compromised machine. This requires root-level or kernel-level compromise — at that point, almost any monitoring is defeatable.

**CloudWatch log exposure.** The Lambda logs to CloudWatch with a short retention window. An attacker with AWS console access could read these logs and understand the monitoring system. The limited retention reduces the exposure window, and the S3 manifests (not the logs) are the authoritative audit trail.

I consider these acceptable tradeoffs for the threat model: a personal portfolio edge node with no sensitive data, minimal attack surface, and low adversary motivation.

---

## Cost

The entire system runs within AWS free tier:

- Lambda: a handful of invocations per day, well within 1M free requests/month
- SSM Run Command: free
- S3: a few megabytes of text files
- EventBridge: free tier

Monthly cost: effectively $0.

---

## What I Learned

Building this forced me to think about monitoring from the attacker's perspective rather than the defender's. The standard approach — install software, schedule it, check the output — assumes the machine is trustworthy enough to monitor itself. That assumption breaks at the exact moment monitoring matters most.

Moving the monitoring logic, scheduling, storage, and comparison entirely off the instance changes the security model fundamentally. The instance is no longer responsible for its own integrity. It is a subject being observed, not an observer.

The source code is available on request.
