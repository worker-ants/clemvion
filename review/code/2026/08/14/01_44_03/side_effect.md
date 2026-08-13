# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 이번 diff 는 지금까지 **사실상 죽어 있던 프로덕션 분기(이벤트 발행·메트릭 기록·409 거절·복구 UPDATE)를 실제로 살려낸다** — 배포 즉시 관측 가능한 부작용의 blast radius 가 커진다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `admitExecutionOrDefer`(약 2913~2962행, `if (admitted)` 블록의 `this.recordRunningSegmentStart(executionId)` + `this.eventEmitter.emitExecution(executionId, ExecutionEventType.EXECUTION_STARTED, …)`) 및 `updateExecutionStatus`(약 8504~8555행, `persisted` 가 `enteringRunning && persisted` → `recordRunningSegmentStart`, `emitTerminalExecutionMetrics(execution, newStatus, persisted)` 를 가른다). `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 의 `reExtractAll`/`reEmbedAll` CAS 락(`ConflictException` 409)과 `reEmbedAll` 의 `resetRows.length === 0` 분기(빈 KB 즉시 `reembed_status='idle'` 로 되돌리는 추가 `UPDATE` 쿼리).
  - 상세: 이전 코드는 `UPDATE … RETURNING` 결과를 행 배열로 오인해 `rows.length`가 늘 2(튜플 길이)였다. 그 결과 위 네 갈래(§ EXECUTION_STARTED emit, § 종결 이벤트 `persisted=false` 스킵, § KB CAS 락 409, § 빈 KB idle 복귀 UPDATE)가 전부 프로덕션에서 한 번도 발동한 적이 없었다. 이 PR 이 `updateReturningRows` 로 튜플을 올바르게 언랩하면서 네 갈래가 **배포 직후부터 실제로 실행되기 시작**한다 — 이는 의도된 버그 수정이지만, 부작용 관점에서는 (a) `EXECUTION_STARTED` 이벤트를 구독하는 하류 리스너가 이제 처음으로 이벤트를 받고, (b) admission 의 2초 재큐 지연이 사라지며, (c) 동시 재추출/재임베딩 요청이 이제 처음으로 409 를 받고, (d) 실패율/메트릭 대시보드가 실제 증가 없이 급변할 수 있다는 뜻이다.
  - 확인: 이 side effect 는 팀 스스로 이미 인지·문서화했다 — `CHANGELOG.md`(Unreleased 항목), `plan/in-progress/exec-intake-followups.md`, `plan/in-progress/ie-resume-turn-boundary-cancel.md`, `plan/in-progress/retry-turn-terminal-guard.md` 전부에 "배포 후 관측 필요" 로 명시 등재되어 있다. 즉 새로 발견한 미문서화 결함은 아니다.
  - 제안: 추가 조치는 불필요해 보이나(이미 plan 에 관측 항목으로 등재됨), 배포 시점에 위 4갈래를 한 체크리스트로 묶어 롤아웃 직후 모니터링하는 것을 권장한다(이미 계획된 바와 일치).

- **[INFO]** `codebase/backend/tsconfig.build.json` 의 `exclude` 에 `**/__testing__/**` 추가 — `dist` 빌드 산출물에서 테스트 전용 헬퍼(`source-scan.ts`)가 제외된다.
  - 위치: `codebase/backend/tsconfig.build.json:7`
  - 상세: `grep -rn "__testing__" codebase/backend/src --include="*.ts" | grep -v spec.ts` 로 확인한 결과 `source-scan.ts` 는 어떤 비-스펙 소스에서도 import 되지 않는다. 빌드 제외로 인한 런타임 회귀 위험 없음.

- **[INFO]** `updateReturningRows` 가 비-배열 입력에 대해 NestJS `HttpException` 이 아닌 **평문 `Error`** 를 던진다 — OAuth 콜백·admission·KB CAS 락 경로에 새로운 fail-fast 실패 모드가 생긴다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:65-69` (`throw new Error(...)`)
  - 상세: 이 패턴은 자매 헬퍼 `assertRowArray`(`codebase/backend/src/common/utils/assert-row-array.ts`)와 동일하고 새로 도입된 관용구는 아니다. 다만 이 PR 이전에는 `handleCallback`/`admitExecutionOrDefer`/KB CAS 락 지점들이 이런 가드 자체가 없었으므로(튜플을 그대로 오용), 드라이버 shape 가 향후 다시 바뀌면 이 지점들은 이제 **조용한 오동작 대신 502/500 류의 명시적 예외**로 죽는다. 의도된 하드닝이며 프로덕션 계약을 깨는 방향은 아니지만, 호출부(OAuth 콜백 HTTP 엔드포인트)가 Nest 전역 예외 필터를 통해 일반 500 메시지를 돌려준다는 점은 API 소비자 관점에서 새로운 실패 시나리오이므로 기록해 둔다.
  - 제안: 조치 불요 — 관측 항목으로만 인지.

- 그 외 전역 변수 도입, 환경 변수 신규 read/write, 의도치 않은 파일시스템 쓰기, 공개 함수 시그니처의 호출자 영향, 신규 외부 네트워크 호출은 발견되지 않았다. `execution-engine.service.ts`·`knowledge-base.service.ts` 에서 `assertRowArray` import 는 각각 여전히 사용 중(전자 `lockNonTerminalExecutionRow`)이거나 애초에 미사용이라 dead import 문제도 없다. 신규 e2e 스펙(`auth-oauth-callback.e2e-spec.ts`)의 토큰 교환은 기존 `isOAuthStubModeAllowed()`(`NODE_ENV`=test/development 게이팅, 이번 diff 로 변경되지 않음) 로 스텁 처리되어 실제 Google/GitHub 로 네트워크 호출이 나가지 않음을 확인했다.

## 요약

이번 변경의 핵심 부작용은 "버그 수정 자체가 부작용" 이라는 역설적 성격을 띤다 — 지금까지 TypeORM 튜플 shape 오인으로 침묵 상태였던 이벤트 발행(`EXECUTION_STARTED`)·메트릭 기록·KB CAS 락 409·admission 2초 지연 소멸 등 네 갈래가 배포 직후부터 실제로 발동하기 시작한다. 이는 CHANGELOG·복수의 plan 문서에 이미 "배포 후 관측" 항목으로 명시적으로 기록돼 있어 미문서화된 위험은 아니지만, side-effect 관점에서 가장 큰 blast radius 를 가진 변경이므로 WARNING 으로 표기해 가시성을 확보한다. 그 외 신규 헬퍼(`updateReturningRows`)·tsconfig 빌드 제외·신규 e2e 스펙은 기존 관용구(`assertRowArray`, 스텁 모드 게이팅)를 그대로 따르며 전역 상태·환경변수·파일시스템·네트워크 측면에서 새로운 미검토 부작용을 만들지 않는다.

## 위험도

MEDIUM
