const currentPath = window.location.pathname.replace(/\/$/, '') || '/'
const links = document.querySelectorAll('.site-nav a[href]')

for (const link of links) {
  const href = link.getAttribute('href')
  if (!href) continue
  const normalizedHref = href.replace(/\/$/, '') || '/'

  if (normalizedHref === currentPath) {
    link.setAttribute('aria-current', 'page')
  } else {
    link.removeAttribute('aria-current')
  }
}

