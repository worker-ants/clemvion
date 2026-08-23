# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** allowlist 멤버십 검사가 `Array.includes()` 선형 탐색 — 자매 코드는 이미 `Set` 을 쓴다
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:125,128`
  - 상세: `allowlistNodeOutputKeys` 는 `nodeOutput` 의 각 top-level 키에 대해 `NODE_OUTPUT_ALLOWED_KEYS`(13개 원소, 이번 PR 로 9→13 증가) 를 `.includes()` 로 선형 탐색한다. 이 함수는 `toFanoutEnvelope` 를 통해 **모든 execution 이벤트가 지나는 hot path** 라고 코드 자신의 JSDoc(`websocket.service.ts:179-181`)이 명시한다. 같은 파일의 `WIRE_PRESERVED_FIELDS`(`websocket.service.ts:90-92`)는 동일한 "고정 키 집합에 대한 멤버십 검사" 용도로 이미 `Set` 을 쓰고 있어 패턴 불일치이기도 하다.
  - 제안: `NODE_OUTPUT_ALLOWED_KEYS` 로부터 파생한 `NODE_OUTPUT_ALLOWED_KEYS_SET = new Set(NODE_OUTPUT_ALLOWED_KEYS)` 를 모듈 최상단에 한 번만 만들고 `allowed.has(k)` 로 바꾸면 O(13) → O(1)이 된다. 다만 배열 크기가 13으로 고정·소규모라 체감 영향은 미미하다(런타임 벤치마크 없이는 실측 없는 주장 — CRITICAL/WARNING 아닌 INFO로 남긴다).

- **[INFO]** 같은 envelope 안에서 두 자리(`nodeOutput`·`buttonConfig.nodeOutput`)가 동시에 걸릴 경우 중간 객체 스프레드가 2회 발생
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182-205` (`allowlistFanoutNodeOutput`)
  - 상세: `next = { ...next, nodeOutput: narrowed }` 후 다시 `next = { ...next, buttonConfig: { ...bc, nodeOutput: narrowed } }` 형태라, 두 자리가 한 이벤트에 동시에 존재하는 이론적 케이스(현재 도메인상 form/button waiting 은 상호 배타적이라 실질적으로는 발생하지 않는 것으로 보임)에서는 envelope 최상위 shallow copy 가 2번 일어난다. envelope 이 소규모(~10 키) 객체라 비용은 무시할 수준.
  - 제안: 현재 설계(copy-on-change, 두 자리 독립 검사)가 가독성·정확성 면에서 합리적이라 변경을 권하지 않는다. 참고용으로만 남긴다.

- 그 외 항목은 이슈 없음: `allowlistNodeOutputKeys`(최상위만 순회, 깊은 재귀 없음)와 `allowlistFanoutNodeOutput`(copy-on-write, 무변경 시 참조 그대로 반환)은 fanout hot path 에 적합하게 설계됐다. `nodeOutput`/`buttonConfig` 가 없는 대다수 이벤트(예: `EXECUTION_COMPLETED` 등)는 `typeof … === 'object'` 두 번의 검사만 거치고 즉시 스킵되어 추가 할당이 없다. `toFanoutEnvelope` 에서 `stripExternalOnlyFields`(깊은 순회 + `WeakMap` 캐시) 뒤에 얕은 순회 1회를 얹는 구조라 알고리즘 복잡도 증가는 상수 수준이다. N+1 쿼리·블로킹 I/O·불필요한 캐싱 미스 등은 이 diff 범위에 해당 없음(순수 in-memory 동기 변환).

## 요약

이번 변경(SSE/fanout `nodeOutput` fail-closed allowlist 추가)은 hot path 를 명확히 인지하고 copy-on-write 로 무변경 케이스의 할당을 회피하는 등 성능을 이미 고려해 설계됐다. 발견된 사항은 13개 고정 크기 배열에 대한 `.includes()` 선형 탐색 하나뿐이며, 이는 이론적으로 `Set` 전환이 더 낫지만 원소 수가 작아 실질 영향은 미미한 INFO 수준이다. 알고리즘 복잡도·N+1·메모리 누수·블로킹 I/O 등 CRITICAL/WARNING 급 성능 문제는 없다.

## 위험도
NONE
