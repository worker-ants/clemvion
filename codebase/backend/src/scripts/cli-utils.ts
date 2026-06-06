/**
 * CLI 스크립트 공통 유틸리티.
 *
 * eval-retrieval.ts / generate-golden-set.ts 등 src/scripts/ 하위 스크립트에서
 * 공유하는 경량 헬퍼. Node.js process 에만 의존하며 외부 패키지 의존 없음.
 */

/**
 * CLI 플래그 값 파싱.
 *
 * `--flag value` 와 `--flag=value` 두 형식 모두 지원한다.
 *
 * @example
 *   parseCliFlag('--golden')        // process.argv 에서 --golden 값 추출
 *   parseCliFlag('--threshold')     // --threshold=0.5 또는 --threshold 0.5
 */
export function parseCliFlag(name: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`${name}=`));
  if (eqIdx >= 0) return process.argv[eqIdx].split('=', 2)[1];
  const flagIdx = process.argv.indexOf(name);
  if (flagIdx >= 0 && flagIdx < process.argv.length - 1) {
    return process.argv[flagIdx + 1];
  }
  return undefined;
}
