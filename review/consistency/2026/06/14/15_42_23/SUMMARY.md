# Consistency Check 통합 보고서

**BLOCK: YES** — Convention Compliance 에서 Critical 2건 발견

## 전체 위험도
**HIGH** — `error.details` 구조 및 `VALIDATION_FAILED` 에러 코드가 정식 규약(`api-convention §5.3`)과 충돌. Cross-Spec checker 는 fatal 상태로 결과 없음(재시도 필요).

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `error.details` 가 규약 배열(`Array<{field,message,code}>`) 대신 `{ fieldErrors: [...] }` 객체 형태 사용 | §5.1 에러 응답 JSON 예시 | `api-convention §5.3` (details = 배열) | (A) §5.1 예시를 배열로 수정 또는 (B) api-convention §5.3 에 도메인 structured details 허용 + shape 등록 |
| 2 | Convention Compliance | `VALIDATION_FAILED` 가 규약 기본값 `VALIDATION_ERROR` 와 다르고 채택 근거 부재 | §5.1 에러 표 400행 + 예시 | `api-convention §5.3` (400 기본=`VALIDATION_ERROR`); `error-codes.md §2` | `VALIDATION_ERROR` 통일 또는 유지 시 Rationale + `error-codes.md §3` 등록 |

## 경고 (WARNING)

| # | Checker | 위배 | 제안 |
|---|---------|------|------|
| 1 | Convention | §5.2 인라인 목록에 `execution.node.cancelled` 누락(§11 엔 존재) | §5.2 목록 추가 |
| 2 | Convention | `TOO_MANY_CONNECTIONS` error-codes.md §3 미등록 | 등록 또는 RATE_LIMITED 통일 |
| 3 | Plan | `spec-fix-eia-token-error-codes.md` 체크박스 전원 미완 — 결정은 이미 적용됨 | [x] 갱신 후 complete 이동 |
| 4 | Plan | D3=A(outbox) "후속 구현 plan 신설" 미이행 — 단, 본 PR 이 reconciler 직접 구현 | 본 PR 가 구현 포함이므로 plan 에 반영 |
| 5 | Naming | `TOKEN_EXPIRED`/`TOKEN_INVALID` 워크스페이스 JWT 계층과 코드 재사용 — 경계 문서화 | 3-error-handling §1.4 주석 |
| 6 | Naming | `VALIDATION_FAILED` vs `VALIDATION_ERROR` 유사명 혼용 | error-codes 명시 |
| 7 | Naming | `EXECUTION_NOT_FOUND` 의미 범위 미세 차이 | §5.1 주석 |

## 참고 (INFO)
- I1~I4 Rationale Continuity: R14/R15 번복은 정당화됨. no-content→ack body 전환 Rationale 항 누락(선택).
- I5 응답 DTO 경로 swagger §5-1 패턴 미반영(선택). I6 spec-sync gaps 등재. I7~I10 naming 충돌 없음.

## Checker별 위험도
| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | **재시도 필요 (fatal)** | — |
| Rationale Continuity | LOW | R14·R15 정당화됨 |
| Convention Compliance | **HIGH** | Critical 2 (details shape, VALIDATION_FAILED) |
| Plan Coherence | LOW | plan 체크박스·후속 plan(WARNING) |
| Naming Collision | LOW | 런타임 충돌 없음 |

## 권장 조치사항
1. (BLOCK Critical 1) §5.1 `error.details` 를 배열로 수정 또는 api-convention 확장 등록.
2. (BLOCK Critical 2) `VALIDATION_FAILED` 통일/유지+Rationale+error-codes 등록.
3. (Cross-Spec 재시도) fatal checker 재실행.
4. plan 체크박스 갱신; reconciler 구현 반영.
5. `TOO_MANY_CONNECTIONS` error-codes 등록; §5.2 node.cancelled(이미 반영됨 확인).
6. 네임스페이스 명확화 주석.

---

## main Claude 후속 처리 (resolution, 2026-06-14)

> cross_spec=fatal 재시도 + Critical 2건 코드 ground-truth 기반 해소. 상세는 후속 커밋 메시지·RESOLUTION 참조.
