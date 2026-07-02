document.getElementById('year').textContent = new Date().getFullYear();

// Highlight active nav link on scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('nav ul a');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinks.forEach((link) => {
          link.style.color = link.getAttribute('href') === `#${entry.target.id}`
            ? 'var(--accent)'
            : '';
        });
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);

sections.forEach((s) => observer.observe(s));

// Subtle typewriter effect on the hero tagline — runs once on load
const tagline = document.querySelector('.tagline');
if (tagline) {
  const text = tagline.textContent.trim();
  tagline.textContent = '';
  tagline.style.visibility = 'visible';
  let i = 0;
  const type = () => {
    if (i < text.length) {
      tagline.textContent += text[i++];
      setTimeout(type, 28);
    }
  };
  setTimeout(type, 600);
}
