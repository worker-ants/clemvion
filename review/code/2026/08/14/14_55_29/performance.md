# 성능(Performance) 리뷰

## 리뷰 범위

이번 라운드의 실질 코드 델타는 세 가지다: (1) `strip-external-only-fields.ts` 신설(기존
`websocket.service.ts` 의 `stripDeep` 을 공유 유틸로 승격), (2) `interaction.service.ts`
`getStatus` 의 세 출구(waiting `nodeOutput`, terminal `result`/`error`)를 `redactAndStrip`
헬퍼로 통합, (3) 각각의 신규 spec 파일. 이 변경은 직전 라운드(`14_30_35`)가 낸 성능
WARNING 2건(순서 문제·비용 문서 유실)에 대한 처방이기도 해서, 이번 리뷰는 그 처방이
실제로 적용됐는지를 소스에서 직접 확인하는 데 집중했다. `CHANGELOG.md`·`plan/**`·
`review/**` 하위 파일은 코드가 아니라 문서/이전 리뷰 산출물이라 본 관점 적용 대상이 아니다.

## 확인했으나 문제 없음 (직전 라운드 WARNING 조치 확인)

- **순서 문제(`14_30_35` performance W1) 해소 확인** — `interaction.service.ts` 의
  `redactAndStrip` 은 `deepRedactSecrets(stripExternalOnlyFields(value, MAX_REDACT_DEPTH))`
  순서로 호출한다(`codebase/backend/src/modules/external-interaction/interaction.service.ts`
  `redactAndStrip` 함수, `stripExternalOnlyFields` 를 먼저 실행). 곧 버려질 `llmCalls`
  서브트리(정규식 다중 패스 + JSON 파싱까지 도는 `deepRedactSecrets` 입장에서 가장 비싼
  값 마스킹 대상)를 redact 이전에 먼저 제거하므로, 버릴 데이터에 비싼 연산을 선지불하던
  이전 순서가 고쳐졌다. "두 순서의 결과가 같다" 는 전제는
  `strip-external-only-fields.spec.ts` 의 `'deepRedactSecrets 와의 순서를 바꿔도 결과가
  같다'` 테스트로 고정돼 있어, 향후 누군가 최적화 삼아 순서를 되돌려도(또는 둘 중 하나의
  동작이 바뀌어도) 회귀로 잡힌다.
- **비용 문서 유실(`14_30_35` performance W2) 해소 확인** — 공유 유틸로 옮기며 소실됐던
  `## 비용 (실측)` 절(옛 depth-1 strip 0.0112ms/emit → 현행 재귀 strip 0.0314ms, 2.80배,
  +20.2µs, N=3000)과 "왜 두 pass 를 합치지 않는가"·순환 참조 근거가
  `strip-external-only-fields.ts` 상단 JSDoc 으로 이관돼 있다. 이 시점에 두 번째 호출자
  (REST `interaction.service.ts`)가 생겼는데 트레이드오프 근거가 빈 채로 남는 사고가
  재발하지 않았다.
- **알고리즘 복잡도 유지** — `stripDeep`(신규 유틸 내부)은 여전히 O(n) 단일 트리 순회 +
  lazy clone-on-write(변경 없는 서브트리는 참조 그대로 반환, `strip-external-only-fields.ts`
  `stripDeep` 함수)이고, 배열 분기도 바뀐 원소만 교체한다(다원소 배열 부분 clone,
  `strip-external-only-fields.spec.ts` `'배열은 바뀐 원소만 교체하고...'` 테스트로 검증).
  깊이 상한(`maxDepth` 파라미터)도 유지돼 무한 재귀/스택 오버플로 위험이 없다.
- **N+1 없음** — `getStatus` 의 `redactAndStrip` 호출은 요청당 최대 1회다.
  `nodeOutput`(waiting)·`result`(completed)·`error`(failed)는 `execution.status` 가 서로
  배타적인 상태이므로 삼항 연산자로 실제로는 그중 하나만 평가되고, 나머지는 리터럴
  `null` 이다(코드 순회 확인, 세 지점 모두 짧은-회로 삼항). 세 출구를 한 헬퍼로 묶은 것이
  중복 호출을 만들지 않았다. `getStatus` 자체의 2단계 조회(얇은 status projection →
  `waiting_for_input` 일 때만 `conversation_thread`/`nodeExecution` 병렬 재조회)도 이번
  diff 가 건드리지 않은 기존 최적화 그대로다.

## 발견사항 (신규/잔존)

