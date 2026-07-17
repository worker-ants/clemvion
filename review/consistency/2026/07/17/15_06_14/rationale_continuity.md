# Rationale 연속성 검토 결과

> 검토 대상: `plan/in-progress/is-conversation-output-restructure.md`
> 비교 대상: `spec/conventions/interaction-type-registry.md` `## Rationale` (§4) 외 관련 spec Rationale 다수
>
> **선행 메모**: `prompt_file` 에 embed 된 target 텍스트는 이 plan 의 초기 스냅샷으로 보이며(E-6/E-3b/개정된 Phase 1 이 빠져 있음), 워크트리 디스크상의 현재 파일은 그보다 상당히 더 진행된 버전이다(특히 `## 추가 발견`, `옵션 B 채택`, `E-6`, `E-3b`, `## 결정 기록` 섹션이 이미 (a)·(b) 지적사항 다수를 자체 해소해 두었다). 아래 검토는 **디스크상의 현재 파일**(2026-07-17 시점 최신) 기준으로 수행했다.

## 발견사항

- **[WARNING]** E-6 이 작성할 `interaction-type-registry.md:125` 정정문이 "어느 가드가 죽어있었는지" 를 부정확하게 일반화할 위험
  - target 위치: `plan/in-progress/is-conversation-output-restructure.md` §"추가 발견" (L46-L67), E-6 항목 2 (L265)
  - 과거 결정 출처: `spec/conventions/interaction-type-registry.md` `## Rationale`(§4, L113-125) — "1. 매트릭스가 SoT, 2. AST 가드(빌드 단계 grep 비교), 3. TypeScript exhaustive switch(컴파일러 단계)" 의 **3중 가드**로 회귀를 "영구히 차단한다" 고 명시
  - 상세: 반증 자체(`const _t: ReadonlyArray<T> = VALUES` 는 `VALUES ⊆ T` 만 검사하고 `T ⊆ VALUES` 는 검사하지 않는다)는 **직접 재현해 검증했고 정확하다** — 배열 공변(covariant) assignability 상 타입에 새 멤버가 추가돼도 기존 리터럴 배열은 여전히 대입 가능해 컴파일이 통과한다. 다만 target 의 표현("3중 중 컴파일타임 축")은 **§4 의 가드 #3(TS exhaustive switch)** 을 가리키는 것으로 오독될 수 있다. 실측 결과 가드 #3 은 실제로 건재하다 — 예: `use-execution-events.ts` 는 `assertNever` 를 쓰는 진짜 switch 문(`WaitingInteractionType` 소비처 (a))이고, `ConversationTurnSource` 의 `threadTurnsToConversationItems` switch 도 동일 패턴으로 건재하다(§2.1 L80, `const _exhaustive: never = turn.source`). 반면 실제로 깨진 것은 **가드 #2(AST/grep 가드)가 내부적으로 의존하는, 테스트 파일 자체의 SoT 목록(`ENUM_VALUES`)이 타입과 동기화됐음을 보증하려던 부수 장치**(`_typecheck`)다. 이 구분이 중요한 이유: `interaction-type-registry.md` §1.2 rule 3 자체가 명시하듯 매트릭스의 (c) `apply-execution-snapshot.ts`·(d) `use-result-detail-waiting.ts` 같은 **non-switch 소비처는 가드 #3(switch)의 보호를 아예 받지 못하고 가드 #2(AST 가드) 하나에만 의존**한다 — 즉 `_typecheck` 결함은 "3중 가드 중 하나가 약화"가 아니라, **매트릭스 다수 사이트에게는 사실상 유일한 방어선이 무력화돼 있었다**는, 초안의 표현보다 더 심각한 사실을 가리킨다.
  - 제안: E-6 에서 실제로 `interaction-type-registry.md:125` 를 정정할 때 (1) 가드 #3(switch 기반 assertNever, 예: `use-execution-events.ts`/`threadTurnsToConversationItems`)은 원래부터 건재했다는 것과, (2) 결함은 가드 #2(AST 가드) 자신의 내부 self-check(`ENUM_VALUES`↔타입 동기화)에 있었고 non-switch 소비처들에게는 그것이 유일한 방어선이었다는 것을 구분해 서술한다. 뭉뚱그려 "컴파일타임 축이 죽어 있었다"고만 쓰면 §4 의 가드 #3 까지 오염된 것처럼 읽혀 또 다른 부정확한 claim 을 spec 에 남기게 된다.

