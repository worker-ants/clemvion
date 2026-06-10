# 신규 식별자 충돌 검토 결과

## 발견사항

### [INFO] `getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()` — 기존 상수명과 표현 방식 전환, 충돌 없음
- target 신규 식별자: `getFailedDegradedThreshold()`, `getDelayedDegradedThreshold()` (getter 표현)
- 기존 사용처: `spec/5-system/16-system-status-api.md` :90, :94 에서 `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD` 상수명으로 참조
- 상세: target 은 두 상수를 getter 표현으로 대체하는 spec 갱신을 제안한다. spec 전체(및 plan, conventions)를 대상으로 `getFailedDegradedThreshold`/`getDelayedDegradedThreshold` 를 검색한 결과 0건 — 이미 사용 중인 동명 식별자가 없다. 환경변수 `SYSTEM_STATUS_FAILED_THRESHOLD` / `SYSTEM_STATUS_DELAYED_THRESHOLD` 는 매핑 대상이 getter 로 바뀔 뿐 env 키 자체는 불변이므로 충돌하지 않는다.
- 제안: 해당 없음. 단순 표현 갱신이며 새 명칭과의 충돌은 없다.

### [INFO] `structuredOutputCache` — spec에 미표기이나 코드에 이미 존재, 추가 기술 충돌 없음
- target 신규 식별자: `structuredOutputCache` (spec/conventions/execution-context.md §1 에 추가 제안)
- 기존 사용처: `spec/conventions/execution-context.md` :29 의 Stable core 필드 목록에는 현재 미표기. 코드(`codebase/backend/src/nodes/core/node-handler.interface.ts` dist, `execution-context.service.ts`, `parallel-executor.ts` 등)에는 이미 사용 중.
- 상세: target 의 의도는 "0건임을 확인했으므로 추가가 필요하다" 는 것이다. spec 안 다른 파일에서 `structuredOutputCache` 를 직접 언급하는 곳은 발견되지 않았다(grep 0건). 코드에 이미 존재하는 필드를 spec 에 기술하는 것이므로 새 식별자 도입이 아니라 기존 식별자를 spec 에 반영하는 것이다. 이름 충돌이나 의미 혼선은 없다.
- 제안: 해당 없음.

### [INFO] `FREEZE_BRANCH_CACHE` / `freezeSharedCacheValues` — 코드 내부 식별자, spec 신규 도입 아님
- target 신규 식별자: 언급만 됨 — target 이 spec 에 "branch-local `nodeOutputCache` 값 객체 deep freeze" 행위를 기술하되, 이 두 식별자 자체를 spec 에 노출하지는 않는다.
- 기존 사용처: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` :35, :54 에 코드 내 상수/함수로 존재.
- 상세: target 이 spec 에 추가하려는 내용은 "dev/test 에서 deep `Object.freeze` 로 불변 강제, production 무적용" 이라는 동작 설명이다. 코드 식별자(`FREEZE_BRANCH_CACHE`, `freezeSharedCacheValues`)를 spec 텍스트에 직접 노출하지 않으므로 식별자 충돌 검토 대상 외다.
- 제안: 해당 없음.

---

## 요약

target(`plan/in-progress/spec-update-deadcode-cleanup.md`)이 제안하는 spec 변경은 (1) 두 코드 상수를 getter 표현으로 교체, (2) `structuredOutputCache` 필드를 `execution-context.md` 에 추가, (3) freeze invariant 동작을 `10-parallel.md` Rationale 과 `execution-context.md` 에 1줄 기술하는 세 가지로 구성된다. 세 경우 모두 기존 spec 및 코드에서 동일한 이름이 다른 의미로 사용되고 있는 사례가 발견되지 않았다. `structuredOutputCache` 는 신규 명칭이 아니라 이미 구현된 필드를 spec 에 뒤늦게 반영하는 것이며, getter 표현으로의 교체는 동일 env 키(`SYSTEM_STATUS_FAILED_THRESHOLD` / `SYSTEM_STATUS_DELAYED_THRESHOLD`)를 유지하므로 환경변수 충돌도 없다. 식별자 충돌 관점에서 차단 사유는 없다.

## 위험도

NONE
