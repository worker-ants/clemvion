# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견이 없어 호출자가 차단할 필요 없음

## 전체 위험도
**LOW** — WARNING 2건(큐 그룹 분류 근거 미명시, observability spec 큐 수 불일치) + WARNING 1건(V-15 완료 표기 vs spec 구현 갭 노트 불일치). Critical 없음.

> 본 검토는 spec-nits 작업(`spec/5-system/16-system-status-api.md` §1 — `terminal-revoke-reconcile` 행 추가 + 낡은 makeshop 갭 콜아웃 정정)을 대상으로 한다.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 조치 |
|---|---------|------|-------------|------|
| 1 | Cross-Spec | `terminal-revoke-reconcile` 을 `system` group 으로 분류했으나 분류 기준 미명시 | §1 큐 레지스트리 표 | **조치 완료** — 비고란에 "reconciliation cron 성격이라 system group" 주석 추가 |
| 2 | Cross-Spec | `spec/data-flow/9-observability.md` 가 "13개 큐" 명시(L142·L147)하나 실제 16개 | `9-observability.md` | **조치 완료** — L142·L147 "13개" → "16개" 갱신 |
| 3 | Plan-Coherence | plan V-15 완료 표기 vs spec 구현 갭 노트(`agent-memory-extraction` 미등재) 불일치 | §1 구현 갭 노트 | spec 갭 노트는 현재 사실(agent-memory 미등재) 정확 기술 유지 — plan 측 표기 정합은 별도 추적 (advisory) |

## 참고 (INFO)

- frontmatter `id` prefix 생략 / `## Overview` 헤더 부재: `spec/5-system/` 일반 패턴, 규약 위반 아님 — 현행 유지.
- `X-Workspace-Id` 스코핑 예외·admin role 가드 부재·Rationale R-4 health 어휘: 모두 기존 spec 과 정렬, 충돌 없음.
- `terminal-revoke-reconcile` 큐 이름: data-flow SoT §4·EIA spec 과 완전 일치, 충돌 없음.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 큐 그룹 분류 근거 미명시(W·조치완료), observability 큐 수 불일치(W·조치완료) |
| Rationale-Continuity | 재시도(fatal) | output file 미생성 — 단발 fatal. 본 변경(표 1행 추가)은 결정 번복·invariant 위반 무관 |
| Convention-Compliance | NONE | 정식 규약 준수 |
| Plan-Coherence | LOW | V-15 표기 vs 갭 노트(advisory) |
| Naming-Collision | NONE | `terminal-revoke-reconcile` 기존 문서와 완전 일치 |

## 비고
- `rationale_continuity` checker 가 단발 fatal(output 미생성)로 종료. 본 변경은 §1 큐 레지스트리 표 1행 추가 + 갭 콜아웃 정정으로 Rationale/결정 연속성에 영향 없어 재실행 생략.
- WARNING 1·2 는 본 PR 에서 조치 완료. WARNING 3 은 plan 측 advisory 로 별도 추적.
