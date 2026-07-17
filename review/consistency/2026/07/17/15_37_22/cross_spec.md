# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat/`

## 검토 방법
`spec/7-channel-web-chat/0-architecture.md`·`1-widget-app.md`·`2-sdk.md`·`3-auth-session.md`·`4-security.md`·`5-admin-console.md`
(전 6개 문서, 모두 `status: implemented`) 전체와, 이들이 outbound 로 참조하는 다른 spec 영역 — EIA(`5-system/14-external-interaction-api.md`)·
Webhook(`5-system/12-webhook.md`)·데이터 모델(`1-data-model.md`)·실행 엔진(`5-system/4-execution-engine.md`)·AI Agent(`4-nodes/3-ai/1-ai-agent.md`)·
Presentation 공통(`4-nodes/6-presentation/0-common.md`)·Conversation Thread(`conventions/conversation-thread.md`)·
interaction-type-registry(`conventions/interaction-type-registry.md`)·인증(`5-system/1-auth.md`)·Chat Channel(`5-system/15-chat-channel.md`)·
API 규약(`5-system/2-api-convention.md`)·swagger 규약(`conventions/swagger.md`)·내비게이션(`2-navigation/9-user-profile.md`, `2-trigger-list.md`, `_product-overview.md`)·
i18n-userguide(`conventions/i18n-userguide.md`) — 를 대상 anchor·claim 단위로 실제 파일 내용과 대조했다. impl-done 지침에 따라 코드 근거가
필요한 항목은 워크트리 절대경로로 재확인했다(`use-widget.ts` `handleEiaEvent`/`seedWaitingFromStatus`, `webchat-idle-reaper.service.ts`,
`use-widget-eager-start.test.ts` 의 인용 테스트명 등).

diff-base(`origin/main`)로 단순 `git diff` 하면 target 범위 밖의 5개 파일(`conversation-thread.md` 등)에서 큰 변경이 잡히므로,
`git merge-base HEAD origin/main` 으로 이 branch 의 실제 fork point 를 확인해 "이 branch 가 실제로 만든 변경"과 "origin/main 이
fork 이후 독자적으로 전진해 생긴 표면적 diff"를 분리했다 (근거는 아래 발견사항 참조).

---

## 발견사항

- **[INFO]** `origin/main` 대비 관측되는 `conversation-thread.md` 외 4개 파일의 diff는 이 target 의 변경이 아님 (stale fork base — 실질 충돌 아님)
  - target 위치: 해당 없음 (target 문서 6개 파일 자체는 이 4~5개 파일을 건드리지 않음)
  - 충돌 대상(외견상): `spec/conventions/conversation-thread.md`, `spec/conventions/interaction-type-registry.md`,
    `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/9-rag-search.md`
  - 상세: `git diff origin/main..HEAD -- spec/`로 보면 위 5개 파일에서 `rag` `ConversationTurnSource`(frontend union 7값→6값,
    `Inv-9`·`CT-S18~20`·§8.6 등)가 통째로 "제거"된 것처럼 보인다. 그러나 `git merge-base HEAD origin/main`
    (`12ceee587f36cf1c5c13f1cadad77071b9049579`) 기준으로 재대조하면 `git diff <merge-base>..HEAD -- <각 파일>` 이 전부 빈 diff다 —
    이 branch(`claude/webchat-replay-unavailable-consume`)의 27개 커밋 중 이 5개 파일을 건드린 커밋은 **0개**다. 즉 origin/main 이
    이 branch 의 fork 시점 이후 별도 PR(`rag` conversation source 기능 추가 — 브랜치명 정황상 `claude/rag-tool-row-distinct-ui-*`)로
    먼저 전진했을 뿐이며, diff-base 로 지정된 `origin/main` 이 fork point 보다 최신이라 생긴 표면적 diff다(선행 사례:
    `.claude/docs`에 기록된 "ensure-worktree stale base"·"consistency-check main-baseline FP" 패턴과 동형).
    target(`spec/7-channel-web-chat/`)이 이 기능을 되돌리거나 그 정의와 충돌하는 바는 없다 — 두 버전(rag 포함/미포함) 모두에서
    "위젯이 수신하는 conversation turn `source` 는 backend enum 5값뿐"이라는 결론이 동일하므로(§9.1 스코프 예외 blockquote의
    두 diff variant 모두 "위젯이 수신하는 도메인은 backend enum 5값뿐이다"로 끝남), `1-widget-app.md §2`(turn `source`→말풍선
    role 2-way 축약)·`conversation-thread.md §2.1`(durable thread 의 `presentations[]` 는 `source:'ai_assistant'` 한정)이
    인용하는 사실은 main 이 최신 상태로 merge 돼도 깨지지 않는다.
  - 제안: target 문서 수정 불요. PR 병합 전 `origin/main` 기준 rebase(또는 동등 절차)로 fork point 를 최신화하면 이후 diff 가
    이 branch 의 실제 변경분(`1-widget-app.md` §3.1 `replay_unavailable` 절 하나)으로 좁혀져 리뷰 잡음이 사라진다. 다른
    orchestrator sub-agent(특히 diff 를 그대로 신뢰하는 유형)가 이 5개 파일을 target 의 "회귀/충돌"로 오판하지 않도록 본
    검토 결과를 공유할 것을 권고.

