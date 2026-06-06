# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 대상: `spec/7-channel-web-chat` (eager-start §R6 변경)
검토 모드: `--impl-done` (구현 완료 후, diff-base=origin/main)
검토일: 2026-06-06

---

## 전체 위험도

**LOW** — 5개 checker 모두 Critical 없음. WARNING 2건은 런타임 에러 없이 개발자 혼선 유발 수준. 병합 차단 불필요.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | `firstMessage` 식별자 폐기 — spec·M1 구현에서 제거됐으나 `@workflow/sdk` M2 BYO-UI 예제·README에 잔류. 실제 runtime 에러 없으나 M2 개발자 혼선 및 디버깅 낭비 유발 | `codebase/packages/web-chat-sdk/README.md:64`, `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts:34,44` | `spec/7-channel-web-chat/1-widget-app.md §R6` ("firstMessage 메커니즘 폐기"), `spec/7-channel-web-chat/3-auth-session.md §3 step 1` | README M2 BYO-UI 예제 및 `byo-ui-headless.ts`에서 `firstMessage` 제거. `startHeadlessChat` 파라미터 삭제 또는 폐기 주석 명시. 첫 메시지는 `waiting_for_input(ai_conversation)` 수신 후 `interact({ command: "submit_message", ... })` 패턴으로 교체 |
| 2 | convention_compliance | `plan/in-progress/webchat-eager-start.md` PR 커밋 포함 여부 미확인 — spec 3개 파일의 `pending_plans` 가 이 plan 파일을 참조하며, merge 후 `spec-pending-plan-existence.test.ts` guard 실패 위험 | `spec/7-channel-web-chat/0-architecture.md`, `1-widget-app.md`, `3-auth-session.md` frontmatter `pending_plans` | `spec/conventions/spec-impl-evidence.md §4` (`spec-pending-plan-existence.test.ts`) | PR 커밋에 `plan/in-progress/webchat-eager-start.md` 포함 여부 명시적 확인. 누락 시 stage 후 포함 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | EIA §4.1 / webhook §3.1 request body에 `firstMessage` 잔존 여부 경계 확인 필요 | `spec/5-system/14-external-interaction-api.md §4.1`, `spec/5-system/12-webhook.md §3.1` | 해당 스키마에 `firstMessage` 언급이 있으면 제거 또는 "폐기됨 — channel-web-chat §R6 참조" 표기. 현 검토 범위에서는 없는 것으로 판단 |
| 2 | cross_spec | SSE wire 필드명 drift (`nodeId`/`node.id`) — 기존 known-issue, 이번 변경과 무관 | `spec/7-channel-web-chat/0-architecture.md §3` | 별도 backlog(EIA/WS spec 필드명 정합)에서 추적 |
| 3 | cross_spec | `replay_unavailable` 미구현 fallback — 기존 known-issue | `spec/7-channel-web-chat/1-widget-app.md §3.1` | EIA-NF-03 연계 TODO로 이미 추적 중 |
| 4 | rationale_continuity | `start()` 공개 actions 노출 경계 모호 — I3 주석으로 "하위 호환 유지" 명시됐으나 spec Rationale 부재 | `codebase/channel-web-chat/src/widget/use-widget.ts` | `2-sdk §5 ChatInstance` 미포함 내부 메서드이므로 즉각 충돌 없음. 필요시 `1-widget-app §R6` 또는 코드 주석에 한 줄 근거 추가 |
| 5 | rationale_continuity | C1 flush — buttons/form 첫 노드 시 launcher 버블 탭 텍스트 폐기 동작의 Rationale 미명시 | `codebase/channel-web-chat/src/widget/use-widget.ts` C1 flush effect | `1-widget-app §R6` 또는 spec §3에 "buttons/form 첫 노드 시 launcher 버블 텍스트 조용히 폐기" 동작 및 근거 한 줄 추가 권장 |
| 6 | rationale_continuity | `pending=null + awaiting_user_message` transient race window — spec 상태기계 다이어그램 미명시 | `codebase/channel-web-chat/src/widget/components/panel.tsx` Composer disabled 조건 | spec §3 또는 주석에 해당 transient 상태 한 줄 명시 권장. 테스트가 이미 커버 중 |
| 7 | convention_compliance | `id` 값이 파일 basename 과 불일치 (`web-chat-*` vs `0-*` 패턴) — 권장 사항, 강제 아님 | `spec/7-channel-web-chat/` 전체 frontmatter | 이번 PR 범위에서 수정 불필요. 기존부터 일관된 패턴으로 유지 |
| 8 | plan_coherence | `fix-webchat-sse-field-map.md` — PR #491 MERGED, `pending_plans` 잔존은 plan-lifecycle 정합(비차단 followup 미완료) | `spec/7-channel-web-chat/0-architecture.md` frontmatter | 해당 plan followup 완료 후 `pending_plans` 동시 제거 |
| 9 | naming_collision | `§R6` Rationale ID 동일 영역 내 중복 — `0-architecture.md §R6`와 `1-widget-app.md §R6` 공존 | `spec/7-channel-web-chat/0-architecture.md §R6`, `spec/7-channel-web-chat/1-widget-app.md §R6` | 코드 주석에서 이미 `1-widget-app §R6` 풀네임으로 참조 중. 차후 spec 정리 시 `0-architecture.md §R6`를 §R9 등으로 재번호화 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | AI Agent §6.2, EIA §5.2, EIA-IN-02, 데이터 모델, CORS 정책 모두 정합. `firstMessage` EIA/webhook 스키마 경계 확인 권장 |
| rationale_continuity | LOW | lazy→eager 번복(§R6) Rationale 완전 문서화. `3-auth-session §3` 교차 참조 정합. INFO 3건(start 노출, C1 flush 폐기, pending=null transient) |
| convention_compliance | LOW | frontmatter 구조 정합. 신규 테스트 파일 명명 규약 준수. WARNING 1건(`webchat-eager-start.md` PR 포함 확인) |
| plan_coherence | NONE | CRITICAL·WARNING 없음. stale worktree 1건(`fix-webchat-sse-field-map-22cd94`) 정상 skip. 미완 체크박스는 followup 명시 위임됨 |
| naming_collision | LOW | 대부분 식별자 정합. WARNING 1건(`@workflow/sdk` M2 예제의 `firstMessage` 잔류). R6 ID 중복은 INFO 수준 |

---

## 권장 조치사항

1. **(WARNING W1 — 우선)** `codebase/packages/web-chat-sdk/README.md`와 `examples/byo-ui-headless.ts`에서 `firstMessage` 사용 제거. `startHeadlessChat` 시그니처 갱신 또는 폐기 주석 명시. 첫 메시지 전송 패턴을 `interact({ command: "submit_message", ... })`로 교체하는 예제로 갱신.
2. **(WARNING W2 — PR 병합 전)** PR 커밋 목록에 `plan/in-progress/webchat-eager-start.md`가 포함됐는지 확인. 누락 시 stage 후 포함.
3. **(INFO I1 — 경계 확인)** `spec/5-system/14-external-interaction-api.md §4.1` 및 `spec/5-system/12-webhook.md §3.1`에서 `firstMessage` request body 필드 언급 여부 확인. 있으면 제거 또는 폐기 표기.
4. **(INFO I5 — 선택적)** `1-widget-app §R6`에 "buttons/form 첫 노드 시 launcher 버블 텍스트 폐기" 동작 및 근거 한 줄 추가.
5. **(INFO I9 — 차후)** `spec/7-channel-web-chat/0-architecture.md §R6`를 §R9 등으로 재번호화해 동일 영역 내 §R6 중복 해소.