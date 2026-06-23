# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 순수 리팩터(behavior-preserving). spec 직접 모순 없음. WARNING 3건(타입 누락, spec frontmatter 미등재, 동명 타입 공존)은 모두 비차단 수준.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `TriggerListParams` 에 `search`/`sort`/`order` 파라미터 누락 — spec §3 API 계약 부분 불일치 | `codebase/frontend/src/lib/api/triggers.ts` `TriggerListParams` (L89–95) | `spec/2-navigation/2-trigger-list.md §3` GET 쿼리 파라미터 목록 | `search?: string; sort?: string; order?: "asc" \| "desc"` 선택적 필드 추가 또는 의도적 생략 주석 명시 |
| W-2 | Cross-Spec / Plan-Coherence | 신설 `lib/api/triggers.ts` 가 `2-trigger-list.md` frontmatter `code:` 에 미등재 — spec-impl 트레이서빌리티 약화 | `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록 | `spec/conventions/spec-impl-evidence.md` 등재 의무 | `code:` 에 `codebase/frontend/src/lib/api/triggers.ts` 추가 (project-planner 세션에서 처리) |
| W-3 | Naming-Collision | 프론트엔드 `TriggerDetail` 과 백엔드 `TriggerDetail` 동명 공존 — 현재 런타임 충돌 없으나 shared-types 도입 시 위험 | `codebase/frontend/src/lib/api/triggers.ts:32` | `codebase/backend/src/modules/triggers/triggers.service.ts:36` | 프론트엔드 타입을 `TriggerDetailView`/`TriggerDetailDto` 로 개칭하거나 백엔드 타입을 `TriggerWithSchedule` 등으로 변경 — M-8 2단계에 포함 권장 |
| W-4 | Convention-Compliance | `2-trigger-list.md` frontmatter `status: implemented` 이지만 본문에 "v1 제약/미채택" 표현 혼재 — 독자 혼란 우려 | `spec/2-navigation/2-trigger-list.md` frontmatter | `spec/conventions/spec-impl-evidence.md §3` — `implemented` 정의 | v1 의도적 설계 결정 vs 실제 미구현 gap 명확히 구분 기술; 진짜 미구현 surface 있으면 `status: partial` + `pending_plans:` 명시 검토 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `trigger-delete-dialog.tsx` DELETE 호출이 `triggersApi` 로 이관되지 않고 `apiClient.delete` 직접 호출 잔류 | `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx:69` | `triggersApi.delete(id)` 추가 후 이관하거나 의도적 미이관 주석 명시 |
| I-2 | Cross-Spec | `TriggerUpdateBody` 에 spec §3 PATCH 허용 키 `config` 누락 | `codebase/frontend/src/lib/api/triggers.ts` `TriggerUpdateBody` (L116–124) | `config?: Record<string, unknown>` 선택적 키 추가 또는 의도적 생략 주석 |
| I-3 | Rationale-Continuity | R-4/R-6/R-7/R-8/R-14/R-16/R-CC-10/R-2 전 항목 정합 확인 — 기각 대안 재도입 없음 | `trigger-detail-drawer.tsx`, `page.tsx`, `triggers.ts` 전반 | 해당 없음 |
| I-4 | Convention-Compliance | `spec/2-navigation` 대부분 파일이 `## Overview` 섹션 없이 본문 진입 — 3섹션은 권장 사항 | `spec/2-navigation/0-dashboard.md` 외 다수 | 강제 규약 아님. 향후 신규 문서 작성 시 3섹션 구조 유지 |
| I-5 | Convention-Compliance | `16-agent-memory.md` `id: nav-agent-memory` — 중복 회피 의도된 패턴, 위반 아님 | `spec/2-navigation/16-agent-memory.md` frontmatter | 해당 없음 |
| I-6 | Convention-Compliance | `10-auth-flow.md` OAuth lower_snake_case 에러 코드 — historical-artifact 예외 레지스트리 등재, 위반 아님 | `spec/2-navigation/10-auth-flow.md §5.4` | 해당 없음 |
| I-7 | Plan-Coherence | `plan/in-progress/refactor/02-architecture.md` M-8 체크박스가 `[ ] 미착수` 로 표기 — 1단계 완료 반영 필요 | `plan/in-progress/refactor/02-architecture.md` M-8 항목 | M-8 1단계 완료 상태로 체크리스트 갱신; m-2 선행 요건 충족 명기 |
| I-8 | Naming-Collision | `page.tsx` 로컬 `Trigger` 인터페이스와 신규 `TriggerListItem` 혼재 — 컴파일 충돌 없으나 역할 혼동 가능 | `page.tsx:59`, `triggers.ts:72` | M-8 2단계에서 `TriggerRow`/`TriggerViewItem` 으로 개칭 검토 |
| I-9 | Naming-Collision | `ChatChannelConfigView` 공개 이동 — 단일 정의, 충돌 없음 | `codebase/frontend/src/lib/api/triggers.ts:14` | 해당 없음 |
| I-10 | Naming-Collision | `triggersApi` 네임스페이스 — 기존 패턴 완전 준수, 충돌 없음 | `codebase/frontend/src/lib/api/triggers.ts:126` | 해당 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 2건(타입 파라미터 누락, frontmatter 미등재), INFO 2건(DELETE 미이관, config 키 누락). CRITICAL 없음 |
| Rationale-Continuity | NONE | 주요 Rationale R-2·R-4·R-6·R-7·R-8·R-14·R-16·R-CC-10 전 항목 정합. 기각 대안 재도입 없음 |
| Convention-Compliance | LOW | WARNING 1건(`implemented` 상태 표현 혼재). INFO 다수는 의도된 예외 또는 권장 사항 미준수 |
| Plan-Coherence | LOW | WARNING 1건(spec frontmatter 미등재 SPEC-DRIFT). INFO 1건(plan 진행 상태 미갱신). CRITICAL 없음 |
| Naming-Collision | LOW | WARNING 1건(프론트/백엔드 `TriggerDetail` 동명 — 컴파일 격리로 현재 무해). INFO 다수 충돌 없음 |

## 권장 조치사항

1. **(W-2 / SPEC-DRIFT)** `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 `codebase/frontend/src/lib/api/triggers.ts` 추가 — project-planner 세션에서 처리 (developer 직접 spec 수정 시 일관성 규약 확인 필요).
2. **(W-1)** `TriggerListParams` 에 `search?: string; sort?: string; order?: "asc" | "desc"` 선택적 필드 추가 또는 "현재 클라이언트는 search/sort/order 미전송 — spec §3 참고" 주석 명시.
3. **(W-3)** M-8 2단계 계획에 프론트엔드 `TriggerDetail` → `TriggerDetailView`/`TriggerDetailDto` 개칭 포함 (shared-types 도입 전 예방적 조치).
4. **(W-4)** `2-trigger-list.md` 본문 "v1 제약" 표현과 실제 미구현 gap 구분 명확화 — 다음 planner 세션에서 검토.
5. **(I-7)** `plan/in-progress/refactor/02-architecture.md` M-8 체크리스트를 1단계 완료 상태로 갱신; m-2 선행 요건 충족 기록.
6. **(I-1)** `trigger-delete-dialog.tsx` DELETE 미이관에 의도적 미이관 주석 추가 (또는 M-8 후속 PR 에서 `triggersApi.delete` 이관).