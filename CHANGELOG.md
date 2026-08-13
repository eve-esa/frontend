# Changelog

All notable changes to the EVE Frontend project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **About EVE**: EVE (Earth Virtual Expert) is an AI-powered Digital Assistant for Earth Observation and Earth Science, developed by Pi School in collaboration with Imperative Space and funded by ESA Φ-lab.

From v0.0.7 onward this file is written by [release-please](https://github.com/googleapis/release-please)
from the pull request titles merged into `main`, so entries are not added by hand. Work that has landed
but is not yet released is visible in the open `chore(main): release ...` pull request, which is also
what cuts the release: merging it commits the version, creates the `vX.Y.Z` tag, publishes the GitHub
Release and promotes staging. Production is promoted from there by an explicit dispatch.

The `[1.0.0]` entry below is historical and predates this repository's current version series. The
released tags run `v0.0.1` through `v0.0.6`; no `v1.0.0` was ever tagged here.

## [0.0.9](https://github.com/eve-esa/frontend/compare/v0.0.8...v0.0.9) (2026-08-13)


### Fixed

* hallucination copy and streaming flicker ([#66](https://github.com/eve-esa/frontend/issues/66)) ([966fa3b](https://github.com/eve-esa/frontend/commit/966fa3b06248a5a2b245411d526eaba7d83711c1))
* repair the custom models add/edit form ([#64](https://github.com/eve-esa/frontend/issues/64)) ([3cbf4fa](https://github.com/eve-esa/frontend/commit/3cbf4faa6b6056cdfa549519d3d2b69ed357ad81))

## [0.0.8](https://github.com/eve-esa/frontend/compare/v0.0.7...v0.0.8) (2026-08-12)


### Added

* default chat model is the first platform model ([#50](https://github.com/eve-esa/frontend/issues/50)) ([3ddf456](https://github.com/eve-esa/frontend/commit/3ddf4563f27f2cd751ee757dd9bed1de4b193a7c))
* tool activity bar during agentic turns ([#56](https://github.com/eve-esa/frontend/issues/56)) ([d1ba05c](https://github.com/eve-esa/frontend/commit/d1ba05c0f263dfc6115164ee431f18577e07425a))


### Fixed

* **deps:** clear the dependency vulnerabilities and automate updates ([#62](https://github.com/eve-esa/frontend/issues/62)) ([7c27fb3](https://github.com/eve-esa/frontend/commit/7c27fb342d4b77e29146f349dc8a03fb79a3532a))
* failed generations stay retryable and never lock the chat ([#53](https://github.com/eve-esa/frontend/issues/53)) ([2426311](https://github.com/eve-esa/frontend/commit/2426311108b27902da30678963fe7fd633cee347))
* give the lightbox a minimum canvas for tiny images ([#55](https://github.com/eve-esa/frontend/issues/55)) ([f191a38](https://github.com/eve-esa/frontend/commit/f191a38fa4b8fd72e95446490c7b506311b7b854))
* ignore the empty value the model select emits on remount ([#51](https://github.com/eve-esa/frontend/issues/51)) ([5f3946b](https://github.com/eve-esa/frontend/commit/5f3946bb88113e6801c3478f5c5c3ac0e2a82e6c))
* let the user scroll up while the answer streams ([#57](https://github.com/eve-esa/frontend/issues/57)) ([9deeaca](https://github.com/eve-esa/frontend/commit/9deeacae59a54b5b975faa4c60820d4910496064))
* no error toast over a visible partial answer ([#58](https://github.com/eve-esa/frontend/issues/58)) ([8d4dde9](https://github.com/eve-esa/frontend/commit/8d4dde931b76974dc08d57c0eeafdc2b2a51a913))
* reconcile the chat after a stop ([#54](https://github.com/eve-esa/frontend/issues/54)) ([2b602e8](https://github.com/eve-esa/frontend/commit/2b602e846dd85f8431d23b028afe1ca1b7217f63))

## [0.0.7](https://github.com/eve-esa/frontend/compare/v0.0.6...v0.0.7) (2026-08-09)

### Added

* Flags are named for the features they control, and configuration is applied at the release stage instead of being baked into the build ([#40](https://github.com/eve-esa/frontend/pull/40))

### Removed

* The delete control on artifacts. An uploaded file is permanent ([#41](https://github.com/eve-esa/frontend/pull/41))

## [1.0.0] - 2025-09-18

### Added - Initial EVE Frontend Release
- 🌍 **EVE Chat Interface** - Interactive chat system for Earth Observation Virtual Expert
- 🤖 **AI-Powered Conversations** - Real-time communication with EVE's specialized Earth Science LLM
- 📚 **EO Knowledge Access** - User interface for accessing Earth Observation concepts and data guidance

#### Technical Implementation
- ⚛️ React 19 with functional components and hooks
- 📘 TypeScript for static type-safety with strict settings
- ⚡️ Vite for fast development and production builds
- 🎨 Tailwind CSS with class-variance-authority for theming and variants
- 🧩 Radix UI and Shadcn UI primitives for fully-accessible components
- 🔥 TanStack Query (React Query v5) for data-fetching and caching
- ✉️ Authentication & authorization flows (login, reset password)
- 💬 Chat interface with message history, markdown + KaTeX rendering, and source citations
- 🌗 Responsive design supporting mobile to desktop viewports
- 🧪 ESLint configuration with TypeScript strict settings for high code quality
- 📁 Well-organized project structure with clear separation of concerns:
  - `/components` - Reusable UI and domain components
  - `/hooks` - Custom React hooks
  - `/layouts` - Page-level layouts (auth, chat, public)
  - `/pages` - Route components
  - `/services` - API and data-fetching logic with React Query
  - `/utilities` - Helper functions and constants
- 🔐 Comprehensive authentication system with protected routes
- 📱 Mobile-first responsive design
- ♿ Accessibility features using Radix UI primitives
- 🎭 Dark/light theme support foundation
- 📊 Document management and collection features
- 🔍 Real-time search and filtering capabilities
- 📤 File upload functionality with drag-and-drop support
- 🔄 Conversation management with rename and delete operations
- 📋 Feedback system for user interactions
- ⚙️ Settings management with form validation using React Hook Form and Zod
- 🎯 Profile management system
- 📝 Rich text rendering with markdown and mathematical expressions
- 🔗 Source citations and reference tracking
- 💾 Local storage utilities for user preferences
- 📅 Date/time utilities with dayjs integration
- 🎨 Consistent styling with Tailwind CSS utilities
- 📦 Component library with reusable UI primitives:
  - Button with variants
  - Input components
  - Dialog modals
  - Select dropdowns
  - Date pickers
  - Tooltips
  - Skeletons for loading states
- 🚀 Performance optimizations with lazy loading and code splitting
- 🛡️ Type-safe API integration with TypeScript
- 📋 Form handling with validation and error management
- 🔔 Toast notifications with Sonner
- 📊 Infinite loading capabilities for large datasets
- 🖱️ Custom hooks for clipboard, mobile detection, scroll management
- 🛤️ React Router v7 integration with protected routes
- 🎛️ Environment variable management
- 📱 Mobile-responsive navigation and interactions

### Technical Implementation
- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite with optimized configuration
- **Styling**: Tailwind CSS v4 with custom configuration
- **UI Library**: Radix UI primitives with Shadcn UI components
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: React Router v7 with type-safe routing
- **Form Handling**: React Hook Form with Zod validation
- **Authentication**: Custom auth system with protected routes
- **API Integration**: Axios with React Query for data fetching
- **Code Quality**: ESLint with TypeScript-specific rules
- **Development**: Hot Module Replacement (HMR) with Vite
- **Bundle Optimization**: Code splitting and lazy loading

### Project Structure
```
eve-fe-3/
├── src/
│   ├── components/          # Reusable components
│   │   ├── auth/           # Authentication components
│   │   ├── chat/           # Chat-related components
│   │   ├── profile/        # Profile management
│   │   └── ui/             # Base UI components
│   ├── hooks/              # Custom React hooks
│   ├── layouts/            # Page layouts
│   ├── pages/              # Route components
│   ├── services/           # API and data services
│   ├── utilities/          # Helper functions
│   └── types.ts            # TypeScript definitions
├── public/                 # Static assets
├── LICENSE                 # MIT License
├── README.md              # Project documentation
└── package.json           # Dependencies and scripts
```

### Dependencies
- React 19.1.0 with React DOM
- TypeScript ~5.8.3 for type safety
- Vite 6.3.5 for build tooling
- Tailwind CSS 4.0.0 for styling
- TanStack Query 5.80.7 for data fetching
- React Router DOM 7.6.2 for routing
- React Hook Form 7.58.0 for form handling
- Zod 3.25.67 for schema validation
- Axios 1.10.0 for HTTP requests
- Various Radix UI components for accessibility
- ESLint 9.25.0 with TypeScript support

---

## Version History

### Semantic Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backwards compatible manner  
- **PATCH** version when you make backwards compatible bug fixes

### Release Types

- **Major Release** (x.0.0): Breaking changes, major new features
- **Minor Release** (x.y.0): New features, backwards compatible
- **Patch Release** (x.y.z): Bug fixes, security updates

### Links

- [1.0.0]: https://github.com/eve-esa/frontend/releases/tag/v1.0.0
