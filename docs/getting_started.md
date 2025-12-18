# Getting Started

Follow these steps to run the EVE frontend locally.

## Prerequisites
- Node.js 18+ (use the version from the README).
- Yarn.

## Install & Run
1. Clone the repository.
2. Install dependencies:

   ```bash
   yarn install
   ```

3. Create a `.env` in the project root based on `.env.example`:

   ```bash
   VITE_API_URL=https://api.example.com
   VITE_CONTACT_URL=https://example.com
   ```
   
   Never commit secrets; `.env*` is gitignored.

4. Start the dev server (http://localhost:5173):

   ```bash
   yarn dev
   ```

## Useful scripts
- Build: `yarn build`
- Preview production build: `yarn preview`
- Lint: `yarn lint`