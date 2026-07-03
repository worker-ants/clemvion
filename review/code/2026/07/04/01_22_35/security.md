# 보안(Security) Review — FRESH (resolution 검증)

대상: PR3 크래시/재시작 RUNNING re-drive (§7.5 case B), `_test/recover-stuck-executions` 엔드포인트 강화 검증.
이전 리뷰(`review/code/2026/07/04/00_57_47`)에서 W2(security)/W3(api_contract)로 지적된 사항의 조치 결과를 검증한다.

## 검증 대상 조치

- W2 (security): `@Roles('owner')` 추가 — 게이트 실패 시에도 owner 만 트리거 가능(인가 이중화)
- W3 (api_contract): 게이트를 `NODE_ENV==='test'` **AND** `E2E_TEST_HOOKS==='1'` 이중화 + `docker-compose.e2e.yml` 에 플래그 추가

## 확인한 코드 상태

`codebase/backend/src/modules/executions/executions.controller.ts:212-222`:

```ts
@Post('_test/recover-stuck-executions')
@HttpCode(HttpStatus.ACCEPTED)
@Roles('owner')
@ApiExcludeEndpoint()
async triggerStuckRecoveryForTest() {
  if (process.env.NODE_ENV !== 'test' || process.env.E2E_TEST_HOOKS !== '1') {
    throw new NotFoundException();
  }
  await this.executionEngineService.runStuckRecoveryScan();
  return { success: true };
}
```

## 발견사항

- **[INFO]** 이중 게이트가 fail-closed 로 정확히 구현됨
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:217`
  - 상세: `!== 'test' || !== '1'` 조건은 논리 AND 요구사항(둘 다 충족)을 정확히 코딩한 것 — 어느 한쪽이라도 값이 없거나(`undefined`) 다르면 즉시 404. 프로덕션 Dockerfile 은 `ENV NODE_ENV=production` 하드코딩(`codebase/backend/Dockerfile:45`), 기본 `docker-compose.yml` 은 `NODE_ENV: development`(E2E_TEST_HOOKS 미설정) — 두 실배포 경로 모두 첫 조건에서 이미 차단된다. `E2E_TEST_HOOKS=1` 은 오직 `docker-compose.e2e.yml` 에만 존재. 단일 env 오설정(예: 스테이징에서 실수로 `NODE_ENV=test` 설정)만으로는 `E2E_TEST_HOOKS` 도 함께 설정하지 않는 한 여전히 404 — "단일 오설정 무력화" 주장이 코드로 뒷받침된다.
  - 제안: 없음. 현 상태로 충분.

- **[INFO]** `@Roles('owner')` 가 전역 `JwtAuthGuard`/`RolesGuard`(`APP_GUARD`) 경로에 정상 편입됨을 확인
  - 위치: `codebase/backend/src/app.module.ts:200-204` (JwtAuthGuard → UserThrottlerGuard → RolesGuard 순서로 전역 등록), `codebase/backend/src/common/guards/roles.guard.ts`
  - 상세: `RolesGuard` 는 `X-Workspace-Id` 헤더(또는 JWT 내 workspaceId) 기준으로 `WorkspacesService.getMemberRole` 을 조회해 요청자가 해당 워크스페이스에서 owner 이상인지 검사한다. `@Roles()` 미표시 라우트는 자동 통과이므로, 이전 리뷰가 지적한 "인증만 있고 인가는 전혀 없음"(Roles 데코레이터 부재) 문제는 `@Roles('owner')` 추가로 해소되었다 — 이제 최소 하나의 워크스페이스에서 owner 역할을 가진 인증 사용자만 통과한다.
  - 참고(잔존 특성, 조치 불요): `recoverStuckExecutions`/`runStuckRecoveryScan` 자체는 여전히 워크스페이스 필터 없는 전역 스캔이라, "어떤 워크스페이스의 owner"인지와 무관하게 전체 stale RUNNING execution 이 재구동 대상이 된다. 즉 `@Roles('owner')` 는 "트리거할 수 있는 액터의 자격"을 owner 로 제한하는 인가이지, "스캔의 스코프"를 해당 owner 의 워크스페이스로 좁히는 인가는 아니다. 다만 이 엔드포인트는 (1) NODE_ENV==='test' && E2E_TEST_HOOKS==='1' 이중 게이트 뒤에 있어 프로덕션에서는 도달 불가능하고, (2) e2e 환경에서는 단일 테스트 워크스페이스/유저로 실행되며, (3) RESOLUTION 에 "PR4 관측성 트랙에서 정식 route/scope 인가 설계" 로 명시적으로 이연되어 있어, 현재 시점에는 잔여 리스크로 수용 가능. 신규 회귀는 아님.

- **[INFO]** `@ApiExcludeEndpoint()` 는 여전히 문서화 은닉일 뿐 라우트 자체는 컴파일·등록됨(이전 리뷰 INFO 항목과 동일 특성, 미변경)
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:215`
  - 상세: 라우트 미등록(ConditionalModule 등)이 아니라 런타임 조건부 404 방식이라는 구조 자체는 그대로다. 그러나 이번 조치로 게이트가 이중화되어 "런타임 조건부 404" 방식이 갖는 구조적 위험(단일 오설정 노출)은 사실상 제거되었다. 완전한 "라우트 자체 부재" 로의 전환은 RESOLUTION 에 PR4 후속으로 명시 — 우선순위 낮음.
  - 제안: 없음(추적 중, PR4 로 이연 확인).

