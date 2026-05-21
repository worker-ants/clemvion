# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel.md`
검토 모드: `--spec` (spec draft 검토)
검토 기준: `plan/in-progress/**` 전체 (2026-05-21 시점)

---

## 발견사항

### 1. [WARNING] `eia-secret-rotation-revoke-api.md` 의 미결 결정과 target 의 CCH-SE-04 grace 기간 잠재 충돌

- **target 위치**: §3.2 CCH-SE-04 — "old token 은 24h grace 동안 병행 받음"
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` §"결정 사항 (사용자 합의 필요)" — "rotation grace 기간: 24h (spec default) 그대로 / 사용자가 trigger 별 조정 가능하게 / 짧게 줄임 (예: 1h)" 가 **미결**
- **상세**: target 은 bot token rotation grace 를 24h 로 확정해 spec 에 명시했다. 그러나 `eia-secret-rotation-revoke-api` 는 아직 EIA notification secret 의 grace 기간을 24h 로 할지 단축할지 사용자 합의를 기다리고 있다. 두 grace 기간은 서로 다른 자원(EIA notification HMAC secret vs. Telegram bot token)이어서 직접 충돌은 아니다. 그러나 사용자가 EIA rotation grace 를 최종적으로 "1h" 로 결정하면, 같은 trigger entity 위에 24h grace 정책(bot token)과 1h grace 정책(HMAC secret)이 공존해 운영자 혼란 가능성이 생긴다. target 은 이 불일치 가능성을 Rationale 에서 다루지 않았다.
- **제안**: target 의 CCH-SE-04 Rationale 에 "EIA notification secret grace 기간(미결 — `eia-secret-rotation-revoke-api` plan)과 의도적으로 별도 정책임을 명시, 결정 후 재검토" 한 줄 추가. 또는 `eia-secret-rotation-revoke-api` plan 의 결정 사항 체크박스에 "Chat Channel bot token grace (24h 확정)와 비교 검토" 메모 추가.

---

### 2. [WARNING] `eia-trigger-edit-ui.md` 의 Trigger 드로어 UI 작업 범위와 target 의 WH-MG-09 / chatChannel 설정 패널 요구 중복 우려

- **target 위치**: §11 §PR-A 동반 작업 — "`spec/2-navigation/2-trigger-list.md` 의 트리거 상세 드로어 spec 에 `chatChannel` 설정 패널 + `chatChannelHealth` 배지 추가" + §10 NOTE 참조
- **관련 plan**: `plan/in-progress/eia-trigger-edit-ui.md` — Trigger 상세 드로어의 Notification/Interaction 섹션을 read-only → edit 모드 토글로 개발 중 (worktree: `eia-trigger-edit-ui-<slug>`, 미착수)
- **상세**: `eia-trigger-edit-ui` 는 Trigger 드로어의 EIA 설정 UI 를 주 작업 범위로 한다. target 의 PR-A 는 같은 트리거 상세 드로어 spec(`spec/2-navigation/2-trigger-list.md`) 에 `chatChannel` 설정 패널과 `chatChannelHealth` 배지를 추가하도록 명시한다. 두 plan 이 동일 spec 파일(`spec/2-navigation/2-trigger-list.md`)과 동일 UI 컴포넌트(Trigger 드로어)를 동시에 손댈 경우 spec 편집 경합 및 프론트엔드 컴포넌트 충돌 위험이 있다. target 의 §11.1 인지 사항에 `eia-trigger-edit-ui` 언급이 있으나, 구체적인 작업 직렬화 방침(어느 plan 이 먼저 `spec/2-navigation/2-trigger-list.md` 를 편집하는지, 또는 동일 PR 에서 처리하는지)이 명시되지 않았다.
- **제안**: target `§11 PR-A` 설명에 "`eia-trigger-edit-ui` plan 이 먼저 머지된 후 chatChannel 패널을 드로어 spec 에 추가하거나, 동일 worktree/PR 내에서 일괄 처리" 방침을 명시. `eia-trigger-edit-ui.md` plan 에도 대칭적으로 "Chat Channel 패널 추가(spec-draft-chat-channel PR-A)와 드로어 spec 편집 순서 조율 필요" 메모 추가.

---

### 3. [WARNING] `spec/1-data-model.md` 동시 편집 잠재 위험 — `spec-overview-followups-2026-05-18.md` §1 과 target §2.6

- **target 위치**: §2.6 — `spec/1-data-model.md §2.8 Trigger 필드 표` 에 `chat_channel_*` 컬럼 5개 추가
- **관련 plan**: `plan/in-progress/spec-overview-followups-2026-05-18.md` §1 — `spec/1-data-model.md §2.6` Node.type enum 에 `filter` 추가 (worktree: `spec-data-model-filter-<slug>`, 미착수)
- **상세**: 두 plan 이 동일 파일 `spec/1-data-model.md` 를 수정한다. target 은 §2.8(Trigger 필드)을, `spec-overview-followups` §1 은 §2.6(Node.type enum)을 편집 대상으로 한다. 섹션 자체는 달라 직접 충돌 가능성은 낮지만, 두 worktree 가 동시에 같은 파일을 편집하면 git merge 시 context 충돌이 발생할 수 있다. 또한 target 의 worktree `chat-channel-telegram-0c106c` 는 이미 존재하는 반면, `spec-overview-followups` §1 은 worktree slug 가 `<TBD>` 상태이므로 아직 착수 전이다.
- **제안**: target 의 §2.6 변경 전, `spec-overview-followups-2026-05-18.md` §1 의 `spec/1-data-model.md §2.6` 작업이 착수/완료 상태인지 확인. 아직 미착수라면 target PR 이 먼저 `spec/1-data-model.md §2.8` 수정을 완료·머지한 후 `spec-overview-followups` §1 이 그 위에서 §2.6 을 편집하도록 순서 명시 권장.

---

### 4. [WARNING] `eia-jti-tracking.md` 미결 결정이 target 의 EIA-AU-08 토큰 우회 경로에 후속 영향

- **target 위치**: §3.5 Identity/보안 — `InteractionService.interact()` in-process 호출로 토큰 발급/검증 우회, `EIA-AU-08` 예외 근거
- **관련 plan**: `plan/in-progress/eia-jti-tracking.md` — iext JTI blacklist 인프라 도입 미결 (저장소 선택: execution_token 테이블/Redis SET/Execution 컬럼 중 미결, worktree `eia-jti-tracking-<slug>`)
- **상세**: target 은 어댑터가 EIA 토큰 발급을 우회해 `InteractionService.interact()` 를 직접 호출한다고 명시한다. `eia-jti-tracking` 은 terminal event 발생 시 execution 의 모든 iext JTI 를 blacklist 에 즉시 등록하는 인프라를 도입하는 plan 이다. 어댑터가 in-process 경로를 사용하기 때문에 iext JTI 자체를 발급하지 않으므로, JTI blacklist 인프라의 도입 여부가 어댑터 동작에는 직접 영향을 주지 않는다. 그러나 `eia-jti-tracking` 의 저장 위치 결정(특히 `execution_token` 테이블 신설)이 Flyway migration 슬롯을 소비한다. target 의 §3.4.2 도 같은 Flyway migration 슬롯 예약이 필요(I4 메모)하므로 두 plan 의 migration 슬롯 번호 예약 순서가 충돌할 가능성이 있다.
- **제안**: target §11 PR-A 의 "사전 의무: Flyway 마이그레이션 슬롯 번호를 `spec/conventions/migrations.md` 에서 예약" 시점에 `eia-jti-tracking` plan 의 migration 슬롯 예약 여부를 함께 확인하도록 체크리스트에 추가.

---

### 5. [INFO] `eia-distributed-seq-counter.md` 미결 사용자 결정과 target 의 seq dedup 가정

- **target 위치**: §3.6 EIA 와의 관계 표 — "seq 정렬·`X-Clemvion-Delivery` dedup 은 어댑터 코드 안에 내장"
- **관련 plan**: `plan/in-progress/eia-distributed-seq-counter.md` — 분산 환경에서 seq counter 를 Redis INCR 또는 DB row-level lock 으로 강화할지 미결 (사용자 결정 필요: 운영 환경 single/multi-instance)
- **상세**: target 은 어댑터가 EIA 의 `seq` 를 단순 dedup 으로만 사용하며 `seq` 가 in-memory 든 Redis INCR 든 무관하다고 §11.1 에 명시하고 있다. 이는 정확하다. 단, `eia-distributed-seq-counter` 의 결정에 따라 `emitExecutionEvent` 가 async 로 전환될 경우 어댑터의 EventEmitter listener 가 동시 async 호출을 받는 시나리오를 고려했는지 불분명하다. 직접 차단 요인은 아니다.
- **제안**: target §3.3 처리 흐름 다이어그램 주석에 "seq counter 가 async 로 전환되어도 EventEmitter listener 로 도착하는 시점의 seq 는 이미 확정된 값이므로 어댑터 동작에 영향 없음" 한 줄 추가 (추적 메모 수준).

---

### 6. [INFO] `eia-secret-rotation-revoke-api.md` 미결 API 와 target 의 CCH-SE-04 endpoint 경로 표기

- **target 위치**: §3.2 CCH-SE-04 — `POST /api/triggers/:id/chat-channel/rotate-bot-token`
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` §2.백엔드 API — `POST /api/triggers/:id/notification/rotate-secret`, `POST /api/triggers/:id/interaction/revoke-token`
- **상세**: target 은 §10 (영향받지 않는 영역) 에서 "동사를 `rotate-bot-token` 으로 명시화한 이유는 EIA 의 `rotate-secret` 과 의미가 다른 자원임을 URL 만으로 식별 가능하게 하기 위함" 으로 네이밍 근거를 기록했다. `spec/2-navigation/2-api-convention.md` 충돌 없이 동일 RPC 스타일 패턴을 채택한다는 것도 §10 에 확인되어 있다. 정합 문제 없음. 다만 세 endpoint 가 같은 trigger 자원 아래 서로 다른 prefix(`notification/`, `interaction/`, `chat-channel/`)를 갖게 되므로, EIA API endpoint 설계 표가 완성될 때 세 endpoint 를 한 곳에서 열거하는 섹션이 `spec/5-system/14-external-interaction-api.md` 에 필요할 수 있다.
- **제안**: INFO 추적용. target 의 CCH-SE-04 Rationale 은 충분하며 별도 spec 수정 불요. `eia-secret-rotation-revoke-api` 완료 시점에 14-EIA spec 의 endpoint 목록 섹션에 세 endpoint 를 함께 정리하는 TODO 를 해당 plan 에 추가하면 좋다.

