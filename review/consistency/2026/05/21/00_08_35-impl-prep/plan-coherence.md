# Plan 정합성 검토 결과 — PR2 구현 착수 직전

검토 일시: 2026-05-21  
검토 대상 worktree: `impl-external-interaction-api-31801c`  
검토 대상 plan: `plan/in-progress/external-interaction-api.md`  
검토 기준: `plan/in-progress/**` 전체

---

## 발견사항

### [CRITICAL] Migration V059 — external-interaction-api (PR2) 와 replay-rerun 동시 선점

- **target 위치**: `external-interaction-api.md` Phase 분할안 표 P1 행 — "Migration V059 (Trigger 4컬럼)"
- **관련 plan**: `plan/in-progress/replay-rerun.md` §3 Backend 구현 — "V057·V058 은 `plan/in-progress/2fa-webauthn.md` 가 선점 — 본 plan 착수 시 max(V) 재확인 후 **V059 이후** 사용"
- **상세**: 현재 DB 최신 마이그레이션은 `V058__login_history_webauthn_failed_event.sql`. PR2 는 V059 를 Trigger 4컬럼 마이그레이션으로 명시해 사용한다. replay-rerun 도 "V059 이후" 를 선점 번호로 가정하고 있어, 두 plan 이 V059 를 동시에 요구하는 상태다. 둘 중 먼저 머지되는 쪽이 V059 를 차지하면 나머지 쪽은 V060 이상으로 번호를 올려야 한다.
- **제안**: PR2 plan 에 "V059 = Trigger migration, replay-rerun 은 V060 이상 사용" 을 명시하거나, replay-rerun plan 의 "V059 이후" 문구를 "PR2 머지 후 max(V)+1 재확인" 으로 갱신한다. 두 plan 중 어느 쪽이 먼저 착수·머지되는지를 0-unimplemented-overview.md 에 순서 의존성으로 기록하는 것이 안전하다.

---

### [WARNING] `ai-agent-tool-connection-rewrite.md` — SSE 페이로드 `tool_call_*.name` 영향 추적 체크박스 미반영

- **target 위치**: `external-interaction-api.md` Follow-up 절 항목 `(Plan W-1)` — "체크박스 추가" 가 TODO 로만 남아 있고 실제 `plan/in-progress/ai-agent-tool-connection-rewrite.md` 에는 해당 체크박스가 없음
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 Spec 작성 — "도구 이름 규칙: `tool_*` 접두사 부활 또는 변경" 이 TBD 상태. 이 결정이 확정되면 PR2 의 SSE `tool_call_result` / `tool_call_request` 이벤트의 `name` 필드 형식이 영향을 받는다.
- **상세**: `ai-agent-tool-connection-rewrite.md` 의 §1 "도구 등록 모델" / "도구 이름 규칙" 은 아직 결정 TBD 상태다. PR2 가 `tool_call_*.name` 을 spec (EIA §5.2) 대로 구현하면, 나중에 `ai-agent-tool-connection-rewrite` 가 도구 이름 namespace 를 바꿀 때 SSE 이벤트 페이로드를 하위 호환성 없이 변경해야 하는 위험이 있다. plan 끼리의 순서 의존이 외부 계약(SSE 이벤트 페이로드)에 전파된다.
- **제안**: `ai-agent-tool-connection-rewrite.md` §3 Spec 작성에 체크박스 "(EIA §5.2 tool_call payload `name` namespace — PR2 머지 전 결정 또는 PR2 머지 후 SSE 호환 확인)" 를 추가한다. PR2 착수 전에 도구 이름 namespace 결정이 필요한 것은 아니지만, SSE 이벤트가 공개 계약임을 plan 에 명시해야 한다.

---

### [WARNING] `replay-rerun.md` PR2 구현 — EIA §12 외부 토큰 차단 cross-ref 체크박스 미반영

