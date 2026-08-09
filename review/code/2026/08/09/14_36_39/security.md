# 보안(Security) Review

## 리뷰 범위

`auth-guard-reflection-hardening` PR — `RolesGuard`/`@WorkspaceId()` 데코레이터가 의존하는
private reflection(`ROUTE_ARGS_METADATA` + 함수 identity 비교)이 깨질 때의 fail-open 위험을
부트타임 캐너리로 닫고(신규 `common/decorators/workspace-reflection-canary.ts` +
`main.ts`/`app.module.ts` 배선), 형식이 깨진 `X-Workspace-Id` 헤더를 500 대신 400
`VALIDATION_ERROR` 로 조기 거부(`uuid.ts` 신설 `isUuidShaped` + `workspace-context.util.ts`)하는
변경. 나머지는 테스트 픽스처를 프로덕션에서 존재 불가능한 임의 문자열(`'ws1'` 등)에서 실제
UUID 형태로 교체하는 작업과 plan/consistency-check 산출물이다.

핵심 런타임 로직(`roles.guard.ts`, `workspace.decorator.ts`)은 이번 diff 에 포함되지 않았으나,
새 코드의 안전성을 판정하기 위해 `Read` 로 직접 열어 대조했다 — 아래 근거에 반영.

## 발견사항

- **[INFO]** boot fail-closed 계약이 Node 의 암묵적 `unhandledRejection` 기본 동작(throw)에 의존
  - 위치: `codebase/backend/src/main.ts:239` (`void bootstrap();`), `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:91-116` (`assertWorkspaceIdReflectionWorks`)
  - 상세: `assertWorkspaceIdReflectionWorks(app)` 가 던지면 `bootstrap()` 의 반환 Promise 가 reject 되고, `main.ts` 에는 `.catch()`/`process.on('unhandledRejection', …)` 핸들러가 없어(확인: `main.ts`·`instrumentation.ts` grep 0건) Node 22 기본값(`--unhandled-rejections=throw`, 명시적 override 없음 — `package.json` `start:prod` 확인)에 의해 프로세스가 비정상 종료된다. **지금은 의도한 대로 fail-closed 로 동작**하지만, 이 보장이 코드 어디에도 명시적으로 강제되어 있지 않고 Node 런타임 기본값에 암묵적으로 얹혀 있다. 향후 누군가 옵저버빌리티 목적으로 `void bootstrap()` 을 `bootstrap().catch((err) => logger.error(err))` 처럼 바꾸면(흔한 리팩터링 패턴) `process.exit(1)` 없이 에러만 로그되고 이벤트 루프가 살아있는 채로(`app.listen()` 은 도달 못했으므로 실제 서버는 안 뜸) 컨테이너 헬스체크·재시작 로직에 따라 결과가 갈릴 수 있다 — 원 결함(cross-tenant fail-open)을 막으려던 캐너리 자체가 "배포가 멈춘다"는 보장을 조용히 잃을 수 있는 경로다.
  - 제안: 필수는 아니나, 이 계약을 코드에 명문화하는 편이 견고하다 — 예: `bootstrap().catch((err) => { logger.error(err); process.exit(1); });` 로 명시적 종료를 강제하거나, 최소한 이 위임 관계(암묵적 unhandledRejection → 프로세스 종료가 fail-closed 의 실제 메커니즘)를 `workspace-reflection-canary.ts` 주석에 한 줄 추가.

