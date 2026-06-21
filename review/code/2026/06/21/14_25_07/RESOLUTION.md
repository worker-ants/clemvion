# RESOLUTION — refactor m-1 ai-review 후속

원본 SUMMARY: `SUMMARY.md` (위험도 LOW, Critical 0 / Warning 2 / INFO 10).
(impl-done `review/consistency/.../14_25_07/SUMMARY.md` = BLOCK: NO — 동일 W1·SPEC-DRIFT 재확인.)

## 조치 항목

| SUMMARY # | 분류 | 조치 |
|---|---|---|
| W1 (유지보수성 — `validateServiceAuthType` vs 기존 private `validateServiceAndAuth` 중복) | fix | **통합** — 기존 `validateServiceAndAuth`(private)를 제거하고 `validateServiceAuthType`(public, plan 명칭)으로 일원화. `create()`(저장)·`previewTest()`(미리보기)가 단일 메서드 공유. 내 신규 중복 메서드 삭제 (DRY/Shotgun-surgery 위험 제거) |
| W2 (테스팅 — 이중 호출 패턴) | fix | 단위 테스트를 단일 `try/catch` 로 단순화(이중 호출 제거) |
| INFO #4 (경계값 테스트 미비) | fix | 유효 serviceType(`http`) + 미지원 authType 경계 케이스 테스트 추가 |
| INFO #6 (JSDoc @param/@throws) | fix | `validateServiceAuthType` JSDoc 에 `@param`/`@throws {BadRequestException}` 추가 |

## planner 후속 (spec drift — m-1 이 신설한 것 아님, 비차단)

`plan/in-progress/refactor/02-architecture.md §m-1` 에 명시 체크박스로 추적 (plan-coherence INFO #2 반영):

| SUMMARY # | 항목 |
|---|---|
| INFO #1 (SPEC-DRIFT) / impl-done INFO #1 | `INTEGRATION_INVALID_SERVICE (400)` 를 `4-integration.md §9.4` + `error-codes.md` 등재 (planner) |
| impl-done Cross-Spec W1 | `4-integration.md §9.2` preview-test 바디 `service` → `serviceType` (planner, pre-existing DTO 정합) |

## 의도적 미조치 (INFO — 비차단)

| SUMMARY # | 사유 |
|---|---|
| INFO #2 (validateServiceAuthType public) | 테스트 + `previewTest`/`create` 공유로 public 이 적합. `@internal` 격하 불요 |
| INFO #3 (`oauthBegin` providerMeta controller 잔존) | m-1 범위 밖 기존 기술 부채 — 별도 후속 |
| INFO #5 (controller 단위 테스트 부재) | 400 전파는 service 단위 + e2e 로 커버 |
| INFO #7·#8 등 | 한 줄 JSDoc / 입력 검증 방어 — 비차단 nit |

## TEST 결과

- **lint**: 통과 (0 errors)
- **unit**: 통과 (integrations.service.spec 125 tests 포함)
- **build**: 통과
- **e2e**: 통과 (`make e2e-test` 205 tests)

## 보류·후속 항목

- 위 planner spec drift 2건은 `§m-1` 체크박스로 추적 (별도 planner 작업).