- **[INFO]** endReason 을 `interaction-type-registry.md` 매트릭스에 등록하는 형식이 문서의 기존 컬럼 구조(값→처리 분기)와 다름을 명시할 필요
  - target 위치: E-6 항목 1 (L264)
  - 과거 결정 출처: `interaction-type-registry.md` §1 (L21) — "cross-cutting **enum 값**의 단일 진실 + **처리 분기 위치 매트릭스**"
  - 상세: `WaitingInteractionType`/`ConversationTurnSource`/`PresentationType` 매트릭스의 각 행은 "값별로 N 곳에서 서로 다른 처리(렌더 분기)를 한다"는 전제를 가진다. `endReason`/`isConversationOutput` 은 이 전제가 다르다 — 대화 종료로 인식할지 여부의 **단일 멤버십(gate) 판정**이지, 값별 차등 처리 매트릭스가 아니다. target 은 이미 "패키지가 SoT, 가드 불필요" 로 서술하겠다고 명시해 이 차이를 인지하고 있으나(L264), 실제 등록 항목이 기존 표 포맷을 그대로 흉내내면 향후 독자가 "AST 가드 등록 누락"으로 오인할 수 있다.
  - 제안: 등록 시 별도 소절(예: "§5 endReason — 멤버십 가드, 처리 분기 매트릭스 아님")로 명확히 분리해 표기하거나, 최소한 "본 항목은 처리 분기 매트릭스가 아니라 멤버십 판정이며, 완전성은 패키지 내부 `satisfies`+`Exclude` 양방향 강제가 담당한다" 는 문장을 등록부 서두에 명시.

- **[INFO]** Inv-8(`conversation-thread.md` §9.9, L632)과의 명시적 backlink 권장
  - target 위치: E-7 (L268-279)
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` `## Rationale`-인접 §9.9 Inv-8(L632) — "오류로 종결된 대화형 노드는 `status` 를 게이트로 쓰지 않고 `isConversationOutput(outputData)` 데이터 유무로 미리보기에 도달 가능해야 한다"
  - 상세: `isConversationOutput`/`CONVERSATION_END_REASONS` 의 완전성은 Inv-8 이 규정한 "렌더 층 도달성" 보장의 **직접적인 전제조건**이다(화이트리스트 누락 = Inv-8 위반 재발, 실제로 `error`/`condition` 누락 사례가 그랬다). target 의 "결정 기록"·E-7 은 AI Agent/IE spec 산문에는 backlink 를 계획하지만 Inv-8 자체에는 역참조 계획이 보이지 않는다.
  - 제안: E-7 backlink 대상에 `conversation-thread.md` §9.9 Inv-8 항목을 추가해 "이 불변량의 완전성은 `@workflow/node-output-contract` 의 컴파일타임 강제가 담당한다" 는 한 줄을 남기면, 향후 Inv-8 을 읽는 사람이 "왜 이게 지금 안전한지" 를 추적할 수 있다.

- **[INFO]** endReason 영구 귀속처 미확정 — plan 완료 이동 전 반드시 확정 필요 (target 자체가 이미 인지)
  - target 위치: Phase 1 항목 1 (L175), E-7 말미 (L279)
  - 상세: "설계 rationale 이 plan 에만 있으면 plan 이 `complete/` 로 이동한 뒤 고아가 된다"는 위험을 target 스스로 명시하고 있고, `node-output.md` 신설 vs `conversation-thread.md` 사이 택일을 "Phase 1 착수 시 확정" 으로 열어 두었다. 결정 사항 자체는 문제 없으나, 이 리뷰 시점 기준으로는 미확정 상태이므로 `plan-lifecycle.md` 관례(완료 plan 은 spec 에 정착된 결정만 남기고 이동)에 따라 **Phase 1 완료 전 반드시 귀속처를 확정하고 §"결정 기록" 전체(옵션 A/B 비교, ⊇/=== 정정, 'out'/'timeout' 처리 근거 등)를 그 spec 문서로 옮겨야 한다**는 점을 재확인 차 명시한다. 새로 발견된 이슈는 아니며 target 이 이미 추적 중인 항목의 확인.

## 점검 관점 (a)~(d) 개별 결론

