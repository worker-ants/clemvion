# 테스트(Testing) 코드 리뷰

## 검증 방법

`git diff origin/main...HEAD -- codebase/` 로 실질 코드 diff(14개 파일, 1,173+/80-)를 직접 추출해
prompt 의 diff-생략분(`background-runs.service.spec.ts` · `executions.service.spec.ts` ·
`executions.service.ts` · `websocket.service.spec.ts` · `websocket.service.ts` ·
`sanitize-error-message.spec.ts` · `sanitize-error-message.ts`)을 원본에서 전수 확인했다. 관련
5개 spec 파일(`executions.service.spec.ts` · `background-runs.service.spec.ts` ·
`websocket.service.spec.ts` · `redact-stored-error.spec.ts` · `sanitize-error-message.spec.ts`)을
직접 실행해 **184개 테스트 전부 GREEN**을 확인했다. 추가로 독립 뮤테이션을 수행했다 —
`sanitize-error-message.ts` `deepRedactObject` 의 마커-보존 분기(`isMaskedMarker(v) ? v :
VALUE_MASK_MARKER`)를 무조건 `VALUE_MASK_MARKER` 로 바꾸자 3개 파일(`sanitize-error-message.spec.ts`
2건 · `executions.service.spec.ts` ⑥ · `background-runs.service.spec.ts`)에서 정확히 RED 로
전환됨을 확인했다 — 이 저장소가 반복 겪은 "마커 재마스킹" 결함 클래스에 대한 캐너리가
vacuous 하지 않음을 재확인했다. 뮤테이션 직후 원본으로 복구했고(`cp` 로 복구, `git status`
clean 확인 완료) 전체 스위트를 재실행해 GREEN 을 재확인했다.

이 diff 는 이미 6라운드(`23_08_19`→`10_50_14`)의 ai-review 를 거쳤고 각 라운드 `RESOLUTION.md` 가
CRITICAL 0(2R 이후)·WARNING 전건 해소를 기록하고 있다. 이번 라운드는 그 이력을 신뢰하지 않고
독립적으로 소스·테스트를 재확인했다.

## 발견사항

- **[INFO]** `websocket.service.spec.ts` 의 `emitNodeEvent` wire 마스킹 테스트가 이 작업의
  핵심 결함 서사(REST `input` 표면과의 flip-flop)의 당사자 필드인 `input` 을 직접 겨누지 않고
  `error` 로만 검증한다. (직전 두 라운드가 이미 INFO·"필수 아님"으로 처분했고 이번 라운드까지
  변화 없음 — 등급 상향 근거 없음.)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — `② emitNodeEvent —
    wire 도 마스킹 (R17 boundary parity: 수신 인구가 REST 와 동일)` 테스트(payload 가 `{ error:
    LEAKY_ERROR }` 뿐). `①`(fanout)은 `input` 을 검증하지만 대응하는 wire 쪽(`②`)엔 없다.
  - 상세: `maskWireEnvelope`(`deepRedactSecretsPreserving`)는 필드-불특정 전체 envelope
    마스킹이라 어느 필드로 검증해도 메커니즘상 결과는 동일해 실질 위험은 낮다. 다만 캐너리로서는
    "이 작업이 막으려던 그 구체적 결함(WS 가 마스킹한 `input` 값을 REST 원문이 2초 뒤 덮는
    flip-flop)"을 필드 이름 수준까지 1:1 로 겨누지 못한다.
  - 제안: 낮은 우선순위. `②` payload 에 `input: LEAKY_INPUT` 을 추가하면 결함 서사와 정확히
    대응하는 캐너리가 된다. 필수 아님.

- **[INFO]** `maskIfPresent`(비-export 헬퍼, `executions.service.ts`)의 `value == null` 방어
  분기가 명시적 `undefined` 값으로 직접 실행되는 fixture 는 없다. (3라운드 전부터 같은 논거로
  INFO 유지 — 신규 아님.)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `maskIfPresent` 본문
    `value == null ? value : (mask(value) ?? value)`.
  - 상세: JSDoc 은 "TypeORM 이 런타임에 `undefined` 를 줄 수 있는 경로에 대한 방어"라고 명시하지만
    `executions.service.spec.ts`/`background-runs.service.spec.ts` 의 `nodeExecutions[]` fixture 는
    `null` 또는 실값만 채운다. `==` 연산자가 `null`/`undefined` 를 동일 취급하므로 `null` 케이스로
    간접 커버된다는 논거는 타당하다.
  - 제안: 조치 불요. 여유가 있으면 `outputData: undefined as never` fixture 한 곳을 추가해 `==`
    등가성 주장을 주석이 아니라 테스트로 고정.

## 독립 검증으로 확인한 양호 사례

