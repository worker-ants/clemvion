# 보안(Security) Review

## 리뷰 범위

`auth-guard-reflection-hardening` PR (branch-diff, 이전 라운드 `14_36_39` 산출물 + 그 라운드
WARNING 6건에 대한 RESOLUTION 반영본 포함). 핵심 런타임 보안 변경은 두 가지:

1. `RolesGuard`/`@WorkspaceId()` 데코레이터가 의존하는 private reflection
   (`ROUTE_ARGS_METADATA` + 함수 identity 비교, `workspace.decorator.ts:handlerConsumesWorkspaceId`)이
   깨질 때의 fail-open 위험을 부트타임 캐너리로 닫음
   (신규 `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` +
   `main.ts`/`app.module.ts` 배선).
2. 형식이 깨진 `X-Workspace-Id` 헤더를 500(SQLSTATE 22P02 마스킹) 대신 400
   `VALIDATION_ERROR` 로 조기 거부 (`codebase/backend/src/common/utils/uuid.ts` 신설
   `isUuidShaped` + `codebase/backend/src/common/utils/workspace-context.util.ts`).

나머지는 테스트 픽스처를 프로덕션에서 존재 불가능한 임의 문자열(`'ws1'`·`'victim-ws'` 등)에서
실제 UUID 형태로 교체한 작업, 그리고 이전 라운드가 지적한 "가드 레벨 400 테스트 부재/vacuous
테스트" WARNING 을 해소한 `roles.guard.spec.ts` 신규 테스트 3건이다. 소비처인
`common/guards/roles.guard.ts`·`common/decorators/workspace.decorator.ts` 자체는 이번 diff에
포함되지 않았으나, 새 코드의 안전성을 판정하기 위해 직접 열어 대조했다.

## 검증 방법

- `Read` 로 실제 소스 전문을 열어 게이트 숫자가 아닌 저장소 실제 줄 번호로 대조:
  `workspace-context.util.ts`, `roles.guard.ts`, `workspace.decorator.ts`, `uuid.ts`, `main.ts`.
- `git diff origin/main...HEAD` 로 `roles.guard.spec.ts`·`workspace-context.util.spec.ts` 전체
  diff 를 직접 확인해 프롬프트에서 생략된 부분을 보충.
- `common/filters/http-exception.filter.ts` 를 열어 `getCodeFromStatus(400) === 'VALIDATION_ERROR'`
  매핑과 `BadRequestException({code:'VALIDATION_ERROR', ...})` 가 정확히 일치함을 확인.
- 하드코딩 시크릿 여부: `git diff` 를 `password|secret|api[_-]?key|token\s*=|private[_-]?key|BEGIN`
  로 grep — 매치는 DI 토큰 비교(`token === DiscoveryService`) 뿐, 실제 자격증명 없음.
- 에러 메시지에 사용자 입력 반영 여부: `message:` 리터럴 grep — 정적 문자열
  `'X-Workspace-Id must be a UUID'` 뿐, 클라이언트가 보낸 raw 헤더값을 응답에 echo 하지 않음.

## 발견사항

