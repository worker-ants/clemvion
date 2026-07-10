# Rationale 연속성 Check 결과

대상: `plan/in-progress/widget-presentation-restore.md`
비교 SoT: `spec/7-channel-web-chat/1-widget-app.md` §Rationale, `spec/4-nodes/6-presentation/0-common.md` §Rationale,
`spec/4-nodes/3-ai/1-ai-agent.md` §7.10/§12, `spec/conventions/conversation-thread.md` §1.1/§2.1/§4/§8.4,
`spec/5-system/14-external-interaction-api.md` §Rationale R17/R18.

## 검증한 사실관계 (원본 spec 직접 대조)

- `spec/7-channel-web-chat/1-widget-app.md:48` 의 "알려진 제약(Planned)" 문구는 `git log -S` 로 확인 시 PR #874
  (`f7c708842`) 가 도입했다. 같은 파일의 `## Rationale`(R4~R6) 어디에도 이 제약을 뒷받침하는 결정 항목이 없다 —
  즉 이 문구는 정식 Rationale 로 합의된 결정이 아니라 #874 작성 시점의 inline 서술이었다.
- 위젯의 `asEnvelope`/`classifyPresentation`(`codebase/channel-web-chat/src/lib/presentation.ts:106-134`)이
  `{config,output}` 와 `PresentationPayload{type,toolCallId,renderedAt,payload}` 두 shape 을 이미 처리하는
  코드는 PR #707(`3a9097303`, #874 이전)에서 도입됐다 — target 의 "문구가 #707 이후 이미 stale 했다" 는 주장과 일치.
- `spec/4-nodes/3-ai/1-ai-agent.md:966-971` (`PresentationPayload.truncation`)과
  `spec/4-nodes/6-presentation/0-common.md:312`("...top-level `presentations[i].truncation` 에 surface")가
  이미 `truncation` 을 `payload` 바깥 최상위 필드로 규정하고 있음을 확인 — target R3 의 "spec 은 이미 맞고 코드가
  못 따라간 것" 주장이 실제 spec 문언과 일치한다.
- `spec/conventions/conversation-thread.md:62`(`presentations?` 필드는 `source: 'ai_assistant'` 한정) +
  `§2.1`(standalone presentation 노드는 `presentation_user` source 로 `data` 만 push, `presentations` 는 set 안 함) +
  `§4 영속화`(durable park 스냅샷은 `context.conversationThread` 그대로) 를 종합하면, standalone 노드의
  `{config,output}` 표시물이 애초에 durable thread 에 들어간 적이 없다는 target §2/§R2 의 진단은 기존 spec 의
  자료구조 정의와 정합적이다 — 새로 만들어내는 제약이 아니라 기존 아키텍처 경계를 정확히 기술한 것.
- `spec/5-system/14-external-interaction-api.md` R18(결정 2026-06-25)은 표시-전용 presentation 노드의 출력이
  `execution.message` **SSE 전용** 이벤트로만 발행됨을 명시적으로 결정한 항목이고, R17 의 2026-07-09 재조정은
  `conversationThread`(텍스트/구조화 turn 히스토리)만 durable 노출 대상으로 확장했다 — 두 결정 모두 standalone
  노드 표시물을 durable 표면에 포함시키겠다는 약속을 한 적이 없다. target 의 R2("확장은 별도 결정 사안")는 이
  기존 경계와 충돌하지 않는다.

## 발견사항

