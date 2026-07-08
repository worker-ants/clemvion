---
name: spec-draft-cross-audit-doc-batch
worktree: spec-doc-batch-v13-v18-762507
owner: planner
started: 2026-07-05
spec_impact:
  - spec/4-nodes/3-ai/0-common.md
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/4-nodes/3-ai/3-information-extractor.md
  - spec/3-workflow-editor/0-canvas.md
  - spec/3-workflow-editor/3-execution.md
  - spec/2-navigation/14-execution-history.md
  - spec/5-system/13-replay-rerun.md
  - spec/7-channel-web-chat/3-auth-session.md
---

# spec-doc 배치 draft — V-13 하향 + V-05/V-14 spec-doc + V-18 재검증

cross-audit 잔여 기획 항목(V-13·V-18) + 완료 PR(V-05·V-14) spec-doc 부채를 한 세션에 일괄.
전부 spec 본문/Rationale 정정이며 코드 변경 없음.

## V-13 [minor] 캔버스 요약 summaryTemplate — spec 하향

**근거(재검증)**: `getConfigSummary`(`node-config-summary.ts:89`)는 `def.summaryTemplate` 이 있어야 요약을 렌더한다. `summaryTemplate` 은 **text_classifier 만** 보유(`text-classifier.schema.ts:234`), ai_agent·information_extractor 는 부재 → 두 노드는 캔버스 요약이 **렌더되지 않는다**. spec §8 이 약속한 `{mode}·{model}·{N} KB·{N} MCP…` 조합은 조건부 세그먼트·`Multi Turn` 접두어 때문에 현 mustache summaryTemplate DSL 로 표현 불가. 추가로 `{N} tools` 는 **제거된 Tool Area**(`1-ai-agent.md §1` "도구 연결 입력 경로 — 재작성 예정(현재 제거됨)") 참조라 이중 stale.

**방향**: spec 하향(Planned 마킹) + stale `{N} tools` 정정. text_classifier 는 구현됨(유지).

### 변경 1 — `spec/4-nodes/3-ai/0-common.md §8. 캔버스 요약`
- AI Agent 행: 요약 포맷을 **"(구현 예정 — summaryTemplate DSL 로 조건부 조합 표현 불가. 현재 요약 미표시)"** 로 하향. 예시의 `· {N} tools` 세그먼트는 Tool Area 제거에 맞춰 **삭제**.
- Info Extractor 행: 동일하게 **"(구현 예정 — 현재 요약 미표시)"** 하향.
- Text Classifier 행: 변경 없음(`summaryTemplate` 구현됨).

### 변경 2 — `spec/4-nodes/3-ai/1-ai-agent.md §11. 캔버스 요약`
- "공통 §8 AI Agent 행 인용" 아래에 **"⚠ 현재 미구현(Planned): summaryTemplate 부재로 캔버스 요약 미표시. §8 참조"** 추가. `{N} tools` 예시 삭제.

### 변경 3 — `spec/4-nodes/3-ai/3-information-extractor.md §8. 캔버스 요약`
- 동일 Planned 주석 추가.

### 변경 3b — `spec/3-workflow-editor/0-canvas.md §5.3 노드 설정 요약` (미러 **2곳** 모두)
- (i) §5.3.1 예시(`gpt-4o · 2 tools · 1 KB`, line 306): `· 2 tools` 세그먼트(제거된 Tool Area) 삭제.
- (ii) §5.3.4 노드별 요약 포맷 표(line 398, `AI Agent | {모델} · {N} tools · {N} KB …`): `· {N} tools` 삭제 + AI Agent 요약이 현재 미표시(Planned)임을 §8 참조로 주석. (rationale WARNING — 같은 절 두 미러 동시 처리.)

## V-18 [minor] 위젯 재로드 복원 시퀀스 — 보류 + spec v1 범위 명시

**재검증(정정)**: `codebase/channel-web-chat/src/widget/use-widget.ts` 는 `getStatus` 를 호출하되 `seedWaitingFromStatus`(line 219-245)가 **`waiting_for_input` 성공 케이스만** 처리한다 — 200+종료·404·401·네트워크 오류는 모두 `catch { console.warn }` 로 soft-fail 하고, `applyConfig` 가 결과와 무관하게 `openStream`(SSE) 을 호출한다. spec §3.1 의 200/404/401 분기 + `401 → 낙관적 refresh 1회` 경로는 **미구현**이다(초기 "정합" 판단은 getStatus 호출만 보고 내린 오판 — plan_coherence CRITICAL 로 정정). 즉 V-18 갭은 실재한다.

**방향(plan 권장 = 보류 + spec 명시)**: 구현 범위가 크고 추적 활성 항목이 0 이므로, v1 의 실제 부분 범위를 §3.1 에 정직하게 표기하고 완전 구현은 별도 결정으로 남긴다.

