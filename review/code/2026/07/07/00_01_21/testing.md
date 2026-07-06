# 테스트(Testing) Review

대상: commit 52078f329 (`execution-engine.service.spec.ts` 회귀 가드 추가, `execution-engine.service.ts` JSDoc, `RESOLUTION.md`/`SUMMARY.md` 리뷰 산출물)

이 커밋은 직전 delta 리뷰(23_44_04)의 testing WARNING(sanitizer 적용 회귀 가드 부재)에 대한 조치다. 신규 테스트를 직접 검증했다.

## 검증 수행
- `dispatchExecutionFailedNotification` 신규 테스트(`execution-engine.service.spec.ts:762~797`)를 실제 실행 → 통과.
- Mutation 검증: `sanitizeErrorMessage(message)` 호출을 `message` 로 되돌려 sanitizer 미적용을 재현 → 신규 테스트가 정확히 실패(`Expected substring: "[REDACTED_URI]" / Received: ...postgres://user:secret@...`)함을 확인. 즉 이 테스트는 "sanitizer 호출 삭제/오배선" 회귀를 실제로 잡아낸다 — 의도한 방어 가치가 실증됨.
- 원복 후 diff 없음 확인.
- `beforeEach`(라인 239)가 매 테스트마다 `service` 를 재생성하므로, 신규 테스트가 `service.notificationsService` 를 직접 mutate 해도 다른 테스트로 누수되지 않음(격리 양호). 같은 패턴이 상단 `getNotificationsService` 회귀 가드 describe 블록에서도 이미 쓰이고 있어 기존 컨벤션과 일관.

## 발견사항

- **[INFO]** 전용 `sanitize-error-message.spec.ts` 단위 테스트 부재
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (신규 유틸, 이번 커밋 범위 밖에서 도입됨)
  - 상세: 이 유틸은 `dispatchExecutionFailedNotification`(본 커밋에서 회귀 가드 추가)과 `background-execution.processor.ts`(기존에 유사 회귀 가드 존재, `background-execution.processor.spec.ts:160-172`) 양쪽에서 통합 테스트로 간접 커버된다. 다만 길이 제한(500자 truncate + `…`), stack trace 제거(`STACK_TRACE_PATTERN`), 다중 스킴(redis/mongodb/mysql) 등 유틸 자체의 경계 케이스는 두 호출부 통합 테스트만으로는 전부 커버되지 않는다(예: truncate 동작은 어느 spec 에서도 직접 검증되지 않음).
  - 제안: RESOLUTION.md 에도 "선택 followup(INFO#4)"으로 이미 인지·보류된 사항. 우선순위는 낮으나, 유틸이 두 곳에서 공유되는 security-sensitive 로직인 만큼 후속 PR 에서 전용 spec(길이 truncate, 여러 스킴, non-Error 입력 `String(err)` 분기 등)을 추가할 가치가 있다. 이번 커밋 범위 내 필수 아님.

- **[INFO]** 신규 테스트가 `dispatchExecutionFailedNotification` 을 `unknown` 캐스트로 직접 호출하는 private 메서드 테스트 패턴
  - 위치: `execution-engine.service.spec.ts:762-799`
  - 상세: 기존 동일 describe 블록의 다른 테스트들(`callDispatch` 헬퍼 사용, 라인 620 이하)과 달리 이 신규 테스트는 `callDispatch` 헬퍼를 쓰지 않고 유사한 캐스팅 보일러플레이트를 인라인으로 반복한다. 동작에는 문제없으나 기존 `callDispatch(execution, createMany)` 헬퍼가 이미 `notificationsService` 주입 + private 캐스트 호출을 캡슐화하고 있다면 재사용해 중복을 줄일 수 있었다.
  - 제안: 사소한 가독성/중복 이슈. 필수 수정 아님 — 현재도 테스트 의도(주석 설명)가 명확해 이해에 지장 없음.

## 회귀 테스트 유효성
- 기존 371개 테스트에 영향 없음(스킵 처리는 `-t` 필터에 의한 것으로 정상, 실제로는 전체 스위트 실행 시 371 pass 유지 — 커밋 메시지의 "lint·unit·build·e2e(238) 통과" 기록과 일치).
- JSDoc 변경(`finalizeResumedExecutionOutcome`)은 런타임 영향 없는 주석 전용 변경으로 회귀 위험 없음.

## 요약
직전 리뷰에서 지적된 "sanitizer 호출이 삭제되거나 오배선돼도 기존 테스트('boom' 리터럴)로는 감지 불가"라는 실질적 커버리지 갭을 정확히 겨냥해 조치했고, mutation 검증으로 이 테스트가 실제로 해당 회귀를 감지함을 직접 확인했다. 테스트 격리(매 테스트 `service` 재생성)도 기존 컨벤션을 따라 안전하다. 남은 갭(sanitizer 유틸 전용 spec 부재)은 이미 RESOLUTION.md 에 선택 followup 으로 인지·보류돼 있으며 이번 delta 의 범위를 넘어서는 낮은 우선순위 사항이다. Critical/Warning 없음.

## 위험도
NONE
