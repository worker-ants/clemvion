# 유지보수성 리뷰 — kb-ws-event-drift-3f4536

대상: `git diff origin/main..HEAD` (base=2aa4c8093, HEAD=8c3e95319)

## 발견사항

- **[INFO]** `KB_EVENT_NAMES` 설명이 파일 내에서 사실상 동일한 내용으로 2회 반복 서술됨
  - 위치: `codebase/frontend/src/lib/websocket/use-kb-events.ts:8-17` (module-scope 상수 docblock) vs `use-kb-events.ts:32-49` (`useKbEvents` 함수 docblock)
  - 상세: 두 docblock 모두 "backend `KbEventType` union 과 1:1(총 11종 = embedding 6 + graph 5)", "`document:embedding_error` 는 union 선언만 있고 emit 경로 없음(forward-compat)", "graph 에는 `_error` 없음(#443 에서 union 제거)" 를 거의 동일한 문장으로 반복한다. 함수 docblock 은 `{@link KB_EVENT_NAMES}` 로 상수를 참조까지 걸어두고도 바로 이어서 같은 설명을 재서술해 cross-reference 의 실효를 상쇄한다. 이후 카운트나 사유(#443)가 바뀌면 두 곳을 모두 갱신해야 하는 이중 유지보수 지점이 생긴다.
  - 제안: 함수 docblock 쪽은 `{@link KB_EVENT_NAMES}` 참조 한 줄 + "이벤트 흐름/역할" 요약만 남기고, "몇 종인지 / 왜 embedding_error 가 살아있는지 / 왜 graph_error 가 없는지"의 상세 사유는 상수 docblock(단일 출처)에만 유지하는 편이 drift 방지에 유리하다.

- **[INFO]** 테스트의 개별 assertion 이 대부분 마지막 `toEqual(전체 배열)` 테스트에 포섭됨
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-kb-events.test.ts:15-19` ("총 11종" 카운트), `:38-41` (graph `_error` 없음), `:43-46` (embedding `_error` 있음)
  - 상세: `:22-37` 의 "정확한 이벤트 이름 집합" 테스트가 순서·개수·멤버십을 모두 고정 배열로 `toEqual` 검증하므로, 앞뒤에 있는 길이/포함/제외 개별 테스트는 논리적으로 이미 커버된다. 실패 시 진단 메시지를 더 구체적으로 주기 위한 의도적 중복으로 보이나, 5개 `it` 중 4개가 사실상 같은 사실을 다른 각도로만 재확인하는 구조라 테스트 파일 자체의 "왜 이렇게 나눠져 있는지"가 코드만 봐서는 바로 드러나지 않는다.
  - 제안: 현재도 기능적으로 문제는 없음(오탐 없음, 유지보수 비용도 낮음 — 배열이 자주 안 바뀜). 다만 향후 유사 패턴 재사용 시 "세분화된 assertion 은 실패 메시지 가독성을 위한 의도적 중복"이라는 한 줄 주석을 테스트 최상단에 남겨두면 다음 리뷰어가 "중복 제거해도 되는지" 재판단하는 비용을 줄일 수 있다.

- **[INFO]** "매 렌더 재생성 회피" 이점 서술이 실제 효과보다 과장될 여지
  - 위치: `codebase/frontend/src/lib/websocket/use-kb-events.ts:18-30` (기존 위치: 같은 파일의 `useEffect` 콜백 내부, 커밋 전 diff 기준 옛 라인 63-77)
  - 상세: 리팩터 전에도 `KB_EVENT_NAMES` 는 `useEffect` 콜백 body 안에 선언되어 있었으므로, 컴포넌트가 리렌더될 때마다가 아니라 effect 가 재실행될 때(= `knowledgeBaseId`/`documentIds` 변경 시)만 재생성됐다. module-scope 승격의 실질 이점은 "effect 재실행마다의 배열 재할당 제거"이지 "매 렌더 재생성 회피"는 아니다. 코드 자체에는 이 표현이 없고 작업 설명(construction 근거)에만 등장하므로 코드 품질 이슈는 아니나, 향후 PR 설명/커밋 메시지에 이 근거를 재사용할 경우 부정확한 이유로 남을 수 있다.
  - 제안: 실질 이점은 "테스트 가능성(export 로 직접 import 해 backend union 과 drift 검증)"이 핵심이고, 성능 이점은 "effect 재실행 시 배열 재할당 1회 제거" 수준의 미미한 보너스로 정정해 기술하면 충분하다.

## 확인된 양호 사항 (참고)

- 네이밍·위치: `KB_EVENT_NAMES` 는 파일 내 다른 module-scope `export const [...] as const` 상수(`LLM_PROVIDERS`, `MCP_CAPABLE_SERVICE_TYPES`, `EXECUTION_TRIGGER_SOURCES` 등)와 동일한 SCREAMING_SNAKE_CASE + `as const` 컨벤션을 따르고, import 직후 최상단에 배치돼 자연스럽다.
- 죽은 코드: `document:graph_error` 를 구독 목록·핸들러 어디에서도 더 이상 참조하지 않음을 grep 으로 확인 (`use-kb-events.ts`, `websocket.service.ts`, `__tests__/*` 전수 검색 — 잔존 참조 없음). backend union 카운트(11)·주석("12종"→"11종")도 코드와 일치.
- 매직 넘버: 코드 로직(구독/해제 loop) 에는 숫자 리터럴이 없다. "11종/6/5" 는 모두 주석·테스트 expectation 에만 등장해 로직 분기에 영향을 주지 않으므로 magic number 리스크는 낮다.
- 중복 코드: subscribe(`ws.on`) / unsubscribe(`ws.off`) 루프가 `KB_EVENT_NAMES` 하나를 공유해, 승격 전과 마찬가지로 두 이벤트 이름 목록이 별도로 존재하던 방식보다 안전하다 (drift 원인이었던 "목록이 여러 곳에 따로 존재" 문제가 프로덕션 코드 기준으로는 이제 단일 출처).
- 테스트 배치: `__tests__/use-kb-events.test.ts` 는 같은 디렉터리의 기존 훅 테스트들(`use-execution-events.test.ts` 등)과 동일한 위치·명명 규칙을 따른다.
- 함수 길이·중첩: `useKbEvents` 자체의 로직 구조(중첩 깊이, 책임 분리)는 이번 diff 로 변경되지 않았고, 상수만 밖으로 나가 오히려 effect 콜백 body 가 약간 짧아졌다.

## 요약

이번 변경은 closure-local 상수를 module-scope export 로 승격해 backend union 과의 drift 를 테스트로 고정한 전형적인 "테스트 가능성 개선" 리팩터로, 네이밍·배치·컨벤션 준수 모두 기존 코드베이스와 일관되고 죽은 `graph_error` 참조도 프로덕션 코드에서 깨끗이 제거됐다. 유일하게 눈에 띄는 점은 동일 파일 안에서 "11종 구성·embedding_error forward-compat 사유·graph_error 제거 사유"를 두 개의 JSDoc 블록이 거의 동일한 문장으로 중복 서술한다는 것인데, 이는 향후 사실관계(카운트, 이슈 번호 등) 변경 시 갱신 누락 위험을 약간 높이는 INFO 수준의 지적일 뿐 현재 기능이나 가독성을 저해하지는 않는다. 테스트 파일의 assertion 세분화도 중복이 있으나 실패 메시지 가독성 확보라는 합리적 트레이드오프로 볼 수 있어 문제 삼을 수준은 아니다.

## 위험도
LOW
