/**
 * 한글/라틴 문자 비율 기반 경량 언어 감지(외부 의존 0).
 *
 * 골든셋 자동 합성에서 청크 언어에 맞춰 KO/EN 질문을 생성할 때 사용한다.
 * 한국어 CS 문서는 라틴 식별자(SKU·코드·영문 브랜드)를 다수 포함하므로,
 * 라틴이 우세하지 않은 한 한글이 일부만 있어도 'ko' 로 판정한다.
 */

// 한글 음절(가-힣) + 자모(호환/조합) 범위.
const HANGUL_RE = /[가-힣ᄀ-ᇿ㄰-㆏]/g;
const LATIN_RE = /[A-Za-z]/g;

/** 한글 비율이 이 값 이상이면 'ko'. CS 문서의 영문 식별자 혼입을 고려한 낮은 컷. */
const KO_RATIO_THRESHOLD = 0.2;

export function detectLanguage(text: string): 'ko' | 'en' {
  const hangul = (text.match(HANGUL_RE) ?? []).length;
  const latin = (text.match(LATIN_RE) ?? []).length;
  const total = hangul + latin;
  if (total === 0) return 'en'; // 문자 없음(숫자·기호만) → 기본 en
  return hangul / total >= KO_RATIO_THRESHOLD ? 'ko' : 'en';
}
