# API 계약(API Contract) Review

## 검토 범위

이번 변경(`auth-guard-reflection-hardening`)은 새 엔드포인트·URL·페이지네이션을 도입하지 않는다.
API 계약 표면에 실질적으로 영향을 주는 변경은 단 하나다:

- `codebase/backend/src/common/utils/workspace-context.util.ts` `resolveRequestWorkspaceContext` —
  `X-Workspace-Id` 헤더가 UUID 형태가 아니면 **400 `VALIDATION_ERROR`** 를 던진다. 종전에는 그 값이
  그대로 `getMemberRole` 까지 흘러가 TypeORM `QueryFailedError`(SQLSTATE 22P02)가 됐고,
  `GlobalExceptionFilter` 가 23505 만 매핑하므로 **500 INTERNAL_ERROR 로 마스킹**됐다.

나머지는 부팅 시 reflection 무결성을 검증하는 캐너리(`workspace-reflection-canary.ts`,
`main.ts`/`app.module.ts` 배선), 그 대상 술어 `isUuidShaped`(`uuid.ts`), 테스트 픽스처를 임의
문자열에서 실제 UUID 형태로 치환한 것, plan/review 산출물이다 — 이들은 HTTP 계약 표면(엔드포인트·
스키마·페이지네이션·버전)을 직접 바꾸지 않는다.

동일 코드베이스에 대한 선행 라운드(`review/code/2026/08/09/14_36_39/api_contract.md`)가 이미 이
변경을 LOW 로 판정했고, 그 라운드 이후 커밋(`d40f75fbd`)은 API 계약 자체가 아니라 그 계약을
검증하는 **테스트 커버리지**(가드 레벨 400 전파 테스트 W5, vacuous 테스트 정정 W6)를 보강했다. 소스
레벨로 직접 대조해 재확인한 결과를 아래에 남긴다.

## 발견사항

- **[INFO]** 500 → 400 상태코드 전환은 클라이언트가 관측 가능한 응답 계약 변경이다
  - 위치: `codebase/backend/src/common/utils/workspace-context.util.ts:74-79` (`resolveRequestWorkspaceContext` 신설 `if (headerWorkspaceId && !isUuidShaped(headerWorkspaceId))` 블록)
  - 상세: 형식이 깨진 `X-Workspace-Id` 를 보내는 호출자는 종전 500 대신 400 을 받는다. 정상 클라이언트(FE `apiClient`, 유효한 UUID 발급)에는 영향이 없고, 마스킹되던 서버 오류가 올바른 클라이언트 오류로 정정되는 방향이라 실질적으로 breaking 이 아니다. 응답 봉투도 기존 규약과 정합한다 — 직접 대조(`codebase/backend/src/common/filters/http-exception.filter.ts:140-143`) 결과 `getCodeFromStatus(400) === 'VALIDATION_ERROR'` 기본값과 `BadRequestException({code:'VALIDATION_ERROR', ...})` 명시값이 일치하고, `VALIDATION_ERROR` 는 `spec/5-system/3-error-handling.md:76`·`spec/conventions/error-codes.md:41` 에 이미 등재된 기존 표준 코드라 신규 코드 추가가 아니다. CHANGELOG.md 에도 이미 명시돼 있다.
  - 제안: 조치 불필요(이미 CHANGELOG 반영, 에러 코드 신규 등재 불요). 외부 공개 API 소비자가 있다면 릴리스 노트에서 이 항목이 노출되는지만 재확인.

