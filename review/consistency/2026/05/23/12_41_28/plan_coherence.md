# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
검토 기준: `plan/in-progress/**` 전체 (2026-05-23 기준)
검토 모드: --spec (spec draft 검토)

---

## 발견사항

### [WARNING] `spec-fix-isactive-drawer-toggle.md` 와 `spec/2-navigation/2-trigger-list.md §2.3.1` 섹션 중복

- **target 위치**: 결정 1 — §2.3.1 필드 권한 매트릭스 (9개 row 추가)
- **관련 plan**: `plan/in-progress/spec-fix-isactive-drawer-toggle.md` (worktree: `trigger-drawer-cleanup-f6a707`)
- **상세**: 두 plan 이 모두 `spec/2-navigation/2-trigger-list.md §2.3.1` 의 필드 권한 매트릭스를 수정 대상으로 삼는다.
  - target plan: chatChannel 관련 9개 row 신규 추가
  - `spec-fix-isactive-drawer-toggle.md`: `isActive` 행의 `edit (토글 버튼)` vs `read-only (배지)` 결정 + Rationale 절 변경
  두 변경이 물리적으로 다른 행을 수정하므로 내용 충돌은 없다. 그러나 `spec-fix-isactive-drawer-toggle.md` 의 선언 worktree(`trigger-drawer-cleanup-f6a707`)는 현재 `git worktree list` 에 존재하지 않아 실제 동시 파일 경합은 없는 상태다.
  동일 섹션을 순차적으로 수정하는 두 plan 이 병렬로 PR 을 만들면 merge 시 context diff 충돌이 발생할 수 있다.
- **제안**: `spec-fix-isactive-drawer-toggle.md` 처리 우선순위를 확인해 target plan PR 머지 전후 순서를 명시하거나, 둘 다 같은 PR 에 통합 (또는 순차 처리 명문화). target plan 의 Rationale 에 "§2.3.1 isActive 행 결정은 `spec-fix-isactive-drawer-toggle.md` 에 위임" 주석을 달아두면 충분.

---

### [WARNING] `chat-channel-secret-store-infra.md` Phase 3 범위가 결정 2 (single-path) 의 신규 API 계약을 선반영하지 않음

- **target 위치**: 결정 2 — botToken single-path 정책, `hasBotToken: boolean` 필드 신설, `PATCH body.config.chatChannel.botTokenRef` 차단 (400)
- **관련 plan**: `plan/in-progress/chat-channel-secret-store-infra.md` Phase 3 ("chat-channel.botToken 마이그레이션")
- **상세**: secret-store plan 의 Phase 3 범위 설명은 target plan 이 확정하는 단일경로 결정 이전에 작성되어, 마이그레이션 절차에 다음 사항이 누락되어 있다:
  1. `hasBotToken: boolean` 보조 필드의 마이그레이션 처리 방향 (plaintext → ref 전환 후 `hasBotToken` 갱신 여부)
  2. `PATCH body.config.chatChannel.botTokenRef` 차단 (400 `VALIDATION_ERROR`) 이 v1 코드에 없는 경우 추가 여부
  3. 마이그레이션 완료 후 GET 응답에서 `botToken` plaintext / `botTokenRef` 완전 제거 확인 항목
  결정 2 는 target plan 에서 확정되므로, secret-store plan 이 이를 선행 조건으로 인용해야 한다.
- **제안**: target plan 머지 후 `chat-channel-secret-store-infra.md` Phase 3 범위에 "선행 조건: `spec-telegram-chat-channel-ui-polish.md` 의 결정 2 (single-path 정책) 완료 필요" 를 추가하고, `hasBotToken` 마이그레이션 처리 절차를 보강. (target plan 자체는 수정 불필요 — plan 관계가 이미 "충돌 없음"으로 기술되어 있으나 후속 plan 갱신이 누락된 상태.)

---

### [WARNING] `chat-channel-visual-ssr-png.md` 결정 항목 #2 의 enum 선택지가 target plan 결정 3 과 사전 조율 없이 분기됨

