document.addEventListener('DOMContentLoaded', function() {
    const filterTabContainer = document.querySelector('.products .filter-tabs');
    const filterTabs = document.querySelectorAll('.products .filter-tab');
    const productCards = document.querySelectorAll('.products .prod-card');

    if (!filterTabContainer || filterTabs.length === 0 || productCards.length === 0) {
        return;
    }

    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active from all tabs
            filterTabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            
            // Add active to clicked tab
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');

            const filterValue = this.getAttribute('data-filter');

            // Filter products
            productCards.forEach(card => {
                const category = card.getAttribute('data-category');
                
                // If filter is 'all', show all
                if (filterValue === 'all') {
                    card.style.display = '';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        // Keep transform if it was revealed, assuming reveal resets transform
                    }, 50);
                } else {
                    // Show matching, hide non-matching
                    if (category === filterValue) {
                        card.style.display = '';
                        setTimeout(() => {
                            card.style.opacity = '1';
                        }, 50);
                    } else {
                        card.style.display = 'none';
                        card.style.opacity = '0';
                    }
                }
            });
        });
    });
});
