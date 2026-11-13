/**
 * 인쇄 모드 켜고 끄기. 인쇄 CSS는 모두 html.sd-printing 아래에만 걸려 있어서
 * 다른 게임이나 처음 화면을 인쇄할 때는 아무 영향이 없다.
 * @page(A4, 여백 12mm)는 클래스로 범위를 정할 수 없으므로 인쇄하는 동안에만 <style>을 넣었다가 뺀다.
 */
const CLASS = 'sd-printing';
const STYLE_ID = 'sd-print-page-style';

export function enterPrintMode(): void {
  document.documentElement.classList.add(CLASS);
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '@page { size: A4 portrait; margin: 12mm; }';
    document.head.appendChild(style);
  }
}

export function exitPrintMode(): void {
  document.documentElement.classList.remove(CLASS);
  document.getElementById(STYLE_ID)?.remove();
}

export function isPrintMode(): boolean {
  return document.documentElement.classList.contains(CLASS);
}

/**
 * 인쇄 창을 연다. 인쇄가 끝나면(afterprint) onDone을 부르고 인쇄 모드를 끈다.
 * 인쇄할 종이는 이 함수를 부르기 전에 DOM에 그려져 있어야 한다 (flushSync).
 */
export function printWithMode(onDone?: () => void): void {
  enterPrintMode();
  const done = () => {
    window.removeEventListener('afterprint', done);
    exitPrintMode();
    onDone?.();
  };
  window.addEventListener('afterprint', done);
  try {
    window.print();
  } catch {
    done();
  }
}
