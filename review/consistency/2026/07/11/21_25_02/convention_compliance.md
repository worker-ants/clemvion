# 정식 규약 준수 검토 — convention_compliance

target: `plan/in-progress/spec-draft-graph-rag-kb-token-stats-wontdo.md` (spec draft 검토, --spec)
검토 기준: `spec/conventions/**` 전체 + CLAUDE.md 명명/구조 컨벤션

## 검토 방법

target 은 `spec/5-system/10-graph-rag.md` 에 대한 **변경 제안(draft)** 이며 아직 spec 본문에 반영되지 않았다. 따라서 (a) target 플랜 문서 자체의 frontmatter/구조가 규약을 따르는지, (b) 변경안이 실제로 적용됐을 때 결과물이 규약을 따를지 두 층위로 확인했다. 대조군으로 `spec/conventions/spec-impl-evidence.md`(frontmatter lifecycle), `.claude/docs/plan-lifecycle.md`(plan frontmatter — CLAUDE.md 가 이 문서를 plan 스키마 SoT 로 명시), 그리고 `spec/5-system/10-graph-rag.md` 원문·`spec/data-flow/7-llm-usage.md` 원문을 직접 읽어 실증했다.

### 확인되어 문제 없는 항목 (참고)

- **plan frontmatter**: `worktree`/`started`/`owner` 필수 3필드 모두 존재 (`plan-lifecycle.md §4`). `spec_impact` 를 리스트(YAML `- path`)로 정확히 표기 — bare string 오류(`spec-plan-completion.test.ts` 흔한 실패형) 아님. `spec_area` 는 스키마 명시 필드는 아니나 다른 in-progress plan 8건에서도 쓰이는 기존 관행이라 이질적이지 않음.
- **spec-impl-evidence.md §3 status lifecycle 정합**: `status: implemented` 유지 + `pending_plans` 불요 판단은 §3 규약과 맞다 — `pending_plans` 의무는 "미구현 상태로 남는 약속"에 대한 책임 추적이 목적인데, 본 변경안은 그 약속 자체를 비목표로 재분류해 "구현 완료 promise 집합" 밖으로 빼내므로 잔여 미구현 promise 가 없다. `code:` 글로브도 그대로 유효(≥1 매치 유지)라 `spec-code-paths.test.ts` 에 영향 없음.
- **워크플로 순서**: 체크리스트가 `/consistency-check --spec` → spec 편집 → `spec-link-integrity` 순으로, CLAUDE.md "project-planner 는 spec/ 쓰기 직전 consistency-check --spec 의무" 와 정합 (draft 단계에서 먼저 검토받고 실제 spec 파일에는 통과 후 반영).
- **증거 인용 정확도**: 변경안이 지칭하는 라인 번호(`:92`, `:142`, `:170`) 전부 실제 파일과 정확히 일치. `LLMUsageLog`(오기) vs `LlmUsageLog`(정확한 entity casing) 대상 라인 지정도 grep 대조 결과와 일치 — 라인 92 는 이미 정확한 casing이라 수정 대상에서 제외한 것도 맞다.

## 발견사항

