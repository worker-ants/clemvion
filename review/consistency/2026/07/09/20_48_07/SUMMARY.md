# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

대상: `spec/5-system/4-execution-engine.md` (모드: `--impl-done`, scope diff-base `origin/main`, PR #501 회귀 수정 `fix-resume-turn-usage-log-attribution`)

## 전체 위험도
**LOW** — CRITICAL/WARNING 0건, INFO 다수(대부분 checker 간 중복). 5개 checker 전원이 이번 diff(멀티턴 resume/retry 재구성 시 `nodeExecutionId`/`workflowId` 재주입으로 provider-tool usage-log attribution 버그 수정)를 spec 원칙("checkpoint 는 credential-free 부분집합만 영속, 재개 시 재유도") 위반 없는 정합화 수정으로 판정.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec + rationale_continuity + convention_compliance | §1.3 "credential/context-binding 필드는 재개 시 `node.config` 재평가로 재유도"라는 문구가 `CREDENTIAL_CONTEXT_FIELDS` 에 합류한 `nodeExecutionId`(및 기존 `workflowId`)의 실제 재유도 경로(호출측이 `execution.workflowId`/재개 대상 `NodeExecution` row id 를 opts 로 주입 — `node.config` 아님)를 정확히 포괄하지 못함. 신규 모순 아님(`workflowId` 도 diff 이전부터 동일 패턴), 같은 Rationale 의 "신규 핸들러는 자기 runtime state 를 allow-list 에 등록해야 지원(점진 확장)" 문구가 이런 확장을 예견 | §1.3 ↔ `resume-state.schema.ts`/`buildRetryReentryState` | 필수 아님. 차기 spec 정리 시 §1.3 문구를 "node.config 재평가 또는 호출측 컨텍스트(execution/NodeExecution row 등 opts)로 재유도"로 세분화 |
| 2 | rationale_continuity | resume/retry 턴 provider-tool `logUsage` attribution 이 성립하려면 resumeState 가 `nodeExecutionId`/`workflowId` 를 운반해야 한다는 신규 불변식이 spec 본문(§1.3/§10.3)에 미기재 — §10.3 "각 노드 호출 직전 새로 배정"은 최초 dispatch 경로만 다룸. 회귀 테스트로만 강제 | §1.3, §10.1/§10.3 | §1.3 또는 §10.3 근처에 불변식 1줄 크로스 레퍼런스, 또는 Rationale #501 addendum |
| 3 | convention_compliance | (pre-existing, diff 무관) 헤딩 넘버링 드리프트 — `### 10.3/10.4` 가 `## 11.` 본문 중간에 등장 | 4-execution-engine.md 1230~1274행 | §10 아래 재배치 또는 `### 11.x` 재부여 |
| 4 | naming_collision | 코드 주석의 `(§1.3)` 인용이 실제로는 §6.2/§7.2 를 가리키는 anchor 부정합 가능성 | 코드 주석 ↔ §1.3/§6.2/§7.2 | 앵커 참조 정정(비차단) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델·API·요구사항 ID·상태 전이·RBAC·계층 책임 충돌 없음 |
| rationale_continuity | LOW | 기각 대안 재도입·원칙 위반 없음. INFO 2건(재유도 문구=#1, attribution 불변식 미기재=#2) |
| convention_compliance | LOW | 규약 위반·frontmatter/`code:` 드리프트 없음. INFO 2건(헤딩=#3, §1.3=#1) |
| plan_coherence | NONE | 전담 plan 체크박스가 diff 와 1:1, `spec_impact: none` 정합. 0건 |
| naming_collision | NONE | 신규 식별자 없음. `nodeExecutionId` 는 확립된 의미의 정확한 재사용. INFO(anchor=#4) |

## 운영 참고 (checker 인프라)

`convention_compliance`·`plan_coherence` 는 `status=success` 인데 개별 `output_file` 이 세션 디렉터리에 미생성(알려진 Workflow sub-agent 간극). 전체 답변은 workflow journal(`wf_b6b05286-844/journal.jsonl`)에서 회수해 본 SUMMARY 에 반영했으므로 통합 결론은 영향 없음.

## 권장 조치사항 (전부 선택·비차단)

1. §1.3 재유도 문구를 "node.config 재평가 또는 호출측 컨텍스트(execution/NodeExecution row)로 재유도"로 세분화 (planner).
2. §1.3/§10.3 근처에 resume/retry provider-tool usage-log attribution 불변식 1줄 추가 (planner).
3. (pre-existing) §10.3/§10.4 헤딩 재배치.
