# 테스트 리뷰 — KB WS event drift 정정 (`kb-ws-event-drift-3f4536`)

대상: `git diff origin/main..HEAD` (base=2aa4c8093, HEAD=8c3e95319)

## 발견사항

- **[INFO]** exact-set 어서션이 순서까지 강제 (불필요하게 브리틀할 수 있음)
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-kb-events.test.ts:23-37`
  - 상세: `expect([...KB_EVENT_NAMES]).toEqual([...])` 는 배열 순서까지 정확히 일치해야 통과한다. `KB_EVENT_NAMES` 의 순서는 `ws.on`/`ws.off` 등록 순서일 뿐 기능적 의미가 없다(구독 이벤트 집합만 중요). 동일 세트를 유지한 채 두 이벤트의 선언 순서만 바꾸는 무해한 리팩터도 이 테스트를 깨뜨린다. 다만 첫 번째 `it`(길이 3-way 카운트)과 세 번째/네 번째(`not.toContain`/`toContain`) 테스트가 이미 카운트·멤버십을 충분히 검증하므로, drift 재발 감지라는 본래 목적은 순서 무관 세트 비교(`toEqual(expect.arrayContaining(...))` + 길이, 혹은 `new Set(...)` 비교)로도 동일하게 달성 가능하다.
  - 제안: 낮은 우선순위. 유지해도 무방하지만, 순서 변경이 실제로 발생하면 재작성 비용이 드는 assertion 이라는 점만 인지. 굳이 지금 고칠 필요는 없음(과설계 방지 관점에서 현행 유지도 합리적).

- **[INFO]** "backend parity" 테스트가 실제로는 backend 를 import/실행하지 않는 단방향 미러 (검증 요청 포인트 2 관련)
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-kb-events.test.ts:5-9` (docstring), `codebase/backend/src/modules/websocket/websocket.service.ts:331-352` (`KbEventType`)
  - 상세: 테스트 스위트 이름과 docstring 이 "backend `KbEventType` union parity" 를 표방하지만, 실제로는 frontend 소스(`use-kb-events.ts`)에 있는 `KB_EVENT_NAMES` 배열을 테스트 파일 안에 **두 번째로 하드코딩한 배열**과 비교하는 것뿐이다. TypeScript 의 `type KbEventType = 'a' | 'b' | ...` 는 컴파일 타임에 소거되므로 런타임에 backend 패키지를 import 해서 대조할 방법이 원천적으로 없다 — 이는 이 프로젝트의 frontend/backend 가 별도 배포 단위이고 타입 공유용 shared 패키지가 없는 구조적 제약(실측: `codebase/packages/` 에 websocket/kb-event 관련 shared 패키지 없음)에서 오는 근본적 한계이지, 이 PR 의 결함은 아니다.
  - **잔여 리스크(비대칭)**: 이 테스트는 frontend 측 변경(frontend 가 실수로 이벤트를 빼먹거나 오타 낼 경우)만 잡는다. **backend 가 `KbEventType` union 을 바꿔도(멤버 추가/삭제/rename) frontend 쪽 테스트는 통과한 채로 남는다** — frontend 의 `KB_EVENT_NAMES` 를 손대지 않았으니 자기 자신과의 비교는 항상 통과하기 때문. 즉 "backend 가 12번째 이벤트를 추가했는데 frontend 훅이 구독을 안 해서 캐시가 갱신 안 되는" 이번 회귀의 **반대 방향** drift 는 이 가드가 여전히 못 잡는다. `websocket.service.spec.ts` 에도 union 멤버 개수/집합을 검증하는 대칭 테스트가 없음을 확인함(grep 결과 `KbEventType` 카운트 assertion 없음).
  - 제안: 저비용 대안으로 backend 쪽에도 `KbEventType` 과 대응하는 최소 런타임 상수(예: `emitKbEvent` 가 받는 이벤트명 배열)를 하나 두고, backend spec 에서 그 배열의 길이/집합을 하드코딩 비교하는 대칭 가드를 추가하면 최소 "양쪽 다 각자 최후 알려진 상태를 하드코딩해 review 시 사람이 눈치채게" 하는 정도의 방어선은 세울 수 있다. 다만 새 shared 패키지를 만드는 것은 이 변경 규모에 비해 과설계이므로, 지금 당장 요구할 사항은 아니고 인지된 한계로 문서화(테스트 docstring 에 "frontend 측 hardcoded mirror — backend 반대방향 drift 는 별도 가드 없음" 한 줄 추가하는 정도)만 권장. **수용 가능한 트레이드오프로 판단.**