- **[INFO]** 컨트롤러 unit 테스트(3-case: 정상 트리거 / NODE_ENV 게이팅 404 / 플래그 게이팅 404) 로컬 실행 확인 — 전부 통과
  - 위치: `codebase/backend/src/modules/executions/executions.controller.spec.ts:100-141`
  - 상세: `npx jest src/modules/executions/executions.controller.spec.ts -t "triggerStuckRecoveryForTest"` 실행 결과 3 passed / 10 skipped(다른 describe), 실패 없음. 게이트가 실제로 두 조건 각각의 단독 실패에도 404 를 던지는 것을 재확인.
  - 제안: 없음.

- **[INFO]** DB 쿼리 경로(`reclaimStuckRunningExecution`, `failOrphanRunningNodeExecutions`)는 TypeORM QueryBuilder 파라미터 바인딩만 사용 — SQL 인젝션 벡터 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2691-2736`
  - 상세: `.where('status = :status', {...})` / `.andWhere('started_at < :threshold', {...})` 패턴으로 사용자 입력이 직접 개입하지 않는 내부 스캔 로직이라 인젝션 위험 없음. `executionId` 도 이 엔드포인트에서는 외부 입력으로 전달되지 않고(파라미터 없는 POST, body 없음) 서버 내부에서 스캔·재구동 대상을 결정한다.
  - 제안: 없음.

## 이전 발견 대비 변화 요약

| 이전 지적(00_57_47 W2/W3, api_contract WARNING) | 현재 상태 |
|---|---|
| `@Roles()` 없이 인증만 요구 → 인증된 임의 사용자가 트리거 가능 | 해소: `@Roles('owner')` 추가, 전역 가드 체인에 정상 편입 확인 |
| `NODE_ENV` 단일 값 게이팅 → 단일 env 오설정으로 프로덕션 노출 가능 | 해소: `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이트, 프로덕션/기본 compose 어느 쪽에도 두 조건이 동시 충족될 경로 없음(Dockerfile·docker-compose.yml 확인) |
| 라우트가 항상 등록되고 런타임 조건부 404 (구조적 특성) | 미해결이나 이번 이슈의 핵심 위험(오설정 노출)은 이중 게이트로 사실상 제거. 완전한 조건부 등록은 PR4 후속으로 명시적 이연 — 수용 가능 |
| 전역 스캔(워크스페이스 스코프 없음) | 미해결이나 owner 인가 + 이중 게이트 뒤에 위치, PR4 로 스코프 설계 이연 — 신규 회귀 아님, 수용 가능 |

## 요약

이전 리뷰에서 지적된 두 핵심 보안 취약점 — (1) 인가 부재(Roles 미지정), (2) 단일 env 값에 의한 프로덕션 노출 가능성 — 은 각각 `@Roles('owner')` 추가와 `NODE_ENV`+`E2E_TEST_HOOKS` 이중 AND 게이트로 코드·인프라 설정(Dockerfile, docker-compose.yml, docker-compose.e2e.yml) 전 계층에서 정합적으로 조치되었음을 직접 확인했다. 두 조건 모두 실패 시 안전한 기본값(404, fail-closed)이며 실제 배포 경로(Dockerfile `NODE_ENV=production`, 기본 compose `development`)에서는 게이트를 통과할 방법이 없다. 남은 잔여 특성(런타임 조건부 404 구조, 전역 스캔 스코프 부재)은 RESOLUTION 에 PR4 후속 트랙으로 명시적으로 이연되어 있고 현재의 이중 방어 뒤에 위치해 즉각적 위험도가 낮아 신규 Critical/Warning 사유가 되지 않는다. Unit 테스트 3-case 도 로컬에서 재확인 통과했다.

## 위험도

LOW
