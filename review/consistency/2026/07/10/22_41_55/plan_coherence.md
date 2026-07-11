# Plan 정합성 Check — spec/7-channel-web-chat/ (--impl-prep)

## 조사 방법

`plan/in-progress/**` 전체(40개 파일, `node-output-redesign/` 서브폴더 포함)를 대상으로 `web-chat`/`widget`/
`presentation`/`conversation-thread`/`conversationThread`/`truncat` 키워드로 1차 스캔 후, 교집합이 나온 6개
plan(`ai-agent-tool-connection-rewrite.md`, `chat-channel-visual-ssr-png.md`,
`competitive-analysis-n8n-flowise.md`, `node-output-redesign/{README,ai-agent,table,carousel,chart,template}.md`,
`rag-dynamic-cut.md`, `spec-sync-external-interaction-api-gaps.md`)를 라인 단위로 대조했다. 추가로 target 이
참조하는 `@workflow/web-chat`·`WEB_CHAT_WIDGET_ORIGINS`·`interactionAllowedOrigins`·`embed-config`·
`wc:command`/`wc:boot`·`resetSession` 등 SDK/보안 표면 키워드로 재스캔했으나 이들을 다루는 다른 in-progress
plan 은 없었다(0건). `spec/7-channel-web-chat/` 자체의 in-progress 대응 plan 은 `widget-presentation-restore.md`
(본 target 변경의 근원 plan, 이미 spec 파트는 커밋 `28a358375` 로 반영됨 — §4-2 developer 후속만 미체크)뿐이다.

target 은 이미 커밋된 상태(`28a358375` "웹채팅 위젯 presentation 복원 제약 정정")이며, 본 점검은 그 커밋
직전 세션(`review/consistency/2026/07/10/22_27_45/`)의 plan_coherence 재판정을 독립적으로 재수행한 것이다.
직전 세션은 다른 in-progress plan 과의 실질 충돌·중복·선행조건 훼손 **없음**(NONE)으로 판정했었다 — 아래는
그 판정을 라인 단위 재검증한 결과다.

## 대조 결과

1. **`node-output-redesign/{table,carousel,chart,template}.md`의 미해결 항목** — 전부 필드 레벨 미세 보강
   (`buttonItemMap` 인덱스 테스트, `sanitizeUrl` scheme 확장, `chartType` schema/handler 불일치, `groupBy`
   다중시리즈, template `outputFormat` fallback)이며, target 이 의존하는 presentation 노드 `{config,output}`
   top-level envelope 구조 자체를 바꾸는 항목은 없다. `table.md` 의 `output.rendered` 폐기(D5)는 이미 완료돼
   target 의 "표시-전용 노드 envelope" 서술과 충돌하지 않는다.

2. **`ai-agent-tool-connection-rewrite.md`** — `tool_*` 일반 도구 결과의 ConversationThread push 정책(`ai_tool`
   source 재사용 vs 신규 `tool_call` source)이 "conversation-thread.md v2 에서 결정" 으로 미확정 상태다. target
   이 conversation-thread.md §2.1 에 추가한 "표시물은 §7 v2 검토 사안" 서술과 같은 성격(엔진 5-source 확장을
   v2 로 미룸)이라 **정합적으로 병존** — 두 plan 모두 동일한 5-source enum 확장 축을 건드리지 않고 defer 한다는
   점에서 상호 모순이 아니다. `render_*` 접두어와 `tool_*` 접두어는 dispatcher 분류 순서상 별도 단계라 이름
   충돌도 없다.

3. **`spec-sync-external-interaction-api-gaps.md`** — `execution.replay_unavailable` 위젯 클라이언트 미배선
   (no-op) 항목이 이미 후속(`web-chat 범위 — 별도`)으로 명시돼 있고, target(1-widget-app.md §3.1)의 "소비 분기는
   아직 미배선" 서술과 **정확히 일치**한다. target 이 이 항목의 상태를 왜곡하거나 앞서가지 않는다.

