# Consistency Check 통합 보고서 (--impl-done spec/5-system/)

**BLOCK: NO** — `SECRET_LEAK_PATTERNS` 확장(bare JWT + URI userinfo, `shared/utils/sanitize-error-message.ts`) 변경에 대해 5개 checker 전수 확인, Critical 위배 없음.

> **orchestrator payload 참고**: `_prompts/*.md` 의 target 은 template anchor(무관 spec 덤프) — 5개 checker 모두 `git diff origin/main...HEAD`(실제: shared util 2 regex + 테스트, spec 변경 0) 를 SoT 로 재검토.

## 전체 위험도: LOW

Critical 0 / Warning 1(deferred).

## Critical

| # | Checker | 위배 |
|---|---------|------|
| - | - | (없음) |

## 경고 (WARNING)

| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| 1 | cross_spec | `spec/5-system/11-mcp-client.md` §8.3/Rationale(587) 가 "URL userinfo 는 공용 `SECRET_LEAK_PATTERNS` 미커버 → MCP 전용 `MCP_EXTRA_SECRET_PATTERNS` 로 보강" 이라 서술하는데, 이번 확장으로 공용 패턴이 URI-userinfo 를 커버해 서술이 **half-stale**(기능 회귀는 없음 — MCP 패턴 선행·scheme 보존이라 상호보완). | **Deferred** — 기존 `plan/in-progress/spec-sync-mcp-client-gaps.md`(mcp-client spec 갭 추적) 범주의 doc-sync + MCP 패턴 dedup. 별도 follow-up task 분리. |

## 참고 (INFO)

| # | Checker | 항목 |
|---|---------|------|
| 1 | rationale·convention | 위 mcp-client §8.3 staleness 를 INFO 로도 확인(공용 SoT 재사용 원칙엔 부합). |
| 2 | convention | 신규 URI-userinfo 패턴은 whole-match(`***host`, scheme 손실) — `http-request.handler.ts sanitizeUrlCredentials()`(scheme 보존)와 다른 레이어, 규약 위반 아님. |
| 3 | plan_coherence | `plan/in-progress/spec-sync-mcp-client-gaps.md` L79 `task_fa96e218(에러 message redaction)` 잔여와 본 diff 가 겹침(미교차참조). |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | LOW | 데이터모델·API·상태전이 충돌 없음. mcp-client §8.3 staleness WARNING(deferred). |
| rationale_continuity | LOW | R17 SoT-reuse 준수, P1-1/P1-3 결정 불변, 기각 대안 재도입 없음. |
| convention_compliance | NONE | SoT 재사용(node-output Principle 7 정합), 재구현 없음. |
| plan_coherence | LOW | plan 결정 충돌 없음(INFO: mcp-client spec-sync 잔여와 겹침). |
| naming_collision | NONE | 신규 export 0(이름 없는 regex literal 추가). |

## 권장 조치
1. 본 변경 BLOCK: NO — 진행 가능.
2. cross_spec WARNING(mcp-client §8.3 userinfo parity doc-sync + MCP 중복 패턴 dedup)은 기존 `spec-sync-mcp-client-gaps.md` backlog 로 분리(follow-up task).
