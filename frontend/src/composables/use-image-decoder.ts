import { ref, Ref, watch } from 'vue';
import { renderMessageToCanvas } from '../services/image-utilities';

export function useImageDecoder(
    canvasReference: Ref<HTMLCanvasElement | null>,
    messageData: Ref,
): { draw: () => void; renderError: Ref<string | undefined, string> } {
    const renderError = ref<string | undefined>(undefined);

    const draw = (): void => {
        if (!canvasReference.value || !messageData.value) return;

        try {
            renderError.value = undefined;
            renderMessageToCanvas(messageData.value, canvasReference.value);
        } catch (error: unknown) {
            console.error('Image render failed', error);
            renderError.value = 'Failed to render frame';
        }
    };

    // Automatically redraw when data changes
    watch(messageData, draw, { deep: false });

    // Expose manual draw if needed (e.g. on mount)
    return {
        draw,
        renderError,
    };
}
