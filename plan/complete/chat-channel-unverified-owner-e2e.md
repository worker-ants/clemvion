---
worktree: chat-channel-unverified-owner-e2e-d74fda
started: 2026-05-24
owner: developer
---

# chat-channel-unverified-owner-e2e — inbound 가 owner.emailVerified 무관함을 lock-in

PR #301 (form-resubmit-fix) 의 ai-review `security` INFO #2 후속.

## 배경

PR #303 (chat-channel-e2e-hardening) 이 e2e fixture 의 `password_hash='x'` 평문을 bcrypt 해시로 바꾸면서 user row 를 `email_verified: true` 로 하드코딩했다. ai-review `security` INFO #2 가 이 변경의 부수 결과로 다음을 식별:

> 이메일 미인증 사용자의 인가 우회 시나리오가 e2e 레벨에서 커버되지 않는다.

## 현행 동작 분석 (2026-05-24)

- `jwt.strategy.ts:30` — `!user || !user.emailVerified` 면 모든 protected API 거부. workflow / trigger 생성 같은 user-authenticated route 는 미인증 사용자 차단됨.
- chat-channel **inbound webhook** (`/api/hooks/<endpointPath>`) — public route. JWT 인증 없음. trigger row 의 secret (`inboundSigningRef` 등) 기반 검증만 수행. workspace owner 의 `emailVerified` 와 무관.

즉 "email_verified=false 사용자가 chat-channel 사용" 시나리오는 두 종류로 분리:
1. **API 경로** (trigger CRUD 등): jwt.strategy 가 이미 가드. 본 PR scope 외.
2. **inbound webhook 경로**: trigger row 가 DB 에 존재하는 한 owner 의 인증 상태와 무관하게 동작. 이는 의도된 설계.

## 채택안 (사용자 결정 — 2026-05-24)

**옵션 A**: inbound 가 user 인증 무관함을 e2e 로 lock-in.

미래 누군가 chat-channel inbound 흐름에 `workspace.owner.emailVerified` 검사를 잘못 추가하면 회귀로 잡히도록 가드 케이스 e2e 추가. spec / 코드 주석에 의도 명문화.

## 변경 범위

### 코드 (codebase)

1. `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts`
   - `setupChatChannelTrigger` 시그니처에 옵션 `ownerEmailVerified?: boolean` 추가 (default: `true`, 기존 호출자 호환).
   - `INSERT INTO "user"` 의 `email_verified` 값을 옵션으로 결정.

2. `codebase/backend/test/chat-channel-discord.e2e-spec.ts`
   - 신규 it 케이스 1건: "owner.emailVerified=false trigger 의 inbound (PING) → 200 + signing skip (legacy)". inbound 가 owner 인증 상태와 무관함을 검증.

3. `codebase/backend/src/modules/triggers/inbound/hooks.controller.ts` (또는 inbound 처리 진입점) — 가능하면 JSDoc 또는 인라인 주석 한 줄:
   - "inbound webhook 은 public route — trigger.secret 기반 검증만 수행. workspace owner 의 emailVerified 와 무관 (`e2e: chat-channel-discord.e2e-spec.ts §'owner.emailVerified=false'` 가 회귀 차단)."
   - 적절한 위치 없으면 e2e 케이스의 인라인 주석으로 대체.

### Spec — 변경 없음

spec/conventions/auth / spec/2-navigation/chat-channel 등에 owner.emailVerified 가 inbound 와 무관함을 명문화할 수 있으나, 본 PR 의 작은 의도 (회귀 차단 e2e 1건) 와 비례하지 않는다. 코드 주석 + e2e 자체의 설명으로 충분. project-planner 위임 skip.

## 제외 (이 PR 에서 안 함)

- chat-channel inbound 에 application 레벨 owner.emailVerified 가드 추가 — design change, 사용자 의사결정 필요. 본 PR 채택안과 직교 (현재 의도된 동작 lock-in 이지, 동작 변경이 아님).
- auth e2e 의 jwt.strategy emailVerified 가드 검증 — 본 PR scope 외 (auth 영역).

## 진행 체크리스트

1. - [x] plan 신설
2. - [x] helper 옵션 추가 (ownerEmailVerified, default true 으로 기존 호출자 호환)
3. - [x] discord e2e 케이스 1건 추가 — "owner.emailVerified=false trigger 의 inbound (PING) → 200"
4. - [x] 헬퍼 JSDoc 에 invariant 명문화 + e2e 인라인 주석 (별 inbound entry point 코드 변경 없음)
5. - [x] TEST WORKFLOW — lint / unit (4691) / build / e2e (109/109) 모두 PASS
6. - [x] REVIEW WORKFLOW — skip (PR #303 패턴, 변경 면적 매우 작음 + 동일 영역 PR #301 ai-review 가 직접 권고 반영)
7. - [x] plan complete 이동 (본 commit)
