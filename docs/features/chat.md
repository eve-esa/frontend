# Chat

EVE is a multi-turn assistant for Earth Observation. Answers stream in as they are written,
render Markdown and formulas, and cite the documents they use.

## Layout

- **Conversations sidebar (left)**: start a new chat, browse your history, rename or delete a
  conversation. The Knowledge Base, Toolkits and API keys menus are here too. On a phone, tap
  the menu icon to show it.
- **Chat area (center)**: the messages and the message box.
- **Panel (right)**: Sources, Trace, Control Panel, collections and toolkits open here. On a
  computer, drag its left edge to resize it, or double-click the edge to reset it.

## Ask a question

1. Click **NEW CHAT**.
2. Type your question and press Enter, or click the send icon.
3. Ask follow-up questions in the same conversation: EVE keeps the context.

While EVE works, the answer shows which tool it is using, for example a search in the EVE
knowledge base. To end an answer early, click the stop icon. The text written so far is kept
and marked **Generation stopped**.

## Choose a model

Pick a model from the list beside the message box. EVE's own model is selected by default.
Your choice applies to the next messages you send.

On a phone, with the composer layout on (`FEATURE_MOBILE_COMPOSER`, default off), the model list
leaves the message box: tap the **Model** field at the top of the screen and choose a model from the
sheet that opens (Esc or a tap outside closes it). The message box sits at the bottom of the empty
chat too, in the same place as in a conversation, with three suggestions above it: tap one to put
it in the box. On a computer the model list stays beside the message box.

## Choose toolkits

Toolkits are the tools EVE can call while it answers.

1. In the sidebar, open **Toolkits** and choose **Shared toolkits**.
2. Switch each toolkit on or off.

The EVE knowledge base search is the toolkit available today, and it is on by default. With it
off, answers have no sources.

With `FEATURE_TOOLKIT_CREDENTIALS` on (default off, and the backend flag of the same purpose on),
a toolkit that accepts your own credentials can be given them. The backend checks them before
saving, stores them encrypted and uses them on your tool calls only. Values are never shown again,
only the last characters of each.

## Work with an answer

- **Sources (n)**: the documents the answer used, with the cited passages.
- **Inline citations** (flag `FEATURE_INLINE_CITATIONS`, default off): in an agentic answer a
  small number follows each claim taken from a source. Click it (or press Enter on it) to open the
  source card: the provider, the title, the passage, the page or section, **Open** and **Copy
  citation**; Escape or a second click closes it. A file of yours shows its file icon and a lock,
  a satellite scene its collection, acquisition time, cloud cover and item id. Under the answer
  one line such as "Sources: 5 cited from 3 providers and your files" opens the list grouped by
  provider, with "Also retrieved, not cited" folded at the end. These answers show the list in
  place of the **Sources (n)** button; answers without citations keep the button.
- **Agent steps** (flag `FEATURE_AGENT_STEPS`, default off): above an agentic answer, the steps
  EVE took. The block is open while EVE works, its header shows "Thinking…" or the running step
  with a timer ("Searching the knowledge base… 0:42"), then folds into one line such as "Worked
  for 1m 32s, 5 steps, 2 tools" when the answer starts; it stays open when a step failed or you
  pressed Stop, with only the failed step open. Each row names the tool (the knowledge base with
  its book icon, MCP server tools with the server and its tier), a skill ("Used skill <name>"), a
  subagent with its own steps, or the plan with its progress. Open a row for the result, then
  **Details** for the full arguments and result with copy buttons; a result stored as a file has
  **Open full result**. With the flag on, the streamed status notices and tool chips of an
  agentic turn give way to the block.
- **Trace (n)**: the same steps in the right panel, with the timeline and every model step. With
  `FEATURE_AGENT_STEPS` on it shows only with `FEATURE_TRACE_SIDEBAR` (default off), as a
  debugging view. Older answers may show "Not recorded for this answer" instead of the tool
  inputs.
- **Hallucination Detector**: checks the answer against its sources and, when it finds a
  problem, suggests an alternative answer.
- **Report a bug**: describe what went wrong. EVE attaches the technical details of the
  conversation so the team can find the answer. You can send up to 5 reports per hour.
- Thumbs up or down to rate the answer, and the copy icon to copy its text.

If an answer fails, EVE says so and offers **Retry**.

## About EVE's answers

With `FEATURE_MOBILE_COMPOSER` on, the message box shows no notice on the empty chat. After the
first answer, one line under it reads "EVE is AI and can make mistakes." with a **Learn more**
button that opens the full statement. Off, the full statement stays under the message box.

## Diagrams and formulas

With `FEATURE_STREAMDOWN` on, answers are rendered by Streamdown: a fenced `mermaid` block becomes a diagram, formulas render with KaTeX, and unfinished markdown (an open bold span, a code fence still streaming) is shown closed while the answer arrives. A formula still streaming without its closing delimiter shows a placeholder bar until it closes, and an answer shows a skeleton, never its markdown source, while the renderer loads. Diagrams follow the app theme (dark, light, System) and redraw when it changes. Node labels a model left unquoted with brackets, braces, quotes, pipes or semicolons are quoted before drawing; a diagram that still cannot be drawn shows its source as code with the note "Diagram could not be drawn", never the parse error, and a diagram still streaming shows the placeholder. A link inside a diagram opens in a new tab. Invalid LaTeX shows in the danger colour of the theme. Images from other hosts wait for a click, as in the default renderer. Off, answers render as before.

## When EVE is busy

If EVE has too many requests at once, the message box shows "EVE is busy right now" with a
countdown, and sends your message again when it ends. If you send messages too fast, it shows
"You are sending requests too fast" and does the same. If the second attempt is also refused,
try again in a moment: your text stays in the message box.

## Token usage

Each account has a token budget per period. The ring beside the message box shows how much
you have used; point to it to see the numbers. When the budget runs out, EVE stops answering
until the next period starts.

## Knowledge base

- Open **Control Panel** from the sliders icon beside the message box to tune retrieval and
  generation. See [Control Panel](control_panel.md).
- Open **Shared collections** or **My collections** from the Knowledge Base menu to choose
  which documents inform answers. See [Shared collections](shared_collection.md) and
  [My collections](private_collection.md).
