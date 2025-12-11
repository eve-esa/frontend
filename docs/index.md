# EVE Frontend

Welcome to the EVE frontend documentation. This React + TypeScript app lets you chat with the EVE Large Language Model about Earth Observation (EO) data with rich controls for retrieval, generation, and collection management.

## Key Features

### Chat and Conversations

Work with EVE using a chat-first interface:

- Markdown-rendered responses with citation links back to sources.
- Conversation management including create, rename, delete, and retry on errors.
- Contextual retries and follow-up questions within the same thread.

### Retrieval and Generation Controls

- Adjust retrieval depth, temperature, and related generation parameters.
- Configure context windows to balance precision and recall.
- Apply presets or per-chat overrides through the Control Panel.

### Collections and Enrichment

- Browse shared EO collections provided by your organization.
- Upload and manage private collections for personalized RAG enrichment.
- Combine shared and private sources to tailor responses.

### Account and Security

- Authentication flows for login, logout, and password resets.
- Profile management for names, email, and other account details.
- Session-aware UI to keep conversations scoped to the right user.