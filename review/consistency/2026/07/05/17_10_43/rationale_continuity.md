# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/` (특히 `14-execution-history.md` EH-DETAIL-03/§3.3/§3.4) + 관련 구현 커밋 `a32327074`(V-05 ResultDetail 재사용), `bef267c17`(ai-review CRITICAL 조치: Input/startedAt 매핑, dry-run 배지 복원)

## 조사 방법

- payload 에 포함된 target 스펙 5종(`0-dashboard`, `1-workflow-list`, `10-auth-flow`, `11-error-empty-states`, `13-user-guide`, `14-execution-history`, `15-system-status`, `16-agent-memory`)의 `## Rationale` 을 확인.
- 이번 세션의 실제 diff(`origin/main` 대비)는 `spec/2-navigation/**` 에는 존재하지 않음 — `14-execution-history.md` 의 EH-DETAIL-03/§3.3/§3.4/R-3/R-4 는 이미 이전 커밋에서 확정된 spec 텍스트이고, 금번 커밋(`a32327074`/`bef267c17`)은 **코드가 그 spec 을 뒤늦게 따라잡은 것**(spec-code-cross-audit V-05 조치)이다. 따라서 본 검토의 실질 대상은 "이번 코드 변경이 기존 Rationale(§9.2, §7.4 dry-run 표시 규칙 등)과 충돌하는가" 이다.
- `spec/5-system/13-replay-rerun.md` §7.4/§9.2 (dry-run 표시 규칙)를 코드 diff 와 대조.

## 발견사항

### [WARNING] dry-run 배지의 "결과 표시용" 식별 규칙(§9.2/§7.4)을 Execution-level 플래그로 확장하면서 spec 미갱신

- **target 위치**: `codebase/frontend/src/components/editor/run-results/result-detail.tsx` (`ResultDetail` — `executionDryRun` prop 추가, badge 조건 `isDryRunOutput(result.outputData) || executionDryRun`), `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` (`executionDryRun={execution.dryRun === true}` 전달). 커밋 `bef267c17`.
- **과거 결정 출처**: `spec/5-system/13-replay-rerun.md`
  - §9.2 "dry-run 표기 — NodeExecution `_dryRun` + Execution `dry_run` 컬럼": "**NodeExecution** 은 `outputData._dryRun === true` 로 식별한다. UI 가 그 키로 분기해 배지를 표시한다 (§7.4)... 즉 NodeExecution `_dryRun` 은 **결과 표시용(UI 식별)**, Execution `dry_run` 은 **실행 제어용(엔진 주입·복원)**으로 역할이 분리된다."
  - §7.4 "dry-run 결과 표시": "노드 카드에 `🧪 dry-run` 배지 / 출력 JSON 에 `_dryRun: true` 가 있으면 자동 강조" — 배지 트리거를 노드 output 마커에만 결부.
