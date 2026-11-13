type Josa = '이/가' | '은/는' | '을/를' | '와/과' | '으로/로';

/** 단어 끝 글자의 받침 유무에 맞춰 조사를 붙인다. 한글이 아니면 "이(가)" 형태로 둘 다 표시. */
export function withJosa(word: string, josa: Josa): string {
  // '와/과'만 앞쪽이 받침 없을 때 쓰는 말이라 순서를 바꿔 읽는다. (사과와, 당근과)
  const [withBatchim, withoutBatchim] = josa === '와/과' ? ['과', '와'] : josa.split('/');
  const last = word.charCodeAt(word.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) {
    const batchim = (last - 0xac00) % 28;
    // '으로/로'는 ㄹ 받침(8) 뒤에서도 '로'
    const useFirst = batchim !== 0 && !(josa === '으로/로' && batchim === 8);
    return word + (useFirst ? withBatchim : withoutBatchim);
  }
  return `${word}${withBatchim}(${withoutBatchim})`;
}
