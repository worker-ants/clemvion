# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — `spec/data-flow/10-triggers.md §3.1` 이 동일 파일 §1.4의 "갭 해소" 선언과 직접 모순되는 구식 기술을 유지하고 있으며, 3개 checker(Cross-Spec / Rationale Continuity / Naming Collision)가 동일 위배를 독립적으로 CRITICAL로 판정했습니다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Rationale Continuity / Naming Collision (통합) | `§3.1` line 203이 "Schedule→Trigger 정방향만 구현, Trigger API PATCH { isActive }는 갱신 안 함"을 그대로 유지 — §1.4의 "양방향 구현 완료(2026-06-10 갭 해소)" 선언과 직접 모순. 독자가 §1.4를 참조하면 의미가 역전되는 충돌 | `spec/data-flow/10-triggers.md` line 203 (§3.1) | 동일 파일 §1.4, `spec/1-data-model.md §2.9.1`, `spec/2-navigation/3-schedule.md §3.1`, `spec/2-navigation/2-trigger-list.md §4.4` | line 203 단락을 "양방향 동기화 모두 구현 완료 — Trigger API `PATCH { isActive }` 도 `syncScheduleActivation()`을 통해 `schedule.is_active`와 BullMQ job을 함께 갱신한다 (§1.4 참조)"로 교체. §3.1 표의 `false` 상태 설명에도 "Trigger API 경유 시에도 동일 효과" 추가 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 backend 경로 누락 — `triggers.service.ts` 등이 빠져 있어 `spec-code-paths.test.ts`가 구현 evidence를 온전히 인식 못할 수 있음 | `spec/2-navigation/2-trigger-list.md` frontmatter `code:` | `spec/conventions/spec-impl-evidence.md §3` | `code:` 에 `codebase/backend/src/modules/triggers/triggers.service.ts`, `triggers.controller.ts`, `dto/**` 복구 |
| 2 | Rationale Continuity | `spec/2-navigation/3-schedule.md §4` — sort/order "미구현/Planned" 표기를 "구현 완료"로 교체했으나 `## Rationale` 섹션이 없어 결정 번복 근거 추적 불가 | `spec/2-navigation/3-schedule.md §4` (line 128) | origin/main 동일 파일 §4 "Planned" 표기 | `## Rationale` 섹션 추가 후 "sort/order 구현 완료(2026-06-10) — 기존 Planned 표기 해제" 기록. 또는 §4 행 내에 인라인 주석 추가 |
| 3 | Plan Coherence | `trigger-review-deferred-fixes.md`의 C3(signing secret rotation 버그, 보안) + W4(partial UNIQUE 마이그레이션 미생성, DB 정합성) 이월 항목이 별도 추적 plan 없이 방치 중 | `plan/in-progress/trigger-review-deferred-fixes.md` | 없음 (추적 공백) | C3/W4를 조기 처리하거나, 관련 spec 파일의 `pending_plans`에 이 plan 등록해 추적성 확보 |
| 4 | Plan Coherence | `spec-sync-workflow-list-gaps.md`의 상태 필터 버그 항목이 worktree에서 `[x]` 처리됐으나 origin/main과 머지 시 정합 확인 필요 | `plan/in-progress/spec-sync-workflow-list-gaps.md` | origin/main 동일 파일 (체크박스 미처리 상태) | 머지 전 origin/main 버전이 worktree 버전(`[x]` + 수정 메모)으로 올바르게 반영됨을 확인 |
| 5 | Plan Coherence | `spec-sync-schedule-gaps.md`의 sort/order 항목도 동일 — worktree에서 `[x]` 처리, 머지 시 정합 확인 필요 | `plan/in-progress/spec-sync-schedule-gaps.md` | origin/main 동일 파일 | 머지 전 origin/main 버전 업데이트 확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `GET /api/schedules` sort/order 허용값 whitelist가 다른 목록 API와 비교 시 명시 부족 | `spec/2-navigation/3-schedule.md §3.2` | 허용 sort 컬럼 목록(`created_at`, `updated_at`, `name`)을 명시하면 future 일관성 보장에 유리. 현재 즉시 필수 아님 |
| 2 | Cross-Spec | `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans` 잔존 여부 확인 필요 | `spec/2-navigation/1-workflow-list.md` frontmatter | `plan/in-progress/spec-sync-workflow-list-gaps.md` 내용 확인 후 상태 필터 항목만 있다면 `plan/complete/`로 이동, 다른 미구현 항목 잔존 시 해당 항목만 체크 후 잔존 |
| 3 | Rationale Continuity | `spec/data-flow/10-triggers.md §3.1` `false` 상태 설명이 "Schedules API 경유 토글"만 언급해 Trigger API 경유 동일 효과 미기술 | `spec/data-flow/10-triggers.md` line 201 | "Schedules API 또는 Trigger API 경유 토글 시 `removeJob`으로 BullMQ job 해제 (§1.4 양방향 동기화)"로 보완 |
| 4 | Convention Compliance | `spec/2-navigation/16-agent-memory.md` frontmatter `id: nav-agent-memory` — basename 기반 권장 규칙과 불일치 (`nav-` 접두사 불필요) | `spec/2-navigation/16-agent-memory.md` line 2 | `id: agent-memory`로 변경 권장 (기술적으로 valid, 강제 아님) |
| 5 | Convention Compliance | `spec/2-navigation/14-execution-history.md` 이중 번호 구조 (Overview 내 §1~§3 + 본문 §1~§7) — 앵커 충돌 가능성 및 문서 구조 혼란 | `spec/2-navigation/14-execution-history.md` | Overview 블록 제거 또는 `_product-overview.md` 분리. 이번 diff 범위 밖이므로 후속 정리 대상 등록 권장 |
| 6 | Convention Compliance | `spec/2-navigation/3-schedule.md §3` — "whitelist 기반으로 반영" 이라는 구현 세부(코드 레벨 용어)가 spec 본문 노출 | `spec/2-navigation/3-schedule.md §3 API 표` | "허용 값 집합(`created_at`, `updated_at`, `name`) 내에서 반영, 기본 `created_at DESC`"처럼 계약 기술로 교체. 구현 상세는 Rationale로 이동 |
| 7 | Naming Collision | `syncScheduleActivation()` — spec 에 private method명 노출. 충돌 없음 | `spec/data-flow/10-triggers.md §1.4 + Rationale` | 조치 불요. data-flow 문서 성격상 허용 범위 |
| 8 | Naming Collision | 새 Rationale 섹션 제목에 날짜 `(2026-06-10)` 포함 — 기존 Rationale 제목 패턴과 불일치 | `spec/data-flow/10-triggers.md Rationale` | 날짜 없는 형식으로 통일 고려 가능. 충돌 아니므로 선택적 |
| 9 | Plan Coherence | `spec-sync-schedule-gaps.md` 잔여 미구현 항목 4건(더보기 메뉴, 트리거에서 보기, 워크플로우 이름 링크, 타임존 기본값) — 이번 변경과 직교, 충돌 없음 | `plan/in-progress/spec-sync-schedule-gaps.md` | 변경 불요. 추적 유효 상태 유지 |
| 10 | Plan Coherence | `spec-update-*` 계열 plan 4건(resolution-applier 산출물) — worktree 범위 내 정상, 충돌 없음 | `plan/in-progress/spec-update-*.md` 4건 | 변경 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `spec/data-flow/10-triggers.md §3.1` line 203이 §1.4와 모순 (CRITICAL 1건) |
| Rationale Continuity | MEDIUM | 동일 §3.1 모순 (CRITICAL 1건) + sort/order Rationale 부재 (WARNING 1건) |
| Convention Compliance | LOW | `2-trigger-list.md` frontmatter `code:` backend 경로 누락 (WARNING 1건) |
| Plan Coherence | LOW | ai-review 이월 C3/W4 추적 plan 공백 (WARNING 1건), plan 체크박스 머지 확인 필요 (WARNING 2건) |
| Naming Collision | HIGH | `§1.4` 앵커 의미 역전으로 인한 CRITICAL 충돌 1건 (Cross-Spec과 동일 근원) |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/data-flow/10-triggers.md §3.1` line 203 단락을 "양방향 동기화 모두 구현 완료 — Trigger API `PATCH { isActive }` 도 `syncScheduleActivation()`을 통해 `schedule.is_active`와 BullMQ job을 함께 갱신한다 (§1.4 참조)"로 교체. 아울러 line 201 `false` 상태 설명에 Trigger API 경유 동일 효과를 추가.
2. **(WARNING)** `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 `codebase/backend/src/modules/triggers/triggers.service.ts`, `triggers.controller.ts`, `dto/**` 복구.
3. **(WARNING)** `spec/2-navigation/3-schedule.md` 에 `## Rationale` 섹션 추가 — "sort/order 구현 완료(2026-06-10), 기존 Planned 표기 해제" 기록.
4. **(WARNING)** `trigger-review-deferred-fixes.md` C3(보안) + W4(DB) 이월 항목에 대한 후속 추적 plan 등록 또는 관련 spec `pending_plans` 연결.
5. **(INFO)** 머지 전 `spec-sync-workflow-list-gaps.md`, `spec-sync-schedule-gaps.md`의 origin/main 버전이 worktree의 `[x]` 처리 상태로 올바르게 포함됨을 확인.