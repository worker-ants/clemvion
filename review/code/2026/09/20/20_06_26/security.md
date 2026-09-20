# 보안(Security) 코드 리뷰 — dup-delete-audit (2026-09-20 20:06:26)

## 리뷰 범위

- `codebase/backend/src/modules/triggers/trigger-resource-release.ts`
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/workflows/workflows.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/workspaces/workspaces.service.ts` (+ `.spec.ts`)
- `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts` (신규)
- `plan/in-progress/dup-delete-audit.md`, `review/consistency/2026/09/20/19_30_57/**` (산출물 — 코드 아님)

변경 성격: `lockParentAndListTriggerIds` 가 잠금 조회의 결과(`findOne`)를 버리던 것을 `LockedParentTriggers { parent: 'present'|'absent'; triggerIds: string[] }` 로 반환하도록 바꿔, 동시 워크플로 DELETE 두 건이 겹칠 때 두 번째 요청이 "이미 지워진 부모"를 지운 척하며 `workflow.deleted` 감사 행을 중복 생성하던 결함을 닫는다. 저장소 뮤테이션 없음 — 정적 검토만 수행.

## 발견사항

- **[INFO]** 이 변경은 감사 로그(Audit Log) 무결성 결함의 수정이다 — 신규 취약점 아님
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`async remove`, 약 263~312행)
  - 상세: 종전 코드는 동시 DELETE 두 건이 잠금 없는 `findById` 를 모두 통과하면, 먼저 커밋한 요청이 행을 지운 뒤 두 번째 요청도 `manager.remove()`(0행 삭제, 예외 없음)를 거쳐 `workflow.deleted` 감사 행을 한 번 더 남겼다. OWASP A09(Security Logging and Monitoring Failures) 관점에서 감사 추적이 사실과 어긋나는 결함이었다. 이번 변경은 잠금 뒤 `locked.parent === 'absent'` 를 명시적으로 검사해 `NotFoundException`(코드 `RESOURCE_NOT_FOUND`)을 던지고 트랜잭션을 롤백시켜, 두 번째 요청이 404 를 받고 감사가 남지 않게 한다. 데이터 손상이나 권한 우회가 있던 결함이 아니라 감사 신뢰성 문제였고, 이번 수정으로 해소된다. e2e 테스트(`workflow-delete-concurrency.e2e-spec.ts`)가 `SELECT … FOR UPDATE` 로 겹침을 결정적으로 재현해 고치기 전 `[204, 204]`+감사 2건, 고친 뒤 `[204, 404]`+감사 1건을 검증한다.
  - 제안: 없음(개선 확인).

- **[INFO]** `NotFoundException` 메시지·코드에 민감 정보 노출 없음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:280-285` (diff 게이트 기준)
  - 상세: `throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Workflow not found' })` — 고정 문자열이며 내부 스택트레이스·DB 오류·다른 사용자의 존재 여부를 흘리지 않는다. `.catch()` 핸들러도 `NotFoundException` 은 그대로 재던지고, 그 외 실패만 `this.logger.error(...)` 로 서버 로그에 남긴다(클라이언트 응답에는 포함되지 않음). 인가 판단(어느 워크스페이스의 워크플로인지)은 이 diff 이전부터 있던 `findById(id, workspaceId)` 스코핑을 그대로 쓰므로 변경 없음.
  - 제안: 없음.

- **[INFO]** 신규 e2e 테스트의 원시 SQL 은 전부 파라미터 바인딩 — 인젝션 없음
  - 위치: `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts` (전체 파일 컨텍스트 72-73행 `SELECT id FROM workflow WHERE id = $1 FOR UPDATE`, 100-102행 `SELECT COUNT(*)::text … WHERE resource_id = $1 …`)
  - 상세: `id` 값은 애플리케이션이 생성한 UUID(직전 `POST /api/workflows` 응답)이고, 두 쿼리 모두 `$1` 플레이스홀더로 바인딩된다. `resource_type`/`action` 리터럴은 상수 문자열이다. 테스트 전용 코드이며 프로덕션 경로에 영향 없음.
  - 제안: 없음.

- **[INFO]** 인가 검증 순서는 이번 diff 로 바뀌지 않음(회귀 없음)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`deleteWorkspace`, `assertWorkspaceDeletable` 호출부, 약 498-535행)
  - 상세: `WorkspacesService.deleteWorkspace()` 는 이번 diff 로 `lockParentAndListTriggerIds` 반환 구조 분해만 바뀌었고(`const { triggerIds: ids } = await releaser.lockParentAndListTriggerIds(...)`), `parent: 'absent'` 케이스는 의도적으로 별도 분기하지 않는다 — 바로 다음 줄의 `assertWorkspaceDeletable(memRepo, wsRepo, workspaceId, requesterId, { mode: 'pessimistic_write' })` 가 같은 트랜잭션 안에서 워크스페이스 존재·owner 권한을 잠금과 함께 재검사하므로 판정이 여전히 한 곳에 남는다. 권한 검사(owner-only)는 트랜잭션 진입 전에도 한 번 더 수행되어(502-509행 주석 "권한 검사를 외부 해제보다 먼저") 순서가 유지된다. 인가 우회 경로를 만들지 않는다.
  - 제안: 없음.

- **[INFO]** 하드코딩 시크릿·평문 전송·약한 암호화 없음
  - 위치: 전체 diff
  - 상세: 신규/변경 코드에 API 키·토큰·비밀번호 등 하드코딩 없음. `secret-store` 관련 로직(`deleteTriggerSecretsAfterCommit`, `undoAbsentTriggerWrite`)은 이번 diff 로 동작이 바뀌지 않았다(시그니처·순서 동일). e2e 테스트의 `E2E_BASE_URL` 은 테스트 환경 기본값(`http://backend-e2e:3011`)이며 시크릿이 아니다.
  - 제안: 없음.

## 요약

이번 변경은 순수하게 동시성 버그(같은 워크플로/워크스페이스에 대한 동시 DELETE 두 건이 겹칠 때 `workflow.deleted` 감사 행이 중복 기록되던 것)를 닫는 리팩터링이다. 인젝션·하드코딩 시크릿·인가 우회·암호화 약화·에러 메시지를 통한 정보 노출 등 통상적인 보안 취약점 패턴은 발견되지 않았다. 오히려 이 수정은 감사 로그 무결성(OWASP A09 계열)을 개선하는 방향이며, 워크스페이스 삭제 경로의 기존 재검증(`assertWorkspaceDeletable`)·인가 순서는 그대로 보존되어 회귀가 없다. 신규 e2e 테스트의 원시 SQL 은 전부 파라미터 바인딩으로 작성되어 인젝션 위험이 없다. Critical/Warning 은 없다.

## 위험도

NONE