- **[INFO]** `useKbEvents` 훅 자체(구독/해제 wiring, throttle, ack 처리)는 여전히 직접 유닛 테스트 없음 (PR 범위 밖의 기존 갭)
  - 위치: `codebase/frontend/src/lib/websocket/use-kb-events.ts` 전체; `codebase/frontend/src/lib/websocket/__tests__/` 디렉터리에 `use-kb-events.test.ts` 외 파일 없음
  - 상세: 이번 PR 은 `KB_EVENT_NAMES` 를 모듈 스코프로 승격하고 그 상수만 테스트했다. 훅이 실제로 `ws.on(name, handler)` 를 11번 호출하는지, cleanup 시 `ws.off` 도 11번 호출되는지, throttle(`1000ms`) 이 실제로 동작하는지, `ackHandler` 가 `success:false` 를 콘솔 경고로 처리하는지 등은 여전히 미검증이다. 이는 이번 diff 이전부터 존재하던 갭(과거엔 상수가 훅 내부 지역변수라 테스트 자체가 불가능했음)이며, 이번 PR 로 오히려 상수가 export 돼 최소 "구독 이벤트 집합"만큼은 테스트 가능해진 것은 개선이다.
  - 제안: 이번 PR 의 스코프(count drift 회귀 가드)로는 충분. 별도 후속 작업으로 `ws-client` mock 을 이용한 `useKbEvents` 통합 테스트(11개 이벤트 모두 등록되는지, cleanup 시 모두 해제되는지)를 고려할 수 있으나 지금 요구할 사항은 아님.

- **[INFO]** `document:graph_error` 제거가 dead code 제거였음을 실측 확인 — 회귀 없음 (검증 요청 포인트 4)
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts:157,177,195,218,244,261` (모든 `this.emitEvent(documentId, 'document:graph_*', ...)` 호출부)
  - 상세: grep 으로 `graph-extraction.service.ts` 의 모든 `emitEvent` 호출부를 확인한 결과 `graph_started` / `graph_progress` / `graph_completed` / `graph_retry` / `graph_failed` 만 emit 되고 `graph_error` 를 emit 하는 코드 경로는 backend 어디에도 없음(이미 #443 에서 union 에서 제거됨 — `git log` 로 커밋 `6898c4b3c "fix(spec-sync §C)... (#443)"` 확인). frontend 가 구독 리스트에서 `document:graph_error` 를 지워도 `ws.on`/`ws.off` 대칭 호출이 유지되므로 런타임 오류 없음. 이번 diff 범위(frontend/spec)에서 기존 테스트 스위트에 `graph_error` 나 12-count 를 전제한 테스트가 없음을 grep 으로 확인(`toHaveLength(12)`, `graph_error` 매칭 0건 in `*.test.ts(x)`) — 회귀 없음.
  - 제안: 없음. 검증 완료.

- **[INFO]** backend 변경은 순수 JSDoc — 신규 테스트 불요 판단 타당 (검증 요청 포인트 3)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:331-352`
  - 상세: diff hunk 를 라인 단위로 확인한 결과 `export type KbEventType = ...` union 선언 자체(멤버 목록)는 이번 PR 에서 전혀 변경되지 않았고, 바로 위 JSDoc 주석만 확장되었다(11종 breakdown 설명 추가). 타입 선언에 실질 변경이 없으므로 이 부분에 대한 신규 backend 테스트는 불필요하다는 판단은 타당함. `tsc --noEmit` 으로 backend 컴파일도 확인(사전 존재하던 `websocket.service.spec.ts:547` 의 `ChatChannelRoutingInfo` 타입 에러 1건은 origin/main 에도 동일하게 존재 — 이번 diff 로 인한 회귀 아님, 별도 이슈).
  - 제안: 없음. 검증 완료.

## 요약

신규 테스트(`use-kb-events.test.ts`)는 5개 케이스로 카운트(11=6+5)·정확한 순서-포함 배열·`graph_error` 부재·`embedding_error` 존재·중복없음을 모두 검증해, "frontend 가 backend union 에 없는 이벤트를 구독"하거나 "구독 개수가 union 과 어긋나는" 이번 사고 패턴(#443 관련 count drift)의 재발은 확실히 잡는다(실측: `npx vitest run` 5/5 통과, `KB_EVENT_NAMES` 를 지역변수→모듈 export 로 승격해 테스트 가능해진 점도 개선). 다만 이름이 "backend parity" 를 표방함에도 실제로는 frontend 소스를 frontend 하드코딩 배열과 비교하는 단방향 미러라서, backend 가 union 을 먼저 바꾸는 반대 방향 drift 는 여전히 못 잡는다 — 이는 TS 타입 소거 + FE/BE 분리 배포 구조상 근본적 한계이며 이 PR 의 결함이라기보다 프로젝트 전반의 구조적 트레이드오프이므로 지금 별도 shared 패키지를 만들라고 요구하는 것은 과설계다. `graph_error` 제거가 실제로 dead code(어떤 emit 경로도 없음)였다는 점, backend 변경이 순수 JSDoc 이라 테스트 불요라는 점, 기존 테스트 스위트에 회귀가 없다는 점은 모두 코드 실측(grep + git log + tsc)으로 확인됨. 발견된 항목은 전부 INFO 수준(브리틀니스·비대칭 가드 인지·후속 커버리지 제안)이며 이번 diff 를 블로킹할 CRITICAL/WARNING 은 없음.

## 위험도

NONE
