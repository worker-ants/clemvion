---
worktree: spec-2-navigation-hygiene-c3d5e7
started: 2026-05-17
owner: planner
---

# Spec Draft: 14-execution-history 자기 참조 제거 + 1-data-model §2.10 에 autoRefresh derived 주석

> 대상 spec: `spec/2-navigation/14-execution-history.md`, `spec/1-data-model.md`
> 발단: `consistency-check --impl-prep` (`review/consistency/2026/05/17/12_54_16/`) 의 BLOCK: YES — Critical C-1 (`14-execution-history.md` 줄 3 자기 참조 PRD 링크) + W-1 (data-model 에 `autoRefresh` derived 필드 미언급)
> 자매 PR: `plan/in-progress/integration-token-ui-autorefresh.md` (다른 worktree — 본 PR merge 후 구현 진입 예정)
> 사용자 결정 (2026-05-17): 작은 spec 위생 PR 먼저 진행 (정통 SDD)

## 1. 개정 요지

본 PR 은 `integration-token-ui-autorefresh` 구현 진입의 BLOCK 해소 + 그 변경과 직접 관련된 data-model 위생 1줄 보강만 다룬다. 2~3 라인 패치 수준의 작은 PR. 그 외의 spec 위생 항목(W-2/W-5/W-6/W-7 등) 은 응집도 분리 원칙에 따라 본 PR 범위 밖.

## 2. 본 PR 범위 / 범위 밖

### 본 PR 범위

| 변경 | 위치 | 사유 |
| --- | --- | --- |
| A. 자기 참조 PRD 링크 제거 | `spec/2-navigation/14-execution-history.md` 줄 3 헤더 blockquote | Critical C-1 해소. docs-consolidation 이후 PRD 가 본 파일 §Overview 로 흡수돼 자기 자신 링크가 무의미 |
| B. `autoRefresh` derived 가상 필드 주석 | `spec/1-data-model.md §2.10 Integration` 표 직후 | W-1 해소. 구현자가 DB 컬럼으로 오인하지 않도록 명시 |

### 본 PR 범위 밖 (별도 plan 또는 후속 PR)

| 항목 | 사유 | 위임처 |
| --- | --- | --- |
| W-2 silent refresh 흐름 cross-ref | 세션 토큰 영역 — 본 작업과 무관 도메인 | 별도 plan 신설 (또는 cafe24-backlog-residual 같은 누적 plan) |
| W-5 14-execution-history Overview 중복 구조 정리 | 본 PR 의 Critical 해소와 응집도 별개의 큰 구조 변경 | 별도 plan |
| W-6 14-execution-history 의 `prd/` 출처 blockquote (줄 9) | Critical 과 같은 영역이긴 하나 별개의 사상 (history 보존 vs 제거) — 결정 비용 있음 | 별도 plan |
| W-7 0-dashboard / 11-error-empty-states / 12-workflow-version-history / 13-user-guide Rationale 누락 | 4개 파일 영역 위생 — 본 작업과 결합도 없음 | 별도 plan |
| I-1~I-8 (14-execution-history JSON 필드, 10-auth-flow HTTP method, 0-dashboard prefix, 12-workflow-version-history API prefix 등) | 다른 영역 위생 | 별도 plan |

> 별도 plan 의 권고 이름: `plan/in-progress/spec-update-2-navigation-hygiene-followup.md` (신설). 본 PR merge 후 분리 발주.

## 3. 정확한 패치 (before / after)

### 3.1 `spec/2-navigation/14-execution-history.md` 줄 3 — 자기 참조 PRD 링크 제거

**Before** (라인 3):
```markdown
> 관련 문서: [PRD 실행 내역](./14-execution-history.md) · [Spec 대시보드](./0-dashboard.md) · [Spec 워크플로우 목록](./1-workflow-list.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)
```

**After**:
```markdown
> 관련 문서: [Spec 대시보드](./0-dashboard.md) · [Spec 워크플로우 목록](./1-workflow-list.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)
```

**근거**: 본 파일은 docs-consolidation(2026-05-12) 으로 옛 `prd/7-execution-history.md` 가 흡수된 결과다 — 본문 §Overview (제품 정의) 가 PRD 역할을 직접 수행. 따라서 자기 자신을 PRD 로 가리키는 링크는 의미 없는 순환 참조. 단순 제거가 가장 단순한 해결책이며, `_product-overview.md` 같은 다른 PRD 위치도 본 영역에 없음 (영역의 PRD 는 `spec/2-navigation/_product-overview.md` 가 담당하지만 그건 영역 전체의 PRD 라 본 파일 헤더의 "관련 문서" 행에 다시 거는 것은 별 의미 없음).

