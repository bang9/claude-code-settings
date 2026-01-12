# How to Work with AI Agent

A practical guide for collaborating effectively with AI agents in your development workflow.

## Table of Contents

- [Teach Tools, Not Tasks](#teach-tools-not-tasks)
- [Write Context Documents That Actually Matter](#write-context-documents-that-actually-matter)
- [Give Clear Directions, Not Vague Requests](#give-clear-directions-not-vague-requests)
- [Create Your Own Shorthand](#create-your-own-shorthand)
- [Delegate the Work That Doesn't Need You](#delegate-the-work-that-doesnt-need-you)
- [Let AI Correct Itself](#let-ai-correct-itself)
- [One Last Thing: Your Job as the Human](#one-last-thing-your-job-as-the-human)


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


## Write Context Documents That Actually Matter

> **Most AI-generated documentation is garbage. Be intentional about what you keep.**

It's easy to let documentation pile up when working with AI. The agent generates docs, you save them "just in case," and before you know it, you have a folder full of outdated, overly verbose files that do more harm than good. They bloat the context, create confusion, and ultimately slow things down.

So what should you actually document?

### Document Recurring Mistakes, Not Everything

Pay attention to patterns. There are two types of recurring mistakes worth documenting:

1. **Things humans overlook** — Context that you forget to provide, assumptions you make without realizing, or project-specific knowledge that isn't obvious from the code alone.

2. **Things AI consistently gets wrong** — Implementation patterns the AI repeatedly fails at, misunderstandings about your architecture, or edge cases it keeps missing.

When you spot these patterns, that's your signal to write it down. The good news? These critical, time-consuming mistakes aren't actually that many. Fix them with well-written guidance, and the AI will handle most tasks smoothly.

### Write for Abstraction, Not Just Recording

Don't just log what went wrong. Think about *how* to guide the AI so it can solve not just this specific problem, but similar ones in the future.

The goal is to write documentation that teaches principles, not just procedures. If you can abstract the core insight well enough, one piece of guidance can help the AI navigate ten different situations. That's the difference between documentation that compounds in value and documentation that just takes up space.

### Place Documents Where They're Needed

Break your documentation into smaller pieces and put them where they belong. CLAUDE.md supports this — you can place context files in specific directories, and they'll only be loaded when the AI is working in that area.

If a piece of guidance only applies to code under `src/a/`, put it there. This way, the AI only pulls in relevant context when it actually needs it, keeping the working context lean and focused.


## Give Clear Directions, Not Vague Requests

> **Without the right keywords, the AI will wander.**

When you give vague instructions, the AI has no choice but to explore. Tell it to "modify the auth module," and it'll start searching for "auth module" in your codebase. If it's lucky, it finds it right away. If not, it falls back to related keywords, tries different variations, and burns through context just trying to locate what you already know.

Be specific. Give the AI the exact file path, the class name, the function to modify. These keywords eliminate guesswork and let the AI get straight to work. Less exploration means less wasted context, faster results, and lower costs.

### When in Doubt, Ask the AI to Ask

Even when you're trying to be clear, sometimes your instructions come out vague. That's fine — just tell the AI to ask clarifying questions if anything is unclear.

Make it a habit: before the AI goes off and builds something, confirm you're both on the same page. One quick clarification upfront can save you from a long detour later. Don't take the scenic route when you don't have to.

### Show the Shape, Let AI Fill the Details

If you have a clear direction in mind, sketch it out — a rough interface, some pseudo code, or even just the structure you're imagining. You don't need to specify every detail.

As an SDK developer, I often give the AI an interface definition along with how I expect it to be used and behave. Once the AI understands the outer shape, it fills in the implementation surprisingly well. Get the surface right, and the internals tend to follow.


## Create Your Own Shorthand

> **Consistency beats verbosity.**

You don't need to spell everything out. AI works on pattern recognition — once it learns your conventions, it'll follow them.

For example, if you're describing UI specs, instead of typing `margin-left: 10px` every time, just say `m-left=10`. Create a shorthand system that works for you. As long as you're consistent, the AI will pick up on the pattern and respond accordingly.

This saves context, saves your fingers, and keeps communication tight. Define your rules once, then use them everywhere.


## Delegate the Work That Doesn't Need You

> **Let go of tasks that feel important but aren't.**

You've been automating things like code formatting with tools for years. Now, with AI, you can go further — writing commit messages, drafting PR descriptions, generating boilerplate documentation.

Some of these might feel important. But honestly? They're not critical enough to demand your attention every time. Find these tasks, let go of the urge to do them yourself, and hand them off to AI. Set up workflows, let the agent handle it, and move on to work that actually needs you.


## Let AI Correct Itself

> **AI works best when it can try, verify, and try again.**

This ties back to giving tools. Before the AI starts any task, make sure there's a way to verify the results — tests, type checks, linters, whatever lets the AI confirm its work without waiting for you. Give it an environment where it can iterate on its own.

The same applies to debugging. Don't let the AI jump straight into fixing. Tell it to establish a reproduction environment first — a minimal test case, console logs to trace execution, or mock data that reliably triggers the issue. Only after the problem is reproducible should changes begin. And remember: a single successful test doesn't prove the fix works, especially for timing-related or intermittent issues. Make sure the AI verifies multiple times.

Even after the work is done, the loop shouldn't stop. Push the AI to evaluate whether the solution is a fundamental fix or just a workaround masking the symptom. If it's the latter, send it back. This cycle of implement, verify, and refine is what turns rough solutions into reliable ones.


## One Last Thing: Your Job as the Human

> **AI is a tool. You're the one responsible for what it builds.**

Don't keep pushing AI in the wrong direction just because you want to "adapt to new tech." AI is powerful, but its limits are clear. Stop wasting time and start creating real leverage. That said, things can change completely in a few months. Keep a pulse on what AI can actually do well, how far it can go, and evolve how you use it accordingly. And just because your workload feels lighter doesn't mean your productivity is up — stay honest with yourself about that.

Whatever you build with AI, make sure you can verify it. Build the environment, build the habits — whatever it takes. The AI writes the output, but it does so under your direction. That makes it your responsibility. Own it. And remember: your partner in the workflow might be an AI now, but the person sitting next to you is still human. Don't push your responsibility onto them. Don't make your teammates carry the burden of cleaning up after you.
