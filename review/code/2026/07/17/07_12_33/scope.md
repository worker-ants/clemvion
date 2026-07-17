# 변경 범위(Scope) Review — AI 대화 노드 오류 종결 시 미리보기 도달성 복구

대상 커밋: `aee4f75e9` (13 files changed, 541 insertions, 26 deletions)
대상 plan: `plan/in-progress/ai-node-failed-conversation-preview.md`

## 발견사항

- **[WARNING]** `output-shape.ts` endReason 화이트리스트에 `'condition'` 추가는 plan 이 정의한 범위(R1+R2, 오류 종결 도달성)를 벗어난 인접 drift 수정이며 신규/기존 테스트가 커버하지 않는다
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:158-166` (`looksLikeConversationEnd`)
  - 상세: plan 문서(`plan/in-progress/ai-node-failed-conversation-preview.md`)는 근본 원인을 "R1(`use-execution-events.ts` 의 `output` drop) + R2(`result-detail.tsx` 의 `status==='completed'` 게이트)" 두 결함으로 명시적으로 확정하며(`"진짜 근본 원인은 두 개의 독립 결함이다"`), `'condition'` 이나 backend enum 전체 정합화는 어느 Phase 에도 언급되지 않는다. 반면 실제 커밋 메시지는 이를 "R3 — `isConversationOutput` 의 endReason 화이트리스트가 backend enum 과 drift" 로 사후 정의해 4번째 원인으로 편입시켰다. 코드로 검증한 결과 두 값의 성격이 다르다:
    - `'error'` 는 이번 작업의 신규 fixture(CT-S15~17, 전부 `endReason: "error"`)가 직접 검증하므로 **필수·범위 내**.
    - `'condition'` 은 이번 fixture·테스트 어디에도 등장하지 않는다(`grep` 확인: `endReason.*condition` 매치 없음). 이 값은 `buildConditionOutput` (`ai-turn-executor.ts:3479-3483`)이 만드는 **정상 종결**(조건부 라우팅, `status` 는 보통 `completed`) 케이스로, 실패(`failed`) 종결과 무관한 별개의 잠재 버그다. 기존 `output-shape.test.ts:574-576` 의 "accepts every unified endReason" 테스트도 `["completed","user_ended","max_turns","max_retries"]` 만 열거하고 이번 diff 에서 갱신되지 않아, `'condition'` 추가가 실제로 무엇을 고치는지 회귀 테스트로 증명되지 않는다.
  - 제안: `'condition'` 추가를 별도 커밋/PR 로 분리하거나(권장), 유지한다면 (1) plan 에 R3 를 정식 스코프 항목으로 기록하고 (2) `output-shape.test.ts` 의 열거형 테스트에 `'condition'`(및 `'error'`) 케이스를 추가해 "enum parity" 라는 근거를 테스트로 증명한다.

- **[INFO]** `conversation-inspector.tsx` 의 인라인 재파싱 단락(short-circuit) 은 필요 최소 변경으로 판단됨 — 별도 조치 불필요
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:864-869` (`SummaryView` 의 `items` useMemo)
  - 상세: `ConversationInspector` 는 프로덕션에서 `result-detail.tsx` 에서만 렌더된다(`grep` 확인). R2 변경 전에는 `isLive=false` 분기가 호출자가 넘긴 `conversationMessages` prop 을 항상 무시하고 `output.messages` 를 자체 재파싱했다 — 이 경로는 `output.error` → `system_error` 합성을 하지 못하므로, R2 가 `historyMessages = parseHistoryMessages(result.outputData)` (system_error 합성 포함)를 새로 계산해 넘겨도 `SummaryView` 가 그것을 버리고 합성되지 않은 raw 재구성으로 대체해버려 CT-S16/CT-S17 의 인라인 에러 마커가 사라지는 회귀가 발생했을 것이다. 추가된 1줄(`if (conversationMessages.length > 0) return conversationMessages;`)은 이 폐기를 막는 정확한 최소 수정이며, 기존 inline 재파싱 로직 자체는 삭제하지 않고 방어적 폴백(예: `historyMessages` 가 빈 배열인 edge case)으로 보존했다 — 불필요한 리팩토링을 피한 보수적 선택.
  - 제안: 없음. 다만 프로덕션 호출자가 1곳뿐이라 inline 재파싱 경로는 사실상 죽은 코드에 가까운데, 이번 PR 은 그 정리(제거)를 시도하지 않은 점도 "범위 최소화" 관점에서는 올바른 판단.

- **[INFO]** spec 4개 문서 분산 개정은 SoT 경계를 존중한 결과로 과도하지 않음
  - 위치: `spec/2-navigation/14-execution-history.md`, `spec/3-workflow-editor/3-execution.md`, `spec/3-workflow-editor/_product-overview.md`, `spec/conventions/conversation-thread.md`
  - 상세: 각 문서 수정분은 서로 다른 SoT 책임 영역에 정확히 대응한다 — `3-execution.md §10.6.1`(탭 가시성·기본 탭 정책 SoT, 조건문을 사문 `port:'error'` 에서 `node.failed` 기준으로 재작성), `conversation-thread.md`(§9.3 데이터 소스 표 비고 추가·Inv-8 신설·CT-S15~17·§8.5 Rationale — 탭 규칙 자체는 §10.6.1 을 참조만 함), `_product-overview.md`(ED-EX-13 요구사항 레벨에 예외 명시), `14-execution-history.md`(§3.4 "완료된"→"종결된" 갱신 + SoT 참조 정합, 이 문서 자체가 L211 에서 §10.6.1 을 SoT 로 이미 명문화하고 있어 후속 수정 대상). plan 문서에 기록된 대로 1차 초안이 `conversation-thread.md §9.13` 신설로 두 번째 SoT 를 만들려다 `/consistency-check --spec` 1회차에서 CRITICAL 로 반려된 이력이 있고, 이번 diff 는 그 반려를 반영해 SoT 중복 없이 참조 관계로 재구성한 결과다. 각 문서의 diff 라인 수도 작다(2~28줄). 이는 "관련 없는 파일 확장 편집"이 아니라 정합성 유지에 필요한 최소 동시 개정으로 판단.
  - 제안: 없음.

