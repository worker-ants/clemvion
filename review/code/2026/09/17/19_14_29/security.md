# 보안(Security) 코드 리뷰 — trigger-deletion-release

검증을 위해 저장소 파일을 수정하지 않았다 — `Read`/`Grep`/`Bash`(읽기 전용 grep·git diff·git status) 만
사용했다. `git status --short` 로 확인한 잔여 변경 없음(세션 시작 시 이미 존재하던
`review/code/2026/09/17/19_14_29/` 스캐폴드 외 다른 항목 없음).

## 점검 범위

프롬프트에 diff 가 생략된 파일(11·12·14·15·17·19·21·22 번)은 원본을 직접 `Read`/`git diff origin/main...HEAD`
로 열어 대조했다: `trigger-resource-releaser.service.ts`, `triggers.service.ts`(전체, `remove`·
`rotateBotToken`·`promoteRotatedNotificationSecrets` 포함), `workflows.service.ts`(`remove`),
`workspaces.service.ts`(`deleteWorkspace`·`assertWorkspaceDeletable`), `secret-resolver.service.ts`,
`secret-ref.ts`, `workspaces.controller.ts`/`workflows.controller.ts`(가드 확인),
`workspaces.service.spec.ts`(신규 인가 테스트), `trigger-deletion-releases-resources.e2e-spec.ts`.

## 발견사항

- **[INFO]** 워크스페이스 삭제 — 잠금 없는 선검사와 잠금 재검사 사이의 역할-변경 창(이미 문서화·테스트된 트레이드오프)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `deleteWorkspace()`(502-513행: 선검사 → `releaseExternalForParent` 호출) / `assertWorkspaceDeletable()`(563-597행)
  - 상세: `deleteWorkspace` 는 외부 자원(schedule job·chat-channel provider 등록·listener)을 건드리기 **전에** `assertWorkspaceDeletable`(잠금 없음)로 owner 여부를 선검사하고, 실제 삭제 결정은 트랜잭션 안에서 **잠금 재검사**로 확정한다. 요청 시작 시점엔 owner였던 호출자가 두 검사 사이(동시에 다른 owner/admin 이 role 을 바꾸는 좁은 창)에 role 을 잃으면, 트랜잭션은 `ForbiddenException` 으로 정확히 거부되어 워크스페이스는 지워지지 않지만 — 되돌릴 수 없는 외부 해제(schedule job 삭제·provider webhook teardown)는 **이미 실행된 뒤**다. 이건 새로운 권한 우회는 아니다(최종 삭제 결정은 여전히 잠금 재검사가 정확히 강제한다) — 호출자는 요청 시점에 실제로 owner 였다. 다만 결과적으로 "워크스페이스는 살아있는데 그 안의 트리거는 발화하지 않는" 가용성 저하가 남는다. `WorkspacesService.deleteWorkspace: … 이미 끝났으므로 …` error 로그로 가시화돼 있고(541-544행), `workspaces.service.spec.ts` 에 회귀 테스트(`선검사 뒤 역할이 바뀌어 재검사가 거부하면…`)가 이 케이스를 명시적으로 고정한다. 전임 리뷰 라운드(`review/code/2026/09/17/18_45_09`)에서 이미 SUMMARY #2·#4 로 지적됐고 처분은 "가시화" — 근본적으로 닫힌 창은 아니다.
  - 제안: 조치 불요(이미 알려지고 추적된 트레이드오프). 다음에 이 경로를 만지게 되면 `assertWorkspaceDeletable` 의 선검사를 완전히 생략하지 말고, "닫으려면 외부 해제 자체를 잠금 뒤로 옮겨야 한다"는 기존 JSDoc 트레이드오프(§4.3 잔여 목록)를 재확인할 것.

