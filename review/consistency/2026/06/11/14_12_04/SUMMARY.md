# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

**대상 문서**: `spec/2-navigation/14-execution-history.md`
**검토 일시**: 2026-06-11
**검토 모드**: spec draft (--spec)

---

## 전체 위험도

**LOW** — 5개 checker 중 Critical·WARNING 등급 발견 없음. 모든 발견사항은 INFO 수준이며 실질 규약 위반이 아닌 표현 불명확·관행적 패턴에 해당한다.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

해당 없음.

> convention_compliance checker 가 초기 분석 중 WARNING 후보 2건(`PUT` 메서드 사용, `pagination` 필드명 불일치)을 검토했으나, 양쪽 모두 자체 분석을 통해 "위반 없음"으로 최종 격하하였다. 실질 WARNING 0건.

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | Re-run 모달 원본 ID 클릭("새 탭") vs chain badge 원본 ID 클릭("같은 탭") — 두 맥락이 달라 의도적 설계일 가능성이 높으나 표현이 모호 | `§3.7` chain badge 행 / `spec/5-system/13-replay-rerun.md §10.2` | 각 문서에 맥락 차이(모달 내 vs 페이지 내 네비게이션)를 명시적으로 구분 표기. 의도적 차이라면 Rationale 추가 |
| 2 | Cross-Spec | Re-run disabled tooltip 표현 방식 불일치 — target 은 i18n 키, Re-run spec §10.1 은 번역된 텍스트 직접 기술 | `§3.7` Re-run 버튼 행 / `spec/5-system/13-replay-rerun.md §10.1` | 두 문서를 같은 방식(둘 다 i18n 키 또는 둘 다 인라인 텍스트)으로 동기화 |
| 3 | Rationale Continuity | `spec/3-workflow-editor/3-execution.md §Rationale` 에 LLM 탭 평탄화 결정 SoT cross-link 부재 — 에디터 spec 독자가 "왜 LLM Usage 탭만 최상위인가" 를 찾을 때 혼란 가능 | `spec/3-workflow-editor/3-execution.md §Rationale` | "LLM 탭 구조 결정의 SoT: 14-execution-history.md R-3" 한 줄 추가(이 문서 범위 밖) |
| 4 | Rationale Continuity | `pending` 상태 필터 제외 결정이 인라인 주석에만 존재, Rationale 항목 없음 | `§2.3` 필터 표 하단 주석 | 필요 시 Rationale "R-5. pending 상태를 필터 칩에서 제외한 이유" 항 추가(현 인라인도 허용 가능) |
| 5 | Rationale Continuity | API 규약 §4.1 에 "도메인별 sort 기본값 오버라이드 허용" 명문화 부재 | `spec/5-system/2-api-convention.md §4.1` | 규약 문서에 허용 명문화(이 문서 범위 밖) |
| 6 | Convention Compliance | frontmatter `id: execution-history` 가 파일 basename `14-execution-history` 에서 숫자 prefix 제거 — spec-impl-evidence §2.1 "basename 기반 권장"에서 벗어남 | frontmatter 2행 | 프로젝트 전반 관행이므로 수정 불필요. 규약 문서에 "숫자 prefix 제거는 허용된 관행" 명시 권장 |
| 7 | Convention Compliance | `GET /api/executions/workflow/:workflowId` — 중간 세그먼트 `workflow` 가 단수형으로 API 규약 §2.2 "리소스는 복수형 명사"와 미약 불일치 | `§5 API 엔드포인트` 표 | `status: implemented` 이므로 구현 변경 없이 spec 에 "필터 경로의 단수 허용" 주석 추가 |
| 8 | Plan Coherence | active worktree `audit-coverage-naming`, `unified-model-mgmt-5af7ee` 가 PR #540 이전 base 보유 — target 변경 영역(행 115/151/425)과 겹치지 않아 직접 conflict 없으나, rebase 시 Overview 구조 변경(PR #540) 흡수 필요 | 두 worktree 의 `14-execution-history.md` | 해당 worktree 담당자에게 `origin/main` rebase 후 최신 본문 재확인 안내 |
| 9 | Naming Collision | `ExecutionDto.triggerSource`(5종 enum)와 엔진 내부 마커 `__triggerSource`(3종)가 이름 유사 — Rationale R-2 에서 레이어·값 집합 차이를 명시적으로 설명하여 충돌 수준은 아님 | `spec/2-navigation/14-execution-history.md` Rationale R-2 | 구현 단계에서 TypeScript 타입명을 `TriggerSourceDto` 등으로 명확히 분리해 컴파일 타임 혼용 방지 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | INFO 3건: executionPath 빈 배열 이유 불명확(Rationale R-1 로 해소), tooltip 표현 방식 불일치, chain badge vs 모달 내 원본 ID 클릭 동작 명시 부재 |
| Rationale Continuity | NONE | INFO 3건: 에디터 spec cross-link 부재, API 규약 명문화 부재, pending 필터 Rationale 항 선택적 추가 |
| Convention Compliance | LOW | INFO 2건: frontmatter id 숫자 prefix 제거(관행), workflow 단수 세그먼트(미약 불일치). WARNING 후보 2건 모두 자체 격하 |
| Plan Coherence | NONE | INFO 2건: stale worktree 2건 정리 권장, active worktree 2건 rebase 시 주의 안내. 직접 merge conflict 없음 |
| Naming Collision | NONE | INFO 1건: triggerSource 유사명 혼동 가능성, Rationale R-2 명시로 충돌 수준 아님 |

---

## 권장 조치사항

1. **(이 문서 내)** `§3.7` chain badge 행에 "(chain badge — 같은 탭 이동, 모달 내 원본 헤더와 다름)" 주석 추가, 또는 Rationale 에 두 클릭 맥락의 동작 차이 설명 추가 — Cross-Spec INFO #1 해소.
2. **(이 문서 내)** `GET /api/executions/workflow/:workflowId` 엔드포인트 행에 "필터 경로 단수 허용 — 도메인 오버라이드" 주석 추가 — Convention Compliance INFO #7 해소.
3. **(타 문서, 선택적)** `spec/3-workflow-editor/3-execution.md §Rationale` 에 LLM 탭 구조 SoT cross-link 한 줄 추가.
4. **(타 문서, 선택적)** `spec/5-system/2-api-convention.md §4.1` 에 "도메인별 sort 기본값 오버라이드 허용" 명문화.
5. **(운영)** stale worktree `ai-node-override-fields`, `auth-refresh-rotation-atomic` 정리 권장 (`cleanup-worktree-all.sh --yes --force`).
6. **(구현 단계)** `triggerSource` DTO 타입명을 `TriggerSourceDto` 등으로 분리해 엔진 내부 마커 `__triggerSource` 와 컴파일 타임 혼용 방지.
---

## 호출자(main Claude/planner) 처리 결과 — 2026-06-11

**BLOCK: NO 확정 — Critical 0 · WARNING 0.** INFO 9건 처분: 전부 선택적(타 문서 cross-link·규약 명문화·구현 단계 타입명)이거나 이미 본 변경이 해소한 항목(R-1 의 executionPath 설명). 본 nit 묶음 PR 의 범위(6건 — I-5 구명칭·I-1 라벨 통일·I-6 Back 근거·I-4 sort 오버라이드·OAuth error param 레지스트리·6-config Overview)를 추가 확장하지 않고 종결. INFO #8(worktree rebase 안내)은 운영 참고. docs-guard 2098 green (link-integrity 가 잡은 §4.1 앵커 오타 1건 즉시 수정 포함).
