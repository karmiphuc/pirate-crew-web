# Decision 0001: Browser-first crew simulator

Date: 2026-10-05
Status: initial implementation default; validate during prototype.

## Context

The requested project rebuilds the compelling Pixel Piracy ship/crew/expedition idea for the web. Reliability and a complete loop matter before content breadth. No existing codebase or licensed reference assets have been provided.

## Decision

The user clarified the goal as a personal-use remake, with free/noncommercial sharing and proper attribution. Use original or suitably licensed assets and track credits/permissions separately. Target desktop browsers with TypeScript, Phaser, and Vite. Keep simulation renderer-independent. Ship single-player gameplay and local saves without an account or runtime backend. Start with one region and tactical pause. Use abstract travel and seaworthiness.

## Alternatives considered

- Unity WebGL: plausible with an existing Unity project/team, but none is available; custom web-native work gives direct control of browser lifecycle and DOM UI.
- PixiJS with custom game infrastructure: viable, but more initial input/audio/scene tooling to assemble.
- Multiplayer first: adds authority, networking, operations, and persistence before proving the core loop.
- Full sailing physics: increases scope without resolving crew/navigation risks.

## Consequences

The project must implement its own simulation and reliable ship navigation. Browser save behavior and hidden tabs require explicit handling. Future multiplayer will need a new decision and server-authoritative design. Changing frameworks remains possible if the prototype exposes material limitations.