- **뮤테이션 비-vacuous 확인(직접 재현)**: 마커-보존 분기 제거 뮤턴트가 3개 파일에서 정확히
  RED — 캐너리가 실제로 그 결함 클래스를 막는다.
- **자매 표면 회귀를 구조적으로 차단**: `redactStoredDataForResponse`(신규)를
  `redactStoredErrorForResponse` 와 나란히 별도 describe 로 두고 "한쪽만 지워도 스위트가
  초록"이 되지 않게 표면마다 개별 단언(`executions.service.spec.ts` ①~⑧-b,
  `background-runs.service.spec.ts` 신규 2건, `websocket.service.spec.ts` ①~④).
- **방향성 캐너리 표로 명시**: `Execution.inputData`(원문 유지, ①②⑧⑧-b) vs 노드 레벨
  `inputData`(마스킹 대상, ⑤⑥-b)를 표로 분리 — 같은 이름의 컬럼·반대 방향 정책을 양쪽 다
  회귀 캐너리로 고정. `⑥-b` 는 값 비교가 아니라 참조 동일성(`toBe`/`not.toBe`)으로 3-컬럼 AND
  조건의 각 항을 개별적으로 갈라, "한 항 삭제돼도 GREEN" 취약점을 막는다.
- **마커 멱등성 쌍-단언**: `[REDACTED]`/`[REDACTED_DEPTH]`/`***` 보존 캐너리마다 "마커가 아닌
  진짜 값은 여전히 마스킹된다"는 대조 단언을 짝으로 둬 "전부 보존" 오작동 구현도 통과하는
  vacuous 함정을 피했다(`sanitize-error-message.spec.ts`의 `deepRedactSecretsPreserving`
  스위트가 대표적).
- **캐시 교차 오염 방지 테스트**: `deepRedactSecrets`(캐시 사용)와 `deepRedactSecretsPreserving`
  (캐시 미사용)이 같은 객체 참조를 서로 다른 결과로 돌려줘야 하는 시나리오를 직접 테스트
  ("캐시를 공유하지 않는다") — `WeakMap` 전역 캐시 확장에 따른 새 오염 경로를 실측 차단.
  각 `it` 이 fixture 를 로컬 스코프에서 새로 만들어 테스트 간 캐시 오염 여지도 없다(격리 양호).
  실행 시에도 파일 간 상태 누수 징후 없음(순서 무관 GREEN, 184/184).
  - 다만 `WeakMap` 은 프로세스 전역이라 향후 병렬 워커 재사용(Jest 는 파일 단위 워커라 문제
    없음)이나 장수명 프로세스에서 캐시가 무한 성장할 가능성은 이번 diff 범위 밖(선존 패턴,
    성능 리뷰어 영역).
- **null/undefined 정규화·비-변이·copy-on-change** 표준 엣지 케이스가 `redactStoredDataForResponse`
  전용 describe 에 일관되게 커버됨(`redact-stored-error.spec.ts`).
- **Mock 적절성**: TypeORM QueryBuilder 체이닝을 시나리오별 로컬 헬퍼(`buildSingleQB`,
  `buildListQB`, `buildOwnershipQB` 등)로 구성해 실제 호출 순서·메서드 체인과 크게 괴리되지
  않는다. 신규 테스트가 기존 헬퍼를 재사용해 스타일 일관성도 유지된다.

## 요약

diff(WS emit 값-패턴 마스킹 wire/fanout + 내부 REST `inputData`/`outputData` 마스킹 6표면 확장
+ `Execution.inputData` 재제출 카브아웃)는 6라운드 반복 리뷰를 거치며 테스트 커버리지가 이례적으로
촘촘해진 상태다. 이번 라운드는 그 이력을 그대로 받아들이지 않고 5개 spec 파일을 직접 실행(184/184
GREEN)하고 마커-보존 분기에 독립 뮤테이션을 가해 3개 파일에서 정확히 RED 로 전환됨을 재현해,
핵심 방어(자매 표면 개별 단언·방향별 카브아웃 캐너리·마커 멱등성·copy-on-change 참조 동일성·캐시
교차 오염 방지)가 실제로 살아 있음을 확인했다. 신규 CRITICAL/WARNING 급 테스트 결함은 발견하지
못했다. 남은 두 건은 모두 INFO — `emitNodeEvent` wire 테스트가 결함 서사의 당사자 필드(`input`)를
직접 겨누지 않는 점, `maskIfPresent` 의 `undefined` 방어 분기가 `==` 등가성 논거로만 간접 커버되는
점 — 이며 둘 다 이전 라운드가 이미 동일 논거로 저위험 처분한 항목이라 이번에도 등급을 올릴 근거를
찾지 못했다.

## 위험도
NONE
