/**
 * 移動設備優化腳本
 * 處理Markdown內容在移動設備上的各種顯示問題
 */

// 初始化所有移動優化功能
function initMobileFixes() {
  fixMarkdownContent();
  enhanceCodeBlocks();

  fixImageDisplay();
}

// 在DOM加載完成後執行
document.addEventListener('DOMContentLoaded', initMobileFixes);

// 支援 Astro 動態頁面加載
document.addEventListener('astro:page-load', initMobileFixes);

/**
 * 修復Markdown內容在移動設備上的一般問題
 */
function fixMarkdownContent() {
  // 找到所有Markdown內容容器
  const markdownContainers = document.querySelectorAll('.prose');

  markdownContainers.forEach(container => {
    // 確保內容不會溢出容器（不使用 overflow-hidden 以免截斷表格）
    container.classList.add('max-w-full');

    // 為所有段落和列表項添加合適的斷詞
    const textElements = container.querySelectorAll('p, li');
    textElements.forEach(el => {
      el.classList.add('break-words');
    });

    // 為表格加上可捲動的 wrapper，避免文字被截斷
    const tables = container.querySelectorAll('table');
    tables.forEach(table => {
      if ((table.parentNode as HTMLElement)?.classList?.contains('table-scroll-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll-wrapper';
      table.parentNode!.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  });
}

/**
 * 增強代碼塊的顯示
 */
function enhanceCodeBlocks() {
  // 找到所有不是由自定義組件渲染的代碼塊
  const codeBlocks = document.querySelectorAll('pre:not(.language-)');

  codeBlocks.forEach(block => {
    // 確保代碼塊可以滾動
    (block as HTMLElement).style.overflowX = 'auto';
    (block as HTMLElement).style.maxWidth = '100%';
    ((block as HTMLElement).style as any).WebkitOverflowScrolling = 'touch';

    // 在小屏幕上調整字體大小
    if (window.innerWidth <= 640) {
      (block as HTMLElement).style.fontSize = '0.875rem';
    }
  });
}


/**
 * 修復圖片顯示問題
 */
function fixImageDisplay() {
  // 找到所有不是由自定義組件渲染的圖片，也排除模態視窗中的圖片
  const images = document.querySelectorAll('.prose img:not(.responsive-image-container img):not(#modal-image)');

  images.forEach(img => {
    // 檢查圖片是否已經被處理過
    if ((img as HTMLElement).classList.contains('mobile-optimized')) {
      return;
    }

    // 確保圖片不會溢出容器
    (img as HTMLElement).style.maxWidth = '100%';
    (img as HTMLElement).style.height = 'auto';
    img.setAttribute('loading', 'lazy');

    // 添加圓角和陰影效果
    img.classList.add('rounded-lg', 'shadow-md', 'mobile-optimized');

    // 在小屏幕上處理圖片邊距
    if (window.innerWidth <= 640) {
      (img as HTMLElement).style.marginLeft = 'auto';
      (img as HTMLElement).style.marginRight = 'auto';
    }

    // 將圖片包裝在容器中以更好控制佈局
    const parent = img.parentNode;
    if (parent && parent.nodeName !== 'FIGURE' && !(parent as HTMLElement).classList.contains('image-wrapper')) {
      const wrapper = document.createElement('figure');
      wrapper.className = 'image-wrapper my-6 flex justify-center';
      parent.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    }
  });
}
