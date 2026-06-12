### 발견사항

충돌 항목 없음. 아래는 각 변경 영역별 확인 결과다.

#### 1. auth — TRUST_CF_CONNECTING_IP, COOKIE_SAMESITE, isOriginAllowed (M-5·m-3)

- 검토 결과: **기존 spec 에 이미 동일 의미로 정의됨 — 충돌 없음.**
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/spec/5-system/1-auth.md` §2.3 표 (lines 278~282) 에 `TRUST_CF_CONNECTING_IP`, `COOKIE_SAMESITE`, `isOriginAllowed` 가 동일 의미·동일 동작 설명과 함께 이미 기재되어 있다.
  - Rationale 2.3.B (line 570) 도 이미 존재한다.
  - 구현부 `codebase/backend/src/modules/auth/utils/client-ip.spec.ts`, `refresh-cookie.ts`, `sessions.controller.spec.ts` 에서도 동일 env key 를 사용 중이며 의미 일치.
  - target 은 이미 기술된 내용을 정식 표·Rationale 로 보강하는 후행 정정이므로 신규 식별자 충돌 없음.

#### 2. websocket — workflow:{workflowId}, notifications:{userId} (M-6)

- 검토 결과: **기존 spec 에 이미 동일 의미로 정의됨 — 충돌 없음.**
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/spec/5-system/6-websocket-protocol.md` §3.3 (lines 121, 123, 148, 151) 에 `workflow:{workflowId}` 와 `notifications:{userId}` 가 동일 소유검증 채널로 이미 기재되어 있다.
  - target 은 기존 3채널(execution/kb/background) 외에 위 2채널도 소유검증 표에 명시적으로 등재하는 보강이지, 새로운 채널 이름을 도입하는 것이 아니다.

#### 3. regex ReDoS — compileUserRegex, safe-regex (M-3)

- 검토 결과: **기존 spec 에 이미 동일 의미로 정의됨 — 충돌 없음.**
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/spec/4-nodes/1-logic/8-filter.md` (line 103), `spec/4-nodes/5-data/1-transform.md` (lines 68, 134), `spec/4-nodes/1-logic/1-if-else.md` (line 164) 에 `compileUserRegex` 와 `safe-regex` 가 동일 의미(ReDoS 방지 단일 헬퍼)로 이미 기재되어 있다.
  - target 은 "길이 200 단독" 표현만 있던 부분에 `safe-regex` 1차 방어를 명확화하는 보강이며 식별자 자체는 기존과 동일.

#### 4. swagger — ENABLE_SWAGGER_IN_PROD, production-guards.ts, isSwaggerEnabled (M-1)

- 검토 결과: **기존 spec 에 이미 동일 의미로 정의됨 — 충돌 없음.**
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/spec/conventions/swagger.md` §0) (line 23) 이 이미 존재하며 `ENABLE_SWAGGER_IN_PROD`, `production-guards.ts`, `isSwaggerEnabled` 를 동일 의미로 기술한다.
  - frontmatter `code:` 에 `production-guards.ts`·`main.ts` 가 이미 등재되어 있다 (lines 7–8).
  - target 의 변경은 해당 섹션을 frontmatter 에 추가 등록하는 조작으로, 신규 식별자를 도입하지 않는다.

#### 5. code stack 노출 — staging 가이드, NODE_ENV=production (m-2)

- 검토 결과: **기존 spec 에 이미 동일 의미로 정의됨 — 충돌 없음.**
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/spec/4-nodes/5-data/2-code.md` §5.3 (lines 259–261) 에 "외부 노출 staging 은 `NODE_ENV=production` 으로 운영" 안내가 이미 존재한다.
  - target 은 같은 문단을 정식 운영 가이드로 가시화하는 보강이며 신규 식별자 없음.

### 요약

target 문서(`plan/in-progress/spec-draft-refactor-04-security-drift.md`)가 도입하는 모든 식별자(ENV var `TRUST_CF_CONNECTING_IP`·`COOKIE_SAMESITE`·`ENABLE_SWAGGER_IN_PROD`, 함수명 `isOriginAllowed`·`isSwaggerEnabled`·`compileUserRegex`, 채널명 `workflow:{workflowId}`·`notifications:{userId}`, 파일 경로 `production-guards.ts`)는 이미 해당 spec 파일에 동일 의미로 기술되어 있거나 코드에서 동일 명칭으로 구현 완료된 상태다. 본 draft 는 spec 공백을 채우는 후행 drift 정정이므로 신규 식별자 충돌이 전혀 없다.

### 위험도

NONE

STATUS: OK
