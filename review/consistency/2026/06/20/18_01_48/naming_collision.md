# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/1-auth.md` (--impl-done, diff-base=origin/main)
검토 범위: git diff origin/main...HEAD 구현 변경 식별자

---

## 발견사항

충돌 또는 우려할 명명 이슈가 발견되지 않았다.

### 검토 결과 상세

**1. 요구사항 ID 충돌**

diff 가 도입하는 새 요구사항 ID 없음. 변경은 behavior-preserving 리팩터로, 기존 식별자(에러코드·메서드명)를 재사용하거나 이미 C-3(#658)에서 확립된 `verifyPasswordForUser` 를 신규 호출처에 연결하는 것에 그친다.

**2. 엔티티/타입명 충돌**

- `comparePassword` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/codebase/backend/src/common/utils/password.util.ts:22` 에 단일 정의. diff 는 `sessions.service.ts` 에서 이 함수를 import 해 기존 `bcrypt.compare` 인라인을 교체한다. 동일 모듈의 동일 함수이므로 충돌 없음.
- `verifyPasswordForUser` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/codebase/backend/src/modules/auth/auth.service.ts:59` 에 단일 정의. diff 는 `webauthn.controller.ts` 에서 기존 13줄 raw bcrypt 블록을 이 메서드 단일 호출로 교체한다. 신규 정의 없음.

**3. API endpoint 충돌**

diff 는 endpoint 를 신설하지 않는다. 변경은 기존 `POST /api/auth/2fa/webauthn/recovery/regenerate` 핸들러(`webauthnRegenerateRecovery`) 내부 구현 교체에 한정된다.

**4. 이벤트/메시지명 충돌**

diff 는 webhook·queue·SSE 이벤트명을 도입하지 않는다.

**5. 환경변수·설정키 충돌**

신규 ENV var 또는 config key 없음.

**6. 파일 경로 충돌**

- `codebase/backend/src/common/utils/password.util.ts` — 기존 파일, 신규 생성 없음.
- `sessions.service.ts`, `webauthn.controller.ts`, `webauthn.controller.spec.ts` — 기존 파일 수정. 경로 컨벤션 위반 없음.

**참고 관찰 (충돌 아님, INFO)**

`auth-configs.service.ts:309` 에 `bcrypt.compare` 직접 호출이 잔존한다. 에러 코드도 `AUTH_FAILED` 로 `PASSWORD_INVALID`/`PASSWORD_REQUIRED` 와 다르다. 이는 본 diff 범위 밖(reveal 경로)으로 plan `refactor-auth-reverify-unify.md` §범위 밖 에도 언급이 없으나, 비밀번호 재확인 단일진실 완성 관점에서 후속 작업 후보로 인식할 수 있다. 명명 충돌은 아니다.

---

## 요약

diff 가 도입하는 식별자는 모두 기존 코드베이스 내에서 이미 확립된 이름(`verifyPasswordForUser`, `comparePassword`, `PASSWORD_INVALID`, `PASSWORD_REQUIRED`)이며, 본 변경은 해당 식별자의 신규 정의가 아니라 기존 정의로의 호출 통합이다. 새 엔티티·타입·endpoint·이벤트·환경변수·파일이 도입되지 않으므로 식별자 충돌 위험은 없다.

---

## 위험도

NONE