- **[WARNING] 신설 비목표 항목이 기존 "본문 비-목표 목록"(§8)에 반영되지 않음**
  - target 위치: "## 변경안" §4 (`§Rationale 신규 항목`)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — `기술 명세 | spec/<영역>/*.md 본문`, `결정의 배경·근거 | 해당 spec 문서 끝의 ## Rationale` (두 버킷 분리 원칙)
  - 상세: `spec/5-system/10-graph-rag.md` 는 이미 "범위 밖" 선언을 위한 두 개의 확립된 본문 위치를 갖고 있다 — 최상위 `## 8. 비-목표` (본문, 사실 선언용 bullet 목록: entity disambiguation, cross-KB linking 등)와 `## Rationale` 하위 `#### 비-목표 (범위 밖)` (근거 서술, GraphRAG community detection·Neo4j 등). 변경안 (1)~(4) 는 KB-GR-EX-07 표 셀 배지 변경과 §Rationale 신규 항목만 명시하고, 기존에 프로젝트 전역(예: `7-channel-web-chat/_product-overview.md §2 목표/비목표`, 본 문서 자체의 `## 8. 비-목표`)에서 반복적으로 쓰인 "본문 비-목표 목록에 사실을 등재" 패턴을 갱신 대상에서 빠뜨렸다. 결과적으로 "KB 단위 토큰 attribution 은 비목표" 라는 사실이 §Rationale 산문에만 존재하게 되어, `## 8. 비-목표` 만 훑는 독자(및 `spec/0-overview.md` 류의 상위 문서에서 그 절을 참조하는 cross-ref)는 이 결정을 놓치게 된다.
  - 제안: 변경안에 (5) 항목을 추가해 `## 8. 비-목표` 목록에 "KB 단위 LLM 토큰 attribution·누적 표시" bullet 을 등재. Rationale 신규 항목은 그대로 "왜" 를 담당하고, §8 은 "무엇이 범위 밖인가" 를 담당하도록 CLAUDE.md 의 본문/Rationale 분리를 그대로 따르면 된다.

- **[INFO] "⛔ 비목표" 상태 심볼이 요구사항-상태 표에서 무선례(無先例) 도입이며 spec/conventions/** 어디에도 레전드가 없음**
  - target 위치: "## 변경안" §1 (`KB-GR-EX-07(:92)`: `✅` → `⛔ 비목표`)
  - 위반 규약: 직접적 위반은 없음 — spec/conventions/** 에 요구사항-상태 표 심볼 레전드를 정의한 문서가 존재하지 않아 target 이 어길 "정식 규약" 자체가 없다. 다만 review 관점 1(명명 규약)·3(문서 구조 규약) 상 참고할 SoT 부재를 짚는다.
  - 상세: `grep` 조사 결과 `spec/5-system/*.md` 의 요구사항 표(`필수`/`권장`/`선택` 우선순위 컬럼 + 상태 컬럼)에서 "⛔" 가 상태값으로 쓰인 사례는 전무하다(도입 시 본 target 이 최초). 반면 `spec/0-overview.md §6.3` 은 "로드맵/미구현" 을 `❌` 로 표기하는 다른 관례를 이미 쓰고 있고, `⛔` 자체는 `spec/2-navigation/0-dashboard.md`·`14-execution-history.md` 에서 **실행 런타임 status(`cancelled`)** 아이콘으로 이미 쓰이고 있어(제품 요구사항 lifecycle 과는 다른 의미 도메인) 향후 다른 문서가 이 신규 용례를 그대로 따르면 두 의미 도메인이 부딪힐 여지가 있다.
  - 제안: (a) 이번 건은 `⛔` 대신 기존 관례와 일관된 표기(예: `❌ 비목표` 또는 텍스트만 `비목표`, 컬러 심볼 생략)를 검토하거나, (b) 반복 사용할 의도라면 `spec/conventions/` 에 요구사항-상태 심볼 레전드를 신설해 SoT 로 삼는 편을 권장(현재는 규약 부재이므로 target 의 선택이 강제로 틀린 것은 아님).

## 요약

target 플랜의 frontmatter·워크플로 순서·`spec-impl-evidence.md` status lifecycle 적용·증거 라인 인용은 모두 정식 규약과 정합하며, 특히 "비목표 재분류로 `pending_plans` 의무를 우회하지 않고 §3 규약 취지 그대로 충족"시키는 설계는 규약을 정확히 이해하고 있음을 보여준다. 다만 실제 변경 적용 시 (1) 기존에 확립된 "## 8. 비-목표" 본문 목록 갱신이 변경안에서 누락돼 CLAUDE.md 의 본문/Rationale 정보 분리 원칙과 어긋날 소지가 있고, (2) 신규 도입하는 `⛔ 비목표` 상태 심볼이 무선례이며 다른 문서의 기존 `⛔`(실행 상태) 의미와 충돌 여지가 있다 — 다만 후자는 spec/conventions/** 가 애초에 이 영역을 규정하지 않아 명백한 "위반"은 아니다. CRITICAL 은 없다.

## 위험도
LOW
