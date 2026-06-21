# RESOLUTION — refactor m-1 fresh ai-review #2 후속

원본 SUMMARY: `SUMMARY.md` (위험도 LOW, Critical 0 / Warning 1 / INFO 10).
(impl-done `review/consistency/.../14_38_56/` = BLOCK: NO — Warning 전부 pre-existing spec drift, planner.)
review #1 의 W1(중복)·W2(테스트) 해소 확인. 이번 W1 은 통합 과정에서 발생한 visibility 승격.

## 조치 항목

| SUMMARY # | 분류 | 조치 |
|---|---|---|
| W1 (아키텍처/부작용 — `validateServiceAuthType` private→public 승격) | fix | **`private` 복귀** — 내부 공유 guard 이므로 외부 노출 불요(controller 는 `previewTest` 만 호출). JSDoc 에 "내부 공유 guard, 외부 직접 호출 금지" 명시. 직접-호출 단위 테스트는 `previewTest`/`create` 경유 간접 검증으로 전환 |
| INFO #4 (테스트 try/catch 패턴) | fix | `previewTest` async 화 → 단위 테스트를 `.rejects.toMatchObject(...)` 비동기 패턴으로 통일(try/catch 제거) |
| INFO #5 (previewTest 테스트 에러 바디 미검증) | fix | `.rejects.toMatchObject({ response: { code, message } })` 로 에러 바디 검증 |
| INFO #6 (previewTest 동기 throw) | fix | `previewTest` 를 `async` 로 — 검증 실패가 rejected promise. controller→NestJS 400 동작 불변 |
| INFO #7 (create() 검증 테스트 부재) | fix | `create describe` 에 미지원 조합 INTEGRATION_INVALID_SERVICE 테스트 추가 |

## 의도적 미조치 / planner

| SUMMARY # | 사유 |
|---|---|
| SPEC-DRIFT #1·#2 (INTEGRATION_INVALID_SERVICE 미등재·§9.2 필드명) | pre-existing — `§m-1` planner 후속 체크박스로 추적 중. m-1 코드 무관 |
| INFO #3 (controller `// m-1:` 주석) | "왜 controller 가 thin 한가" 설명 — 유지(비차단) |
| INFO #8 (controller 단위 테스트) | service 단위 + e2e(POST preview-test 400)로 커버 |
| INFO #9 (`oauthBegin` providerMeta) | m-1 범위 밖 — M-2 백로그 |
| INFO #10 (authType `@see`) | nit |

## TEST 결과

- **lint / unit / build / e2e**: 전부 통과 (integrations.service.spec 125 tests, e2e 205)

## 보류·후속 항목

- spec drift 2건은 `§m-1` planner 체크박스로 추적.
