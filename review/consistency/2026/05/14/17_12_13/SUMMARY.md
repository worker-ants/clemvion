# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 등급 발견 2건 (convention_compliance · cross_spec 공통). 해소 후 spec 적용 가능.

---

## 전체 위험도
**MEDIUM** — CRITICAL 이슈는 DRAFT 3B·3C의 동일 행 2줄 교정으로 완전히 해소되며, 그 외 WARNING/INFO 항목은 모두 spec 적용 전 또는 developer 인수 시 처리 가능한 범위다.

---

## Critical 위배 (BLOCK 사유)

5개 checker가 모두 같은 이슈를 발견. convention_compliance·cross_spec이 CRITICAL로 표기(가장 강한 등급 채택).

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | convention_compliance · cross_spec · rationale_continuity · plan_coherence · naming_collision | DRAFT 3B — `pending_install` `status_reason` 예시값이 `UPPER_SNAKE_CASE` (`OAUTH_TOKEN_EXCHANGE_FAILED` 등) | `spec/data-flow/integration.md §3.2` replace 패치 (DRAFT 3B) | DRAFT 1C (`spec/1-data-model.md §2.10`), DRAFT 2D·2G·2I — 모두 `snake_case` 명시 | DRAFT 3B의 해당 행을 `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `resource_not_found` (snake_case)로 교정 |
| 2 | convention_compliance · cross_spec · rationale_continuity | DRAFT 3C — sequence diagram DB UPDATE문에 `status_reason=OAUTH_TOKEN_EXCHANGE_FAILED` (UPPER_SNAKE_CASE) | `spec/data-flow/integration.md §1.2.1` mermaid diagram (DRAFT 3C) | DRAFT 1C snake_case 정책 + DRAFT 2G §10.4 `status_reason='oauth_token_exchange_failed'` (올바른 표기) | `status_reason=oauth_token_exchange_failed`로 교정 (1행) |

> **주의**: Critical #1·#2는 동일 원칙 위반의 두 위치다 — 둘 다 교정해야 BLOCK 해소.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | cross_spec | `integration_oauth_state` 스키마에 `integration_id` 컬럼 누락 | DRAFT 2G `§10.2` + DRAFT 3C INSERT문 | `spec/data-flow/integration.md §2.1` 테이블 스키마 (`integration_id` 없음) | 기존 DB/마이그레이션 확인 후 ① 이미 존재하면 §2.1 스키마 행 갱신을 DRAFT 3에 추가, ② 없으면 V042 범위에 포함 |
| 2 | cross_spec | CHANGELOG 중복 — 동일 날짜·섹션(§9.4·§9.8) 행이 기존에 이미 존재 | DRAFT 2J-2 (`4-cafe24.md §10` CHANGELOG 추가 행) | `4-cafe24.md §10` 기존 `2026-05-14` 행 | DRAFT 2J-2를 insert 대신 **replace** 방식으로 변경 (기존 `2026-05-14` 행을 새 내용으로 대체) |
| 3 | cross_spec · naming_collision | `CAFE24_INSTALL_INVALID_HMAC(403)` 의미 축소 — 기존 e2e 테스트가 "pending 미발견" 시 403을 기대할 수 있음 | DRAFT 2E (`§9.2`) + DRAFT 2J-2 (`§9.8`) | 기존 e2e/통합 테스트의 `CAFE24_INSTALL_INVALID_HMAC` 검증 로직 | spec 레벨 조치 불필요. developer 인수 시 plan에 `[ ] 기존 e2e — CAFE24_INSTALL_INVALID_HMAC(403) → CAFE24_INSTALL_INVALID_TOKEN(404) 전환 케이스 반영` 체크박스 명시 권장 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | DRAFT 2D mermaid — `statusReason` camelCase 표기 (DB 컬럼명 혼란 유발) | `spec/2-navigation/4-integration.md §6` 상태 전이 다이어그램 (102행) | `(statusReason='install_timeout')` → `(status_reason='install_timeout')` 로 통일 |
| 2 | plan_coherence | `cafe24-pending-polish.md` — 410 Gone 영구 폐기 시점 추적 체크박스 누락 | `plan/in-progress/cafe24-pending-polish.md` 변경 2 | spec 적용 후 `[ ] 410 Gone 경로 영구 폐기 시점 결정 (운영 데이터·외부 등록 URL 잔존 여부 확인 후)` 체크박스 추가 |
| 3 | plan_coherence | `node-output-redesign` plan이 `4-cafe24.md`를 진단 대상으로 포함 — 선행 변경 시 diff 달라질 수 있음 | `plan/in-progress/node-output-redesign/README.md` | 현재 조치 불필요. node-output-redesign이 spec 반영 단계 진입 시 cafe24.md 선행 변경 확인하도록 해당 plan에 메모 |
| 4 | cross_spec | `pending_install → (삭제)` → `→ expired` 번복 — §6 다이어그램 replace 적용 시 기존 화살표 실제 제거 여부 확인 필요 | DRAFT 2D §6 다이어그램 replace | 적용 후 diff에서 `→ (삭제)` 전이 라인이 실제로 사라지는지 검증 |
| 5 | cross_spec | `expired(status_reason='install_timeout')` 행에서 reauthorize 비활성 — §2.2 더보기(⋮) 표에 예외 미반영 | DRAFT 2A (`§2.2`), DRAFT 2D-pre §6 note | `§2.2` 더보기(⋮) 표에 `expired (status_reason='install_timeout')` 예외 행 추가 또는 인라인 명시 권장 |
| 6 | cross_spec | `4-cafe24.md:337` 줄 번호 고정 — 선행 DRAFT가 §9.4/9.8 수정 시 번호 이동 가능 | DRAFT 2H (`§337` 교정 지시) | 줄 번호 대신 검색 패턴("Resource 단위 grouping 으로 사용성 보강")으로 대상 식별해 적용 |
| 7 | naming_collision | 큐 메시지 `reason` 필드 신규 값 (`pending_install_timeout`) — 기존 §1.4 스캐너 큐 스키마 확인 불가 | DRAFT 3C-bis `{ integrationId, reason: 'token_expiring' \| 'pending_install_timeout' }` | `spec/data-flow/integration.md §1.4` 원문 또는 `backend/` 구현에서 기존 큐 메시지 스키마 확인 후 backward-compatible 여부 결정 |
| 8 | rationale_continuity | `last_error` 암호화 — callback 실패 기록 시 기존 transformer 자동 적용 여부 명시 없음 | DRAFT 3C·2D §6 전이 표 | 구현 시 주의 필요. spec 위반은 아님 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **MEDIUM** | CRITICAL: status_reason case 불일치 (DRAFT 3B/3C) / WARNING: integration_oauth_state.integration_id 누락, CHANGELOG 중복, HMAC 에러 코드 의미 변경 |
| Rationale Continuity | **LOW** | WARNING: DRAFT 3B/3C DB 저장값 UPPER_SNAKE_CASE — DRAFT 1C snake_case 정책 위반 (2건) |
| Convention Compliance | **MEDIUM** | CRITICAL: DRAFT 3B status_reason UPPER_SNAKE_CASE, DRAFT 3C sequence diagram UPPER_SNAKE_CASE |
| Plan Coherence | **LOW** | WARNING: DRAFT 3B case 컨벤션이 DRAFT 1C·2D와 모순 / INFO: 410 Gone 후속 체크박스 누락 |
| Naming Collision | **LOW** | WARNING: DRAFT 1C vs DRAFT 3B status_reason 표기 불일치 |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `plan/in-progress/spec-draft-cafe24-pending-polish.md` DRAFT 3B — `pending_install` status_reason 예시 4개를 `snake_case`로 교정
   ```diff
   - (예: `OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `RESOURCE_NOT_FOUND`)
   + (예: `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `resource_not_found`)
   ```

2. **(BLOCK 해소 필수)** DRAFT 3C — sequence diagram DB UPDATE 라인 교정
   ```diff
   - Svc->>PG: UPDATE integration SET status_reason=OAUTH_TOKEN_EXCHANGE_FAILED, ...
   + Svc->>PG: UPDATE integration SET status_reason=oauth_token_exchange_failed, ...
   ```

3. **(spec 적용 전 권장)** DRAFT 2J-2 — CHANGELOG 기존 `2026-05-14` 행을 insert 대신 **replace**로 변경

4. **(spec 적용 전 권장)** `integration_oauth_state.integration_id` — 기존 마이그레이션 또는 `backend/` 구현 확인 후 DRAFT 3에 §2.1 스키마 갱신 또는 V042 범위 추가 여부 결정

5. **(INFO — spec 적용 후)** `cafe24-pending-polish.md`에 410 Gone 영구 폐기 시점 추적 체크박스 추가

6. **(INFO — developer 인수 시)** plan에 `CAFE24_INSTALL_INVALID_HMAC → CAFE24_INSTALL_INVALID_TOKEN` e2e 테스트 전환 체크박스 명시