# Cross-Spec 일관성 검토 결과

대상: `spec/7-channel-web-chat/` (0-architecture / 1-widget-app / 2-sdk / 3-auth-session / 4-security / 5-admin-console), 모드 = `--impl-done` (diff-base `origin/main`, SoT 워크트리 = 본 checkout HEAD).

교차 검증은 payload 동봉분(`0-overview.md`/`1-data-model.md` 발췌) 외에 리포지토리에서 직접 열람해 대조: `spec/conventions/conversation-thread.md`,
`spec/5-system/14-external-interaction-api.md`, `spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/5-system/12-webhook.md`, `spec/2-navigation/9-user-profile.md`,
`spec/2-navigation/2-trigger-list.md`, `codebase/channel-web-chat/src/lib/presentation.ts` (구현), `plan/complete/web-chat-console.md`.

이번 검토는 직전 `--impl-prep` 회차(`review/consistency/2026/07/10/22_41_55/cross_spec.md`)가 이미 검증한 항목(EIA §8.4 rate-limit
stale 서술, NAV-WC-06 stale 상태 — 둘 다 `spec/7-channel-web-chat/` 밖의 별도 파일 소관이라 본 target 범위 밖)은 재검증하지 않고, 이번
회차에 새로 반영된 코드/스펙 변경(`asEnvelope` truncation 흡수, `execution.message` 3번째 데이터 소스 추가)과 **origin/main 대비
브랜치 분기**를 중심으로 추가 검증했다.

## 발견사항

### [WARNING] `0-architecture.md` §3 EIA 매핑 표에 `execution.message` 행 누락 — 다른 target 문서가 이미 그 표면을 사용 중

- **target 위치**: `spec/7-channel-web-chat/0-architecture.md` §3 "EIA 매핑 (위젯이 사용하는 EIA 표면)" 표(대화 시작·실시간
  이벤트·AI 메시지·입력 대기 진입·AI 폼 렌더·사용자 메시지·버튼 탭·Form 제출·대화 종료·재연결 복구·토큰 갱신 11행). 본 표는
  스스로를 "위젯이 사용하는 EIA 표면"의 목록으로 표방한다.
- **충돌 대상**: 같은 target 문서군의 `spec/7-channel-web-chat/1-widget-app.md` §2 메시지 리스트 행 —
  > "`ai_message.presentations[]` / `execution.message` / 복원 thread `turn.presentations[]`"
  (이번 PR 이 `waiting_for_input` 이던 2번째 소스를 `execution.message` 로 교체하며 새로 명시)
  및 `spec/7-channel-web-chat/5-admin-console.md` §6 "표시-전용 presentation 노드 렌더" —
  > "버튼 없이 자동 진행하는 presentation 노드... 출력은 위젯이 `execution.message` SSE 이벤트([EIA §5.2](...))로 받아
  > 말풍선으로 렌더한다."
  두 문서 모두 `execution.message` 를 위젯이 실제로 구독·소비하는 EIA 표면으로 명시한다
  ([EIA §R18](../../spec/5-system/14-external-interaction-api.md#r18-executionmessage--표시-전용-presentation-노드-자동-진행-메시지-신설-결정-2026-06-25) ·
  §5.2 에 payload 정의됨, `eia-events.ts` 파서 확인).
- **상세**: `0-architecture.md` §3 은 "위젯이 사용하는 EIA 표면"의 단일 카탈로그를 자처하지만 `execution.message`
  행이 없다. `AI 메시지` 행은 `execution.ai_message`(+`presentations[]]`)만 가리키고, `execution.message`(표시-전용
  presentation 노드의 자동 진행 메시지, `ai_message` 와 별개 이벤트명)는 어디에도 등재되지 않는다. 이 표만 읽는
  독자는 위젯이 구독하는 SSE 이벤트 집합에서 `execution.message` 가 빠져 있다고 오인할 수 있다 — 특히 §3 은 "위젯은
  EIA inbound(REST+SSE)만 사용" 이라는 뒤이은 선언의 근거 표라 완결성이 기대되는 자리다. 실제로는 `1-widget-app.md`(같은
  target)와 EIA §R18 이 이 이벤트를 위젯 일반 동작(콘솔 미리보기 한정이 아님)으로 규정하고 있어 표와 본문 사이에
  간극이 생겼다.
- **제안**: `0-architecture.md` §3 표에 `표시 메시지 (자동 진행 presentation)` 류의 행을 추가 — `SSE execution.message` /
  참조 `EIA §5.2·§R18`. `AI 메시지` 행과 나란히 두되 "AI 가 생성한 메시지가 아니라 표시-전용 노드의 정적 표시" 라는
  구분을 §3 본문 안에 짧게 반영하면 §81 의 `ai_message`/`execution.message` 이중 소스 서술과도 정합된다.

### [INFO] origin/main 대비 브랜치 분기 — 동시 병합된 #899 (R7·§9 스코프 예외·소비처 미러)가 워크트리에 미반영

- **target 위치**: `spec/7-channel-web-chat/1-widget-app.md` (Rationale 섹션 끝), `spec/conventions/conversation-thread.md`
  §8.2 / §9 / frontmatter `code:` 목록.
