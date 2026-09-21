# 신규 식별자 충돌 검토 — webauthn-dup-delete

## 검토 범위 확인

- spec 델타: `spec/5-system` 0개 파일 (`spec_impact: none`) — 본 target 은 spec 신규 식별자를 도입하지 않는다.
- 실제 diff: 코드 3개 파일(`webauthn.service.ts`, `webauthn.service.spec.ts`, `webauthn-credential-delete-concurrency.e2e-spec.ts`) + `CHANGELOG.md` + plan 문서 갱신.
- 성격: `WebAuthnService.deleteCredential()` 의 동시-삭제 중복 감사 버그 수정(형제 8건과 동일 클래스의 9번째·마지막). 신규 기능·신규 API·신규 엔티티 도입이 아니라 기존 로직의 내부 리팩터 + 판정 강화.

절대경로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/webauthn-dup-delete-5c9f3a`)에서 `git diff origin/main...HEAD` 로 실제 코드 변경분을 직접 확인했다.

## 관점별 점검

### 1. 요구사항 ID 충돌
신규 요구사항 ID 없음. `spec/5-system/1-auth.md` 는 이번 diff 로 변경되지 않았고, plan 문서(`webauthn-dup-delete.md`)도 신규 ID 를 부여하지 않는다. — 해당 없음.

### 2. 엔티티/타입명 충돌
신규 도입 식별자는 `WebAuthnService` 의 **private** 메서드 `throwCredentialNotFound(): never` 하나뿐이다. 클래스 스코프 private 메서드라 외부 노출·충돌 표면이 없고, 형제 서비스들의 동형 헬퍼와 이름 패턴까지 일치함을 실측으로 확인했다(충돌이 아니라 일관성 강화):

```
codebase/backend/src/modules/auth-configs/auth-configs.service.ts:152  private throwAuthConfigNotFound()
codebase/backend/src/modules/integrations/integrations.service.ts:613  private throwIntegrationNotFound()
codebase/backend/src/modules/schedules/schedules.service.ts:151        private throwScheduleNotFound()
codebase/backend/src/modules/triggers/triggers.service.ts:412          private throwTriggerNotFound()
codebase/backend/src/modules/workspaces/workspaces.service.ts:342      private throwMemberNotFound()
codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:517     private throwCredentialNotFound()  ← 신규
```

동일 `<도메인>NotFound` 명명 축을 따르며 다른 클래스의 동명 메서드와 충돌하지 않는다(각자 자기 클래스에 private). — 충돌 없음.

### 3. API endpoint 충돌
신규 endpoint 없음. `DELETE /api/auth/2fa/webauthn/credentials/:id` 는 `spec/5-system/1-auth.md` §5 에 기존부터 정의돼 있고, 이번 diff 는 그 핸들러 내부 쿼리(`credentialRepo.delete({ id } → { id, userId })`)와 판정(`affected === 0`)만 바꿨다. method+path 신규 도입 없음.

### 4. 이벤트/메시지명 충돌
신규 webhook·queue·SSE 이벤트 없음. 감사 액션 `user.2fa_disabled` 도 기존에 정의된 값을 그대로 재사용(§4.1) — 신규 액션명 도입 없음.

### 5. 환경변수·설정키 충돌
신규 ENV/설정 키 없음.

### 6. 파일 경로 충돌
- `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` (신규) — 형제 8개(`auth-config-delete-concurrency`·`integration-delete-concurrency`·`member-remove-concurrency`·`model-config-delete-concurrency`·`schedule-delete-concurrency`·`trigger-delete-concurrency`·`workflow-delete-concurrency`·`workspace-delete-concurrency`)와 동일한 `<도메인>-delete-concurrency.e2e-spec.ts` 컨벤션을 그대로 따른다. 기존 파일과 이름이 겹치지 않는다.
- `plan/in-progress/webauthn-dup-delete.md` (신규) — `plan/in-progress/` 에 동명 파일 없음, worktree 슬러그(`webauthn-dup-delete-5c9f3a`)와도 일치.
- `webauthn.service.spec.ts` 는 기존 파일에 테스트 추가(신규 파일 아님, 55줄 순증분만).
— 경로 충돌 없음, 컨벤션 위반 없음.

## 참고 — 이 diff 가 "도입"하지 않은 기존 이슈 (참고용, 미차단)

plan(`spec-draft-nullable-notation-followups.md` 신규 backlog 항목)이 스스로 밝히듯, `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드 문자열이 `verifyAuthentication()`(401, line 404 — 이번 diff **밖**·미변경)과 `renameCredential`/`deleteCredential`(404, 신규 헬퍼 경유)이 **동일 코드를 다른 status 로** 내보내는 기존 상태를 실측 확인했다. 이는:
- 이번 diff 가 새로 만든 충돌이 **아니다** — 401 쪽 코드는 origin/main 시점부터 있었고 이번 PR 은 손대지 않았다.
- 이미 같은 `--impl-prep` 라운드(`review/consistency/2026/09/21/17_39_06`)에서 WARNING 으로 발견돼 planner 항목으로 트래커에 등재되었다(spec `3-error-handling.md` §1.11 "유일한 예외" 문구 정정 대기).
따라서 본 리뷰(신규 식별자 충돌)의 범위인 "target 이 새로 도입한 식별자" 에는 해당하지 않아 신규 CRITICAL/WARNING 으로 올리지 않는다 — 이미 알려진, 이미 추적 중인 사안이다.

## 요약

target 은 `spec/5-system` 에 신규 식별자를 전혀 도입하지 않으며(spec 델타 0, `spec_impact: none`), 코드 diff 역시 신규 공개 식별자(요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·spec 파일 경로) 도입이 없다. 유일한 신규 식별자인 private 헬퍼 `throwCredentialNotFound()` 는 형제 서비스들의 `throw<Domain>NotFound()` 명명 축과 정확히 일치해 오히려 일관성을 강화하며, 신규 테스트 파일 경로도 기존 동시성 e2e 컨벤션을 그대로 따른다. diff 가 건드리지 않은 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 의 401/404 이중 사용은 실재하는 기존 결함이지만 이미 별도로 발견·추적 중이라 이 관점에서 재차 차단 사유로 세지 않는다.

## 위험도

NONE
