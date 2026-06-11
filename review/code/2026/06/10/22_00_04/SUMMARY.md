# Code Review 통합 보고서

## 전체 위험도
**LOW** — 내부 dead-code 정리 + dev/test 전용 deep freeze 가드 추가 리팩터링. Critical 발견 없음. WARNING 4건은 모두 dev/test 환경 한정 또는 아키텍처 표면 경계 문제로 production 동작에 영향 없음. SPEC-DRIFT 4건은 project-planner 트랙 spec 갱신 권장.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Side Effect | `freezeSharedCacheValues` 의 `deepFreeze` 가 shallow copy 의 값 객체(원본과 동일 참조)에 직접 `Object.freeze` 적용 → branch 실행 후 원본 `nodeOutputCache` 값이 frozen 됨. 미래 핸들러가 값 내부 mutate 시 dev/test 만 TypeError, production silent — 진단 비대칭 | `parallel-executor.ts` | "freeze 가 공유 참조에 적용된다" JSDoc 명시 |
| 2 | Testing | `FREEZE_BRANCH_CACHE` 가 `NODE_ENV` 의존 — Jest 가 `NODE_ENV=production` 이면 freeze 테스트가 false positive | `parallel-executor.spec.ts` M-5 | `FREEZE_BRANCH_CACHE` export 후 `expect(...).toBe(true)` guard + `expect(()=>{}).toThrow(TypeError)` |
| 3 | Testing | freeze 테스트 `try/catch` — non-strict mode 면 freeze 위반이 silent 무시되어 `mutationError===null` 통과 가능 | `parallel-executor.spec.ts` | `expect(()=>{}).toThrow(TypeError)` 로 변경 |
| 4 | Performance | `deepFreeze` O(N) 재귀 — dev/test 한정, `isFrozen` 조기 반환으로 중복 회피. production 무영향 | `parallel-executor.ts` | 비용 첫 branch 집중 문서화 |

## 참고 (INFO 발췌)

| # | 카테고리 | 발견사항 | 제안 |
|---|----------|----------|------|
| 1-4 | SPEC-DRIFT | system-status 상수명·on()·registerContinuationHandlers·toEiaEvent alias 의 spec 본문 참조 잔재 | project-planner 트랙 spec 갱신 |
| 5 | Security | `publish` catch 의 `err.message` 가 `sanitizeForLog` 미적용 (기존 코드) | wrapping (본 PR 무관 — 기존) |
| 6 | Security | `NODE_ENV` 미정의 시 production 에서도 freeze 활성 | allowlist(`development`/`test`) 방식 |
| 7,17,20 | Security/Concurrency/Perf | nextSeq Math.random fallback·INCR+EXPIRE 비원자·releaseLock 스크립트 (전부 기존 코드, 본 PR 무관) | 후속 |
| 8 | Security | `_retry_state.json` 절대경로 — review/ 는 gitignored 아님(기록 보존), 내부 저장소 | 현행 유지 |
| 13,14 | Side Effect/Testing | registerContinuationHandlers 제거 후 continuation 흐름 e2e 커버 | e2e 179 통과로 커버 확인 |
| 15 | Testing | 상수 제거 후 잔여 import — grep 0건 확인 완료 | 조치 불요 |
| 18,19 | Documentation | freezeSharedCacheValues JSDoc·on() 제거 사유 주석 | 선택 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 |
|----------|--------|
| scope / documentation / dependency / database / api_contract / user_guide_sync | NONE |
| security / performance / architecture / requirement / side_effect / maintainability / testing / concurrency | LOW |

## 권장 조치사항

1. **(W1·W4·INFO6·18)** `parallel-executor.ts`: `FREEZE_BRANCH_CACHE` 를 `development|test` allowlist 로 + freeze 가 공유 참조에 적용됨/비용 집중 JSDoc 명시 + `freezeSharedCacheValues` JSDoc.
2. **(W2·W3)** `parallel-executor.spec.ts`: `try/catch` → `expect(()=>{}).toThrow(TypeError)` + `FREEZE_BRANCH_CACHE===true` guard assertion.
3. **(SPEC-DRIFT 1-4)** project-planner 트랙: system-status §3 상수명→getter, §7.4 날짜, alias 폐기 주석 — 별도 spec-update draft.
4. **(INFO 확인)** 상수 잔여 import grep 0건·continuation e2e 커버 확인 완료 — 조치 불요.

## 라우터 결정

라우터 미사용 — routing=skipped. 전체 reviewer 실행.
