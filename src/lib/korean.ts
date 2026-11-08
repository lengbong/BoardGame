/** 단어 끝 글자의 받침 유무에 맞춰 조사를 붙인다. 한글이 아니면 "이(가)" 형태로 둘 다 표시. */
export function withJosa(word: string, josa: '이/가' | '은/는' | '을/를' | '와/과'): string {
  const [withBatchim, withoutBatchim] = josa.split('/');
  const last = word.charCodeAt(word.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) {
    const hasBatchim = (last - 0xac00) % 28 !== 0;
    return word + (hasBatchim ? withBatchim : withoutBatchim);
  }
  return `${word}${withBatchim}(${withoutBatchim})`;
}
