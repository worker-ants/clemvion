# RESOLUTION — EIA/WS 대기 노드 표면 매트릭스 가드

SUMMARY: `review/code/2026/07/11/00_03_25/SUMMARY.md` (Critical 0 / Warning 12 / MEDIUM)

## 조치 항목

| SUMMARY # | 발견 | 조치 | commit |
|---|---|---|---|
| 1 | hooks warn 로그의 `err.message` 가 항상 "Conflict Exception" | `readErrorBody(err)` 헬퍼 신설 — `err.getResponse().error.{code,message}` 를 읽어 실제 진단 메시지 로깅. 회귀 테스트로 `surface mismatch` 포함 + `Conflict Exception` 미포함 단언 | (본 fix commit) |
| 2 | catch 가 ConflictException 타입 전체를 삼킴 | `code === 'STATE_MISMATCH'` 로 판정 좁힘. `IDEMPOTENCY_KEY_CONFLICT`(다른 409)는 전파하는 회귀 테스트 추가 | 〃 |
| 3 | `resumeTurnRegistry` 대칭 미검증 | `resumeTurnRegistry.selects` ↔ `resolveWaitingSurface` 판정 일치 테스트 추가 (worker-side SoT 대칭 가드) | 〃 |
| 4 | buttons 표면 회귀 e2e 부재 | `execution-park-resume.e2e-spec.ts` 에 template(buttons) 노드 대기 → `end_conversation` 409 → waiting 유지 → 정상 `click_button` 재개 + 선택 포트 확인 e2e 추가. 영속 `output_data` 의 JSONB 표면을 실 Postgres 로 검증 | 〃 |
| 5 | hot-path 가 `output_data` 전체 + 2왕복 | `resolveWaitingNodeExecutionId` 를 단일 JOIN QueryBuilder 로 재작성 — `node.type` JOIN + `interactionType` JSONB path 투영만 select. `nodeRepository.findOne` 제거(2왕복→1). "컬럼 전체 미-select" 회귀 테스트 추가 | 〃 |
| 10 | resolver JSDoc 중복/무관 문단 삽입 | 케이스 열거를 3-case 로 정리하고 중복 블록·끊는 문단 제거 | 〃 |
| 11 | `waiting-surface-guard.ts:8` spec 링크 1단계 부족(깨짐) | `../../../../` → `../../../../../` (normpath 로 실존 확인) | 〃 |
| 12 | CHANGELOG 누락 | `CHANGELOG.md` Unreleased 항목 추가 | 〃 |
| 6 | TOCTOU 윈도우 소폭 확장 | **#5 로 해소** — findOne 제거로 2왕복이 단일 쿼리가 돼 non-atomic 구간이 오히려 이전 수준으로 복귀. 데이터 무결성은 원래도 `claimResumeEntry` 원자 claim 이 보장(가드는 advisory) | 〃 |
| 7 | breaking behavior 공지 (API 계약) | **후속 이관** — plan F-3 신설 (project-planner 결정 대상, 코드 revert 아님) | plan 커밋 |
| 8 | SPEC-DRIFT (§7.5.1 표·EIA §5.1 미반영) | **후속 이관** — plan "spec 동기 (S-1)" 로 등재, `--impl-done` 이전 project-planner 위임. 코드는 이미 계약 정확히 구현 | plan 커밋 |
| 9 | F-2 가 form 만 언급 | plan F-2 범위를 buttons 표면까지 확장 | plan 커밋 |
| 13–18 | INFO | 조치 불요 (fail-closed 수렴·후속 refactor 후보·스코프 밖) | — |
| 19–22 | 확인됨(안전) | 조치 불요 | — |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260711-003909.log`)
- unit: 통과 (`_test_logs/unit-20260711-004000.log`) — 영향 suite 457 pass
- build: 통과 (`_test_logs/build-20260711-004105.log`)
- e2e: 통과 (`_test_logs/e2e-20260711-004340.log`, 251 pass) — form + buttons 표면 회귀 e2e 포함.
  form 케이스는 가드 비활성 시 202 반환(재현) / 복원 시 409 를 실 Postgres 로 실증(비-vacuity 확인).

## 보류·후속 항목

- **plan S-1 (spec 동기)** — §7.5.1 표 3번째 행 + Rationale, EIA §5.1/§6.2, `0-common.md §10.9`,
  `3-execution.md §9`, interaction-type-registry cross-ref. `--impl-done` 이전 project-planner 위임.
- **plan F-2** — 채팅 채널 표면 불일치(form·buttons) graceful 사용자 안내 (`languageHints` 신규 키).
- **plan F-3** — 외부 EIA 클라이언트 breaking behavior 공지 여부 결정 (project-planner).
- **plan F-1** — `assertNodeId` 실제 대기 nodeId 일치 검사 (`hooks.service` 의 `nodeId:'chat-channel'`
  placeholder 선행 교체 필요).
