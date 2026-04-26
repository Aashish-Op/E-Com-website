// FAQ accordion
document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.parentElement;
        const wasActive = item.classList.contains('active');
        // Close all in same group
        item.closest('.faq-group').querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
        if (!wasActive) item.classList.add('active');
        btn.setAttribute('aria-expanded', !wasActive);
    });
});

// Category filter
document.querySelectorAll('.faq-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.faq-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        document.querySelectorAll('.faq-group').forEach(g => {
            g.style.display = (cat === 'all' || g.dataset.group === cat) ? '' : 'none';
        });
    });
});
