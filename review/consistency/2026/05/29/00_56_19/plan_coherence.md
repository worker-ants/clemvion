# Plan 정합성 검토 결과

> 검토 모드: `--impl-prep`  
> Target: `spec/5-system/` (전체 디렉토리)  
> 검토 일시: 2026-05-29

---

## 발견사항

### - **[WARNING]** `spec/5-system/1-auth.md §5` API 표에 `POST /api/auth-configs/:id/reveal` 미등재

- target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` 표
- 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3 "spec 보완"` (status: backlog, worktree: assigned at impl-start)
- 상세: PR #341 (`worktree-auth-config-webhook-wiring`, MERGED) 이 `POST /api/auth-configs/:id/reveal` 엔드포인트를 구현하고 §3.2 권한 매트릭스 + §4.1 감사 로그 + Rationale 에는 반영했으나, §5 API 엔드포인트 표에는 해당 행이 없다. `auth-config-webhook-followups.md §3` 이 `project-planner` 영역 spec 보완 작업으로 등재했으나 아직 미착수(backlog). 구현을 전제로 `spec/5-system/` 을 읽는 개발자가 §5 표만 보면 reveal 엔드포인트의 존재를 알 수 없다.
- 제안: `auth-config-webhook-followups.md §3` 의 spec 보완 항목들(reveal 표 행 추가, IP 추출 정책 명시, endpointPath 재발급 경고 등)을 impl-prep 전에 project-planner 에게 위임하거나, impl 담당자가 spec read 시 §3.2 + Rationale 도 함께 참조해야 함을 인지할 것. 본 gap 이 구현 착수를 막지는 않지만 spec 완성도 차원에서 followups plan 을 우선 진행 권장.

---

### - **[WARNING]** `spec/5-system/12-webhook.md` 에 IP 추출 정책·fail-closed 동작 미명시

- target 위치: `spec/5-system/12-webhook.md` §7 처리 흐름 / §2 보안
- 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3 "spec 보완"` (status: backlog)
- 상세: PR #341 구현에서 `CF-Connecting-IP → X-Forwarded-For → req.ip` 우선순위로 클라이언트 IP 를 추출하고, `ip_whitelist` 설정 시 clientIp 불명 상태에서 fail-closed(거부) 하는 동작이 코드에 반영됐다. 그러나 `spec/5-system/12-webhook.md` 에는 이 IP 추출 정책이 명시되지 않았다. `ip_whitelist` fail-closed 정책도 누락. `1-auth.md §2.3` 의 "클라이언트 IP: Cloudflare 무료 플랜 호환" cross-reference 가 auth spec 에 있으나 webhook spec 에서는 해당 링크가 없다.
- 제안: impl-prep 전 `auth-config-webhook-followups.md §3` spec 보완을 project-planner 에게 위임해 `spec/5-system/12-webhook.md` 에 IP 추출 정책과 fail-closed 동작을 명시할 것. 보완 전까지는 `spec/5-system/1-auth.md §2.3` 의 Cloudflare 호환 정책을 webhook 보안 구현 시 함께 적용.

---

### - **[WARNING]** `spec/5-system/15-chat-channel.md` 병렬 수정 중 — active worktree 경합

- target 위치: `spec/5-system/15-chat-channel.md` CCH-MP-03 / §4.1 `formMode` / `languageHints.formOpenLabel`
- 관련 plan: `plan/in-progress/chat-channel-form-native-modal.md` (worktree: `chat-channel-form-native-modal-c021b9`, ACTIVE, 브랜치 `claude/chat-channel-form-native-modal-c021b9`)
- 상세: `spec/5-system/` 전체를 impl-prep 대상으로 읽는 시점에, 동일 파일 `spec/5-system/15-chat-channel.md` 가 `chat-channel-form-native-modal-c021b9` worktree 에서 이미 수정됐다 (CCH-MP-03 설명 변경 — `formMode` 분기 신설 + native modal 조건 명시 + `formMode` 기본값 `"auto"` 변경 + `formOpenLabel` 필드 추가). 해당 worktree 에는 open PR 이 없고, 브랜치는 `origin/main` 에 포함되지 않아 ACTIVE 로 판단된다. impl-prep 이후 구현이 main 의 `15-chat-channel.md` 를 기준으로 진행되면, 이 worktree 가 나중에 머지될 때 spec 내용 충돌이 발생할 수 있다.
- 제안: `spec/5-system/15-chat-channel.md` 를 읽거나 구현 착수 시, `chat-channel-form-native-modal-c021b9` 브랜치의 변경 내용(native modal 분기 + `formMode` 필드 추가)을 함께 검토할 것. 두 worktree 가 동일 파일의 겹치는 섹션을 수정하지 않는다면 충돌은 없으나, `CCH-MP-03` 과 `§4.1 formMode` 영역은 양쪽 모두 해당 섹션을 건드릴 가능성이 있다. 구현 착수 전 해당 plan 담당자와 조율 권장.

---

### - **[INFO]** `spec/5-system/1-auth.md §4.1` 의 감사 로그 5종 중 4종이 미구현 상태

- target 위치: `spec/5-system/1-auth.md §4.1 기록 대상 액션 — 설정` 카테고리
- 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §1 "AuthConfig CRUD audit 기록"` (status: backlog)
- 상세: spec §4.1 표는 `auth_config.create / .update / .delete / .regenerate / .reveal` 5종을 감사 로그 대상으로 명시하지만, PR #341 구현에서 `reveal` 만 audit 기록되고 create/update/delete/regenerate 는 미구현이다. impl-prep 단계에서 감사 로그 관련 기능을 개발한다면, create/update/delete/regenerate 의 audit 기록도 spec 에 명시된 요구사항임을 인지할 것.
- 제안: 구현 시 `auth-config-webhook-followups.md §1` 과 연계해 누락 audit 기록을 함께 추가. `AuthConfigsService` 의 `userId` 전달 경로 보강도 선행 필요.

