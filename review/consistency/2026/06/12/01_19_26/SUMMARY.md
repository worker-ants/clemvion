# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 5건, INFO 8건.

## 전체 위험도
**MEDIUM** — `spec/5-system/3-error-handling.md` 및 `spec/2-navigation/4-integration.md` 의 `DB_HOST_BLOCKED` 미등재 비대칭, 동시 OPEN PR (#550, #551) merge 순서 경합이 핵심 위험.

## Critical 위배 (BLOCK 사유)

_해당 없음._

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `spec/5-system/3-error-handling.md` §1.4·§3.2 Database 행에 `DB_HOST_BLOCKED` 미등재 — `HTTP_BLOCKED` / `EMAIL_HOST_BLOCKED` 는 등재돼 있어 비대칭 | `spec/4-nodes/4-integration/2-database-query.md §4, §6.2` | `spec/5-system/3-error-handling.md` §1.4·§3.2 Database 행 | §1.4·§3.2 Database 행에 `DB_HOST_BLOCKED` (SSRF 가드 차단, `ALLOW_PRIVATE_HOST_TARGETS` opt-out) 추가 |
| W2 | Naming Collision | `spec/2-navigation/4-integration.md` SSRF 에러 코드 표에 `DB_HOST_BLOCKED` 미등재 — `EMAIL_HOST_BLOCKED` 대응 항목 부재 | `spec/4-nodes/4-integration/2-database-query.md §4, §6.2` | `spec/2-navigation/4-integration.md` line 1079 근방 | 해당 표에 `DB_HOST_BLOCKED` 행 추가 (현 PR 내 또는 follow-up plan 으로 추적) |
| W3 | Convention Compliance | `2-database-query.md` §5 에 dry-run 케이스 출력 구조(JSON 예시 + 필드 표) 미문서화 — `node-output.md` Principle 11 위반 | `spec/4-nodes/4-integration/2-database-query.md §4 callout, §5` | `spec/conventions/node-output.md` Principle 11 | §5 에 `§5.5 Case: Re-run dry-run` 절 추가, `buildDryRunMock` 반환 shape 문서화 |
| W4 | Convention Compliance | `1-http-request.md §5.3.2` transport 실패 시 `output.response.error` legacy 잔재 — 폐기 일정 미명시 | `spec/4-nodes/4-integration/1-http-request.md §5.3.2, §6` | `spec/conventions/node-output.md` Principle 8.2 | §5.3.2·§6 에 "Planned: 향후 제거 — `output.error.message` 로 대체" 명시 추가 및 plan 항목 생성 |
| W5 | Plan Coherence | PR #551 (`spec-errcode-catalog-a09758`) 과 본 branch 가 `spec/5-system/3-error-handling.md` 동일 Database 행을 동일 내용으로 수정 — merge 순서에 따라 중복 적용·충돌 위험 | `spec/5-system/3-error-handling.md` §1.4·§3.2 Database 행 | PR #551 `claude/spec-errcode-catalog-a09758` (OPEN) | merge 순서 조율: PR #551 먼저 머지 시 본 branch rebase 후 해당 hunk 제거 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `spec/conventions/chat-channel-adapter.md §3.1` 의 `DB_*` wildcard 가 `DB_HOST_BLOCKED` 를 암묵적으로 포함하나 명시적 예거 없음 | `spec/conventions/chat-channel-adapter.md §3.1` | `DB_*` 행 주석에 `DB_HOST_BLOCKED(SSRF)` 명시적 예거 권장 (기능적 충돌 없음) |
| I2 | Cross-Spec | `spec/5-system/3-error-handling.md §3.2` 대표 에러 코드 표 Database 행에도 `DB_HOST_BLOCKED` 미등재 (W1 과 동일 파일, W1 해소 시 동반 처리) | `spec/5-system/3-error-handling.md §3.2` | W1 §1.4 갱신 시 §3.2 도 동기화 |
| I3 | Cross-Spec | `plan/in-progress/http-ssrf-all-auth-followups.md` 의 `DB_HOST_BLOCKED` 신설 체크박스가 미완료(`[ ]`) 상태 | `plan/in-progress/http-ssrf-all-auth-followups.md` | `[x]` 로 체크 |
| I4 | Rationale Continuity | `DB_HOST_BLOCKED` 도입은 기존 SSRF Rationale 과 완전 정합 — 수정 불필요 | `spec/4-nodes/4-integration/2-database-query.md §4` | `1-http-request.md §8.2 Rationale` 교차 참조 링크 추가 권장 (추적성 향상) |
| I5 | Naming Collision | `INVALID_PARAMETERS` 기존 사용처와 의미·형식 완전 일치 — 충돌 없음 | `spec/4-nodes/4-integration/2-database-query.md §5.8, §6.2` | 없음 |
| I6 | Naming Collision | Redis 채널 `integration:cache:invalidate` 기존 정의와 완전 일치 — 충돌 없음 | `spec/4-nodes/4-integration/2-database-query.md §4, Rationale` | 없음 |
| I7 | Convention Compliance | `0-common.md §7` 색인 표의 send_email 포트명 `success` 기재 vs 실제 `out` 불일치 | `spec/4-nodes/4-integration/0-common.md §7`, `3-send-email.md §3.2, §5.1` | 색인 표를 `out` 으로 수정하거나 포트명 `success` 통일(Breaking Change) |
| I8 | Convention Compliance | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `order` wrapper 행 설명 오기입 ("정렬 순서 asc·desc") | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` | `(응답 객체)` 로 수정 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `spec/5-system/3-error-handling.md` §1.4·§3.2 에 `DB_HOST_BLOCKED` 미등재로 HTTP/Email 과 비대칭 (W1) |
| Rationale Continuity | NONE | 기존 SSRF/pub-sub/none-auth/durationMs/D4 결정 모두 준수, 기각 대안 재도입 없음 |
| Convention Compliance | LOW | dry-run 출력 구조 미문서화(W3), transport 실패 legacy 잔재 폐기 일정 미명시(W4) |
| Plan Coherence | MEDIUM | PR #550·#551 동일 파일 경합, 특히 #551 과 동일 hunk 중복 수정 위험(W5) |
| Naming Collision | LOW | `spec/2-navigation/4-integration.md` SSRF 표 미등재(W2), 나머지 충돌 없음 |

## 권장 조치사항

1. **(W1·I2 해소 — 즉시)** `spec/5-system/3-error-handling.md` §1.4 Database 행과 §3.2 대표 에러 코드 표 Database 행에 `DB_HOST_BLOCKED` 추가. 작업 범위 소형.
2. **(W5 해소 — merge 전)** PR #551 (`spec-errcode-catalog-a09758`) 과 merge 순서 조율. PR #551 이 먼저 머지될 경우 본 branch 에서 `3-error-handling.md` Database 행 hunk 를 rebase 시 제거.
3. **(W2 해소)** `spec/2-navigation/4-integration.md` SSRF 에러 코드 표에 `DB_HOST_BLOCKED` 행 추가 (현 PR 포함 또는 `http-ssrf-all-auth-followups.md` 후속 항목 추적).
4. **(W3 해소)** `spec/4-nodes/4-integration/2-database-query.md §5` 에 dry-run 케이스(`§5.5`) 절 추가.
5. **(W4 해소)** `1-http-request.md §5.3.2·§6` 에 `output.response.error` legacy 잔재 폐기 일정 명시.
6. **(I3)** `plan/in-progress/http-ssrf-all-auth-followups.md` 의 `DB_HOST_BLOCKED` 체크박스 `[x]` 처리.
7. **(I7·I8 — 소형 수정)** send_email 색인 포트명 수정, cafe24 catalog `order` 행 설명 수정.