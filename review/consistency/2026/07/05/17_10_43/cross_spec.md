# Cross-Spec 일관성 검토 — V-05 final (execution-detail page → ResultDetail 재사용 + inputData/startedAt 매핑 + executionDryRun prop)

검토 대상 diff: `git diff origin/main...HEAD`
- `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`
- `codebase/frontend/src/components/editor/run-results/result-detail.tsx`

관련 spec: `spec/2-navigation/14-execution-history.md` §3.3/§3.4(EH-DETAIL-03), `spec/3-workflow-editor/3-execution.md` §10.6.1, `spec/5-system/13-replay-rerun.md` §7(dry-run 정의)/§9.2(dry-run 표기 컬럼 역할 분리)

이번 검토는 같은 worktree 의 이전 두 검토(16_27_37 --impl-prep, 16_49_52 --impl-done 중간본)의 후속이다. 16_49_52 시점 diff 는 `executionDryRun` prop 을 **제거**하는 방향이었으나, 이후 커밋(`bef267c17 "V-05 ai-review CRITICAL 조치 — Input/startedAt 매핑 + dry-run 배지 복원"`)이 이를 되돌려 `executionDryRun` prop 을 `result-detail.tsx` 에 정식으로 이식했다. 이번 최종 diff 기준으로 재평가한다.

## 발견사항

