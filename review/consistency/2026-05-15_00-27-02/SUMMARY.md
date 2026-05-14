# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — 마이그레이션·에러 코드·Cafe24 메타 등 핵심 규약은 모두 준수. WARNING 2건은 Rationale 1줄 추가 수준으로 해소 가능.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | Convention Compliance | `NodeExecution.interaction_data` 스키마가 `node-output.md` Principle 4.5와 필드명·값·구조 3면 불일치 (`interactionType` vs `interaction.type`, `"form_submit"` vs `"form_submitted"`, payload 평탄화 vs `data: {}` 중첩) | `spec/1-data-model.md` §2.14 `interaction_data` | `spec/conventions/node-output.md` Principle 4.5 | `interaction_data` 설명을 규약과 동기화하거나, 변환 계층이 의도적이라면 Rationale에 변환 규칙 1줄 명시 |
| 2 | Cross-Spec (+ Rationale) | `mall_id` UNIQUE 제약 — "public·private 동시 보유 불가" 전제의 비즈니스 근거가 spec 어디에도 없음. Public App 지원 추가 시 제약 해제 의사결정 불가 | `spec/1-data-model.md` §2.10 `mall_id`, §3 인덱스 | `spec/2-navigation/4-integration.md` §5.8 | §2.10 또는 Rationale에 "동일 workspace 내 동일 mall_id는 app_type 무관 단일 통합만 허용 — 중복 인증 혼란 방지" 1줄 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Naming Collision | `mall_id` dual representation — plain column vs `credentials` JSONB 내 동명 키 공존 | `spec/1-data-model.md` §2.10 | 현 spec 설명("credentials.mall_id의 plain projection")으로 충분. 코드 레벨 타입 엄격성으로 보완 |
| 2 | Convention Compliance | `## Overview` 섹션 부재 — 문서가 §1 엔티티 관계 개요로 바로 시작 | `spec/1-data-model.md` 최상단 | `# Spec: 데이터 모델` 아래에 범위·목적 Overview 섹션 추가 (권장, 우선순위 낮음) |
| 3 | Convention Compliance | `NodeExecution.error.stack?` vs 규약 `details?` 필드명 불일치 | `spec/1-data-model.md` §2.14 `error` | DB 저장용 의도라면 Rationale에 차이 1줄 기술, 또는 규약을 `stack?`으로 갱신 검토 |
| 4 | Cross-Spec | `(workspace_id, status)` 인덱스가 TTL 스캐너의 전역 scan 패턴에 비효율적일 수 있음 — leading column이 workspace_id | `spec/1-data-model.md` §3 인덱스 | `(status, install_token_issued_at) WHERE status='pending_install'` 부분 인덱스 추가 검토, 또는 스캐너가 workspace_id를 선행 조건으로 사용한다는 전제를 spec에 명시 |
| 5 | Cross-Spec | `install_timeout` → `expired` 전이 대상 상태가 `install_token_issued_at` 설명에 명시되지 않음 | `spec/1-data-model.md` §2.10 `install_token_issued_at`, `status_reason` | 필드 설명에 "만료 시 `status = expired`, `status_reason = install_timeout`으로 갱신" 1줄 추가 |
| 6 | Cross-Spec | V044 이전 행의 `created_at` fallback 동작 — 배포 직후 일괄 expired 처리 여부가 불명확 | `spec/1-data-model.md` §2.10 `install_token_issued_at` | "V044 이전 행은 created_at 기준 24h TTL 동일 적용(초과 시 즉시 expired)" 또는 "스캐너가 건드리지 않음" 중 의도 명시 |
| 7 | Plan Coherence | `cafe24-pending-polish.md` 변경 3/4 체크박스 미갱신 — 상단 완료 선언과 불일치 | `plan/in-progress/cafe24-pending-polish.md` | PR #18 머지 후 `complete/`로 이동 시 체크박스 정리 |
| 8 | Rationale Continuity | in-memory 중복 가드가 `app_type === 'private'`만 필터 → public↔private 교차 중복 시 SQL UNIQUE(23505)가 대신 차단, 에러 메시지 구체성 저하 | `integration-oauth.service.ts:876` | `app_type` 필터 제거 또는 SQL 23505 위반 메시지를 교차 타입 충돌로 분기 처리 (현재 409 반환은 올바름) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `mall_id` UNIQUE 근거 미문서화(WARNING), TTL 스캐너 인덱스 패턴·전이 상태·fallback 동작 명시 필요(INFO 3건) |
| Rationale Continuity | LOW | in-memory 가드 public↔private 교차 케이스 미커버(INFO) — SQL backstop으로 실질 위험 없음 |
| Convention Compliance | LOW | `interaction_data` ↔ `node-output.md` Principle 4.5 불일치(WARNING), Overview 섹션·`stack?` 명명 차이(INFO 2건) |
| Plan Coherence | NONE | cafe24-pending-polish 체크박스 미갱신(추적 가독성 수준). 구현 차단 없음 |
| Naming Collision | LOW | `mall_id` dual representation — spec 설명으로 의미 혼선 낮음 |

---

## 권장 조치사항

1. **(WARNING 1 해소)** `spec/1-data-model.md` §2.14 `interaction_data` 설명에 "런타임 `output.interaction`을 DB에 저장 시 필드명·값 변환이 발생한다" 주석 또는 Rationale 1줄 추가. `node-output.md`와 동기화가 더 깔끔하면 spec 통일.
2. **(WARNING 2 해소)** `spec/1-data-model.md` §2.10 Rationale에 "동일 workspace 내 동일 `mall_id`의 Cafe24 통합은 `app_type` 무관 1개만 허용 — 이중 인증으로 인한 토큰 충돌 방지" 1줄 추가.
3. **(INFO 5 — 구현 직전 확인)** `install_token_issued_at` 설명에 `expired` 전이 명시 후 `integration-expiry-scanner.service.ts` 구현.
4. **(INFO 6 — 구현 직전 확인)** V044 이전 행의 `created_at` fallback 동작 방침을 결정하고 spec에 1줄 명시 후 스캐너 구현.
5. **(INFO 4 — 선택)** TTL 스캐너 쿼리 패턴에 맞는 부분 인덱스 추가 여부를 구현 중 실제 쿼리 확인 후 결정.
6. **(INFO 7 — PR 머지 후)** `cafe24-pending-polish.md`를 `plan/complete/`로 `git mv`.