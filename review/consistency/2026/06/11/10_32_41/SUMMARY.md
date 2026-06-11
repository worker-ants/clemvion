# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 3건은 차단 사유 해당 없음.

## 전체 위험도
**MEDIUM** — plan_coherence 가 MEDIUM(origin/main 대비 구형 기준 재작성 위험), 나머지 4개 checker LOW/NONE. Critical 0건.

---

## Critical 위배 (BLOCK 사유)

_없음_

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Plan Coherence | target 이 origin/main 보다 구형 기준으로 재작성돼 이미 머지된 C-7(`totalNodeCount`/`completedNodeCount`/`failedNodeCount` 3필드 + R-1~R-4 Rationale)을 제거함. 커밋 시 구현 완료 결과가 main 에서 사라질 위험 | `spec/2-navigation/14-execution-history.md` §5 JSON 샘플 + `## Rationale` 전체 | `plan/in-progress/spec-sync-structural-followups.md` §C-7 (commit `7f413725`, FIXED); origin/main HEAD `230a0fba` | 워킹트리에서 `git diff origin/main -- spec/2-navigation/14-execution-history.md` 재확인. nodeCount 3필드·R-1~R-4 유지한 채 Overview 구조 변경만 적용 |
| W-2 | Convention Compliance | 목록 API 응답 샘플의 `"executionPath": []` 가 항상 빈 배열로 고정됨에도 목록 DTO 에 노출 — "불필요한 필드 비포함" 암묵적 원칙과 긴장 | `spec/2-navigation/14-execution-history.md` §5 목록 API 응답 JSON | `spec/5-system/2-api-convention.md §5.2` (목록 응답 불필요 필드 배제) | `executionPath` 를 목록 API 응답 DTO 에서 제외하고 상세 API 전용으로 한정. R-1 Rationale 도 그에 맞게 조정 |
| W-3 | Naming Collision | `ExecutionDto.triggerSource`(DTO, 5-variant)와 `__triggerSource`(엔진 내부 마커, 3-variant)가 이름이 유사해 코드 리뷰·문서 검색 시 혼동 가능 | `spec/2-navigation/14-execution-history.md` §2.4, §5 응답 샘플, R-2 | `spec/4-nodes/7-trigger/0-common.md:34`, `spec/data-flow/10-triggers.md:49,54,90,120` | R-2 에 이미 구분 해설 존재하여 현재도 수용 가능. 개선 시 `resolvedTriggerSource` 또는 `displayTriggerSource` 로 DTO 필드 이름 변경 검토 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | Workflow List 더보기 메뉴 라벨 — target 은 영문 `Execution History`, `1-workflow-list.md §2.6` 은 한국어 `실행 기록` | `spec/2-navigation/14-execution-history.md §4.2` vs `spec/2-navigation/1-workflow-list.md §2.6` | 실제 렌더링 기준으로 한쪽을 SoT 로 지정해 표기 통일 |
| I-2 | Cross-Spec | UI 필터에 `pending` 상태 미포함 — 데이터 모델 enum 에 유효 값이나 필터 6종에서 제외 | `spec/2-navigation/14-execution-history.md §2.3` vs `spec/1-data-model.md §2.13` | Rationale 에 "pending 은 큐 대기 순간에만 존재, 사용자 조작 불가라 제외" 한 줄 추가 |
| I-3 | Cross-Spec | Chat Channel 트리거 → `Trigger.type='webhook'` 이므로 §2.4 분류상 `webhook` 으로 표시됨을 명시적으로 언급하지 않음 | `spec/2-navigation/14-execution-history.md §2.4` vs `spec/5-system/15-chat-channel.md` | §2.4 또는 R-2 에 "Chat Channel 트리거는 `webhook` 으로 분류" 한 줄 주석 추가 |
| I-4 | Cross-Spec | 목록 API `sort` 기본값 `started_at` 이 API 규약 예시(`created_at`)와 다름 — 합법적 도메인 오버라이드 | `spec/2-navigation/14-execution-history.md §5` vs `spec/5-system/2-api-convention.md §4.1` | §5 쿼리 파라미터 설명에 "Execution 도메인은 `started_at` 기본값 사용 (규약 예시 `created_at` 과 다름)" 주석 추가 |
| I-5 | Rationale Continuity | R-3 에서 폐기 선언된 `LLM Information` 탭 명칭이 `spec/4-nodes/3-ai/1-ai-agent.md` 에 아직 잔존 | `spec/4-nodes/3-ai/1-ai-agent.md` 1016번째 줄 | 해당 줄을 현행 탭 명칭(`LLM Usage` 등)으로 갱신하거나 "(구 명칭, 현재는 평탄화)" 주석 추가 |
| I-6 | Plan Coherence | `spec-update-c-sync-promotions.md` 존재 여부 미확인 — C-7 스펙 승격 위임 추적 | `plan/in-progress/spec-sync-structural-followups.md §스펙 승격 위임` | `spec-update-c-sync-promotions.md` 존재 확인, 없으면 `spec-sync-structural-followups.md §스펙 승격 위임` 처리 완료 표시 |
| I-7 | Convention Compliance | Rationale 번호 체계(R-1~R-4) 후반에 번호 없는 블록쿼트로 Re-run 위임 설명 추가 — 사소한 체계 불일치 | `spec/2-navigation/14-execution-history.md ## Rationale` 말미 | `### R-5. Re-run / chain 위임` 으로 번호화하면 가독성 향상 (변경 불요 수준) |
| I-8 | Convention Compliance | `/api/executions/workflow/:workflowId` 의 `workflow` 가 단수 — 복수형 명사 규약과 미정합이나 구현체 historical artifact | `spec/2-navigation/14-execution-history.md §5` vs `spec/5-system/2-api-convention.md §2.2` | spec 에 "naming inconsistency — historical artifact" 각주 추가, 또는 다음 major 리팩 시 복수형 정정 트래킹 |
| I-9 | Convention Compliance | frontmatter `id: execution-history` — 파일 basename `14-execution-history` 대비 숫자 prefix 생략. 프로젝트 관례와 일치하나 충돌 주의 | `spec/2-navigation/14-execution-history.md` frontmatter | `spec-frontmatter.test.ts` 가 uniqueness 검증하므로 빌드에서 감지 가능. 현행 유지 가능 |
| I-10 | Naming Collision | EH-LIST/EH-DETAIL/EH-NAV prefix 식별자 — 외부 참조(`conversation-thread.md`, `data-hydration-surfaces.md`, `1-ai-agent.md`)는 모두 본 문서를 가리키는 적법한 순방향 참조 | `spec/2-navigation/14-execution-history.md` 요구사항 ID 전체 | 충돌 없음, 조치 불요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 충돌 없음. INFO 4건(명명 불일치, 설명 누락) |
| Rationale Continuity | LOW | 기각된 대안 재도입 없음. R-3 폐기 선언 후 `1-ai-agent.md` 에 구 명칭 잔존(INFO) |
| Convention Compliance | LOW | WARNING 2건(executionPath 불필요 노출, frontmatter id prefix 권장 불일치). 금지 항목(PUT 등) 위반 없음 |
| Plan Coherence | MEDIUM | origin/main 대비 구형 기준 재작성으로 C-7 필드·R-1~R-4 Rationale 제거 위험(WARNING). active worktree 충돌 0건 |
| Naming Collision | LOW | 실질 충돌 0건. `triggerSource` vs `__triggerSource` 혼동 가능성(WARNING, R-2 에서 해설 존재) |

