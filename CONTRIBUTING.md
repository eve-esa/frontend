# Contributing to EVE Frontend

Thank you for your interest in contributing to EVE (Earth Virtual Expert)! 

> **About EVE**: EVE is an AI-powered Digital Assistant for Earth Observation and Earth Science, developed by Pi School in collaboration with Imperative Space and funded by ESA Φ-lab. This document provides guidelines for contributing to the EVE Frontend application.

This document provides guidelines and instructions for contributing to the EVE Frontend React/TypeScript project.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- **Node.js >= 18**
- **Yarn** package manager
- Git

### Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/eve-fe-3.git
   cd eve-fe-3
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Start development server**
   ```bash
   yarn dev
   ```
   The app will be available at `http://localhost:5173`

4. **Run linting**
   ```bash
   yarn lint
   ```

5. **Build for production**
   ```bash
   yarn build
   ```

## Development Workflow

### Branch Naming Convention

| Purpose  | Pattern           | Example                   |
| -------- | ----------------- | ------------------------- |
| Feature  | `feature/<name>`  | `feature/chat-history`    |
| Bug Fix  | `fix/<name>`      | `fix/message-scroll`      |
| Refactor | `refactor/<name>` | `refactor/chat-component` |
| Hotfix   | `hotfix/<name>`   | `hotfix/security-patch`   |

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, missing semicolons, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

**Examples:**
```
feat(chat): add message history pagination
fix(auth): resolve login redirect issue
docs: update installation instructions
```

### Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** following our coding standards
3. **Add or update tests** if applicable
4. **Run linting and ensure tests pass**
5. **Update documentation** if needed
6. **Create a Pull Request** with:
   - Clear title following conventional commits
   - Detailed description of changes
   - Screenshots for UI changes
   - Reference any related issues

### Code Review Guidelines

- Keep PRs focused and reasonably sized
- Ensure CI checks pass
- Review with Conventional Comments, see [Code review](#code-review)

## Code review

Reviews follow [Conventional Comments](https://conventionalcomments.org/): every comment starts with a label, so the author sees at once what blocks the merge and what does not.

```
<label> [decorations]: <subject>

[discussion]
```

How a review reads:

- One short summary comment: what is good, then only the points that block the merge, one line each.
- Every other point inline, on the line it is about.
- Say why. When you are not sure, ask (`question`) instead of prescribing.
- When a point can wait, mark it `(non-blocking)`: the author picks this PR or the next one.

| Label | Use it for |
|---|---|
| `praise` | something done well; at least one per review, only when meant |
| `issue` | a concrete problem, paired with a fix |
| `suggestion` | an improvement: what and why |
| `question` | a possible concern you are not sure about |
| `todo` | a small change that is needed |
| `nitpick` | a matter of taste, always non-blocking |
| `thought` | an idea for later, non-blocking |
| `note` | something to be aware of, non-blocking |

Decorations: `(blocking)` must be resolved before merge, `(non-blocking)` must not hold the merge, `(if-minor)` only if the change turns out to be small.

```
issue (blocking): the cap is per file, so ten files can carry 6,000 chunks and the upload always hits the deadline. Could it be 600 per request?

suggestion (non-blocking): creating the collection after the slot reservation avoids an empty collection when the first upload is refused.

nitpick: a fixed message with a code here, like the other errors.
```

## Coding Standards

### TypeScript & React

- **TypeScript strict mode**: All code must be properly typed
- **Functional components**: Use React hooks instead of class components
- **Early returns**: Prefer early returns for better readability
- **Const assertions**: Use `const` for functions: `const MyComponent = () => {}`
- **Event handlers**: Prefix with `handle` (e.g., `handleClick`, `handleSubmit`)
- **File naming**:
  - **PascalCase** for React components (`MyComponent.tsx`)
  - **camelCase** for hooks and utilities (`useMyHook.ts`)
  - **kebab-case** for assets (`hero-image.png`)

### Styling

- **Tailwind CSS only**: No custom CSS files or inline styles
- **Variants**: Use `class-variance-authority` for component variants
- **Accessibility**: Implement proper ARIA attributes using Radix UI primitives

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, Input, etc.)
│   └── feature/        # Feature-specific components
├── hooks/              # Custom React hooks
├── pages/              # Route-level components
├── services/           # API calls and external services
├── utilities/          # Helper functions and constants
└── types.ts           # Global type definitions
```

### State Management

- **Local state**: React `useState`/`useReducer`
- **Server state**: TanStack Query (React Query)
- **Form state**: React Hook Form with Zod validation

## Testing Guidelines

### Writing Tests

- **Unit tests**: Test individual components and functions
- **Integration tests**: Test component interactions
- **E2E tests**: Test critical user flows
- **Accessibility tests**: Ensure components are accessible

### Test Structure

```typescript
describe('ComponentName', () => {
  it('should render correctly', () => {
    // Test implementation
  });

  it('should handle user interactions', () => {
    // Test implementation
  });
});
```

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage
```

## Documentation

### Code Documentation

- **JSDoc comments** for complex functions
- **README updates** for new features
- **Inline comments** for business logic

### API Documentation

- Document new API endpoints
- Update type definitions
- Provide usage examples

## Accessibility

### Requirements

- **Keyboard navigation**: All interactive elements must be keyboard accessible
- **Screen readers**: Proper ARIA labels and semantic HTML
- **Color contrast**: Meet WCAG 2.1 AA standards
- **Focus management**: Visible focus indicators

### Testing

- Test with keyboard navigation
- Use screen reader tools
- Run accessibility audits

## Performance

### Guidelines

- **Bundle size**: Monitor and optimize bundle size
- **Lazy loading**: Implement code splitting for routes
- **Image optimization**: Use appropriate formats and sizes
- **Memoization**: Use React.memo and useMemo appropriately

## Security

### Best Practices

- **Input validation**: Validate all user inputs
- **XSS prevention**: Sanitize user-generated content
- **Dependencies**: Keep dependencies updated
- **Environment variables**: Never commit secrets

## Release Process

1. **Create release branch** from `main`
2. **Update version** in `package.json`
3. **Update CHANGELOG.md**
4. **Create pull request** for release
5. **Merge and tag** the release
6. **Deploy** to production

## Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Pull Request Reviews**: Code-specific discussions
- **EVE Project**: [https://eve.philab.esa.int](https://eve.philab.esa.int)
- **ESA Φ-lab**: [https://philab.esa.int](https://philab.esa.int)

### Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/docs)

## Recognition

Contributors will be recognized in our README and release notes. We appreciate all forms of contribution!

---

**Questions?** Feel free to open an issue or reach out to the maintainers.
