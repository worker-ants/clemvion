# Plan 정합성 검토 — target `spec/2-navigation/` (--impl-prep)

## 발견사항

- **[INFO]** 선행 트래커 항목이 아직 `[ ]` 로 남아 있음 — 정상적인 draft 진행 순서
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 `endpointPath` 행 · §3 PATCH 註 (`(endpoint_path)` UNIQUE … **또는 다른 워크스페이스가 예약한 경로** … [데이터 모델 §2.8.1])
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4644-4649` 「지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다 — 묘비(tombstone) 부재」(미체크 `[ ]`) · `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`(체크리스트 마지막 두 줄 미완)
  - 상세: target(`2-trigger-list.md`, `1-data-model.md §2.8.1`, `12-webhook.md`, `3-error-handling.md`, `data-flow/10-triggers.md`)은 이미 `spec-draft-webhook-endpoint-reservation.md`(worktree `webhook-tombstone-de5b5f`, 본 세션과 동일)의 「변경 A~E」를 그대로 반영해 커밋됐다(`c8dd613e0`). 그 plan 이 닫으려는 트래커 항목(`spec-draft-nullable-notation-followups.md:4644`)이 남긴 「결정할 것」 4가지 — ① 보존 기간(영구 vs 기간), ② 저장 위치(soft-delete 행 vs 별도 테이블), ③ 경로 변경 시 옛 경로 처리, ④ 실측 필요(수신 404 로그) — 를 대조하면, plan 의 「사용자 결정 (2026-09-19)」·「설계」·「비대상」 절이 넷 다 명시적으로 해소했고 target 텍스트는 그 결정과 정확히 일치한다(임의로 다른 결정을 내리지 않았다). 다만 트래커 원문(`nullable-notation-followups.md:4644`)과 plan 자신의 체크리스트(구현·트래커 해소)는 아직 미완 상태다 — 이는 target 이 앞서고 구현·트래커 갱신이 뒤따르는 정상적인 spec-first 순서이며 target 이 우회한 미해결 결정은 없다.
  - 제안: 별도 조치 불필요. `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 체크리스트에 이미 명시된 대로, 구현(V133 마이그레이션·엔티티·서비스 409 매핑·e2e) 완료 후 같은 PR 에서 트래커 4644행을 `[x]` + 해소 문구로 갱신하고 draft 를 `plan/complete/` 로 이동하는지만 후속 세션에서 확인.

## 교차 확인한 항목 (충돌 없음)

- **선행 조건 충족**: target 이 전제하는 `(endpoint_path)` 전역 UNIQUE(V132)는 이미 `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 로 완료돼 있고, 그 draft 의 「비대상」 표가 「지운 경로의 재등록(묘비)」를 정확히 지금의 트래커 항목으로 넘겼다 — draft→트래커→현재 target 으로 이어지는 사슬이 끊김 없이 연결된다.
- **동시 편집 대상 미충돌**: target 이 건드린 5개 spec 지점(§2.8.1 신설, `TRIGGER_ENDPOINT_PATH_CONFLICT` 행, `2-trigger-list.md` §2/§3, `data-flow/10-triggers.md` 「정정」 블록, `1-data-model.md` 「남는 틈」 단락)을 동시에 편집 대상으로 삼는 다른 in-progress plan 은 없다. `spec-sync-auth-gaps.md`(감사 액션명 `trigger.delete`→`trigger.deleted` 등)와 `keyset-cursor-uuid-validation.md` 등이 같은 파일을 언급하지만 전혀 다른 행·절이며, 전자는 이미 `[x]` 완료로 표기돼 있고 target 현재 §4.1 텍스트("`trigger.deleted`")도 그 정정을 이미 반영한 상태라 재충돌이 없다.
- **엔티티 선언 전제 충족**: 신설 FK `webhook_endpoint_reservation.workspace_id → Workspace` 가 참조할 `trigger.workspace_id` 컬럼은 최근 완료된 `entity-column-declaration-drift`(#1358, 커밋 `6f9c0f1c1`)가 고친 uuid 선언 누락 5곳에 포함되지 않는다 — 이미 올바르게 `uuid` 로 선언돼 있어 신규 마이그레이션이 잘못된 컬럼 타입을 전제하지 않는다.
- **웹챗 cross-reference**: plan 의 「왜」 절이 인용하는 `spec/7-channel-web-chat/5-admin-console.md`(공개 UUID 노출 위험 서술)는 `spec_impact`/target 변경 범위에 없으나, 신규 예약 메커니즘은 트리거·`endpoint_path` 계층에서 범용으로 동작해 webchat 전용 텍스트 수정을 요구하지 않는다 — 관련 in-progress plan 중 그 문서의 후속 항목을 다루는 것도 없다(전수 grep 확인, 매치 0건).

## 요약

target(`spec/2-navigation/2-trigger-list.md` 등 5개 spec)은 같은 worktree 의 `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 가 설계한 웹훅 경로 영구 예약 기능을 정확히 반영해 이미 커밋된 상태이며, 그 plan 이 닫으려는 선행 트래커(`spec-draft-nullable-notation-followups.md`)의 미해결 결정 4건을 우회 없이 전부 해소했다. 선행 plan(전역 UNIQUE V132, 컬럼 선언 드리프트)은 이미 완료돼 전제 조건이 충족돼 있고, target 이 건드리는 지점을 동시에 다루는 다른 in-progress plan 도 없다. 유일한 관찰 사항은 트래커 체크박스·plan 자신의 구현/트래커-해소 체크리스트가 아직 미완이라는 점인데, `--impl-prep`(구현 착수 전) 시점 기준으로는 정상적인 순서이지 정합성 결함이 아니다.

## 위험도
NONE
