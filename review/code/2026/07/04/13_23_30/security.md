# Security Review — RE-REVIEW (fix verification)

## 대상

`codebase/backend/src/modules/executions/executions.controller.ts`
(`simulateExecutionRunRedeliveryForTest`, PR4 e2e test-hook), 커밋 `3f6c3dfab`
("PR4 ai-review Warning 조치") 의 IDOR 수정 검증.

## 이전 라운드 지적

Test-hook `POST :id/_test/simulate-execution-run-redelivery` 가 `:id` 로 임의
`executionId` 를 받아 `runExecutionFromQueue` 를 직접 구동하면서, 요청자의
workspace 소속과 `id` 가 가리키는 Execution 의 workspace 소속을 대조하는
`verifyOwnership` 호출이 없어 cross-workspace IDOR 가능(다른 워크스페이스
owner 가 타 워크스페이스 executionId 를 추측/열거해 강제 재구동 트리거 가능).

## 적용된 수정 확인

```ts
@Post(':id/_test/simulate-execution-run-redelivery')
@HttpCode(HttpStatus.ACCEPTED)
@Roles('owner')
@ApiExcludeEndpoint()
async simulateExecutionRunRedeliveryForTest(
  @Param('id', ParseUUIDPipe) id: string,
  @WorkspaceId() workspaceId: string,
) {
  if (process.env.NODE_ENV !== 'test' || process.env.E2E_TEST_HOOKS !== '1') {
    throw new NotFoundException();
  }
  await this.executionsService.verifyOwnership(id, workspaceId);
  await this.executionEngineService.runExecutionFromQueue(id, {});
  return { success: true };
}
```
(`codebase/backend/src/modules/executions/executions.controller.ts:232-249`)

검증 항목:

1. **순서가 올바르다** — env 게이트(`NODE_ENV`/`E2E_TEST_HOOKS`) 를 먼저 통과해야
   `verifyOwnership` 이 호출된다. 프로덕션(`NODE_ENV!=='test'`)에서는 여전히
   가장 먼저 404 로 라우트 부재처럼 처리되어 워크스페이스 소유권 로직을 타지도
   않는다 — 정보 노출 표면이 늘지 않았다.
2. **`verifyOwnership` 구현이 안전하다** — `executions.service.ts:215-236`.
   `executionId` 로 Execution→Workflow→`workspaceId` 를 조회해 요청자
   `workspaceId` 와 불일치하거나 row 자체가 없으면 **동일하게 404
   `RESOURCE_NOT_FOUND`** 를 던진다(403 을 쓰지 않음 — 코드 주석에 "attacker 가
   ID 존재 여부를 추론할 수 있다" 는 enumeration 방지 근거 명시). 같은 컨트롤러의
   다른 `:id` 엔드포인트(`re-run` 등)와 동일 패턴이라 일관성도 확보.
3. **`@WorkspaceId()` 데코레이터**가 `X-Workspace-Id` 헤더 또는 JWT
   `workspaceId` 부재 시 `BadRequestException(WORKSPACE_ID_REQUIRED)` 를 던져
   workspaceId 미제공 요청 자체가 차단된다(`common/decorators/workspace.decorator.ts:7-24`)
   — `verifyOwnership` 에 빈 문자열/undefined 가 흘러들어가는 경로 없음.
4. **`@Roles('owner')` 가드는 요청자 자신의 role 만 확인**하고 `id` 의 소속은
   보지 않는다는 사실을 코드 주석으로 명시 — 이번 fix 가 그 간극을 정확히
   메운다. 이중 방어(env 게이트 + role 가드 + ownership 검증)로 방어 계층이
   중첩되어 있다.
5. **실패 시 부작용 없음** — `verifyOwnership` 이 throw 하면
   `runExecutionFromQueue` 호출부에 도달하지 않는다(코드 흐름상 자명, 그리고
   `executions.controller.spec.ts:237-249` 유닛 테스트가 명시적으로
   `runExecutionFromQueue` 가 `not.toHaveBeenCalled()` 임을 검증).
6. **유닛 테스트 커버리지** (`executions.controller.spec.ts:208-273`) 가
   4-케이스(정상 경로/ownership 실패 전파/NODE_ENV 불일치 시 ownership 호출도
   안 됨/플래그 누락 시 차단)를 모두 가드 — 게이팅과 ownership 순서를 회귀
   방지 수준으로 고정.
7. **새로 도입된 문제 없음** — `id` 는 `ParseUUIDPipe` 로 UUID 형식만
   통과(인젝션/포맷 오염 방지, 기존 그대로), 에러 메시지에 민감정보 노출 없음
   (`NotFoundException` 고정 메시지), 하드코딩 시크릿 없음, 이 엔드포인트는
   여전히 `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 게이트 뒤에 있어 프로덕션
   표면에 노출되지 않는다(운영 이미지는 두 조건 모두 불충족).

## 발견사항

없음(no findings). 이전 라운드에서 지적한 IDOR(권한 검증 누락)는 완전히
해소되었고, 수정으로 인한 새 취약점(우회 가능 게이트 순서, 정보 노출, 로직
누락 등)은 발견되지 않았다.

## 요약

Cross-workspace IDOR 지적에 대한 수정은 정확하다 — env 게이트 → ownership
검증 → 실제 재구동 호출의 순서가 올바르고, ownership 실패 시 404 로 통일해
enumeration 도 차단하며, 같은 컨트롤러의 기존 `:id` 패턴과 일관된다. 유닛
테스트가 게이팅·ownership·부작용 없음을 회귀 방지 수준으로 고정했다. 이
test-hook 은 여전히 이중 게이트(`NODE_ENV`/`E2E_TEST_HOOKS`) 뒤에 있어
프로덕션 노출 위험도 없다. 새로 도입된 보안 이슈는 없다.

## 위험도

NONE
