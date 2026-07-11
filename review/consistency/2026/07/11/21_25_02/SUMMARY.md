# Consistency Check 통합 보고서 (--spec graph-rag 정직화)

> journal 복구: cross_spec = ⛔ glyph WARNING(W2 와 수렴), Critical 0. **5/5 checker Critical 0, BLOCK: NO 확정**. W1(§8 비-목표 목록 등재)·W2(⛔→❌ 재사용) 반영.

**BLOCK: NO** — 확보된 4개 checker(rationale_continuity / convention_compliance / plan_coherence / naming_collision) 결과에서 Critical 발견 없음.

**단, 중요 caveat**: `cross_spec` checker 는 workflow 로부터 `status=success` 로 보고되었으나 실제 output 파일(`cross_spec.md`)이 세션 디렉토리(`review/consistency/2026/07/11/21_25_02/`)에 존재하지 않는다 (`ls` 확인, `_prompts/cross_spec.md` 프롬프트 파일만 존재하고 결과 파일은 부재). 이는 알려진 "Workflow disk-write 갭" 패턴(sub-agent 가 success 를 주장해도 실제로 파일을 쓰지 못해 checker 가 조용히 카운트에서 빠지는 사례, PR #901 유사 실사고)과 정확히 일치한다. journal.jsonl 등 복구 가능한 부가 로그도 세션 디렉토리·스크래치패드에서 발견되지 않아 내용 복구가 불가능했다. **cross_spec 의 실제 발견사항(특히 Critical 유무)은 검증되지 않은 상태이므로, 본 BLOCK:NO 는 잠정적이다 — cross_spec 재실행 후 최종 확정 필요.**

## 전체 위험도
**LOW** (검증된 4개 checker 기준) — cross_spec 미검증으로 인한 불확실성 존재. 확보된 범위 내에서는 CRITICAL 없음, WARNING 2건(중복 통합) + INFO 다수.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 확보된 4개 checker 기준 Critical 발견 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance (WARNING) + rationale_continuity (INFO, 통합) | 신설 비목표 결정("KB 단위 토큰 attribution/누적 표시")이 `spec/5-system/10-graph-rag.md` 가 이미 확립한 "본문 비-목표 목록"(`## 8. 비-목표`)과 "Rationale 하위 비-목표 목록"(`#### 비-목표 (범위 밖)`) 중 어느 쪽에도 bullet 로 등재되지 않고 신규 §Rationale 산문에만 존재 — CLAUDE.md "본문=기술 명세 / Rationale=결정의 배경·근거" 분리 원칙과 본 문서 자체의 기존 관행에서 벗어남 | `plan/in-progress/spec-draft-graph-rag-kb-token-stats-wontdo.md` "변경안" §4 (§Rationale 신규 항목) | `spec/5-system/10-graph-rag.md` `## 8. 비-목표`(:578-584), `## Rationale` 하위 `#### 비-목표 (범위 밖)`(:619-622) | 변경안에 (5) 항목 추가: `## 8. 비-목표` 목록에 "KB 단위 LLM 토큰 attribution/누적 표시 — LlmUsageLog KB FK 부재 + GraphExtractionService context 의도된 NULL(data-flow §7)로 비목표" bullet 등재 (필수는 아니나 정합 보완 권장) |
| 2 | naming_collision (WARNING) + convention_compliance (INFO, 통합) | `⛔` 상태 아이콘을 요구사항 상태 컬럼의 "비목표" 값으로 신규 도입 — 이 리포에서 `⛔` 는 이미 (a) 실행(execution) status "취소됨"(cancelled), (b) plan 항목 상태 "BLOCKED/WITHDRAWN" 두 의미로 확립돼 있어 세 번째 의미가 겹침. `10-graph-rag.md` 자체 요구사항 표는 현재 `✅`/`❌` 두 값만 사용 중이라 `⛔` 는 이 파일에도 처음 등장 | `plan/in-progress/spec-draft-graph-rag-kb-token-stats-wontdo.md` "변경안" §1 (`KB-GR-EX-07`: `✅` → `⛔ 비목표`) | `spec/2-navigation/0-dashboard.md:88`, `spec/2-navigation/14-execution-history.md:86` (실행 상태 "취소됨"), `plan/in-progress/execution-engine-residual-gaps.md:45`, `plan/complete/spec-draft-g1-withdraw-ws-start-gate.md:56` (plan BLOCKED/WITHDRAWN) | 새 glyph 대신 기존 `❌` 재사용 + 괄호 텍스트로 의미 구분(예: `❌ (비목표 — data-flow §7 참조)`). 반복 사용할 의도라면 `spec/conventions/` 에 요구사항-상태 심볼 레전드 신설 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | 동일 spec 파일(`10-graph-rag.md`)을 후속 편집 대상으로 언급하는 `plan/in-progress/rag-dynamic-cut.md` 의 KB-GR-SR-05 항목이 실측상 이미 반영됐음에도 미체크(stale checkbox) 상태로 남아 있음. target 편집 라인과는 겹치지 않아 충돌은 아님 | `plan/in-progress/rag-dynamic-cut.md` "비차단 후속" 절 | target 커밋 후 `rag-dynamic-cut.md` 의 KB-GR-SR-05 stale 체크박스를 갱신(또는 이미 반영됐음을 주석)할 것을 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | **재시도 필요** | status=success 보고되었으나 output 파일 부재(디스크 write 갭). 내용 복구 불가 — 재실행 필수 |
| rationale_continuity | LOW | 신설 비목표가 기존 "비목표" 이중 목록에 미반영(INFO, WARNING 1 로 통합). 그 외 과거 Rationale 번복·근거 날조 없음, 인용 문구 실재성 확인 |
| convention_compliance | LOW | §8 본문 비-목표 목록 미반영(WARNING), `⛔` 무선례/SoT 부재(INFO, WARNING 2 로 통합). frontmatter·워크플로 순서·status lifecycle 적용은 규약 정합 |
| plan_coherence | NONE | `rag-dynamic-cut.md` stale checkbox 교차참조 누락(INFO). 병렬 plan 충돌·선행 조건 미해결 없음 |
| naming_collision | LOW | `⛔` glyph 3중 의미 충돌(WARNING). 요구사항 ID·엔티티 casing 정정 등 나머지는 충돌 없음 |

## 권장 조치사항
1. **(최우선, BLOCK 재확정 필요)** `cross_spec` checker 를 재실행할 것. workflow 는 `status=success` 로 보고했으나 세션 디렉토리에 `cross_spec.md` 산출물이 존재하지 않아 내용을 검증할 수 없었다 — 알려진 "Workflow disk-write 갭"(status=success 인데 파일 부재 → summary 가 실제 발견사항을 누락)에 해당. 재실행 결과에 Critical 이 있으면 본 BLOCK 판정은 즉시 YES 로 뒤집힐 수 있다.
2. 변경안에 (5) 항목을 추가해 `spec/5-system/10-graph-rag.md` `## 8. 비-목표` 목록에 "KB 단위 LLM 토큰 attribution/누적 표시" bullet 을 등재해 본문/Rationale 정보 분리 원칙과 기존 이중 목록 관행에 맞출 것.
3. `KB-GR-EX-07` 상태값에 신규 `⛔` glyph 대신 기존 `❌` 를 재사용(괄호로 "비목표" 명시)하거나, 반복 사용할 의도라면 `spec/conventions/` 에 요구사항-상태 심볼 레전드를 신설해 실행 status/plan status 의 기존 `⛔` 용법과 명시적으로 분리할 것.
4. (선택) target 커밋 후 `plan/in-progress/rag-dynamic-cut.md` 의 KB-GR-SR-05 stale 체크박스를 갱신할 것.