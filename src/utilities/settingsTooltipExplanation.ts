export const settingsTooltipExplanation = {
  temperature: {
    title: "Temperature",
    explanation:
      "Controls how creative or deterministic the model's responses are. Lower values (e.g., 0.2) make the output more focused and predictable, while higher values (e.g., 0.8) encourage more diverse and exploratory answers.",
  },
  score_threshold: {
    title: "Similarity Threshold",
    explanation:
      "Sets the minimum similarity score a document must have to be considered relevant. Higher thresholds return fewer, but more closely matched documents; lower thresholds return a broader set of results.",
  },
  year: {
    title: "Document Year",
    explanation:
      "Filter results by publication date. Specify a start and end year to narrow the search to documents from a specific time range.",
  },
  journal: {
    title: "Journal",
    explanation:
      "Restrict results to a particular journal or publication. Useful for focusing on trusted or domain-specific sources.",
  },
  thematic_perspective: {
    title: "Thematic perspective",
    explanation: "Filter documents by semantic perspective.",
  },
  scientific_and_technical: {
    title: "Scientific and Technical",
    explanation: "Filter documents by scientific and technical.",
  },
  market_perspective: {
    title: "Market Perspective",
    explanation: "Filter documents by market perspective.",
  },
  n_citations: {
    title: "Minimum Citations",
    explanation:
      "Set the minimum number of citations a document must have to be included. Useful for prioritizing widely-referenced or influential works.",
  },
  k: {
    title: "Max Documents",
    explanation:
      "Choose the maximum number of documents to retrieve in a single query. Increasing this may provide broader coverage but can include less relevant results.",
  },
};