### 변경 (신규) — `spec/7-channel-web-chat/3-auth-session.md §3.1 재로드 복원 시퀀스`
- §3.1 상단(또는 단계 2 근처)에 **v1 구현 범위 주석** 추가: "**v1 현황**: 위젯은 `getStatus` 응답이 `waiting_for_input` 이면 그 표면만 시드한 뒤 SSE 를 연다. 200+종료·404·복구불가 401 의 REST 분기와 `401 → 낙관적 refresh 1회` 는 **Planned(미구현)** — 현재는 종료/오류를 SSE terminal 이벤트(버퍼 5분 내) 또는 soft-fail 로 처리한다. 완전 §3.1 시퀀스는 후속." (본문 200/404/401 서술은 목표 계약으로 유지하되 Planned 임을 명시.)

## V-05 spec-doc — 실행 상세 노드 서브탭 부채 (PR #817 파생)

### 변경 4a — `spec/3-workflow-editor/3-execution.md §10.6.1 서브 탭` (SoT 갱신)
- §10.6.1 이 서브탭 SoT 인데 PR #817 로 추가된 **Meta / Port / Status / References** 탭이 아직 미열거(stale, cross_spec/naming WARNING). 탭 표(라인 502 근처)에 4탭을 조건부 노출로 추가: Meta(관찰성 meta 존재 시)·Port(port selector 존재 시)·Status(status directive 존재 시)·References(AI 노드 KB 시도 시). 실제: `result-detail.tsx:255-271`.

### 변경 4b — `spec/2-navigation/14-execution-history.md §3.3 노드 결과 패널`
- "서브 탭(노드 레벨)" 서술이 Preview/Input/Output/LLM Usage/Config/Error 만 열거한다. 서브탭 SoT 를 editor spec `spec/3-workflow-editor/3-execution.md §10.6.1`(변경 4a 로 Meta/Port/Status/References 포함) 로 위임하는 참조 문구 추가(두 surface 동일 `ResultDetail` 컴포넌트, PR #817).

### 변경 5 — `spec/2-navigation/14-execution-history.md ## Rationale`
- 신규 Rationale 항목: **Config 탭이 viewer 롤에도 노출되지만 config echo 는 서버 boundary(`handler-output.adapter.ts` `maskSensitiveFields`)에서 DB/WS/REST 보편 마스킹되므로 민감정보 노출 없음** (role-gating 아닌 masking parity. ai-review security/rationale 확인 근거).

### 변경 6a — `spec/5-system/13-replay-rerun.md §7.4 dry-run 결과 표시`
- "노드 카드에 🧪 dry-run 배지" 아래에, **실행 상세 페이지는 `Execution.dry_run`(§9.2, execution-level)도 반영**해 `_dryRun` 마커가 없는 비-effect 노드(§9.2: 마커는 effect 노드 output 에만 심김)도 dry-run 실행 중이면 배지를 표시한다는 노트 추가. (에디터 드로어는 노드 마커만.)

### 변경 6b — `spec/5-system/13-replay-rerun.md §9.2` (문면 충돌 해소)
- §9.2 의 "NodeExecution `_dryRun`=표시용 / Execution `dry_run`=제어용" 이분법 서술에, **실행 상세 페이지 배지는 표시 목적으로도 `Execution.dry_run` 을 함께 참조**한다는 단서를 추가해 §7.4 변경과 문면 충돌 제거(rationale WARNING). 실제 구현·테스트: `result-detail.tsx`·`execution-detail-waiting.test.tsx`(PR #817).

## V-14 spec-doc — Re-run 모달 부채 (PR #819 파생)

### 변경 7 — `spec/5-system/13-replay-rerun.md §10.2 Re-run 모달` 필드 동작 표
- "입력 데이터 폼" 행에 **fallback 각주**: manual_trigger 노드 스키마 부재(노드 삭제 등) 시 원본 `inputData.parameters` 키를 untyped text 로 fallback.
- "원본 실행 헤더" 행("ID 클릭 시 새 탭") 에 **§3.7 chain badge 는 같은 탭(의도적 구분)** 상호 각주.

### 변경 8 — `spec/2-navigation/14-execution-history.md §3.7 Re-run 액션`
- chain badge "같은 탭" 서술에 **§10.2 모달 ID 링크는 새 탭(의도적 구분)** 상호 각주.

## Rationale

전 항목 코드 변경 없는 spec 정직화. V-13 은 DSL 표현 한계로 Planned 하향(구현 비용 대비 cosmetic, 0-common·1-ai-agent·3-IE·0-canvas 동시). V-18 은 실재 갭 — v1 부분 범위(getStatus→waiting 시드만, 200/404/401 분기·refresh 는 Planned)를 §3.1 에 정직 표기하는 **보류+명시**(구현은 별도 결정). V-05·V-14 는 완료 PR 이 남긴 spec-doc 갭(§10.6.1 탭 SoT 갱신+§3.3 위임·masking Rationale·dry-run execution-level 스코프 §7.4/§9.2·fallback·new-tab vs same-tab UX 구분) 보강. new-tab vs same-tab 은 두 진입점의 의도적 UX 차이를 상호 각주로 명문화.
