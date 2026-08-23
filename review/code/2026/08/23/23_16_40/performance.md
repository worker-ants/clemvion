# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `allowlistNodeOutputKeys` 의 멤버십 검사가 `Array.prototype.includes()` 선형 탐색이다 (allowlist 원소 9개 → 13개로 증가).
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:126,129` (`const allowed = NODE_OUTPUT_ALLOWED_KEYS as readonly string[];` / `if (allowed.includes(k)) continue;`)
  - 상세: `Object.keys(obj)` 의 각 키(대개 5~10개)마다 13개 allowlist 를 선형 탐색하므로 최악 O(k×13). `allowlistFanoutNodeOutput`(`codebase/backend/src/modules/websocket/websocket.service.ts:182-205`)이 이 함수를 fanout 이벤트마다(top-level `nodeOutput` + `buttonConfig.nodeOutput` 최대 2회) 호출하는 hot path지만, 원소 수가 작아 실질 비용은 무시할 수준이다. 이미 직전 리뷰 라운드(`review/code/2026/08/23/22_51_46/RESOLUTION.md` INFO #3)에서 `Set` 전환을 검토했고, `NODE_OUTPUT_ALLOWED_KEYS` 가 `as const` 튜플로 컴파일타임 결속(`PublicHandlerOutputKey extends (typeof NODE_OUTPUT_ALLOWED_KEYS)[number]`)의 입력이라 `Set` 전환 시 그 결속이 깨지거나 별도 파생 `Set`(2차 동기화 지점)이 필요하다는 근거로 명시적으로 보류됨. 이번 라운드에도 같은 트레이드오프가 유효해 재지적하지 않음(참고용으로만 기록).
  - 제안: 조치 불요. 원소 수가 수십 단위로 늘어나는 시점에만 재검토.

- **[INFO]** `allowlistFanoutNodeOutput` 이 top-level `nodeOutput` 과 `buttonConfig.nodeOutput` 양쪽에서 동시에 키가 걸리면 shallow copy 가 최대 2회(envelope 1회 + buttonConfig 1회) 발생한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182-205`
  - 상세: 이론적으로만 존재하는 이중 할당이며, 두 얕은 복사 모두 O(envelope 최상위 필드 수)로 크기가 작다. `copy-on-change` 설계(변경 없으면 원본 참조 그대로 반환) 덕분에 대부분의 이벤트(allowlist 밖 키가 없는 경우)에서는 신규 객체 생성이 전혀 없다 — hot path 최적화가 올바르게 적용됐다. 뮤테이션 M4/M5(`plan/in-progress/sse-nodeoutput-allowlist.md` 검증 기준 표)로 이 계약이 top-level·`buttonConfig` 두 분기 각각 별도로 고정돼 있음을 확인.
  - 제안: 변경 불필요.

## 요약

`toFanoutEnvelope` 단일 chokepoint(`codebase/backend/src/modules/websocket/websocket.service.ts:468-476`)에 `allowlistFanoutNodeOutput` 을 추가 배선한 변경으로, execution 이벤트마다 지나는 hot path 에 로직이 하나 더 붙었지만 두 지점(top-level `nodeOutput`, `buttonConfig.nodeOutput`) 모두 얕은(비재귀) O(1) 스캔이고 `copy-on-change` 로 무변경 이벤트는 새 객체를 만들지 않는다. `toFanoutEnvelope` 는 이벤트당 1회만 호출되고(구독자 수에 비례하지 않음— `broadcastToChannel` 은 조립된 envelope 을 그대로 팬아웃), N+1 호출·블로킹 I/O·불필요한 대규모 메모리 할당·캐싱 필요 없는 반복 계산 등 실질적 성능 리스크는 없다. allowlist 원소가 9→13개로 늘었지만 `.includes()` 선형 탐색 비용은 무시할 수준이며, `Set` 전환 보류 결정도 컴파일타임 타입 결속을 지키기 위한 합리적 트레이드오프로 이미 문서화돼 있다. 테스트 파일(`interaction.service.spec.ts`, `websocket.service.spec.ts`, `node-output-allowlist.spec.ts`)의 신규 캐너리·`it.each` 는 실행 시점 성능에 영향 없는 단위 테스트다.

## 위험도

NONE
