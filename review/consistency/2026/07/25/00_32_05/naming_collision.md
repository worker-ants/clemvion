### 발견사항

이번 diff(`webchat-usewidget-extraction` 1차 slice)는 `codebase/channel-web-chat/src/widget/use-widget.ts`
내부에 있던 staleness 축 로직을 신규 파일 `use-session-generations.ts`(+ `.test.ts`)로 옮기는 **순수
추출 리팩토링**이다. spec 파일 자체의 diff 는 없고(target 으로 제시된 `spec/7-channel-web-chat/**` 본문은
이번 PR 이 변경한 것이 아니라 impl-done 검토 대상 스냅샷), 요구사항 ID·API endpoint·이벤트명·ENV var 도
신규 도입분이 없다. 신규 식별자는 다음 넷뿐이다.

- 파일 경로: `codebase/channel-web-chat/src/widget/use-session-generations.ts`, `...test.ts`
- 훅: `useSessionGenerations()`
- 타입: `export interface BootAttempt { world: number; boot: number }`
- 타입: `export interface SessionGenerations { ... }`

각각을 코드베이스 전수 grep 으로 대조한 결과 충돌 없음:

- **파일 경로** — `codebase/channel-web-chat/src/widget/` 하위 기존 훅 파일명 컨벤션(`use-token-refresh.ts`,
  `use-pending-message-queue.ts`, kebab-case `use-<subject>.ts`+`.test.ts` 페어)을 그대로 따른다. 동일 경로의
  기존 파일과 겹치지 않는다(`new file mode` 로 확인).
- **`BootAttempt`/`SessionGenerations`** — `git grep -n` 전체 리포 대조 결과 두 이름 모두 이 파일·이를 import
  하는 `use-widget.ts`·`use-widget-commands.test.ts`(주석), 그리고 `plan/in-progress/webchat-usewidget-extraction.md`
  ·과거 `review/**` 산출물(같은 계열의 이전 라운드 기록)에서만 발견됨 — 백엔드(`codebase/backend`)나 다른
  패키지에 동명 타입 없음. `Attempt` 단독 키워드도 backend 의 `loginAttempts`/`attempts`(재시도 카운터 지역
  변수) 등과 겹치지만 이들은 별도 tsconfig/패키지 스코프의 지역 변수·필드명이라 타입 충돌 여지가 없다.
- **`useSessionGenerations`** — plan 티켓 원안은 이 묶음을 `useEiaSession`(가칭)으로 부르자고 제안했으나,
  실제 1차 slice 구현은 좁힌 스코프(staleness 축만)에 맞춰 `useSessionGenerations` 로 명명했다. plan 문서
  §1차 slice 가 이 이름 변경을 명시적으로 기록하고 있어 실제 코드와 계획 서술이 어긋나지 않는다(가칭→확정
  전환이며 잔존 충돌 아님).
- **"generation/세대" 용어** — spec 전체에서 "Generation" 이 나오는 다른 곳은 `RAG(Retrieval-Augmented
  Generation)`(`spec/0-overview.md`, `spec/5-system/9-rag-search.md`) 뿐이며 완전히 다른 도메인(AI Agent
  지식검색)의 영문 약어 확장이라 명명 충돌 소지가 없다.
- **`worldGenRef`/`bootGenRef`/`unmountedRef`(내부 ref 이름, 이번 diff 로 값 자체는 안 바뀜, 파일만 이동)** —
  `channel-web-chat` 바깥에서 동일 식별자 사용 없음.

새로 도입된 4개 식별자 모두 (a) 좁은 파일/모듈 스코프에 한정되고 (b) 기존 명명 컨벤션(kebab-case 파일,
`use*` 훅 접두, PascalCase 인터페이스)을 그대로 따르며 (c) 다른 영역·다른 의미로 이미 쓰이는 동일 식별자가
없다. CRITICAL/WARNING 급 충돌 없음.

### 요약
이번 PR 은 spec 변경이 없는 순수 코드 리팩토링(훅 추출)이며, 신규로 도입되는 식별자(`use-session-generations.ts`
파일 2개, `useSessionGenerations` 훅, `BootAttempt`/`SessionGenerations` 인터페이스)는 전부 `channel-web-chat`
위젯 내부 스코프에 한정되고 기존 파일·타입·백엔드 도메인 어디와도 이름이 겹치지 않는다. 요구사항 ID·API
endpoint·이벤트명·ENV 키 등 신규 식별자 충돌 관점에서 점검할 새 항목 자체가 이번 diff 에는 없다(전부
무변경). 훅 이름이 plan 티켓의 가칭(`useEiaSession`)에서 `useSessionGenerations` 로 바뀐 것도 plan 문서에
명시적으로 기록돼 있어 혼선 소지가 없다.

### 위험도
NONE
