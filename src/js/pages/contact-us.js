const toast = document.getElementById('successToast');
const overlay = document.getElementById('toastOverlay');
const closeBtn = document.getElementById('toastClose');

function showToast() {
    overlay.classList.add('show');
    toast.classList.add('show');
    setTimeout(hideToast, 5000);
}

function hideToast() {
    toast.classList.remove('show');
    overlay.classList.remove('show');
}

closeBtn.addEventListener('click', hideToast);
overlay.addEventListener('click', hideToast);

document.getElementById('contactForm').addEventListener('submit', function (e) {
    e.preventDefault();
    this.reset();
    showToast();
});
