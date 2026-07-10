# Plan 정합성 검토 — spec-draft-pr874-deferred-docs.md

검토 대상: `plan/in-progress/spec-draft-pr874-deferred-docs.md` (PR #874 defer 된 spec-only 문서 보강 3건)
대상 spec: `spec/7-channel-web-chat/1-widget-app.md`, `spec/conventions/conversation-thread.md`

## 발견사항

- **[WARNING]** host `resetSession` booting 중 중복 webhook 가드 — backlog 명시뿐, 등재된 plan 없음
  - target 위치: draft `### (1) 1-widget-app.md — R7 신설` 본문 괄호 문장 — "host `resetSession` 은 위젯 UI 를 거치지 않아 이 게이트 밖이며, 중복 webhook 잔여 위험은 §3.1 "새 대화" 행의 Planned 로 남긴다."
  - 관련 plan: 없음. `spec/7-channel-web-chat/1-widget-app.md` §3.1 "새 대화" 행 자체가 이미(사전 존재, PR #874 머지분) "host-API 측 가드/드레인은 backlog" 라고 명시하지만, `plan/in-progress/**` 전체를 `resetSession` 으로 grep 해도 이 draft 파일 자신 외에는 아무 plan 도 이 항목을 언급하지 않는다. `1-widget-app.md` frontmatter 는 `status: implemented` + `pending_plans` 필드 자체가 없다(§spec-impl-evidence 컨벤션상 `implemented` 는 pending_plans 의무 없음).
  - 상세: `spec/conventions/spec-impl-evidence.md` R-5 는 "spec 가 자기를 책임지는 plan 을 가리키지 않으면 텔레그램 chat-channel 케이스처럼 '어떤 plan 도 책임지지 않는 빈 약속'으로 영구 누락된다"는 근거로 역방향 링크(`pending_plans`)를 의무화했다. 이 항목은 그 패턴과 동형이다 — spec 본문·이제는 Rationale(R7)까지 명시적으로 "Planned/backlog" 라 부르는데, 어떤 in-progress plan 체크리스트에도 항목이 없어 추적 주체가 없다. draft 는 이 gap 을 **새로 만든 것이 아니라 재인용**(reinforce)한 것이라 draft 자체를 차단할 사유는 아니지만, R7 신설이 이 gap 의 탐색성을 spec Rationale 레벨로 올리는 시점이므로 plan 등재도 같이 하는 편이 자연스럽다.
  - 제안: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (이미 EIA 스펙의 유일한 `pending_plans` 대상이며, 같은 파일에 이미 "웹챗 위젯 클라이언트 소비" 후속 항목이 nested 로 있어 구조가 맞음)에 신규 체크리스트 항목으로 등재 권장. 또는 host-API/SDK 레벨 이슈이므로 `spec/7-channel-web-chat/2-sdk.md` 관련 별도 항목으로도 가능.

- **[WARNING]** EIA §R17 잔여 `nodeOutput` 키-allowlist — spec 본문 "잔여 항목" 표기뿐, 등재된 plan 없음
  - target 위치: draft `### (3) conversation-thread.md — frontmatter code: + §4 표 park 행 비고` (이 변경 자체가 직접 언급하진 않지만, 위임 대상인 conversation-thread.md §8.4 "소비처 갱신" 문단과 EIA §R17 이 이 gap 을 "후속 하드닝 항목"/"잔여" 로 명시)
  - 관련 plan: 없음. `spec/5-system/14-external-interaction-api.md` 는 `status: partial` + `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]` 를 갖고 있어(정상적으로 R-5 를 만족) 이 plan 이 유일한 책임 주체인데, 해당 plan 파일을 읽어보면 이 R17 nodeOutput allowlist 항목이 체크리스트에 없다. R17 은 2026-06-25 결정, 해당 plan 은 그 뒤로도(2026-07-08) 다른 항목이 갱신됐으나 이 항목만 누락된 채로 남아 있다.
  - 상세: `14-external-interaction-api.md` 가 `status: partial` 이므로 이 spec 의 미구현 표면은 전부 `pending_plans` 로 지정된 plan 파일 하나로 추적돼야 한다는 것이 컨벤션 의도(R-5). 이 항목이 spec 본문에는 있지만 plan 체크리스트에 없으면, `partial→implemented` 승격 판정("모든 pending_plans 가 complete 로 이동하면 승격")이 이 항목을 빠뜨린 채 조기에 내려질 위험이 있다(gate 는 plan 파일 존재/이동만 보고 내용 완결성은 사람이 판단).
  - 제안: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "미구현 항목" 목록에 "nodeOutput 일반 키 allowlist (R17)" 체크리스트 신설 권장.

- **[INFO]** presentation 2-way role 매핑(`presentation_user`·`ai_user`→user 외 assistant) — 이미 구현·와이어-정확 테스트 완료, 잔여 gap 아님
  - target 위치: draft `### (2) conversation-thread.md §9 서두 — 채널 위젯 스코프 예외`
  - 관련 plan: 없음(불필요). `codebase/channel-web-chat/src/lib/conversation.ts` `roleOf` + `conversation.test.ts` "wire source → role 매핑" 테스트가 백엔드 5-source(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`) 를 정확히 반영해 이미 통과 중이다. MEMORY 의 "위젯 테스트 fixture 가 실제 wire 아님 오통과" 언급은 PR #874 리뷰 과정의 교훈(당시 발견·수정)이지 현재 잔존 gap 이 아니다. draft 의 §9 예외 서술과 실제 구현이 일치함을 확인 — 등재 불필요.
  - 제안: 조치 불요. (참고용 기록)

- **[INFO]** `execution.replay_unavailable` 위젯 소비 분기 — 이미 등재 확인
  - target 위치: draft 배경 설명 대상 아님(직접 인용 없음, 검토 지시 항목이라 확인)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "SSE 버퍼 만료 시 `execution.replay_unavailable` emit" 항목 아래 이미 `- [ ] **(후속) web-chat 위젯 클라이언트 소비**` 로 정확히 등재돼 있다(`use-widget.ts handleEiaEvent` 에 case 부재, channel-web-chat 범위로 명시).
  - 상세: draft 의 세 변경 어느 것도 이 항목과 충돌하거나 무효화하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 동시 수정 대기 plan 부재 확인
  - target 위치: 전체 draft
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md`(EIA 대상, widget-app.md/conversation-thread.md 를 직접 수정 예정 항목 없음 — nested 항목 하나만 channel-web-chat 코드 변경 예고, spec 문서 자체 수정 예고 아님), `spec-sync-websocket-protocol-gaps.md`(대상 spec 이 `6-websocket-protocol.md`, 무관), `spec-sync-common-gaps.md`(대상 spec 이 `4-nodes/2-flow/0-common.md`, 무관), `chat-channel-discord-gateway.md`/`chat-channel-slack-socket-mode.md`/`chat-channel-visual-ssr-png.md`(모두 별도 시스템인 `chat-channel`/외부 봇 채널 대상이며 임베드 웹채팅 위젯 `channel-web-chat` 과 무관 — 이름 유사성으로 인한 혼동 소지만 확인, 실제 참조·섹션 겹침 없음).
  - 상세: `plan/in-progress/**` 전수를 `1-widget-app.md`/`conversation-thread.md`/`widget-app`/`conversation-thread` 로 grep 한 결과 이 draft 파일 자신 외에 어떤 plan 도 두 대상 spec 문서를 언급하지 않는다. 같은 절을 동시에 고치려는 미완결 plan 은 없음.
  - 제안: 조치 불요.

- **[INFO]** draft frontmatter 스키마 — plan-lifecycle.md §4 정합
  - target 위치: draft frontmatter (라인 1-10)
  - 관련 plan: `.claude/docs/plan-lifecycle.md` §4 (Frontmatter 스키마) / §5 Gate C
  - 상세: `worktree: spec-deferred-docs-42d3b6`(현재 작업 디렉토리와 일치) · `started: 2026-07-10`(ISO) · `owner: project-planner` 세 필수 필드 모두 존재. `spec_impact` 는 YAML 리스트(`- spec/7-channel-web-chat/1-widget-app.md` / `- spec/conventions/conversation-thread.md`)로 정확히 표기돼 있어 Gate C 의 흔한 실패형(bare string, 빈 배열)에 해당하지 않는다. 다만 `spec_impact` 는 §4 설명상 "완료 시점 필드"(Gate C, `complete/` 이동 시 강제)이며 in-progress 단계 의무는 아니다 — 지금 미리 채워둔 것은 위반이 아니라 조기 완비(harmless)이며, 완료 이동 시 그대로 유지하면 Gate C 를 통과한다. `title`/`spec_area` 추가 필드도 "추가 필드 허용" 조항에 부합.
  - 제안: 조치 불요. (완료 이동 시 체크리스트 전항목 `[x]` 확인만 하면 됨)

## 요약

draft 의 세 변경(R7 신설·§9 스코프 예외·frontmatter+§4 표 비고)은 모두 이미 구현·머지된 동작의 서술 승격/정합화이며 신규 결정이 아니다. `plan/in-progress/**` 전수 조사 결과 draft 가 건드리는 두 spec 문서의 같은 절을 동시에 고치려는 다른 plan 은 없고(`spec-sync-external-interaction-api-gaps.md`/`spec-sync-websocket-protocol-gaps.md`/`spec-sync-common-gaps.md`/`chat-channel-*` 모두 대상 spec 이 다르거나 겹치지 않음), draft 를 차단할 미해결 선행 plan 도 없다. 다만 draft 가 인용하는 두 개의 spec-declared 잔여/backlog 항목 — (a) host `resetSession` 의 booting 중 중복 webhook 가드, (d) EIA §R17 `nodeOutput` 일반 키-allowlist — 은 실제로 어떤 `plan/in-progress/**` 파일에도 등재돼 있지 않아 spec-impl-evidence 컨벤션의 "빈 약속 영구 누락" 위험 패턴과 동형이다. 나머지 두 항목((b) presentation role 매핑, (c) `execution.replay_unavailable` 위젯 소비)은 각각 이미 구현-완료·이미 plan 등재로 확인되어 문제 없다. draft frontmatter 는 plan-lifecycle §4/Gate C 스키마에 정합한다.

## 위험도

MEDIUM
