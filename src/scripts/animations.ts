/**
 * Scroll Reveal Animation System
 * Uses Intersection Observer for performance-optimized scroll animations
 */

/**
 * Initialize scroll reveal animations
 * Observes all elements with data-reveal attribute and adds 'revealed' class when visible
 */
export function initScrollReveal() {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        // If reduced motion is preferred, reveal all elements immediately
        const revealElements = document.querySelectorAll('[data-reveal]');
        revealElements.forEach(el => el.classList.add('revealed'));
        return;
    }

    // Create Intersection Observer
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    // Element is in viewport, add revealed class
                    entry.target.classList.add('revealed');

                    // Unobserve after revealing (one-time animation)
                    observer.unobserve(entry.target);
                }
            });
        },
        {
            // Trigger when 10% of element is visible
            threshold: 0.1,
            // Trigger slightly before element enters viewport
            rootMargin: '0px 0px -50px 0px',
        }
    );

    // Observe all elements with data-reveal attribute
    const revealElements = document.querySelectorAll('[data-reveal]');
    revealElements.forEach((el) => {
        observer.observe(el);
    });
}

/**
 * Add staggered delays to children elements
 * Useful for grid layouts where cards should appear one after another
 *
 * @param parentSelector - CSS selector for parent container
 * @param childSelector - CSS selector for child elements to stagger
 * @param delayIncrement - Delay between each child in milliseconds (default: 50ms)
 */
export function addStaggeredDelay(
    parentSelector: string,
    childSelector: string,
    delayIncrement: number = 50
) {
    const parent = document.querySelector(parentSelector);
    if (!parent) return;

    const children = parent.querySelectorAll(childSelector);
    children.forEach((child, index) => {
        const delay = index * delayIncrement;
        child.setAttribute('data-reveal-delay', delay.toString());
    });
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollReveal);
} else {
    initScrollReveal();
}
