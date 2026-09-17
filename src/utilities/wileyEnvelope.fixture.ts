import type { Document } from "@/types";

/**
 * Shape eve_retrieval actually persists for Wiley: empty payload, and `text`
 * holding the Scholar Gateway envelope instead of a passage.
 */
export const wileyEnvelopeDoc = (): Document =>
  ({
    id: null,
    version: null,
    score: null,
    reranking_score: 0.9451643824577332,
    collection_name: "Wiley AI Gateway",
    payload: {},
    text: {
      success: true,
      query: "Sentinel-2 Earth Observation mission overview",
      count: 2,
      results: [
        {
          chunk_index: 16,
          text: "Gully erosion varies seasonally at catchment scale. Modelling at the catchment scale shows that rainfall intensity and vegetation cover jointly control sediment yield through the year, with the strongest losses at the onset of the wet season.",
          metadata: {
            journal_code: "10969837",
            article_type: "article",
            pub_type: "article",
            journal_issn: "1096-9837",
            additionalMetadata: {
              volume: "",
              pageRange: "436-458",
              citationLine:
                "Agostini, M., Mondini, A. C., Torri, D., & Rossi, M. (2021). Modelling seasonal variation of gully erosion at the catchment scale.",
              title:
                "Modelling seasonal variation of gully erosion at the catchment scale",
              journalTitle: "Earth Surface Processes and Landforms",
              link: "https://doi.org/10.1002/esp.5041",
            },
          },
        },
        {
          chunk_index: 3,
          content:
            "Sentinel-2 provides optical imagery for land monitoring. The twin-satellite constellation revisits the same point every five days, with 13 spectral bands spanning visible, near-infrared and short-wave infrared.",
          metadata: {
            additionalMetadata: {
              title: "Sentinel-2 mission overview",
              citationLine: "Drusch et al. (2012). Sentinel-2.",
              link: "https://doi.org/10.1016/j.rse.2011.11.026",
              journalTitle: "Remote Sensing of Environment",
            },
          },
        },
      ],
    },
    metadata: {},
  }) as unknown as Document;
