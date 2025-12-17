# EVE Frontend Application

This repository contains the **frontend application** for the EVE project - a modern, accessible web interface that enables users to interact with the EVE Large Language Model through an intuitive chat interface.

## Frontend Features

### User Interface Capabilities
- 💬 **Interactive Chat Interface** - Seamless conversation with EVE's AI assistant
- 📝 **Message History** - Persistent conversation tracking and management
- 🔤 **Markdown + KaTeX Rendering** - Rich text and mathematical formula support
- 📚 **Source Citations** - Transparent referencing of information sources
- 🔐 **Authentication System** - Secure user login, registration, and password management
- 🌗 **Responsive Design** - Optimized experience across mobile and desktop devices

### Technical Stack
- ⚛️ React 19 with functional components and hooks
- 📘 TypeScript for static type-safety
- ⚡️ Vite for fast development and production builds
- 🎨 Tailwind CSS with class-variance-authority for theming and variants
- 🧩 Radix UI and Shadcn UI primitives for fully-accessible components
- 🔥 TanStack Query (React Query v5) for data-fetching and caching
- 🧪 ESLint & TypeScript strict settings for high code quality

## Prerequisites

- **Node.js >= 18**
- **Yarn**

## Getting Started

```bash
# clone the repo

# install dependencies
yarn install

# start dev server (http://localhost:5173)
yarn dev
```

## Scripts

| Script         | Description                       |
| -------------- | --------------------------------- |
| `yarn dev`     | Start Vite dev server with HMR    |
| `yarn build`   | Build production bundle (`dist/`) |
| `yarn preview` | Preview the production build      |
| `yarn lint`    | Run ESLint across the codebase    |

## Project Structure

```
eve-fe/
├─ public/               # Static assets served as-is
├─ src/
│  ├─ assets/            # Fonts & images
│  ├─ components/        # UI + domain components
│  ├─ hooks/             # Custom React hooks
│  ├─ layouts/           # Page-level layouts
│  ├─ pages/             # Route components
│  ├─ services/          # API/data-fetching logic
│  ├─ utilities/         # Helper functions & constants
│  ├─ router.tsx         # React-Router v7 config
│  └─ main.tsx           # Application entry point
├─ .cursorrules          # Coding conventions for Cursor AI
├─ tailwind.config.js    # Tailwind CSS config
├─ vite.config.ts        # Vite config
└─ LICENSE               # License
```

## Environment Variables

Create a `.env` file in the project root (based on `.env.example`):

```bash
# .env
VITE_API_URL=https://api.example.com
VITE_CONTACT_URL=https://example.com
```

> **Note** : Do **NOT** commit secrets—`.env*` is included in `.gitignore`.

## Coding Standards

- Tailwind for all styling
- Early returns for control-flow clarity
- `handle*` prefix for event handlers
- `const` arrow functions over `function` declarations
- Full accessibility (ARIA, keyboard nav) using Radix UI

Run `yarn lint` before committing to ensure ESLint passes.

## Contributing

1. Create your feature branch (`git checkout -b feature/awesome-feature`)
2. Commit your changes (`git commit -m "feat: add awesome feature"`)
3. Push to the branch (`git push origin feat/awesome-feature`)
4. Open a Pull Request

## Links

- **Official Website**: [https://eve.philab.esa.int](https://eve.philab.esa.int)
- **ESA Φ-lab**: [European Space Agency's innovation lab](https://philab.esa.int)
- **Pi School**: [AI education and research institute](https://www.pi-school.eu)

## Versioning

This project follows [Semantic Versioning](https://semver.org/). For the versions available, see the [tags on this repository](https://github.com/pischool/eve-fe/tags) and the [CHANGELOG.md](./CHANGELOG.md).


## Git Workflow

> Adhere to the following conventions to keep the history clean and meaningful.

### Branch Naming

| Purpose  | Pattern           | Example                   |
| -------- | ----------------- | ------------------------- |
| Feature  | `feature/<name>`  | `feature/chat-history`    |
| Bug Fix  | `fix/<name>`      | `fix/message-scroll`      |
| Refactor | `refactor/<name>` | `refactor/chat-component` |

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

| Prefix      | When to use                                          | Example                                  |
| ----------- | ---------------------------------------------------- | ---------------------------------------- |
| `feat:`     | Introducing a new feature                            | `feat: add chat history pagination`      |
| `fix:`      | Bug fixes                                            | `fix: correct scroll-to-bottom behavior` |
| `refactor:` | Code refactoring without changing external behaviour | `refactor: extract sidebar component`    |

Keep the subject line ≤ 72 characters; add a body if more detail is required.

---

## Adding a New Feature

Follow this checklist to scaffold a new feature while keeping the codebase tidy and consistent:

1. **Create a branch**  
   `git checkout -b feature/<my-new-feature>`

2. **Directory placement**

   | Concern           | Location                       | Notes                                                  |
   | ----------------- | ------------------------------ | ------------------------------------------------------ |
   | Page/Route        | `src/pages/<my-feature>/`      | Export a single React component (`<FeaturePage>.tsx`). |
   | Layout (optional) | `src/layouts/<my-feature>/`    | For complex multi-page flows.                          |
   | UI Components     | `src/components/<my-feature>/` | Re-export via an `index.ts`.                           |
   | Hooks             | `src/hooks/`                   | File name: `use<MyFeature>.ts[x]`.                     |
   | Services/API      | `src/services/`                | File name: `use<MyFeatureAction>.ts[x]`.               |
   | Utilities         | `src/utilities/`               | Keep generic helpers reusable across features.         |

3. **File naming**

   - **PascalCase** for React components (`MyFeatureCard.tsx`).
   - **camelCase** for hooks & helpers (`useMyFeature.ts`).
   - **kebab-case** for asset files (`hero-image.png`).

4. **Styling & UI**

   - Use **Tailwind CSS** utility classes only—no custom CSS files.
   - For variants, extend the existing `button-variants.ts` or create a local `*-variants.ts` using `class-variance-authority`.
   - Prefer **Radix UI / Shadcn UI** primitives for accessibility.

5. **State & Data**

   - Local state: React `useState` / `useReducer`.
   - Server state: **TanStack Query** via a custom `use<MyFeatureQuery>` or `use<MyFeatureMutation>` hook.

6. **Commit & PR**
   - Follow the commit conventions (`feat:` prefix).
   - Push and open a PR targeting `main`.

---


## Deployment

- Branches: `staging` (pre-production), `main` (production).
- Staging: open a PR to `staging` and merge. This deploys to the staging environment.
- Production: after verifying on staging, open a PR from `staging` to `main` and merge. This deploys to production.

## Funding

This project is supported by the European Space Agency (ESA) Φ-lab through the Large Language Model for Earth Observation and Earth Science project, as part of the Foresight Element within FutureEO Block 4 programme.

## Citation 

If you use this project in academic or research settings, please cite:

## License

This project is released under the Apache 2.0 License - see the [LICENSE](LICENSE) file for more details.