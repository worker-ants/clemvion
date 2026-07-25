# Requirement Review — chat-channel won't-do 종결 + node-handler.interface.ts JSDoc 정정 (재검토)

## 스코프 요약

이번 diff 는 세 실질 파일(`node-handler.interface.ts` JSDoc, 두 plan 문서) + 이전 두 리뷰 세션(`23_37_31`, `23_52_56`)의
review/consistency 산출물 커밋으로 구성된다. 실질 코드 로직 변경은 없다(JSDoc-only). 핵심 주장은 "`chat-channel` 은
노드가 아니라 `webhook` 트리거의 `config.chatChannel` 변형이며, 구현은 outbound 방향 어댑터(`modules/chat-channel/**`)
라 `ExecutionContext.abortSignal` cascade 대상이 아니다" 이고, 이를 근거로 plan 의 `chat-channel 노드 signal 전파` 잔여
항목을 won't-do 로 종결한다.

## 사실관계 재검증 (Read/Grep 직접 확인, 2026-07-26)

- `codebase/backend/src/nodes/{ai,core,data,flow,integration,logic,presentation,trigger}` 전 카테고리에 `chat`
  이름의 노드 파일 0건(실측: `find ... -iname "*chat*"` 결과 없음). `node-types.constants.ts` 에도 `chat` 관련 등록
  0건 — "chat-channel 노드는 존재하지 않는다" 주장 확인됨.
- `spec/1-data-model.md` (§2.8 Trigger 표, `type` 필드 행) — "webhook / schedule / manual (chat-channel 은 별도
  type 이 아니라 `webhook` 트리거의 `config.chatChannel` 변형 …)" 텍스트 실재 확인.
- `spec/5-system/15-chat-channel.md` `CCH-AD-05` — `ChatChannelDispatcher` 가 `WebsocketService.executionEvents$`
  를 구독해 `execution.cancelled` 포함 5종 이벤트를 outbound 발송한다는 서술 확인 — "취소된 실행은 오히려
  execution.cancelled 를 발송해야 한다" 근거와 일치.
- `codebase/backend/src/modules/chat-channel/` 전체에서 `abortSignal` grep 0건 — JSDoc 의 "참조 0건" 주장과 일치.
- 현재 `node-handler.interface.ts` 실제 파일(HEAD 기준)을 직접 열어 대조 — 이전 리뷰 라운드(`23_52_56`)에서
  지적된 WARNING 2건(①소비자 열거 리스트에 Cafe24/MakeShop 미기재, ②`1-data-model.md:230` 원본 줄번호 인용)이
  모두 후속 커밋(`35aac3539`)으로 수정되어 있음을 확인 — 요약 문단과 소비자 열거 리스트가 이제 동기화됐고,
  근거 인용도 `Trigger.type` 표 / `spec/1-data-model.md` 안정 식별자로 교체됨.
- 인용된 근거는 전부 실측 가능하고 정확 — 지어낸 근거 없음.

## 발견사항

- **[INFO]** `[SPEC-DRIFT]` `spec/conventions/node-cancellation.md` §1(대상 노드 나열, 24행 부근)과 §6(구현 현황
  표, "chat-channel 노드 signal 전파 | — | 미구현 (Planned)" 행, 137행 부근)이 여전히 chat-channel 을 cascade
  대상 노드로 분류하고 있어, 이번 diff 로 코드(JSDoc)·plan 이 도달한 결론("노드 아님, cascade 대상 아님")과
  일시적으로 어긋난다.
  - 위치: `spec/conventions/node-cancellation.md` §1, §6 표 (파일 직접 확인 — grep 으로 두 위치 모두 실재)
  - 상세: 코드가 옳고(전수 실측 확인됨) spec 본문이 낡은 전형적인 SPEC-DRIFT 케이스다. 다만 이번 PR 은 이 갭을
    묵살하지 않고 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임
    (2026-07-25 #5)" 섹션으로 project-planner 에게 명시적으로 위임해 두었고(§1 나열 삭제 + §6 표 행 정정 제안까지
    구체적으로 기재), 직전 두 리뷰 라운드(requirement·documentation·consistency 3종)에서도 동일하게 INFO/WARNING
    으로 이미 지적·확인됐다. `developer` 는 `spec/` 쓰기 권한이 없으므로 스스로 고칠 수 없는 정당한 상태다.
  - 제안: 코드 변경 불요. project-planner 가 위임 #5 를 처리할 때 `node-cancellation.md` §1 나열에서
    `chat-channel` 삭제 + §6 표 행을 삭제하거나 "노드 아님 — outbound listener, cascade 대상 아님"으로 정정.
    부수적으로 `spec/4-nodes/1-logic/10-parallel.md` (errorPolicy 설명 중 "DB / AI / Email / chat-channel 은
    후속 PR" 문구)도 같은 오분류를 반복하고 있어 함께 검토 대상.

- **[INFO]** 이전 리뷰 라운드(`23_52_56`)에서 지적된 WARNING 2건이 현재 HEAD 기준으로 모두 해소됨을 직접 확인
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` (`abortSignal` JSDoc 소비자 열거 리스트,
    `Cafe24 / MakeShop` bullet 추가됨 / 인용을 `Trigger.type` 표, `spec/1-data-model.md` 로 교체)
  - 상세: `RESOLUTION.md` 가 주장하는 조치가 실제 파일 상태와 일치한다 — 허위/부분 조치 아님.
  - 제안: 조치 불요.

- **[INFO]** 기능 완전성 — 이번 diff 의 실질 목적(chat-channel 이 cascade 대상이 아님을 실증하고 plan 항목을
  정당하게 won't-do 로 종결)은 완전히 달성됨. 코드 로직 변경이 없으므로 엣지 케이스·에러 시나리오·반환값·데이터
  유효성 관점은 해당 사항 없음(JSDoc/plan 문서 변경이라 런타임 동작에 영향 없음). TODO/FIXME/HACK/XXX 주석 신규
  도입 없음.

## 요약

핵심 주장("chat-channel 은 노드가 아니라 webhook 트리거의 outbound 어댑터이므로 `ExecutionContext.abortSignal`
cascade 대상이 아니다")은 코드베이스 전수 검색과 spec 교차 확인으로 전부 실증됐다(지어낸 근거 없음). 이전 리뷰
라운드에서 지적된 WARNING 2건(JSDoc 소비자 리스트 미동기화, 브리틀 줄번호 인용)은 후속 커밋에서 실제로 수정된 것을
직접 파일 대조로 확인했다. 남은 유일한 항목은 SoT spec 문서(`node-cancellation.md` §1/§6)가 아직 코드의 새 결론을
반영하지 못한 SPEC-DRIFT 인데, 이는 developer 권한 밖이며 이미 project-planner 에게 정당하게 위임되어 있어 이번
PR 스코프에서 추가 조치가 필요하지 않다. 기능적 리스크·회귀 가능성 없음.

## 위험도
LOW
