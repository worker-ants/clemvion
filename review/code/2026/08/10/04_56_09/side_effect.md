# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `isGateCEnforced` 함수 시그니처 변경 — `(data: Record<string, unknown>)` → `(block: string)`
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:96` (`export function isGateCEnforced(block: string): boolean`)
  - 상세: 파싱된 frontmatter 객체 대신 **원문 블록 문자열**을 받도록 파라미터 타입/의미가 바뀌었다. `export` 로 공개돼 있어 형식상 공개 인터페이스 변경이지만, `grep -rn "spec-plan-completion"` 결과 이 파일을 import 하는 다른 소스는 없다(호출자는 동일 파일 내부뿐). 따라서 실제 호출자 영향은 없음을 확인했다.
  - 제안: 현재는 안전하나, 이 함수를 다른 파일에서 import 하게 되면 과거 시그니처(파싱된 `data` 객체)로 호출하는 코드가 컴파일 타임에 걸러지므로(타입이 다름) 런타임 위험은 낮다. 별도 조치 불필요.

- **[INFO]** `rawScalar`, `isIsoDate` 가 `plan-scan.ts` 에서 private → `export` 로 승격
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:196` (`export function rawScalar`), `:212` (`export function isIsoDate`)
  - 상세: 기존 비공개 함수를 외부 노출로 바꾼 것은 순수 additive 변경(기존 시그니처·동작 불변, 신규 소비처 `spec-plan-completion.test.ts` 만 추가)이라 하위 호환성 문제는 없다.
  - 제안: 없음(정보성).

- **[INFO]** `hasMalformedStarted` 신규 export 함수 — 부작용 없는 순수 함수
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:102` (`export function hasMalformedStarted`)
  - 상세: `rawScalar` + `isIsoDate` 만 사용하는 순수 판정 함수로 상태 변경·I/O 없음. 문제 없음.

- **[INFO]** 파일시스템 접근은 전부 읽기 전용
  - 위치: `plan-scan.ts` 의 `walkPlanMarkdown`(`fs.readdirSync`, `fs.existsSync`), `findNonTerminalCompletedPlans`/`findFrontmatterViolations`(`fs.readFileSync`); `spec-plan-completion.test.ts` 의 `parsedPlans` 구성부(`fs.readFileSync`), `hasValidSpecImpact`/`danglingSpecImpact` 호출부(`fs.existsSync`)
  - 상세: 코드 전체를 훑었으나 `fs.writeFileSync`/`fs.mkdirSync`/`fs.rmSync` 등 쓰기·삭제 계열 호출은 없다. 저장소 실데이터(`plan/complete/**`)에 대해 read-only 스캔만 수행하므로 예상치 못한 파일시스템 부작용 없음.

- **[INFO]** 실행 검증 — 신규/변경 테스트가 실제 저장소 데이터로 통과함을 확인 (side effect 아닌 회귀 확인 차원의 참고)
  - 상세: `pnpm`/`vitest` 로컬 실행 결과 `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 797 tests 전부 통과(현재 `plan/complete/**` 에 `started` 형식 위반 데이터 없음). 즉 이번에 강화된 게이트가 즉시 CI 를 깨뜨리는 부작용은 없다.

## 요약

이번 변경은 `plan-scan.ts`/`spec-plan-completion.test.ts` 두 테스트 헬퍼 모듈에 한정되며, 전역 변수 신설·상태 공유·파일 쓰기·삭제·환경 변수·네트워크 호출·이벤트/콜백 변경은 전혀 발견되지 않았다. 유일하게 주목할 부분은 `isGateCEnforced` 의 파라미터 타입이 "파싱된 frontmatter 객체" 에서 "frontmatter 원문 블록 문자열" 로 바뀐 시그니처 변경인데, 이 함수는 `export` 돼 있지만 저장소 전체에서 동일 파일 내부 호출 외에 외부 소비처가 없음을 grep 으로 확인했으므로 실질적인 호출자 영향은 없다. `rawScalar`/`isIsoDate` 의 private→export 승격도 기존 동작을 바꾸지 않는 additive 변경이다. 모든 파일시스템 접근은 read-only 이고, 실제 저장소 데이터로 신규 테스트를 로컬 실행해 즉시 회귀(전량 통과)가 없음도 확인했다.

## 위험도
LOW
