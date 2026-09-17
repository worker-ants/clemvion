# 보안(Security) 코드 리뷰 — trigger-deletion-release (3라운드)

## 범위와 방법

이 라운드가 보는 diff(`origin/main...HEAD`)는 1·2라운드 리뷰가 이미 LOW 로 처분한 코드 위에, 2라운드
WARNING#2(부모 삭제 트랜잭션의 잠금 대기 무제한)를 고친 커밋 `d2184dcf2` 한 개만 코드 변경으로 더해진
것이다. 검증을 위해 저장소 파일을 수정하지 않았다 — `Read`/`Grep`/`git show`/`git diff`(읽기 전용)만
사용했다. `git status --short` 로 확인한 잔여 변경 없음.

핵심 협력 파일(`trigger-resource-release.ts`, `trigger-resource-releaser.service.ts`, `secret-ref.ts`,
`trigger-config-lock.ts`, `chat-channel-binder.service.ts`, `schedules.service.ts`,
`triggers.service.ts`, `workflows.service.ts`, `workspaces.service.ts`)는 프롬프트에 diff 가
생략된 것(11·12·13·15·16·18·20·21·22번)까지 포함해 원본을 직접 열어 대조했고, `secret-resolver.service.ts`
의 `deleteByPrefix` 구현(이번 diff 밖, 기존 코드)도 재확인했다.

## 발견사항

- **[INFO]** (1·2라운드에서 이미 지적·처분된 항목, 이번 라운드 코드 변경 없음) 워크스페이스 삭제의
  잠금 없는 선검사 ↔ 잠금 재검사 사이 역할-변경 창
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `deleteWorkspace()`(502-552행),
    `assertWorkspaceDeletable()`(564-598행)
  - 상세: 요청 시작 시점엔 owner였던 호출자가 `assertWorkspaceDeletable`(잠금 없음) 통과 후·
    `releaseExternalForParent`(되돌릴 수 없는 schedule job 해제·provider teardown) 실행 후, 트랜잭션 안
    `pessimistic_write` 재검사 시점에 role 을 잃으면 재검사가 정확히 거부하지만 외부 해제는 이미 끝난
    뒤다. 최종 삭제 결정은 여전히 잠금 재검사가 정확히 강제하므로 **인가 우회는 아니고**, 결과는 "워크스페이스는
    살아 있는데 그 안 트리거가 발화하지 않는" 가용성 저하에 국한된다. 이번 라운드가 고친 `d2184dcf2` 는
    이 창의 **성격을 바꾸지 않는다** — `lockParentAndListTriggerIds`(부모 잠금+트리거 열거)를 트랜잭션의
    첫 호출로 옮기고 그 앞에 재검사를 두었지만, 두 호출 모두 같은 트랜잭션 안이고 재검사가 여전히 행 삭제
    (`invRepo.delete`/`memRepo.delete`/`wsRepo.remove`) 앞에서 거부하면 트랜잭션 전체가 rollback 되며,
    `.catch` 가 다시 던지는 예외 때문에 `releaseSecretsAfterCommit` 호출부(트랜잭션 `await` 뒤)에는
    도달하지 못한다 — 재검사 실패 시 비밀 삭제가 실행되지 않음을 코드 흐름으로 직접 확인했다.
  - 제안: 조치 불요(1·2라운드에서 이미 "가시화 + 회귀 테스트"로 처분, 이번 라운드에서 재확인만 함).

- **[INFO]** `d2184dcf2` 의 재정렬(잠금+열거를 재검사보다 먼저)이 새로 여는 표면 없음 — 검증 결과 기록
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:520-531`(`deleteWorkspace`
    트랜잭션 콜백), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:72-95`
    (`lockParentAndListTriggerIds`)
  - 상세: 이 커밋이 `lockParentAndListTriggerIds`(부모 행 `pessimistic_write` 잠금 + 트리거 id 열거)를
    `assertWorkspaceDeletable` 재검사보다 앞으로 옮겼다. 이 때문에 "재검사에서 결국 거부될 요청"도 잠금 획득과
    트리거 id 열거는 수행하게 되지만 (a) 트리거 id 열거 결과는 클라이언트에 반환되지 않고 내부에서만 쓰이며,
    (b) 재검사가 거부하면 위에서 확인했듯 비밀 삭제·행 삭제 어느 쪽도 실행되지 않으므로 정보 노출·인가 우회
    표면이 새로 생기지 않는다. 오히려 이 커밋의 본래 목적(잠그기 **전에** `SET LOCAL lock_timeout` 5초를
    걸어야 뒤따르는 멤버십 잠금·CASCADE 잠금까지 상한이 적용된다)대로, 이전에는 **무제한**이었던 부모 행
    잠금 대기가 상한을 갖게 되어 "외부 자원은 이미 되돌릴 수 없게 해제됐는데 잠금이 무한 대기로 걸려
    반쯤 삭제된 상태가 관측 불가능한 hang 으로 굳는" 가용성 결함(2라운드 WARNING#2, DoS 성격)이 닫혔다 —
    순수하게 보안 강화 방향의 변경이다.
  - 제안: 조치 불요.

