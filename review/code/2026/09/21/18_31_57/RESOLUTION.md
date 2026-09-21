# RESOLUTION — 18_31_57

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING#1 (testing) | 코드 | `89566e3d5` | 두 번째 e2e(`webauthn-credential-delete-concurrency.e2e-spec.ts`)에 `SELECT ... WHERE id = ANY($1::uuid[]) FOR UPDATE` + 1.5초 공허성 가드 추가. 문구를 낮추지 않고 테스트를 문구만큼 강하게 만듦 — docblock 도 "겹침을 강제한 상태에서 고정한다" 로 갱신 |
| WARNING#2 (documentation) | 코드 | `ee6fd5d56` | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 stale 줄 번호(`:497`·`:504`·`:527`) 인용을 메서드명(`verifyAuthentication`/`renameCredential`·`deleteCredential`)·예외 타입 지목으로 교체 |
| WARNING#3 (documentation) | 코드 | `7b71e9a4a` | `CHANGELOG.md` auth_config(일곱 번째) 섹션의 "남는 것" 단락에서 `ModelConfigService.remove()`(여덟 번째) 부분도 `<del>` 로 함께 취소선 처리하고 해소 위치(여덟 번째는 `model_config` 섹션, 아홉 번째는 맨 위 항목)를 명시 |

## 하지 않은 것 (근거)

- **INFO 항목 전체** (concurrency/database/maintainability/requirement/scope/security/side_effect 각 파일의 `[INFO]` 발견사항, 특히 `fireDelete` 지역 중복 — 이 세션의 requirement.md/scope.md 가 "동시성 e2e 공용 헬퍼 추출 전용 PR" 범위로 명시) — 이미 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 등재·유예 결정이 끝난 항목, 이번 세션에서 재조치하지 않음. 각 파일에 `[CRITICAL]` 항목은 0건이었다.

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260921-184715.log`)
- unit  : 통과 (`_test_logs/unit-20260921-184807.log` — backend 9929 passed·1 skipped, frontend 6659 passed·1 skipped, channel-web-chat 451 passed, `@workflow/web-chat` 48 passed, internal packages 전부 passed)
- build : 통과 (`_test_logs/build-20260921-184947.log` — 백엔드/프론트엔드 typecheck ratchet 포함)
- e2e   : 통과 (378/378, `_test_logs/e2e-20260921-185322.log`) — `webauthn-credential-delete-concurrency.e2e-spec.ts` PASS. **새 공허성 가드가 실제로 관측했는지**: 두 번째 `it` 안의 `expect(raced).toBe('pending')` 은 락이 실제로 두 DELETE 를 대기시키지 못했다면(즉시 settled) 그 자리에서 실패해 스위트 전체를 FAIL 로 만들었을 것이다 — 로그의 `Tests: 378 passed, 378 total`(실패 0건)이 이 가드가 공허하지 않고 실제로 "pending" 을 관측했다는 직접 증거다.

## 비고

- 이번 세션(`review/code/2026/09/21/18_31_57`)에는 `SUMMARY.md` 가 생성되지 않아, 호출 시 지정된 WARNING 1/2/3 라벨을 그대로 `SUMMARY#` 자리에 사용했다(각 리뷰어 파일 `testing.md`/`documentation.md` 의 `[WARNING]` 발견사항과 1:1 대응 확인 완료, `[CRITICAL]` 0건).
- spec 관련 항목(SPEC-DRIFT·spec 결함) 없음 — 전부 코드/문서 fix 로 종결.
