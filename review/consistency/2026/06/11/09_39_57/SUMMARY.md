# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 4개 WARNING (JSON 샘플 불일치 2건, 문서 구조 중복 1건, DTO 네임스페이스 혼동 1건) + 다수 INFO. Critical 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | 목록 API 응답 JSON 샘플에 `totalNodeCount`/`completedNodeCount`/`failedNodeCount` 집계 필드 누락 | `spec/2-navigation/14-execution-history.md` §5 목록 API 응답 JSON 샘플 | 동 문서 §2.4 및 §R-1 | JSON 샘플에 `"totalNodeCount": 5, "completedNodeCount": 5, "failedNodeCount": 0` 추가 |
| W-2 | Cross-Spec | 목록 API 응답 JSON 샘플에 `executionPath` 잔존 — 목록 API 의 N+1 회피 원칙(§R-1)과 충돌 여부 미명시 | `spec/2-navigation/14-execution-history.md` §5 목록 API 응답 JSON 샘플 `"executionPath": []` | `spec/1-data-model.md` §2.13 (V036 DROP 이력) + §R-1 N+1 회피 원칙 | (a) 목록 API 샘플에서 `executionPath` 제거, 또는 (b) 목록 API 에서도 배치 조회로 제공함을 §R-1 에 명시. 실제 `executions.service.ts` 동작 기준으로 정합 |
| W-3 | Convention Compliance | `## Overview` 내 번호 소섹션(`### 1.`, `### 2.`, `### 3.`)과 본문 H2 번호 체계(`## 1.`, `## 2.`, ...) 중복 — CLAUDE.md 권장 3섹션 구분 모호화 | `spec/2-navigation/14-execution-history.md` 라인 18–111 (Overview 내 중첩) vs 라인 114 이후 (본문 H2) | CLAUDE.md §정보 저장 위치 (Overview / 본문 / Rationale 3섹션 구성) | Overview 는 제품 정의·목표·요구사항 테이블만 유지, 세부 화면 명세는 본문 H2 에만 배치. 번호 체계가 두 곳에서 독립 사용되지 않게 정리 |
| W-4 | Convention Compliance | 목록 API 응답 예시가 `ApiOkPaginatedResponse` 이중 봉투 구조 미반영 — wire 포맷과 불일치 | `spec/2-navigation/14-execution-history.md` 라인 452–485 목록 API 응답 JSON 블록 | `spec/conventions/swagger.md §5-2` (`ApiOkPaginatedResponse` 래퍼) + `§2-5` (TransformInterceptor) | 응답 예시를 `{ "data": { "data": [...], "pagination": {...} } }` 로 정정하거나, "TransformInterceptor 에 의해 최상위 `data` 봉투가 추가된다" 주석 명시 |
| W-5 | Naming Collision | `triggerSource` DTO 필드명이 엔진 내부 마커 `__triggerSource`(3종 enum)와 이름 유사·값 부분 중복 — 구현자 혼동 가능 | `spec/2-navigation/14-execution-history.md` §2.4 Trigger 열 / ExecutionDto `triggerSource`(5종) | `spec/4-nodes/7-trigger/0-common.md`, `spec/data-flow/10-triggers.md` 의 `__triggerSource`(3종 내부 마커) | §2.4 또는 R-2 에 "내부 엔진 마커 `__triggerSource`(3종)와 별개 — 응답 DTO `triggerSource`는 `parent_execution_id` 판정 포함 5종 정규화 결과" 한 줄 명시 |

