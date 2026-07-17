# Rationale 연속성 검토 결과 (2회차)

- target: `plan/in-progress/ai-node-failed-conversation-preview.md`
- 검토 모드: spec draft 검토 (`--spec`)
- 대조 대상: `spec/conventions/conversation-thread.md` (§1.2.1·§4·§8.1~§8.4·§9.1·§9.3·§9.7·§9.7.1·§9.9·§9.10), `spec/3-workflow-editor/3-execution.md` (§10.6.1·§10.8), `spec/3-workflow-editor/_product-overview.md` (ED-EX-13), `spec/2-navigation/14-execution-history.md` (§3.4·L213·R-6), `spec/2-navigation/_product-overview.md` (EH-DETAIL-06/12)
- 배경: 1회차(`review/consistency/2026/07/17/00_32_29/rationale_continuity.md`) CRITICAL — "§10.6.1 의 retryable-error Preview 예외를 non-retryable 까지 무근거로 확장" 에 대한 target 의 대응(§8.5 신설 근거 확정)이 기존 결정 계보와 정합하는지를 중점 검토

## 발견사항

- **[INFO]** §10.6.1 신규 예외 조건문의 `port:'error'` 잔존 표현 — 실측 진단과 어긋날 위험
  - target 위치: Phase 1 개정 대상 A-2 — "현재 `port: 'error'` + `retryable === true` 한정인 'Preview 우선' 예외를 `node.failed` 종결 + non-retryable 까지 확장"
  - 과거 결정 출처: `spec/3-workflow-editor/3-execution.md:510` 의 기존 blockquote — "AI multi-turn retryable error 종결 시 예외: AI Agent multi-turn 이 `port: 'error'` + `details.retryable === true` 로 종결된 경우"
  - 상세: target 자신의 "오류 경로는 실질적으로 하나다 (2026-07-17 실측)" 절이 이미 "`port:'error'`+`retryable` 로 종결되는 `node.completed` 경로는 production 도달 경로가 발견되지 않는다 — 엔진이 항상 `node.failed` 로 귀결시킨다" 고 정정했다. 즉 기존 §10.6.1 blockquote 의 "port:'error'" 조건 자체가 이미 사문(死文)에 가깝다. Phase 1 A-2 는 이 조건을 "확장"이라고만 서술하고 있어, 실제 spec 개정 시 `port:'error'` 잔존 표현을 `node.failed` 기준으로 정정하지 않으면 신규 rationale(§8.5)이 정당화하는 대상과 §10.6.1 조건문 표현이 서로 어긋난 채로 spec 에 남을 수 있다. Phase 2 항목 4 (`result-detail.tsx:1080-1084` 사문 주석 정정)와 같은 정신을 §10.6.1 자체 문구에도 적용해야 완결된다.
  - 제안: Phase 1 A-2 실행 시 §10.6.1 blockquote 문구를 "`node.failed` 종결(대화형 노드, retryable 무관)" 기준으로 다시 쓰고, `port:'error'` 조건은 (있다면) "이론상 방어 경로" 로 격하하거나 삭제. 이는 새 결정이 아니라 target 이미 확정한 실측 사실의 문구 반영이므로 별도 승인 불필요.