- **target 위치**: `external-interaction-api.md` Follow-up 절 항목 `(Plan W-2)` — "replay-rerun.md PR2 구현 단계에 EIA cross-ref 체크박스 추가" 가 TODO 로만 남아 있고 `plan/in-progress/replay-rerun.md` 에는 해당 체크박스가 없음
- **관련 plan**: `plan/in-progress/replay-rerun.md` §3 Backend 구현 전체 체크박스 — 외부 인터랙션 토큰 (`iext_*` / `itk_*`) 차단 정책에 대한 항목 없음
- **상세**: EIA spec §12 는 Re-run 시 외부 interaction token 을 차단해야 한다고 명시하고 있으나, `replay-rerun.md` §3 의 구현 체크박스에 해당 항목이 없다. PR2 에서 외부 토큰 체계를 먼저 구현하면, replay-rerun PR2 구현 시 이 정책을 명시적으로 처리해야 한다는 의무가 plan 에 기록되어 있지 않다.
- **제안**: `replay-rerun.md` §3 에 "Re-run 시 `iext_*` / `itk_*` 토큰 무효화 (EIA §12 cross-ref)" 체크박스를 추가한다.

---

### [WARNING] `node-output-redesign/` Phase E P0 — EIA §6.3 `result.outputs` 영향 확인 체크박스 미반영