---

### 7. [INFO] `spec-draft-chat-channel.md` 자체 worktree 와 진행 중 EIA plan worktree 간 실제 파일 경합 없음 확인

- **target 위치**: frontmatter `worktree: chat-channel-telegram-0c106c`
- **관련 plan**: `eia-trigger-edit-ui.md` (`eia-trigger-edit-ui-<slug>`), `eia-secret-rotation-revoke-api.md` (`eia-secret-rotation-<slug>`), `eia-jti-tracking.md` (`eia-jti-tracking-<slug>`), `eia-distributed-seq-counter.md` (`eia-distributed-seq-<slug>`)
- **상세**: EIA 관련 4개 plan 의 worktree slug 가 모두 `<slug>` placeholder 상태로, 아직 실제 worktree 가 생성되지 않았다. 따라서 현재 시점에서 파일 시스템 레벨의 실제 worktree 충돌은 없다. target 의 worktree `chat-channel-telegram-0c106c` 는 이미 존재하며 spec 파일 작업 중.
- **제안**: EIA follow-up plan 들이 worktree 를 실제 생성하는 시점에, 이번 target spec draft 가 수정한 `spec/5-system/14-external-interaction-api.md`, `spec/5-system/12-webhook.md`, `spec/1-data-model.md` 가 이미 main 에 머지된 후인지 확인. 머지 전이라면 해당 spec 파일에 대한 편집 경합 가능성 재검토.

---

## 요약

`spec-draft-chat-channel.md` 는 전반적으로 잘 설계된 draft 이며, 기존 in-progress plan 들과의 결정 사항 우회나 직접 충돌하는 사안은 발견되지 않았다. 다만 두 가지 WARNING 이 주의를 요한다. 첫째, `eia-trigger-edit-ui` plan 이 같은 Trigger 드로어 spec 파일(`spec/2-navigation/2-trigger-list.md`)을 손대는 계획을 갖고 있어 PR-A 착수 전 작업 직렬화 또는 통합 방침을 plan 양쪽에 명시해야 한다. 둘째, `spec/1-data-model.md` 를 `spec-overview-followups-2026-05-18` §1 이 동일하게 편집 예정이므로 머지 순서 조율이 필요하다. `eia-secret-rotation-revoke-api` 의 grace 기간 미결 결정은 target 의 bot token 24h grace 와 운영 일관성 관점에서 추적이 필요하나 spec 반영을 차단하는 수준은 아니다. EIA 관련 4개 follow-up plan 의 worktree 는 모두 미착수 상태여서 현재 실제 파일 경합은 없다.

## 위험도

MEDIUM