### 3.2 `spec/1-data-model.md §2.10 Integration` — `autoRefresh` derived 가상 필드 주석 추가

**위치**: 라인 266 `**제약조건**: UNIQUE(workspace_id, name) ...` 직후, 라인 268 `### 2.10.1 IntegrationUsageLog` 직전.

**Before** (라인 264~268):
```markdown
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약조건**: `UNIQUE(workspace_id, name)` — 워크스페이스 내 별칭 유일성

### 2.10.1 IntegrationUsageLog
```

**After**:
```markdown
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약조건**: `UNIQUE(workspace_id, name)` — 워크스페이스 내 별칭 유일성

**응답 DTO 전용 derived 필드**: `autoRefresh: boolean` 은 위 표의 DB 컬럼 목록과 별개로 API 응답(`IntegrationDto`) 에만 노출되는 derived 필드다 — `ServiceDefinition.supportsTokenAutoRefresh` (backend service registry — 현재 cafe24/google 만 true) 에서 매 응답 시점에 계산되며 DB 컬럼이 아니다. UI 의 attention/expiring 술어가 짧은-수명 토큰의 거짓 양성을 피하기 위해 사용하는 분기 신호. 정의·전체 동작은 [Spec 통합 화면 §9.1](./2-navigation/4-integration.md#91-목록crud) 와 같은 문서의 Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)" 참조.

### 2.10.1 IntegrationUsageLog
```

**근거**: cross-spec checker 가 보고한 W-1 — 구현자가 `autoRefresh` 를 DB 컬럼으로 오인할 위험. 같은 §2.10 안에서 표 직후 한 단락만 있으면 충분 (`spec/2-navigation/4-integration.md §9.1` 의 IntegrationDto 정의와 cross-ref). 표 안에 행으로 추가하면 DB 컬럼으로 더 오인되므로 별도 단락으로 분리.

## 4. 의사결정 명시

| 결정 | 채택 안 | 폐기 안 / 사유 |
| --- | --- | --- |
| 자기 참조 링크 처리 | **제거** | `_product-overview.md` 참조로 교체 — 영역 전체 PRD 라 본 파일의 헤더에 다시 걸 가치 미미 |
| autoRefresh 위치 | **§2.10 표 직후 별도 단락** | 표 안의 행 — DB 컬럼으로 오인 위험 |
| W-6 (`prd/` 출처 blockquote 줄 9) 동시 처리 여부 | **분리** | 동시 처리 — 같은 헤더 영역이긴 하나 별개 사상(history 보존 vs 제거), 본 PR 의 Critical 해소와 결합도 없음. 응집도 우선 |
| W-5 / W-7 / I-* 동시 처리 | **분리** | 동시 — 4개 파일·6개 영역 위생을 본 PR 에 묶으면 PR 의 의도(BLOCK 해소)가 흐려짐 |

## 5. 후속

- 본 PR merge 후 사용자가 `integration-token-ui-autorefresh-a3f9b2` worktree 로 복귀해 main rebase + consistency-check 재실행 → BLOCK: NO 확인 → 구현 진입
- W-5/W-6/W-7/I-* 위생 항목은 `plan/in-progress/spec-update-2-navigation-hygiene-followup.md` 신설로 추적 (본 PR 와 같은 PR cycle 안에서 신설 가능, 별도 PR 도 가능 — project-planner 가 작업 후 결정)

## 6. 진행 체크리스트

- [x] 자매 plan + impl-prep 결과 컨텍스트 흡수
- [x] draft 작성
- [x] `/consistency-check --spec plan/in-progress/spec-draft-2-navigation-hygiene.md` 호출 (세션 `review/consistency/2026/05/17/13_11_44/`)
- [x] Critical 0건 확인 — **BLOCK: NO**. WARNING 1건 (본 체크리스트 보강) 즉시 해소, INFO 7건은 참고
- [x] spec 본문 패치 적용 (`14-execution-history.md` 줄 3 / `1-data-model.md §2.10 후미`)
- [ ] follow-up plan 신설 (선택 — W-5/W-6/W-7/I-* 추적; 본 PR 과 분리 가능)
- [ ] commit + PR
- [ ] PR merge 후 `integration-token-ui-autorefresh-a3f9b2` worktree 진입 가능 → main rebase → consistency-check 재실행 → 구현 진입
- [ ] PR merge 후 draft 처리 완료 시 `git mv` → `plan/complete/`