---

### - **[INFO]** `multiturn-error-preserve` plan 의 spec 변경은 완료, codebase 구현만 대기 중

- target 위치: `spec/5-system/4-execution-engine.md §1.3` / `spec/5-system/6-websocket-protocol.md §4.2`
- 관련 plan: `plan/in-progress/multiturn-error-preserve.md` (worktree: multiturn-error-preserve, spec 변경 완료, 구현 미착수)
- 상세: `multiturn-error-preserve` plan 이 정의한 spec 변경 (`_retryState` 보존 예외, `execution.retry_last_turn` 명령, `RETRY_STATE_NOT_FOUND` / `NODE_NOT_RETRYABLE` / `RETRY_TOO_EARLY` 에러 코드 등)은 이미 `spec/5-system/4-execution-engine.md §1.3` 과 `spec/5-system/6-websocket-protocol.md §4.2` 에 반영되어 있다. 본 target 파일들을 읽으면 이 구현 의도가 담겨있으므로, impl-prep 단계에서 해당 내용을 구현 범위에 포함해야 하는지 여부를 확인할 것.
- 제안: `multiturn-error-preserve` plan 의 영향 codebase 표를 병행 검토해 현재 구현 착수를 고려 중인 작업과 범위가 겹치는지 확인.

---

### - **[INFO]** `spec/5-system/1-auth.md §4.1 "인증 (워크스페이스 컨텍스트)"` 에 `password_change / 2fa_enable/disable` 만 열거

- target 위치: `spec/5-system/1-auth.md §4.1` — 인증 카테고리
- 관련 plan: `plan/in-progress/webauthn-backend-e2e.md` (status: in-progress, LOW priority)
- 상세: 현재 spec §4.1 의 인증(워크스페이스 컨텍스트) 감사 로그에는 `password_change / 2fa_enable / 2fa_disable` 만 열거되어 있다. WebAuthn credential 등록/삭제 액션에 대한 감사 로그 항목은 명시되지 않았다. `webauthn-backend-e2e.md` plan 에서도 이 gap 은 다루지 않는다. 구현 착수 전 WebAuthn 관련 감사 이벤트를 추가할 필요가 있는지 검토 권장.
- 제안: 명시적 추적 항목 없음. 향후 WebAuthn audit 이벤트가 필요해지면 `auth-config-webhook-followups.md §3` 과 동일한 경로 (project-planner 에 위임) 로 처리.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `docs-mobile-sidebar-complete-8659c2` (branch `claude/docs-mobile-sidebar-complete-8659c2`) — Step 2 PR #344 MERGED. 이 worktree 는 `spec/5-system/` 파일을 변경하지 않아 충돌 후보에서 제외됐으나, 물리 worktree 디렉토리가 남아 있다.

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/` 에 대한 impl-prep 검토 결과, CRITICAL 등급 항목은 없다. 주요 관심 사항은 두 가지다. 첫째, PR #341 (`auth-config-webhook-wiring`, MERGED) 의 구현과 spec 간 미완성 동기화 — `spec/5-system/1-auth.md §5` API 표의 reveal 엔드포인트 누락, `spec/5-system/12-webhook.md` IP 추출 정책 미명시, auth audit 미구현 4종 — 이 모두 `auth-config-webhook-followups.md` (backlog) 에 추적 중이나 아직 착수 전이다. 둘째, `spec/5-system/15-chat-channel.md` 는 `chat-channel-form-native-modal-c021b9` 브랜치(ACTIVE, PR 없음)에서 CCH-MP-03 native modal 분기 관련 변경이 진행 중이어서, 동일 파일을 impl-prep 대상으로 읽는다면 해당 브랜치의 변경 내용을 함께 고려해야 한다. worktree 충돌 후보 8건 중 stale 1건(`docs-mobile-sidebar-complete-8659c2`) skip, active 7건 분석.

---

## 위험도

**LOW**

미해결 결정 우회나 active worktree 간 경합 CRITICAL 은 없다. 모든 발견사항은 spec 완성도 gap(WARNING 2건)과 추적 메모(INFO 3건)이다. `spec/5-system/15-chat-channel.md` 와 `chat-channel-form-native-modal-c021b9` 의 병렬 수정은 주의 사항이나 섹션이 겹치지 않으면 실질적 충돌은 없다.