- **비교 대상**: `origin/main` 커밋 `52f46f95f`/`1eda09081` ("docs(spec): PR #874 defer 문서 보강 — R7 신설·§9 위젯
  스코프 예외·conversation_thread 소비처 미러 (#899)", 2026-07-10 22:52~22:56) — 본 워크트리 브랜치의 시작점(`cc3dafa8c`,
  20:53)보다 늦게 main 에 병합됐다.
- **상세**: `origin/main` 은 (a) `1-widget-app.md` 끝에 헤더 세션 컨트롤(새 대화/대화 종료) booting 게이팅·
  graceful/cancel 분기·optimistic 종료를 Rationale 로 승격한 `### R7` 섹션, (b) `conversation-thread.md` §8.2 에
  "적용 surface 범위"(임베드 위젯은 §9.1/§9.2 강제 규약 예외) 문단과 §9 상단에 동일 취지의 blockquote, (c) 같은 문서
  frontmatter `code:` 목록에 `interaction.service.ts` 재등재를 추가했는데, 본 워크트리는 이 세 가지를 모두 갖고
  있지 않다(`cc3dafa8c` 시점부터 부재 — 이번 PR 이 삭제한 게 아니라 애초에 없었음). 두 변경은 서로 다른 PR 이 같은
  파일의 서로 다른 영역(우리 쪽은 §2/§3.1 표 행 + `## Rationale` 중간, #899 는 파일 말미 신규 섹션·frontmatter)을
  건드려 **텍스트 충돌은 없다** — `git merge-tree`/실제 `git merge origin/main` 시뮬레이션 결과 conflict 0 건, 양쪽
  내용이 모두 보존되는 것을 확인했다(재현: `git worktree add --detach <tmp> HEAD && cd <tmp> && git merge origin/main`).
  다만 이 상태로 그대로 push/PR 완료 시 리뷰어가 diff 만 보고 "R7·스코프 예외가 왜 사라졌나"로 오인할 소지가 있고,
  머지 방식이 fast-forward-불가·squash 등이면 수동 재적용이 필요할 수 있다.
- **제안**: 최종 통합 전에 `git rebase origin/main` (또는 merge) 1회를 거쳐 #899 의 R7·스코프 예외·`code:` 항목을
  흡수한 뒤 push — CRITICAL/WARNING 급 충돌은 아니므로 merge-coordinator 표준 절차로 충분.

## 검증 완료 — 충돌 없음 (참고)

이번 회차에 새로 변경/추가된 서술을 원본과 대조했으며 모두 정합했다:

- `1-widget-app.md` §2 presentation 행의 "렌더러는 두 shape 모두 수용" + `truncation` 흡수 서술 ↔ AI Agent
  [§7.10](../../spec/4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반) `PresentationPayload` type
  block(`{type,toolCallId,renderedAt,payload,truncation?}`), Presentation 공통
  [§10.4](../../spec/4-nodes/6-presentation/0-common.md#104-1mb-cap)(`output.{itemsTruncated|rowsTruncated}` 동등
  메타) — 문구·필드명까지 일치. 구현(`codebase/channel-web-chat/src/lib/presentation.ts` `asEnvelope`/
  `truncationMeta`)도 이 계약대로 `TRUNCATION_KEYS` 화이트리스트 병합.
- `conversation-thread.md` §2.1 신설 문단("표시물은 thread 에 영속되지 않는다... `source:'ai_assistant'` 한정")과
  `1-widget-app.md` §2/§3.1 의 "범위 제약"·"예외 — §2" 상호 참조가 정확히 맞물림(양방향 역참조 확인).
- `_product-overview.md` 비목표 신설 항목("표시-전용 presentation 노드 표시물의 새로고침 복원")이 `conversation-thread.md`
  §1.1 backend 5-source enum 확장 필요성을 정확히 인용(§7 v2 로드맵과 일관).
- `5-admin-console.md` §6 `execution.message` 서술(payload 예시·`{config,output}` flat envelope·`classifyPresentation`
  재사용)이 EIA [§5.2](../../spec/5-system/14-external-interaction-api.md#52-sse-이벤트-스트림--get-apiexternalexecutionsexecutionidstream)·
  [§R18](../../spec/5-system/14-external-interaction-api.md#r18-executionmessage--표시-전용-presentation-노드-자동-진행-메시지-신설-결정-2026-06-25)
  과 payload 필드까지 일치.
- 신규 요구사항 ID·엔드포인트·RBAC(`editor+`/`viewer+`) 재사용 없음 — 이번 회차는 신규 API 계약·데이터 모델·상태
  전이를 도입하지 않고 기존 표면(§7.10/§10.4/§R18)의 기술 정확도만 정정하는 범위였다.

## 요약

이번 `--impl-done` 회차의 실질 변경(presentation 복원 shape 정정 + `truncation` 흡수 코드)은 참조하는 모든 인접
spec(AI Agent §7.10, Presentation 공통 §10.4, conversation-thread §1.2/§2.1, EIA §5.2/§R18)과 문구 단위로 정합하고
신규 데이터 모델·API 계약·요구사항 ID·RBAC 충돌은 없다. 다만 두 가지를 조치 권장한다 — (1) 위젯이 실제 구독하는
`execution.message` 이벤트가 `0-architecture.md` §3 의 "EIA 매핑" 카탈로그 표에서 빠져 있어 그 표 자체의 완결성이
깨졌고(WARNING), (2) 브랜치가 동시 병합된 `origin/main` #899(R7·§9 스코프 예외·conversation-thread 소비처 미러)를
아직 흡수하지 못했다 — 텍스트 충돌은 없고 실제 병합 시뮬레이션도 clean 하므로 낮은 리스크지만 최종 통합 전 rebase
권장(INFO).

## 위험도

LOW
