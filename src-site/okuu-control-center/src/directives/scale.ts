import { computed, DirectiveBinding, watch } from 'vue';
import { useConfigStore } from 'src/stores/config.store';

const configStore = useConfigStore();

const originalSizes = new WeakMap<HTMLElement, { width: number, height: number, fontSize: string }>();

const saveOriginalSizes = (el: HTMLElement) => {
    if (!originalSizes.has(el)) {
        originalSizes.set(el, { width: el.offsetWidth, height: el.offsetHeight, fontSize: window.getComputedStyle(el).fontSize });
    }
    const children = el.querySelectorAll('*');
    children.forEach((child) => {
        if (child instanceof HTMLElement) {
            if (!originalSizes.has(child)) {
                originalSizes.set(child, { width: child.offsetWidth, height: child.offsetHeight, fontSize: window.getComputedStyle(child).fontSize });
            }
            saveOriginalSizes(child);
        }
    });
};

const updateScale = (el: HTMLElement, scale: number) => {
    if (el instanceof HTMLElement) {
        saveOriginalSizes(el);
        const originalSize = originalSizes.get(el);
        if (originalSize) {
            //el.style.transformOrigin = 'top left';
            //el.style.transform = `scale(${scale})`;

            // increase all children text size
            const children = el.querySelectorAll('*');
            children.forEach((child) => {
                if (child instanceof HTMLElement) {
                    const originalFontSize = originalSizes.get(child)?.fontSize;
                    if (originalFontSize) {
                        const newFontSize = parseFloat(originalFontSize) * scale;
                        child.style.fontSize = `${newFontSize}px`;
                    }
                }
            });
            
            // increase all children's q-avatars width x height
            const avatars = el.querySelectorAll('.q-avatar');
            for (const avatar of avatars) {
                if (avatar instanceof HTMLElement) {
                    const originalFontSize = originalSizes.get(avatar)?.fontSize || window.getComputedStyle(avatar).fontSize;
                    avatar.style.width = `${parseFloat(originalFontSize) * scale}px`;
                    avatar.style.height = `${parseFloat(originalFontSize) * scale}px`;
                }
            }

        }
    }
};
  
export default {
    mounted(el: HTMLElement, binding: DirectiveBinding) {
      const configStore = useConfigStore();
      const zoomLevel = computed(() => configStore.getZoomLevel() * 0.01);
      let oldZoomLevel = zoomLevel.value;
  
      // Initial scale
      updateScale(el, zoomLevel.value);
  
      // Watch for changes in zoomLevel
      watch(zoomLevel, (newZoomLevel: number) => {
        if (newZoomLevel !== oldZoomLevel) {
          updateScale(el, newZoomLevel);
          oldZoomLevel = newZoomLevel;
        }
      });

      // Observe for new elements added to the DOM
      const observer = new MutationObserver(() => {
        updateScale(el, zoomLevel.value);
      });

      observer.observe(el, { childList: true, subtree: true });
    },
    updated(el: HTMLElement, binding: DirectiveBinding) {
      const configStore = useConfigStore();
      const zoomLevel = computed(() => configStore.getZoomLevel() * 0.01);
      let oldZoomLevel = zoomLevel.value;
  
      // Update scale
      if (zoomLevel.value !== oldZoomLevel) {
        updateScale(el, zoomLevel.value);
        oldZoomLevel = zoomLevel.value;
      }
    },
  };