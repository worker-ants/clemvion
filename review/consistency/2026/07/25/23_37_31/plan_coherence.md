# Plan 정합성 검토 — node-cancellation chat-channel JSDoc 정정 + won't-do 종결

## 검토 대상 (실제 diff, `origin/main` 대비 1 commit)

`60542ee77` "docs(nodes): chat-channel 은 노드가 아니다 — JSDoc 정정 + 항목 won't-do 종결"

- `codebase/backend/src/nodes/core/node-handler.interface.ts` — `abortSignal` JSDoc 정정
  (`chat-channel` 나열 제거 + 근거 추가)
- `plan/in-progress/node-cancellation-residual-signal-propagation.md` — chat-channel 항목
  `[ ]` → `[x]` won't-do 처리
- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` — "추가 위임 #5"
  섹션 신설 (spec §6 표/§1 나열 처분을 project-planner 에 위임)

(프롬프트의 target 문서 덤프에는 예산 초과로 `spec/conventions/node-cancellation.md` 본문이
빠져 있어 워크트리에서 절대경로로 직접 Read, 관련 plan 2건도 직접 Read 로 대조했다.)

## 발견사항

- **[INFO]** `spec-update-node-cancellation-shutdown-classification.md` Overview 문구가 이번
  addendum 과 살짝 어긋남
  - target 위치: 코드 diff 자체 아님 — `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` Overview (17~20행, 이번 커밋으로 미수정)
  - 관련 plan: 같은 파일의 "추가 위임 #5" (192~211행, 이번 커밋 신설)
  - 상세: Overview 는 "나머지 항목(chat-channel·MakeShop·Cafe24 signal 전파, IE resume)은
    이 결정과 무관하게 **진행 가능**" 이라 적혀 있다. 이 문장은 chat-channel 이 MakeShop/Cafe24
    와 동일하게 "signal 전파 구현으로 진행" 될 것이라는 전제를 깔고 있는데, 이번 addendum #5 는
    그 전제를 반증하고 chat-channel 을 **won't-do(범주 오류)** 로 종결했다. Overview 만 읽는
    독자는 chat-channel 이 여전히 signal-전파 구현 대상인 것으로 오해할 수 있다. (이 저장소
    메모리 lesson: "plan 서술은 철회로 거짓이 될 수 있다" — 본문 여러 위치의 서술 동기화 필요)
  - 제안: Overview 의 해당 괄호 나열에서 chat-channel 을 빼거나 "(chat-channel 은 won't-do,
    아래 addendum #5 참조)" 로 각주. 결정을 뒤집을 필요는 없고 문서 내부 동기화만 필요 — CRITICAL/WARNING 아님.

- 그 외 **미해결 결정 충돌 없음**: BLOCKED 항목("Workflow 단위 timeout / graceful shutdown 의
  노드 abort 통합")은 이번 커밋이 건드리지 않았고, `spec-update-node-cancellation-shutdown-classification.md` 의 (a)/(b) 선택지도 그대로 열려 있다 — chat-channel 처분과 무관하다는
  서술(같은 문서 61~64행)도 실측과 부합한다.
- **선행 plan 미해소 없음**: `execution-engine-residual-gaps.md` G2 cross-reference, DB/HTTP
  선례(`node-cancellation-inflight-followups.md §2`) 등 이번 변경이 가정하는 전제는 모두 이미
  완료·존재가 확인됐다.
- **후속 항목 누락 없음**: `spec/conventions/node-cancellation.md` §1·§6 의 chat-channel 관련
  서술 정정은 `spec/` 쓰기 권한이 없는 developer 가 직접 고치지 않고 addendum #5 로 명시
  위임했다 — `pending_plans:` 도 유효(`node-cancellation-residual-signal-propagation.md` 는
  아직 미완료 항목(BLOCKED·IE resume·선형 경로 규명)이 남아 `in-progress` 유지가 맞고, 조기
  `implemented` 승격 리스크 없음). 다른 in-progress plan(`eia-context-schema-followups.md`,
  `exec-intake-followups.md`, `chat-channel-*` 3건 등) 의 `chat-channel` 언급은 전부 어댑터/모듈
  명칭 문맥이라 이번 "chat-channel 은 노드가 아니다" 결론과 충돌하지 않는다.

## 요약

이번 diff 는 developer 권한 경계(codebase/**, plan/** 쓰기 · spec/ read-only)를 정확히 지키며,
착수 전 프로브로 반증된 전제("chat-channel 노드")를 코드 JSDoc 정정 + plan 체크박스 종결로
반영하고, spec §6 표/§1 나열의 실제 처분은 project-planner 위임 plan 에 addendum 으로 명시
위임했다. 미해결 결정을 우회하거나(BLOCKED 항목은 그대로 유지), 선행 plan 을 무시하거나,
타 plan 의 후속 항목을 누락시키는 정황은 발견되지 않았다. 유일한 관찰은 위임 plan 문서 자체의
Overview 문구가 이번 addendum 의 결론(chat-channel = won't-do)과 살짝 어긋나는 내부 서술
동기화 이슈로, 병합을 막을 사안은 아니다.

## 위험도

LOW
