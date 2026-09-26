# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** POST 액션 14곳의 실제 성공 코드가 `201`(Nest 기본값) → `200`으로 바뀐다 — OpenAPI 문서 자체는 이미 `200`을 광고하고 있었으므로 "문서에 따라 구현한" 클라이언트에는 영향이 없으나, 문서를 무시하고 실측 `201`에 의존한 클라이언트가 있다면 breaking change다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts:158`(`regenerate`), `codebase/backend/src/modules/integrations/integrations.controller.ts`(`preview-test`·`oauth/begin`·`:id/test`·`:id/rotate`·`:id/reauthorize`·`:id/request-scopes`, 각 diff 게이트 209/232/503/526/560/589), `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts:432`(`search`), `codebase/backend/src/modules/schedules/schedules.controller.ts:187`(`preview`), `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:153`(`sendMessage`, SSE), `codebase/backend/src/modules/workflows/workflows.controller.ts:452`(`:id/save`), `codebase/backend/src/modules/workspaces/workspaces.controller.ts:244,270`(`leave`·`transfer-ownership`)
  - 상세: 영향 분석이 이미 상당히 이뤄져 있음을 확인했다 — `plan/in-progress/post-status-openapi.md`와 `CHANGELOG.md`에 "frontend·channel-web-chat·packages 에 `=== 201` 정확 비교 0건" 실측이 기록되어 있고, 대상 엔드포인트는 전부 `@ApiBearerAuth`(JWT) + `X-Workspace-Id`가 필요한 대시보드 전용 관리 API라 서드파티 공개 API 성격이 아니다(웹훅 수신 엔드포인트 `/api/hooks/:path`는 이 변경 대상이 아님). 다만 CHANGELOG 본문이 "외부 API 호출자가 있다면 확인할 것"이라고만 적어 두었을 뿐, 그 확인 자체는 아직 완료되었다고 단언하지 않는다.
  - 제안: 배포 전 실제 프로덕션 사용처(스크립트로 이 관리 API를 직접 호출하는 고객·내부 자동화가 있는지) 존재 여부를 한 번 더 확인. 이미 CHANGELOG에 명시했으므로 추가 조치 없이도 통과 가능한 수준.

- **[INFO]** `DELETE /api/workspaces/:id/invitations/:invitationId`의 광고가 `@ApiNoContentResponse`(204) → `@ApiOkWrappedResponse(OkResultDto)`(200)로 바뀐다. 실측 결과 이 라우트는 `@HttpCode` 오버라이드가 없어 Nest 기본값(DELETE→200)을 실제로 항상 내고 있었고, 핸들러 반환값도 `{ data: { ok: true } }`이다(`codebase/backend/src/modules/workspaces/workspaces.controller.ts` `revokeInvitation`). `OkResultDto`(`{ ok: boolean }`)와 실제 반환 형태가 일치함을 확인했다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:550` (diff 게이트)
  - 상세: 이 변경은 **문서만** 실제 동작에 맞춘 것으로, 런타임 wire 계약은 바뀌지 않는다(진짜 204 로의 전환 여부는 별도 트래커 결정으로 이 PR 범위 밖). 응답 형식 일관성 관점에서 올바른 수정이다.
  - 제안: 없음(정상).

- **[INFO]** 신설 정적 가드 `src/repo-guards/__tests__/http-status-advertised{-guard.ts,.spec.ts}`가 "광고된 성공(2xx) 코드 집합이 실제 성공 코드를 포함해야 한다"를 `src/modules/**/*.controller.ts` 전수에 대해 AST로 강제한다(베이스라인 0, 동결 목록 없음). `@Res()` 핸들러도 면제하지 않는 것을 실제 요청 캐너리(`describe('근거 캐너리 — @Res() 핸들러의 상태')`)로 근거를 고정해 두었다. 스캔 루트를 `src/modules`로 한정했으나, 확인 결과 프로덕션 컨트롤러는 전부 그 아래 위치하고(`fixtures/` 3개만 예외) 커버리지 갭이 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts`, `codebase/backend/src/repo-guards/__tests__/http-status-advertised.spec.ts`
  - 상세: API 계약(실제 응답 코드 vs OpenAPI 광고) 회귀를 구조적으로 막는 좋은 가드다. 향후 새 컨트롤러가 `src/modules` 밖에 생기면 이 가드의 사각지대가 되므로 그 경우에만 재확인이 필요하다.
  - 제안: 없음(정상 — 향후 스캔 루트 밖에 컨트롤러가 생기는 경우만 주의).

- **[INFO]** 이번 diff에서 인증/인가(`@Roles`, `@ApiBearerAuth`) 데코레이터의 실질 변경은 없다 — `auth-configs.controller.ts`의 `regenerate`에서 주석 위치가 `@HttpCode` 삽입으로 한 줄 밀렸을 뿐 `@Roles('admin')` 자체는 그대로다. 요청 검증(`ParseUUIDPipe`, DTO)·URL 경로·페이지네이션도 이번 diff의 변경 대상이 아니다.
  - 위치: 전체 파일 (해당 없음)
  - 상세: 점검 관점 5·6·7·8은 이번 변경 범위에서 영향 없음.
  - 제안: 없음.

## 요약

이 변경은 OpenAPI로 **이미 200을 광고**하고 있었으나 실제로는 Nest 기본값(POST→201)을 내던 14개 액션 엔드포인트에 `@HttpCode(HttpStatus.OK)`를 추가해 광고와 실제를 일치시키고, `revokeInvitation`(초대 취소) 1곳은 반대로 광고(204→200)를 실제 동작에 맞춰 정정했다. 두 방향 모두 "광고 ↔ 실제 불일치"라는 진짜 API 계약 결함을 닫는 수정이며, 이를 회귀 없이 지키는 AST 기반 정적 가드(뮤테이션 테스트로 15개 케이스 전수 검증됨)를 신설했다. e2e 테스트 전수가 새 기대값(200)으로 갱신되었고, frontend/packages 쪽에 `=== 201` 하드코딩이 없음을 실측 확인했으며 CHANGELOG에 breaking-change 가능성을 명시적으로 경고해 두었다. 응답 바디 형식(`OkResultDto`)도 실제 반환값과 일치한다. 남은 리스크는 이 관리 API를 직접 호출하는 미확인 외부 소비자의 존재 여부뿐이며, 대상 엔드포인트가 모두 JWT+워크스페이스 인증이 필요한 대시보드 전용 API라는 점에서 실질 위험은 낮다.

## 위험도

LOW
