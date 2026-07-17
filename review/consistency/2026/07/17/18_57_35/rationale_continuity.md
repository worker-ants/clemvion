# Rationale 연속성 검토 결과

> 검토 대상 scope: `spec/4-nodes/3-ai/` (--impl-done, diff-base=origin/main)
> 실제 diff: `spec/4-nodes/3-ai/1-ai-agent.md` (+2), `spec/4-nodes/3-ai/3-information-extractor.md` (+2) — 둘 다
> `@workflow/ai-end-reason` 패키지를 endReason 값 도메인의 SoT 로 지목하는 backlink blockquote 추가.
> 동일 PR 이 `spec/conventions/interaction-type-registry.md`(+47/-1, scope 밖)에 §4/§5 를 신설·정정했고,
> 이 문서가 위 두 backlink 의 근거지다. 이 논리적 단위 전체를 함께 검토했다.
>
> **선행 확인**: 동일 브랜치 안에 이미 한 차례 rationale-continuity 라운드가 존재한다
> (`review/consistency/2026/07/17/15_06_14/rationale_continuity.md`, target=plan 초안, 판정 LOW).
> 그 라운드의 WARNING("가드 #2/#3 을 뭉뚱그려 정정문을 쓸 위험")은 최종 착지된
> `interaction-type-registry.md` §5 "강도 정정" 문단에서 "③ 은 정상 동작하나 — ② 의 선결 조건이
> 무너져 있었다" 로 정확히 구분해 서술함으로써 해소됐음을 실측 확인했다. 아래는 그 이후 최종
> 착지 상태에 대한 **독립적** 재검토다.

## 발견사항

- **[WARNING]** `1-ai-agent.md` §7 의 endReason SoT 선언이 `'out'` 제외라는 자체 결정을 spec 본문에 승계하지 않음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7 상단 blockquote(신규 3번째 줄) — 바로 아래 §7.1~§7.10 sub-section 표(첫 행이 §7.1 `single_turn` 정상 완료, `endReason: "out"`)와 인접
  - 과거 결정 출처: 동일 PR 의 `plan/complete/is-conversation-output-restructure.md` "유니온 분기" 절(`'out'`(단일턴 종결)은 **패키지에 넣지 않는다** — backend 의 두 곳이 인라인 추론할 뿐 유니온으로 선언한 적이 없고, 타입만 만들면 소비처 없는 죽은 export 가 된다. 그 2곳까지 타입화하려면 E-3 범위가 커지므로 별건으로 둔다) 및 "결정 기록"("`'out'` 은 파생 유니온에 없다 (의도)"). 같은 결정이 `codebase/packages/ai-end-reason/src/index.ts` JSDoc("단일턴 종결('out')은 포함하지 않는다")과 `README.md`("`AiAgentEndReason` — AI Agent **multi-turn** 종결 사유 4값")에도 반복 기술돼 있다.
  - 상세: 신설 blockquote 는 "`endReason` 값 도메인의 SoT 는 `@workflow/ai-end-reason`(`AiAgentEndReason`) — 본 절은 각 값의 의미·port 매핑을 소유하고 **값 목록 자체는 패키지가 소유한다**" 라고 무조건 서술한다. 그러나 `AiAgentEndReason` 은 정의상 multi-turn 4값(`user_ended`/`max_turns`/`condition`/`error`)만 포함하고 단일턴 `'out'` 은 **의도적으로 제외**돼 있다 — 이는 우발적 누락이 아니라 plan 이 "E-3 범위 확장 여지가 있는 별건" 으로 명시 유보한 스코프 경계다. 같은 PR 은 §3.2(포트 표)를 backlink 대상에서 **의도적으로 제외**하면서 "패키지는 값 도메인만, port 매핑은 spec 소유 — 그 경계를 흐리면 안 된다"(E-7 정정 노트)는 정밀함을 실천했는데, `'out'` 경계에는 같은 정밀함이 spec 텍스트로 착지되지 않았다. 결과적으로 "값 목록 자체는 패키지가 소유한다"는 문장만 읽는 독자는 §7.1 의 `out` 도 그 도메인에 포함된다고 오독하기 쉽고, `interaction-type-registry.md §4`(상세 링크 목적지)도 이 경계를 언급하지 않는다. 실질 런타임 위험은 낮다(타입 시스템이 실제 오용은 컴파일 타임에 잡는다)지만, 문서만 보고 작업하는 향후 기여자가 "out 을 패키지에 왜 안 넣었지" 하고 불필요하게 편입을 시도하거나(plan 이 이미 검토·기각한 방향을 다시 검토하는 낭비), 반대로 "out 도 여기서 관리되는 줄 알았다"는 혼란을 겪을 수 있다.
  - 제안: `1-ai-agent.md` §7 blockquote 에 괄호주 또는 한 문장을 추가해 도메인이 multi-turn 4값 한정임을 명시한다. 예: "(`AiAgentEndReason`, multi-turn 4값 한정 — §7.1 의 단일턴 `'out'` 은 두 노드 유니온 어디에도 선언된 적이 없어 패키지 도메인 밖의 spec-only 리터럴로 남는다)". `interaction-type-registry.md §4` 의 "경계" 문단에도 동일 취지의 한 줄을 보강하면 두 착지 지점이 함께 정합된다.

