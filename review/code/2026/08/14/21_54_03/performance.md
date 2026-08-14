### 발견사항

- **[WARNING]** `stripDeep` 재귀 strip 이 `llmCalls` 를 가질 수 없는 **모든 node 이벤트**에도 방어심층화로 걸리는데, 그 payload 크기에 상한이 없다 — 실측된 오버헤드(+2.4~2.6배, 6.5MB 에서 +61ms)가 이미 상한 없는 emit 경로 위에 얹힌다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:503`(`emitNodeEvent`) 의 `524|    const externalNodePayload = stripExternalOnlyFields(\n525|      wireEnvelope,\n526|      MAX_SANITIZE_DEPTH,\n527|    );` — `codebase/backend/src/shared/utils/strip-external-only-fields.ts:105`(`stripDeep`)가 실제 재귀 순회를 수행
  - 상세: `emitNodeEvent`(node 실행마다 발생 — AI 대화보다 훨씬 빈번한 이벤트)는 `llmCalls` 를 담을 수 없는 형태(HTTP 노드 응답 JSON, DB 쿼리 결과 등)에도 동일한 depth-무관 재귀 strip 을 무조건 건다. 프로젝트가 자체 실측한 결과(`plan/in-progress/spec-draft-eia-62-waiting-payload.md:264-270`)에 따르면 strip 유무 A/B 로 124KB→2.47×, 1.2MB→2.36×, 6.5MB→+61ms(2.56×) 이고, `ai-turn-executor.ts:2978` 주석이 "outputData JSONB 가 수십 MB 까지 증가"한 실측 이력을 남기고 있다. 즉 이 diff 는 이미 상한이 없던 동기 emit 경로(Node.js 단일 스레드, 이벤트 루프 블로킹) 위에 최대 2.6배의 추가 동기 CPU 비용을 얹는다 — 대형 non-AI node 이벤트가 많은 워크플로에서는 이벤트 루프 점유 시간이 눈에 띄게 늘어날 수 있다. 다만 이 위험은 팀이 이미 측정해 `plan/in-progress/HANDOFF-eia-terminal-payload.md:95-99`에 "이 PR 밖 별건" 으로 명시 등재했고("strip 과 무관한 선존 결함", "이번 PR 에서는 고치지 않는다" — 보안 수정 우선), root cause(payload 크기 상한 부재)는 strip 도입 이전부터 있던 문제임도 실측으로 확인돼 있다. 신규 회귀가 아니라 기존 무상한 경로의 배율 악화이며, 이미 추적·의도적 유예 상태다.
  - 제안: 별도 조치 불필요(이미 tracked). 다만 리뷰 관점에서는 이 배율이 "PR 밖" 으로 옮겨진 채 이번 PR 이 랜딩되면, 그 사이 대형 non-AI node payload 트래픽이 실제로 이벤트 루프 지연을 유발하는지 프로덕션 관측(APM latency histogram 등)으로 확인하는 캐너리를 권고. `HANDOFF` 문서의 "native 선판정(직렬화 문자열에 `llmCalls` 부재 시 재귀 스킵)" 후속안이 유망해 보이므로 후속 PR 착수 시 우선순위로 반영.

- **[INFO]** `stripDeep` 에 identity 캐시(WeakMap)가 없다 — 형제 함수(`sanitizePayloadForWs`/`deepRedactSecrets`)는 반복 emit 시 O(1) 로 줄이는데 이 함수는 매번 전체 재순회한다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:105`(`stripDeep`) — 대조: `codebase/backend/src/modules/websocket/websocket.service.ts:237`(`SANITIZE_CACHE = new WeakMap(...)`), `codebase/backend/src/shared/utils/sanitize-error-message.ts:135-137`(`DEEP_REDACT_CACHE`, depth-0 identity cache)
  - 상세: 같은 객체 참조가 여러 채널로 반복 emit 되는 경로(형제 sanitizer 가 캐시를 두는 이유와 동일한 시나리오)에서 `stripDeep` 만 매번 O(n) 전체 트리를 다시 순회한다. 실측 비용은 낮다(+20.2 µs/emit, 8턴 `turnDebugHistory` 기준, N=3000 A/B) — 하지만 이는 캐시 부재가 무해하다는 뜻이 아니라, 지금까지 관측된 반복-emit 시나리오가 그 정도 규모였다는 뜻이다. 캐시를 지금 붙이지 않은 근거(`plan/in-progress/spec-draft-eia-62-waiting-payload.md:245-248`)는 "형제(`SANITIZE_CACHE`/`DEEP_REDACT_CACHE`)와 무효화 시점이 갈려 sanitize 는 캐시 적중·strip 은 미적중인 조합이 생기고 이를 덮는 테스트가 없다"는 것으로, 근거가 문서화돼 있고 기술적으로 타당하다(조기 캐싱보다 관측 후 결정이 안전).
  - 제안: 조치 불요 — 이미 실측·문서화·의도적 유예. 반복-emit 트래픽이 유의미해지면(예: 동일 large payload 를 여러 구독 채널에 반복 전달) 재검토.

