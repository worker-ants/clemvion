# API 계약(API Contract) 리뷰 — PR3 크래시/재시작 RUNNING 세그먼트 re-drive

대상 커밋: `11c7b2ff5 feat(execution-engine): PR3 크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.5 case B)`
핵심 API 표면 변경: `POST /api/executions/_test/recover-stuck-executions` 신규 추가 (`executions.controller.ts`). 그 외 파일(`execution-engine.service.ts` 내부 로직, `graph-dispatch.types.ts` 타입, spec/plan 문서)은 외부 REST/WS 계약을 변경하지 않는 내부 구현·문서 변경.

## 발견사항

- **[WARNING]** 신규 `_test/recover-stuck-executions` 엔드포인트가 `NODE_ENV` 값만으로 게이팅되어, 운영 환경 설정 실수 시 프로덕션에 노출될 위험이 구조적으로 존재
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:205-213` (`triggerStuckRecoveryForTest`)
  - 상세: 라우트 자체는 앱 부팅 시 controller 에 항상 등록되고(`@Post('_test/recover-stuck-executions')`), 매 요청마다 핸들러 내부에서 `process.env.NODE_ENV !== 'test'` 를 검사해 404 를 던지는 방식이다. 이는 "라우트 미등록"이 아니라 "런타임 조건부 404"이므로, (1) 배포 환경변수 오설정(`NODE_ENV` 미설정·오타·`.env` 누락)이 발생하면 즉시 이 엔드포인트가 활성화된다. (2) 이 경로는 인증(Bearer JWT, `APP_GUARD`) 은 통과해야 하므로 완전 미인증 공격 표면은 아니지만, **인증된 임의 워크스페이스 사용자가 전역 stuck-recovery 스캔(다른 워크스페이스의 stale RUNNING execution 포함)을 트리거**할 수 있다 — `runStuckRecoveryScan` → `recoverStuckExecutions` 는 workspace 필터 없이 전역 스캔이라, 인가(authorization) 관점에서 "요청자가 트리거할 권한이 있는 리소스" 개념이 없다. 즉 인증은 있으나 **인가는 전혀 없다** (Roles/권한 체크 부재 — 같은 파일의 `re-run` 엔드포인트는 `@Roles('editor')` 를 명시하는 것과 대비).
  - 제안: 이중 방어를 권장한다 — (a) `NODE_ENV` 체크에 더해 앱 부트스트랩 시점(`main.ts` 또는 모듈 등록 시점)에 `NODE_ENV==='test'` 가 아니면 이 컨트롤러/라우트 자체를 등록하지 않는 방식(예: `ConditionalModule` 또는 provider 조건부 등록)으로 전환해, "라우트가 존재하되 404 응답"이 아니라 "라우트가 애초에 존재하지 않음"을 보장. (b) 최소한 별도 env 플래그(`E2E_TEST_ENDPOINTS_ENABLED=1` 등 `NODE_ENV` 와 별개의 명시적 스위치)를 추가 조건으로 걸어, 단일 env var 오설정만으로 활성화되지 않게 이중화. (c) test 환경 한정이라도 워크스페이스/역할 검증을 완전히 생략하는 대신 최소한 인증 사용자 로그(감사 목적)는 남기는 것을 고려.

- **[INFO]** `@ApiExcludeEndpoint()` 로 Swagger 문서에서는 숨겼으나 실제 라우트는 계속 노출됨 — 문서-실제 불일치가 아니라 의도된 은닉이지만, 프로덕션 라우트 표면 관리 원칙과 어긋난다는 점은 기록해 둘 필요
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:204, 206-213`
  - 상세: `ApiExcludeEndpoint()` 는 OpenAPI 스펙 생성에서만 숨기는 장치이며 실제 HTTP 라우팅에는 영향이 없다. 즉 "프로덕션 표면 아님"이라는 주석의 의도와 달리, 실제로는 프로덕션 빌드에도 라우트가 항상 컴파일·등록되고 프로세스가 매 요청마다 `NODE_ENV` 를 재평가한다. 이는 WARNING 항목의 근본 원인이기도 하다.
  - 제안: WARNING 항목의 (a)와 동일 — 컨트롤러/프로바이더 자체를 test 빌드 한정으로 조건부 등록하면 이 INFO 도 자연히 해소된다. 최소 조치로 남긴다면 이 상태(런타임 게이팅)가 "임시·e2e 전용"임을 plan/spec 에 명시적으로 남겨(§PR4 검토 시 정리) 영구화되지 않도록 트래킹 필요 — 이미 컨트롤러 주석·plan(`spec-draft-crash-running-redrive.md`)에 "PR4 에서 운영용 on-demand trigger 별도 검토"로 남아 있어 이 부분은 이미 충족.