- **[INFO]** `executionDryRun` prop 도입은 신규 동작이 아니라 `origin/main` 기존 동작의 구조적 이관 — 단, 두 관련 spec 어디에도 이 동작이 명문화되어 있지 않음 (선재 갭, 확대 아님)
  - target 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx` `ResultDetailProps.executionDryRun?: boolean` (신규 prop, JSDoc 포함) 및 `(executionDryRun || isDryRunOutput(result.outputData)) && <DryRunBadge />`; `page.tsx` `executionDryRun={execution.dryRun === true}` 전달부
  - 충돌 대상: `spec/5-system/13-replay-rerun.md` §9.2 "NodeExecution `_dryRun` 은 결과 표시용(UI 식별), Execution `dry_run` 은 실행 제어용(엔진 주입·복원)으로 역할이 분리된다" / §7.4 "Run Results 드로어와 실행 상세 페이지는 dry-run 모드로 실행된 NodeExecution 을 시각적으로 구분한다: 노드 카드에 🧪 dry-run 배지, 출력 JSON 에 `_dryRun: true` 가 있으면 자동 강조"
  - 상세: §9.2 는 문면상 노드 배지가 오직 NodeExecution 레벨 `_dryRun` 마커에서만 파생되어야 한다고 읽히고, `Execution.dry_run` 은 엔진 제어(§7.2 `variables.__dryRun` 주입·rehydration 복원)용으로 스코프를 한정한다. 그러나 실제 구현(`origin/main` 부터 현재까지 불변)은 실행 상세 페이지에서 `execution.dryRun === true` 이면 **효과 없는 노드(Logic/Flow/Data/AI 등, `_dryRun` 마커가 없는 노드)에도** dry-run 배지를 확대 표시한다 — 실행 전체가 dry-run 모드였음을 사용자에게 알리기 위한 의도로 보이나, 이 확대 규칙 자체는 §7.4/§9.2/§3.3/§3.4 어디에도 문서화돼 있지 않다. `git show origin/main:.../page.tsx` 확인 결과 `executionDryRun || isDryRunOutput(...)` 로직은 이번 PR 이전부터 존재했으므로, 이번 diff 는 **신규 모순을 만든 것이 아니라** 페이지 로컬 JSX 안에 있던 기존 갭을 `ResultDetail` 공유 컴포넌트의 정식 prop 인터페이스로 승격시킨 것이다(문서화 안 된 동작의 표면적이 넓어짐).
  - 참고로 `run-results-drawer.tsx`(에디터 Run Results 드로어)는 이 prop 을 전달하지 않아 기본값 `false` 로 유지되므로, 드로어 쪽은 §9.2 의 역할 분리를 그대로 지킨다 — 두 소비처(드로어/실행상세)가 **의도적으로 다른 배지 판정 범위**를 갖게 된 것이며, 이 비대칭도 어느 spec 에도 명시돼 있지 않다.
  - 제안: CRITICAL 로 격상할 근거(작동 불가·직접 모순)는 없음 — 코드는 `origin/main` 대비 동작 변화가 없고, 두 화면 모두 여전히 정상 동작한다. 다만 project-planner 후속으로 `13-replay-rerun.md` §7.4 에 "실행 상세 페이지는 execution-level `dry_run` 이 true 이면 `_dryRun` 마커가 없는 노드에도 배지를 확대 표시한다(실행 전체 dry-run 고지 목적) — Run Results 드로어는 이 확대를 적용하지 않고 노드 레벨 `_dryRun` 마커만 본다" 한 문장을 추가해 두 소비처의 의도된 비대칭을 §9.2 옆에 명문화할 것을 권장.

- **[INFO]** `toNodeResult` 의 `inputData`/`startedAt` 매핑 추가는 기존 `NodeResult` 타입·`ResultDetail` Input 탭 계약과 완전히 정합
  - target 위치: `page.tsx` `toNodeResult(ne)` — `startedAt: ne.startedAt`, `inputData: ne.inputData` 추가
  - 충돌 대상: `codebase/frontend/src/lib/stores/execution-store.ts` `NodeResult.inputData?: unknown` / `NodeResult.startedAt?: string` (기존 optional 필드, 이번 diff 로 신설되지 않음) 및 `result-detail.tsx` 의 `result.inputData`(Input 탭)·`result.startedAt`(헤더 시각) 소비부
  - 상세: 두 필드 모두 `NodeResult` 인터페이스에 이미 optional 로 선언돼 있었고, `run-results-drawer.tsx` 경로(라이브 실행)는 이미 이 필드들을 채워 넘기고 있었다. 실행 상세 페이지(`toNodeResult`, 과거 실행 조회)만 이 두 필드를 누락시켜 Input 탭이 영구 placeholder 로 뜨고 헤더 시작 시각이 빠지는 회귀였다 — 이번 매핑 추가는 두 소비처의 계약을 뒤늦게 맞춘 것으로, 타입·컴포넌트 계약 어느 쪽과도 모순되지 않는다. 데이터 모델 충돌 아님.
  - 제안: 조치 불필요.

- **[INFO]** 이전 검토(16_27_37, 16_49_52)에서 지적된 WARNING/INFO 는 이번 최종 diff 로 실질 내용이 바뀌지 않음 — 별도 재확인만 기록
  - target 위치: (해당 없음 — 교차 참조)
  - 충돌 대상: `review/consistency/2026/07/05/16_49_52/cross_spec.md` WARNING(§10.6.1 대비 `meta`/`port`/`status`/`references` 탭 문서화 갭), `review/consistency/2026/07/05/16_27_37/cross_spec.md` WARNING(디폴트 탭 선택 우선순위 — retryable-error 예외·자동 폴백 규칙 미기재)
  - 상세: 이 두 WARNING 은 `ResultDetail` 컴포넌트 자체의 탭 집합·디폴트 선택 로직에 관한 것으로 이번 diff(`toNodeResult` 필드 매핑 + `executionDryRun` prop 복원)가 손대지 않은 영역이다. 여전히 유효한 선재 갭이지만 이번 변경으로 악화되거나 해소되지 않았다.
  - 제안: 두 WARNING 은 이전 검토 그대로 project-planner 트래킹 대상으로 유지 — 이번 V-05 최종 조치의 범위 밖.

## 요약

이번 최종 diff(`toNodeResult` 의 `inputData`/`startedAt` 매핑 추가 + `result-detail.tsx` 의 `executionDryRun` prop 복원)는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 새로운 직접 모순을 만들지 않는다. `inputData`/`startedAt` 매핑은 기존 `NodeResult` 타입·컴포넌트 계약을 뒤늦게 충족시킨 회귀 수정이라 충돌 여지가 없다. `executionDryRun` prop 은 `origin/main` 에 이미 존재하던 동작(효과 없는 노드에도 dry-run 배지 확대)을 그대로 복원한 것이라 이번 PR 이 새로 야기한 문제는 아니지만, 그 동작 자체는 `13-replay-rerun.md` §9.2(NodeExecution `_dryRun`=표시용, Execution `dry_run`=제어용 역할 분리)와 §7.4(배지는 `_dryRun` 마커 기준)의 문면과 정확히 들어맞지 않는 선재 갭이며, 드로어와 실행상세 페이지가 이제 서로 다른 배지 판정 범위를 갖는다는 사실도 문서화돼 있지 않다. 코드 결함이나 즉각 조치 필요 사항은 아니고 spec 문구 보강(§7.4 한 문장 추가)으로 해소 가능한 INFO 수준이다.

## 위험도

LOW