- **[INFO]** 로드맵 미러 등재 선례와의 정합 재검토
  - target 위치: `plan/in-progress/widget-presentation-restore.md` §4-1 변경안 + `## Rationale` R2
  - 과거 결정 출처: `spec/2-navigation/14-execution-history.md` Rationale R-6 ("v2 항목은 저장소 선례(Graph
    RAG·conversation-thread v2)대로 `0-overview.md §6.3` 로드맵에 미러 등재해 추적한다") + `spec/0-overview.md §6.3`
    (Graph RAG 후속, cross-node ConversationThread 뷰 EH-DETAIL-12 가 이미 그 패턴으로 등재됨)
  - 상세: 프로젝트에는 "v1 범위 밖으로 남기는 기지(既知) 갭은 §6.3 로드맵에 미러 등재해 추적한다"는 확립된 선례가
    있다. target R2 는 "standalone 노드 복원을 구현할 갭으로 등재하지 않는다"고 명시적으로 결정하는데, 이 결정
    자체는 근거가 있으나(§1.1 5-source enum 확장 비용) 로드맵 미러 등재 여부는 다루지 않는다. 향후 재확장 여지가
    있는 알려진 제약이라는 점에서 EH-DETAIL-12 선례와 성격이 유사하다.
  - 제안: R2 에 "본 갭은 §6.3 로드맵 등재 대상이 아님(이유: 사용 빈도·요청 부재 등)"을 한 줄 덧붙이거나, 선례를
    따라 `0-overview.md §6.3` 에 한 줄 등재해 추적성을 갖추는 쪽 중 하나를 planner 가 명시적으로 선택할 것을 권장.
    (차단 사유 아님 — 두 선택 모두 정합적이며 현재는 암묵적으로 "등재 안 함"만 채택된 상태.)

- **[INFO]** §3.1 "전체 히스토리 복원" 표현과 §2 신규 caveat 의 병치 시 오독 여지
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "페이지 새로고침/이동" 행 (target 이 수정하지
    않는 기존 텍스트) vs §2 presentation 행 (target 4-1 이 수정 예정)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` Rationale R17 "`conversationThread` 노출로의
    재조정(2026-07-09)" — "durable thread 는 이미 무손실 영속돼 있는데도 노출 표면이 없어 복원 불가였다 ... reload
    복원을 buffer 무관·재시작 무관으로 견고화"
  - 상세: §3.1 은 "GET /:id ... 전체 히스토리 복원"이라는 표현을 쓰는데, 이는 문맥상 "5분 SSE buffer 안에서만
    복원 가능한 부분"과 대비되는 완전성(temporal completeness)을 뜻한다. 그러나 target 이 §2 에 추가할
    "standalone 노드 표시물은 복원 대상 아님" caveat 과 나란히 읽으면, 독자가 §3.1 의 "전체"를 "모든 콘텐츠
    타입 포함 완전 복원"으로 오독할 소지가 생긴다. 이는 기존 Rationale 을 위반하는 것은 아니고, target 이
    도입하는 정정과 기존 문구 사이의 표현 정합성 문제.
  - 제안: §3.1 해당 행 말미에 "(standalone presentation 노드 표시물의 예외는 §2 참조)" 같은 짧은 상호 참조를
    추가하면 완전성. 필수는 아님.

## 요약

target 이 제시하는 3개 Rationale(R1 spec 정정, R2 standalone 미영속 갭 비등재, R3 truncation 코드 수정)은 모두
기존 spec 문언(`ai-agent.md §7.10`, `0-common.md §10.4`, `conversation-thread.md §1.1/§2.1/§4`, `EIA §R17/R18`)과
직접 대조한 결과 실제 정의·아키텍처 경계와 정합했다. 제거하려는 "알려진 제약(Planned)" 문구는 정식 Rationale
항목이 아니라 #874 시점의 부정확한 inline 서술이었음을 git 이력으로 확인했고, standalone 노드가 durable thread
에 영속되지 않는다는 진단도 `presentations?` 필드가 `ai_assistant` source 한정이라는 기존 자료구조 정의와
일치한다. 기각된 대안의 재도입이나 합의 원칙 위반, 무근거 결정 번복은 발견되지 않았다. 다만 (a) 알려진 v1-scope
제약을 §6.3 로드맵에 미러 등재할지 여부를 명시하지 않은 점, (b) §3.1 의 기존 "전체 히스토리 복원" 표현이 §2 의
신규 caveat 과 병치될 때 발생할 수 있는 표현상 오독 여지, 두 가지를 INFO 로 제안한다.

## 위험도
LOW
