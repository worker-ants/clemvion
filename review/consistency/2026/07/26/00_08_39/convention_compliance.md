# 정식 규약 준수 검토 — `spec/conventions/`

## 사전 확인 (impl-done, diff-base=origin/main)

프롬프트에 번들된 target 은 `spec/conventions/` 전체 스냅샷이며, 컨텍스트 예산 초과로
`spec/conventions/node-cancellation.md`·`chat-channel-adapter.md` 등 이번 작업과 가장 관련 깊은
파일들이 **본문 없이 파일명만** 나열돼 있었다(`⚠ 컨텍스트 예산 초과로 생략된 파일 256개`). 이에
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/node-cancel-chat-9f3e`, 절대경로)를
`git -C ... diff/show/grep` 및 `Read` 절대경로로 직접 열어 확인했다.

`git diff origin/main --stat -- spec/conventions/` 결과는 **공백(0줄 변경)** 이다. 이번 세션의 실제
diff 는 3개 파일뿐이다:

- `codebase/backend/src/nodes/core/node-handler.interface.ts` (JSDoc 14줄)
- `plan/in-progress/node-cancellation-residual-signal-propagation.md` (체크리스트 정정 14줄)
- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (위임 절 추가 26줄)

즉 **`spec/conventions/**` 자체는 이번 세션에서 한 글자도 바뀌지 않았다.** 따라서 "이번 diff 가
새로 명명 규약·출력 포맷·문서 구조·API 문서 규약·금지 항목을 위반하는 내용을 spec/conventions/ 에
추가했는가" 라는 질문에는 **해당 없음**이다 (프롬프트에 전문이 실린 `audit-actions.md`,
`cafe24-api-catalog/**` 도 모두 이번 diff 와 무관한 기존 문서이며, 훑어본 결과 frontmatter
스키마(`spec-impl-evidence.md` §2)·토큰 구분자(언더스코어)·`_overview.md`/`_*.md` 밑줄-prefix
frontmatter 면제 규칙을 스스로 위반하는 지점은 발견되지 않았다).

다만 이번 diff 가 유일하게 건드린 코드 주석(`node-handler.interface.ts` JSDoc)이 명시적으로
"SoT: spec/conventions/node-cancellation.md" 를 지목하므로, **그 SoT 문서 자체가 지금 정식 규약
(명명/분류) 을 지키고 있는지**를 절대경로로 직접 열어 확인했다. 아래는 그 결과다 — `cross_spec` /
`rationale_continuity` checker 도 같은 파일에서 동일 현상을 각자의 관점(교차 spec 모순 / 과거
전제 반증)으로 포착했으며, 본 checker 는 **명명·분류 규약** 관점에서 별도로 확인했다.

## 발견사항

- **[WARNING]** `node-cancellation.md` 가 "chat-channel" 을 노드 카테고리 명명 체계 안에 잘못 포함 — 명명 규약(§1 명명 규약 / §5 금지 항목) 위반
  - target 위치: `spec/conventions/node-cancellation.md` §1 목적 24행 — `"장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / chat-channel / 이커머스 통합 Cafe24·MakeShop)"`; §6 구현 현황 표 137행 — `| chat-channel 노드 signal 전파 | — | 미구현 (Planned) |`
  - 위반 규약: 같은 디렉토리(`spec/conventions/`)의 `chat-channel-adapter.md` — 이 문서는 chat-channel 을 `ChatChannelAdapter` **인터페이스**(§1 Adapter Interface)로 명명·정의하며, `NodeHandler`/`node-types.constants.ts` 계열의 "노드" 명명 체계에 속하지 않음을 스스로 명시한다. 실측(`git -C <worktree> grep -rn "chat" codebase/backend/src/nodes/`)으로도 `chat` 이름의 노드 파일이 0건이고 `node-types.constants.ts` 에도 미등록임을 확인했다.
  - 상세: `node-cancellation.md` §1/§6 은 "chat-channel" 을 HTTP/DB/AI/Email/Cafe24/MakeShop 같은 **노드 카테고리 명명 슬롯**에 나열해, 마치 `NodeHandler.execute(context)` 로 dispatch 되는 노드 종류 중 하나인 것처럼 명명한다. 그러나 `chat-channel-adapter.md`·`spec/1-data-model.md §2.8`(Trigger.type)·`spec/5-system/15-chat-channel.md`(CCH-AD-05) 는 일관되게 이를 `webhook` 트리거의 `config.chatChannel` 변형 + outbound 어댑터로 명명한다. 한 `spec/conventions/` 디렉토리 안에서 같은 개념이 서로 다른 분류 슬롯(노드 vs 어댑터)에 동시에 명명돼 있는 것은, 새 개발자가 이 문서의 명명을 그대로 신뢰해 존재하지 않는 "chat-channel 노드"에 `abortSignal` 배선을 시도하게 만드는 실제 위험이다 — 실제로 이번 diff 가 고치는 대상인 구 JSDoc 주석("chat-channel 노드의 signal 전파는 후속 PR 에서 점진 통합")이 바로 그 오분류의 산물이었다.
  - 완화 요인 (이번 세션의 책임은 아님): 이번 diff 의 `node-handler.interface.ts` 변경은 이 오분류를 코드 쪽에서 **정정**했고(`chat-channel` 삭제 → `Cafe24 / MakeShop`), `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-25 #5)" 절에 `project-planner` 앞 구체 수정안(§1 나열에서 제거, §6 표 행 삭제 또는 "노드 아님" 재기재)까지 명시적으로 남겨뒀다 — CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 절차를 정확히 따른 것이다. `spec/conventions/` 자체는 이번 diff 에서 변경되지 않았으므로 이 WARNING 은 **이번 세션이 신규로 저지른 위반이 아니라, 이미 식별·위임된 채 반영 대기 중인 기존 규약 상태**를 가리킨다. 따라서 이번 push 를 막을 사유(CRITICAL)로 보지 않는다.
  - 제안: `project-planner` 가 위 위임을 처리해 §1 나열에서 `chat-channel` 을 제거하고 §6 표의 `chat-channel 노드 signal 전파` 행을 삭제(또는 "노드 아님 — `webhook` 트리거 어댑터, cascade 대상 아님" 으로 재기재)할 것. 처리 전 병합한다면 `pending_plans:` 상태로 계속 추적되도록 유지.

- **[INFO]** 같은 §6 표의 MakeShop/Cafe24 행이 이미 병합된 구현 상태를 반영하지 못함 (참고용 — 본 checker 신규 발견 아님)
  - target 위치: `spec/conventions/node-cancellation.md` §6 구현 현황 표 138~139행 — `MakeShop 노드 signal 전파 | — | 미구현 (Planned)`, `Cafe24 노드 signal 전파 | — | 미구현 (Planned)`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 (`status: partial` 문서는 실제 구현 상태를 `code:`/본문에 정확히 반영해야 한다는 lifecycle 원칙)
  - 상세: `git -C <worktree> show --stat e83da5052`(이미 `origin/main` 에 병합된 "MakeShop·Cafe24 노드에 execution abortSignal 전파" 커밋)로 확인한 결과 이 커밋은 `spec/` 을 전혀 건드리지 않았다. 즉 §6 표는 origin/main 기준으로도 이미 stale 이며, 이번 diff 의 JSDoc(Cafe24/MakeShop per-call `AbortController` cascade 설명 추가)이 그 구현을 재확인해준다. 표기 지연이라 Rationale/명명 위반이라기보다 상태 갱신 누락에 가까워 INFO 로 기록.
  - 제안: 위 WARNING 항목 처리 시 project-planner 가 이 두 행도 `✓ 구현됨`으로 함께 갱신.

- **[INFO]** `node-cancellation.md` 는 CLAUDE.md 가 권장하는 `## Overview` 리터럴 헤딩 없이 바로 `## 1. 목적` 으로 시작 (문서 구조 규약 — 권장 사항, 강제 아님)
  - target 위치: `spec/conventions/node-cancellation.md` 최상단 (frontmatter 직후 `# Node Cancellation 컨벤션` → 블록쿼트 → `## 1. 목적`)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장" — 같은 디렉토리의 `audit-actions.md`/`spec-impl-evidence.md` 는 `## Overview` 리터럴 헤딩을 쓴다.
  - 상세: 권장 사항이라 CRITICAL/WARNING 대상은 아니며, 실질적으로 도입부 블록쿼트+`## 1. 목적` 이 Overview 역할을 대체하고 있어 내용 공백은 없다. 이번 diff 와도 무관(비변경 파일)한 사전 존재 상태.
  - 제안: 규약 갱신이 필요하다기보다, 차기 `spec/conventions/` 정리 시 일관성 차원에서 `## Overview` 헤딩으로 통일 고려 가능 (선택 사항).

## 요약

이번 세션의 diff 는 `spec/conventions/**` 를 한 글자도 변경하지 않았으므로, "target 문서가 새로
도입한 명명·출력 포맷·문서 구조·API 문서 규약 위반"은 없다. 다만 diff 가 유일하게 건드린
`node-handler.interface.ts` JSDoc 이 SoT 로 지목하는 `spec/conventions/node-cancellation.md`
를 직접 열어 대조한 결과, 그 문서의 §1/§6 이 "chat-channel" 을 여전히 노드 명명 슬롯에 잘못
포함하고 있음을 확인했다 — 같은 디렉토리의 `chat-channel-adapter.md` 가 정의하는 어댑터 명명
체계와 정면으로 어긋난다. 이 오분류는 이번 세션이 새로 저지른 것이 아니라 기존부터 있던
것이며, developer 는 `spec/` 쓰기 권한이 없어 정확히 CLAUDE.md 절차대로 `project-planner` 에게
구체 수정안까지 첨부해 위임했다(은폐 없음). 따라서 이번 push 를 막을 사유는 아니지만, 병합 후
project-planner 가 조속히 §1/§6 을 정정해 SoT 문서와 코드 주석 사이의 명명 불일치를 해소해야
한다. 부수적으로 같은 표의 MakeShop/Cafe24 행도 이미 병합된 구현을 반영하지 못한 채 stale 상태다.
그 외 프롬프트에 전문이 포함된 `audit-actions.md`·`cafe24-api-catalog/**` 자체는 frontmatter
스키마·토큰 구분자·밑줄-prefix 면제 규칙을 스스로 위반하는 지점 없이 정합적이다.

## 위험도

LOW
