# API 계약(API Contract) Review

## 검토 범위

이번 변경(`auth-guard-reflection-hardening`)은 새 엔드포인트·URL·페이지네이션을 도입하지 않는다. 핵심 API-계약 표면 변경은 딱 하나다:

- `codebase/backend/src/common/utils/workspace-context.util.ts` `resolveRequestWorkspaceContext` — `X-Workspace-Id` 헤더가 UUID 형태가 아니면 이제 **400 `VALIDATION_ERROR`** 를 던진다(종전엔 그대로 DB 로 흘러가 `QueryFailedError`(SQLSTATE 22P02)가 `GlobalExceptionFilter` 의 어떤 분기에도 안 걸려 **500 INTERNAL_ERROR 로 마스킹**됐다).

나머지는 부팅 시 reflection 무결성을 검증하는 캐너리(`workspace-reflection-canary.ts`), 그 등록을 위한 `DiscoveryModule` import, 테스트 픽스처를 임의 문자열(`'ws1'` 등)에서 실제 UUID 형태로 교체한 것, plan/review 산출물이다 — 이들은 HTTP 계약 표면에 직접 영향을 주지 않는다.

## 발견사항

- **[INFO]** 500 → 400 상태코드 전환은 클라이언트가 관측 가능한 응답 계약 변경이다
  - 위치: `codebase/backend/src/common/utils/workspace-context.util.ts` (신설 `if (headerWorkspaceId && !isUuidShaped(headerWorkspaceId))` 블록, 함수 `resolveRequestWorkspaceContext`)
  - 상세: 형식이 깨진 `X-Workspace-Id` 를 보내는 호출자는 종전 500 대신 400 을 받는다. 정상 클라이언트(FE `apiClient`, 유효한 UUID 발급)에는 영향이 없고, 마스킹되던 서버 오류가 올바른 클라이언트 오류로 정정되는 방향이라 실질적으로 breaking 이 아니다. 응답 봉투(`{error:{code,message,requestId}}`)도 `GlobalExceptionFilter.getCodeFromStatus(400) === 'VALIDATION_ERROR'` 기본값과 `BadRequestException({code:'VALIDATION_ERROR', message:...})` 가 명시적으로 일치해 계약 형식 자체는 흔들리지 않는다(직접 대조: `common/filters/http-exception.filter.ts:65-73,142-143`). CHANGELOG.md 에도 이미 명시돼 있다. Breaking 은 아니지만 "이전엔 조용히 500 이던 요청이 이제 400 을 낸다"는 사실은 이 헤더에 의존하는 외부/서드파티 API 클라이언트가 있다면 릴리스 노트에서 놓치지 않아야 할 항목이라 기록해 둔다.
  - 제안: 조치 불필요(이미 CHANGELOG 반영). 외부 공개 API 소비자가 있다면 릴리스 노트에 이 항목이 노출되는지만 재확인.

- **[INFO]** 토큰 클레임(JWT) 쪽 malformed workspaceId 는 검증하지 않아 동일 500-마스킹 결함이 비대칭적으로 남는다
  - 위치: `codebase/backend/src/common/utils/workspace-context.util.ts` — `resolveRequestWorkspaceContext`, `workspace-context.util.spec.ts`:"토큰 클레임은 검증하지 않는다" 테스트(`resolveRequestWorkspaceContext({}, 'legacy-non-uuid')`)
  - 상세: 헤더가 없고 토큰 클레임(`request.user.workspaceId`)만 malformed 인 극단 케이스(레거시/손상된 서명 토큰)는 여전히 그대로 `getMemberRole` 로 흘러가 500 마스킹 경로를 탈 수 있다. 코드 주석이 "서버가 서명한 값이라 클라이언트 입력이 아니므로 400 으로 보고하면 서버 버그를 클라이언트 오류로 잘못 보고하는 셈"이라고 명시적으로 정당화하고 있어 의도된 설계이며, `jwt.strategy` 가 발급 시점에 멤버십을 검증하므로 정상 운영에서는 도달 불가능에 가깝다. 차단 사유는 아니고 알려진 잔여 비대칭으로 기록.
  - 제안: 조치 불필요. 향후 이 경로에서 500 마스킹이 실제로 관측되면(운영 로그) 별도 후속으로 다룰 것.

