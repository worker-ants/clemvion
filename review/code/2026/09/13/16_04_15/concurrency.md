# 동시성(Concurrency) 코드 리뷰

## 발견사항

해당 없음. 이번 변경 세트는 다음으로 구성된다:

- `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` — 문서·plan·리뷰 산출물(md/json)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` — 삭제(구 가드, `guide-identifier-*` 로 대체)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` — 신규(대체 가드)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` — 주석(JSDoc) 한 줄만 갱신(자매 파일명 인용 업데이트)

실제 로직이 담긴 코드 변경은 `guide-identifier-scan.ts`(227줄)·`guide-identifier-existence.test.ts`(330줄) 두 파일이 전부이며, 둘 다 vitest 단일 프로세스 내에서 동기적으로 실행되는 정적 텍스트 스캐너다. 직접 열어 확인한 결과:

- 파일 I/O 는 `fs.readFileSync`/`fs.readdirSync`/`fs.existsSync` 등 **동기 API만** 사용하고, `fs/promises`·콜백 기반 API 는 전혀 없다.
- 두 파일 전체에서 `async`/`await`/`Promise`/`setTimeout`/`setInterval`/`worker`/`thread` 매치가 0건이다. `lock` 문자열의 유일한 매치는 주석 안의 `pnpm-lock.yaml`(파일명 언급)이고 실제 락 프리미티브가 아니다.
- 공유 가변 전역 상태·모듈 레벨 캐시·재시도 루프·타이머가 없다. 함수들(`scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations` 등)은 인자를 받아 순수하게 값을 반환하는 형태이고, vitest 테스트 실행 모델상 파일 간 병렬 실행이 있더라도 프로세스 간 공유 자원(락파일 쓰기, DB, 소켓 등)에 접근하지 않으므로 테스트 병렬성 자체도 이 변경과 무관하다.
- 삭제된 구 파일(`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts`)도 동일 계열의 순수 동기 스캐너였다(직전 리뷰 라운드 `review/code/2026/09/13/14_41_14/concurrency.md` 에서 이미 NONE 판정).

동시성/병렬 처리 관점의 8개 점검 항목(경쟁 조건, 데드락, 동기화, 스레드 안전성, async/await, 원자성, 이벤트 루프, 리소스 풀링) 모두 해당하는 코드가 없다.

## 요약

이번 diff 는 유저 가이드 식별자(에러 코드 + 환경변수) 실재성을 검증하는 vitest 정적 분석 테스트/스캐너를 `guide-error-code-*` 에서 `guide-identifier-*` 로 리네임·확장하는 작업과 그에 딸린 문서·plan·리뷰 산출물 갱신으로 구성되며, 실제 로직 변경분 전부가 단일 스레드·동기 실행 경로(`fs.readFileSync` + 정규식 매칭 + `Set`/`Array` 구성)에서 완결된다. async/await, Promise, 타이머, 워커, 락, 공유 가변 전역 상태 등 동시성 관련 요소가 신규·삭제 코드 어디에도 없어 경쟁 조건·데드락·동기화·원자성·이벤트 루프 블로킹 어느 항목에도 리스크가 없다.

## 위험도

NONE