- **[INFO]** `ModuleRef.get(TOKEN, { strict: false })` Service Locator 가 Nest 모듈 `exports` 캡슐화를 우회한다 — 다만 공격 표면은 아니다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:136-141`(`resolveTriggerResourceReleaser`), 호출부 `workflows.service.ts:267`, `workspaces.service.ts:512`
  - 상세: `TriggersModule` 이 `TriggerResourceReleaserService`/`TRIGGER_RESOURCE_RELEASER` 를 `exports` 에 넣지 않았는데도(module 정의 확인) `strict:false` 전역 컨테이너 조회로 정상 동작한다. 이건 순환 의존 회피를 위한 **완전히 내부적인 DI 배선**이고, 토큰·값 모두 사용자 입력이 관여하지 않으며 HTTP 경계에 노출되지 않는다 — 인가 우회나 인젝션 표면이 아니다. 이미 architecture 리뷰어가 유지보수성 관점(WARNING)으로 다뤘으므로 여기서는 보안 관점에서 "표면 아님"만 확인해 둔다.
  - 제안: 조치 불요(보안 관점). 유지보수성 권고는 architecture.md 참조.

## 검증한 항목 (문제 없음 — 근거만 기록)

- **`secret_store.deleteByPrefix` 인젝션 방어**: `secret-resolver.service.ts:182-200`. TypeORM 파라미터 바인딩(`ref LIKE :prefix`)이라 SQL 인젝션 표면이 아니고, 이번 PR 이 새로 만든 `buildSecretRefPrefix`(호출자가 임의 문자열을 넣을 가능성)를 대비해 `%`/`_`/`\` 메타문자와 `secret://` 접두 검사를 이미 갖추고 있어, 새 호출부(`triggerSecretPrefix` → 네 삭제 경로)가 넓은 범위를 지우는 경로가 없다. `resourceId`(트리거 UUID)는 내부에서 생성되는 값이라 메타문자가 들어갈 수 없다.
- **경계 접두 충돌 방지**: `secret-ref.spec.ts`·`trigger-resource-release.spec.ts` 가 `trig-1` 접두가 `trig-10` 의 ref 를 덮지 않음(끝 `/`)을 양방향으로 단언한다 — 직접 실행 코드로 대조.
- **비밀 삭제 시점**: 네 삭제 경로 모두 `secret_store` 정리를 **행 삭제 커밋 뒤**에만 수행하고(`deleteTriggerSecretsAfterCommit`), 실패해도 던지지 않고 error 로그만 남긴다(`trigger-resource-release.ts:54-70`) — 이미 되돌릴 수 없는 삭제 뒤에 500 을 반환해 클라이언트가 재시도 → 404 를 받는 상황을 피한다.
- **인가 순서(권한 검사가 외부 자원 해제보다 항상 먼저)**: `workspaces.service.ts` 의 `deleteWorkspace`(트랜잭션 밖 `assertWorkspaceDeletable` → `releaseExternalForParent`)와 `workflows.service.ts` 의 `remove`(`findById(id, workspaceId)` 로 workspace 스코프 검증 → `releaseExternalForParent`)가 둘 다 인가/스코프 확인이 끝난 뒤에만 외부 자원(schedule job·provider 등록·listener)을 건드린다. `workspaces.service.spec.ts` 신규 테스트(`'owner 가 아니면(403) 외부 자원을 건드리지 않는다'`)가 `releaseExternalForParent`/`releaseSecretsAfterCommit` 미호출을 직접 단언한다.
- **크로스-테넌트 스코프**: `TriggersService.findById`/`SchedulesService.findById` 는 모두 `{ id, workspaceId }` 로 조회해 다른 워크스페이스의 트리거·스케줄을 대상으로 삭제·비밀 정리를 못 한다. `WorkflowsService.remove`/`WorkspacesService.deleteWorkspace` 가 넘기는 `TriggerParent`(`{workflowId}`/`{workspaceId}`)도 이미 인가 검증을 거친 부모의 id 만 쓴다.
- **에러 메시지의 정보 노출**: 네 삭제 경로·binder 보상 경로가 던지는 실패(`schedule job 해제 실패 — …`, `trigger=<id> 의 행 삭제가 실패했다 — …`)는 전부 평범한 `Error` 다. `GlobalExceptionFilter`(`common/filters/http-exception.filter.ts:76-89`)는 `HttpException` 이 아닌 `Error` 를 서버 로그(`logger.error`)로만 원문을 남기고 클라이언트에는 `UNHANDLED_ERROR_MESSAGE`(고정 문구) 500 만 반환한다 — BullMQ/DB 에러 상세, secret ref, 트리거 id 등이 API 응답으로 새지 않는다. `SecretResolverService.resolve()` 의 복호화 실패 경로(79-108행)도 `cause` 를 일부러 부착하지 않고 고정 메시지(`'Secret decryption failed'`)만 던진다(`#814` SSRF 교훈 인용, 기존 코드 — 이번 PR 로 인한 변경 아님).
- **테스트 픽스처의 시크릿**: `trigger-deletion-releases-resources.e2e-spec.ts` 의 `seedSecrets`는 placeholder 암호문(`Buffer.from('ciphertext-placeholder')`)만 심어 실제 평문이 필요 없다. `DB_PASSWORD ?? 'clemvion-e2e'` fallback 은 이 저장소 e2e 스펙 전반(`app.e2e-spec.ts`·`trigger-update-save-window.e2e-spec.ts` 등)의 기존 로컬 테스트 DB 관례와 동일하다 — 실 자격증명이 아니다. `git diff` 전체에서 API 키·인증서·평문 자격증명 패턴(`AKIA…`·`sk-…`·`ghp_…`·`-----BEGIN…`) 매칭 0건.
- **인가 가드 미변경**: `workflows.controller.ts`(`@Roles('editor')`)·`workspaces.controller.ts`(`@Delete(':id')`, service-level owner 검사)의 컨트롤러 데코레이터는 이 PR 로 변경되지 않았다 — 서비스 내부 자원 정리 로직만 재배선됐고 엔드포인트 인가 경계는 그대로다.
- **로그 접두 정정(`ChatChannelBinderService`)**: `TriggersService:` → `ChatChannelBinderService:` 정정은 로그 메시지 텍스트만 바꾸고 비밀·PII 를 새로 로그에 싣지 않는다 — 보안 등급 변화 없음.