> W-1 과 W-4 는 동일 JSON 샘플(§5 목록 API 응답)에 대한 두 가지 각도의 지적이며, 해당 블록 1회 수정으로 함께 해소 가능.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `sort` 쿼리 파라미터 값이 snake_case — API 규약에 케이스 명시 부재 | `spec/2-navigation/14-execution-history.md` §5 쿼리 파라미터 | `spec/5-system/2-api-convention.md §4.1` 에 `sort` 값 케이스(DB column 이름 그대로 snake_case) 한 줄 추가. target 유지 |
| I-2 | Cross-Spec | 필터 레이블 `Waiting`(§2.3) vs `Waiting for Input`(EH-LIST-03) 약어 불일치 | 동 문서 내부 | §2.3 을 "Waiting for Input" 으로 통일하거나 EH-LIST-03 을 "Waiting" 으로 맞춤 |
| I-3 | Cross-Spec | `pending` 상태가 필터·테이블에서 누락 — 제외 이유 미기술 | `spec/2-navigation/14-execution-history.md` §2.3 필터 목록 | §2.3 또는 Rationale 에 `pending` 제외 이유(순간적 전이 상태, 사용자 진단 불필요) 한 줄 명시 |
| I-4 | Cross-Spec | `spec/0-overview.md` §4 문서 맵 — 실행 이력 행 구조 일치 확인됨 | `spec/0-overview.md` §4 | 변경 불필요 |
| I-5 | Rationale Continuity | EH-LIST-02 요구사항 텍스트에 "트리거 유형" 구식 표현 잔존 — R-2 의 `triggerSource` 설계와 불일치 | `spec/2-navigation/14-execution-history.md` §3.1 EH-LIST-02 | EH-LIST-02 텍스트를 "트리거 출처 표시 (`triggerSource` — 5종 enum, §2.4 Trigger 열)" 로 갱신 |
| I-6 | Rationale Continuity | §2.2 Back 링크 `router.back()` 채택 근거 Rationale 부재 — 상세 페이지 헤더 "← Executions" 고정 링크와 비대칭 | `spec/2-navigation/14-execution-history.md` §2.2 헤더 표 | Rationale 또는 비고에 "browser history stack 기반 — 이전 어느 화면으로든 돌아가는 것이 의도" 명기. 또는 §3.1 과 일치하도록 고정 경로 링크로 통일 결정 |
| I-7 | Convention Compliance | PUT 메서드 규약 위반 우려 — 본 문서 내 직접 위반 없음, 참조 Re-run spec 확인 권장 | `spec/2-navigation/14-execution-history.md` 라인 434–439 API 테이블 | Re-run spec 별도 검토 시 `spec/5-system/2-api-convention.md §3` 준수 여부 확인 |
| I-8 | Convention Compliance | Overview 내 소섹션 사이 `---` 구분선 과도 삽입 — 계층 구분 희석 | 라인 20, 37, 48, 58 | Overview 내 소섹션 간 구분선 제거 또는 줄바꿈만으로 완화 |
| I-9 | Convention Compliance | 요구사항 테이블 `상태` 컬럼에 `✅` 이모지 사용 — spec-impl-evidence frontmatter `status` 와 중복 | 라인 78–110 요구사항 테이블 | 텍스트 값(`implemented`/`pending`)으로 대체하거나 상태 컬럼 제거해 frontmatter 단일 진실 강화 |
| I-10 | Plan Coherence | `spec-sync-structural-followups.md` C-7 내부 링크가 stale — `plan/in-progress/spec-sync-execution-history-gaps.md` 참조가 `plan/complete/` 이동 후에도 잔존 | `plan/in-progress/spec-sync-structural-followups.md` C-7 수정 힌트 | C-7 힌트를 `plan/complete/spec-sync-execution-history-gaps.md` 로 정정. target spec 변경 불필요 |
| I-11 | Naming Collision | EH-LIST-*, EH-DETAIL-*, EH-NAV-* 식별자 — 기존 cross-reference 와 일치, 충돌 없음 | `spec/2-navigation/14-execution-history.md` 요구사항 표 | 변경 불필요 |
| I-12 | Naming Collision | `triggerLabel` DTO 필드, frontmatter `id: execution-history`, API endpoint 4개 — 신규, 충돌 없음 | 동 문서 전반 | 변경 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | JSON 샘플 집계 필드 누락(W-1) + `executionPath` 목록 포함 여부 미명시(W-2) |
| Rationale Continuity | LOW | 기각 대안 재도입 없음. INFO 2건(용어 불일치, Back 링크 근거 부재) |
| Convention Compliance | LOW | 섹션 번호 중복 구조(W-3) + API 응답 이중 봉투 미반영(W-4) |
| Plan Coherence | NONE | 충돌 worktree 0건. stale 링크 1건(INFO) |
| Naming Collision | LOW | `triggerSource` vs `__triggerSource` 혼동 가능성(W-5). 나머지 충돌 없음 |

## 권장 조치사항
1. **(W-1 + W-4 동시 해소)** `spec/2-navigation/14-execution-history.md` §5 목록 API 응답 JSON 샘플을 `{ "data": { "data": [...집계 3필드 포함 ExecutionDto...], "pagination": {...} } }` 형태로 교정 — `totalNodeCount`/`completedNodeCount`/`failedNodeCount` 추가 및 `ApiOkPaginatedResponse` 이중 봉투 반영.
2. **(W-2)** `executionPath` 의 목록 API 포함 여부를 실제 `executions.service.ts` 동작 기준으로 명확화 — 목록 제외라면 샘플에서 삭제, 포함이라면 §R-1 에 배치 조회 방식 명시.
3. **(W-3)** Overview 내 번호 소섹션을 본문 H2 와 분리 정리 — Overview 는 제품 정의·요구사항 테이블만 유지, 세부 명세는 본문으로 이동.
4. **(W-5)** §2.4 또는 R-2 에 `triggerSource`(5종 응답 DTO)와 `__triggerSource`(3종 내부 마커) 차이 한 줄 명시.
5. **(I-5, I-6)** EH-LIST-02 텍스트 용어 정비 + §2.2 Back 링크 Rationale 보강 — 소규모 텍스트 수정.
6. **(I-10)** `plan/in-progress/spec-sync-structural-followups.md` C-7 stale 링크 정정.
---

## 호출자(main Claude/planner) 처리 결과 — 2026-06-11

**BLOCK: NO 확정 — Warning 5건 처분:**

- **W-1 (반영 ✅)**: §5 목록 JSON 샘플에 `totalNodeCount`/`completedNodeCount`/`failedNodeCount` 추가 — 실제 `toExecutionDto` 응답 필드와 일치 확인.
- **W-2 (반영 ✅, 방안 b)**: 코드 실측(`executions.service.ts` `toExecutionDto`) — 목록 응답의 `executionPath` 는 **항상 빈 배열 고정**(N+1 회피, 단건 조회만 채움). R-1 에 이 고정 동작을 명시. 샘플의 `[]` 는 정확.
- **W-3 (보류)**: Overview 내 번호 소섹션 vs 본문 H2 중복은 **pre-existing 구조**(본 PR 은 Rationale 추가만). Overview/본문 재배치는 의미 변경 위험이 있는 별도 정리 사안 — 본 hygiene PR 범위 밖.
- **W-4 (FP 거절)**: 정본 규약 `2-api-convention.md §5.2` 자체가 `{ data, pagination }` 단일 봉투를 목록 응답 문서화 정본으로 정의 — 본 spec 샘플과 일치. checker 가 Swagger 데코레이터(`ApiOkPaginatedResponse`) 레이어와 혼동.
- **W-5 (반영 ✅)**: R-2 에 `triggerSource`(DTO 5종) vs `__triggerSource`(엔진 내부 마커 3종) 구분 문단 추가.

INFO: I-5(EH-LIST-02 용어 ✅)·I-10(stale plan 링크 ✅) 반영. I-2/I-3/I-6/I-8/I-9 는 무해 nit 보류. docs-guard 2091 green.