- **[INFO]** `stripAndRedact`(REST `getStatus`)는 순서(strip → redact)를 실측으로 확정했고, 두 pass 를 하나로 합치지 않은 근거도 문서화돼 있다 — 확인했으나 조치 불요, positive finding
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:98`(`stripAndRedact`), 호출부 `384`(`waiting nodeOutput`)·`446`(`result`)·`450`(`error`) — `getStatus` 한 요청당 최대 1회만 호출(세 호출부가 상태값으로 상호 배타적이라 중복 실행 없음)
  - 상세: `deepRedactSecrets` 는 정규식 다중 패스 + JSON 파싱까지 수행하는데, `llmCalls` 서브트리(가장 큰 필드인 경우가 많음)를 strip 을 먼저 걸어 통째로 버림으로써 "버릴 데이터에 비싼 연산을 선지불하지 않는다"는 원칙을 실현했다. 팀 실측(`plan/in-progress/spec-draft-eia-62-waiting-payload.md:287-298`)에 따르면 `llmCalls` 를 실제로 포함하는 payload 는 오히려 **12~16배 빨라졌다**(809KB 기준 2.906ms→0.235ms). `llmCalls` 가 없는 payload 만 순수 오버헤드(1.9배)를 진다 — 트레이드오프가 실측 기반으로 합리적이다. N+1/루프 내 반복 호출 패턴 없음.
  - 제안: 없음.

- **[INFO]** `getStatus` 의 2단계 조회 설계(무거운 `conversation_thread` JSONB 컬럼을 `waiting_for_input` 상태에서만 재조회)가 이번 diff 에서도 그대로 보존됐다 — 기존 최적화 회귀 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:325`(`getStatus`), `STATUS_PROJECTION_COLUMNS` (line 72)에서 `conversationThread` 제외, `355`의 `Promise.all` 병렬 2단계 조회
  - 상세: polling 이 잦은 running/pending/completed/failed 상태에서 최대 수 MB 짜리 TOAST 컬럼을 읽었다 버리는 비용을 피하는 지연 로딩 패턴이 유지됐고, waiting 분기에서만 필요한 두 조회(`threadRow`/`nodeExec`)를 `Promise.all` 로 병렬화해 왕복 depth 를 늘리지 않았다. 이번 diff 가 추가한 `stripAndRedact` 호출도 이 흐름 안에 자연스럽게 얹혀 별도 쿼리·루프를 만들지 않는다.
  - 제안: 없음.

- **[INFO]** `stripDeep` 은 lazy clone-on-write — 변경이 없는 서브트리는 원본 참조를 그대로 반환해 공통 경로(대부분의 payload 는 `llmCalls` 를 갖지 않음)에서 불필요한 할당이 없다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:105-146`
  - 상세: 배열은 최초 변경 발견 시에만 `value.slice()`, 객체는 최초 변경 발견 시에만 `{ ...obj }` 로 1회 클론하고 그 뒤로는 `out` 을 재사용한다. `Object.defineProperty` 로 개별 key 대입하는 방어(`__proto__` 오염 방지)도 변경된 key 에만 적용돼 순회 비용을 늘리지 않는다. 메모리 프로파일 관점에서 적절한 설계.
  - 제안: 없음.

### 요약
이번 diff 의 핵심 성능 변화는 `stripExternalOnlyFields`/`stripDeep` 이 depth-1 얕은 삭제에서 깊이-무관 재귀 순회로 바뀐 것과, 그 처방을 REST `getStatus`(`interaction.service.ts`)까지 확장한 것이다. 두 변경 모두 팀이 이미 A/B 실측을 근거로 트레이드오프를 문서화했고(WS emit +20.2 µs/전형 payload, REST 는 `llmCalls` 유무에 따라 12~16배 개선 또는 1.9배 오버헤드), N+1 쿼리·불필요한 즉시 로딩·과도한 문자열 연결 같은 새로운 알고리즘적 결함은 발견되지 않았다. 가장 주목할 잔여 리스크는 `emitNodeEvent`(node 실행마다 호출되는 고빈도 경로)가 `llmCalls` 를 가질 수 없는 대형 non-AI payload(HTTP 응답 JSON 등)에도 동일한 재귀 strip 을 걸어 최대 2.6배의 동기 CPU 비용을 이미 상한 없는 emit 경로 위에 얹는다는 점인데, 이는 strip 도입 이전부터 존재하던 "emit payload 크기 무상한" 구조적 결함의 배율 악화이며 팀이 이미 실측 후 "이 PR 밖 별건" 으로 명시적으로 유예·추적하고 있다(`plan/in-progress/HANDOFF-eia-terminal-payload.md`). `stripDeep` 에 형제 함수 대비 identity 캐시가 없는 점도 실측 비용이 작고(+20.2 µs/emit) 캐시 무효화 시점 불일치 리스크를 근거로 의도적으로 유예된 상태다. 두 항목 모두 신규 미인지 결함이 아니라 이미 실측·기록·추적된 트레이드오프이므로 이번 라운드에서 새로 차단할 사유는 없다.

### 위험도
LOW