- **[INFO]** 응답 스키마가 다른 액션형 엔드포인트와 일관되게 `{ success: true }` 를 반환하나, 실제로는 fire-and-forget 스캔의 "트리거 접수"만을 의미해 `202 Accepted` semantics 와 일치. 다만 스캔 실패(예: lock 획득 실패, DB 오류)에 대한 에러 응답 형식이 없음
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:206-213`, `execution-engine.service.ts` `recoverStuckExecutions`(재구동 대상 없음/lock 실패 시 조용히 return)
  - 상세: `runStuckRecoveryScan` → `recoverStuckExecutions` 내부에서 (1) lock 획득 실패 시 아무 것도 하지 않고 반환, (2) re-claim 대상 0건이면 조용히 반환, (3) `reclaimStuckRunningExecution` 자체(DB 쿼리)가 실패하면 예외가 전파되어 컨트롤러까지 propagate 되지만 컨트롤러에 별도 catch 가 없어 Nest 기본 500 으로 응답됨(다른 엔드포인트들의 `INVALID_STATE`/`VALIDATION_ERROR` 같은 구조화된 에러 응답 관례와 다름). e2e 전용이라 실사용상 영향은 제한적이나, 이 컨트롤러의 다른 엔드포인트들이 도메인 에러를 명시적으로 매핑하는 패턴(`continueExecution` 참고)과 비교하면 이 엔드포인트만 "예외 발생 시 그대로 노출"이라는 점에서 일관성이 낮다.
  - 제안: 테스트 전용 엔드포인트이므로 필수는 아니나, 최소한 e2e 테스트가 500 을 받았을 때 디버깅 가능하도록 에러 바디를 통일된 `{ error: { code, message } }` 포맷으로 감싸는 것을 권장. 우선순위 낮음(테스트 유틸 성격).

- **[INFO]** 라우트 네이밍(`_test/...` prefix)이 RESTful 리소스 네이밍 컨벤션과 다르지만, 의도적으로 "테스트 전용/비-RESTful" 임을 시각적으로 구분하기 위한 것으로 보이며 문제라기보다 관찰 사항
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:205`
  - 상세: 다른 액션형 서브라우트(`:id/stop`, `:id/continue`, `:id/re-run`)는 모두 리소스(`:id`) 하위 액션으로 일관되나, `_test/recover-stuck-executions` 는 리소스 컬렉션 루트 바로 아래 `_test` prefix 를 쓴다. 언더스코어 prefix 관례(`_test/...`)는 Nest 라우트 매칭에서 실제 UUID 파라미터(`:id`)와 충돌하지 않도록 하는 목적도 겸한 것으로 보이며(문자열 `_test` 는 `ParseUUIDPipe` 를 통과할 필요가 없는 별도 정적 경로), 실질적인 라우트 충돌은 없다(POST 전용, `:id/stop`·`:id/continue`·`:id/re-run` 과 경로 형태가 다름). 이 자체는 결함이 아니라 앞으로 유사한 test-only 엔드포인트가 늘어날 경우의 네이밍 패턴으로 참고할 사항.
  - 제안: 변경 불필요. 향후 유사 테스트 전용 엔드포인트가 추가되면 동일 `_test/` prefix 컨벤션을 유지해 일관성 확보 권장.

- **[INFO]** `RehydrationError` export 확장 및 `NodeDispatchLoopParams.skipExecutedNodes` 신규 옵션 필드는 내부 타입 계약(모듈 간 TS 인터페이스)이며 외부 HTTP/WS API 계약에는 영향 없음 — 하위 호환성·버전 관리 관점에서 문제 없음
  - 위치: `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts:84-91`, `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:38-42`
  - 상세: `skipExecutedNodes?: boolean` 은 옵셔널 필드로 추가되어 기존 호출부(`runExecution`, case A `driveResumeAwaited`)는 무전달(`undefined`→falsy)로 기존 동작을 그대로 보존한다. 하위 호환성 breaking 없음.
  - 제안: 없음(정상).

## 요약

이번 변경의 핵심 API 계약 이슈는 신규 엔드포인트 `POST /api/executions/_test/recover-stuck-executions` 하나로 집약된다. 이 엔드포인트는 e2e 전용 목적이 명확히 문서화되어 있고 `@ApiExcludeEndpoint()` 로 공개 API 문서에서는 배제했으며, `JwtAuthGuard` 가 전역 `APP_GUARD` 로 적용되어 있어 완전 미인증 상태로는 접근할 수 없다는 점은 확인했다. 그러나 (1) 게이팅이 라우트 미등록이 아니라 매 요청 런타임에 `process.env.NODE_ENV` 문자열 비교로만 이뤄져 배포 환경변수 설정 실수 시 즉시 활성화될 수 있는 구조적 위험이 있고, (2) 인증은 있으나 워크스페이스/역할 기반 인가가 전혀 없어 인증된 임의 사용자가 전역(全 workspace) stuck-recovery 스캔을 트리거할 수 있다는 점이 가장 중요한 지적이다. 나머지(에러 응답 미구조화, 네이밍 프리픽스)는 test-only 성격을 감안하면 경미하다. 그 외 파일들(`execution-engine.service.ts` 내부 재구동 로직, `graph-dispatch.types.ts` 옵셔널 필드 추가, spec/plan 문서, consistency 리뷰 산출물)은 외부 REST/WS API 응답 스키마·버전·페이지네이션·에러 코드 표면을 변경하지 않는 내부 구현이라 API 계약 관점에서는 해당 없음.

## 위험도

MEDIUM
