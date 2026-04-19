---
title: "Rustflight: Rewriting Betaflight in Rust for STM32"
description: "An embedded Rust rewrite of Betaflight flight controller firmware — started from a blackbox logging problem, turned into a ground-up firmware project on real hardware."
slug: "rustflight"
published: 2026-04-01
tags: ["rust", "embedded", "stm32", "betaflight", "firmware", "no-std"]
author: "Robert Shalders"
image: "https://images.unsplash.com/photo-1699084582693-e53096751634?auto=format&fit=crop&w=800&q=60"
---

## How It Started

The project did not begin as a firmware rewrite. It started with a specific problem: blackbox logging data on Betaflight was corrupting, and I wanted to try implementing error correction coding (ECC) for the blackbox to make the logged data more reliable.

Then I thought — why not try to make the whole thing a little safer and have some fun converting parts of it to Rust?

That escalated.

---

## What It Is Now

Rustflight is a ground-up Rust rewrite of Betaflight flight controller firmware, targeting STM32F4 microcontrollers. It is not a wrapper around the existing C code. It is a clean implementation using the Embassy async runtime, with the Betaflight C source as a reference for behaviour and algorithms.

The project is structured as a Cargo workspace with separated concerns:

- **rustflight-app** — the Embassy async entry point, USB CDC serial, DFU bootloader
- **rustflight-hal** — trait definitions (GyroDriver, MotorOutput, etc.)
- **rustflight-drivers** — sensor drivers for BMI270 and MPU6000 gyroscopes over SPI
- **rustflight-bsp-stm32f4** — board support for SpeedyBee F405 and DarwinFPV F411
- **rustflight-math** — pure no_std trigonometry, unit conversions, helpers
- **rustflight-filter** — PT1, PT2, PT3, and biquad digital filters

The pure logic crates (math, filter) are fully testable on the host machine — no hardware needed. The hardware crates target `thumbv7em-none-eabihf` (ARM Cortex-M4F with hardware float).

---

## What Works

Phase 0 through Phase 2 are complete and tested on real hardware:

**Phase 0 — Bootstrap.** LED blink, USB CDC serial with command parsing, DFU bootloader entry via RTC backup register, defmt RTT logging. The board powers up, connects over USB, and accepts commands.

**Phase 1 — Math and Filters.** 28 math tests and 19 filter tests, all passing on the host. Fast sine/cosine using Remez minimax polynomials, CORDIC-based atan2, cascaded IIR lowpass filters with cutoff frequency correction, and a full biquad implementation supporting lowpass, notch, and bandpass modes.

**Phase 2 — Gyro and SPI.** Complete drivers for the Bosch BMI270 and InvenSense MPU6000 gyroscopes. The BMI270 driver handles the chip's config blob upload, SPI dummy byte protocol, and burst data reads. Both drivers implement a shared `GyroDriver` trait. Live 8kHz gyro data is streaming on the SpeedyBee F405 V3 — I can move the board and watch the values change in real time over the debug channel.

47 tests pass on the host. The firmware flashes via DFU (no debug probe needed).

---

## How I Am Learning

I use Claude Code to assist with this project, but the way I use it is deliberate. Claude generates stubs and phase outlines. I implement them. The distinction matters.

Each phase follows a learning pattern: read the relevant Betaflight C source, understand the algorithm and the hardware constraints, then write the Rust implementation with tests. Claude accelerates the scaffolding and documentation, but the actual driver code, the register sequences, the timing constraints — I write those and I debug them on the hardware.

The reason is simple: if I let Claude write all the code, I would finish faster but I would not understand the SPI bus protocol, or why the BMI270 needs a dummy byte on reads, or how Embassy's interrupt-driven executor schedules tasks. Understanding is the point. The firmware is the proof.

---

## What Is Next

**Phase 3 — Filter Pipeline.** Chain the filters into a configurable gyro processing pipeline: lowpass → notch → notch → lowpass, matching Betaflight's filtering architecture.

**Phase 4 — PID Controller.** The core flight control loop. D-term on measurement, feedforward, anti-windup, configurable rates.

**Phase 5 — Motor Output.** DShot protocol output to ESCs. This is the safety gate — once motors spin, the firmware is responsible for a physical object in the air.

Beyond that: RC input (CRSF and ELRS protocols), blackbox logging with the ECC that started this whole thing, configuration over MSP, and eventually — a flying drone running Rust firmware.

---

## Why Betaflight

Betaflight is one of the most widely used open-source flight controller firmware projects. It runs on millions of FPV drones. The C codebase is mature, well-optimised, and thoroughly tested in the real world.

It is also dense, macro-heavy, and carries the weight of years of accumulated features. Porting it to Rust is not about proving Rust is better than C. It is about understanding how a real-time embedded system works at every level — from SPI register reads to PID loop timing to motor output protocols — and building that understanding through implementation.

The drone does not care what language its firmware is written in. But I care about understanding what the firmware does, and Rust makes that understanding explicit in ways that C leaves implicit.
