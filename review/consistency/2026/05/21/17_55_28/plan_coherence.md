# Plan 정합성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-chat-channel.md`  
**검토 모드**: spec draft 검토 (--spec)  
**검토 일시**: 2026-05-21

---

## 발견사항

### [INFO] EIA follow-up plan 들과의 작업 영역 인지 필요 — 동시 spec 편집 없음, 그러나 EIA spec 교차 읽기

- **target 위치**: §7 "14-EIA.md 개정 핵심" 전반, §3.6 "EIA 와의 관계 단일 표 SoT"
- **관련 plan**: `plan/in-progress/eia-trigger-edit-ui.md` / `plan/in-progress/eia-distributed-seq-counter.md` / `plan/in-progress/eia-jti-tracking.md` / `plan/in-progress/eia-secret-rotation-revoke-api.md` / `plan/in-progress/eia-sdk-publish.md`
- **상세**: 상기 5개 EIA follow-up plan 들은 모두 `spec/5-system/14-external-interaction-api.md` 를 **구현** 근거로 참조하지만, spec 파일 자체를 수정하는 작업은 해당 plan 들 어느 것에도 명시되어 있지 않다 (구현 변경 → `codebase/backend/` 범위). target plan 이 EIA spec 의 §2 시나리오 표와 §R10 Rationale 을 개정하는 것은 그 EIA follow-up plan 들의 구현 착수 전에 정합화가 이루어지는 형태이므로 충돌이 아니다. 다만 `eia-sdk-publish.md §"외부 통합 partner 가이드"` 가 `spec/5-system/14-external-interaction-api.md` 에 SDK 설치/사용 cross-link 절을 추가할 계획을 담고 있어, target 의 §2 시나리오 표 개정과 같은 spec 파일을 미래에 손댈 예정임을 인지해야 한다. 현재는 충돌이 아니며 순서 의존성도 없다.
- **제안**: 별도 조치 불필요. target plan 의 §9 "consistency-check 호출 계획" cross-spec-checker 항목에 EIA SDK cross-link 절 (eia-sdk-publish §4) 과의 미래 교차 가능성을 INFO 로 메모하면 충분.

---

### [INFO] `eia-secret-rotation-revoke-api.md` 미해결 결정과 target 의 CCH-SE-04 권장 요구사항 간 간접 연관

