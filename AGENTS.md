---
description: Agentic rules for code style, comments, and testing.
alwaysApply: true
---

# Project
- All code resides in the `source` directory.
- All tests reside in the `source/Test` directory.
- Follow existing file naming conventions, especially for test files – don't add prefixes or suffixes, keep it clean.

# Code
- Always respect consistency – if the existing code does something differently (before you modified it), stick with that.
- Match existing code style and formatting in the project.
- Prefer shorter, compact code (fewer lines when possible).
- Avoid using of helpers and extensions, especially at a local level – prefer self-sufficient code.
- Avoid using abbreviations for naming, except for absolutely universal words, like `min`, `max`, `html`, etc.
- Place constructors at the top of the type. Do not move or reorder them.
- Code for external frameworks must be compatible with their latest versions.
- Avoid using unnecessary trailing decimal zeros in Double and Float types, i.e., prefer `1` vs. `1.0`.

# Comments
- Follow standard English grammar and punctuation.
- End sentences with commas where appropriate.
- Keep comments lean and purposeful — explain *why*, not *what*.
- Comments must help understand the essence, not repeat what the code does.
- Avoid filler words or redundant descriptions.
