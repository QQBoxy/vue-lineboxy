/**
 * 彈窗堆疊：同時管理「鎖定底層捲動」與「Esc 關閉」。
 *
 * 兩者的生命週期完全一致（彈窗開 → 註冊，關 → 取消），而且都要處理巢狀：
 * 多個彈窗同時開時，Esc 只關最上層那個，捲動鎖也只在最後一個關閉時才解除。
 * 用同一個堆疊管兩件事，比兩套各自維護計數器好懂。
 */

export interface ModalEntry {
  /** 按下 Esc 時呼叫。只有堆疊最上層的那筆會被呼叫 */
  onEscape?: () => void;
}

const stack: ModalEntry[] = [];

/** 鎖定前的原值，解鎖時要還原回去而不是寫死成空字串 */
let savedOverflow = '';
let savedPaddingRight = '';

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return;
  const top = stack[stack.length - 1];
  if (!top?.onEscape) return;
  event.stopPropagation();
  top.onEscape();
};

const lockBodyScroll = () => {
  const { body } = document;
  // 捲軸消失會讓畫面橫向跳動，補等寬的 padding 抵銷。
  // 行動裝置是覆蓋式捲軸，這裡算出來是 0，不受影響
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  savedOverflow = body.style.overflow;
  savedPaddingRight = body.style.paddingRight;
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    const current = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + scrollbarWidth}px`;
  }
};

const unlockBodyScroll = () => {
  const { body } = document;
  body.style.overflow = savedOverflow;
  body.style.paddingRight = savedPaddingRight;
};

/** 彈窗開啟時呼叫。傳入的 entry 要原封不動交給 popModal */
export function pushModal(entry: ModalEntry): void {
  stack.push(entry);
  if (stack.length === 1) {
    lockBodyScroll();
    window.addEventListener('keydown', handleKeydown);
  }
}

/** 彈窗關閉時呼叫。重複呼叫是安全的 */
export function popModal(entry: ModalEntry): void {
  // 不假設自己一定在頂端：巢狀時內層可能先被外層連帶關掉
  const index = stack.lastIndexOf(entry);
  if (index === -1) return;
  stack.splice(index, 1);
  if (stack.length === 0) {
    unlockBodyScroll();
    window.removeEventListener('keydown', handleKeydown);
  }
}