- **[INFO]** §8.5 신설 위치와 §10.6.1 인라인 근거 간 rationale 분산 — cross-ref 부재 시 탐색성 저하
  - target 위치: Phase 1 B-7 ("§8.5 Rationale 신설 — Inv-8 근거, 기각 대안, 이력 view 범위 분리") vs A-2 (§10.6.1 자체에 "근거: ..." 한 문장만 인라인 기재)
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §8.1` 말미 "…강제 격상. [WebSocket §4.4.6] 옛 권장의 강제 격상 — **Rationale 은 §8.1**." 패턴(같은 문서 내 인라인 규칙 → 별도 Rationale 절 cross-ref)과 대비.
  - 상세: 기존 §10.6.1 retryable 예외는 근거 전체가 §10.6.1 인라인에만 있고 `3-execution.md ## Rationale` 에는 대응 항목이 없다(실측 확인 — 720행 이하 Rationale 절에 §10.6.1 예외 관련 항목 없음). target 은 이번에 그 패턴을 깨고 fuller rationale 을 다른 파일(`conversation-thread.md §8.5`)에 둔다 — Inv-8 소유권이 그 문서에 있다는 점에서 구조적으로 타당하지만(§8 서두 "결정의 배경·근거 → 해당 spec 문서 끝 Rationale" 원칙에 부합, `conversation-thread.md` 가 Inv-8/데이터소스/CT-S15·16 소유자), §10.6.1 쪽에 "Rationale: [conversation-thread.md §8.5]" 같은 명시적 역참조가 없으면 `3-execution.md` 만 읽는 독자가 "왜 이 조건으로 확장됐는지" 를 못 찾을 위험이 있다.
  - 제안: A-2 의 인라인 "근거: ..." 문장 끝에 `conversation-thread.md#85-...` 로의 명시적 링크를 추가해 §8.1 이 스스로 하는 cross-ref 관행을 §10.6.1 에도 적용할 것.

## 결정 검증 (round 1 CRITICAL 해소 여부)

1회차 CRITICAL 의 핵심 지적("§10.6.1 예외의 원 근거는 `[다시 시도]` affordance 에 결박된 근거라 non-retryable 로 자동 확장되지 않으며, 확장하려면 별도 근거 신설이 필요")에 대해 target 은 다음을 확정했다:

- **원 근거와의 구분을 target 스스로 명시**: L132 blockquote 가 "§10.6.1 기존 예외의 근거는 ... `[다시 시도]` affordance 에 묶인 근거라 non-retryable 로 자동 확장되지 않는다 ... 근거 없는 확장은 기존 결정의 무근거 번복" 이라고 1회차 지적을 그대로 재진술한 뒤, 별개의 신규 근거를 제시한다 — 무근거 확장이 아니라 **의식적으로 새 근거를 병기한 확장**이다.
- **신규 근거의 실측 정합성**: "system_error 는 retryable 여부와 무관하게 §9.1 상 thread 인라인 표시된다 (non-retryable 은 액션 영역만 비어있음)" — `conversation-thread.md §9.1` 의 `system_error` 행을 실측 확인한 결과 정확히 일치한다: "우측 액션 영역: `data.retryable === true` 일 때 `[다시 시도]` 버튼 ... `false` 면 액션 영역 비어있음 (Inv-6 시각 보조)". 즉 신규 근거는 이미 spec 에 있는 사실을 인용한 것이지 새로 지어낸 주장이 아니다.
- **더 상위의 store-층 invariant 와 정합**: `§9.9 Inv-6` ("노드 실패 / 실행 실패 시 store `conversationMessages` 는 비워지지 않는다 ... `system_error` item 은 thread 의 마지막에 APPEND") 은 애초부터 retryable 여부를 구분하지 않는 무조건 규칙이다. `§8.3` 의 Inv-6 원 근거("failExecution 시 conversation 전체를 클리어하면 사용자가 '왜 대화가 사라졌지' 의 혼동을 일으킨다")도 retryable 무관 서술이다. `§10.8` 라이프사이클 표의 "실행 실패" 행도 이미 "multi-turn AI Agent 의 대화가 노드 실패와 함께 사라지지 않음" 을 retryable 무관으로 명문화하고 있다. target 의 신규 근거("대화 시간축 보존 가치는 재시도 가능성과 독립적")는 이 기존 store-층 invariant 를 render-층(탭 기본값)으로 끌어올리는 논리이며, 새 결정이 상위 원칙과 대립하지 않고 오히려 그 원칙을 완결시키는 방향이다 — 문서 제목 자체가 "렌더 층 Inv-6 누수" 인 것과 일관.
- **원 근거의 논증 패턴을 그대로 계승**: 원 예외의 근거는 "Error 탭은 `output.error` JSON 형식으로 여전히 접근 가능(디버깅 용도)" 로 Error-최우선 원칙(ED-EX-13)과의 긴장을 완화했다. 신규 근거도 동일 패턴("Error 탭은 여전히 명시적 선택으로 접근 가능하므로 오류 정보 도달성은 훼손되지 않는다")을 사용한다 — 임의의 새 논리가 아니라 이미 검증된 논증 형식의 재사용.
- **ED-EX-13 자체의 정합화도 함께 처리**: 1회차가 지적한 "§10.6.1 기존 예외조차 ED-EX-13 문구에 반영 안 됨(잠재 긴장)" 문제를 D 항목(ED-EX-13 L121 개정, §10.6.1 참조 추가)으로 별도 해소 — 신규 확장뿐 아니라 기존 미반영분까지 소급 정리한다.
- **scope 오염 방지 장치 확인**: Phase 3 CT-S16 이 "비대화형 `http_request` 는 기존대로 오류 탭" 회귀를 명시적으로 pin 해, 확장이 AI 대화형 노드 범위를 벗어나지 않음을 테스트로 고정한다. ED-EX-13 의 일반 원칙(비대화형 노드의 Error 최우선)은 그대로 보존된다.
- **§9.3 D4 계보(1회차 INFO)도 해소**: `conversationMessages` 를 "그 snapshot 의 store 측 권위 사본(§9.7.1 표현)" 이라고 명시한 문구는 `§9.7.1` 원문("`conversationMessages` 배열 — live 대화 thread 의 store 측 권위 사본")을 정확히 인용한 것으로 확인됐다. `§8.1 D4`("conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 둔다")와 대립하는 두 번째 소스가 아니라, D4 가 가리키는 그 snapshot 의 파생 사본임이 실측으로도 확인된다.