---

## 검증하여 충돌 없음을 확인한 주요 교차참조 (참고)

아래는 CRITICAL/WARNING 후보로 점검했으나 실제 대조 결과 정합함을 확인한 항목이다(음성 결과도 검토 근거로 기록):

| 관점 | target 주장 | 대조 대상 | 결과 |
|---|---|---|---|
| API 계약 | `POST /api/hooks/:path` 202 응답이 `TransformInterceptor`로 `{data}` 래핑됨 | `5-system/2-api-convention.md:359` | 일치 |
| API 계약 | EIA `execution.replay_unavailable` 신호 후에도 SSE 연결·세션 유지, `getStatus` 병행 보정 | `5-system/14-external-interaction-api.md` §R-replay-unavailable(1247행) | 일치. 신규 "스냅샷이 이미 terminal 이면 종료 확정" 절도 EIA 의 일반 서술과 모순 없음 |
| 데이터 모델 | `Workspace.settings.interactionAllowedOrigins: string[]?` | `1-data-model.md:95` | 일치 (CORS·임베드 allowlist 동일 키 재사용 서술도 정합) |
| RBAC | 워크스페이스 설정(임베드 allowlist) 편집 = Admin+ | `2-navigation/9-user-profile.md` §4.2·§4.3(227~253행) | 일치 |
| RBAC | 웹채팅 콘솔 인스턴스 생성/삭제/외형 편집 = editor+, 조회 = viewer+ | `2-navigation/2-trigger-list.md` §2.3.1·§4.1, R-15 | 일치 |
| 요구사항 ID | `NAV-WC-01~06` 6개 전부 정의·✅ | `2-navigation/_product-overview.md:217-222` | 일치, 타 문서 중복 정의 없음(정의 1곳 + 참조 2곳만) |
| 요구사항 ID | `EIA-IN-02`(retry_last_turn 외부 미노출)·`EIA-IN-12`(410 Gone)·`EIA-AU-04`(jti blacklist)·`EIA-RL-07`(idle-wait reaper) | `5-system/14-external-interaction-api.md` | 전부 존재·의미 일치. `EIA-RL-07`/§R19 는 `1-widget-app.md §R6·§R9` 를 되짚어 인용하는 양방향 cross-ref |
| 요구사항 ID | `WH-SC-01`(공개 webhook 무인증)·`WH-SC-05`(rate-limit)·`WH-SC-09`(ip_whitelist fail-closed)·`WH-NF-02`(32KB/1MB 분리 임계) | `5-system/12-webhook.md` | 전부 일치. `WH-SC-05` 항목 자체가 `4-security.md §R6` 를 SoT 로 역참조 |
| 계층 책임 | 위젯 = EIA 의 "client" 케이스(EIA §2 표 4행), facade/신규 listener 미신설(§R10 단일 sink 미침해) | `5-system/14-external-interaction-api.md` §2, §R10(1041행) | 일치. Chat Channel(in-process adapter)과의 대비 서술도 EIA §R10 본문과 정합 |
| 상태 전이 | multi_turn 은 첫 사용자 메시지 전 LLM 미호출, 즉시 `waiting_for_input` 진입(`firstMessage` 미소비) | `4-nodes/3-ai/1-ai-agent.md` §6.2(426행) | 일치 |
| API 계약 | presentation truncation 메타(`{rows\|items}Truncated/TotalCount`)를 `PresentationPayload.truncation` 에서 흡수 | `4-nodes/6-presentation/0-common.md` §10.4(312행) | 일치 |
| 명명 경계 | 위젯 `locale`(UI chrome 언어) vs Chat Channel `languageLocale`(서버 발신 메시지 언어) 별개 개념 | `5-system/15-chat-channel.md` §4.1 | 일치 — 동명이의 혼동을 target 이 명시적으로 분리 서술 |
| i18n 스코프 | 위젯 로컬 catalog 는 메인 앱 dict 시스템과 물리적으로 분리되나 ko/en parity 원칙은 계승 | `conventions/i18n-userguide.md` §적용 범위(38~50행) | 일치. 날짜(2026-07-12 EN 활성)까지 정합 |
| IP 미식별 처리 | 공개 webhook rate-limit = 단일 공유 버킷 완화(D-12), `ip_whitelist` = fail-closed | `5-system/1-auth.md` Rationale 2.3.B m-3(671·677행) | 일치. `4-security.md §R6` 를 SoT 로 역참조하는 양방향 cross-ref |
| 데이터 모델 | 웹채팅 콘솔 인스턴스 생성 시 `Trigger.workflow_id` NOT NULL 전제 | `1-data-model.md` §2.8(229행) | 일치 (`?` 미부여 = NOT NULL 컨벤션과 일치) |
| impl 정합 | `execution.replay_unavailable` 소비 분기(`handleEiaEvent`→`seedWaitingFromStatus`) 신규 구현 claim | `codebase/channel-web-chat/src/widget/use-widget.ts`(절대경로 확인), `plan/in-progress/spec-sync-external-interaction-api-gaps.md:20`(2026-07-17 완료 기록) | 코드·plan 트래킹 모두 target 의 서술과 일치 |

