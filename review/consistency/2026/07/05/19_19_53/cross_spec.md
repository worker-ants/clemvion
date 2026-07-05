# Cross-Spec 일관성 검토 — spec-draft-cross-audit-doc-batch

검토 대상: `plan/in-progress/spec-draft-cross-audit-doc-batch.md`
검토 관점: target 이 정정하려는 8개 변경(V-13/V-18/V-05/V-14)이 다른 spec 영역(`3-workflow-editor/3-execution.md §10.6.1`, `5-system/13-replay-rerun.md §9.2`, `node-config-summary.ts`, conventions)과 충돌하는지, 서술이 코드 현실과 맞는지.

## 발견사항

- **[WARNING]** 변경 4 가 위임하는 SoT(`3-execution.md §10.6.1`) 자체가 stale — Meta/Port/Status/References 탭 누락
  - target 위치: 변경 4 (`### 변경 4 — spec/2-navigation/14-execution-history.md §3.3 노드 결과 패널`)
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md §10.6.1 서브 탭` 의 탭 표(495-504행)
  - 상세: 변경 4는 execution-history §3.3 의 탭 열거(Preview/Input/Output/LLM Usage/Config/Error)가 불완전하다며 SoT 를 editor spec `§10.6.1` 로 위임하려 한다. 그런데 실제 `result-detail.tsx`(PR #817 이후 두 surface 공유 컴포넌트)에는 `meta`/`port`/`status`/`references` 탭이 추가로 존재하는데(`detailTabs` 배열, `result-detail.tsx:254-267`), `3-execution.md §10.6.1` 의 탭 표(469-504행)에는 이 4개 탭이 전혀 언급되지 않는다. 즉 target 이 "SoT" 라고 지정하는 문서 자체가 코드보다 뒤처져 있다 — 위임만으로는 execution-history 독자가 실제 탭 구성(Meta/Port/Status/References 포함)을 알 수 없다. `§10.6.1` 은 이번 spec_impact 목록(`spec/3-workflow-editor/3-execution.md` 미포함)에 들어있지 않아 이 배치에서 갱신되지 않을 것으로 보인다.
  - 제안: 이번 배치 범위를 `3-execution.md §10.6.1` 탭 표까지 확장하거나(가장 정직한 해法), 최소한 변경 4 문구에 "editor spec §10.6.1 도 currently 갱신 필요(별도 후속)" 라는 stale 경고를 남겨 두 문서가 동시에 불완전한 상태로 남지 않게 한다. 그렇지 않으면 이번 배치가 "위임"만 하고 실제로는 두 문서 모두 Meta/Port/Status/References 를 어디에도 정확히 기술하지 않는 상태가 고착된다.

- **[INFO]** V-13 근거 텍스트의 섹션 번호 오기재 (`1-ai-agent.md §1` → 실제는 §4)
  - target 위치: `## V-13 [minor] 캔버스 요약 summaryTemplate — spec 하향` 근거 문단, "`1-ai-agent.md §1` "도구 연결 입력 경로 — 재작성 예정(현재 제거됨)"" 인용부
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` 실제 목차 — 해당 경고 문구는 `## 4. Tool Area 연동` (232행) 에 있으며 `## 1. 설정 (config)` (30행) 은 config 필드 정의 섹션으로 무관.
  - 상세: 근거 인용의 섹션 번호가 틀렸으나, target 이 실제로 지시하는 변경(변경 2 = "§11. 캔버스 요약")은 올바른 섹션을 정확히 가리키고 있어 실질적 편집 결과에는 영향이 없다. 다만 근거 서술의 신뢰성을 위해 정정 권장.
  - 제안: draft 편집 시 "§1" → "§4" 로 정정(spec 본문 변경과 무관, plan 문서 자체 오탈자).

- **[INFO]** V-13 하향 이후 `1-ai-agent.md §11` 예시 문자열에 `{N} tools` 잔존 확인
  - target 위치: 변경 2 (`{N} tools` 예시 삭제 지시)
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §11` 현재 텍스트(1130-1136행) — "예: `gpt-4o · 2 tools · 1 KB · 1 MCP · 3 cond`" 가 여전히 존재
  - 상세: target 의 지시(`{N} tools` 예시 삭제)는 방향이 옳고 현재 stale 텍스트와 정확히 일치하는 대상을 가리키고 있다. 문제라기보다 검증 확인 — 변경 실행 시 이 라인이 반드시 갱신 대상에 포함되어야 한다(§11 전체를 "Planned" 주석으로 바꾸면서 예시 라인도 삭제/수정 필요, 안 하면 "Planned" 주석과 구체 예시가 같은 섹션에 모순 공존).
  - 제안: 실행 단계에서 §11 예시 라인이 실제로 편집됐는지 커밋 후 diff 확인.

## 요약

target 의 8개 변경 각각의 코드/기존 spec 근거(summaryTemplate 부재, `handler-output.adapter.ts` masking, `Execution.dry_run` §9.2 execution-level 정의, `rerun-modal.tsx` new-tab/`14-execution-history.md §3.7` same-tab, manual_trigger schema fallback)는 실제 코드·spec 원문과 대조한 결과 모두 정확하다 — CRITICAL 급 모순은 발견되지 않았다. 다만 변경 4가 서브탭 열거의 SoT 로 위임하려는 `3-execution.md §10.6.1` 자체가 PR #817 로 추가된 Meta/Port/Status/References 탭을 반영하지 못한 stale 상태이며, 이번 배치의 `spec_impact` 목록에도 포함되지 않아 위임만으로는 두 문서 모두 실제 탭 구성을 완전히 기술하지 못하는 간극이 남는다. 나머지는 참조 오탈자 수준의 INFO 이다.

## 위험도

LOW
