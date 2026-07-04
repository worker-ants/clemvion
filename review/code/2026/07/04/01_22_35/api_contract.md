# API 계약(API Contract) 리뷰 — FRESH (resolution 검증)

대상: `review/code/2026/07/04/00_57_47` 의 W2(security)/W3(api_contract) 조치 반영 여부 검증.
핵심 API 표면: `POST /api/executions/_test/recover-stuck-executions` (신규, `executions.controller.ts`).

## 검증 결과

이전 리뷰(00_57_47/api_contract.md)에서 WARNING 으로 지적한 두 가지가 모두 코드에 반영되어 있음을 확인했다.

1. **이중 env 게이트 (W3)**: `codebase/backend/src/modules/executions/executions.controller.ts:217` —
   `if (process.env.NODE_ENV !== 'test' || process.env.E2E_TEST_HOOKS !== '1') throw new NotFoundException();`
   `NODE_ENV==='test'` 단일 조건에서 `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 조건으로 강화됨. `docker-compose.e2e.yml` 에 `E2E_TEST_HOOKS: "1"` 이 추가되어 e2e 환경에서만 두 조건이 동시 충족된다. 프로덕션 이미지는 `NODE_ENV=production` 이고 `E2E_TEST_HOOKS` 미설정이므로 단일 env var 오설정(예: `NODE_ENV` 미설정/오타)만으로는 더 이상 활성화되지 않는다 — 원 WARNING("단일 env 오설정 시 노출")의 핵심 시나리오가 해소됨.

2. **`@Roles('owner')` 추가 (W2)**: `codebase/backend/src/modules/executions/executions.controller.ts:214` —
   전역 `RolesGuard`(APP_GUARD, `app.module.ts:204`, `JwtAuthGuard` 다음 순서로 등록되어 `req.user` 채워진 뒤 평가)가 핸들러 진입 전에 역할을 검사한다. `@Roles()` 가 없던 이전 상태(인증만 요구)에서 "워크스페이스 owner 만 통과"로 인가가 강화됨. controller.spec.ts 에 게이팅 3-case(정상/`NODE_ENV`/플래그) unit 이 추가되어 회귀 방지도 확보됨. e2e(`execution-crash-redrive.e2e-spec.ts`)도 `ownerToken` + `X-Workspace-Id` 헤더로 실제 owner 역할 경로를 태워 검증 흐름과 일치한다.

두 조치 모두 diff·현재 코드 상태·unit/e2e 테스트 커버리지가 서로 일치하며, RESOLUTION.md/SUMMARY.md 의 서술과 실제 구현 간 괴리는 없다.

## 잔여 관찰사항 (신규 CRITICAL/WARNING 아님)

- **[INFO]** `@Roles('owner')` 는 `RolesGuard` 구현상 `X-Workspace-Id` 헤더(또는 JWT)로 지정된 **하나의 워크스페이스**에서 호출자가 owner 인지만 검사한다(`roles.guard.ts:59-75`, `workspacesService.getMemberRole(workspaceId, userId)`). 반면 실제 액션(`runStuckRecoveryScan` → `recoverStuckExecutions`, `execution-engine.service.ts:2635`)은 **워크스페이스 무관 전역 스캔**이다. 즉 "자신이 owner 인 임의의 한 워크스페이스"만 있으면, 그 role 검사를 통과해 다른 워크스페이스의 stuck execution 까지 포함하는 전역 recovery 를 트리거할 수 있다 — 역할 검사의 스코프와 실제 부작용의 스코프가 불일치. 다만 (a) 이 엔드포인트는 이중 env 게이트로 프로덕션에서 도달 불가능하고, (b) `recoverStuckExecutions` 자체가 idempotent re-claim 가드(§7.5)로 부작용이 제한적이라는 기존 주석의 전제가 여전히 유효해 실질 위험은 낮다. RESOLUTION 이 "인가 이중화"라고 표현한 것은 "인증 없음 → 인증+임의권한 없음 → 인증+owner 권한" 강화를 의미하는 것으로, "워크스페이스 스코프의 정합성"까지 보장한다는 뜻은 아니므로 이번 조치의 목적(단일 오설정/무권한 접근 차단)은 충분히 달성되었다고 평가한다. PR4 관측성 트랙에서 "정식 route/scope 인가 설계" 시 이 스코프 불일치를 함께 정리 권장.
- **[INFO]** 이전 리뷰의 나머지 INFO 항목(`@ApiExcludeEndpoint()` 는 라우팅에 영향 없음, 에러 응답 미구조화, `_test/` 네이밍 프리픽스)은 이번 조치 범위 밖이며 재확인 결과 변동 없음 — 여전히 test-only 성격을 감안하면 경미.

## 요약

전(前) 리뷰에서 지적한 두 WARNING(단일 env 게이트로 인한 프로덕션 노출 위험, 인가 부재)이 이중 env 게이트(`NODE_ENV==='test' && E2E_TEST_HOOKS==='1'`)와 `@Roles('owner')` 추가로 모두 코드·unit·e2e·compose 설정에 일관되게 반영되었음을 확인했다. 신규 CRITICAL/WARNING 은 발견되지 않았고, 워크스페이스 역할 검사 스코프와 실제 전역 스캔 스코프 간의 불일치라는 저위험 INFO 관찰만 남는다(PR4 정식 설계 트랙에서 정리 권장). 그 외 파일(`execution-engine.service.ts` 내부 로직, `graph-dispatch.types.ts` optional 필드, plan/spec 문서)은 외부 REST/WS 계약을 변경하지 않는 내부 구현 변경으로 API 계약 관점 해당 없음.

## 위험도

LOW