- **[INFO]** 새 400 응답이 Swagger 문서(`@ApiBadRequestResponse`)에 반영되지 않음 — cross-cutting 가드 동작이라 per-endpoint 데코레이터로는 원래도 안 잡히던 영역
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (전역 `APP_GUARD`), `spec/conventions/swagger.md` §2-4 "400 검증 실패 | `@ApiBadRequestResponse`"
  - 상세: `resolveRequestWorkspaceContext` 가 헤더 형식 오류로 400 을 던지는 지점은 `RolesGuard`(전역)와 `@WorkspaceId()` 데코레이터 양쪽인데, 이 가드-레벨 400 은 컨트롤러 메서드에 `@ApiBadRequestResponse` 를 붙이는 기존 관행으로는 문서화되지 않는다(`@ApiUnauthorizedResponse` 처럼 "보호된 엔드포인트는 기본적으로 포함" 류의 cross-cutting 관행이 400 에는 아직 없다). 다만 이는 이번 PR 이 새로 만든 갭이 아니라 `@Roles()`/`@WorkspaceId()` 가드 자체의 기존 특성이며, 관련 consistency-check(`review/consistency/2026/08/09/14_01_15/convention_compliance.md`)도 이 영역의 Swagger 문서화는 `#1103`(선행 PR) 스코프로 이미 분리해 두었다.
  - 제안: 이번 PR 범위 밖. 향후 Swagger 문서 정리 라운드에서 "워크스페이스 컨텍스트를 쓰는 라우트는 기본적으로 400 `VALIDATION_ERROR`(malformed `X-Workspace-Id`) 가능"을 cross-cutting 관행으로 `swagger.md` 에 명문화할 가치는 있음.

## 확인한 정합성 (문제 없음)

- 에러 응답 형식: `BadRequestException({code:'VALIDATION_ERROR', message:'X-Workspace-Id must be a UUID'})` 가 `GlobalExceptionFilter` 의 `resp.code` 파싱·`{error:{code,message,requestId}}` 봉투와 정확히 일치. 기존 `WORKSPACE_ID_REQUIRED` 관례(`workspace.decorator.ts:38-41`)와 같은 `{code, message}` 형태를 그대로 따른다.
- 검증 대상 술어 선택(`isUuidShaped` vs `isValidUuid`): DB(`Postgres uuid` 컬럼)가 파싱 가능한 값을 400 으로 잘못 거부해 "멤버 아님"(403)이 "요청 오류"(400)로 뒤바뀌는 회귀를 정확히 피했다 — nil UUID·v6/v7·비-RFC variant 를 의도적으로 허용하며 테스트(`uuid.spec.ts`)로 경계를 고정.
- 하위 호환성: 가드·데코레이터 두 소비처가 `resolveRequestWorkspaceContext` 공용 헬퍼를 통해 동일 검증 경로를 타므로, 이번 PR 전에 이미 지적된 "두 경로 응답 drift" 위험(2026-08-08 ARCHITECTURE WARNING)이 재발하지 않는다.
- URL/경로·페이지네이션·API 버전관리: 변경 없음(N/A).
- 인증/인가: 이번 diff 자체는 `RolesGuard`/`handlerConsumesWorkspaceId` 로직을 바꾸지 않는다(멤버십 검증 확장 자체는 선행 `#1103` 범위). 이번 PR 은 그 reflection 메커니즘이 조용히 깨지는 것을 막는 boot-time 캐너리(fail-closed)를 추가할 뿐이며, 계약 표면(엔드포인트·응답 스키마)에는 영향이 없다.

## 요약

이번 변경은 API 계약 관점에서 실질적으로 낮은 위험이다. 유일한 표면 변경은 malformed `X-Workspace-Id` 헤더에 대해 마스킹된 500 을 정확한 400 `VALIDATION_ERROR` 로 정정한 것으로, 기존 에러 봉투·코드 규약과 완전히 정합하고 정상 클라이언트에는 영향이 없는 개선이다. 부팅 캐너리·DiscoveryModule 등록·테스트 픽스처 UUID화는 API 계약 표면 자체를 건드리지 않는다. 남은 항목(토큰 클레임 malformed 값 미검증, Swagger 400 문서화 공백)은 의도적으로 남겨둔 저위험 잔여 사항으로 CRITICAL/WARNING 급이 아니다.

## 위험도

LOW
