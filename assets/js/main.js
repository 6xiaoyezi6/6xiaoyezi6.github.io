/* 功能：提供移动端导航、页脚年份和计算器启动失败提示。
 * 方法：通过原生 DOM 和 aria-expanded 切换导航，超时检查计算器表单是否出现。
 * 注意事项：保留无 JavaScript 时可见的导航；支持 file:// 与 HTTP，不隐藏资源加载错误。
 */
const header = document.querySelector('.site-header');
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
if (header && toggle && nav) {
  header.classList.add('nav-ready');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
  });
}
for (const year of document.querySelectorAll('[data-year]')) year.textContent = new Date().getFullYear();
if (document.querySelector('#calculator')) {
  setTimeout(() => {
    const calculator = document.querySelector('#calculator');
    if (!calculator.querySelector('#reaction-form') && !calculator.querySelector('[role="alert"]')) {
      calculator.textContent = '计算器脚本未能加载。请确认 assets/js/calculator.js 文件完整，启用 JavaScript，并刷新页面。';
      calculator.classList.add('notice', 'error');
      calculator.setAttribute('role', 'alert');
    }
  }, 8000);
}