- **[INFO]** `3-information-extractor.md` §5.6 의 동일 backlink 도 "패키지 6값 vs 본문 4종" 수 불일치를 옆에 남겨둠
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` §5.6 상단 blockquote(신규 줄) — 바로 다음 문장 "multi-turn 의 4 가지 종결 사유"
  - 과거 결정 출처: 동일 plan "`'timeout'` 은 현재 죽은 값이지만 IE 유니온이 선언한 이상 파생 유니온에 포함된다... 과다 포함은 무해"; `codebase/packages/ai-end-reason/src/index.ts` — `InformationExtractorEndReason` 은 `completed`/`max_turns`/`user_ended`/`timeout`/`max_retries`/`error` 6값이며, `error` 는 IE 스펙 §5.3(멀티턴 `LLM_CALL_FAILED`)에서, `timeout` 은 어디에서도 생산되지 않는 dormant 값으로 각각 §5.6 밖에 존재.
  - 상세: `1-ai-agent.md` 사례보다 배치는 안전하다(§5.1 의 단일턴 `out` 케이스와 문서 상 멀리 떨어져 있어 그쪽으로의 오독 위험은 낮음). 다만 blockquote 가 인용하는 `InformationExtractorEndReason` 타입은 6개 값인데 바로 다음 문장이 "4 가지 종결 사유"로 범위를 좁혀, "패키지가 소유하는 값 목록"과 "이 절이 실제로 열거하는 값" 사이에 괄호 없는 6-vs-4 수 불일치가 남는다. 이 자체는 기존에 이미 검증된 dormant-value 처리 정책(`timeout` 보존, `error` 는 §5.3 소관)과 모순되지 않으나, 그 사실이 본 절 근처에 명시돼 있지 않아 완전성 체크리스트로 읽으면 헷갈릴 수 있다.
  - 제안: blockquote 말미에 "(패키지 6값 중 `error` 는 §5.3 멀티턴 `LLM_CALL_FAILED` 케이스, `timeout` 은 현재 생산자 없는 dormant 값 — 본 §5.6 은 나머지 4값만 다룸)" 같은 한 줄을 덧붙여 수 불일치를 해소.

## 점검 관점 (1)~(4) 개별 결론

- **(1) 기각된 대안의 재도입** — 해당 없음. `interaction-type-registry.md §4` 가 endReason 에 매트릭스+AST가드 대신 "패키지 컴파일타임 강제" 를 채택한 것은 §1~§3 의 기존 패턴을 폐기·재도입한 것이 아니라, "값별 차등 처리가 N 곳에 흩어지는 문제"(§1~§3) 와 "멤버십 완전성 문제"(§4) 가 구조적으로 다르다는 명시적 구분 위의 **의도적 예외**다(전회 라운드 결론 (a) 재확인, 이번 라운드에서도 동일 판단 유지). 공유 패키지 채택 자체도 이 저장소에 이미 있는 4개 선례(`node-summary`/`expression-engine`/`graph-warning-rules`/`chat-channel-validation`)와 같은 논리이며 새로 발명된 패턴이 아니다.
- **(2) 합의된 원칙 위반** — 직접 위반은 없음. 다만 `interaction-type-registry.md` 문서 서두의 "신규 enum 값은 본 문서 **매트릭스**에 반드시 등록한다"는 일반 문구가, §4 가 명시하는 "매트릭스 불필요" 예외와 문면상 다소 긴장 관계에 있다 — 단, §4 자체가 같은 문서 안에서 즉시 그 예외 근거를 설명하므로 실질적 위반이라기보다 상단 요약 문구의 사소한 stale함이다(CRITICAL/WARNING 상향 대상 아님).
- **(3) 결정의 무근거 번복** — 없음. `interaction-type-registry.md §5` 의 "영구히 차단한다" 문구 완화는 실측 검증(가드 #3 은 건재, 가드 #2 의 내부 self-check 만 결함)에 기반한 **근거 있는 정정**이고, 같은 절 안에서 원인·해소·교훈을 모두 서술해 "새 Rationale 동반" 요건을 충족한다.
- **(4) 암묵적 가정 충돌** — 위 WARNING/INFO 두 건이 이 범주에 해당한다. 시스템 invariant 자체(타입 시스템의 양방향 강제)는 코드에서 정상 작동하지만, 그 invariant 의 **경계**(무엇이 포함/제외되는지)가 spec 산문에 완전히 반영되지 않아 향후 독자의 암묵적 가정과 실제 코드 사이에 괴리가 생길 수 있다.

## 요약

target 범위(`spec/4-nodes/3-ai/`)의 실제 diff 는 매우 작다 — `1-ai-agent.md`·`3-information-extractor.md` 각 2줄, `@workflow/ai-end-reason` 패키지를 endReason 값 도메인 SoT 로 지목하는 backlink 추가뿐이다. 이 backlink 가 가리키는 실질 설계 결정(매트릭스+AST가드 대신 컴파일타임 패키지 강제 채택)은 같은 브랜치의 선행 rationale-continuity 라운드(15_06_14)에서 이미 "번복 아님·선례와 일관·LOW" 로 검증됐고, 그 라운드가 지적한 유일한 WARNING(가드 #2/#3 conflation 위험)은 최종 착지 문구에서 정확히 해소됐다 — 과거 결정을 뒤집는 산문에 새 Rationale 을 동반하지 않은 사례, 또는 기각된 대안을 이유 없이 재도입한 사례는 발견되지 않았다. 다만 이번 독립 재검토에서, 두 노드 spec 에 착지한 backlink 문구가 "값 목록 자체는 패키지가 소유한다"고 무조건 서술하면서 plan·패키지 소스가 명시적으로 결정해 둔 도메인 경계(`'out'` 제외, IE 의 `error`/`timeout` 이 §5.6 밖이라는 사실)를 spec 본문에 승계하지 않은 정밀도 격차를 발견했다 — 특히 `1-ai-agent.md` 는 그 blockquote 바로 아래 표에 `'out'` 행이 나란히 놓여 있어 오독 유인이 상대적으로 크다. 이는 같은 PR 이 §3.2(포트 표)를 backlink 대상에서 의도적으로 제외하며 보여준 경계 정밀성의 기준에 못 미치는 부분적 착지 격차이며, 런타임 안전성 자체는 타입 시스템이 담보하므로 문서 정합 보완 수준의 위험이다.

## 위험도

LOW
