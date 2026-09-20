# 보안(Security) 리뷰 — 동시 DELETE 감사 중복 (dup-delete-audit)

## 발견사항

없음 — Critical/Warning 급 보안 결함을 찾지 못했다.

### 확인한 항목 (참고, INFO)

- **[INFO]** 인젝션 표면 없음 확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (`lockParentAndListTriggerIds`, 게이트 81-109행), `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts` (게이트 72-101행)
  - 상세: 변경된 쿼리는 전부 TypeORM `manager.findOne`/`manager.find` (파라미터 바인딩) 이고, 신규 e2e 의 원시 SQL(`SELECT id FROM workflow WHERE id = $1 FOR UPDATE`, `SELECT COUNT(*) ... WHERE resource_id = $1 AND action = $2`류)도 `$1`/`$2` 플레이스홀더로 파라미터화되어 있다. 문자열 결합으로 사용자 입력을 SQL 에 직접 넣는 자리는 없다.
  - 제안: 조치 불요.

- **[INFO]** 인가(authorization) 순서 재확인 — 회귀 없음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`remove`, 게이트 262-289행 및 `findById` 166-177행), `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`deleteWorkspace`, 게이트 498-556행 및 `assertWorkspaceDeletable`)
  - 상세: 이번 diff 가 추가한 `if (locked.parentPresence === 'absent') throw new NotFoundException(...)` 단락은 **이미 인가가 끝난 뒤**(워크플로: `findById(id, workspaceId)` 로 workspaceId 스코프 확인 완료, 워크스페이스: 메서드 진입부 `assertWorkspaceDeletable` 잠금 없는 선검사로 owner 권한 확인 완료) **에만 도달**한다. 이 단락이 발동하는 유일한 경우는 "다른(이미 인가를 통과한) 동시 요청이 먼저 커밋해 행이 실제로 사라졌다"는 경우뿐이라, 인가 우회나 IDOR 로 이어지는 경로가 아니다. 워크스페이스 경로에서 `assertWorkspaceDeletable` 의 잠금 재검사(권한→존재 순서) 앞에 이 404 단락을 끼워 넣었지만, 자원이 **존재하는** 정상 경합이 아닌 케이스에서는 여전히 재검사가 그대로 수행되므로 권한 재확인이 스킵되지 않는다.
  - 제안: 조치 불요. (참고: 이 비대칭·403 vs 404 오응답 이슈는 이번 커밋 세트가 선행 리뷰 `review/code/2026/09/20/20_06_26` WARNING#1 을 받아 `27f488d09` 로 이미 고친 것으로, 보안 카테고리라기보다 아키텍처/정확성 이슈였고 현재는 해소되어 있다.)

- **[INFO]** 에러 메시지에 민감 정보 노출 없음
  - 위치: `workflows.service.ts` 신규 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Workflow not found' })`, `workspaces.service.ts` 신규 `NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: '워크스페이스를 찾을 수 없습니다.' })`
  - 상세: 두 메시지 모두 기존 `findById`/`assertWorkspaceDeletable` 이 이미 쓰던 것과 동일한 일반 문구를 재사용한다. 스택트레이스·내부 쿼리·다른 사용자의 존재 여부 등을 흘리지 않는다. `.catch()` 에서 남기는 `this.logger.error(...)` 도 서버 로그 전용이며 HTTP 응답 바디로 전달되지 않는다(신규로 추가한 `if (err instanceof NotFoundException) throw err;` 가드는 오히려 정상적인 동시-삭제 패배를 "수동 정리 필요" 급 error 로그로 오인/노출시키던 것을 줄이는 방향).
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 변경/신규 파일 전체(`CHANGELOG.md`, `trigger-resource-release.ts`, `trigger-resource-releaser.service.ts`/`.spec.ts`, `workflows.service.ts`/`.spec.ts`, `workspaces.service.ts`/`.spec.ts`, `workflow-delete-concurrency.e2e-spec.ts`, `plan/in-progress/dup-delete-audit.md`, `review/**` 신규 문서)
  - 상세: API 키·비밀번호·토큰·인증서 리터럴 없음. 신규 e2e 스펙의 `token`/`accessToken` 은 `registerAndLogin()` 이 런타임에 로그인해 발급받는 JWT 를 로컬 변수에 담은 것이지 하드코딩된 자격증명이 아니다. `E2E_BASE_URL` 기본값(`http://backend-e2e:3011`)도 시크릿이 아니라 docker-compose 네트워크 내부 호스트명이다.
  - 참고(diff 밖, 사전 존재): `codebase/backend/test/helpers/db.ts`/`helpers/auth.ts` 는 이번 diff 에 포함되지 않은 기존 파일로, 로컬 e2e 전용 고정 자격증명(`clemvion-e2e`, `E2eTest!1234`)을 기본값으로 갖고 있다 — docker-compose e2e 환경에 국한된 통상적 테스트 픽스처이며 프로덕션 자격증명이 아니다. 이번 리뷰 스코프(diff)에는 없으므로 새 결함으로 잡지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 암호화/해시 관련 변경 없음, 평문 전송 없음
  - 상세: 이번 diff 는 DB 잠금·반환 타입·감사 로그 억제 로직만 바꾼다. 암호화 알고리즘, 해시 함수, 전송 채널에 관련된 코드는 건드리지 않았다.

- **[INFO]** 의존성 변경 없음
  - 상세: `package.json`/lockfile 변경 없음. 신규 e2e 스펙이 쓰는 `pg`, `supertest`, `@jest/globals` 는 기존 devDependency 재사용이다.

## 요약

이번 diff 는 동시 DELETE 두 건이 감사 로그(`workflow.deleted`)를 중복 기록하던 TOCTOU/lost-update 성격의 결함을, 이미 `pessimistic_write` 로 잠그며 읽던 부모 행의 존재 여부를 폐기하지 않고 호출자에게 `{ parentPresence, triggerIds }` 로 명시 반환하는 방식으로 닫는다. 새로 추가된 404 단락은 인가가 이미 끝난 지점 이후에만 동작해 인가 우회·IDOR 로 이어지지 않으며, 모든 쿼리는 파라미터 바인딩(TypeORM/`$n` placeholder)을 사용해 인젝션 표면이 없다. 에러 메시지는 기존과 동일한 일반 문구를 재사용해 정보 노출이 없고, 신규 코드·문서·리뷰 산출물 어디에도 하드코딩된 시크릿이 없다(diff 밖의 기존 e2e 헬퍼가 갖는 로컬 전용 고정 자격증명은 이번 변경 범위 밖이다). 암호화·의존성 관련 변경도 없다. 전체적으로 보안 관점에서 우려되는 지점이 없는, 감사 무결성을 강화하는 변경이다.

## 위험도

NONE
