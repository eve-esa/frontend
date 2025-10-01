# Changelog

All notable changes to the EVE Frontend project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **About EVE**: EVE (Earth Virtual Expert) is an AI-powered Digital Assistant for Earth Observation and Earth Science, developed by Pi School in collaboration with Imperative Space and funded by ESA Φ-lab.

## [Unreleased]

### Added
- Nothing yet

### Changed
- Nothing yet

### Deprecated
- Nothing yet

### Removed
- Nothing yet

### Fixed
- Nothing yet

### Security
- Nothing yet

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

- [Unreleased]: https://github.com/pischool/eve-fe-3/compare/v1.0.0...HEAD
- [1.0.0]: https://github.com/pischool/eve-fe-3/releases/tag/v1.0.0
