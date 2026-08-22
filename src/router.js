// ─── SPA Router ───

class Router {
  constructor() {
    this.routes = {};
    this.currentPage = null;
    this.container = null;
    this.onNavigate = null;
  }

  init(container) {
    this.container = container;
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  register(name, renderFn) {
    this.routes[name] = renderFn;
  }

  navigate(page) {
    window.location.hash = page;
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    this.loadPage(hash);
  }

  async loadPage(pageName) {
    if (!this.routes[pageName]) {
      pageName = 'dashboard';
    }

    // Fade out current
    if (this.container.children.length > 0) {
      this.container.style.opacity = '0';
      this.container.style.transform = 'translateY(8px)';
      await new Promise(r => setTimeout(r, 150));
    }

    this.currentPage = pageName;
    this.container.innerHTML = '';

    try {
      const html = await this.routes[pageName]();
      this.container.innerHTML = html;
    } catch (err) {
      console.error('Error loading page:', err);
      this.container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Đã xảy ra lỗi</div></div>`;
    }

    // Fade in new
    this.container.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    this.container.style.opacity = '1';
    this.container.style.transform = 'translateY(0)';

    if (this.onNavigate) {
      this.onNavigate(pageName);
    }
  }

  getCurrentPage() {
    return this.currentPage;
  }
}

export default new Router();