## 요약

이번 변경은 트리거 행을 없애는 네 경로(트리거·스케줄·워크플로·워크스페이스 삭제) 모두에서 암호화된 비밀(`secret_store`)·BullMQ job·chat-channel provider 등록을 정리하도록 통합했다. 새로 추가된 `secret_store` 접두 삭제 경로(`buildSecretRefPrefix`/`triggerSecretPrefix`)는 기존에 이미 하드닝된 `deleteByPrefix`(LIKE 메타문자 거부 + `secret://` 접두 강제)를 그대로 재사용해 인젝션이나 과도 삭제 표면을 새로 열지 않았고, 비밀 정리는 항상 행 삭제 **커밋 뒤**·실패해도 던지지 않는 정책으로 일관된다. 인가 순서(외부 자원 해제는 권한 검사 뒤에만 실행)는 워크플로·워크스페이스 삭제 양쪽에서 지켜지고 있고, 신규 단위 테스트가 "403 이면 외부 자원을 건드리지 않는다"를 명시적으로 고정한다. 에러 메시지는 `GlobalExceptionFilter` 가 비-`HttpException` 을 전부 마스킹하므로 BullMQ/DB 실패 상세가 API 응답으로 새지 않는다. 유일하게 남는 항목은 워크스페이스 삭제의 "잠금 없는 선검사 ↔ 잠금 재검사" 사이의 이미 문서화·테스트된 좁은 창(가용성 저하이지 인가 우회는 아님)이며, 이는 전임 리뷰 라운드에서 이미 다뤄지고 처분(가시화)된 항목이라 이번 라운드에서 추가 조치는 불요하다. 신규 하드코딩된 시크릿·SQL/커맨드 인젝션·인증 우회는 발견되지 않았다.

## 위험도

LOW
