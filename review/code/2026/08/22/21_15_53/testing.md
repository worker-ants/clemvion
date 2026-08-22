# 테스트(Testing) 리뷰 — masked-marker-test-gaps

## 리뷰 범위

실질 코드 변경은 `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` 에 신규 테스트 1건(`[캐너리] 무관한 필드의 coerce 실패가 ② 마커 검사를 선점한다`) 추가가 전부다. 나머지(`plan/in-progress/*.md`, `review/consistency/**`)는 추적 문서·자동 생성 리뷰 산출물로 실행 코드가 아니라 테스트 관점 분석 대상이 아니다.

검증 방법: `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions`(`reject-masked-resubmission.ts`)와 `resolveTriggerParameters`(`resolve-trigger-parameters.ts`) 원본을 직접 읽어 신규 테스트가 주장하는 동작(phase① raw 통과 → phase② 도달 전 무관 필드 `coerce_failed` 로 예외 선점)이 실제 구현과 일치하는지 대조했고, `npx jest reject-masked-resubmission.spec.ts` 로 22건 전부 GREEN 을 직접 재실행 확인했다. `npx tsc --noEmit` 으로 타입 오류 없음도 확인했다.

## 발견사항

### [INFO] 신규 테스트는 논리적으로 건전하고 vacuous 하지 않음 — 직접 재현으로 확인
- 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:327` (`it('[캐너리] 무관한 필드의 coerce 실패가 ② 마커 검사를 선점한다', ...)`)
- 상세: `resolveTriggerParameters`(`resolve-trigger-parameters.ts:124`)는 스키마의 모든 필드를 순회하며 에러를 모은 뒤 `errors.length > 0` 이면 `resolved` 를 반환하기 **전에** 던진다(`resolve-trigger-parameters.ts:158`). 따라서 `payload`(object, JSON 문자열 안에 마커)는 coerce 자체는 성공하지만 `count: 'not-a-number'` 가 `coerce_failed` 를 내면 함수 전체가 예외를 던져 `resolveTriggerParametersRejectingMasked` 의 phase② 검사(`findMaskedResubmissions(schema, rawSource, resolved)`, `reject-masked-resubmission.ts:72`)는 아예 실행되지 않는다. 신규 테스트가 주장하는 정확히 그 경로다. 대조군(`count: 1`)이 실제로 마커를 잡는 것도 실행 확인(`jest` 22 passed)으로 검증됐다 — control 없이 실험군만 있었다면 "애초에 ②도 못 잡는 값"으로도 통과했을 것이라는 plan 문서의 우려가 실제로 유효했다.
- 제안: 조치 불요. 테스트·plan 문서에 기록된 뮤테이션 3종(M1 hoist, M2 phase 병합, M3 ② 제거) 예측/실측 표는 재실행하지 않았으나 로직 대조상 신뢰할 만하다.

### [INFO] try/catch + reasons 배열 추출 패턴이 파일 내 3곳으로 중복
- 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:340-352` (신규), 기존 `:294-311` 와 동일 패턴
- 상세: `rejectedFields` 헬퍼(`:29`)는 `masked_value_resubmitted` 사유만 필터링해 반환하므로, `coerce_failed` 를 포함한 전체 `reason` 목록이 필요한 테스트(기존 1건 + 신규 1건)는 매번 `try { resolve(...) } catch { if (err instanceof ...) reasons = err.errors.map(...) }` 를 인라인으로 반복한다. 기능 결함은 아니며 기존 관례(`raw 에서 걸리면 coerce_failed 가 섞이지 않는다`)를 그대로 따른 것이라 이번 diff 만의 문제는 아니다.
- 제안: 여유가 있을 때 `allReasons(schema, raw): string[]` 같은 헬퍼로 추출해 `rejectedFields` 와 나란히 두면 향후 유사 테스트 작성 시 중복이 줄어든다. 지금 당장 블로킹할 사안은 아님.

### [INFO] `findMaskedResubmissions` 자체의 직접 단위 테스트는 여전히 부재 — plan 문서가 근거와 함께 명시적으로 유예
- 위치: `plan/in-progress/masked-marker-test-gaps.md` §② / `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L829-842 (`findMaskedResubmissions 직접 단위 테스트 부재`)
- 상세: `findMaskedResubmissions`(`reject-masked-resubmission.ts:115`)는 여전히 상위 함수(`resolveTriggerParametersRejectingMasked`) 경유로만 간접 커버된다. plan 문서가 그 함수의 6개 분기(빈 스키마/비객체 raw/rawSource 키 필터/정확 일치 경계/깊이 상한 3종/다중 필드 수집)를 표로 대조해 전부 상위 테스트가 이미 덮는다는 근거를 남기고 유예를 재확정했다. 표를 스펙 파일(`reject-masked-resubmission.ts`)과 대조한 결과 나열된 분기 목록은 실제 함수 로직(`:120-129`)과 일치한다.
- 제안: 재개 조건이 "소비처 개수"에서 "상위 경유로 못 덮는 분기 발생"으로 명확히 교체된 점은 향후 회귀 시 유용한 트리거다. 조치 불요.

### [INFO] 테스트 격리·가독성 — 회귀 없음
- 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` 전체
- 상세: 신규 테스트는 지역 변수만 사용하고 `beforeEach`/공유 상태 없이 독립 실행 가능하다. 기존 22개(신규 포함) 테스트를 단독 실행해도 통과(`jest` 결과 `22 passed`)해 순서 의존성이 없다. 테스트명이 `[캐너리]` 접두어 + 한국어 설명으로 의도를 명확히 표현하고, JSDoc 이 "왜 이 테스트가 RED 면 결함이 아니라 결정 신호인지"까지 명시해 향후 유지보수자가 실수로 되돌리는 것을 방지하는 문서화 수준이 높다.
- 제안: 조치 불요.

## 요약
이번 변경은 순수하게 테스트 1건(+ 추적 문서 갱신)을 추가하는 diff로, `throwIfAny` phase 경계에서 무관 필드의 `coerce_failed` 가 마커 검사(phase②)를 선점하는 이미 문서화된 트레이드오프를 회귀 테스트로 고정한다. 원본 구현 로직(`resolveTriggerParameters` 가 전체 에러를 모아 반환 전에 던지는 구조)을 직접 대조하고 `jest`/`tsc` 를 재실행해 검증한 결과, 테스트는 실제 동작과 정확히 일치하며 대조군을 포함해 vacuous 하지 않다. Mock 사용 없이 실제 함수를 그대로 호출하는 방식이 적절하고, 격리·가독성 문제도 없다. `findMaskedResubmissions` 직접 단위 테스트 부재는 plan 문서가 분기별 간접 커버리지 표로 근거를 남기며 의도적으로 유예했고 그 근거도 코드와 일치해 타당하다. Critical/Warning 급 결함은 발견되지 않았다.

## 위험도
NONE