- **target 위치**: `external-interaction-api.md` Follow-up 절 항목 `(Plan W-3)` — TODO 로만 남아 있고 `node-output-redesign/README.md` 에는 반영 안 됨
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` Phase E — "P0 (ai-agent error builder, information-extractor ConversationThread v2 등) 부터 노드 단위 처리" 가 다음 단계로 예정됨
- **상세**: AI 노드 (ai-agent / information-extractor) 의 `output.result.outputs` shape 변경이 이루어질 경우, EIA §6.3 의 SSE `execution.node_output` 이벤트 페이로드 (node output 을 그대로 relay) 와 정합성이 깨질 수 있다. 현재 두 plan 에는 이 연결 관계가 명시되어 있지 않다.
- **제안**: `node-output-redesign/ai-agent.md` 또는 README Phase E 항목에 "EIA §6.3 SSE payload 호환 확인 (external-interaction-api PR2 머지 후 해당)" 메모를 추가한다.

---

### [WARNING] `merge-p2-async-fanin.md` §1 PoC — EIA seq monotonic 보장 검증 체크박스 미반영

- **target 위치**: `external-interaction-api.md` Follow-up 절 항목 `(Plan INFO-1)` — TODO 로만 남아 있고 `merge-p2-async-fanin.md` 에 반영 안 됨
- **관련 plan**: `plan/in-progress/merge-p2-async-fanin.md` §1 엔진 비동기 dispatch 가능성 검토
- **상세**: EIA §R7 은 SSE `id:` 와 Notification `seq` 가 WS §2.2 monotonic counter 를 공유한다고 정의한다. merge-p2-async-fanin 이 비동기 dispatch 모델을 도입하면 seq 발급 시점이 바뀔 수 있어 monotonic 보장에 영향을 줄 수 있다.
- **제안**: `merge-p2-async-fanin.md` §1 체크박스에 "EIA seq monotonic 보장과의 호환성 검증" 항목을 추가한다.

---

### [WARNING] `self-hosting-deployment.md` §5 security.md — notification URL SSRF allowlist 항목 미반영

- **target 위치**: `external-interaction-api.md` Follow-up 절 항목 `(Plan INFO-2)` — TODO 로만 남아 있고 `self-hosting-deployment.md` 에 반영 안 됨
- **관련 plan**: `plan/in-progress/self-hosting-deployment.md` §5 보안 문서 (체크박스 미확인)
- **상세**: 셀프 호스팅 환경에서 notification URL 의 SSRF 차단은 내부망 IP 정책에 따라 커스텀 allowlist 가 필요할 수 있으나, self-hosting security 가이드에 반영 항목이 없다.
- **제안**: `self-hosting-deployment.md` 보안 문서 절에 "notification URL SSRF — `NOTIFICATION_ALLOWED_HOSTNAMES` / allowlist 설정" 항목을 추가한다.

---

### [INFO] SDK 패키지 이름 분리 — `@clemvion/sdk` vs `@clemvion/node-sdk` 확인 완료

- **target 위치**: `external-interaction-api.md` 비고 절 — "Public SDK (PR3 §3.2) 는 별도 npm 패키지로 publish. 이는 marketplace-and-plugin-sdk Phase D 와는 별개 작업"
- **관련 plan**: `plan/in-progress/marketplace-and-plugin-sdk.md` Phase D — SDK 패키지 이름 `@clemvion/node-sdk`
- **상세**: External Interaction SDK (`@clemvion/sdk`) 와 커스텀 노드 SDK (`@clemvion/node-sdk`) 는 spec §R9 cross-link 에 따라 별개 패키지로 이미 결정되어 있다. 두 이름이 다르므로 npm 충돌은 없다. 단, monorepo 내 `codebase/packages/` 경로 배치 시 `sdk/` vs `node-sdk/` 디렉토리 명이 plan 에 아직 확정되지 않아 실제 구현 시 디렉토리 이름을 명시적으로 결정해야 한다.
- **제안**: PR2 착수 전 `codebase/packages/sdk/` 또는 `codebase/sdk/` 중 하나를 확정하고 external-interaction-api.md §3.2 에 기록한다. marketplace-and-plugin-sdk Phase D 의 SDK 경로와 충돌하지 않는지 교차 확인 필요.

---

### [INFO] PR1 spec 변경 후 rebase 위험 — 현재 낮음

- **target 위치**: `external-interaction-api.md` 전체 — PR2 worktree 가 PR1 (`worktree-spec-external-interaction-api`) 위에 fork
- **상세**: `impl-external-interaction-api-31801c` 과 `spec-external-interaction-api` 는 동일 commit (`e2c7ba9d`) 을 가리키고 있어 현재 동기화 상태다. PR1 review 중 spec 본문이 크게 바뀌면 PR2 worktree 가 rebase 해야 한다. 단, PR1 이 spec-only PR이고 codebase 파일은 건드리지 않으므로 rebase 시 codebase 충돌은 없다. spec 파일 자체는 PR2 에서 직접 수정하지 않으므로 (PR2 는 codebase/ 구현) 위험도는 낮다.
- **제안**: PR1 review 가 spec 본문을 수정하면 PR2 worktree 에서 `git rebase worktree-spec-external-interaction-api` 로 spec 파일을 최신 상태로 유지한다. 현재 추가 조치 불필요.

---

### [INFO] worktree 경합 — 현재 활성 worktree 에서 PR2 핵심 파일 중복 없음

- **target 위치**: PR2 구현 예정 파일 전체
- **상세**: `harness-review-router-c4f1a2` worktree 가 `app.module.ts` / `execution-engine.service.ts` / `hooks.controller.ts` / `trigger.entity.ts` / `main.ts` 를 포함한 것으로 보이나, 해당 plan 은 이미 `plan/complete/` 로 이동됐고 PR #125 가 2026-05-16 에 main 에 머지됐다. worktree 는 stale remnant 로 실질 경합 없다. 현재 활성 plan + worktree 중 PR2 핵심 파일(`trigger.entity`, `hooks.controller`, `execution-engine.service`, `app.module`, `main.ts`, `websocket.service`) 을 동시 수정하는 plan 은 발견되지 않았다.
- **제안**: stale worktree 정리 권장 (기능적 영향 없으나 혼동 방지).

---

## 요약

Plan 정합성 관점에서 즉시 차단되는 CRITICAL 항목은 **Migration V059 번호 충돌** 1건이다. PR2 의 Trigger 4컬럼 마이그레이션과 `replay-rerun.md` 의 Re-run 마이그레이션이 모두 V059 를 사용하려 하고 있어, 두 plan 의 착수·머지 순서가 합의되지 않으면 마이그레이션 번호 충돌이 발생한다. 나머지 WARNING 4건은 plan 간 Follow-up 체크박스 전파 미완료 항목으로, 실제 구현 중 누락될 위험이 있지만 PR2 착수 자체를 차단하는 수준은 아니다. worktree 경합 위험은 없고, SDK 이름 분리도 spec 에서 이미 결정되어 있다. V059 번호 합의 및 Follow-up 체크박스 4건 전파를 완료한 후 PR2 구현을 착수하는 것이 권장된다.

## 위험도

MEDIUM

STATUS: WARN
