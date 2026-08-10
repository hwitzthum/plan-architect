# CRITICAL RULES - MUST FOLLOW

## RESPONSES

- Keep responses concise and to the point - unless the user asks otherwise

## PLANNING MODE

- Always ask clarifying questions
- Never assume design, tech stack or features
- Use deep-dive sub-agents to assist with research
- Use deep-dive sub-agents to review the different aspects of your plan before presenting to the user

## CHANGE / EDIT MODE

- Never implement features yourself when possible - use sub-agents!
- Identify changes from the plan that can be implemented in parallel, and use sub-agents to implement the features efficiently
- When using sub-agents to implement features, act as a coordinator only
- Use the best model for the task - premium models for complex tasks (like coding) and mid-tier models for simpler tasks, like documentation
- After completing features (large or small), always run commands like lint, type check and next build to check code quality

## PERSISTENCE

- This project has no SQL database and no ORM. There is no Drizzle, no schema to generate, and no migrations to run — do not look for them.
- Durable server state is Upstash Redis (`lib/redis.ts`): share payloads in `lib/persistence/share-store.ts`, rate-limit counters in `lib/rate-limit.ts`.
- Browser-local state is `localStorage` in `lib/persistence/brief-storage.ts`.
- A stored shape is defined by its Zod schema, so changing one means changing that schema and considering payloads already written under the old shape. Redis entries carry a TTL and expire on their own; `localStorage` entries do not.

## TESTING

- Use any testing tools, libraries available to the project for testing your changes
- Never assume your changes simply work, always test!
- If the project does not have any testing tools, scripts, MCP tools, skills, etc. available for testing, ask the user whether testing should be skipped.

## UI DESIGN

- Always follow the UI design system when creating or reviewing components or pages.
- Design System: @DESIGN.md