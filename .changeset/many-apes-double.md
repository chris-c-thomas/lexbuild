---
"@lexbuild/ecfr": patch
"@lexbuild/cli": patch
"@lexbuild/core": patch
"@lexbuild/usc": patch
---

Manage Shiki's memory with forked child processes instead of a single process. Each child is 10k files and its memory is released back to the OS once highlighting is complete.
