# Consistency Check 통합 보고서 (재검토)

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 모든 checker 에서 WARNING 수준 소수 발견, CRITICAL 없음.

## Critical 위배 (BLOCK 사유)
없음.

## 경고 (WARNING)

| # | Checker | 위배 | 제안 |
|---|---------|------|------|
| 1 | Rationale Continuity | "상수 비용" 번복 근거 불완전 — R-5 에 기존 §2 문장이 설계 원칙이 아닌 구현 관찰이었음을 명시하지 않음 | R-5 에 "기존 §2 상수 비용 문장은 설계 원칙이 아닌 구현 관찰이었고 이번 개정으로 삭제·대체" 한 줄 추가 |
| 2 | Convention Compliance | `pending_plans` 경로 실존 재확인 필요(`spec-pending-plan-existence.test.ts`) | spec 적용 직전 `plan/in-progress/system-status-recent-failed.md` 실존 확인(현재 존재) |
| 3 | Convention Compliance | health 규칙 3 교체안에 규칙 1·2 원문 생략 | spec §3 원문 참조해 1·2 유지 |
| 4 | Convention Compliance | `partial` 전환 후 `code:` glob ≥1 매치 검증 단계 없음 | 체크리스트에 "`spec-code-paths.test.ts` 통과 확인" 추가 |
| 5 | Naming Collision | R-3(UI)/R-5(API) 가 타 파일에 동명 — 로컬 앵커라 무해 | 조치 불필요 |

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| 1 | Cross-Spec | R-2 본문 미갱신 시 신규 독자 오해 가능 | R-2 말미에 "단일 윈도우 스냅샷은 별도 저장소 없이 R-5 에서 도입" 한 줄 |
| 2 | Cross-Spec | NF-OB-06 동기화가 진행 체크리스트에 미포함 | §D 를 체크리스트 항목으로 |
| 3 | Cross-Spec | §1 ASCII "60분" 고정 vs 동적 라벨 혼용 | "N분(env 기본값)" 명기 |
| 4 | Rationale Continuity | health 기준 변경 트레이드오프(누락 신호) 미기록 | R-5 에 "누적 실패가 윈도우 밖으로 벗어나면 degraded 신호 자동 소멸 트레이드오프 인지" 한 줄 |
| 5 | Convention Compliance | DTO 코드 블록 언어 지정자 없음 | ```ts 로 |
| 6 | Naming Collision | 기존 `systemStatus.counts.failed` 라벨 의미 변경 미명시 | developer plan 에 라벨 값 변경 항목 명시 |
| 7 | Naming Collision | 신규 ENV 충돌 없음(`SYSTEM_STATUS_` prefix 일관) | 조치 불필요 |
| 8 | Plan Coherence | stale worktree 2건 | cleanup 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | LOW | 전부 INFO |
| Rationale Continuity | LOW | WARNING 1(상수 비용 근거), INFO 1 |
| Convention Compliance | LOW | WARNING 3 — 적용 시점 주의 수준 |
| Plan Coherence | NONE | 충돌 없음 |
| Naming Collision | LOW | 실질 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소) 없음 — 진행 가능.
2. R-5 에 "상수 비용 문장은 구현 관찰, 이번 개정으로 폐기" 추가.
3. 체크리스트에 `spec-code-paths.test.ts` 통과 확인 추가.
4. developer plan 에 `systemStatus.counts.failed` 라벨 값 변경 명시.
5. (선택) R-5 health 트레이드오프 문장, §1 ASCII "N분" 명기, stale worktree 정리.
