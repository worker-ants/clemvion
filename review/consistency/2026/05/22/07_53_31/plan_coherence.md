# Plan 정합성 검토 — chat-channel-spec-fix-5fc137

검토 일시: 2026-05-22  
대상 worktree: `.claude/worktrees/chat-channel-spec-fix-5fc137`  
대상 spec 파일 (미스테이지 변경):
- `spec/5-system/15-chat-channel.md`
- `spec/5-system/14-external-interaction-api.md`
- `spec/conventions/chat-channel-adapter.md`
- `spec/4-nodes/7-trigger/providers/telegram.md`

본 변경의 출처 plan:
- `plan/in-progress/spec-fix-chat-channel-security.md` (worktree: `chat-channel-telegram-0c106c`)
- `plan/in-progress/spec-fix-chat-channel-behavior.md` (worktree: `chat-channel-telegram-0c106c`)
- `plan/in-progress/spec-fix-chat-channel-arch.md` (worktree: `chat-channel-telegram-0c106c`)

---

## 발견사항

### [INFO] 출처 plan 의 worktree 선언 vs 실제 편집 worktree 불일치

- target 위치: 세 plan 파일의 frontmatter `worktree: chat-channel-telegram-0c106c`
- 관련 plan: `plan/in-progress/spec-fix-chat-channel-security/behavior/arch.md` 전체
- 상세: 세 출처 plan 은 `worktree: chat-channel-telegram-0c106c` 로 선언되어 있으나, 실제 spec 변경은 `chat-channel-spec-fix-5fc137` worktree 에서 이루어지고 있다. `chat-channel-telegram-0c106c` 는 현재 clean 상태 (미스테이지 변경 없음)이고, 해당 worktree 의 최신 commit 은 code-review 산출물 보관 이후 추가 변경이 없는 것으로 확인됨. 두 worktree 중 어느 한 곳에서만 편집이 진행되고 있으므로 실질적 충돌은 없으나, frontmatter 와 실제 편집 worktree 의 불일치는 추적 모호성을 유발한다.
- 제안: 세 plan 의 frontmatter 를 `worktree: chat-channel-spec-fix-5fc137` 로 갱신하거나, 이 worktree 가 완료 후 plan 을 `complete/` 로 이동할 때 주석으로 명시.

---

### [INFO] 약속된 후속 plan 4건 — plan/in-progress/ 미존재 (정상, 향후 신설 예정)

- target 위치:
  - `spec/5-system/15-chat-channel.md §CCH-SE-03` 주석 + `§4.1 botTokenRef` 주석 — `spec-update-chat-channel-bot-token-stub` 언급
  - `spec/5-system/14-external-interaction-api.md §3.3.1` 말미 — `spec-fix-eia-au-08-type-split` 언급
  - `spec/4-nodes/7-trigger/providers/telegram.md §5.3` phone 행 — `spec-fix-form-phone-validation` 언급
  - `spec/5-system/15-chat-channel.md §R8` 말미 — `chat-channel-dispatcher-split` 언급
- 관련 plan: `plan/in-progress/` 디렉토리 전수 확인 결과 위 4건 모두 미존재
- 상세: 변경 본문에서 "별 plan X 에서 추적"으로 위임한 4건이 아직 in-progress 파일로 신설되지 않음. 이는 "향후 신설 예정" 상태이므로 충돌이 아니라 미이행 약속에 해당. 그러나 4건 모두 미신설 상태로 PR 이 완료되면 추적 항목이 spec 본문에만 존재하고 plan 추적 파일이 없는 상태가 된다.
- 제안: 이 spec PR merge 직후 4건의 stub plan 파일을 in-progress/ 에 신설하는 chore commit 을 별도로 진행하거나, PR 본문에 "후속 plan 신설 필요" 체크리스트로 명시.

---

### [INFO] node-output-redesign form.md 와 spec-fix-form-phone-validation 경계 비중첩 확인

- target 위치: `spec/4-nodes/7-trigger/providers/telegram.md §5.3` — phone validation 미결로 `spec-fix-form-phone-validation` 위임
- 관련 plan: `plan/in-progress/node-output-redesign/form.md`
- 상세: `node-output-redesign/form.md` 는 `spec/4-nodes/6-presentation/4-form.md` 의 output 구조만 다루며, Form field `type` enum 이나 `ValidationRule` schema 에는 손대지 않는다. 본 변경이 예고하는 `spec-fix-form-phone-validation` 의 대상 (`4-form.md §1 type enum` 또는 ValidationRule) 과 영역 분리가 확인됨. 충돌 없음.
- 제안: 없음 (정보 기록).

---

### [INFO] eia-jti-tracking / eia-distributed-seq-counter 의 EIA spec 편집과 본 변경의 관계

- target 위치: `spec/5-system/14-external-interaction-api.md §3.3.1` EIA-AU-08 Implementation Note 추가
- 관련 plan: `plan/in-progress/eia-jti-tracking.md` (worktree: `eia-jti-tracking-<slug>`, 미생성), `plan/in-progress/eia-distributed-seq-counter.md` (worktree: `eia-distributed-seq-<slug>`, 미생성)
- 상세: 두 EIA follow-up plan 은 `spec/5-system/14-external-interaction-api.md` 를 참조하지만 §3.3 EIA-AU-04/EIA-AU-05 및 §8.3, §R7 보강 노트를 대상으로 하며, 본 변경이 다루는 §3.3 EIA-AU-08 + 신규 §3.3.1 절과 영역이 다르다. 두 plan 의 실제 worktree 도 아직 생성되지 않아 동시 편집 경합이 없음. `spec/5-system/14-external-interaction-api.md` 를 공유 대상으로 하므로 향후 두 plan 착수 전 본 PR merge 가 선행되면 충돌 없음.
- 제안: 두 EIA plan 착수 시 rebase 베이스로 본 PR 이 merge 된 main 을 사용할 것.