---

## 요약
`spec/7-channel-web-chat/` 6개 문서 전체와 이들이 인용하는 EIA·Webhook·데이터 모델·실행 엔진·AI Agent·Presentation 공통·
Conversation Thread·인증·Chat Channel·API/Swagger 규약·내비게이션·i18n-userguide 등 13개 이상의 외부 spec 파일을 anchor
단위로 대조한 결과, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 모두에서 실질적 충돌을 발견하지 못했다.
특히 CORS(`interactionAllowedOrigins`)·RBAC(Admin+/editor+/viewer+)·요구사항 ID(`NAV-WC-*`, `EIA-*`, `WH-*`)·IP 미식별 처리
정책 등 다수 항목이 대상 spec 쪽에서도 `[7-channel-web-chat ...]` 로 **역참조**하는 양방향 cross-reference 로 유지되고 있어
drift 감지 구조 자체가 견고하다. 이번 검토의 실제 diff 대상인 `1-widget-app.md`(`execution.replay_unavailable` 소비 배선
완료 서술)도 EIA `§R-replay-unavailable`·구현 코드(`use-widget.ts`)·plan 트래킹 파일 3자와 모두 정합한다. 유일하게 보고할
사항은 `origin/main` 비교 시 표면적으로 드러나는 5개 무관 파일의 diff(다른 PR 이 먼저 merge 된 stale fork base 효과)이며,
이는 target 의 실제 변경이 아니고 병합에도 영향이 없음을 git 근거로 확인했다(INFO 처리, rebase 권고).

## 위험도
NONE
