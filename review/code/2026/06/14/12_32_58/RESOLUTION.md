# RESOLUTION — 12_32_58 (refactor-04-a1-eia-msglen-ba62ae)

ai-review RISK LOW, Critical 0, Warning 3, INFO 5 (INFO 전원 dismissed/skipped).

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 | 코드 (plan) | 2edf5079, 40fb5dea | plan 체크박스 be/be-test/consistency-check/e2e/TEST [x] 갱신 |
| W-2 | 코드 (test) | 2edf5079 | external-interaction.e2e-spec.ts 테스트 F 추가 — submit_message 10001자 → 400 MESSAGE_TOO_LONG; waiting_for_input execution 직접 DB 삽입 + mintInteractionToken 헬퍼; 내부 수치 미노출 assertion |
| W-3 | 코드 (test) | 2edf5079 | I-5 unit test try/catch → rejects.toMatchObject 패턴 통일; 커버리지 동일 유지 |

## INFO 항목 처리

| INFO # | 처리 | 사유 |
|--------|------|------|
| INFO-1 (security: 수치 미노출) | dismiss | 현행 유지; workflow-errors.spec.ts + interaction.service.spec.ts 가 회귀 방어 |
| INFO-2 (500→400 변경) | dismiss | 의도적 정정; PR 에 문서화됨 |
| INFO-3 (client-safe 불변식 의존) | dismiss | 주석+테스트 단언으로 이미 문서화 |
| INFO-4 (MAX_MESSAGE_LENGTH export) | dismiss | 상수가 엔진 내부 전용; 인라인 수치가 의도 명확 |
| INFO-5 (dispatchContinuation JSDoc) | fix (포함) | 2edf5079 — JSDoc 에 MessageTooLongError → 400 매핑 줄 추가 |
| INFO-6 (catch comment scope) | dismiss | 기존 주석이 충분히 의도 전달 |
| INFO-7 (workflow-errors.spec 검증) | dismiss | workflow-errors.spec.ts MessageTooLongError 블록(L76-93) 이 이미 수치 미포함·serverDetail 분리 검증 |
| INFO-8 (spec 표 셀 가독성) | dismiss | 선호도 수준, spec 변경 대상 아님 |

## TEST 결과

- lint  : 통과 (0 errors, 43 warnings — pre-existing)
- unit  : 통과 (6883 passed, 1 skipped pre-existing, 344 suites)
- e2e   : 통과 (191/191, +1 신규 테스트 F 포함)

## 보류·후속 항목

없음 — 모든 Warning 처리 완료, spec 변경 없음.