- **[INFO]** 이번 라운드에서 신설된 `RolesGuard` 레벨 테스트가 "400 이 가드에서 삼켜지거나 403 으로 뒤바뀌지 않는다"는 계약을 실제로 고정함 (긍정적 확인, 조치 불요)
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts` — `describe('형식이 깨진 X-Workspace-Id 는 가드에서 400 으로 전파된다', ...)` 블록(`@WorkspaceId()` 라우트·`@Roles()` 라우트·"403 이 아니라 400 이다" 3건), `describe('@Roles() 도 @WorkspaceId() 도 안 쓰는 라우트는 헤더와 무관하게 통과', ...)` 의 "형식이 깨진 헤더여도 전역 라우트는 400 을 내지 않는다" 케이스
  - 상세: 선행 라운드(`review/code/2026/08/09/14_36_39/testing.md`)가 지적한 두 WARNING — (1) 프로덕션에서 이 400 을 가장 먼저 통과하는 지점(전역 `APP_GUARD`)에 대응 테스트 부재, (2) 전역 라우트 통과 테스트가 nil UUID(UUID-shaped 값)만 써서 "검증이 건너뛰어졌다"와 "검증이 통과했다"를 구분 못 하는 vacuous 형태 — 가 이번 커밋(`d40f75fbd`)에서 실제 소스 대조 결과 해소됐다. 이는 `resolveRequestWorkspaceContext` 가 소비처(가드·데코레이터) 어느 쪽에서 호출돼도 클라이언트가 동일한 400/`VALIDATION_ERROR` 를 받는다는 계약 일관성을 실제 테스트로 뒷받침한다.
  - 제안: 없음(개선 확인용 기록).

- **[INFO]** 토큰 클레임(JWT) 쪽 malformed workspaceId 는 검증하지 않아 동일 500-마스킹 결함이 비대칭적으로 남는다
  - 위치: `codebase/backend/src/common/utils/workspace-context.util.ts:62-64` (JSDoc "토큰 클레임은 검증하지 않는다"), 함수 `resolveRequestWorkspaceContext`
  - 상세: 헤더가 없고 토큰 클레임(`request.user.workspaceId`)만 malformed 인 극단 케이스(레거시/손상된 서명 토큰)는 여전히 그대로 `getMemberRole` 로 흘러가 500 마스킹 경로를 탈 수 있다. 코드 주석이 "서버가 서명한 값이라 클라이언트 입력이 아니므로 400 으로 보고하면 서버 버그를 클라이언트 오류로 잘못 보고하는 셈"이라고 명시적으로 정당화하고 있어 의도된 설계이며, `jwt.strategy` 가 발급 시점에 멤버십을 검증하므로 정상 운영에서는 도달 불가능에 가깝다. 차단 사유는 아니고 알려진 잔여 비대칭으로 기록.
  - 제안: 조치 불필요. 향후 이 경로에서 500 마스킹이 실제로 관측되면(운영 로그) 별도 후속으로 다룰 것.

- **[INFO]** 새 400 응답이 Swagger 문서(`@ApiBadRequestResponse`)에 반영되지 않음 — cross-cutting 가드 동작이라 per-endpoint 데코레이터로는 원래도 안 잡히던 영역
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (전역 `APP_GUARD`, 이번 diff 밖), `spec/conventions/swagger.md` §2-4 "400 검증 실패 | `@ApiBadRequestResponse`"
  - 상세: `resolveRequestWorkspaceContext` 가 헤더 형식 오류로 400 을 던지는 지점은 `RolesGuard`(전역)와 `@WorkspaceId()` 데코레이터 양쪽인데, 이 가드-레벨 400 은 컨트롤러 메서드에 `@ApiBadRequestResponse` 를 붙이는 기존 관행으로는 문서화되지 않는다. 이번 PR 이 새로 만든 갭이 아니라 `@Roles()`/`@WorkspaceId()` 가드 자체의 기존 특성이다.
  - 제안: 이번 PR 범위 밖. 향후 Swagger 문서 정리 라운드에서 "워크스페이스 컨텍스트를 쓰는 라우트는 기본적으로 400 `VALIDATION_ERROR`(malformed `X-Workspace-Id`) 가능"을 cross-cutting 관행으로 `swagger.md` 에 명문화할 가치는 있음.

- **[INFO]** 부팅 캐너리는 개별 요청의 계약이 아니라 서비스 전체 가용성에 관여 — fail-closed 오탐 시 전체 API 표면이 동시에 중단됨
  - 위치: `codebase/backend/src/main.ts:168` (`assertWorkspaceIdReflectionWorks(app)` 호출부, `app.listen()` 이전), `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:91-116`
  - 상세: 이 캐너리 자체는 응답 스키마·URL·상태코드 등 개별 API 계약을 바꾸지 않는다(런타임 요청 경로 미관여, `app.module.ts` 의 `DiscoveryModule` 도 부팅 시에만 소비). 다만 인식 라우트 수가 0 이면 부팅을 멈추므로(fail-closed), reflection 판정이 오탐(false positive)으로 깨지는 경우 전체 API — 이번 변경과 무관한 엔드포인트까지 포함 — 가 배포 시점에 통째로 불가용해진다. 이는 API 계약 위반이라기보다 가용성/배포 리스크이며, CHANGELOG·JSDoc·plan 문서에 이미 트레이드오프로 명시돼 있고 선행 라운드(security/side_effect/testing)에서도 검토·수용됐다. API 계약 관점에서는 "부분 파손"(일부 라우트만 인식 실패)이 이 단언으로 잡히지 않는다는 점만 참고로 남긴다 — 그 경우 해당 라우트만 조용히 멤버십 검증이 fail-open 될 수 있으나, 이는 `RolesGuard`/`handlerConsumesWorkspaceId` 자체의 특성(선행 PR `#1103` 범위)이지 이번 diff 가 새로 만든 계약 갭이 아니다.
  - 제안: 조치 불필요(참고용). 인가 축 자체의 심층 평가는 security reviewer 영역.

