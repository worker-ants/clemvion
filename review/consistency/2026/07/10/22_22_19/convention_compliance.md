# 정식 규약 준수 검토 — `spec/data-flow/7-llm-usage.md`

검토 모드: `--impl-done` (scope=`spec/data-flow/7-llm-usage.md`, diff-base=`origin/main`)

## 발견사항

- **[CRITICAL] 구현 diff 가 닫은 attribution 갭을 target 문서가 여전히 "미배선/NULL" 로 서술 (SoT 붕괴)**
  - target 위치:
    - `spec/data-flow/7-llm-usage.md` §1.3 캐터로그 표, "AI Agent 자동 메모리 롤링 요약 압축" 행 (L107): `context 미전달 → workflow_id / execution_id / node_execution_id 전부 NULL (노드 내부 실행이나 아직 미배선 — 잔여 갭)`
    - 같은 절 attribution 채움 현황 콜아웃 (L113): `**잔여 NULL** 은 워크플로우 밖·non-node caller(...)와 노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축뿐이다.`
    - §4 외부 의존 표, Agent Memory 행 (L162): `추출 processor chat + 롤링 요약 압축 chat (usage 적재, context NULL)`
    - Rationale "`llm_usage_log` 의 nullable context 컬럼들" (L204-208): `(b) LlmCallContext 가 아직 배선되지 않은 caller(RerankService listwise grading, AI Agent 자동 메모리 롤링 요약 압축)뿐이다`
  - 위반 규약: CLAUDE.md 정보 저장 위치(단일 진실 원칙) 표의 `기술 명세 | spec/<영역>/*.md 본문` 및 `## Skill 체계` 의 `"구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임"` 규칙. 문제 의식 자체는 `spec/conventions/spec-impl-evidence.md` §Overview("spec 가 약속한 surface 가 *지금* 구현됐는가" 갭)와 동일하나, `spec/data-flow/**` 는 §1 에서 frontmatter-evidence 빌드가드 대상에서 명시적으로 제외돼 있어(L47) **본 문서 종류에 대해서는 이런 수동 검토가 유일한 안전망**이다.
  - 상세: 제출된 `git diff origin/main...HEAD` 는 `ai-turn-executor.ts`(단발 §1159 부근 + resume §2287 부근), `ai-memory-manager.ts`, `agent-memory-injection.ts` 3개 파일에 걸쳐 **AI Agent 자동 메모리 롤링 요약 압축 chat 호출에 `LlmCallContext`(`workflowId`/`executionId`/`nodeExecutionId`) 를 명시적으로 배선**한다 — 단발 경로는 `context.*`, resume 경로는 재구성 `state.*` (target 문서가 §1.3/§Rationale 에서 이미 AI Agent 메인 chat 에 적용한 것과 동일한 패턴). 코드 자체도 `// [Spec 7-llm-usage §1.3]` 주석으로 이 문서 절을 직접 인용하며 이 변경을 정당화하고 있어(`ai-turn-executor.ts`, `ai-memory-manager.ts`, `agent-memory-injection.ts` 각 diff hunk), 구현자가 §1.3 을 갱신 대상으로 인지했음에도 실제로는 `spec/` 을 건드리지 않았다(developer 역할은 `spec/` read-only 라 당연한 결과지만, 그렇다면 project-planner 위임이 뒤따랐어야 함). 결과적으로 target 문서는 이제 **네 곳에서 사실과 다른 진술**을 하고 있다 — "AI Agent 메모리 롤링 요약 압축은 아직 미배선(NULL)" 이라는 주장은 이 diff 가 반영된 HEAD 워킹트리에서는 더 이상 참이 아니다. 이는 §1.3 콜아웃이 스스로 표방하는 "단일 진실" 원칙(L113 "상세는 §Rationale 의 ... 항에 일원화 — 단일 진실")을 이 문서 자신이 위반하는 상태다.
  - 제안: `spec/` 쓰기 권한을 가진 `project-planner` 가 아래를 갱신 (developer 는 spec read-only 이므로 본 리뷰가 차단 사유):
    1. §1.3 표의 "AI Agent 자동 메모리 롤링 요약 압축" 행을 AI Agent 메인 chat 행과 동일한 패턴으로 정정 — `context` 미전달 → **채움**(단발 `context.*`, resume `state.*`).
    2. L113 콜아웃에서 "AI Agent 메모리 롤링 요약 압축" 을 잔여 NULL 목록에서 제거.
    3. §4 Agent Memory 행(L162)에서 "롤링 요약 압축 chat" 을 "usage 적재, context 채움(추출 processor 만 NULL)" 으로 정정.
    4. Rationale (b) 항목(L204-208)에서 "AI Agent 자동 메모리 롤링 요약 압축" 을 제거하고 완결 시점(예: 2026-07)을 기존 "2026-07 완결" 서술과 통합.

## 요약

target 문서의 문서 구조(Overview/본문/Rationale 3섹션)·명명 규약(`workflow_id`/`execution_id`/`node_execution_id` snake_case DB 컬럼 vs `LlmCallContext`/`workflowId` 등 camelCase TS 필드 구분, `ExecutionContext` 계열과의 필드명 일치)·frontmatter 규약(`spec/data-flow/**` 는 `spec-impl-evidence.md` §1 에서 명시적으로 frontmatter 의무 제외 — 현재 frontmatter 없음은 정상)은 모두 정식 규약을 준수한다. 다만 `--impl-done` 모드의 핵심 관점인 "spec 본문 vs 실 구현 diff 정합성" 검사에서, 제출된 diff 가 정확히 닫은 attribution 갭("AI Agent 자동 메모리 롤링 요약 압축")을 target 문서가 4개 위치(표 행·콜아웃·외부의존 표·Rationale)에서 여전히 "미배선/NULL" 로 서술해 문서 자신이 표방하는 단일 진실(SoT) 원칙과 CLAUDE.md 의 spec-갱신 위임 규약을 위반한다. 이는 자동 가드가 없는 `spec/data-flow/**` 영역이라 이번 수동 검토가 유일한 안전망이므로 병합 전 project-planner 위임으로 정정이 필요하다.

## 위험도

HIGH
