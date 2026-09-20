# 보안(Security) 리뷰 — 동시 DELETE 감사 중복 (dup-delete-audit, 3라운드 21_07_19)

## 리뷰 범위

- `codebase/backend/src/modules/triggers/trigger-resource-release.ts` (+ `.spec.ts` 아님, 인터페이스 파일)
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/workflows/workflows.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/workspaces/workspaces.service.ts` (+ `.spec.ts`)
- `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts` (신규)
- `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts` (신규)
- `CHANGELOG.md`, `plan/in-progress/dup-delete-audit.md`, `review/code/2026/09/20/{20_06_26,20_43_03}/**`, `review/consistency/2026/09/20/19_30_57/**` — 코드가 아니라 문서/이전 리뷰 세션 산출물

이번 번들은 origin/main 대비 누적 diff 전체이며, 앞선 두 라운드(`20_06_26`→Critical 0/Warning 4, `20_43_03`→Critical 0/Warning 2)가 이미 이 코드를 보안 관점에서 각각 NONE 위험도로 검토했다. 최신 커밋(`c3607d907`)은 워크스페이스 삭제 경로의 403→404 수정을 실 DB e2e 로 고정하고 plan 문서 필드명(`parent`→`parentPresence`)을 정정한 것으로, 보안에 영향을 주는 로직 변경이 아니다. 현재 파일 상태를 `Read`로 직접 대조해 재확인했다(저장소 뮤테이션 없음, `git status --short` 확인 결과 이 세션이 만든 출력 디렉터리 외 변경 없음).

## 발견사항

없음 — Critical/Warning 급 보안 결함을 찾지 못했다.

### 확인한 항목 (참고, INFO)

- **[INFO]** 인젝션 표면 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:81-107`(`lockParentAndListTriggerIds` — `manager.findOne`/`manager.find`, TypeORM 파라미터 바인딩), `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts:72-73,99-103`, `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts:66-68,93-98`(원시 SQL — 모두 `$1`/`$2` 플레이스홀더)
  - 상세: 신규 워크스페이스 e2e(`workspace-delete-concurrency.e2e-spec.ts`)를 포함해 이번 3라운드에 새로 추가된 파일까지 직접 확인했다. `SELECT id FROM workspace WHERE id = $1 FOR UPDATE`, `SELECT (SELECT COUNT(*) FROM workspace WHERE id = $1) + ... AS count` 모두 파라미터 바인딩이고, `workspaceId`는 애플리케이션이 직전에 생성한 UUID다. 문자열 결합으로 사용자 입력을 SQL에 직접 넣는 자리는 없다.
  - 제안: 없음.

- **[INFO]** 인가(authorization) 순서 회귀 없음 — 신규 404 단락은 인가 통과 이후에만 도달
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:263-285`(`remove`, `findById(id, workspaceId)` 로 워크스페이스 스코프 확인 후 트랜잭션 진입), `codebase/backend/src/modules/workspaces/workspaces.service.ts:498-535`(`deleteWorkspace` — 트랜잭션 밖에서 `assertWorkspaceDeletable` 로 owner 권한 선검사 후 트랜잭션 안에서 `parentPresence==='absent'` 검사, 이어서 잠금 재검사)
  - 상세: `lockParentAndListTriggerIds` 가 새로 돌려주는 `parentPresence: 'absent'` 분기는 이미 인가(워크플로: workspace 스코프 조회, 워크스페이스: owner 권한 선검사)를 통과한 뒤에만 실행되며, "다른 이미-인가된 동시 요청이 먼저 커밋해 행이 사라졌다"는 경우에만 발동한다. 인가 우회·IDOR 로 이어지는 경로가 아니다. 워크스페이스 경로는 `parentPresence==='absent'` 를 `assertWorkspaceDeletable` 의 잠금 재검사보다 **먼저** 검사하도록 이번 PR 이 새로 추가했지만(`workspaces.service.ts:530`), 이는 판정 순서를 앞당긴 것일 뿐 재검사 자체를 생략하지 않는다 — 자원이 실제로 존재하는 정상 경합이 아닌 케이스(예: 소유권 변경)에서는 여전히 `assertWorkspaceDeletable` 재검사가 그대로 수행된다.
  - 제안: 없음.

- **[INFO]** 에러 메시지·감사 로그에 민감 정보 노출 없음
  - 위치: `workflows.service.ts:280-284`(`NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Workflow not found' })`), `workspaces.service.ts:530-534`(`NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: '워크스페이스를 찾을 수 없습니다.' })`), 두 파일의 `.catch` 안 `this.logger.error(...)`(`workflows.service.ts:295-299`, `workspaces.service.ts:556-560`)
  - 상세: 두 예외 모두 기존 `findById`/`assertWorkspaceDeletable` 가 이미 쓰던 것과 동일한 일반 문구를 재사용하며, 스택트레이스·SQL 오류·다른 사용자의 존재 여부를 흘리지 않는다. `logger.error`가 담는 `err.message`는 서버 로그 전용이고 HTTP 응답 바디로 전달되지 않는다 — 오히려 이번 diff 가 추가한 `if (err instanceof NotFoundException) throw err;` 가드는 정상적인 동시-삭제 패배를 "수동 정리가 필요하다"는 오탐성 error 로그로 남기던 것을 줄이는 방향(로그 신호 대 잡음비 개선)이며, 로그에 새로운 민감 정보를 추가하지 않는다.
  - 제안: 없음.

- **[INFO]** 감사 로그(Audit Log) 무결성 개선 — OWASP A09(Security Logging and Monitoring Failures) 관점의 결함 수정, 신규 취약점 아님
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:117-129`(`LockedParentTriggers` 인터페이스), `trigger-resource-releaser.service.ts:81-107`(구현)
  - 상세: 종전 코드는 동시 DELETE 두 건이 잠금 없는 `findById`/`assertWorkspaceDeletable` 선검사를 모두 통과하면, 먼저 커밋한 쪽이 행을 지운 뒤에도 두 번째 요청이 `manager.remove()`(0행이어도 예외 없음)를 통해 `workflow.deleted`/워크스페이스 삭제 감사 행을 한 번 더 남겼다. 이번 변경은 잠금 뒤 읽은 부모 행의 존재 여부를 이름 있는 값(`'present' | 'absent'`)으로 호출자에게 돌려주고, `absent` 면 404 로 단락해 감사 중복을 막는다. 데이터 손상이나 권한 우회가 있던 결함이 아니라 감사 신뢰성 문제였고, e2e 두 건(`workflow-delete-concurrency.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`)이 실 DB 행 락으로 겹침을 결정적으로 재현해 고치기 전/후 상태를 실측 고정했다.
  - 제안: 없음(개선 확인).

- **[INFO]** 하드코딩된 시크릿·평문 전송·약한 암호화 없음
  - 위치: 전체 diff(코드 8파일 + 신규 e2e 2개 + 문서/리뷰 산출물)
  - 상세: API 키·비밀번호·토큰·인증서 리터럴 없음. 신규 e2e 두 파일의 `token`/`accessToken`은 `registerAndLogin()`이 런타임에 로그인해 발급받는 JWT를 로컬 변수에 담은 것이지 하드코딩된 자격증명이 아니다. `E2E_BASE_URL` 기본값(`http://backend-e2e:3011`)도 시크릿이 아니라 docker-compose 네트워크 내부 호스트명이다. `secret-store` 관련 로직(`deleteTriggerSecretsAfterCommit`, `releaseSecretsAfterCommit`)은 이번 diff 로 시그니처·순서가 바뀌지 않았다. (참고, diff 밖: `codebase/backend/test/helpers/db.ts`/`helpers/auth.ts`가 갖는 로컬 e2e 전용 고정 자격증명은 이번 변경 범위 밖의 기존 파일이며 새 결함이 아니다.)
  - 제안: 없음.

- **[INFO]** 의존성 변경 없음
  - 상세: `package.json`/lockfile 변경 없음. 신규 e2e 스펙이 쓰는 `pg`, `supertest`, `@jest/globals`는 기존 devDependency 재사용이다.
  - 제안: 없음.

## 요약

이번 3라운드 diff는 동시 DELETE 두 건이 `workflow.deleted`/워크스페이스 삭제 감사 행을 중복 기록하던 TOCTOU 성격의 결함을, 이미 `pessimistic_write`로 잠그며 읽던 부모 행의 존재 여부를 폐기하지 않고 `{ parentPresence, triggerIds }`로 호출자에게 명시 반환하는 방식으로 닫는다. 새로 추가된 404 단락은 두 경로(워크플로·워크스페이스) 모두 인가가 이미 끝난 지점 이후에만 동작해 인가 우회·IDOR로 이어지지 않으며, 워크스페이스 경로의 판정 순서 변경(재검사보다 먼저 `absent` 확인)도 재검사 자체를 생략하지 않는다. 모든 쿼리는 파라미터 바인딩(TypeORM/`$n` placeholder)이라 인젝션 표면이 없고, 신규 워크스페이스 e2e를 포함해 확인했다. 에러 메시지·서버 로그 모두 기존과 동일한 일반 문구를 재사용해 정보 노출이 없으며, 오히려 거짓 "수동 정리 필요" 로그를 줄이는 방향이다. 하드코딩 시크릿·암호화 약화·의존성 변경은 없다. 앞선 두 라운드(`20_06_26`, `20_43_03`)의 보안 리뷰 결론(NONE)과 이번 재확인 결과가 일치한다 — Critical/Warning 없음.

## 위험도

NONE
