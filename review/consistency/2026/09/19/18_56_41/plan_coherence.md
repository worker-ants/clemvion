# Plan 정합성 검토 — `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`

## 발견사항

- **[INFO]** 선행 트래커 항목의 `[ ]` 는 이 draft 완료 전까지 정합하게 열려 있어야 한다
  - target 위치: `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 상단 「왜」 문단·`## 체크리스트` 마지막 줄 「트래커 해소 · 이 draft `plan/complete/` 로」
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4644-4649` 「지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다 — 묘비(tombstone) 부재」(미체크 `[ ]`)
  - 상세: 트래커 항목이 남긴 3가지 「결정할 것」과 1가지 「실측 필요」를 target 이 모두 다뤘는지 대조했다 — ① 보존 기간(영구 vs 기간) → 「사용자 결정 (2026-09-19)」로 영구 확정, ② 저장 위치(트리거 soft-delete 행 vs 별도 묘비 테이블) → 별도 테이블 `webhook_endpoint_reservation` 로 확정(트래커가 제시한 두 옵션 중 후자를 사용-시점 예약 방식으로 구체화), ③ 경로 변경 시 옛 경로 처리 → 「예약은 지우지 않는다」로 이미 커버(생성·변경 시점에 처음 예약되므로 변경 이후 별도 처리 불필요), ④ 실측 필요(수신 404 로그) → 「비대상」절에서 "결정이 영구 예약이라 트래픽 양과 무관" 이라 명시적으로 기각. 넷 다 충돌 없이 해소됐다. 다만 트래커 원문은 아직 `[x]` 로 갱신되지 않았는데, 이는 target 자신의 체크리스트가 "spec 반영 → 구현 → 트래커 해소 → complete 이동" 순서로 이미 예정해 둔 정상적인 draft 단계이지 누락이 아니다.
  - 제안: 별도 조치 불필요 — target 의 체크리스트가 이미 트래커 갱신을 포함한다. 이 draft 가 `plan/complete/` 로 옮겨질 때 트래커 4644행도 같은 커밋에서 `[x]` + 해소 문구로 갱신되는지만 후속 세션에서 확인.

## 교차 확인한 항목 (충돌 없음)

- 같은 `spec/1-data-model.md` §Rationale 「Webhook `endpoint_path` 전역 유일 (2026-09-18)」의 **남는 틈** 단락 — 이 draft 가 그 단락 끝에 해소 각주를 붙이려는 자리이며, 다른 in-progress plan 이 같은 단락을 동시에 편집 대상으로 삼고 있지 않음(전수 grep 확인).
- `spec/5-system/3-error-handling.md` 의 `TRIGGER_ENDPOINT_PATH_CONFLICT` 행, `spec/2-navigation/2-trigger-list.md` §2 편집 표·§3 PATCH 주석, `spec/data-flow/10-triggers.md` 「정정 (2026-09-18)」 블록 — 이 네 지점을 동시에 건드리는 다른 in-progress plan 없음. `spec-sync-auth-gaps.md`·`spec-sync-external-interaction-api-gaps.md`·`keyset-cursor-uuid-validation.md` 등이 `3-error-handling.md`/`2-trigger-list.md` 를 언급하지만 전혀 다른 행·절(감사 로그 액션명, 인증 관련 오류 코드, cursor 페이지네이션)이라 겹치지 않음.
- 신설 §2.8.1 앵커 번호 — `§2.9.1`(Trigger↔Schedule 동기화) 은 이미 있으나 `§2.8.1` 은 비어 있어 번호 충돌 없음.
- 신설 마이그레이션 번호 V133 — `codebase/backend/migrations/` 최신은 V132, 다른 in-progress plan 이 V133 을 선점하지 않음.
- 선행 완료 draft `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 의 「비대상」 표 「지운 경로의 재등록(묘비)」 행이 정확히 이 트래커 항목으로 이어졌고, 그 draft → 트래커 → 이 target 으로 이어지는 사슬이 문서 간 정합하게 연결됨.
- 신설 FK(`webhook_endpoint_reservation.workspace_id → Workspace ON DELETE SET NULL`)에 부분 인덱스를 두는 설계는 같은 문서의 완료된 Rationale 「쓸 인덱스가 없는 FK 서른하나의 처분」이 세운 원칙(삭제 연쇄가 훑지 않도록 인덱스)과 일치 — 별도 in-progress plan 의 FK 처분 정책과 충돌하지 않음.
- `entity-schema-declaration-drift`/`entity-column-declaration-drift` 등 이 문서의 `code:` e2e 가드 관련 plan 은 이미 `plan/complete/` 로 이동 완료 — in-progress 잔여 항목 없음.

## 요약

target draft 가 닫으려는 트래커 항목(`spec-draft-nullable-notation-followups.md` 의 「지운 웹훅 경로 재등록 — 묘비 부재」)이 남긴 미해결 결정 3건과 실측 필요 1건을 모두 대조했고, target 의 「사용자 결정」·「설계」·「비대상」 절이 충돌 없이 전부 해소한다. target 이 편집을 예고한 5개 spec 파일의 구체적 절·행(§2.8.1 신설 자리, `TRIGGER_ENDPOINT_PATH_CONFLICT` 행, trigger-list §2/§3, data-flow 「정정」 블록, data-model 「남는 틈」 단락)을 동시에 건드리는 다른 in-progress plan 은 없으며, 신설 앵커 번호(§2.8.1)·마이그레이션 번호(V133)도 선점되지 않았다. 유일한 관찰 사항은 선행 트래커 항목이 아직 `[ ]` 로 남아 있다는 점인데, 이는 target 자신의 체크리스트가 이미 예정한 정상적인 draft 진행 순서이지 정합성 결함이 아니다.

## 위험도
NONE
