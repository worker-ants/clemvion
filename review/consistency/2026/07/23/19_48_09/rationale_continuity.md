# Rationale 연속성 검토 — presentation-thread-optout-drift.md

## 발견사항

- **[WARNING]** `conversation-thread.md §2.4` 의 "필드 정의 SoT = 3 노드 공유 fragment" 서술을 target 이 남겨둔 채 presentation 쪽만 정정 — 동일 계열 conflation 이 인접 문서에 그대로 존속
  - target 위치: `plan/in-progress/presentation-thread-optout-drift.md` §"개정 방침" 2번(표면 미구현) + §체크리스트 4번째 항목("`conversation-thread.md §2.4` 와 '몇 노드가 이 필드를 갖는가' 서술 정합 확인")
  - 과거(인접) 결정 출처: `spec/conventions/conversation-thread.md` `### 2.4 opt-out` (`db496a3c2`, #516 "spec↔code 전수 상호 감사" 에서 문구 정밀화) — "필드 정의의 단일 진실은 **3 노드 공통 공유 fragment** [`shared/conversation-context-schema.ts`]... 각 노드 schema 는 spread 호출만 둔다" / `spec/4-nodes/3-ai/0-common.md §10` — 동일 필드를 "**세 노드 공통**"(AI Agent/Text Classifier/Information Extractor) 으로 명시하고 presentation 은 언급하지 않음
  - 상세: `conversation-thread.md §2.4` 는 `### 2.1 Presentation 노드`, `### 2.3` 과 같은 heading level(`###`)로 §2 "자동 누적 컨트랙트" 전체(즉 presentation 포함)에 걸쳐 적용되는 것처럼 위치하면서도, "필드 정의의 단일 진실 = 3 노드 공유 fragment" 라는 **스키마 선언 SoT 를 무조건적으로** 진술한다. 그런데 target 자신의 실측(5개 presentation schema 전수 grep 0건)이 그 진술이 presentation 노드에는 **사실이 아님**을 이미 증명했다 — target 이 §4.6 을 "표면(미구현): presentation 5노드 schema 는 이 필드를 선언하지 않는다" 로 고치고 나면, 같은 필드에 대해 `conversation-thread.md §2.4` 는 여전히 "필드 정의 SoT = 3 노드 fragment" 라는, presentation 을 배제하는 것도 포함하는 것도 아닌 **모호하고 사실상 그른(스코프 未한정) 문구**를 남긴 채로 두 문서가 나란히 존재하게 된다. 이는 target 자신의 Rationale 이 "checker 는 schema grep 0건에서 곧바로 미구현을 추론했으나 이 저장소는 `.passthrough()` 를 쓰므로 스키마 선언 ≠ 동작 여부" 라고 지적한 것과 **정확히 같은 계열의 conflation**(스키마 선언 SoT ↔ 실동작 범위 혼동)이 인접 문서에 미해소 상태로 남는 것.
  - 제안: target 의 체크리스트 항목을 "확인" 수준에서 "조치" 수준으로 격상하고, 그 처방 방향을 target 자신의 `## Rationale` 에 미리 적어 둔다. 예: `conversation-thread.md §2.4` 를 "런타임 게이트(`appendInternal`)는 노드 종류 무관 공통 적용 / **필드 선언 SoT 는 AI 3노드 shared fragment 한정**이며 presentation 5노드는 별도로 필드를 선언(현재는 미선언, `.passthrough()` 로 수동 설정만 유효)한다" 로 명시 분기하도록 개정 방향을 pin. 이렇게 해야 §4.6 정정과 §2.4 가 서로 다른 세대의 사실을 담는 자기모순이 재발하지 않는다 — target 의 Rationale 이 이미 경고한 "세 번째 재발 시 영역 일괄 정리" 시나리오의 씨앗이 바로 이 지점이다.

## 교차검증 요약 (판단 근거)

1. 런타임 게이트 노드-무관 적용 주장은 코드로 확인됨: `conversation-thread.service.ts` 의 `appendInternal` 첫 줄 `if (this.isOptedOut(args.node)) return;`, `isOptedOut` 은 `node.config?.excludeFromConversationThread === true` 를 노드 종류 검사 없이 읽는다 — target 의 핵심 사실 주장은 정확하다.
2. `spec/4-nodes/6-presentation/0-common.md §4.6` 은 `c097067f3`(2026-05-14, "SPEC POLISH")에서 신설된 문서-전용 선언이며 도입 당시에도 실 schema 구현 검증 없이 "declare" 만 됐다 — 이번 drift 는 그 시점부터의 선재 결함이지 target 이 새로 만든 것이 아니다.
3. `spec↔code 전수 상호 감사`(`db496a3c2`, #516)가 같은 배치에서 `conversation-thread.md §2.4` 문구를 "3 노드 공통 공유 fragment" 로 더 정밀화했으나 그 감사는 `presentation/0-common.md §4.6` 은 손대지 않았다 — 두 문서가 서로 다른 시점에 서로 다른 정밀도로 갱신되며 벌어진 간극이며, target 은 그 간극의 절반(presentation 쪽)만 이번에 닫으려 한다.
4. `.passthrough()` 로 선언되지 않은 필드가 "정식 노출 surface 아님, handler 방어적 경로로만 사용" 이라는 서술 패턴은 이미 `spec/4-nodes/6-presentation/3-chart.md:109` 의 `dataSource` 필드에 선례가 있다 — target 의 "표면 미구현이지만 동작함" 처방은 이 저장소의 기존 문서 관행과 정합적이며 새로운 패턴을 만드는 것이 아니다.
5. target 의 `## Rationale` 은 "왜 삭제/격하가 아닌가", "왜 checker 처방을 그대로 따르지 않았나", "이 영역은 두 번째다" 세 축을 서술해 요구사항 3(무근거 번복 금지)을 §4.6 자체에 대해서는 충족한다 — 다만 그 서술이 conversation-thread.md §2.4 와의 관계까지는 커버하지 않는다 (위 WARNING).
6. `previousOutput` 선례(#997, `3d0bcd69b`)의 CRITICAL 2건은 "0-common 패턴을 실동작 확인 없이 Form 에 복사"에서 발생했다 — target 은 이번엔 5개 schema 전수 grep + `.passthrough()` 개별 카운트(carousel/table/form 9회, template 7, chart 4)로 실측 기반 진술만 하고 있어 같은 실수를 반복하지 않는다.
7. 기각된 대안의 재도입 여부: target 이 다시 채택하려는 것은 없다 (checker 의 (b) 삭제/격하 처방을 기각하고 §4.6 유지를 택했을 뿐, 과거에 명시적으로 기각됐던 대안을 되살리는 사례는 발견되지 않음).

## 요약

target(`presentation-thread-optout-drift.md`)의 핵심 처방 — §4.6 을 삭제하지 않고 "동작(런타임 게이트, 구현됨)"과 "표면(schema 선언, 미구현)" 두 층위로 분리 서술 — 은 코드 실측과 정확히 일치하고, `previousOutput` 선례(#997)가 세운 "완전 폐기 대신 정밀 정정" 방법론 및 chart `dataSource` 의 "`.passthrough()` 비공식 surface" 선례와도 정합적이라 기각된 대안의 재도입이나 합의 원칙 위반은 없다. 다만 인접 문서 `spec/conventions/conversation-thread.md §2.4` 가 같은 필드에 대해 "필드 정의 SoT = 3 노드(AI) 공유 fragment" 라는, presentation 5노드엔 들어맞지 않는 문구를 여전히 갖고 있고, target 은 이를 체크리스트 항목으로만 남겨 둔 채 처방 방향을 Rationale 에 pin 하지 않았다 — target 이 스스로 지목한 "동일 영역 세 번째 재발" 리스크의 구체적 진원지가 될 수 있으므로 WARNING 으로 표기한다.

## 위험도

LOW
