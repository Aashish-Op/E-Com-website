// FAQ accordion
document.querySelectorAll('.del-faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.parentElement;
        const isActive = item.classList.contains('active');
        document.querySelectorAll('.del-faq-item').forEach(i => i.classList.remove('active'));
        if (!isActive) item.classList.add('active');
        btn.setAttribute('aria-expanded', !isActive);
    });
});
