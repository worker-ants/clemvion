# 변경 범위(Scope) Review

## 대상 커밋
`04386bdd4` — 엔진 버그수정 재리뷰(22_42_32) 5건 WARNING 반영 + spec 동기화(SPEC-DRIFT reverse-flow). 41 files changed.

## 발견사항

- **[INFO]** 신규 공용 util 추출(`sanitize-error-message.ts`)이 리뷰 지시(security WARNING)에 정확히 대응
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (신규), `background-execution.processor.ts`, `execution-engine.service.ts`
  - 상세: `background-execution.processor.ts` 안에 있던 로컬 `sanitizeErrorMessage` 함수를 그대로(로직 무변경) 별도 파일로 이동하고, `execution-engine.service.ts` 의 `dispatchExecutionFailedNotification` 알림 메시지 조립에 동일 함수를 적용했다. 직전 재리뷰(22_42_32 security WARNING)가 "새니타이징이 한쪽 경로에만 적용돼 방어 심도가 갈린다"고 정확히 지적한 항목이며, 이번 변경은 그 지적 범위를 벗어나지 않는다. 로직 변경 없이 이동+공유로 국한됨.
  - 제안: 없음.

- **[INFO]** `execution-engine.service.spec.ts` 신규 unit 4건은 22_42_32 testing WARNING#1 을 1:1로 커버
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:767-820`
  - 상세: `getNotificationsService()` 의 4개 분기(생성자 주입/ModuleRef 지연해석/throw/캐시)를 각각 독립 `it` 로 검증한다. 리뷰가 명시적으로 지적한 미커버 분기와 정확히 일치하며, 관련 없는 다른 describe 블록·기존 테스트는 손대지 않았다(diff 상 순수 추가, 삭제 없음).
  - 제안: 없음.

- **[INFO]** `background-monitoring.e2e-spec.ts` 추가 단언은 22_42_32 testing WARNING#3 범위 내
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts:359-374`
  - 상세: 기존 테스트 케이스 끝에 `GET /notifications` 응답에서 `backgroundRunId` 미노출 + `resourceId=workflowId` 를 단언하는 코드만 추가됐다. 테스트 구조·기존 단언·주변 케이스는 변경되지 않음.
  - 제안: 없음.

- **[INFO]** 아키텍처/유지보수성 지적사항은 코드 변경 없이 plan 트래커 기록으로만 처리 — 스코프 확장 회피
  - 위치: `plan/in-progress/notif-hardening-followups.md` 신규 "후속(followup)" 섹션
  - 상세: 22_42_32 리뷰의 WARNING#4(DI 순환 인스턴스화 부채), WARNING#5(FAILED 종결 중복 → `finalizeFailedExecution` 헬퍼 추출 제안)에 대해, 실제 리팩터링을 이번 커밋에서 수행하지 않고 별도 트랙 백로그로 명시적으로 이관했다. "이번 diff 스코프를 벗어난다"는 판단이 RESOLUTION.md·아키텍처 리뷰 자체와 일치하며, 스코프 관점에서 바람직한 절제로 평가된다(리팩터링을 감행했다면 오히려 스코프 위반이었을 것).
  - 제안: 없음.

- **[INFO]** spec 3개 파일 변경은 developer 의 spec read-only 원칙에 대한 정식 예외(SPEC-DRIFT reverse-flow) 경로를 따름
  - 위치: `spec/1-data-model.md`, `spec/4-nodes/1-logic/12-background.md`, `spec/data-flow/8-notifications.md`
  - 상세: CLAUDE.md 원칙상 `spec/` 은 developer read-only 이나, `plan/in-progress/spec-update-notifications-background-run-id.md` 에 "impl-done consistency 가 BLOCK:YES(naming_collision CRITICAL) 반환 → checker 지시 + `[[feedback_plan_must_include_spec_updates]]` 메모리에 따라 developer 가 직접 반영"이라는 근거가 명시돼 있다. `/consistency-check --spec`/`--impl-done` 재검증까지 수행됐다고 기록되어 절차상 이탈이 아니다. 변경 내용도 이미 구현·검증된 `background_run_id` 컬럼/조회 방식을 spec 텍스트에 맞추는 기계적 drift 정합에 국한되며, 신규 요구사항을 spec 에 얹지 않았다.
  - 제안: 없음. 다만 이런 "developer 가 BLOCK:YES 지시로 spec 을 직접 고치는" 경로는 예외 사유이므로, 향후 유사 사례에서도 plan 문서에 근거를 남기는 관행이 유지되면 좋음(이번 건은 이미 충족).

- **[INFO]** `notif-hardening-followups.md` / `spec-update-notifications-background-run-id.md` 갱신은 체크박스 상태·근거 기록에 국한, 트래커 구조 자체를 바꾸지 않음
  - 위치: 두 plan 파일의 diff
  - 상세: 기존 항목의 `[ ]` → `[x]` 전환 + 근거 서술 추가, "게이트 이행 결과"/"잔여" 섹션 신설이 전부다. 트래커 스키마·다른 무관 항목을 재정렬하거나 삭제하지 않았다.
  - 제안: 없음.

- **[INFO]** 대량의 review artifact 파일(review/code/22_42_32/**, review/consistency/22_42_31/**, review/consistency/23_06_30/**)이 diff 에 포함 — 코드 변경이 아니라 리뷰/체크 프로세스 자체의 산출물
  - 위치: 파일 목록 8~38 (RESOLUTION.md, SUMMARY.md, 각 관점 reviewer .md, meta.json, `_retry_state.json`)
  - 상세: 이들은 CLAUDE.md 규약상 `review/code/**`, `review/consistency/**` 에 정식으로 위치가 지정된 산출물이며, 해당 라운드의 `/ai-review`·`/consistency-check` 실행 결과를 그대로 커밋한 것이다. "코드 변경과 무관한 파일 수정"으로 보일 수 있으나 실제로는 이번 작업의 게이트 이행 증적(Definition of Done)이자 규약이 요구하는 표준 산출물이라 스코프 이탈이 아니다. 다만 커밋 크기(1582 insertions, 41 files)의 대부분이 리뷰 산출물 텍스트라는 점은 리뷰어 입장에서 "실질 코드 diff"를 찾기 어렵게 만드는 신호로 기록해 둘 만하다(리뷰 실무상 이미 report/RESOLUTION 파일 자체는 별도 규칙에서 산출을 금지하지 않는 예외로 다뤄짐).
  - 제안: 없음. 프로세스 규약을 따른 정상 산출물.

- **[INFO]** `sanitize-error-message.ts` 의 새 import 위치가 다른 import 그룹과 살짝 어긋남
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:11` — `@nestjs/core` import 바로 다음, `@nestjs/typeorm` import 이전에 로컬 상대경로 import(`./sanitize-error-message`)가 삽입됨
  - 상세: 통상 컨벤션(외부 패키지 import 를 먼저 묶고 로컬 상대경로 import 를 마지막에 두는 것)과 비교하면 위치가 다소 이례적이나, 이 프로젝트에 강제된 import 순서 lint 규칙이 있는지 diff 만으로는 확인 불가. 기능상 영향 없음.
  - 제안: 미미한 사항. lint(`eslint import/order` 등)가 실제로 강제한다면 자동 정렬로 해소될 사안이라 CRITICAL/WARNING 아님.

## 요약
이번 커밋은 직전 재리뷰(22_42_32)가 지적한 WARNING 5건(+security 1건)에 대한 조치와, checker 가 BLOCK:YES 로 지시한 SPEC-DRIFT 정합을 닫는 것으로 목적이 명확히 한정된다. 실제 코드 변경은 4개 파일(새니타이저 유틸 추출·공유, execution-engine 알림 메시지에 새니타이징 적용, 신규 unit 4건, e2e 단언 추가)에 그치며 모두 직전 리뷰의 특정 지적사항과 1:1로 대응한다. 아키텍처/유지보수성 지적(DI 순환 부채, FAILED 종결 중복)은 코드를 건드리지 않고 plan 트래커 후속 항목으로만 기록해 실제 리팩터링을 이번 diff 에 끌어들이지 않은 점이 스코프 관리 측면에서 바람직하다. spec 3개 파일 변경은 developer read-only 원칙의 정식 예외(SPEC-DRIFT reverse-flow, checker BLOCK:YES 지시)이자 이미 구현된 내용을 spec 텍스트에 맞추는 기계적 정합으로 신규 요구사항 도입이 아니다. 나머지 대다수 파일(review/code, review/consistency 하위 30여 개)은 실질 코드가 아니라 규약이 요구하는 리뷰·검증 프로세스 산출물이며 위치·형식도 CLAUDE.md 규약을 따른다. 요청 범위를 벗어난 리팩터링·기능 확장·무관한 파일 수정·의미 없는 포맷팅 변경은 발견되지 않았다.

## 위험도
NONE
