# 신규 식별자 충돌 검토 — auth-refresh-rotation-atomic

## 발견사항

### INFO: `C-1` 식별자 — 동일 scope 내 중복 아님, 파일 간 스코프 충돌

- **target 신규 식별자**: `plan/in-progress/auth-refresh-rotation-atomic.md` 가 참조하는 `refactor/05-database.md C-1`
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/plan/in-progress/refactor/04-security.md` line 11: C-1 = "JWT secret 기본값 fallback"
  - `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/plan/in-progress/refactor/06-concurrency.md` line 11: C-1 = "`cancelWaitingExecution` fire-and-forget — 에러 유실"
  - `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/plan/in-progress/refactor/02-architecture.md` line 11: C-1 = "ExecutionEngineService god-class"
- **상세**: `C-1` 은 각 refactor 백로그 파일(`02-architecture.md`, `04-security.md`, `05-database.md`, `06-concurrency.md`) 내부에서 독립적으로 사용하는 document-scoped 로컬 식별자다. target plan 이 `refactor/05-database.md C-1` 을 명확히 경로로 지칭하므로 혼동 위험은 낮다. 단 README 나 통합 백로그 참조 시 `05 C-1` 처럼 파일 prefix 없이 단독 `C-1` 을 쓰면 혼동 가능.
- **제안**: 변경 불필요. target plan 이 이미 `refactor/05-database.md C-1 (P0 #4)` 형태로 명확히 참조한다. cross-file 참조 시 동일 표기 유지 권고.

### INFO: `generateTokens` — 동일 함수의 다목적 참조, 충돌 없음

- **target 신규 식별자**: `generateTokens()` 에 optional `EntityManager` 파라미터 추가 (코드 시그니처 변경)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/spec/data-flow/2-auth.md` line 52: `verifyEmail` 트랜잭션 내 `generateTokens` 호출 언급
  - `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/spec/data-flow/12-workspace.md` line 122: workspace switch 경로에서 `generateTokens(workspaceId=:id)` 참조 (계획/미구현)
- **상세**: 세 곳 모두 동일한 `auth.service.ts` 의 `generateTokens` 함수를 가리킨다. optional `EntityManager` 추가는 기존 호출처(login/OAuth, verifyEmail, workspace switch)를 default manager 로 흡수하므로 하위 호환 — 충돌이 아니다.
- **제안**: 변경 불필요.

### INFO: spec 변경 (`spec/data-flow/2-auth.md §1.4`) — 이미 반영됨

- **target 신규 식별자**: `rect rgb(235, 245, 235)` 트랜잭션 박스 + "회전 원자성 (05 C-1)" 주석
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/spec/data-flow/2-auth.md` lines 168-185 에 이미 동일 내용이 존재
- **상세**: 해당 spec 변경이 이미 적용된 상태다. target plan 의 "Spec 변경" 항목은 기 반영이므로 새로운 식별자를 추가로 도입하지 않는다.
- **제안**: 변경 불필요. plan 체크리스트의 spec 항목은 완료 처리해도 무방.

## 요약

target plan `auth-refresh-rotation-atomic.md` 는 순수 코드 리팩토링(스키마 불변, 신규 API endpoint 없음, 신규 ENV var 없음)으로, 도입하는 식별자가 매우 제한적이다. `C-1` 은 다수의 refactor 파일이 각자 독립 스코프로 사용하는 로컬 식별자이며 target plan 이 파일 경로로 명확히 한정해 참조하므로 충돌이 아니다. `generateTokens` 시그니처 변경은 optional 파라미터 추가로 기존 호출처가 모두 하위 호환 유지된다. spec 변경은 이미 반영되어 있다. 신규 식별자 충돌 관점에서 차단 사유가 없다.

## 위험도

NONE
