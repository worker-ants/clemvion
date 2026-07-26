# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 메모

`--impl-done` diff(`origin/main`..HEAD)는 3개 파일만 변경한다: `codebase/backend/src/nodes/core/node-handler.interface.ts`(JSDoc), `plan/in-progress/node-cancellation-residual-signal-propagation.md`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`. **`spec/conventions/**` 자체는 이번 diff 에서 0줄 변경**이다 (`git diff origin/main -- spec/conventions/` 결과 empty, 절대경로 워킹트리로 확인). 배정된 target 경로(`spec/conventions/`)는 diff 가 인용하는 SoT 문서(`node-cancellation.md`)를 근거로 넓게 잡힌 것으로 보인다. 이에 따라 이번 검토는 (a) diff 자체가 conventions 를 어떻게 다뤘는지, (b) diff 가 참조하는 `spec/conventions/node-cancellation.md`(target scope 안)이 diff 이후에도 자기 정합적인지 두 축으로 진행했다.

이번 diff 의 핵심 변경(JSDoc): `chat-channel` 은 노드가 아니라 `webhook` 트리거의 `config.chatChannel` 변형이라는 사실을 코드 주석에 반영하고, 대응 spec 표(§6)·목적 나열(§1) 정정은 `developer` 가 `spec/` 쓰기 권한이 없어 `project-planner` 에 위임(plan 문서에 "추가 위임 #5" 절 신설)했다. 이는 CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙을 정확히 따른 것으로, 이 부분은 **규약 준수 관점에서 문제 없음** — 오히려 모범 사례다.

## 발견사항

- **[WARNING] `node-cancellation.md` 가 diff 로 정정된 사실과 여전히 어긋난 채 남아있음**
  - target 위치: `spec/conventions/node-cancellation.md` §1(목적, "장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / chat-channel / 이커머스 통합 Cafe24·MakeShop)") 및 §6 표의 `| chat-channel 노드 signal 전파 | — | 미구현 (Planned) |` 행
  - 위반 규약: 해당 문서 자신(§1/§6)의 카테고리 나열이 `1-data-model.md:230`("`type` 필드: chat-channel 은 별도 type 이 아니라 webhook 트리거의 config.chatChannel 변형")·`5-system/15-chat-channel.md`(CCH-AD-05, 어댑터는 outbound 전용) 과 어긋난다. 이번 diff 가 정확히 이 사실을 근거로 `node-handler.interface.ts` JSDoc 을 고쳤다(§1 나열에서 chat-channel 삭제).
  - 상세: `node-cancellation.md` 는 이 컨벤션의 SoT 이고 frontmatter `code:` 에 `node-handler.interface.ts` 를 명시한다. 그 코드의 JSDoc 은 이제 "chat-channel 은 노드가 아니다"를 명시적으로 서술하는데, 같은 컨벤션 문서의 §1/§6 은 여전히 chat-channel 을 신호 미전파 노드 항목으로 열거한다. 코드(사실 최신)와 spec(구식) 이 같은 PR 안에서 갈라진 상태로 남는다.
  - 확인: 실측(절대경로 Read) — `spec/conventions/node-cancellation.md:24`, `:137`. developer 는 `spec/` 쓰기 권한이 없어 위임했고(`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #5" 절, `plan/in-progress/node-cancellation-residual-signal-propagation.md` 체크박스 주석), 이는 새로 발견된 게 아니라 이미 developer 자신이 기록·추적 중인 known gap 이다.
  - 제안: 이 항목은 `project-planner` 가 다음 spec 갱신 시 §1 나열에서 `chat-channel` 삭제 + §6 표 해당 행을 삭제하거나 "노드 아님 — 트리거 어댑터, cascade 대상 아님" 으로 성격 변경(plan 문서의 제안과 동일). 새 조치 불요 — 이미 올바른 절차(위임)를 밟고 있음을 확인하는 목적의 기록.

- **[WARNING] `error.code: 'AbortError'` 가 명명 규약 위반 상태로 미등록**
  - target 위치: `spec/conventions/node-cancellation.md` §5.1 ("`output.error` 는 표준 봉투(`code: 'AbortError'`)로 기록") · `spec/5-system/6-websocket-protocol.md` §4.1 에서도 동일 값 인용
  - 위반 규약: `spec/conventions/error-codes.md` §1("표기(`UPPER_SNAKE_CASE`)": SoT = `node-output.md §3.2` — "`code` 는 `UPPER_SNAKE_CASE`") + §3(historical-artifact 예외 레지스트리) — §1 은 "프로젝트 전체의 에러 코드 문자열"에 적용된다고 명시한다.
  - 상세: `AbortError`는 PascalCase 이고 `error-codes.md §3` 예외 레지스트리(초대 흐름 lowercase 코드들만 등재)에 **등재돼 있지 않다**. 실제 코드 확인(`grep -rl AbortError codebase/backend/src`) 결과 `execution-engine.service.ts`, `node-handler.interface.ts`, DB/Email/Cafe24/MakeShop handler 등 다수 프로덕션 경로가 이 문자열을 `error.name`/`error.code` 로 사용 중이라 실제 wire 값이다.
  - 확인: 이 역시 developer 가 이미 발견해 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #4-(1)" 에 명시적으로 기록하고 `spec/` 권한 밖이라 project-planner 에 위임한 **선재(pre-existing) 이슈**다 — 이번 diff 가 새로 만든 위반이 아니다.
  - 제안: plan 문서가 제시한 두 대안(§3 예외 레지스트리에 historical-artifact 로 등재 / `NODE_CANCELLED` 류로 교체) 중 하나를 project-planner 가 결정. 즉시 조치 불요 — 이미 정식 위임 경로를 밟고 있음.

- **[WARNING] plan frontmatter `worktree:` 가 실제 작업 위치와 불일치**
  - target 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md` frontmatter `worktree: node-cancel-signal-b4d1`
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` — `worktree` 필드는 "이 plan 이 살아있는 worktree 디렉토리 이름"을 가리켜야 하며, 이 필드가 push-gate 의 "연결 판정"(§3) 기준이 된다.
  - 상세: 이번 diff(`chat-channel 은 노드가 아니다` 커밋)는 worktree `node-cancel-chat-9f3e` 에서 이 plan 파일을 직접 수정했다. 그런데 frontmatter 는 여전히 예전 worktree `node-cancel-signal-b4d1` 를 가리킨다. 확인 결과 `node-cancel-signal-b4d1` 는 이미 PR #1019 로 **squash-merge 완료**된 상태(`git diff origin/main --stat` empty, 단 `git merge-base --is-ancestor` 는 false — squash 이력이라 트리는 동일하나 커밋 계보는 분기)라, 곧 정리(reap) 대상일 가능성이 있다. plan 은 여전히 `in-progress/`(미해결 체크박스 다수 잔존)라 frontmatter 가 최신 작업 위치를 반영하지 못하면 향후 `plan-stale-audit.sh`/push-gate 연결 판정이 죽은 worktree 를 가리키게 된다.
  - 제안: `worktree: node-cancel-chat-9f3e` (또는 현재 세션의 실제 worktree)로 갱신. 사소하지만 plan-lifecycle 이 정의한 필드 의미와 어긋나는 실측 사실이라 보고.

## 요약

이번 diff 자체는 skill 쓰기-권한 규약(`developer` → `project-planner` 위임)을 정확히 준수했고, JSDoc 정정에 인용된 근거(`1-data-model.md:230`, `CCH-AD-05`)도 실측 대조 결과 모두 정확했다 — 이 부분은 규약 준수의 모범 사례다. 다만 target scope(`spec/conventions/`)에 포함된 `node-cancellation.md` 자체는 이번 diff 로 코드(JSDoc)가 정정된 사실과 여전히 어긋난 §1/§6 서술을 남기고 있고, 무관하지만 같은 문서 §5.1 의 `error.code: 'AbortError'` 도 `error-codes.md` 의 명명 규약(UPPER_SNAKE_CASE + 예외 등록)을 어긴 채 미등록 상태다 — 다만 둘 다 developer 가 이미 발견해 project-planner 위임 경로에 정확히 태워 놓은 **선재·추적 중인 기술 부채**이지 이번 PR 이 새로 만든 위반이 아니다. plan frontmatter 의 `worktree` 필드가 실제 작업 worktree 와 어긋나는 사소한 위생 문제도 함께 발견했다. 전반적으로 이번 diff 는 conventions 준수 관점에서 안전하며, 남은 항목들은 모두 이미 올바르게 위임된 backlog 다.

## 위험도
LOW
