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

## Choose toolkits

Toolkits are the tools EVE can call while it answers.

1. In the sidebar, open **Toolkits** and choose **Shared toolkits**.
2. Switch each toolkit on or off.

The EVE knowledge base search is the toolkit available today, and it is on by default. With it
off, answers have no sources.

## Work with an answer

- **Sources (n)**: the documents the answer used, with the cited passages.
- **Trace (n)**: the steps EVE took: what it planned, each tool call with its input and
  output, and the final answer. Recent answers show how long each step took. Older answers may
  show "Not recorded for this answer" instead of the tool inputs.
- **Hallucination Detector**: checks the answer against its sources and, when it finds a
  problem, suggests an alternative answer.
- **Report a bug**: describe what went wrong. EVE attaches the technical details of the
  conversation so the team can find the answer. You can send up to 5 reports per hour.
- Thumbs up or down to rate the answer, and the copy icon to copy its text.

If an answer fails, EVE says so and offers **Retry**.

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