- **[INFO]** (1·2라운드 반복 확인) 커밋 뒤 비밀 삭제 실패는 예외를 던지지 않고 로그로만 남음
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts`
    `deleteTriggerSecretsAfterCommit()`(54-70행)
  - 상세: 설계상 의도된 트레이드오프(행 삭제가 이미 커밋된 뒤라 500 을 주면 재시도가 404 가 되는 문제를
    피함)이고 JSDoc·plan(sweeper 후속 트래커)에 이미 명시돼 있다. 이번 라운드에서 코드 변경 없음.
  - 제안: 조치 불요 — 후속 트래커(사후 정리 sweeper)에서 재판단 예정.

## 검증한 항목 (문제 없음 — 근거만 기록, 1·2라운드와 동일 결론 재확인)

- **`SET LOCAL lock_timeout` 문자열 보간**: `trigger-config-lock.ts` `setLocalLockTimeout()`(63-70행)은
  파라미터 바인딩이 안 되는 자리라 문자열 보간을 쓰지만, `toLockTimeoutMs()`(45-55행)가 `Number.isFinite`
  검사 후 `Math.trunc`+`Math.min/max` 로 정수·범위를 강제해 SQL 깨짐이 불가능하고, 실제 호출부는 전부
  모듈 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)만 넘긴다(변수·사용자 입력 경로 0건, 이번 라운드에 새로
  추가된 호출부 `lockParentAndListTriggerIds` 도 같은 상수를 넘긴다) — 인젝션 표면 아님.
- **`secret_store.deleteByPrefix` 인젝션·과잉삭제 방어**: `secret-resolver.service.ts:182-200`. TypeORM
  파라미터 바인딩(`ref LIKE :prefix`) + `%`/`_`/`\` 메타문자 거부 + `secret://` 접두 강제. 새 헬퍼
  `buildSecretRefPrefix`/`triggerSecretPrefix` 는 `Trigger.id`(UUID PK)만 넘겨 메타문자가 섞일 수 없다.
- **경계 접두 충돌 방지**: `trig-1` 접두가 `trig-10` 을 덮지 않음을 `secret-ref.spec.ts`·
  `trigger-resource-release.spec.ts` 양쪽에서 코드로 확인.
- **인가 순서**: `WorkflowsService.remove`/`WorkspacesService.deleteWorkspace` 모두 워크스페이스 스코프
  확인(`findById`)·owner 검사(`assertWorkspaceDeletable`, 잠금 없음)가 되돌릴 수 없는 외부 자원 해제
  (`releaseExternalForParent`)보다 **항상 먼저** 실행된다 — 컨트롤러 가드(`workflows.controller.ts`
  `@Roles('editor')`, `workspaces.controller.ts`)도 이번 PR 로 변경되지 않았다.
- **크로스-테넌트 스코프**: `TriggersService.findById`/`SchedulesService.findById` 는 `{id, workspaceId}`
  로 조회해 다른 워크스페이스 자원을 정리 대상에 끌어들일 수 없다. `TriggerParent`(`{workflowId}`/
  `{workspaceId}`)도 이미 인가 검증을 거친 부모 id 만 쓴다.
- **에러 메시지 정보 노출**: 신규/변경된 실패 경로(`schedule job 해제 실패…`, `…행 삭제가 실패했다…`)는
  모두 평범한 `Error` 이고, `GlobalExceptionFilter`(`http-exception.filter.ts:76-89`)가 `HttpException`
  이 아닌 `Error` 를 서버 로그로만 원문을 남기고 클라이언트에는 고정 문구(`UNHANDLED_ERROR_MESSAGE`) 500
  만 반환한다 — BullMQ/DB 실패 상세·트리거 id·secret ref 가 API 응답으로 새지 않는다.
- **하드코딩된 시크릿**: `git diff origin/main -- codebase` 전체에서 `password=`/`token=`/`AKIA…`/
  `BEGIN … PRIVATE` 류 패턴을 grep 했다. 매치된 것은 `trigger-deletion-releases-resources.e2e-spec.ts`
  의 `process.env.REDIS_PASSWORD`·`process.env.DB_PASSWORD ?? 'clemvion-e2e'`·`accessToken` 변수명뿐 —
  이 저장소 기존 e2e 스펙(`app.e2e-spec.ts` 등) 전반의 로컬 테스트 DB 관례와 동일하며, 실 자격증명이나
  이번 PR 이 새로 도입한 값이 아니다. 비밀 행은 `Buffer.from('ciphertext-placeholder')` placeholder 로만
  심어 평문이 코드에 존재하지 않는다.
- **암호화**: 이번 diff 는 새 해시/암호화 알고리즘을 도입하지 않았다 — 기존 `SecretResolverService` 의
  암·복호화 경로는 손대지 않았다(비밀은 ref 접두로만 지우고 복호화하지 않는다).

## 요약

이번(3) 라운드에서 실제로 새로 들어온 코드 변경은 커밋 `d2184dcf2` 하나이며, 그 내용은 워크플로·
워크스페이스 삭제 트랜잭션의 부모 행 잠금 대기에 5초 상한을 거는 가용성 하드닝이다. 재정렬(잠금+열거를
권한 재검사보다 앞으로 이동)이 인가 결정 순서나 비밀·행 삭제 실행 조건을 바꾸지 않음을 코드 흐름으로
직접 확인했고, 오히려 이전에 존재하던 "외부 자원은 이미 되돌릴 수 없게 해제됐는데 잠금이 무제한 대기라
DoS 성격의 hang 이 가능하다"는 결함을 닫는 방향이라 보안 관점에서는 순수한 개선이다. 나머지 코드
(secret_store 접두 삭제, 인가 순서, 에러 마스킹, 크로스-테넌트 스코프)는 1·2라운드에서 이미 상세히
검증됐고 이번 라운드에서 재확인한 결과도 동일하다 — 신규 인젝션·하드코딩된 시크릿·인증 우회·안전하지
않은 암호화는 발견되지 않았다. 유일하게 남는 항목(워크스페이스 삭제의 선검사↔재검사 사이 역할-변경
창)은 인가 우회가 아닌 가용성 트레이드오프이며 이미 문서화·테스트·트래커 등재가 끝난 상태다.

## 위험도

LOW
