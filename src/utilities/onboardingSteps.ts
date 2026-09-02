import { PRIVATE_COLLECTIONS_ENABLED } from "./features";

type TourStep = {
  target: string;
  content: string;
  placement: "top" | "right" | "left";
  disableBeacon: boolean;
};

const BASE_STEPS: TourStep[] = [
  {
    target: ".conversations-sidebar-tour",
    content:
      "This is your conversations sidebar. Here you can view your conversation history, start new chats, and access the main menu.",
    placement: "right" as const,
    disableBeacon: true,
  },
  {
    target: ".new-chat-button-tour",
    content: "Click the NEW CHAT button to create a new conversation.",
    placement: "right" as const,
    disableBeacon: true,
  },
  {
    target: ".settings-button-tour",
    content: "Click the settings button to access the Control Panel.",
    placement: "top" as const,
    disableBeacon: true,
  },
  {
    target: ".control-panel-tour",
    content:
      "This is the Control Panel. Here you can configure parameters and document filters to optimize search results and response quality.",
    placement: "left" as const,
    disableBeacon: true,
  },
  {
    target: ".start-new-chat-tour",
    content:
      "Start new chat. Write any question you have or select suggestions!",
    placement: "top" as const,
    disableBeacon: true,
  },
];

// The five steps that walk through personal collections. Dropped, not skipped:
// the tour numbers its steps from the array it is given, so leaving holes in it
// would break every index derived from the length.
const PRIVATE_COLLECTION_STEPS: TourStep[] = [
  {
    target: ".my-collections-button-tour",
    content:
      "Click the My Collections menu item to open the My Collections sidebar.",
    placement: "right" as const,
    disableBeacon: true,
  },
  {
    target: ".my-collections-sidebar-tour",
    content:
      "This is the My Collections sidebar. Here you can view all your collections and create new ones or delete existing ones.",
    placement: "left" as const,
    disableBeacon: true,
  },
  {
    target: ".new-my-collections-button-tour",
    content:
      "Click the New Collection button to create a new document collection.",
    placement: "left" as const,
    disableBeacon: true,
  },
  {
    target: ".new-my-collections-list-tour",
    content:
      "The My Collections sidebar displays all your collections. Click on any collection to view the documents it contains.",
    placement: "left" as const,
    disableBeacon: true,
  },
  {
    target: ".my-collections-documents-tour",
    content:
      "Within your collection, you can view all contained documents. You can also upload new documents or remove existing ones.",
    placement: "left" as const,
    disableBeacon: true,
  },
];

/**
 * The tour, built rather than declared, because its length is what the rest of
 * the onboarding counts from: the last step is `totalSteps - 1`, not step 9.
 */
export const buildTourSteps = (): TourStep[] =>
  PRIVATE_COLLECTIONS_ENABLED
    ? [...BASE_STEPS.slice(0, 4), ...PRIVATE_COLLECTION_STEPS, ...BASE_STEPS.slice(4)]
    : BASE_STEPS;
