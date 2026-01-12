# How to Work with AI Agent

A practical guide for collaborating effectively with AI agents in your development workflow.


## Teach Tools, Not Tasks

> **Give the AI the right tools instead of detailed instructions.**

When working with AI agents, it's tempting to explain everything and let them handle it directly. But here's the thing — AI agents are much more effective when you give them the right tools instead of detailed instructions.

Think about formatting code. You could explain all your formatting rules to the AI and have it manually fix every inconsistency. But that's slow and error-prone. A better approach? Just tell the AI how to run your preconfigured formatter (like Prettier or ESLint). One command, consistent results, every time.

### Automate What You Wouldn't Do Manually

Here's a good rule of thumb: if it's something you wouldn't do by hand yourself, don't ask the AI to do it by hand either.

Instead, turn those repetitive tasks into tools. Set up scripts, configure linters, create CLI commands — whatever makes sense for your workflow. Then teach the AI:

1. **How to run the tool** — the actual command or script
2. **When to use it** — the situations where this tool is the right choice
3. **How to read the output** — what success looks like, what errors mean

This way, the AI becomes a skilled operator of your toolchain, not just a text processor trying to simulate what tools already do better.

