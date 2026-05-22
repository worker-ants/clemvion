# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 수준 발견이 없어 현 단계에서 spec draft 진행을 차단하지 않음.

> target: `plan/in-progress/spec-draft-triggers-edit-delete.md`
> mode: spec draft 검토 (--spec)
> 검토일: 2026-05-22
> session: `review/consistency/2026/05/22/11_59_25/`

## 전체 위험도

**MEDIUM** — CRITICAL 수준(데이터 모델 정의 충돌, API endpoint 중복 구현, 요구사항 ID 충돌, 기존 합의 정면 위반) 없음. 에러 코드 명명 불일치 2건, plan 간 직렬화 의존성 미명시, i18n 키 중복 등 spec 본문 반영 전 정정이 권장되는 WARNING 14건 + INFO 16건.

## Critical 위배 (BLOCK 사유)

없음.

## WARNING (14건)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | 에러 코드 `VALIDATION_FAILED` — 기존 `VALIDATION_ERROR` 와 직접 모순 | Change 4 fine-print | `spec/5-system/3-error-handling.md §1.3` | `VALIDATION_ERROR` 로 정정 |
| W-2 | Cross-Spec | 에러 코드 `TRIGGER_NOT_FOUND` — 기존 `RESOURCE_NOT_FOUND` 와 불일치 | Change 5 §4.4 | `spec/5-system/3-error-handling.md §1.3` | `RESOURCE_NOT_FOUND` 로 정정 또는 리소스-특화 코드 허용 정책 명시 |
| W-3 | Cross-Spec | schedule 타입 트리거 Trigger 화면 삭제 허용 — data-flow 동기화 규칙 표 미반영 | Change 5 §4.3·§4.4 | `spec/data-flow/10-triggers.md §1.4` | data-flow §1.4 표에 해당 행 추가 또는 §4.3 cross-link 명시 |
| W-4 | Cross-Spec | `_layout.md` 이름 confirm 패턴 참조가 실제 spec 에 없음 | Change 5 §4.2 | `spec/2-navigation/_layout.md` (해당 패턴 미존재) | 참조 문구 제거하거나 정확한 근거로 교정 |
| W-5 | Rationale Continuity | `isActive` 편집 경로 이중화 — `/toggle` endpoint 위상 Rationale 부재 | Change 3 §2.3.1·Change 4 | `spec/2-navigation/2-trigger-list.md §3 PATCH /toggle` | Rationale R-4 추가 |
| W-6 | Rationale Continuity / Naming Collision | `/auth/rotate-secret` 채널 세그먼트 신설 — convention 미등록 | Change 4 | `spec/5-system/2-api-convention.md §2.2` | Rationale 추가 또는 경로 확정 후 §2.2 예시 갱신 |
| W-7 | Convention Compliance | 신규 에러 코드 등재 여부 미명시 | Change 4 / Change 5 §4.4 | `spec/5-system/3-error-handling.md` | spec PR 체크리스트 항목 명기 |
| W-8 | Convention Compliance | v1.1 후속 미확정 API endpoint 를 §3 표에 혼재 등재 | Change 4 v1.1 행 | spec 표 확정성 규약 | `NOTE: 예약 선언` 블록 쿼트 추가 |
| W-9 | Plan Coherence | plan B `PATCH /api/triggers/:id` 핸들러 확장과 `eia-trigger-edit-ui.md` 동일 endpoint 병행 수정 위험 | plan B §1 Backend | `plan/in-progress/eia-trigger-edit-ui.md §1` | side-effect 메모에 직렬화 순서 명시 |
| W-10 | Plan Coherence | `eia-secret-rotation-revoke-api.md` 미결 결정 선행 확정 | Change 4 / Rationale R-2 | `plan/in-progress/eia-secret-rotation-revoke-api.md` | R-2 에 TBD 문구 추가 |
| W-11 | Plan Coherence | plan A 드로어 오픈 경로가 `eia-trigger-edit-ui.md` 동일 드로어 파일 병행 수정 위험 | plan A §2 Frontend | `eia-trigger-edit-ui.md` | side-effect 메모 명시 |
| W-12 | Naming Collision | `triggers.deleted` / `triggers.deleteFailed` — 기존 키 중복 열거 | plan A §3 i18n | `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts:24-25` | "기존 키 재사용"으로 표시 |
| W-13 | Naming Collision | `triggers.delete.confirm.*` 신규 계층과 기존 `triggers.deleteConfirm` flat 키 충돌 | plan A §3 i18n | 동상 | 기존 키 deprecate·마이그레이션 또는 rename |
| W-14 | Naming Collision | `WebhookConfigCard` "신규 컴포넌트" 표현 — 기존 함수 존재 | plan B §2 Frontend | `trigger-detail-drawer.tsx:253` | "기존 컴포넌트 확장"으로 명시 |

## INFO (16건)

전체 목록은 5개 checker 결과 (`<checker>.md`) 참조. 주요 항목:

- I-1: `TRIGGER_ENDPOINT_PATH_CONFLICT` 와 `RESOURCE_CONFLICT` 관계 명시
- I-2/I-3: `trigger.delete` permission RBAC 매트릭스 cross-link
- I-7: data-model §2.8 의 `ON DELETE SET NULL` 명시 후속 정비
- I-12: `spec-overview-followups-2026-05-18.md` `plan/complete/` 이동 (별도 chore)
- I-13: rotate endpoint 경로명 두 문서 불일치 (`/auth/` vs `/notification/`) — 분기 대상 secret 이 다름을 명시

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | 에러 코드 명명 2건, 이름 confirm 패턴 참조 오류, schedule 삭제 data-flow 미반영 |
| Rationale Continuity | MEDIUM | isActive 이중 편집 경로, `/auth/` 채널 명칭 근거 부재 |
| Convention Compliance | LOW | 신규 에러 코드 등재 체크리스트, v1.1 미확정 API 행, plan frontmatter placeholder |
| Plan Coherence | MEDIUM | plan A/B 와 eia-trigger-edit-ui 직렬화 순서, eia-secret-rotation-revoke-api 미결 결정 선행 확정 |
| Naming Collision | MEDIUM | i18n 중복 키, deleteConfirm vs delete.confirm.* 계층, WebhookConfigCard 신규 오표기 |

## 권장 조치 (반영 우선순위)

1. **W-1** `VALIDATION_FAILED` → `VALIDATION_ERROR`
2. **W-2** `TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND`
3. **W-12, W-13** i18n 중복·계층 충돌 정리
4. **W-9, W-11** plan A/B 직렬화 의존성 명시
5. **W-10** R-2 에 TBD 문구
6. **W-6** `/auth/rotate-secret` 경로명 TBD 표기
7. **W-5** `/toggle` vs PATCH body Rationale R-4
8. **W-4** §4.2 `_layout.md` 참조 수정
9. **W-3** data-flow §1.4 cross-link
10. **W-7** 신규 에러 코드 등재 체크리스트
11. **W-14** `WebhookConfigCard` "기존 컴포넌트 확장"

## 처리 메타

- skip 된 checker 없음 (5/5 모두 실행)
- 모두 STATUS=success
- 재시도/wake 사이클 없음