이력 view 범위 분리("새로고침 후 EH-DETAIL-12 로 이월")도 검증했다 — `conversation-thread.md §4` 영속화 표의 "실행 후(이력 view)" 행이 이미 "이 경로의 thread view 는 재구성 가능한 derived view (EH-DETAIL-12)" 라고 못박고 있고, `14-execution-history.md R-6` 이 EH-DETAIL-06(단일 노드, live 완료)과 EH-DETAIL-12(이력 view 재구성, v2)의 경계를 이미 확정해 뒀다. target 의 스코프 제외 문구는 이 기존 경계를 재활용한 것으로, 새로운 ID 오용이나 재해석이 아니다.

## 요약

1회차 CRITICAL 은 실질적으로 해소됐다고 판단한다. target 은 단순히 "근거를 추가했다"는 수준을 넘어, (a) 1회차 지적을 문서 안에 그대로 재진술해 쟁점을 명확히 인정하고, (b) 신규 근거의 각 구성 요소(system_error 의 retryable-무관 인라인 표시, Inv-6 의 store-층 무조건 보존, Error 탭의 잔존 접근성)를 모두 기존 spec 문구에서 실측 인용해 임의성을 배제했으며, (c) 원 예외가 사용한 논증 패턴("최우선 원칙과의 긴장은 Error 탭 잔존 접근성으로 완화")을 그대로 재사용해 형식적 일관성도 유지하고, (d) ED-EX-13 미반영 문제까지 소급 정리하며, (e) scope 오염 방지 테스트(CT-S16)로 확장 범위를 고정했다. 남은 두 항목은 CRITICAL/WARNING 이 아니라 spec 본문 편집 시 정확도를 높이는 INFO 성격 — §10.6.1 예외 조건문의 `port:'error'` 잔존 표현을 target 자신의 실측 진단(`node.failed` 가 유일한 실제 경로)에 맞춰 정정할 것, 그리고 §10.6.1 인라인 근거에서 `conversation-thread.md §8.5` 로의 명시적 역참조를 남겨 근거 분산으로 인한 탐색성 저하를 예방할 것을 제안한다.

## 위험도

LOW
