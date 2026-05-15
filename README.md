# Plan Architect

A lightweight AI Project Planner tutorial app. Enter a rough app idea and generate an editable project brief with app summary, target users, features, tech stack, routes, data model, build phases, risks, and a copyable starter prompt for a coding agent.

## Features

- All-at-once AI brief generation through the AI SDK and OpenRouter.
- Editable project summary, users, features, tech stack, routes, build phases, and risks.
- Editable data-model entities, fields, and relationships.
- React Flow visualization of entity relationships.
- Copyable and editable coding-agent starter prompt.
- Dark-first shadcn/ui planning desk interface.
- Small tutorial scope: no auth, no database, no payments.

## Stack

- Next.js App Router
- React
- Tailwind CSS v4
- shadcn/ui
- AI SDK
- OpenRouter provider
- React Flow via `@xyflow/react`
- Zod for structured AI output validation

## Environment

Create `.env.local`:

```bash
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=anthropic/claude-sonnet-4.6
```

`OPENROUTER_MODEL` is optional. The app defaults to `anthropic/claude-sonnet-4.6`.

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Usage

1. Enter a rough app idea in the prompt panel.
2. Click `Generate brief`.
3. Edit the generated brief sections.
4. Edit data-model entities, fields, and relationships.
5. Review the React Flow entity map.
6. Copy the final starter prompt into a coding agent.

## API

`POST /api/plan`

Request:

```json
{
  "idea": "A rough app idea"
}
```

Response:

```json
{
  "brief": {
    "appSummary": "...",
    "targetUsers": [],
    "coreFeatures": [],
    "recommendedTechStack": [],
    "pagesRoutes": [],
    "dataModel": {
      "entities": [],
      "relationships": []
    },
    "buildPhases": [],
    "risksEdgeCases": [],
    "starterPrompt": "..."
  },
  "model": "anthropic/claude-sonnet-4.6"
}
```

The API validates input, applies a simple in-memory rate limit, calls OpenRouter, and returns schema-validated structured output.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