---

### [INFO] eia-secret-rotation-revoke-api 와 본 변경의 API 영역 비중첩 확인

- target 위치: `spec/5-system/15-chat-channel.md §5.4` `rotate-bot-token` API 응답 계약 신설
- 관련 plan: `plan/in-progress/eia-secret-rotation-revoke-api.md`
- 상세: `eia-secret-rotation-revoke-api` 는 `POST /api/triggers/:id/notification/rotate-secret` 와 `POST /api/triggers/:id/interaction/revoke-token` 을 다루며, 본 변경의 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 과 자원 경로가 분리된다. 두 rotation API 가 같은 trigger 자원에 대한 별도 endpoint 임을 spec §CCH-SE-04 Rationale 에서 이미 명시 ("외부 provider bot token vs HMAC secret" 의미 구분). 중복 없음.
- 제안: 없음 (정보 기록).

---

### [WARNING] spec-fix-chat-channel-behavior 의 CCH-CV-03 running 케이스 — 후속 구현 plan 갱신 누락

- target 위치: `spec/5-system/15-chat-channel.md §3.2 CCH-CV-03` — `running` 상태 처리 분기 추가
- 관련 plan: `plan/in-progress/spec-fix-chat-channel-behavior.md §추적` — "구현 plan 의 HooksService `handleChatChannelWebhook` 업데이트 필요" 언급
- 상세: `CCH-CV-03` 에 `running` 상태 케이스가 spec 에 추가됨에 따라 `HooksService.handleChatChannelWebhook` 의 분기 처리가 필요하다. 그러나 `plan/complete/chat-channel-impl.md` 는 이미 complete 로 이동됐고, 이를 커버하는 별도 구현 plan 이 `in-progress/` 에 없다. 즉 spec 에는 `running` 케이스가 명시됐지만, 구현 추적을 위한 plan 항목이 어디에도 없는 상태.
- 제안: `spec-fix-chat-channel-behavior.md` 의 추적 섹션을 갱신하거나, 별도 구현 follow-up plan (`impl-chat-channel-cv03-running-branch.md` 등)을 신설해 HooksService 업데이트를 추적할 것. 또는 위 §INFO 에서 언급한 후속 stub plan 신설 시 해당 항목에 포함.

---

### [WARNING] 출처 plan 3건이 동일 worktree를 선언하나 실제 적용은 단일 spec-fix worktree 에서 진행

- target 위치: `spec-fix-chat-channel-arch.md`, `spec-fix-chat-channel-behavior.md`, `spec-fix-chat-channel-security.md` frontmatter
- 관련 plan: 세 plan 모두 `worktree: chat-channel-telegram-0c106c` 선언
- 상세: 세 plan 이 하나의 worktree 를 공유 선언하고 있으며, 실제 변경은 별도 `chat-channel-spec-fix-5fc137` 에서 이루어지고 있다. `chat-channel-telegram-0c106c` 는 현재 clean 상태이고 대상 spec 파일을 건드리지 않았지만, worktree 선언이 틀린 상태로 plan 이 남으면 향후 추적자가 `chat-channel-telegram-0c106c` 에서 변경을 찾을 수 있다. plan-lifecycle 규약상 worktree 선언은 실제 편집 worktree 를 가리켜야 한다.
- 제안: 세 plan 의 frontmatter `worktree` 를 `chat-channel-spec-fix-5fc137` 로 교정 후 PR 에 포함하거나, 작업 완료 시 complete 이동 전 주석으로 정정.

---

## 요약

`plan/in-progress/` 의 다른 활성 plan 들 (eia-jti-tracking, eia-distributed-seq-counter, eia-secret-rotation-revoke-api, eia-trigger-edit-ui, parallel-p2, node-output-redesign, 2fa-webauthn-followups 등) 은 본 변경의 네 spec 파일 (`15-chat-channel.md`, `14-external-interaction-api.md`, `chat-channel-adapter.md`, `telegram.md`) 을 동시 편집하지 않으며, 실질적 worktree 경합과 미해결 결정 우회는 없다. 다만 두 가지 WARNING 이 존재한다: (a) CCH-CV-03 `running` 케이스 신설에 따른 구현 추적 plan 이 없어 spec 선행 구현 추적이 끊긴 상태이고, (b) 세 출처 plan 의 frontmatter worktree 선언이 실제 편집 worktree 와 불일치한다. 약속된 후속 plan 4건 (`spec-update-chat-channel-bot-token-stub`, `spec-fix-eia-au-08-type-split`, `spec-fix-form-phone-validation`, `chat-channel-dispatcher-split`) 은 현재 in-progress/ 에 미존재하며 충돌 없이 향후 신설 예정으로 처리 가능하다.

## 위험도

LOW

STATUS: WARNING
