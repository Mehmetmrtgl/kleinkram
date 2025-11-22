import { defineAsyncComponent } from 'vue';

export enum PreviewType {
    IMAGE = 'IMAGE',
    JSON = 'JSON',
}

// Lazy load components to keep initial bundle size small
const ImageSequenceViewer = defineAsyncComponent(
    () =>
        import('../components/inspect-file/viewers/image-sequence-viewer.vue'),
);
const JsonLogViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/json-log-viewer.vue'),
);

/**
 * Determines the best preview strategy based on ROS message type and content.
 */
export const detectPreviewType = (
    messageType: string,
    sampleData?: any,
): PreviewType => {
    const typeLower = messageType.toLowerCase();

    // Explicit ROS Types
    if (
        typeLower.includes('sensor_msgs/image') ||
        typeLower.includes('sensor_msgs/compressedimage')
    ) {
        return PreviewType.IMAGE;
    }

    // Heuristic Checks (if custom type name but standard structure)
    if (sampleData) {
        const hasEncoding = 'encoding' in sampleData;
        const hasDim = 'width' in sampleData && 'height' in sampleData;
        const hasFormat =
            'format' in sampleData && typeLower.includes('compressed'); // CompressedImage

        if ((hasEncoding && hasDim) || hasFormat) {
            return PreviewType.IMAGE;
        }
    }

    // Default
    return PreviewType.JSON;
};

/**
 * Returns the Vue component associated with the type.
 */
export const getViewerComponent = (type: PreviewType) => {
    const map = {
        [PreviewType.IMAGE]: ImageSequenceViewer,
        [PreviewType.JSON]: JsonLogViewer,
    };
    return map[type] ?? JsonLogViewer;
};
