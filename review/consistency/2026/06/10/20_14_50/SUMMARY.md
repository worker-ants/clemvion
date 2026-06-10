# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 모두 LOW 판정. Critical 위배 없음. 동일 §1.6 섹션 번호 오류가 4개 checker에서 중복 지적되었으나 모두 WARNING 이하 등급.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec + Naming Collision (통합) | `§1.6` 섹션 참조가 실제 spec 에 존재하지 않음 — 4개 checker 공통 지적 | `plan/in-progress/spec-update-perf-backlog-01.md` §2 | `spec/5-system/4-execution-engine.md` (MAX_NODE_ITERATIONS 실제 위치는 §2.1 순환 참조 제한 표 line 204) | draft §2 의 "§1.6 표" → "§2.1 표" 로 수정. PARALLEL_ENGINE 도 §2.1 본문(line 213) 임을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| 1 | Cross-Spec | `s3Service.deleteMany` 가 spec Overview 코드 진입점 목록에 미등록 | spec 갱신 시 진입점 표에 추가 |
| 2 | Rationale Continuity | Rationale "단건 try/catch warn" 서술이 배치 partial failure 미커버 | "`deleteMany` 응답 `Errors[].Key` 일괄 warn — best-effort 동일" 병기 |
| 3 | Convention Compliance | `spec_impact` frontmatter 미선언 — complete/ 이동 시 Gate C 차단 | 이동 전 `spec_impact: [4-file-storage, 4-execution-engine]` 선언 |
| 4 | Convention Compliance | plan Rationale 섹션 없음 (선택) | 선택 |
| 5 | Plan Coherence | `unified-model-mgmt-5af7ee` worktree 외형 diff 69행 — 실질 충돌 없음(blob 동일) | 비차단 |
| 6 | Plan Coherence | stale worktree 3건 | `./cleanup-worktree-all.sh --yes --force` 권장 |

## Checker별 위험도

| Checker | 위험도 |
|---------|--------|
| Cross-Spec | LOW |
| Rationale Continuity | LOW |
| Convention Compliance | LOW |
| Plan Coherence | LOW |
| Naming Collision | LOW |

## 권장 조치사항
1. (WARNING) draft §2 "§1.6" → "§2.1 순환 참조 제한 표" 교정 + PARALLEL_ENGINE 위치 명시.
2. (Gate C) complete/ 이동 전 spec_impact 선언.
3. (INFO) 진입점 표 deleteMany 추가 + Rationale 배치 warn 병기.
