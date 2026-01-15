---
name: test-skill
description: Test skill for verifying the Skills system upgrade
when_to_use: When user wants to test the skills system
allowed-tools:
  - read_file
  - Glob
argument-hint: "<optional-message>"
version: "1.0.0"
---

# Test Skill

This is a test skill to verify the production-grade Skills system.

## Features Tested:
- Multi-directory loading (.ai-agent/skills)
- when_to_use field for AI auto-invocation
- allowed-tools restriction
- $ARGUMENTS parameter substitution

## Arguments
$ARGUMENTS

## Instructions
Please confirm that you received this skill content and list the features that were successfully loaded.