- **[INFO]** `conversation-thread.md` 의 "다음 6가지 불변량" → "다음 8가지 불변량" 정정은 Inv-8 신설과 무관한 기존 오기(실제 Inv-1~7 로 7행이었음) 동반 수정
  - 위치: `spec/conventions/conversation-thread.md` §9.9 서두 문장
  - 상세: plan Phase 1 항목 5 에 "현재 Inv-1~Inv-7 로 7행인데 6가지로 적힌 기존 오류 동반 수정"으로 명시적으로 disclose 되어 있다. 어차피 Inv-8 추가로 그 줄을 수정해야 하므로 같은 줄의 기존 오기까지 함께 고친 것은 실질적으로 추가 diff 비용이 없는 통합 수정.
  - 제안: 없음 (허용 범위 내 사소한 drive-by 수정, 별도 분리 불필요).

- **[INFO]** `showTabs` 의 `cancelled` 누락은 사용자 지시대로 의도적으로 범위 제외되었고, 실제로 diff 에도 반영되지 않음 — 정합
  - 위치: `plan/in-progress/ai-node-failed-conversation-preview.md` "스코프에서 제외" 절
  - 상세: plan 이 이 drift 를 실측으로 확인(§10.6.1 L471 vs `result-detail.tsx:1048-1052`)하고도 "본 작업과 무관한 별개 drift" 라는 근거로 명시적으로 제외했으며, 실제 코드 diff(`result-detail.tsx`) 어디에도 `showTabs` 함수 변경이 없음을 확인했다 — 선언한 제외가 실제로 지켜졌다.
  - 제안: 없음.

- **[INFO]** `node-output-redesign/ai-agent.md` 에 추가된 1줄 교차 참조는 최소 범위
  - 위치: `plan/in-progress/node-output-redesign/ai-agent.md` (CRITICAL 항목 하위 불릿 1개 추가)
  - 상세: 무관한 plan 문서의 기존 CRITICAL 항목 서술을 수정하지 않고, 본 작업과의 연관성을 알리는 교차 참조 문장만 하위 불릿으로 추가했다. plan 본문이 스스로 "양방향 교차 참조 의무"로 정당화하고 있으며 diff 크기(+1줄)도 이를 뒷받침한다.
  - 제안: 없음.

## 코드 변경 파일별 요약 (참고)

| 파일 | 범위 판정 |
|---|---|
| `conversation-scenarios.ts` | 순수 추가(fixture), 기존 코드 미변경 — 정합 |
| `result-detail.test.tsx` | 순수 추가(import + describe 블록) — 정합 |
| `conversation-inspector.tsx` | 6줄(1 코드 + 5 주석) 최소 추가 — 정합 (위 INFO 참조) |
| `output-shape.ts` | `'error'` 는 범위 내 필수, `'condition'` 은 범위 초과 (위 WARNING) |
| `result-detail.tsx` | R2 관련 변경(게이트 제거·rename·live 소스 선택·기본 탭 예외)이 모두 plan Phase 2 항목 3~6 에 1:1 대응 — 정합 |
| `use-execution-events.test.ts` | 순수 추가(R1 회귀 테스트 1건) — 정합 |
| `use-execution-events.ts` | 2줄 변경(+ 필드 선언 주석) — R1 그대로 — 정합 |
| `ai-node-failed-conversation-preview.md` (신규 plan) | 작업 추적 문서 자체 — 정합 |
| `node-output-redesign/ai-agent.md` | 1줄 교차 참조 — 정합 |
| `14-execution-history.md` / `3-execution.md` / `_product-overview.md` / `conversation-thread.md` | SoT 경계에 따른 분산 개정 — 정합 |

## 요약

전반적으로 diff 는 plan 문서가 사전에 정의한 R1(use-execution-events.ts 의 `output` drop)·R2(result-detail.tsx 의 `status==='completed'` 게이트) 두 근본 원인에 매우 밀착되어 있고, 각 파일 변경이 대부분 1:1 로 plan 의 Phase 2 항목에 대응하며 불필요한 리팩토링·포맷팅 변경·무관한 파일 수정은 발견되지 않았다. `conversation-inspector.tsx` 의 인라인 재파싱 단락(short-circuit)은 R2 가 만든 새 데이터 흐름을 실제로 성립시키는 데 필요한 최소 보완이며, spec 4개 문서 개정은 프로젝트의 SoT 원칙(§10.6.1 vs conversation-thread.md 역할 분리)을 지키기 위한 정당한 동시 개정이다. 유일한 주의 지점은 `output-shape.ts` 의 `endReason` 화이트리스트에 `'error'` 와 함께 `'condition'` 도 추가한 부분으로, 이는 plan 이 명시한 스코프(R1+R2)를 벗어나 커밋 메시지에서 사후적으로 "R3" 로 편입된 인접 drift 수정이며, 이번 작업의 어떤 fixture·테스트도 `'condition'` 케이스를 검증하지 않는다 — 기능상 무해해 보이지만 "요청된 변경 외 추가 수정" 원칙에는 걸린다.

## 위험도

LOW
