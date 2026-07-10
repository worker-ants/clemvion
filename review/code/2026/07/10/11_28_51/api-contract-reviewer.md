# API 계약 리뷰 — KB WebSocket 이벤트 count drift 정정

- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/kb-ws-event-drift-3f4536`
- base: `2aa4c8093` / HEAD: `8c3e95319`
- 대상 계약 표면: WebSocket server→client 이벤트, `KbEventType` union (channel `kb:{documentId}`)

## 검증 포인트 결과 (프롬프트 지정 3건)

1. **실제 계약(union 멤버 집합) 불변 여부** — 확인됨, 불변.
   - `codebase/backend/src/modules/websocket/websocket.service.ts:343-354` 의 `KbEventType` union 리터럴 목록 자체는 이번 diff 의 변경 라인에 없다 (`git diff` 상 유일한 코드 변경은 union 선언 **위 JSDoc 블록**뿐). `origin/main` 시점에도 union 은 이미 11개 리터럴(`document:graph_error` 없음)이었음을 `git show origin/main:...` 로 직접 대조해 확인 — 즉 이번 PR 은 실제 wire 계약을 바꾼 게 아니라, 코드 주석(`12개`→`11개`)과 frontend 구독 목록·spec 서술을 기존에 이미 그랬던 실제 union 에 뒤늦게 맞춘 순수 문서/구독 정합화다. hosting 상 breaking change 아님.

2. **`document:graph_error` 구독 제거의 하위호환 영향** — 없음(no-op), 확인됨.
   - `emitKbEvent(` 호출부 전수 검색(`graph-extraction.service.ts:467`, `embedding.service.ts:334`) 및 각 서비스의 `emitEvent(` 호출 리스트를 grep 한 결과, `'document:graph_error'` / `'document:embedding_error'` 문자열 리터럴을 emit 하는 호출은 backend 어디에도 없다 (graph 는 `started/progress/completed/retry/failed` 5종만, embedding 도 5종만 실제 emit). frontend 쪽에서도 `use-kb-events.ts` 외에 KB 이벤트 이름을 개별 참조하는 코드가 없음을 확인(`useKbEvents` 의 유일한 소비자는 `app/(main)/w/[slug]/knowledge-bases/[id]/page.tsx`, handler 는 payload 무시하고 이벤트 종류 불문 캐시 invalidate 만 수행). 신규 회귀 테스트 5건도 실행하여 통과 확인. 제거는 죽은 구독 정리이며 클라이언트 동작 변화 없음.

3. **`document:embedding_error` union 잔존이 계약 관점에서 문제 없는지** — 대체로 해소됐으나 두 가지 잔여 리스크.
   - spec 3곳(`6-websocket-protocol.md`, `8-embedding-pipeline.md` §8.1, `10-graph-rag.md` — graph 대칭 언급) 과 backend JSDoc 모두 "union 에 선언돼 있으나 emit 경로 없음(forward-compat), 영구 실패 신호로 사용 금지" 로 일관되게 명시해 **문서 상 오해 소지는 해소**됐다.
   - 다만 union 이 "권위 정의"로 서술되는 것과 달리, 실제 emit 경로의 타입 안전성은 union 으로 완전히 강제되지 않는다 (아래 발견사항 참조).

## 발견사항

- **[INFO]** union "권위 정의" 프레이밍과 실제 emit 경로의 타입 강제력 불일치
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts:460-475`, `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts:326-342`
  - 상세: 두 서비스의 private `emitEvent(documentId, event: string, payload)` 는 `event` 파라미터 타입이 `string` 이고, 내부에서 `event as Parameters<typeof this.websocketService.emitKbEvent>[1]` 로 강제 캐스팅해 `KbEventType` union 에 통과시킨다. 즉 실제 call site(`this.emitEvent(documentId, 'document:graph_retry', ...)`)에서 오타나 union 에 없는 이름(예: 되살아난 `'document:graph_error'`)을 넣어도 `tsc` 가 잡아내지 못한다 — union 은 선언·문서상 권위일 뿐, 이 경유 경로에서는 컴파일 타임 강제가 실질적으로 무력화돼 있다. 이번 diff 가 도입한 것은 아니고 기존 구조지만, 새 JSDoc 이 "union(권위 정의)" 을 강하게 내세우는 만큼 독자가 "emit 이 union 으로 컴파일 타임 강제된다"고 오인할 여지가 있다.
  - 제안: 당장 이 PR 범위는 아니나, 후속으로 `emitEvent` 시그니처를 `event: KbEventType` 으로 좁히면 (private helper 이므로 `string` 완화 필요 없음) 이 계약의 실질 강제력을 코드 레벨로 끌어올릴 수 있다. 최소한 JSDoc 에 "런타임/컴파일 타임 강제는 없고 신규 회귀 테스트(`use-kb-events.test.ts`)와 코드 리뷰로만 drift 를 방지한다"는 단서를 남기면 오해를 줄일 수 있다.

- **[INFO]** frontend `KB_EVENT_NAMES` ↔ backend `KbEventType` 은 shared type 없이 수동 미러 + 테스트로만 동기화
  - 위치: `codebase/frontend/src/lib/websocket/use-kb-events.ts:18-30` vs `codebase/backend/src/modules/websocket/websocket.service.ts:343-354`
  - 상세: 이번 PR 이 바로 이 수동 미러링 drift(구독 12종 vs 실제 union 11종) 를 정정하는 작업이면서도, 근본 원인인 "두 계층에 동일 리터럴 목록이 별도로 존재"하는 구조 자체는 그대로 남는다. 신규 테스트(`__tests__/use-kb-events.test.ts`)가 정적 배열 값을 하드코딩 비교하는 방식이라 향후 backend union 이 바뀌면 frontend 목록과 테스트 expectation 을 모두 수동 갱신해야 하며, 갱신을 잊으면 이번과 동일한 종류의 drift 가 재발할 수 있다(다만 이번엔 최소 테스트가 감지는 해줄 것).
  - 제안: 정보 제공 목적. 모노레포에 KB WS 이벤트 이름을 공유 상수/타입 패키지(예: `packages/`)로 승격하면 이 클래스의 drift 자체를 구조적으로 차단할 수 있으나, socket.io 이벤트명이 프로토콜 전반에서 string 기반인 점을 고려하면 이번 PR 스코프를 넘는 더 큰 리팩터다. 지금 수준(수동 미러 + 회귀 테스트)도 실용적 완화로 타당함.

- **[WARNING]** 계약 문서 정합화가 spec 전역에 완전히 전파되지 않음 — 잔여 drift 2건 (병렬 리뷰어와 교차 확인됨)
  - 위치 ①: `spec/2-navigation/5-knowledge-base.md:182`
    - 상세: "WebSocket 이벤트 (`document:graph_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed`) 로 실시간 갱신" — graph 이벤트를 여전히 `_error` 포함 6종으로 서술한다. 이번 diff 가 `6-websocket-protocol.md`/`8-embedding-pipeline.md`/`10-graph-rag.md` 에서 명시적으로 "graph 에는 `_error` 없음(5종, #443 에서 union 제거)"으로 정정한 것과 같은 문서 세트 내에서 정면으로 모순된다.
    - 실측: `Read spec/2-navigation/5-knowledge-base.md` 로 직접 확인. UI 내비게이션 설명 문단이라 기능 코드에 직접 영향은 없으나, 이 PR 의 "union 권위에 spec 정렬" 이라는 목표를 기준으로 보면 sink 하나가 누락된 under-scope.
  - 위치 ②: `spec/5-system/8-embedding-pipeline.md:411` (`## Rationale > ### 결정: spec 정합성 정비`)
    - 상세: "backend `KbEventType` union (**12개 이벤트**) 과 `emitKbEvent` 구현이 권위이며..." — 같은 파일 상단 §8.1/§8.2(line 285/289/293, 이번 diff 로 정정됨)는 11개로 맞췄지만, 하단 Rationale 은 옛 "12개" 그대로 남아 **같은 파일 안에서 자기모순**이 생긴다. `spec/data-flow/6-knowledge-base.md` 의 동일 성격 Rationale 은 이미 취소선(`~~KbEventType 12개 + document:graph_error~~ → ... 11개다`)으로 과거/현재를 구분해뒀는데, 동일 패턴이 여기엔 적용되지 않았다.
    - 실측: `Read spec/5-system/8-embedding-pipeline.md:395-418` 로 직접 확인.
  - 제안: 두 곳 모두 이번 PR 범위로 함께 정정하거나(권장 — 동일 diff 취지의 sibling fix, 별도 후속 PR 을 만들 정도로 무겁지 않음), 최소한 후속 이슈로 명시 트래킹. `_error` → 5종 목록으로 교체, Rationale 은 `data-flow/6-knowledge-base.md` 와 동일한 취소선 정정 패턴 적용 권장.

## 요약

이 PR 이 만지는 실제 계약 표면(backend `KbEventType` union 의 실제 리터럴 목록)은 변경 전후 동일하며, `git show origin/main` 대조로 확인한 바 union 은 이번 diff 이전부터 이미 11개(`graph_error` 미포함)였다 — 즉 이번 변경은 hosting 계약을 바꾸는 것이 아니라 코드 주석·frontend 구독 목록·3개 spec 문서를 실제 계약에 뒤늦게 정렬하는 순수 문서/구독 정합화이며, breaking change 위험은 없다. `document:graph_error` 구독 제거는 backend 가 해당 이벤트를 emit 한 적이 없음을 전수 grep 으로 재확인해 no-op 임을 검증했고, `document:embedding_error` 를 union 에 forward-compat 목적으로 남긴 결정도 3개 spec 문서에서 "미emit·영구 실패 신호 아님"으로 명확히 각주돼 소비자 오해 소지가 해소됐다. 다만 union 의 "권위 정의" 서술과 달리 실제 emit 경로(`emitEvent(event: string, ...)` + `as` 캐스트)는 컴파일 타임 강제력이 없어 향후 유사 drift 재발을 코드 레벨로 막지는 못한다는 구조적 한계가 남아 있고(INFO, 이번 PR 범위 밖), 이번 PR 이 표방한 "spec 전역 정렬"은 `spec/2-navigation/5-knowledge-base.md:182` 와 `spec/5-system/8-embedding-pipeline.md:411`(같은 파일 내 자기모순) 두 곳에서 실제로는 미완결이다(WARNING, 병렬 requirement/scope 리뷰어의 독립 발견과도 교차 확인됨). 둘 다 문서 서술 불일치일 뿐 런타임 기능에는 영향이 없다.

## 위험도

LOW
