# Product Authentication Network (PAN)

A product identity and verification platform. One secure digital identity for every individual physical product unit.

## Experience surfaces
- **Manufacturer portal** — onboarding, product catalogue, production batches, identity issuance and scan intelligence.
- **Consumer app** — Android and iOS scanning, verification, history and reporting.
- **Public verification** — mobile-first browser verification; no app or account required.

## Architecture
A TypeScript monorepo with Next.js web applications, Expo / React Native mobile, a NestJS API, PostgreSQL, Redis-backed jobs and shared contracts. See [System architecture](docs/SYSTEM-ARCHITECTURE.md) and [Product specification](docs/PRODUCT-SPECIFICATION.md).

## Design direction
PAN uses a calm, premium visual language: deep forest, warm ivory, sage and restrained brass. Interfaces prioritise clarity, trust, accessible contrast and excellent responsive behaviour.

## Status
Foundation phase. The manufacturer dashboard is an interactive visual prototype using illustrative data; it is not yet connected to production services. No real product is certified by this prototype.

## Development
See [Getting started](docs/GETTING-STARTED.md). Never commit secrets or real consumer data.