- **[INFO]** boot fail-closed 계약이 Node 의 암묵적 `unhandledRejection` 기본 동작(프로세스 종료)에 의존
  - 위치: `codebase/backend/src/main.ts:239`(`void bootstrap();`), `codebase/backend/src/main.ts:168`(`assertWorkspaceIdReflectionWorks(app)` 호출부)
  - 상세: `assertWorkspaceIdReflectionWorks(app)` 가 던지면 `bootstrap()` 의 반환 Promise 가 reject 되지만, `main.ts` 에는 `.catch()`/`process.on('unhandledRejection', …)` 핸들러가 없다(전체 grep 0건). 지금은 Node 런타임 기본값(≥15, `--unhandled-rejections=throw`)에 의해 프로세스가 정상적으로 종료되어 의도한 대로 fail-closed 로 동작하지만, 이 보장이 코드에 명시적으로 강제되어 있지 않고 런타임 기본값에 암묵적으로 얹혀 있다. 향후 누군가 관측성 목적으로 `void bootstrap()` 을 `bootstrap().catch((err) => logger.error(err))` 형태로 바꾸면(흔한 리팩터) `process.exit(1)` 없이 에러만 로그되어, 캐너리가 막으려던 "배포가 조용히 새는" 방향으로 이 fail-closed 보장 자체가 조용히 무력화될 수 있는 경로다.
  - 제안: 필수는 아니나 `bootstrap().catch((err) => { logger.error(err); process.exit(1); });` 형태로 명시적 종료를 강제하거나, 최소한 이 위임 관계를 `workspace-reflection-canary.ts` 주석에 한 줄 추가해 향후 리팩터 시 놓치지 않게 한다.

- **[INFO]** `WorkspaceIdReflectionBrokenError` 메시지가 내부 구현 세부(비공개 API 이름·파일 경로)를 담음 — HTTP 응답 도달 경로는 없음을 확인
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (`WorkspaceIdReflectionBrokenError` 생성자, `ROUTE_ARGS_METADATA`·`handlerConsumesWorkspaceId`·파일 경로를 그대로 포함)
  - 상세: `assertWorkspaceIdReflectionWorks(app)` 는 `NestFactory.create()` 직후, `app.listen()` 이전(`main.ts:161`, `:168`)에 호출되므로 이 예외가 HTTP 응답 경로(`GlobalExceptionFilter`)에 도달할 방법이 없다 — 서버가 아직 listening 상태가 아니다. 운영자 진단용 부팅 로그로서는 적절한 상세도이며 현재 설계에서 정보 노출 위험은 없다. 향후 이 함수가 런타임 경로(예: health-check 엔드포인트)에서 재사용되면 이 가정이 깨지므로 재사용 시 재검토가 필요하다.

