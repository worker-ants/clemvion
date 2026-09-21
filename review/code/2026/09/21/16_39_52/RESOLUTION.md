# RESOLUTION — review/code/2026/09/21/16_39_52

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING 1 | 코드(문서) | `5f797583f` | CHANGELOG 에 8번째(모델 설정) 항목 추가 — 형제와 같은 3단 구성 + 판별력 실측. 실측값: 고치기 전 `[204, 204]` · `model_config.delete` 감사 2건, 고친 뒤 `[204, 404]` · 1건. 진 쪽 코드는 `MODEL_CONFIG_NOT_FOUND`(형제들의 `RESOURCE_NOT_FOUND` 와 다름) |
| WARNING 2 | 코드(문서) | `5f797583f` | 직전(#1374, 일곱 번째) 항목의 "남는 것" 절이 남긴 "캐시 무효화 통지 `notifyInvalidated` 중복까지 함께 있음"은 과장이었음을 이번 PR 이 실측 반증(리스너 `clearClientCache` 1개·멱등). 배포 이력이라 원문은 취소선으로 남기고 실측 정정을 인접에 추가. 새 8번째 항목에도 "직전 항목의 예고는 과장이었다"를 명시 |
| WARNING 3 | 결정 고정(무수정) | `01c6130f5` | 하지 않음(의도적) — 아래 "하지 않은 항목" 참조 |
| INFO 1 | 코드 | `153152d85` | `model-config.service.spec.ts` 의 죽은 `mockRepo.remove` fixture 제거. `grep -n "mockRepo\.remove"` 0건 확인 |
| INFO 2 | 코드 | `6a5571e70` | e2e 주석의 거짓 인과("기본 설정이면 default 스왑 경로를 함께 탄다") 정정 — `remove()` 는 `isDefault`/`saveWithDefaultSwap` 을 0회 참조(실측). `isDefault: false` 고정값 자체는 유지 |
| INFO 11 | 코드 | `6a5571e70` | `remove()` 에 `@throws {NotFoundException} MODEL_CONFIG_NOT_FOUND` JSDoc 추가. 기존 인라인 주석(판별자 근거)과 중복 서술하지 않음 |

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260921-165241.log`)
- unit  : 통과 (471 suites / 9925+ tests passed, model-config 관련 suite 포함, `_test_logs/unit-20260921-165341.log`)
- build : 통과 — 백엔드 타입체크 ratchet 포함 (`_test_logs/build-20260921-165515.log`)
- e2e   : 통과 (376/376, `_test_logs/e2e-20260921-170154.log`)

## 하지 않은 항목 (근거)

- **WARNING 3(e2e 파일 간 중복 → 공용 헬퍼 추출)**: 이번 PR 에서 하지 않는다. 리뷰어가
  "또 유예하면 근거 없는 반복이 된다"고 정확히 지적했으므로, 유예를 반복하는 대신
  **결정 시점을 고정**했다 — `plan/in-progress/modelconfig-dup-delete.md` §"이 PR 이
  하지 않는 것"을 고쳐, 아홉 번째(WebAuthn) PR이 **착수 시점**에 공용 헬퍼(`raceDeleteRequests`
  + `assertSingleAudit` 등) 추출 여부를 실제로 결정하고 그 결정을 plan 에 명시하는 것을
  **선행 조건**으로 못박았다. "한 파일만 고치면 형제 여덟과 비대칭이 된다"는 것이 이번에
  하지 않는 유일한 근거다.
- **INFO 9**: 무조치 — 감사가 삭제 트랜잭션 밖에 있는 것은 이 모듈의 기존 컨벤션이고
  이번 diff 가 만든 회귀가 아니다 (SUMMARY 자체가 "조치 불요"로 판정).
- **INFO 10**: 무조치 — `remove()` 주석 밀도가 높은 것은 형제 PR 7건이 이미 채택한 동일
  컨벤션의 연장이며, 근거를 `spec/conventions/`로 옮기는 검토는 9번째(WebAuthn) 처리 시
  plan 에 이미 예정.
- 그 외 INFO(3~8, 12~15)는 SUMMARY 자체가 "조치 불요"/"비-결함 관측"으로 판정한 항목.

## 참고

- 자세한 CHANGELOG 정정 형태(취소선 + 실측)는 `CHANGELOG.md` 최상단 두 항목(모델 설정
  8번째, 그 아래 인증 설정 7번째의 "남는 것" 절) 참조.
