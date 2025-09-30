/**
 * 移動設備優化腳本
 * 處理Markdown內容在移動設備上的各種顯示問題
 */

// 初始化所有移動優化功能
function initMobileFixes() {
  fixMarkdownContent();
  enhanceCodeBlocks();
  enhanceTables();
  fixImageDisplay();
}

// 在DOM加載完成後執行
document.addEventListener('DOMContentLoaded', initMobileFixes);

// 支援 Astro 動態頁面加載
document.addEventListener('astro:page-load', initMobileFixes);

// 監聽視窗大小變化，重新優化佈局
let resizeTimeout: NodeJS.Timeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    initMobileFixes();
  }, 250);
});

/**
 * 修復Markdown內容在移動設備上的一般問題
 */
function fixMarkdownContent() {
  // 找到所有Markdown內容容器
  const markdownContainers = document.querySelectorAll('.prose');

  markdownContainers.forEach(container => {
    // 確保內容不會溢出容器
    container.classList.add('max-w-full', 'overflow-hidden');

    // 為所有段落和列表項添加合適的斷詞
    const textElements = container.querySelectorAll('p, li');
    textElements.forEach(el => {
      el.classList.add('break-words');
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
 * 增強表格的顯示
 */
function enhanceTables() {
  // 找到所有不是由自定義組件包裝的表格
  const tables = document.querySelectorAll('.prose table:not(.table-wrapper table)');

  tables.forEach(table => {
    // 檢查表格是否已經被包裝過
    if ((table.parentNode as HTMLElement)?.classList?.contains('table-responsive-wrapper')) {
      return;
    }

    // 創建響應式包裝容器
    const wrapper = document.createElement('div');
    wrapper.className = 'table-responsive-wrapper relative my-6 overflow-hidden';
    
    // 創建滾動容器
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'overflow-x-auto';
    
    // 設置容器樣式
    scrollContainer.style.maxWidth = '100%';
    (scrollContainer.style as any).WebkitOverflowScrolling = 'touch';
    (scrollContainer.style as any).scrollbarWidth = 'thin';

    // 在移動設備上添加負邊距以利用全寬
    if (window.innerWidth <= 768) {
      wrapper.style.marginLeft = '-1rem';
      wrapper.style.marginRight = '-1rem';
      scrollContainer.style.paddingLeft = '1rem';
      scrollContainer.style.paddingRight = '1rem';
    }

    // 將表格包裝起來
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(scrollContainer);
    scrollContainer.appendChild(table);

    // 優化表格樣式
    optimizeTableStyles(table as HTMLTableElement);
    
    // 添加滾動提示
    addScrollIndicator(wrapper, scrollContainer);
  });
}

/**
 * 優化表格樣式
 */
function optimizeTableStyles(table: HTMLTableElement) {
  // 基本表格樣式
  table.style.minWidth = 'max-content';
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  // 移動設備上的字體大小調整
  if (window.innerWidth <= 640) {
    table.style.fontSize = '0.875rem'; // 14px
  } else if (window.innerWidth <= 768) {
    table.style.fontSize = '0.9rem'; // ~14.4px
  }

  // 優化表格單元格
  const cells = table.querySelectorAll('th, td');
  cells.forEach(cell => {
    const cellElement = cell as HTMLElement;
    
    // 調整內距
    if (window.innerWidth <= 640) {
      cellElement.style.padding = '0.5rem 0.75rem';
    } else if (window.innerWidth <= 768) {
      cellElement.style.padding = '0.625rem 1rem';
    } else {
      cellElement.style.padding = '0.75rem 1.25rem';
    }

    // 確保文字不會過於擁擠
    cellElement.style.whiteSpace = 'nowrap';
    cellElement.style.overflow = 'hidden';
    cellElement.style.textOverflow = 'ellipsis';
    cellElement.style.maxWidth = '200px';

    // 表頭樣式
    if (cell.tagName === 'TH') {
      cellElement.style.fontWeight = '600';
      cellElement.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
    }
  });

  // 添加邊框樣式
  table.style.border = '1px solid #e2e8f0';
  cells.forEach(cell => {
    (cell as HTMLElement).style.border = '1px solid #e2e8f0';
  });
}

/**
 * 添加滾動提示指示器
 */
function addScrollIndicator(wrapper: HTMLElement, scrollContainer: HTMLElement) {
  // 檢查是否需要滾動
  const needsScroll = scrollContainer.scrollWidth > scrollContainer.clientWidth;
  
  if (needsScroll) {
    // 創建左右滾動提示
    const leftIndicator = document.createElement('div');
    leftIndicator.className = 'scroll-indicator scroll-indicator-left';
    leftIndicator.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 20px;
      background: linear-gradient(to right, rgba(255,255,255,0.8), transparent);
      pointer-events: none;
      z-index: 1;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    const rightIndicator = document.createElement('div');
    rightIndicator.className = 'scroll-indicator scroll-indicator-right';
    rightIndicator.style.cssText = `
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 20px;
      background: linear-gradient(to left, rgba(255,255,255,0.8), transparent);
      pointer-events: none;
      z-index: 1;
      opacity: 1;
      transition: opacity 0.3s ease;
    `;

    wrapper.appendChild(leftIndicator);
    wrapper.appendChild(rightIndicator);

    // 監聽滾動事件來更新指示器
    scrollContainer.addEventListener('scroll', () => {
      const scrollLeft = scrollContainer.scrollLeft;
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

      // 左側指示器
      leftIndicator.style.opacity = scrollLeft > 10 ? '1' : '0';
      
      // 右側指示器
      rightIndicator.style.opacity = scrollLeft < maxScroll - 10 ? '1' : '0';
    });
  }
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