- **[INFO]** 부분 reflection 파손은 캐너리가 탐지하지 못함 — 코드·plan 에 이미 문서화된 알려진 한계
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`(`assertWorkspaceIdReflectionWorks` 함수 내 "부분 파손은 위 단언이 못 잡는다" 주석), `plan/in-progress/auth-guard-reflection-hardening.md`
  - 상세: `assertWorkspaceIdReflectionWorks` 는 "인식된 소비 라우트 수 == 0" 인 전면 파손만 fail-closed 로 잡는다. 일부 라우트만 인식 실패하는 부분 파손(예: 특정 컨트롤러만 데코레이터 감싸기로 인해 `Function.name` 소실)은 로그 개수 하락으로만 관측되며 능동 알람이 없다. 저자가 이미 코드 주석·plan 체크리스트에 이 트레이드오프를 명시했고 이번 리뷰가 새로 발견한 갭은 아니다 — 재확인 차원에서 기록.

검토했으나 실제 결함이 아님을 확인한 항목 (기록용):

- `UUID_SHAPE_PATTERN`/`UUID_PATTERN`(`common/utils/uuid.ts:10`,`:36`) 모두 고정 길이 캐릭터 클래스 조합(`^...$`, 중첩 정량자 없음)이라 ReDoS 표면이 없다 — 긴 입력이어도 선형 시간에 실패한다.
- `resolveRequestWorkspaceContext`(`workspace-context.util.ts:69-85`)의 헤더 형식 검증(`isUuidShaped`)은 화이트리스트 정규식이라 `' OR 1=1--'` 류 SQL 조각 형태 값을 DB 도달 전에 400 으로 차단한다. TypeORM 파라미터 바인딩으로 SQL 인젝션은 이미 방지되고 있었지만, 형식 오류가 500 으로 마스킹되던 기존 정보 노출(CWE-209 성격)을 정확한 400 으로 정정한다.
- 응답 body 에 클라이언트가 보낸 raw 헤더값을 echo 하지 않는다 — `message: 'X-Workspace-Id must be a UUID'` 는 정적 문자열이다(`workspace-context.util.ts:75-78`).
- `resolveRequestWorkspaceContext` 는 `roles.guard.ts:97-127` 에서 `userId` 부재(미인증) 체크(:108) **이후**에만 호출되므로, 헤더 형식 검증 400 응답이 미인증 요청에 새로운 정찰 표면을 열지 않는다.
- `DiscoveryModule` 추가(`app.module.ts`)는 부트 시점에만 `main.ts` 에서 1회 소비되고(`app.get(DiscoveryService)`/`app.get(MetadataScanner)`), `APP_GUARD`/`APP_INTERCEPTOR` 등 런타임 요청 경로에는 전혀 등록되지 않는다 — 새 공격 표면 없음.
- 가드 레벨 검증: `roles.guard.ts:114-119` 의 "워크스페이스 무관 라우트" early-return 은 `resolveRequestWorkspaceContext` 호출(:123-127)보다 **먼저** 실행되므로, 형식이 깨진 헤더를 실은 전역 API 요청도 400 을 내지 않고 통과한다 — 이는 원래도 의도된 동작(캐너리가 지키는 스코핑)이며, 이번 diff 에서 `roles.guard.spec.ts` 에 실제로 이 경계를 검증하는 회귀 테스트(`형식이 깨진 헤더여도 전역 라우트는 400 을 내지 않는다`)와, 반대로 `@WorkspaceId()`/`@Roles()` 라우트에서는 400 이 실제로 가드를 통과해 전파되는지(`형식이 깨진 X-Workspace-Id 는 가드에서 400 으로 전파된다` describe 블록, 3 케이스)를 검증하는 테스트가 새로 추가됐다 — 직접 `git diff` 로 대조해 확인. 403(비멤버)과 400(형식 오류)이 뒤섞이지 않고 `getMemberRole` 호출 전에 끊기는지(=22P02 마스킹 방지 지점)까지 단언한다.
- 하드코딩 시크릿: 신규 테스트 픽스처(`HEADER_WS`/`TOKEN_WS`/`WS1`/`OWN_WS`/`VICTIM_WS` 등)는 전부 합성 UUID 리터럴이며 실제 자격증명이 아니다. `git diff` 전체를 시크릿 패턴으로 grep 해 매치 없음을 확인.
- `handlerConsumesWorkspaceId`(비변경, `workspace.decorator.ts:61-80`)를 캐너리가 **재구현하지 않고 그대로 재사용**한다 — 캐너리가 자기 복제본을 검사해 정작 막으려던 파손을 통과시키는 함정을 피했다(코드 주석·테스트로 명시).

## 요약

이번 변경은 이전 라운드가 지적한 두 보안 리스크(reflection 파손 시 멤버십 검증 fail-open,
형식 오류 헤더가 500 으로 마스킹되어 클라이언트 오류가 서버 오류로 보이는 문제)를 부트타임
fail-closed 캐너리와 입력 형식 화이트리스트 검증으로 정확히 닫으며, 이전 testing 리뷰가
지적한 "가드 레벨 400 전파 테스트 부재·vacuous 테스트" WARNING 도 `roles.guard.spec.ts` 신규
테스트로 실제 해소됐음을 소스 대조로 확인했다. 인젝션(SQL/커맨드/경로탐색), 하드코딩 시크릿,
인증 우회, 안전하지 않은 암호화, 민감정보 에러 노출 관점에서 신규 결함은 발견되지 않았다.
남은 사항은 모두 INFO 수준(boot fail-closed 가 Node 기본 동작에 암묵 의존 · 부분 reflection
파손 미탐지라는 기존에 문서화된 한계 재확인)이며 착수/머지를 막을 CRITICAL·WARNING 은 없다.

## 위험도

NONE