- **(a) endReason 을 공유 패키지로 푼 것은 `interaction-type-registry.md` 결정의 번복인가** — **번복이 아니라 정당한 범위 분리로 판단.** interaction-type-registry.md 의 매트릭스+AST가드 패턴은 "값별 차등 처리가 N 곳에 흩어진" 문제 전용 해법이고, endReason 문제는 "멤버십 판정 목록의 완전성" 이라는 더 좁은 하위 문제다. target 은 이 차이를 인지한 채 (i) 기존 거버넌스 문서에 **등록**하고(E-6-1), (ii) 메커니즘이 다른 이유를 명시하기로 계획해 **은폐가 아니라 명시적 예외로 편입**한다. 다만 위 INFO 항목처럼 등록 포맷이 기존 표와 혼동되지 않도록 구분할 필요는 있다.
- **(b) "3중 가드가 영구히 차단한다" 반증의 타당성** — **직접 재현해 검증한 결과 반증은 타당하다.** `ReadonlyArray<T> = VALUES` 대입은 공변 배열 assignability 상 `VALUES ⊆ T` 방향만 검사하며, 유니온에 새 멤버가 추가돼도 컴파일이 통과한다(격리 재현 확인). 원 문서 §4 의 "영구히 차단한다" 는 과장이었고, target 은 이를 코드 수정(E-1, `Exclude`+조건부 타입 기반 양방향 강제)과 spec 텍스트 수정(E-6-2)으로 **함께** 처리할 계획이다 — "결정의 무근거 번복"이 아니라 "무근거 주장의 근거 있는 정정 + 새 Rationale 동반 갱신 계획"에 해당한다. 다만 위 WARNING 항목대로 실제 정정문 작성 시 가드 #3(switch 기반)까지 오염된 것처럼 서술하지 않도록 주의가 필요하다.
- **(c) 기존 공유 패키지 4개 도입 Rationale과의 일관성** — **일관됨(선례 계승).** `graph-warning-rules`(`spec/conventions/cross-node-warning-rules.md` §6, L107-113: "SSOT 보장(backend↔frontend) — shared package 채택"), `expression-engine`(`spec/5-system/5-expression-language.md` §8.2, L448-451: "프론트엔드/백엔드 공유... npm 패키지로 분리"), `chat-channel-validation`(정규식 단일 진실 재사용) 모두 "동일 로직을 프론트/백엔드 양쪽에서 실행해야 하는데 중복 구현하면 drift"라는 동일한 근거로 패키지화됐다. target 의 §"옵션 B" 절(L83-104)이 드는 "4개 패키지가 모두 backend·frontend 양쪽에서 쓰이는 주력 패턴" 이라는 실측 근거는 이 선례와 정확히 일치한다 — 새 논리를 발명한 것이 아니라 기존 논리를 그대로 적용했다.
- **(d) `'timeout'`(죽은 값) 보존 결정의 충돌 여부** — **충돌 없음.** spec 산문(`spec/4-nodes/3-ai/3-information-extractor.md` §5.6, L456-654)은 IE multi-turn 종결 사유를 `completed`/`user_ended`/`max_turns`/`max_retries` 4종으로만 명시하며 `timeout` 은 어디에도 등장하지 않는다 — 코드 타입에만 선언되고 생산자가 없는 순수 dead value 임을 확인했다. 이를 즉시 제거하지 않고 "선언된 이상 파생 유니온에 포함, 과다 포함은 `hasResultMessages` 가 흡수해 무해, 제거는 IE 유니온에서 할 별개 판단" 으로 명시적으로 남겨두는 것은, 이 저장소가 이미 갖고 있는 "dormant 값을 조용히 없애지 않고 명시적으로 문서화해 두는" 선례(`spec/4-nodes/1-logic/11-merge.md` L15 의 `timeout`/`partialOnTimeout` P1 dormant 배리어 처리)와 결이 같다. 별도 spec Rationale 을 뒤집는 결정이 아니다.

## 요약

target 은 `plan/in-progress/is-conversation-output-restructure.md` 의 최신 버전 기준으로, 초기 초안 단계에서 우려됐을 법한 지점들(기존 governance 문서 무시, 근거 없는 가드 신뢰성 주장 방치)을 이미 자체적으로 발견·정정하는 방향(E-6/E-3b/개정 Phase 1)으로 진행돼 있다. 핵심 반증("`ReadonlyArray<T> = VALUES` 는 누락을 못 잡는다")은 직접 재현 검증 결과 사실이며, 이 발견은 오히려 원 spec Rationale 의 과장된 보증 문구를 근거 있게 좁히는 정당한 교정이다. 공유 패키지 채택 근거도 기존 4개 패키지의 도입 Rationale(SSOT/drift 방지)과 정확히 같은 논리이며, `'timeout'` 처리도 기존 dormant-value 문서화 관행과 부합한다. 잔여 리스크는 실행상의 정밀도 문제로 국한된다 — (1) 아직 작성되지 않은 E-6 정정문이 "가드 #2 의 내부 결함"과 "가드 #3(건재한 switch 기반 assertNever)"을 뭉뚱그려 새로운 부정확한 claim 을 spec 에 남길 위험, (2) endReason 영구 귀속처가 아직 미확정이라 plan 완료 전 spec 정착이 반드시 완결돼야 한다는 점. 두 항목 모두 target 이 이미 계획(E-6, Phase 1 항목1)으로 인지하고 있는 범위 내에 있다.

## 위험도

LOW