---

## 권장 조치사항

1. **(W-1 — 최우선)** 워킹트리에서 `git diff origin/main -- spec/2-navigation/14-execution-history.md` 를 확인해 `totalNodeCount`/`completedNodeCount`/`failedNodeCount` 3필드와 `## Rationale` R-1~R-4 섹션이 제거되지 않도록 보장. 이 삭제만 되돌리면 MEDIUM 위험도가 해소됨.
2. **(W-2)** `executionPath: []` 를 목록 API 응답 DTO 샘플·DTO 클래스에서 제거하고 상세 API 전용으로 한정. R-1 설명도 "상세 API 에서만 executionPath 포함" 으로 조정.
3. **(W-3)** 현재 R-2 해설로 수용 가능. 향후 리팩 기회에 `resolvedTriggerSource` 로 DTO 필드 이름 변경 검토 — 이번 PR 에서 강제하지 않음.
4. **(I-5)** `spec/4-nodes/3-ai/1-ai-agent.md` 의 `LLM Information Tab` 구 명칭을 현행 명칭으로 갱신 (spec writer 가 별도 이슈 트래킹 또는 즉시 정정).
5. **(I-1~I-4)** 명시적 Rationale 한 줄 추가 및 표기 통일 — 기능 차단 없음, 다음 spec 수정 기회에 일괄 반영 가능.
---

## 호출자(main Claude/planner) 처리 결과 — 2026-06-11

**BLOCK: NO 확정 — Warning 3건 처분:**

- **W-1 (FP 확정)**: `git diff origin/main -- spec/2-navigation/14-execution-history.md` 실증 — diff 는 Overview 구조 변경(번호 소섹션 → 무번호, 페이지 구조 절 본문 일원화)뿐이고, `totalNodeCount`/`completedNodeCount`/`failedNodeCount` 는 파일에 5회 존재, `## Rationale` R-1~R-4 전부 보존(L499~513). checker 가 "구형 기준 재작성"으로 오판 — C-7 결과 제거 없음.
- **W-2 (거절 — 범위 밖 API 변경 제안)**: `executionPath` 를 목록 DTO 에서 제거하는 것은 **응답 계약 breaking 변경**(구현 코드 수정 수반)이다. 현행은 entity-shape 하위호환으로 빈 배열 고정이며 R-1 이 그 의도를 명시(#538). 문서 구조 정리 PR 에서 API 계약을 바꾸지 않는다 — 원하면 별도 plan 으로 추적.
- **W-3 (수용)**: checker 스스로 "R-2 해설 존재로 현재도 수용 가능" 판정. DTO rename(`resolvedTriggerSource`)은 breaking 이라 비채택.

INFO: **I-2 반영 ✅** — §2.3 에 `pending` 필터 제외 사유 한 줄 추가(2회 연속 제기라 종결). I-1(라벨 표기)·I-3(chat-channel 분류)·I-4(sort 기본값)·I-5(1-ai-agent 구명칭)·I-7·I-8 은 타 파일/저우선 nit 보류. 1차 실행은 rate limit 으로 전 checker 미산출 → 동일 세션 재실행 완료. docs-guard 2094 green.
