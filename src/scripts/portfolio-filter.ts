/**
 * Portfolio Filter System
 * Provides smooth filtering animations for portfolio projects
 */

/**
 * Filter projects by category
 */
function filterProjects(category: string) {
    const projects = document.querySelectorAll('[data-project-type]');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    projects.forEach((project, index) => {
        const projectType = project.getAttribute('data-project-type');
        const shouldShow = category === 'all' || projectType === category;

        if (shouldShow) {
            // Show project with staggered animation
            if (prefersReducedMotion) {
                project.classList.remove('filtered-out');
                project.classList.add('filtered-in');
            } else {
                setTimeout(() => {
                    project.classList.remove('filtered-out');
                    project.classList.add('filtered-in');
                }, index * 50); // Stagger by 50ms per item
            }
        } else {
            // Hide project immediately
            project.classList.add('filtered-out');
            project.classList.remove('filtered-in');
        }
    });
}

/**
 * Update active filter tag
 */
function updateActiveTag(clickedTag: HTMLElement) {
    const allTags = document.querySelectorAll('.filter-tag');

    allTags.forEach(tag => {
        tag.classList.remove('active');
        tag.setAttribute('aria-pressed', 'false');
    });

    clickedTag.classList.add('active');
    clickedTag.setAttribute('aria-pressed', 'true');
}

/**
 * Initialize filter functionality
 */
function initPortfolioFilter() {
    const filterTags = document.querySelectorAll('.filter-tag');

    filterTags.forEach(tag => {
        tag.addEventListener('click', (e: Event) => {
            const target = e.currentTarget as HTMLElement;
            const category = target.getAttribute('data-filter');

            if (!category) return;

            // Update active state
            updateActiveTag(target);

            // Filter projects
            filterProjects(category);
        });
    });

    // Set initial state (all active)
    const allTag = document.querySelector('.filter-tag[data-filter="all"]') as HTMLElement;
    if (allTag) {
        allTag.setAttribute('aria-pressed', 'true');
    }
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPortfolioFilter);
} else {
    initPortfolioFilter();
}