- **상세**: §9.2 는 "UI 식별(node marker)" 과 "실행 제어(execution column)" 를 의도적으로 분리한 invariant 로 명문화했다. 그러나 이번 변경은 non-effect 노드(HTTP/Send Email/DB/cafe24 write 가 아닌 Logic/Flow/Data/AI 등)가 `_dryRun` 마커를 갖지 않는다는 사실(마커는 §7.2 "외부 부수효과 노드"에만 심어짐)을 근거로, **Execution-level `dry_run` 컬럼을 UI 배지 표시에도 재사용**하도록 `ResultDetail` 을 확장했다. 코드 주석(`result-detail.tsx` JSDoc)에는 근거가 잘 설명되어 있으나, §9.2/§7.4 본문 어디에도 "execution 전체가 dry-run 이면 마커 없는 노드에도 배지를 띄운다" 는 규칙이 반영되지 않았다 — 결과적으로 spec 이 여전히 "NodeExecution 마커만으로 UI 식별" 이라고 서술하는데 코드는 그렇지 않다.
- **참고**: 커밋 메시지는 이 변경을 "ai-review CRITICAL/WARNING 조치"로 명시했고 회귀 테스트도 추가돼 있어 의도된 개선으로 보이며, §9.2 의 "역할 분리" 원칙 자체를 뒤집는 것이 아니라(엔진 제어는 여전히 Execution 컬럼, node 표시는 여전히 우선 marker) **UI 배지 표시 규칙에 한해 fallback 을 추가**한 것으로 파악된다. 다만 이 fallback 이 spec 문서에 반영되지 않아 "spec 상 결과 표시는 marker 전용" 이라는 §9.2/§7.4 서술과 실제 동작 사이에 괴리가 생겼다.
- **제안**: `spec/5-system/13-replay-rerun.md` §7.4 (또는 §9.2) 에 짧은 Rationale 추가 — "non-effect 노드는 `_dryRun` 마커가 없으므로(§7.2 범위 제한), UI 배지는 `outputData._dryRun` 우선 + `Execution.dry_run` fallback 으로 판정한다" 는 한 문단. `spec/2-navigation/14-execution-history.md` §3.2/§3.3 에도 동일 각주를 남기면 두 소비처(에디터 드로어·실행 상세 페이지)가 공유하는 규칙임이 명확해진다.

## 검토하지 않은/문제 없음으로 판단한 항목

- **LLM 탭 평탄화(R-3)**: `LLM Information` 단일 탭 → `Response`/`Request`/`LLM Usage` 최상위 평탄화는 과거 결정을 뒤집으면서 **동시에 새 Rationale(R-3)을 작성**했고, 연쇄적으로 `spec/4-nodes/3-ai/1-ai-agent.md §8` 등 참조 문서도 함께 정정된 이력이 확인된다 (git log 상 별도 커밋에서 완료). 이번 검토 대상 코드 변경과는 무관한 과거 정합 완료 항목 — 재론 불필요.
- **`ResultDetail` 재사용(V-05, `a32327074`)**: 실행 상세 페이지의 독자적 `NodeResultsTab` bespoke 구현(JsonViewer, 개별 handler 등)을 폐기하고 에디터 `ResultDetail` 컴포넌트로 통합한 것은, `spec/3-workflow-editor/3-execution.md` R-7 의 "라이브 실행과 동일한 store hydration 경로 재사용" · "전용 페이지와 중복 신설 금지" 원칙, 그리고 `14-execution-history.md` R-2 의 "같은 실행이 화면마다 다른 출처로 표시되면 안 된다" 는 취지와 **부합**한다. 과거 Rationale 을 위반하지 않고 오히려 강화하는 방향.
- **Input/startedAt 매핑 버그 수정**: `toNodeResult` 에 `inputData`/`startedAt` 매핑을 추가한 것은 §3.3 "Input 서브탭" 요구사항을 코드가 충족하지 못했던 버그의 수정이며, 기존 Rationale 과 충돌하지 않는다.
- **폴더 계층·workflow-list 등 나머지 target 문서**: 이번 diff 범위 밖(코드 변경 없음)이라 Rationale 연속성 이슈 없음.

## 요약

이번 변경 세트(V-05: 실행 상세 노드 서브탭 `ResultDetail` 재사용 + 후속 CRITICAL/WARNING 조치)는 대체로 기존 Rationale(§3.3 Input 탭 요구, R-2/R-7 의 "표현 일치·중복 신설 금지" 원칙)을 준수하거나 오히려 강화하는 방향이다. 다만 dry-run 배지 표시 로직에 `Execution.dry_run` 을 fallback 으로 추가한 부분은 `spec/5-system/13-replay-rerun.md §9.2` 가 명시적으로 그어둔 "NodeExecution 마커=결과 표시용 / Execution 컬럼=실행 제어용" 경계를 UI 표시 맥락에서 흐릿하게 만들었고, 이를 반영하는 spec 갱신이 누락되었다. 원칙을 뒤집은 것이 아니라 문서화되지 않은 확장이므로 CRITICAL 이 아닌 WARNING 으로 판단한다.

## 위험도

LOW
