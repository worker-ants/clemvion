# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 호출자 차단 불필요.

## 전체 위험도
**LOW** — 구현 갭 추적 오기 및 plan 연결 누락(WARNING 2건), 문서 구조·정보 보강 권장(INFO 6건). Critical/구조적 모순 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/data-flow/9-observability.md §1.4` 큐 수 "16개" — target 선언(17개)과 불일치 | `spec/5-system/16-system-status-api.md §1` QueueRegistry 표 (17행 선언) | `spec/data-flow/9-observability.md §1.4` flowchart 레이블 및 본문 "16개 큐" | `9-observability.md §1.4` flowchart 레이블·본문 "16개"를 "17개"로 갱신. `data-flow/0-overview.md`는 이미 17개로 정합. |
| 2 | plan_coherence | `§1` 구현 갭 callout의 "V-15 추적" 참조가 이미 완료된 다른 이슈(makeshop-token-refresh)를 가리키는 오기. `agent-memory-extraction` MONITORED_QUEUES 등재를 추적하는 in-progress plan 없음 | `spec/5-system/16-system-status-api.md §1` 표 하단 `⚠ 구현 갭` 노트 | `plan/complete/integration-expiry-fixes.md §V-15` (완료·범위 불일치) | spec 노트에서 "V-15 추적" 참조 제거 또는 정정; `agent-memory-extraction` MONITORED_QUEUES 등재를 `ai-context-memory-followup-v2.md` 또는 신규 backlog 항목에 추가 |
| 3 | plan_coherence | `exec-intake-queue-impl.md` PR2b MAINT#9(`system-status.constants.ts` concurrency 파싱 일원화, 미착수)이 target §3 getter 패턴과 리팩터 범위 충돌 가능성 | `spec/5-system/16-system-status-api.md §3` getter 패턴 (`getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()`) | `plan/in-progress/exec-intake-queue-impl.md` PR2b MAINT#9 `[ ]` | PR2b 착수 전 MAINT#9 범위가 §3 getter 패턴과 충돌하지 않음을 명시하거나, 충돌 시 target 스펙 먼저 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `agent-memory-extraction` 큐의 `knowledge-base` 그룹 배정 근거 및 UI 표시 섹션 매핑 미명시 | `spec/5-system/16-system-status-api.md §1` QueueRegistry 표 `group=knowledge-base` | `spec/2-navigation/15-system-status.md §2.3`에 "지식베이스" 섹션 귀속 명시 또는 target Rationale에 배정 근거 1문장 추가 |
| 2 | cross_spec | API `group='integration'` → UI "알림·통합" 섹션 매핑이 양 문서에 명시 없음 | `spec/5-system/16-system-status-api.md §2` `QueueStatusDto.group` | target §2 또는 `15-system-status.md §2.3`에 매핑 1문장 추가 |
| 3 | rationale_continuity | R-5 내 `SYSTEM_STATUS_FAILED_THRESHOLD` 비교 대상 전환(기존 누적 `failed` → `recentFailed`) 항목 제목이 미분리 — 가독성 저하 | `spec/5-system/16-system-status-api.md` R-5 | R-5 내 소항목 분리 또는 §3 "의미 변경 주의" 주석에서 R-5 세부 항목 직접 인용 |
| 4 | rationale_continuity | R-5 스캔 캡 비용 트레이드오프 메모 부재 — 캡 재조정 시 Redis 운용 영향 미언급 | `spec/5-system/16-system-status-api.md` R-5 | "캡 값이 클수록 getFailed 스캔 비용·Redis memory 영향 증가" 한 줄 트레이드오프 메모 추가 |
| 5 | convention_compliance | `## Overview` H2 섹션 누락 — H1 직후 바로 `## 1.`로 진입 | `spec/5-system/16-system-status-api.md` 도입부 | H1과 `## 1.` 사이에 `## Overview` 섹션 추가 후 현 인트로 단락 이동 |
| 6 | convention_compliance | `status: implemented` 선언 + 구현 갭 주석(`agent-memory-extraction` 미등재) 공존 — `partial` 전환 검토 여지 | `spec/5-system/16-system-status-api.md` frontmatter | 갭이 "spec 약속 미이행"이면 `status: partial` + `pending_plans:` 전환 검토; "코드 레지스트리 동기화 지연"이면 `implemented` 유지 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `9-observability.md §1.4` 큐 수 "16개" 구식 표기(WARNING); 그룹 배정·UI 매핑 문서화 보강 권장(INFO 2건) |
| rationale_continuity | NONE | R-5 가독성·운용 트레이드오프 보강 권장(INFO 2건); 설계 차단 없음 |
| convention_compliance | NONE | `## Overview` 섹션 누락·`status` 의미 검토(INFO 2건); 규약 직접 위반 없음 |
| plan_coherence | LOW | "V-15 추적" 오기 + `agent-memory-extraction` 추적 plan 부재(WARNING); PR2b MAINT#9 충돌 가능성 확인 권장(WARNING) |
| naming_collision | NONE | 요구사항 ID·DTO명·endpoint·ENV var·파일 경로 전 범주 충돌 없음; `health` 어휘 3도메인 병존은 spec 내 명시적 설명으로 관리됨 |

## 권장 조치사항

1. **(WARNING 해소 — 구현 갭 노트 정정)** `spec/5-system/16-system-status-api.md §1` 표 하단 `⚠ 구현 갭` 노트에서 "V-15 추적" 참조를 제거하거나 정정하고, `agent-memory-extraction` MONITORED_QUEUES 등재 후속 작업을 `ai-context-memory-followup-v2.md` 또는 신규 backlog 항목에 추가한다.
2. **(WARNING 해소 — cross-spec 수치 정정)** `spec/data-flow/9-observability.md §1.4` flowchart 레이블(`QueueRegistry · 16개 BullMQ 큐`)과 본문 "16개 큐"를 "17개 큐"로 갱신한다.
3. **(WARNING 확인 — PR2b 착수 전)** `exec-intake-queue-impl.md` PR2b MAINT#9 착수 전 `system-status.constants.ts` 리팩터 범위가 `spec/5-system/16-system-status-api.md §3` getter 패턴과 충돌하지 않음을 명시한다.
4. **(INFO — 문서 구조 보강)** `## Overview` H2 섹션 추가, `agent-memory-extraction` UI 그룹 귀속 명시, `group='integration'` → UI 섹션 매핑 1문장 추가를 다음 spec 편집 시 함께 처리한다.
5. **(INFO — Rationale 보강)** R-5에 `SYSTEM_STATUS_FAILED_THRESHOLD` 전환 소항목 분리 및 스캔 캡 비용 트레이드오프 메모 추가를 권장한다.
