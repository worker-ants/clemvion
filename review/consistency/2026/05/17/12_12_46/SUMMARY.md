# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 수준 이슈 다수 존재하나 작업 차단 요건 미충족.

세션: `review/consistency/2026/05/17/12_12_46/`
모드: `--spec plan/in-progress/spec-draft-cafe24-restricted-scopes.md`

---

## 전체 위험도
**MEDIUM** — 데이터 모델 spec 불일치(`oauth_invalid_scope` 미등재, `last_error.details` 스키마 미정의)와 병렬 worktree 직렬화 조건 미확인이 주요 위험. 기존 spec 핵심 구조와 충돌하거나 합의된 invariant 를 위반하는 항목은 없음.

## Critical 위배 (BLOCK 사유)
없음

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Naming-Collision | `oauth_invalid_scope` 가 `Integration.status_reason` 기존 열거에 미등재 — 어느 status 버킷(`pending_install` / `error`)에 귀속되는지 불명확 | D1 §4.3, D5.5 §10.4 | `spec/1-data-model.md §2.10` status_reason 컬럼 정의 | `spec/1-data-model.md §2.10` status_reason 열거에 `oauth_invalid_scope` 를 추가하고 귀속 status 버킷을 명시 |
| W-2 | Cross-Spec / Naming-Collision | `last_error.details.requiresCafe24Approval` — 기존 `last_error { code, message, at }` 스키마에 `details` 키 없음 | D1 §4.3, D5.4 §9.4 | `spec/1-data-model.md §2.10` Integration.last_error 정의 | `last_error` 스키마를 `{ code, message, at, details? }` 로 확장 |
| W-3 | Cross-Spec | `INSUFFICIENT_SCOPE (403)` 응답 보강 범위 모호 | D5.4 §9.4 | `spec/2-navigation/4-integration.md §9.4` 기존 정의 | `details.missingScopes` 가 기존 필드인지 신규인지 한 줄 명시 |
| W-4 | Cross-Spec / Naming-Collision | `category` enum 값 `pg_settings` 의 적용 범위 모호 | D2.1, D6 §8.3 | D1 §2 operation 목록 | `pg_settings` 가 포괄하는 operation id 집합 주석 명시 |
| W-5 | Cross-Spec | `level='program'` — catalog `restricted` 컬럼 값 집합에 없으며 catalog-sync 처리 방침 미명시 | D2.1, D3.2 | D3.1 §2 컬럼 정의 | 검증 규칙 8 에 program 제외 조항 추가 |
| W-6 | Plan-Coherence | `spec/2-navigation/4-integration.md` 동시 수정 — 3 worktree 머지 여부 미확인 | D5 전체 | `plan/in-progress/spec-update-cafe24-test-connection.md` | 착수 전 머지 여부 확인 |
| W-7 | Plan-Coherence | `full-review-fixes-a1b2c3` W-69 머지 여부 미확인 | D6 전체 | `plan/in-progress/20260516-full-review/RESOLUTION.md` W-69 | 머지 여부 확인 후 착수 |
| W-8 | Plan-Coherence | `cafe24-backlog-residual.md` F-2 와 동일 파일 동시 수정 | D5.4·D5.5 | `plan/in-progress/cafe24-backlog-residual.md` F-2 | 양쪽 plan 상호 인식 명시 |
| W-9 | Convention-Compliance | 신규 컨벤션 파일에 `## Rationale` 섹션 없음 | D1 초안 전체 | CLAUDE.md 권장 3섹션 구성 | Rationale 섹션 추가 |
| W-10 | Convention-Compliance | `_overview.md` 파일명 — 기존 파일 문제, 본 draft 범위 외 | D3 | CLAUDE.md 명명 컨벤션 | 향후 housekeeping |

## 참고 (INFO)

