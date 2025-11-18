/** https://docs.cloud.google.com/vision/docs/reference/rest/v1/Feature */
export type VisionFeatureType =
  /** Unspecified feature type. */
  | "TYPE_UNSPECIFIED"
  /** Run face detection. */
  | "FACE_DETECTION"
  /** Run landmark detection. */
  | "LANDMARK_DETECTION"
  /** Run logo detection. */
  | "LOGO_DETECTION"
  /** Run label detection. */
  | "LABEL_DETECTION"
  /** Run text detection / optical character recognition (OCR). Text detection is optimized for areas of text within a larger image; if the image is a document, use DOCUMENT_TEXT_DETECTION instead. */
  | "TEXT_DETECTION"
  /** Run dense text document OCR. Takes precedence when both DOCUMENT_TEXT_DETECTION and TEXT_DETECTION are present. */
  | "DOCUMENT_TEXT_DETECTION"
  /** Run Safe Search to detect potentially unsafe or undesirable content. */
  | "SAFE_SEARCH_DETECTION"
  /** Compute a set of image properties, such as the image's dominant colors. */
  | "IMAGE_PROPERTIES"
  /** Run crop hints. */
  | "CROP_HINTS"
  /** Run web detection. */
  | "WEB_DETECTION"
  /** Run Product Search. */
  | "PRODUCT_SEARCH"
  /** Run localizer for object detection. */
  | "OBJECT_LOCALIZATION";

export interface VisionFeature {
  type: VisionFeatureType;
  maxResults?: number;
  model?: string;
}
