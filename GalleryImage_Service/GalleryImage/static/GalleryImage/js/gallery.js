/* ═══════════════════════════════════════════════════════════
   ImageGuard Gallery — JavaScript
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {

    // ─── Auto-dismiss alerts after 5 seconds ─────────────────
    document.querySelectorAll('.alert').forEach(function (alert) {
        setTimeout(function () {
            alert.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(function () { alert.remove(); }, 300);
        }, 5000);
    });

    // Add slideOut animation
    var style = document.createElement('style');
    style.textContent = '@keyframes slideOut { to { transform: translateX(120%); opacity: 0; } }';
    document.head.appendChild(style);

    // ─── Image card entrance animation ───────────────────────
    var cards = document.querySelectorAll('.image-card, .stat-card');
    cards.forEach(function (card, index) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        setTimeout(function () {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 60 * index);
    });
});