4. **`chat-channel-visual-ssr-png.md`** — Telegram 채널의 presentation `nodeOutput.payload` 렌더 확장(별도
   소비자, `codebase/backend/.../telegram-message.renderer.ts`)으로 target(web-chat 위젯)과 소비 경로가
   달라 겹치지 않는다.

5. **`competitive-analysis-n8n-flowise.md`** — "conversation thread 는 5-source 만 공유, 일반 노드 출력은
   thread 밖" 서술이 이미 존재해 target 이 conversation-thread.md §2.1 에 추가한 규칙과 **기존 통념을 재확인**
   하는 방향이다(신규 결정 아님).

6. **`widget-presentation-restore.md` 자신의 §4-2(developer 후속, 미체크)** — `asEnvelope` 의
   `PresentationPayload.truncation` 흡수 + 회귀 테스트는 아직 미착수 상태이며, target spec 은 이를 "코드가
   기존 spec(0-common.md §10.4)을 못 지킨 것"으로 정확히 프레이밍해 새 결정을 요구하지 않는다 — 후속 개발
   착수 시 별도 `--impl-prep` 게이트만 통과하면 된다(선행조건 없음).

## 발견사항

- **[INFO]** `conversation-thread.md` §2.1 신설 문장이 "확장은 §7 v2 검토 사안"이라 명시하지만, §7 "v2 로드맵"
  리스트 자체에는 대응 bullet 이 없다.
  - target 위치: `spec/conventions/conversation-thread.md` §2.1 (target payload 밖 파일이나 같은 커밋 `28a358375`)
  - 관련 plan: 없음 — `plan/in-progress/**` 에 "conversation-thread v2" 를 추적하는 별도 plan 문서가 존재하지
    않고, §7 자체가 spec 인라인 backlog(진행 중 plan 아님)라 엄밀히는 plan_coherence 범위 밖(cross_spec 영역과
    중첩)이다. 다만 향후 §7 로드맵을 훑어 착수 항목을 고르는 작업자가 이 gap 을 놓칠 위험이 있어 참고로 남긴다.
  - 상세: §2.1 인라인 서술만으로는 §7 리스트를 순회하는 사람이 이 항목을 발견하지 못한다.
  - 제안: 필수 아님(직전 세션 WARNING 1 의 권고 "§2.1 **또는** §7" 중 §2.1 을 택한 것으로 이미 충족) — 원한다면
    §7 에 1줄 bullet ("표시-전용 presentation 노드 표시물의 thread 영속 — §2.1 참조") 추가로 완결성 강화 가능.

## 요약

`spec/7-channel-web-chat/` 전 영역(6개 문서)과 `plan/in-progress/**` 전체를 대조한 결과, target 이 다른 plan 의
미해결 결정을 우회하거나 충돌하는 지점, target 이 가정하는 사전 조건이 아직 해소되지 않은 지점, target 변경이
무효화하거나 신설을 요구하는데 반영되지 않은 후속 항목 — 세 관점 모두에서 실질 문제를 찾지 못했다. 가장 근접한
후보였던 `node-output-redesign/*`(presentation 노드 output 필드 레벨 잔여 항목)와 `ai-agent-tool-connection-rewrite.md`
(conversation-thread v2 push 정책 미확정)는 target 이 의존하는 구조(envelope shape·5-source 모델)를 건드리지
않거나 동일한 defer 축에서 병존한다. `spec-sync-external-interaction-api-gaps.md` 의 위젯 관련 후속 항목은
target 서술과 정확히 일치해 왜곡이 없다. 유일한 관찰은 conversation-thread.md 내부 §2.1↔§7 상호참조 완결성에
관한 INFO 1건으로, 이는 plan 정합성보다 spec 자기정합성(cross_spec)에 더 가깝고 차단 사유가 아니다.

## 위험도
NONE