## 확인한 정합성 (문제 없음)

- 에러 응답 형식: `BadRequestException({code:'VALIDATION_ERROR', message:'X-Workspace-Id must be a UUID'})` 가 `GlobalExceptionFilter` 의 `getCodeFromStatus`·`{error:{code,message,requestId}}` 봉투와 정확히 일치(직접 대조: `http-exception.filter.ts:140-143`). 기존 `WORKSPACE_ID_REQUIRED` 관례와 같은 `{code, message}` 형태를 그대로 따르고, `VALIDATION_ERROR` 는 신규 코드가 아니라 이미 spec 에 등재된 표준 코드다.
- 검증 대상 술어 선택(`isUuidShaped` vs `isValidUuid`): DB(`Postgres uuid` 컬럼)가 파싱 가능한 값을 400 으로 잘못 거부해 "멤버 아님"(403)이 "요청 오류"(400)로 뒤바뀌는 회귀를 정확히 피했다 — nil UUID·v6/v7·비-RFC variant 를 의도적으로 허용하며 테스트(`uuid.spec.ts`)로 경계를 고정.
- 하위 호환성: 가드·데코레이터 두 소비처가 `resolveRequestWorkspaceContext` 공용 헬퍼를 통해 동일 검증 경로를 타므로 두 경로 응답 drift 위험이 없고, 이번 라운드에서 가드 레벨 테스트까지 추가돼(위 두 번째 발견사항) 그 일관성이 실제로 검증됐다.
- URL/경로·페이지네이션·API 버전관리: 변경 없음(N/A).
- 인증/인가: 이번 diff 자체는 `RolesGuard`/`handlerConsumesWorkspaceId` 판정 로직을 바꾸지 않는다(멤버십 검증 확장 자체는 선행 `#1103` 범위). 부팅 캐너리는 그 reflection 메커니즘이 조용히 깨지는 것을 막는 fail-closed 안전망일 뿐, 계약 표면(엔드포인트·응답 스키마)에는 영향이 없다.

## 요약

이번 변경은 API 계약 관점에서 실질적으로 낮은 위험이다. 유일한 표면 변경은 malformed `X-Workspace-Id` 헤더에 대해 마스킹된 500 을 정확한 400 `VALIDATION_ERROR` 로 정정한 것으로, 기존 에러 봉투·표준 코드 카탈로그와 완전히 정합하고 정상 클라이언트에는 영향이 없는 개선이다. 부팅 캐너리·`DiscoveryModule` 등록·테스트 픽스처 UUID화는 개별 API 계약 표면 자체를 건드리지 않으며, 캐너리의 fail-closed 오탐 리스크는 개별 엔드포인트 계약이 아니라 배포 가용성 축의 문제로 별도 트레이드오프로 이미 문서화·수용돼 있다. 선행 리뷰 라운드가 지적한 "가드 레벨 400 전파 테스트 부재"·"vacuous 전역-라우트 테스트" 두 WARNING 은 이번 라운드의 커밋에서 소스 대조로 실제 해소됨을 확인했다. 남은 항목(토큰 클레임 malformed 값 미검증, Swagger 400 문서화 공백)은 의도적으로 남겨둔 저위험 잔여 사항으로 CRITICAL/WARNING 급이 아니다.

## 위험도

LOW