- **target 위치**: 결정 3 — `uiMapping.visualNode` enum `"text" | "photo" | "auto"`, `text_only` → `text` rename
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md` — "결정 항목 #2 fallback 정책" 옵션 (b): `visualNode: 'photo'` / `'text'`(신설) / `'text_only'` → skip 명시 (line ~125)
- **상세**: visual-ssr-png plan 의 옵션 (b) 본문에 `'text_only'` 이름이 그대로 남아 있어, target plan 이 이를 `'text'` 로 rename 하면 visual-ssr-png plan 의 "결정 항목 #2" 에서 참조하는 이름이 stale 이 된다. 또한 visual-ssr-png plan 은 `'auto'` 값을 언급하지 않아, target plan 이 신설하는 `auto` 휴리스틱 동작을 v2 SSR 경로에서 어떻게 처리할지 명세가 없다.
  target plan 은 이 관계를 "v2 SSR 인프라 도입 후 의미" + "이 plan 진입 시 enum 을 참조" 로 올바르게 기술하고 있으나, visual-ssr-png plan 내부가 아직 갱신되지 않은 상태.
- **제안**: target plan 머지 후 `chat-channel-visual-ssr-png.md` "결정 항목 #2" 의 옵션 본문에서 `'text_only'` → `'text'` rename 반영, `'auto'` 값에 대한 v2 SSR 처리 정책 (auto 시 chart/table → text, carousel+imageUrl → photo 시도) 을 명시적으로 추가. target plan 후속 plan 목록(§후속 plan)에 "3번 항목 진입 전 visual-ssr-png plan 의 결정 항목 #2 갱신 필요" 를 추가하면 더 명확.

---

### [INFO] `spec-fix-isactive-drawer-toggle.md` worktree 선언이 stale — git worktree 에 없음

- **target 위치**: target plan frontmatter `worktree: .claude/worktrees/telegram-chat-channel-spec-polish-49c49b` (정상)
- **관련 plan**: `plan/in-progress/spec-fix-isactive-drawer-toggle.md` frontmatter `worktree: trigger-drawer-cleanup-f6a707`
- **상세**: `git worktree list` 에 `trigger-drawer-cleanup-f6a707` 가 없음. 해당 plan 의 worktree 가 정리되었거나 아직 미생성 상태. 실제 파일 경합 위험 없음.
- **제안**: `spec-fix-isactive-drawer-toggle.md` frontmatter 의 `worktree` 를 `(정리됨 — 미착수)` 등으로 갱신해 다음 검토자에게 혼란을 줄일 것.

---

### [INFO] 결정 2의 `hasBotToken` boolean 필드가 `spec/1-data-model.md` 에 영향 없는지 확인 권고

- **target 위치**: 결정 2 — `chatChannel.hasBotToken: true` 응답 필드 신설
- **관련 plan**: 없음 (data-model 관련 in-progress plan 미존재)
- **상세**: target plan 은 `spec/1-data-model.md §2.8 (Trigger 테이블 컬럼)` 을 "영향 받지 않는 부분" 으로 명시하고 있다. `hasBotToken` 은 DB 컬럼이 아니라 `GET /api/triggers/:id` 응답 DTO 에서 계산 파생되는 값으로 보인다. 이 경우 spec 에 해당 DTO 파생 규칙을 명확히 기술해야 혼동이 없다.
- **제안**: `spec/5-system/15-chat-channel.md` §5.4 갱신 시 `hasBotToken` 가 API 응답 DTO 파생 필드임을 한 줄로 명시 (`botTokenRef IS NOT NULL → hasBotToken: true`). data-model 컬럼 변경이 없음을 Rationale 에 주석으로 남겨두면 충분.

---

### [INFO] `spec/2-navigation/2-trigger-list.md` Rationale R-2 TBD 와 target plan 신설 rotate 인용의 관계 명확화

- **target 위치**: 결정 1 §3 API 표 — `POST /api/triggers/:id/chat-channel/rotate-bot-token` cross-link
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` (Rationale R-2 TBD 에서 인용)
- **상세**: 기존 spec 의 Rationale R-2 TBD는 웹훅 HMAC secret rotate (`/auth/rotate-secret`) 에 관한 것이다. target plan 이 추가하는 chat-channel bot-token rotate 는 다른 엔드포인트이므로 내용 충돌은 없다. 다만, API 표에 두 종류의 rotate endpoint 가 나란히 있으면 검토자가 혼동할 수 있으므로, 주석으로 "본 rotate 는 chat-channel bot token 전용, webhook HMAC secret rotate 는 별도 TBD" 를 명확히 할 것을 권고.
- **제안**: target plan 의 §3 API 표 cross-link 행에 짧은 주석 추가. plan 갱신은 불필요.

---

## 요약

target plan(`spec-telegram-chat-channel-ui-polish.md`)은 backlog 3개(`chat-channel-secret-store-infra`, `chat-channel-visual-ssr-png`, `chat-channel-dispatcher-split`)와의 관계를 자체적으로 잘 기술하고 있으며, 미해결 결정을 일방적으로 우회하거나 다른 in-progress plan 의 결정 영역을 침범하지 않는다. 주요 위험은 (1) `spec-fix-isactive-drawer-toggle.md` 가 동일한 `spec/2-navigation/2-trigger-list.md §2.3.1` 을 수정 대상으로 삼고 있어 PR 직렬화 합의가 필요하다는 점, (2) `chat-channel-secret-store-infra.md` Phase 3 가 target plan 의 결정 2(single-path)를 선행 조건으로 명시하지 않아 후속 plan 갱신이 필요하다는 점, (3) `chat-channel-visual-ssr-png.md` 내부에 `text_only` → `text` rename 과 `auto` 신설이 반영되지 않아 enum 이름이 stale 이 된다는 점이다. 미해결 결정 우회나 실제 worktree 파일 경합은 없으므로 작업 차단이 필요한 CRITICAL 항목은 없다.

## 위험도

MEDIUM
