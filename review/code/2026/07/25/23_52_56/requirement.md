# Requirement Review — node-handler.interface.ts JSDoc 정정 + chat-channel won't-do 종결

## 스코프 요약

이 diff 는 순수 문서/JSDoc 변경이다 (실 코드 로직 변경 없음):

1. `codebase/backend/src/nodes/core/node-handler.interface.ts` — `ExecutionContext.abortSignal`
   JSDoc 의 대상 노드 나열에서 `chat-channel` 을 제거하고 `Cafe24 / MakeShop` 으로 교체, chat-channel
   이 cascade 대상이 아닌 근거를 추가.
2. `plan/in-progress/node-cancellation-residual-signal-propagation.md` — chat-channel 항목을
   `[x]` won't-do 로 종결 + worktree frontmatter 갱신.
3. `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` — chat-channel
   won't-do 를 반영한 문구 수정 + "추가 위임 #5" 섹션 신설 (spec §1/§6 갱신 제안, planner 위임).

MakeShop/Cafe24 실제 signal 배선(코드)은 선행 커밋 `e83da5052`(별도 리뷰 세션에서 이미 검토됨)에
있고, 이번 diff 범위에는 포함되지 않는다.

## 사실관계 검증 (Read/Grep 으로 직접 확인)

- `codebase/backend/src/nodes/{ai,core,data,flow,integration,logic,presentation,trigger}` 전
  카테고리에 `chat` 이름의 노드 파일 0건, `node-types.constants.ts` 에도 미등록 — "chat-channel
  노드는 존재하지 않는다" 주장 확인됨.
- `spec/1-data-model.md:230` — "webhook / schedule / manual (chat-channel 은 별도 type 이 아니라
  `webhook` 트리거의 `config.chatChannel` 변형 …)" 텍스트 실재, 인용 줄 번호 일치.
- `codebase/backend/src/modules/chat-channel/**` 에 `abortSignal`/`AbortController` 참조 검색 시
  discord/telegram/slack **outbound client** 내부의 자체 per-request timeout `AbortController`
  3건만 존재 — 이는 `ExecutionContext.abortSignal` cascade 와 무관한 별개 개념이므로 "context
  abortSignal 참조 0건" 주장과 모순되지 않는다.
- `spec/5-system/15-chat-channel.md` CCH-AD-05 — `ChatChannelDispatcher` 가
  `WebsocketService.executionEvents$` 를 `onModuleInit` 구독해 `execution.cancelled` 포함 5종
  이벤트를 outbound 발송한다는 서술 확인 — "취소된 실행은 오히려 execution.cancelled 를 발송해야
  한다" 근거와 일치.

인용된 근거는 전부 실측 가능하고 정확했다 — 지어낸 근거 없음.

## 발견사항

- **[WARNING]** JSDoc 상단 나열은 갱신했지만 바로 아래 "소비자" 항목 리스트는 Cafe24/MakeShop 을
  반영하지 않아 같은 docblock 내부에서 불일치가 생겼다.
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:216` (상단 나열, 이번 diff 로
    `Cafe24 / MakeShop` 추가됨) vs `:225-231` (소비자 bullet list, `HTTP`/`DB`/`AI`/`Email` 만 나열—
    Cafe24/MakeShop 미기재, 이번 diff 의 컨텍스트 줄로 그대로 남음)
  - 상세: 216번 줄의 "장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / Cafe24 / MakeShop)"
    는 chat-channel 오류를 바로잡으며 Cafe24/MakeShop 을 새로 추가했다. 그런데 225번 줄
    "**소비자** (signal 을 fetch / SDK 인자로 전파하는 handler)" 이하 bullet 은 여전히 HTTP/DB/AI/
    Email 4개뿐이고 Cafe24/MakeShop 소비 방식(예: 이미 구현된 `MakeshopCallOptions.signal`/
    `Cafe24CallOptions.signal` → per-call `AbortController` cascade)에 대한 bullet 이 없다.
    이 PR 이 바로 이 docblock 을 편집하면서 상단 나열만 고치고 바로 아래 상세 리스트는 동기화하지
    않아, 문서 내부에서 "무엇이 소비자인지" 목록이 자기 자신과 어긋나는 상태로 남았다 (점검 관점
    4: 함수명·주석과 실제 구현의 일치 — 이번엔 주석 내부 두 리스트 간 불일치).
  - 제안: 225-231 소비자 bullet 에 `- Cafe24/MakeShop — per-call AbortController 에 signal cascade
    (already-aborted 시 즉시 abort)` 형태의 항목을 추가해 상단 나열과 동기화한다. 사소하지만 이번
    PR 이 정확히 그 문단을 편집한 김에 함께 고치는 것이 합리적이다.

- **[INFO]** `spec/conventions/node-cancellation.md` §1(24번째 줄 부근)·§6(137번째 줄) 은 여전히
  `chat-channel` 을 대상 노드/미구현 항목으로 나열한다 — 이번 코드/JSDoc 정정과 spec 본문이
  일시적으로 어긋난 상태다.
  - 위치: `spec/conventions/node-cancellation.md:24`, `:137`
  - 상세: 이것은 `[SPEC-DRIFT]` 로 분류할 사안이지만, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    "추가 위임 (2026-07-25 #5)" 섹션에서 이미 동일 근거로 spec 갱신을 project-planner 에게
    명시적으로 위임해 두었다 (developer 는 `spec/` 쓰기 권한이 없으므로 정당한 처리). 즉 이미
    추적되고 있는 gap 이라 별도 조치가 필요하지 않다 — 이 reviewer 는 spec 을 직접 수정하지 않으며,
    반영은 project-planner 의 spec draft 경로를 통해야 한다는 규약과도 일치한다.
  - 제안: (코드 변경 불요) planner 가 해당 plan 의 추가 위임 #5 를 처리할 때 §1/§6 을 함께 갱신.

- **[INFO]** plan 체크박스 `[x]` 종결(won't-do)과 그 근거 서술은 실제 코드베이스 상태(노드 미등록,
  webhook 트리거 변형, CCH-AD-05 outbound 방향)와 grep/Read 로 교차검증한 결과 전부 사실과
  일치한다 — 근거 날조나 과장 없음.
  - 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md:35-45`

## 요약

이번 diff 는 기능 코드 변경이 없는 순수 JSDoc·plan 문서 정정이며, "chat-channel 은 노드가 아니라
webhook 트리거 어댑터라 cancellation cascade 대상이 아니다" 라는 핵심 주장은 코드베이스 전수 검색과
spec 교차 확인으로 전부 실증됐다 (지어낸 근거 없음). 유일한 흠은 이번 PR 이 편집한 바로 그
docblock 안에서 상단 노드 나열(Cafe24/MakeShop 추가)과 하단 "소비자" bullet 리스트가 동기화되지
않은 것(WARNING 1건)이며, spec 본문(`node-cancellation.md` §1/§6)의 잔여 불일치는 이미 별도 plan
으로 project-planner 에게 정당하게 위임돼 있어 추가 조치가 필요 없다(INFO). 기능적 리스크나
회귀 가능성은 없다.

## 위험도

LOW