- **target 위치**: §3.2 요구사항 `CCH-SE-04` — "Bot token rotation API (`POST /api/triggers/:id/chat-channel/rotate-token`) — old token 은 24h grace 동안 병행 받음"
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` §"결정 사항 (사용자 합의 필요)" — rotation grace 기간(24h / 사용자 별 조정 / 단축) 및 rotate 응답 shape 이 아직 "결정 필요" 상태
- **상세**: EIA notification secret rotation 의 grace 기간이 미결인 상태에서 target 이 chatChannel bot token rotation grace 를 독자적으로 "24h" 로 명시하고 있다. 두 rotation 정책이 서로 다른 layer 이고 (bot token vs. notification HMAC secret) target spec 에 "R-F. botToken secret store reference 정책" 에서 EIA §7.1 과 동일 패턴임을 명시하고 있으므로, EIA 쪽 grace 기간 결정과 target 쪽 24h 가 미래에 정합되어야 할 수 있다. 현재 target 이 일방적으로 24h 를 확정하는 것은 "결정 필요" 항목을 우회하는 수준이라기보다 독립적 결정이다. 단 EIA rotation grace 결정이 완료될 때 CCH-SE-04 와의 일관성을 재검토하는 후속이 필요하다.
- **제안**: target plan 의 §11 "후속 plan" 또는 §8 "Rationale R-F" 에 "EIA secret rotation grace 기간 결정(eia-secret-rotation-revoke-api.md) 완료 후 CCH-SE-04 의 24h 재검토" 를 INFO 메모로 추가 권장.

---

### [INFO] `eia-trigger-edit-ui.md` 가 Trigger 상세 드로어에 chatChannel 관련 UI 를 다루어야 함 — 누락 가능성

- **target 위치**: §6.2 `WH-MG-09` — "트리거 상세 화면에 `chatChannelHealth` 표시 (unknown / healthy / degraded)"
- **관련 plan**: `plan/in-progress/eia-trigger-edit-ui.md` §1 "UI 컴포넌트" — Notification 섹션 / Interaction 섹션 수정 UI만 명시. `chatChannel` 섹션에 대한 언급 없음.
- **상세**: target 이 Trigger 상세 화면에 `chatChannelHealth` 표시 (`WH-MG-09`, "권장") 와 chatChannel 편집 UI 를 새로 요구하는데, `eia-trigger-edit-ui.md` 가 담당하는 Trigger 상세 드로어 구현 plan 에 chatChannel 섹션(botTokenRef 입력, provider 선택, health 표시 등)이 포함되지 않았다. target spec 이 확정된 후에 `eia-trigger-edit-ui.md` 에 chatChannel UI 작업을 추가하지 않으면 Trigger 드로어의 chatChannel 편집 경로가 후속 PR 에서 누락될 수 있다.
- **제안**: target plan 의 §11 "후속 plan" 의 PR-A 또는 PR-E 설명에 "Trigger 상세 드로어 chatChannel 섹션 (eia-trigger-edit-ui plan 에 chatChannel 영역 추가 필요)" 를 명시. 또는 `eia-trigger-edit-ui.md` 에 chatChannel UI 작업 항목을 선제적으로 추가.

---

### [INFO] target 의 신규 DB 컬럼 (`chat_channel_*`) 이 EIA follow-up plan 들의 migration 슬롯과 충돌 가능

- **target 위치**: §3.4.2 신규 컬럼 — `ALTER TABLE trigger ADD COLUMN chat_channel_health ...` 등 5개 컬럼
- **관련 plan**: `plan/in-progress/eia-jti-tracking.md` §2 Migration — "V0XX (V059 다음 슬롯) — `execution_token` 테이블 신설"
- **상세**: target 이 `Trigger` 테이블에 5개 컬럼을 추가하는 migration 이 필요하고, `eia-jti-tracking.md` 도 migration 슬롯 (`V059` 다음) 을 사용할 예정이다. migration 번호가 충돌하면 적용이 실패하므로 두 plan 이 같은 시기에 PR 을 올릴 경우 슬롯 조율이 필요하다. 다만 target 은 현재 spec draft 단계이고 구현 PR 은 추후 (PR-A~PR-E) 이므로, EIA jti tracking 이 먼저 merge 된 후 그 다음 슬롯을 사용하면 자동 해소된다.
- **제안**: target plan §11 "후속 plan" 의 PR-A 설명에 "migration 번호는 eia-jti-tracking, eia-secret-rotation 등 진행 중인 EIA PR 이 먼저 merge 된 후 그 다음 슬롯을 사용할 것" 을 조건으로 명시.

---

### [WARNING] `spec/5-system/12-webhook.md` 에 대한 동시 수정 경합 — worktree 는 다르지만 같은 파일을 손댈 계획을 가진 다른 plan 존재 여부 확인 필요

- **target 위치**: §6 "12-webhook.md 개정 핵심" — `§2.2 config` 필드 추가, `§3.4` 관리 표에 `WH-MG-08/09` 행 추가, Rationale 갱신
- **관련 plan**: `plan/in-progress/spec-followup-cron-7d-statemachine.md` — `spec/5-system/4-execution-engine.md` 및 cafe24 통합 관련 spec 파일을 수정하지만 `12-webhook.md` 는 직접 건드리지 않음. 그러나 `eia-trigger-edit-ui.md` 가 `spec/5-system/14-external-interaction-api.md` 의 §4 + §10.1 을 참조해 구현하는데 spec 변경을 할 가능성이 있음.
- **상세**: 현재 in-progress plan 중 `spec/5-system/12-webhook.md` 를 명시적으로 수정하겠다는 plan 은 확인되지 않는다. target 의 `chat-channel-telegram-0c106c` worktree 와 다른 EIA worktree (`eia-trigger-edit-ui-<slug>` 등) 의 slug 가 다르므로 worktree 직접 충돌은 없다. 다만 `eia-trigger-edit-ui` 가 spec 변경까지 포함할 경우 (현재는 frontend 구현만 명시되어 있으나 불명확) `spec/5-system/14-external-interaction-api.md` 와 `12-webhook.md` 에 간접 경합이 생길 수 있다.
- **제안**: target plan §9 "consistency-check 호출 계획" 의 plan-coherence-checker 항목 설명을 완료한 현재 시점 기준 위험도 LOW. `eia-trigger-edit-ui.md` 가 spec 파일을 건드리지 않음을 확인했으므로 현재는 경합 없음. target 이 `spec/5-system/12-webhook.md` 와 `spec/5-system/14-external-interaction-api.md` 를 수정하는 PR 을 진행할 때 해당 EIA follow-up PR 들과 머지 순서를 확인할 것.

---

### [INFO] target 이 가정하는 `EIA-NX-*` / `EIA-IN-*` / `EIA-AU-*` 의 구현 상태 — 선행 조건 확인

- **target 위치**: §3.6 "EIA 와의 관계 단일 표 SoT" — EIA-NX-*, EIA-IN-*, EIA-AU-*, EIA-RL-*, EIA-NF-* 전체를 완료된 기반으로 가정
- **관련 plan**: `plan/complete/external-interaction-api.md` (완료됨, PR #230 머지), EIA follow-up plan 들은 소규모 강화(seq counter, jti tracking, rotation API 등)
- **상세**: target 이 전제하는 EIA 핵심 기능 (outbound notification, inbound interact, 인증 family 등) 은 PR #230 으로 머지 완료된 상태이다. EIA follow-up plan 들은 강화/보완이지 핵심 변경이 아니므로, target 이 EIA 를 "완성된 기반"으로 가정하는 것은 적절하다. 선행 조건 미해소 이슈 없음.
- **제안**: 조치 불필요.

---

### [INFO] `spec/4-nodes/7-trigger/providers/` 서브디렉토리 신설 — 다른 plan 이 `spec/4-nodes/7-trigger/` 를 수정하고 있는지 확인

- **target 위치**: §2.3 신설 `spec/4-nodes/7-trigger/providers/telegram.md`, §8 Rationale R-G
- **관련 plan**: 검토한 in-progress plan 중 `spec/4-nodes/7-trigger/` 를 수정하는 plan 없음 확인
- **상세**: `spec/4-nodes/7-trigger/providers/` 는 신규 서브디렉토리로 기존 파일과 충돌 없음. worktree 경합 없음.
- **제안**: 조치 불필요.

---

## 요약

target plan `spec-draft-chat-channel.md` 는 `plan/in-progress/` 의 현재 진행 중 plan 들과 CRITICAL 또는 심각한 WARNING 수준의 충돌이 없다. EIA 관련 5개 follow-up plan (`eia-trigger-edit-ui`, `eia-distributed-seq-counter`, `eia-jti-tracking`, `eia-secret-rotation-revoke-api`, `eia-sdk-publish`) 은 모두 spec 파일을 직접 수정하지 않는 구현 범위 plan 이거나 결정 대기 상태이므로 spec draft 단계에서 경합하지 않는다. 주의가 필요한 지점은 세 가지다: (1) Trigger 상세 드로어의 chatChannel 편집 UI 가 `eia-trigger-edit-ui` plan 에 아직 반영되지 않아 구현 단계에서 누락될 수 있음, (2) EIA notification secret rotation grace 기간(현재 미결)과 target 의 CCH-SE-04 24h 가 나중에 정합 재검토가 필요할 수 있음, (3) 구현 단계에서 migration 슬롯 번호가 EIA jti-tracking 등과 경합할 수 있으므로 순서 조율이 필요하다. 이 세 항목 모두 INFO 수준이며, spec draft 의 consistency-check 통과를 차단하는 사유는 없다.

## 위험도

LOW
