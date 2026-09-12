# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `rotateBotToken` 엔드포인트의 응답 상태 코드가 500 → 400 으로 바뀌는 공개 API 행위 변경 (의도적, 문서화됨)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`)
  - 상세: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 `:id` 에 `ParseUUIDPipe` 를 추가해, 비-UUID 값이 더 이상 `findById` 까지 흘러가 Postgres 22P02 → `GlobalExceptionFilter` 기본값 500 `INTERNAL_ERROR` 로 마스킹되지 않고 400 `VALIDATION_ERROR` 로 즉시 끊긴다. 메서드 시그니처(`triggerId: string`)는 그대로지만 **HTTP 계약(런타임 파이프라인 동작)** 이 바뀌므로 이 엔드포인트를 호출하는 외부 클라이언트·모니터링 중 5xx 를 재시도/알림 트리거로 쓰는 소비자가 있다면 관측치가 사라진다.
  - 이 변경은 `CHANGELOG.md` 에 **이미 상세히 공지**되어 있고(`- ⚠️ 배포 시 확인` 문구, 저장소 내 유일한 소비자인 프런트엔드 토스트가 status 를 분기하지 않음을 확인했다는 서술 포함), `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 에도 사전 실측·근거가 남아 있다. 결함(입력 오류가 서버 장애로 마스킹됨)을 고치는 올바른 방향의 변경이라 판단하며, 부작용 관점에서는 "제대로 공지된 breaking behavior change" 로 분류한다 — 새로 발견된 미공지 부작용은 아니다.
  - 제안: 배포 전 이 엔드포인트를 사용하는 외부 자동화/모니터링(저장소 밖)에 상태 코드 의존 여부를 재확인. 코드 자체에는 추가 조치 불필요.

- **[INFO]** 신규 fixture 컨트롤러(`ParamUuidFixtureController`)가 실제 Nest 데코레이터(`@Controller`, `@Post`, `@ApiExcludeEndpoint`)로 `_test/backdoor`·`_test/backdoor-pipeless` 라우트를 선언하지만, 프로덕션 앱에 배선되지 않음을 확인함
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` (전체 — `excluded`/`excludedPipeless` 메서드)
  - 상세: 이 파일은 실제 라우트 데코레이터를 쓰는 대조군 fixture라, 만약 저장소에 `*.controller.ts` 파일명 패턴 기반 자동 스캔/glob 등록 메커니즘이 있었다면 백도어 라우트가 프로덕션 앱에 실릴 위험이 있었다. `codebase/backend/src/app.module.ts` 를 확인한 결과 컨트롤러는 모두 각 `*.module.ts` 에서 **정적 import + `@Module({ controllers: [...] })` 명시**로만 등록되고, `require.context`/`readdirSync`/`glob` 기반 자동 스캔은 존재하지 않는다. 또한 가드의 `SCAN_ROOT` 도 `src/modules` 로 한정되어 이 fixture(`src/repo-guards/__tests__/fixtures/...`)는 가드 자신의 스캔 대상에도 들지 않는다(fixture 헤더 주석이 이미 이 사실과, 형제 전수-스캔 가드들(`swagger-dto-contract`, `nullable-type-lie-cast`)은 여전히 이 파일을 순회한다는 점을 명시).
  - 제안: 조치 불요 — 확인 결과 안전. 다만 향후 이 fixture 디렉터리에 실제 라우트를 추가하는 관례가 반복된다면, 컨트롤러 등록 방식이 정적 유지되는지(자동 스캔 도입 여부) 주기적으로 재확인할 가치가 있다.

- **[INFO]** 신규 repo-guard(`param-uuid-pipe-guard.ts`)가 테스트 실행 시 `src/modules` 하위 전체 `.controller.ts` 를 `fs.readFileSync` 로 읽음
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` 의 `scanUuidParams` 함수
  - 상세: 파일시스템 읽기만 발생하고 쓰기/삭제는 없음. 이 저장소의 다른 `repo-guards/__tests__/*` 가드(`dto-class-name-collision`, `swagger-dto-contract` 등)와 동일한 패턴이라 신규 부작용 클래스가 아니다.
  - 제안: 조치 불요.

- **[INFO]** `backend-labels.ts`/`backend-labels.test.ts`/plan 문서 변경은 주석·플랜 체크리스트·문서 재배치뿐, 런타임 값(매핑 딕셔너리 키·값, export 되는 상수)은 변경되지 않음을 diff 로 확인
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:602-616` 부근, `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:336-348` 부근
  - 상세: `TRIGGER_NOT_FOUND` 항목 자체는 그대로 남고 주석 귀속만 정정되어, 프런트엔드 i18n 매핑 동작에는 영향 없음.
  - 제안: 조치 불요.

## 검증 메모

- 저장소 트리에는 아무것도 쓰지 않았다(읽기/`grep`/`sed -n`만 사용). `git status --short` 결과 사전에 존재하던 미추적 `review/**` 산출물 5건만 남아 있고, 이번 리뷰로 추가/변경된 파일은 없다.
- `switchWorkspace`(`auth.controller.ts`)의 `ParseUUIDPipe` 런타임 축은 이번 diff 이전부터 이미 존재했음을 `grep` 으로 직접 확인 — 이번 변경은 `@ApiParam({format:'uuid'})` 문서 축 추가만이며 런타임 동작 변경 없음.
- `AppModule`(`codebase/backend/src/app.module.ts`)이 전부 정적 import 기반 컨트롤러 등록임을 확인 — 자동 디스커버리 부재.

## 요약

이번 변경 묶음(트리거 `:id` UUID 파이프 추가, 관련 신규 정적 가드/테스트, 가이드 문서·i18n 주석 정정, 환경변수명 오기 수정)은 대부분 문서·테스트 전용이라 부작용이 없다. 유일한 실질적 런타임 부작용은 `rotateBotToken` 엔드포인트가 비-UUID `:id` 에 대해 500 대신 400 을 반환하도록 바뀐 것인데, 이는 의도된 결함 수정이며 CHANGELOG·plan 문서에 영향 범위(저장소 내 유일 소비자는 상태 코드를 분기하지 않음)까지 실측·공지되어 있다. 신규 fixture 컨트롤러가 실제 Nest 데코레이터로 백도어형 라우트를 선언하는 점은 잠재적 위험 패턴으로 보여 프로덕션 앱 배선 여부를 직접 확인했으며, 정적 import 전용 등록 구조상 안전함을 검증했다. 전역 상태·환경 변수·네트워크 호출·이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW
