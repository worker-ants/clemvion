# 정식 규약 준수 검토 — `spec/5-system/4-execution-engine.md`

## 검토 범위 요약

- 검토 모드: `--impl-done`, diff-base `origin/main`
- 코드 diff 로 제시된 변경: `execution-engine.service.ts` 의 `finalizeFailedExecution` private 헬퍼 추출 (초기 세그먼트 `runExecution` catch / 재개 세그먼트 `finalizeResumedExecutionOutcome` 이 공유). 상태 마킹·error 봉인(§1.4 sentinel)·`EXECUTION_FAILED` WS emit·`execution_failed` 알림 dispatch 를 일원화 — **순수 리팩터(behavior-preserving), 신규 에러 코드·payload 필드·API 표면 없음**.
- target 문서 자체의 실제 diff (`git diff origin/main...HEAD -- spec/5-system/4-execution-engine.md`): §4.4 "이벤트 발행 sink" 절에 DI 순환 해소 기법을 `forwardRef` / `ModuleRef.get(strict:false)` 2종으로 확장 서술하는 표 + 설명 문단 추가 (8 insertions, 1 deletion). 코드 diff(finalizeFailedExecution 추출) 와는 별개 변경이며, 같은 PR 계열의 §4.4 문서화 파트로 보인다.

코드 확인(절대경로 워크트리 기준, `git -C .../notif-followup-refactor-8c7ad2 grep`)으로 아래를 검증함:
- `finalizeFailedExecution` 이 여전히 내부에서 `dispatchExecutionFailedNotification` 을 호출 (`execution-engine.service.ts:4442`) → `spec/data-flow/8-notifications.md` §1.1(라인 71) 이 명명한 "`ExecutionEngineService.dispatchExecutionFailedNotification` — 초기 세그먼트 `runExecution` catch 및 재개 세그먼트 `finalizeResumedExecutionOutcome` 양쪽" 서술이 리팩터 후에도 여전히 사실과 일치.
- `getNotificationsService`(`ModuleRef(strict:false)` 지연 해석, `execution-engine.service.ts:700`) 및 `NotificationsService.getWebsocket`(`notifications.service.ts`) 존재 확인 — §4.4 신규 표 내용과 코드가 일치.
- PR #841 은 실제 커밋 이력에 존재 (`d97ac6520 feat(notifications): 알림 파이프라인 후속 하드닝 3건 ... (#841)`) — 표 안의 PR 참조가 날조가 아님.
- `execution-engine.service.ts` 는 컨트롤러가 아니며 `@Controller`/`@ApiOperation`/Dto 데코레이터를 포함하지 않음 → API 문서 규약(관점4) 대상 아님.

## 발견사항

- **[INFO]** §4.4 신규 표 내용에 대한 별도 Rationale 미비
  - target 위치: `spec/5-system/4-execution-engine.md` §4.4 "이벤트 발행 sink" (신규 `forwardRef` / `ModuleRef.get(strict:false)` 선택 기준 표)
  - 위반 규약: CLAUDE.md "정보 저장 위치" — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" (강제 규칙이라기보다 권장 패턴)
  - 상세: 본문 표와 바로 뒤 문단에 "왜 이 기법을 택했는가"(인스턴스화 순서 함정 우회)에 대한 inline 설명은 이미 있으나, 문서 끝 `## Rationale` 섹션에는 이 §4.4 확장에 대응하는 항목이 없다(기존 "C-1 god-class strangler-fig 분할" 항목이 간접 인용될 뿐). 다른 섹션(예: `waiting_for_input → failed` 전이, continuation publish 실패 통일)은 본문+Rationale 양쪽에 근거를 남기는 패턴을 따르는 것과 다소 비대칭.
  - 제안: 사소한 형식 편차이며 즉각 조치가 필요한 수준은 아님. 후속 편집 시 `## Rationale` 에 "왜 두 기법을 분리했는가 / 왜 NotificationsService 순환은 forwardRef 로 안 풀리는가" 한두 문장을 추가하면 기존 문서 패턴과의 일관성이 개선됨.

- **[INFO]** 코드 diff(`finalizeFailedExecution` 추출) 자체는 target spec 문서에 반영된 변경이 없음(의도된 것으로 판단)
  - target 위치: 해당 없음 (spec 본문에 private 메서드명 언급 자체가 없음 — 정상)
  - 위반 규약: 없음. 참고용 기재.
  - 상세: `spec/5-system/4-execution-engine.md` 는 애초에 내부 private 헬퍼명을 노출하지 않는 서술 스타일을 유지하고 있고(`ExecutionEngineService.updateExecutionStatus` 같은 소수 예외 제외), `finalizeFailedExecution` 신설도 그 관례를 따라 spec 본문에 메서드명을 추가하지 않았다. `spec/data-flow/8-notifications.md` §1.1 의 `dispatchExecutionFailedNotification` 참조는 리팩터 후에도 유효하므로 drift 없음.
  - 제안: 조치 불요.

## 요약

target 문서(`spec/5-system/4-execution-engine.md`)의 실제 diff 는 §4.4 DI 순환 해소 기법 문서화(표+설명) 확장이며, 별도로 제시된 코드 diff(`finalizeFailedExecution` 헬퍼 추출)는 behavior-preserving 순수 리팩터로 에러 코드·이벤트 payload·API 명명에 아무 변경이 없다. `spec/conventions/error-codes.md` §1.4 sentinel 코드 보존 원칙, `spec/data-flow/8-notifications.md` §1.1 의 `dispatchExecutionFailedNotification` 서술, §4.4 신규 표의 `ModuleRef`/PR 참조 모두 코드와 대조해 사실 일치를 확인했다. 명명 규약·출력 포맷 규약·API 문서 규약·금지 항목 관점에서 CRITICAL/WARNING 위반은 발견되지 않았고, 문서 구조 관점에서 §4.4 확장분의 Rationale 누락이라는 경미한 INFO 성 편차 하나만 남는다.

## 위험도

NONE