| # | Checker | 항목 | 처리 |
|---|---------|------|------|
| I-1 | Naming-Collision | `details` 하위 구조 공식 정의 필요 | W-2 와 함께 처리 (last_error 스키마 확장) |
| I-2 | Naming-Collision | `restricted: op` 와 메타데이터 `restrictedApproval` 동시 채움 강조 | 영향 요약에 명시 |
| I-3 | Naming-Collision | `restricted` 컬럼과 기각 대안 `status: restricted` 동음이의어 혼동 | 컬럼 설명에 직교 명시 |
| I-4 | Cross-Spec | `category` enum ↔ operation id 패턴 매핑 | W-4 와 함께 처리 |
| I-5 | Cross-Spec | `paymentmethods_paymentproviders_list` 추적 필요 | store.md 안내 |
| I-6 | Rationale-Continuity | `details.missingScopes` 기존 여부 명시 | W-3 과 함께 처리 |
| I-7 | Rationale-Continuity | Analytics placeholder 미완 상태 명시 | §3 한 줄 추가 |
| I-8 | Convention-Compliance | CHANGELOG 섹션 번호 실제 확인 | 본 spec 반영에서 확인 |
| I-9 | Convention-Compliance | plan frontmatter `type` 필드 비표준 | 현 상태 유지 가능 |
| I-10 | Plan-Coherence | spec-update-impl-prep-findings C2 이중 추적 | 본 plan 범위 외 (별도 정리) |
| I-11 | Plan-Coherence | `catalog-sync.spec.ts` 구현용 developer plan | implementation phase 에서 처리 |
| I-12 | Rationale-Continuity | `oauth_invalid_scope` vs `oauth_token_exchange_failed` 진입 경로 구분 | §10.4 한 줄 명시 (W-1 과 함께) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `oauth_invalid_scope` 데이터 모델 미등재, `last_error.details` 스키마 불일치 |
| Rationale-Continuity | LOW | 기존 합의 원칙 위반 없음 |
| Convention-Compliance | LOW | 신규 컨벤션 파일 Rationale 누락 |
| Plan-Coherence | MEDIUM | 인접 worktree 머지 여부 미확인 |
| Naming-Collision | MEDIUM | `oauth_invalid_scope` 데이터 모델 불일치, `pg_settings` 범위 모호 |

## 처리 결과 (spec 반영 단계에서)

- W-6, W-7 — 인접 worktree (`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`, `prod-rereview-fix-a7c93f`, `full-review-fixes-a1b2c3`) 모두 main 머지 완료 확인 ✓
- W-1, W-2 — `spec/1-data-model.md §2.10` 의 `status_reason` 에 `oauth_invalid_scope` 추가 + `last_error` 스키마에 `details?: Record<string, unknown>` 확장
- W-3, I-6 — `spec/2-navigation/4-integration.md §9.4` 의 `INSUFFICIENT_SCOPE` 본문에 `missingScopes`/`requiresCafe24Approval` 양쪽 형식 명시 + 신규 보강 필드 표기
- W-4, I-4 — `spec/conventions/cafe24-api-metadata.md §2` 에 `category` 묶음 매핑 표 추가
- W-5 — `spec/conventions/cafe24-api-catalog/_overview.md §4` 검증 규칙 8 에 `level='program'` 제외 조항 명시
- W-8 — `plan/in-progress/cafe24-backlog-residual.md` F-2 와 본 plan 양쪽에 cross-reference 추가
- W-9 — `spec/conventions/cafe24-restricted-scopes.md` 에 `## Rationale` 섹션 신설 (기각 대안 + trade-off + 출처)
- I-3 — `_overview.md §2` 의 `restricted` 컬럼 설명에 "status 와 직교" 한 줄 추가
- I-7 — `spec/conventions/cafe24-restricted-scopes.md §3` 에 Analytics placeholder 미완 상태 명시
- I-12 — `spec/2-navigation/4-integration.md §10.4` 의 `Cafe24 invalid_scope` 행에 `oauth_token_exchange_failed` 와의 진입 경로 분리 한 줄 명시

W-10 (catalog 파일명) 은 본 draft 범위 외 — 향후 housekeeping. I-10 (impl-prep-findings C2) 도 본 plan 범위 외.

## 후속

- I-11 — implementation phase 에서 `catalog-sync.spec.ts` 갱신을 developer 작업 항목으로 포함.