- **[INFO]** `WorkspaceIdReflectionBrokenError` 메시지가 내부 구현 세부(비공개 API 이름·파일 경로)를 담음 — 노출 경로 없음을 확인
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:44-57`
  - 상세: 메시지가 `ROUTE_ARGS_METADATA`·`handlerConsumesWorkspaceId`·파일 경로를 그대로 담고 있다. 이 예외는 `app.listen()` 이전, `NestFactory.create()` 직후 boot 단계에서만 던져지므로 HTTP 응답 경로(`GlobalExceptionFilter`)에 도달할 방법이 없다 — 실제로 도달하면 서버가 아직 listening 상태가 아니라 클라이언트가 받을 응답 자체가 없다. 운영자 진단용 로그 메시지로서는 적절한 상세도이며, 현재 설계에서는 정보 노출 위험이 없음을 확인했다. 향후 이 함수를 런타임 경로(예: health check 엔드포인트)에서 재사용하게 되면 이 가정이 깨지므로 재사용 시 재검토 필요.

- **[INFO]** 부분 reflection 파손은 캐너리가 탐지하지 못함 — 이미 코드·plan 에 문서화된 알려진 한계
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:29-30`, `plan/in-progress/auth-guard-reflection-hardening.md`
  - 상세: `assertWorkspaceIdReflectionWorks` 는 "인식된 소비 라우트 수 == 0" 만 fail-closed 로 잡고, 일부 라우트만 인식 실패하는 부분 파손은 로그의 개수 하락으로만 관측된다(능동 알람 없음). 저자가 이미 주석·plan 체크리스트에 명시한 의도적 트레이드오프이며 이번 리뷰가 새로 발견한 갭이 아니다 — 재확인 차원에서 기록.

검토했으나 실제 결함이 아님을 확인한 항목 (기록용):

- `UUID_SHAPE_PATTERN` (`common/utils/uuid.ts`)·`UUID_PATTERN` 모두 고정 길이 캐릭터 클래스 조합이라 중첩 정량자가 없다 — ReDoS 표면 없음.
- `resolveRequestWorkspaceContext` 의 헤더 형식 검증(`isUuidShaped`)은 화이트리스트 정규식이라 `' OR 1=1--'` 류 SQL 조각 형태 값을 DB 도달 전에 400 으로 차단한다(TypeORM 파라미터 바인딩으로 이미 SQL 인젝션은 방지되고 있었지만, 형식 오류가 500 으로 마스킹되던 기존 결함을 정확한 400 으로 정정 — 정보 노출(CWE-209) 개선).
- `resolveRequestWorkspaceContext` 는 `userId` 확인(`RolesGuard.canActivate` 상단의 `if (!userId) return …`) **이후**에만 호출되므로, 헤더 형식 검증 400 응답이 미인증 요청에 새로운 정찰 표면을 열지 않는다.
- `DiscoveryModule` 추가(`app.module.ts`)는 부트 시점에만 소비되고 `APP_GUARD`/`APP_INTERCEPTOR` 등 런타임 요청 경로에 전혀 등록되지 않는다 — 새 공격 표면 없음.
- `BadRequestException({ code: 'VALIDATION_ERROR', message: 'X-Workspace-Id must be a UUID' })` 는 `GlobalExceptionFilter`(비변경 파일, 직접 열람 확인)를 통과해도 스택트레이스·내부 상태를 노출하지 않는다.
- 신규 테스트 픽스처(UUID 상수들)는 전부 합성 값이며 실제 시크릿·자격증명이 아니다.

## 요약

이번 PR 은 이전 라운드에서 지적된 두 보안 리스크(reflection 파손 시 멤버십 검증 fail-open,
형식 오류 헤더가 500 으로 마스킹되어 클라이언트 오류가 서버 오류로 보이는 문제)를 각각
부트타임 fail-closed 캐너리와 입력 형식 화이트리스트 검증으로 정확히 닫는다. 새로 추가된
코드(`workspace-reflection-canary.ts`, `uuid.ts` 의 `isUuidShaped`, `workspace-context.util.ts`
의 400 조기 거부)는 인젝션·정보 노출·인가 우회 관점에서 새로운 취약점을 만들지 않았고, 관련
런타임 로직(`roles.guard.ts`, `workspace.decorator.ts`)을 직접 열람해 대조한 결과 문서화된
동작과 실제 구현이 일치한다. 발견한 사항은 모두 INFO 수준(견고성 제안·이미 문서화된 한계
재확인)이며 착수/머지를 막을 CRITICAL·WARNING 은 없다.

## 위험도

NONE