- **[INFO]** REST `getStatus` 가 이제 매 요청마다 `stripExternalOnlyFields` 의 추가 전체
  트리 순회를 지불한다 — `llmCalls` 가 전혀 없는(비-AI 노드) execution 에도 예외 없이 적용됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts`
    `redactAndStrip` 함수, 호출부 3곳(`nodeOutput`/`result`/`error` 대입 지점)
  - 상세: 종전엔 `getStatus` 의 waiting/terminal 출구가 `deepRedactSecrets` 단일 패스였는데,
    이번 diff 로 모든 출구가 `stripExternalOnlyFields` 패스를 하나 더 얹는다. 이름 기반
    strip 은 위치를 알 수 없으므로 llmCalls 가 없다는 것을 확인하려면 트리 전체를 훑어야
    하고, 이는 AI Agent 노드가 전혀 없는 워크플로(HTTP 호출·Transform 등 대다수)에도
    예외 없이 적용된다. 이 자체는 WS fanout 경로에서 이미 같은 트레이드오프로 받아들여진
    설계(위치 기반 → 이름 기반 강건성, `side_effect.md` 12_06_20 라운드에서 이미 INFO 로
    수용)이고, `getStatus` 는 SSE emit 루프처럼 초당 수천 회 도는 hot path 가 아니라
    클라이언트가 폴링할 때 요청당 1회 실행되는 REST 엔드포인트라 절대 비용은 낮을
    가능성이 높다. 다만 JSDoc 의 `## 비용 (실측)` 절 수치(0.0112→0.0314ms)는 WS emit
    루프(N=3000, 8턴 `turnDebugHistory`)를 대상으로 한 것이라 REST 경로의 실제 payload
    분포(대용량 non-AI `outputData`, 예: 큰 JSON 을 반환하는 API 노드)에 대해서는
    직접 측정된 적이 없다 — `11_02_16` performance WARNING 3(비 AI 대용량 payload 미측정)이
    지적한 것과 같은 성격의 갭이 새 호출자에도 그대로 이어진다.
  - 제안: 즉시 조치 불요 — 요청당 1회 실행이라는 특성상 우선순위는 낮다. 만약 향후
    `getStatus` 가 폴링 빈도가 높은 시나리오(예: 위젯이 짧은 간격으로 재요청)로 확장되거나
    대용량 `outputData` 를 반환하는 노드가 흔해지면, 기존 WS 벤치마크와 별도로 REST 경로
    자체의 A/B 를 재는 것을 권한다.
- **[INFO]** `EXTERNAL_STRIPPED_FIELDS` 배열의 `.includes(k)` 멤버십 검사가 이제 WS fanout
  뿐 아니라 REST 요청 경로에서도 매 객체 키마다 호출된다 (`10_32_27` INFO 재확인, 원소 1개라
  실질 영향 없음)
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` `stripDeep`
    함수 내 `(EXTERNAL_STRIPPED_FIELDS as readonly string[]).includes(k)`
  - 상세: 원소가 `'llmCalls'` 하나뿐이라 O(n)=O(1)과 다름없다. 공유 유틸 승격으로 호출
    빈도(호출자 수)가 늘었을 뿐 알고리즘 성격은 그대로다.
  - 제안: 필드가 2개 이상으로 늘어날 계획이 생기면 `Set` 전환을 고려. 지금은 조치 불요.

## 요약

이번 라운드의 핵심 변경(REST `getStatus` 세 출구를 `redactAndStrip` 헬퍼로 통합해 fanout 과
동등한 수준으로 `llmCalls` 를 막고, 그 strip 로직을 공유 유틸로 승격한 것)은 직전 라운드가
지적한 두 성능 WARNING — 버릴 데이터에 비싼 정규식/JSON 파싱을 선지불하던 호출 순서, 그리고
공유 유틸 추출 과정에서 유실됐던 비용 실측 문서 — 를 모두 실제로 해소했다. 순서 뒤집기의
정당성("두 순서의 결과가 같다")은 논증이 아니라 회귀 테스트로 고정돼 있어 신뢰도가 높다.
알고리즘 복잡도는 여전히 O(n) 단일 순회 + lazy clone-on-write 이고, N+1 이나 새로운 블로킹
I/O 는 발견되지 않았다. 유일한 잔존 관찰은 REST 경로가 이제 매 요청마다 이름 기반 strip 을
위한 추가 전체 트리 순회를 예외 없이 지불한다는 점인데, 이는 이미 WS 경로에서 받아들여진
설계 트레이드오프가 두 번째(그리고 호출 빈도가 훨씬 낮은) 소비처로 확장된 것뿐이라 즉각적인
조치가 필요한 수준은 아니다(INFO). Critical/Warning 급 성능 결함은 없다.

## 위험도

NONE
