# 성능(Performance) 리뷰

## 리뷰 범위

핵심 런타임 코드 변경은 2개 TS 파일이다:

- `codebase/backend/src/shared/utils/node-output-allowlist.ts` — `NODE_OUTPUT_ALLOWED_KEYS` 배열에 4키(`payload`·`title`·`rendered`·`nodeType`) 추가(9→13). 멤버십 검사 함수(`allowlistNodeOutputKeys`) 본체는 이번 diff 의 변경 대상이 **아니다** (JSDoc·주석·배열 리터럴만 변경).
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `allowlistFanoutNodeOutput` 신규 함수 + `toFanoutEnvelope` 배선.

나머지(테스트 파일 2건, CHANGELOG/plan/spec/review 산출물 다수)는 순수 문서·테스트로 런타임 성능에 영향이 없다.

## 발견사항

- **[INFO]** `allowlistNodeOutputKeys` 의 멤버십 검사가 `Array.prototype.includes()` 선형 탐색 — allowlist 원소가 이번 PR 로 9→13개로 늘었다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:126,129` (`const allowed = NODE_OUTPUT_ALLOWED_KEYS as readonly string[];` / `if (allowed.includes(k)) continue;`)
  - 상세: `Object.keys(obj)` 의 각 top-level 키마다 13개 배열을 선형 탐색하므로 최악 O(k×13). `allowlistFanoutNodeOutput`(`websocket.service.ts:182-205`)이 이 함수를 fanout 이벤트마다(top-level `nodeOutput` + `buttonConfig.nodeOutput` 최대 2회) 호출하는 hot path("모든 execution 이벤트가 지나는 hot path"라고 JSDoc 자신이 명시, `websocket.service.ts:179-181`)라는 점은 사실이나, 이 diff 자체는 그 스캔 로직을 새로 만든 것이 아니라 **기존에 이미 존재하던 `.includes()` 를 두 차례 전(리뷰 라운드 `22_51_46`, `23_16_40`) 이미 INFO 로 지적받고 `Set` 전환을 명시적으로 보류한 코드**다. 보류 근거(`as const` 튜플이 컴파일타임 결속 `PublicHandlerOutputKey extends (typeof NODE_OUTPUT_ALLOWED_KEYS)[number]` 의 입력이라 `Set` 전환 시 파생 `Set` = 2번째 손-동기화 지점 필요)는 이번 라운드에도 그대로 유효하고, `RESOLUTION.md`(`22_51_46`) INFO #3 에 문서화돼 있다. 원소 수 13개 규모에서 체감 비용은 무시할 수준.
  - 제안: 조치 불요(기존 결정 유지). 그룹 수·원소 수가 수십 단위로 늘어나는 시점에만 `Set` 파생 재검토 권장 — 다만 그 경우에도 `PublicHandlerOutputKey` 컴파일타임 assertion 은 `as const` 배열을 그대로 유지하고, `Set` 은 배열로부터 파생(`new Set(NODE_OUTPUT_ALLOWED_KEYS)`)해 단일 SoT 를 지키는 형태를 권장.

- **[INFO]** `allowlistFanoutNodeOutput` 이 top-level `nodeOutput` 과 `buttonConfig.nodeOutput` 양쪽에서 동시에 키가 걸리면 envelope shallow copy 가 최대 2회(`{...next, nodeOutput: narrowed}` 후 `{...next, buttonConfig: {...bc, nodeOutput: narrowed}}`) 발생한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182-205` (`allowlistFanoutNodeOutput`)
  - 상세: `copy-on-change` 설계 덕분에 allowlist 밖 키가 없는 대다수 이벤트에서는 신규 객체 생성이 전혀 없다(원본 참조 그대로 반환). 두 자리가 동시에 걸리는 이론적 케이스에서도 두 shallow copy 모두 O(envelope 최상위 필드 수)로 크기가 작아(envelope 은 수~십수 키 규모) 비용은 무시할 수준. 도메인상 form/button waiting 은 상호 배타적이라 실질적으로는 한 자리만 걸리는 경우가 대부분으로 보인다.
  - 제안: 변경 불필요. 설계(copy-on-change + 두 자리 독립 검사)가 가독성·정확성 면에서 합리적.

- 그 외 이슈 없음: `allowlistNodeOutputKeys` 는 **최상위 1단**만 순회하고 재귀하지 않는다(깊은 폼 필드·캐러셀 데이터는 열거하지 않고 그대로 통과). `toFanoutEnvelope` 은 이벤트당 1회만 호출되며(`websocket.service.ts:327,394` 두 호출부 모두 이벤트 emit 경로에서 1회) 구독자 수(SSE/webhook/chat-channel)에 비례해 반복 호출되지 않는다 — `broadcastToChannel` 은 조립이 끝난 envelope 을 팬아웃만 한다. `nodeOutput`/`buttonConfig` 가 없는 대다수 이벤트(`EXECUTION_COMPLETED` 등)는 `typeof … === 'object'` 검사 두 번만 거치고 즉시 스킵되어 추가 할당이 없다. `toFanoutEnvelope` 은 기존 `stripExternalOnlyFields`(깊은 순회, `MAX_SANITIZE_DEPTH=10` 로 유계) 뒤에 얕은 순회 1회(O(top-level 키 수))를 얹는 구조라 알고리즘 복잡도 증가는 상수 수준이다. N+1 쿼리·블로킹 I/O·불필요한 캐싱 미스·과도한 문자열 연결·부적절한 자료구조·선행 로딩 등은 이 diff 범위(순수 in-memory 동기 변환 + 테스트/문서)에 해당 없음.

## 요약

이번 변경(SSE/fanout `nodeOutput` fail-closed allowlist 확장)은 hot path(`toFanoutEnvelope`)를 명확히 인지한 상태에서 얕은(비재귀) O(top-level 키 수) 스캔과 copy-on-write 로 무변경 이벤트의 할당을 회피하도록 설계돼 있다. 유일하게 관찰되는 항목은 13개 고정 배열에 대한 `.includes()` 선형 탐색인데, 이는 이번 diff 가 새로 만든 코드가 아니라 이미 두 차례 이전 리뷰 라운드에서 INFO 로 검토되고 `Set` 전환을 (컴파일타임 타입 결속 보존을 위해) 의도적으로 보류한 기존 코드이며, 원소 수가 9→13으로 늘어난 정도로는 결론이 달라지지 않는다. 알고리즘 복잡도·N+1·메모리 누수·블로킹 I/O 등 CRITICAL/WARNING 급 성능 문제는 발견되지 않았다.

## 위험도
NONE
