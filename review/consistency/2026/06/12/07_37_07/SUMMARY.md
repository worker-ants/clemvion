# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

---

## 전체 위험도

**LOW** — 모든 발견사항이 WARNING 이하. 기능적·계약적 모순 없음. 문서 동기화 및 규약 갱신 권장 사항 다수.

---

## Critical 위배 (BLOCK 사유)

_없음_

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `DB_HOST_BLOCKED` 신설 결정에 `## Rationale` 항목 부재 — 인접 결정(HTTP_BLOCKED §8.2, EMAIL_HOST_BLOCKED §8.0)은 모두 Rationale 에 근거를 남긴 패턴과 불일치 | `spec/4-nodes/4-integration/2-database-query.md` §4·§5.3·§6.2 | `1-http-request.md §8.2` / `3-send-email.md §8.0` Rationale 패턴 | `2-database-query.md ## Rationale` 에 (a) 구 코드가 `INTEGRATION_CALL_FAILED` fallback 이었던 이유, (b) 전용 코드 신설 근거(HTTP·Email 대칭 달성), (c) 메시지 일반화(host/IP 미포함) 정책의 이유(정찰면 축소)를 추가 |
| 2 | Convention Compliance | `1-http-request.md §5.3.2` transport 실패 시 `output.response` legacy 잔재 — 규약 위반임을 spec 자체가 인지하면서도 제거 계획 없이 유지 | `spec/4-nodes/4-integration/1-http-request.md` §5.3.2 | `spec/conventions/node-output.md` Principle 1 (비즈니스 결과물만), Principle 8.1 (불필요한 중첩 제거) | spec 에 `output.response` 제거 예정임을 명기(`Planned: 제거`)하거나, Rationale §8.x 에 legacy 유지 이유 및 향후 제거 계획을 기술 |
| 3 | Convention Compliance | `3-send-email.md §5.1` `meta.deliveryStatus` 가 `node-output.md` Principle 2 열거 목록에 없는 비표준 필드 | `spec/4-nodes/4-integration/3-send-email.md` §5.1·§5.3·§5.5 | `spec/conventions/node-output.md` Principle 2 (meta 는 실행 메트릭만, Email 행 미등재) | (A) `meta.deliveryStatus` → `output.deliveryStatus` 로 이동(Principle 1 비즈니스 결과물 위치), 또는 (B) `node-output.md` Principle 2 에 이메일 행(`meta.durationMs, meta.deliveryStatus`) 추가 + 메트릭 정당화 근거 기록 |
| 4 | Plan Coherence | `spec-errcode-catalog-a09758` (PR #551 OPEN) 과 `spec/5-system/3-error-handling.md` 동시 편집 — 직렬화 없이 머지 시 git merge conflict 발생 위험 | `spec/5-system/3-error-handling.md` §1.4 Database 행 | 활성 브랜치 `claude/spec-errcode-catalog-a09758` PR #551 (HTTP 행 + Code 노드 섹션 수정) | PR #551 머지 후 origin/main pull → `3-error-handling.md` 충돌 해소 후 이 브랜치 진행. 또는 `/merge-coordinate` 로 직렬화 순서 명시 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `node-output.md` D4 주석이 `HTTP_BLOCKED` 단독 예시 — `DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED` 미열거 | `spec/conventions/node-output.md` line 110 | D4 주석에서 `HTTP_BLOCKED` → `HTTP_BLOCKED / DB_HOST_BLOCKED / EMAIL_HOST_BLOCKED` 로 확장 또는 "각 Integration 노드의 SSRF 전용 코드"로 추상화 |
| 2 | Cross-Spec | `spec/5-system/3-error-handling.md` main 브랜치 DB 에러 표에 `DB_HOST_BLOCKED` 미기재 (워크트리는 이미 반영) | `spec/5-system/3-error-handling.md` §1·§2 (main 브랜치) | PR 에 해당 파일 변경이 포함됐는지 확인. 포함됐으면 무시 가능 |
| 3 | Cross-Spec | `node-output.md` D4 주석 참조 링크가 `1-http-request.md §5.8` 만 가리킴 | `spec/conventions/node-output.md` line 110 | 참조 링크를 세 노드 §5.8 로 확장 또는 "Integration 노드별 §5.8" 로 추상화 |
| 4 | Rationale Continuity | `spec/2-navigation/4-integration.md` 에러코드 표에 `HTTP_BLOCKED` 추가 — 기존 결정의 cross-spec 표 동기이므로 연속성 위반 아님 | `spec/2-navigation/4-integration.md` §4.7 | 특별 조치 불필요 |
| 5 | Rationale Continuity | `spec/5-system/3-error-handling.md` DB 에러코드 목록에 `DB_HOST_BLOCKED` 추가 — `EMAIL_HOST_BLOCKED` 패턴과 대칭, 색인 역할 | `spec/5-system/3-error-handling.md` §1.4·§3.2 | 특별 조치 불필요 |
| 6 | Convention Compliance | `2-database-query.md §5.1` `meta.rowCount` — conventions 표에는 `meta.rowCount` 열거, spec은 `output.rowCount` 만 두고 meta 복제 안 함으로 명시. 직접 충돌 미해소 | `spec/4-nodes/4-integration/2-database-query.md` §5.1 | `node-output.md` Principle 2 DB 행에서 `meta.rowCount` 제거 또는 "Database Query 는 `output.rowCount` 유지, meta 미중복" 주석 추가 |
| 7 | Convention Compliance | `3-send-email.md §5.4` `status: 'requires_integration'` 이 Principle 0 허용 status 열거에 미등재 | `spec/4-nodes/4-integration/3-send-email.md` §5.4 | `node-output.md` Principle 0 status enum 또는 예외 절에 `'requires_integration'` (DI 미주입 환경 전용 escape hatch) 명시 등재, prod 비노출 사실도 함께 기록 |
| 8 | Convention Compliance | SSRF 에러코드 삼분화(`HTTP_BLOCKED`·`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`) — 동일 조건에 노드별 별도 코드, 클라이언트 공통 처리 시 3종 열거 필요 | `1-http-request.md §6`, `2-database-query.md §6.2`, `3-send-email.md §5.3` | 의도적 삼분화라면 `error-codes.md §3` Historical-artifact 예외 레지스트리에 등재 + 정당화 근거 기록 |
| 9 | Convention Compliance | `0-common.md` 독립 `## Rationale` 섹션 없음 | `spec/4-nodes/4-integration/0-common.md` | 문서 말미에 `## Rationale` 섹션 추가 (D4 통합 에러 라우팅, `meta.durationMs` 통일, `clampMessage` 패턴 등 근거 이동) |
| 10 | Convention Compliance | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` `order` wrapper 설명 오기 — 정렬 파라미터 설명이 잘못 복사됨 | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` GET/POST 응답 표 최상위 `order` 행 | `order` 행 설명을 `(응답 객체)` 로 수정 |
| 11 | Plan Coherence | `http-ssrf-all-auth-followups.md` frontmatter `worktree: (unstarted)` 미갱신 | `plan/in-progress/http-ssrf-all-auth-followups.md` | frontmatter `worktree` 를 `db-host-blocked-7df9f7` 로 갱신 또는 plan/complete 이동 검토 |
| 12 | Plan Coherence | `spec-sync-integration-common-gaps.md` frontmatter `worktree: spec-sync-audit` stale (해당 worktree 미존재) | `plan/in-progress/spec-sync-integration-common-gaps.md` | frontmatter 정리 또는 plan/complete 이동 |
| 13 | Plan Coherence | `errcode-wiring-92dc2c` (PR #550 OPEN) 과 `http-ssrf-all-auth-followups.md` 동시 편집 — 논리적 충돌 낮으나 plan 파일 머지 충돌 가능성 | `plan/in-progress/http-ssrf-all-auth-followups.md` | 머지 순서 직렬화 또는 마지막 머지 시 plan 파일 충돌 수동 해소 |
| 14 | Naming Collision | **재시도 필요** — `naming_collision.md` output 파일 미생성. checker 결과 없음 | — | naming_collision checker 재실행 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `node-output.md` D4 주석이 HTTP_BLOCKED 단독 예시로 남아 있어 DB/Email SSRF 코드 미열거. 워크트리 내부 정합성은 유지됨 |
| Rationale Continuity | LOW | `DB_HOST_BLOCKED` 신설 결정이 `2-database-query.md ## Rationale` 에 미기록 (WARNING). 나머지 변경은 INFO |
| Convention Compliance | LOW | `meta.deliveryStatus` 비표준 필드, transport 실패 시 `output.response` legacy 잔재, `meta.rowCount` 충돌 미해소 (WARNING 2건 + INFO 다수) |
| Plan Coherence | LOW | `spec-errcode-catalog` PR #551 과 `3-error-handling.md` 파일 경합 — 직렬화 필요 (WARNING 1건) |
| Naming Collision | N/A | output 파일 미생성 — 재시도 필요 |

---

## 권장 조치사항

1. **(WARNING 해소 우선)** `spec/4-nodes/4-integration/2-database-query.md ## Rationale` 에 `DB_HOST_BLOCKED` 신설 근거 항목 추가 — 구 fallback 이유·신설 근거·메시지 일반화 정책 포함.
2. **(WARNING 해소 우선)** PR #551(`spec-errcode-catalog`) 머지 완료 후 origin/main 을 이 브랜치에 pull 하여 `3-error-handling.md` 충돌을 미리 해소하거나, `/merge-coordinate` 로 직렬화 순서를 확정.
3. **(WARNING)** `spec/conventions/node-output.md` Principle 2 에 이메일 행(`meta.durationMs, meta.deliveryStatus`) 추가 또는 `meta.deliveryStatus` → `output.deliveryStatus` 재배치.
4. **(WARNING)** `1-http-request.md §5.3.2` `output.response` legacy 잔재 처리 계획을 spec 에 명기(`Planned: 제거` 또는 Rationale 에 유지 근거 + 제거 계획 기술).
5. `spec/conventions/node-output.md` D4 주석을 `HTTP_BLOCKED / DB_HOST_BLOCKED / EMAIL_HOST_BLOCKED` 로 확장.
6. `node-output.md` Principle 2 DB 행에서 `meta.rowCount` 제거 또는 `2-database-query.md` 결정 반영 주석 추가.
7. `node-output.md` Principle 0 status enum 에 `'requires_integration'` (DI 미주입 환경 전용) 등재.
8. SSRF 에러코드 삼분화가 의도적이라면 `error-codes.md §3` Historical-artifact 예외 레지스트리에 등재.
9. `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` `order` wrapper 설명 오기 수정.
10. `plan/in-progress/http-ssrf-all-auth-followups.md` frontmatter `worktree` 갱신.
11. **naming_collision checker 재실행** — output 파일 미생성으로 결과 미확인.