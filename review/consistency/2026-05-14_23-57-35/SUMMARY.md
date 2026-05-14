# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 단, MEDIUM 위험도의 WARNING 7건 해소 후 착수 권장.

## 전체 위험도
**MEDIUM** — 큐 이름 오류는 즉각적 기능 단절 가능, 알고리즘 불일치는 기존 코드와 다른 시스템 생성 위험, schema 누락은 재시도 시 중복 알림 버그 가능성 내포.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | cross_spec + naming_collision (통합) | BullMQ 큐 이름 불일치 — spec `integration-expiry`, 코드 `integration-expiry-scanner` | `spec/data-flow/integration.md §1.4` 제목, `§2.2 Redis` 테이블, `data-flow/0-overview.md §1.2` 큐 목록 | `integration-expiry-scanner.service.ts:16` `INTEGRATION_EXPIRY_QUEUE = 'integration-expiry-scanner'` | (권장) spec 3곳의 `integration-expiry` → `integration-expiry-scanner` 정정. 코드 변경 없음. |
| 2 | cross_spec | `connected-expiry` job 알고리즘 불일치 — spec은 "refresh 시도 후 실패 시 expired 전이"를 기술, 코드는 threshold(7d/3d/0d) 알림 + 0d 자동 만료로 구현 | `spec/data-flow/integration.md §1.4` mermaid; `spec/2-navigation/4-integration.md §6` | `integration-expiry-scanner.service.ts run()` — OAuth refresh 호출 없음, threshold 분류 + `IntegrationExpiryDispatch` 알림 발송 | 코드가 정답이라면: `§1.4` mermaid를 threshold+알림+0d만료 흐름으로 재작성; `4-integration.md §6` `connected→expired` 설명에서 "(refresh fail)" 제거. |
| 3 | cross_spec | `integration_expiry_dispatch` 테이블 미문서화 — 중복 알림 방지 핵심 테이블이 spec 양쪽 모두 누락 | `spec/data-flow/integration.md §2.1` Postgres 테이블 목록 | `integration-expiry-dispatch.entity.ts` — UNIQUE `(integration_id, threshold, token_expires_at)` 제약으로 중복 알림 원자적 방지 | `spec/data-flow/integration.md §2.1`에 `integration_expiry_dispatch` 테이블 + UNIQUE 제약 추가; `spec/1-data-model.md`에도 엔티티 정의 추가. |
| 4 | cross_spec | `statusReason` 값 불일치 — spec 2곳은 `token_expired` 기록을 명시, 코드는 `null` 설정 | `spec/data-flow/integration.md §3.2`, `§1.4` mermaid; `spec/1-data-model.md §2.10` | `integration-expiry-scanner.service.ts run()` 224~227행: `statusReason = null` | 코드가 정답이라면: spec §3.2와 §1.4 mermaid의 스캐너 경로 `status_reason='token_expired'` → `null`로 수정. `token_expired`가 의도라면: `run()` 0d 분기에 `statusReason = 'token_expired'` 추가. |
| 5 | plan_coherence | `cafe24-pending-polish.md` 변경 4 payload 설계(`{ integrationId, reason }`)가 현 spec의 3-job 분리 설계와 충돌하는 미체크 상태 | `cafe24-pending-polish.md` 변경 4 (`[ ]` 미체크) | `spec/data-flow/integration.md §2.2` — payload `{ triggeredAt: ISO }`, 3개 독립 job | 변경 4 해당 항목에 ~~취소선~~ + "3-job 분리로 대체됨(cafe24-followup-bullmq-split-198c0a)" 메모 추가. |
| 6 | plan_coherence | `cafe24-pending-polish-followup.md` 그룹 D — spec 명문화는 완료됐으나 plan 체크박스가 `[ ]` 그대로 | `cafe24-pending-polish-followup.md` 그룹 D `[ ]` | `spec/data-flow/integration.md §1.4` 격리 정책 — 이미 반영됨 | `[x] spec 명문화 완료 (data-flow §1.4). Sentry/Datadog 연동은 별도 결정 필요`로 분리 갱신. |
| 7 | plan_coherence | `cafe24-pending-polish-followup.md` frontmatter `worktree: (none)` — 현 worktree 미기록으로 plan_coherence 추적 불가 | `cafe24-pending-polish-followup.md` 상단 frontmatter | CLAUDE.md plan frontmatter 규약 — `worktree` 필드 필수 | `worktree: cafe24-followup-bullmq-split-198c0a`로 갱신. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `install_token` 평문 저장 사실이 §2.1에 미표기 — 독자가 암호화 여부를 오독할 여지 | `spec/data-flow/integration.md §2.1` | `install_token (평문, V042)` 등으로 명시 보완 (필수 아닌 가독성 개선). |
| 2 | convention_compliance | 파일명 숫자 prefix 없음 (`integration.md`) | `spec/data-flow/integration.md` 파일 경로 | `data-flow/` 내 파일이 2개 이상이라면 `1-integration.md` rename 권장. 현재 단독 파일이면 현행 유지 가능. |
| 3 | cross_spec | `connected-expiry` 조회 조건 — spec `status='connected'`, 코드 `NOT IN ('expired', 'error')` (pending_install 포함) | `spec/data-flow/integration.md §1.4` | 실질 영향 낮음. spec을 코드 기준 `status NOT IN ('expired', 'error')`로 수정하거나, 코드에 `status='connected'` 필터 추가. |
| 4 | plan_coherence | 그룹 B `installTokenIssuedAt` vs `created_at` TTL 기준 결정 미결 — 현 worktree 범위 외 | `cafe24-pending-polish-followup.md` 그룹 B | 그룹 B 진입 시 `spec/data-flow/integration.md §1.4` pending-install-ttl 조건 재검토 필요. 현재 차단 사유 없음. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **MEDIUM** | 큐 이름 불일치(즉각 단절 위험), 알고리즘 불일치(refresh vs threshold), IntegrationExpiryDispatch 누락, statusReason 불일치 |
| Rationale Continuity | **LOW** | install_token 암호화 여부 오독 가능성 (가독성 보완) |
| Convention Compliance | **NONE** | 파일명 숫자 prefix 부재 (구현 차단 사유 없음) |
| Plan Coherence | **MEDIUM** | plan 3건 추적 단절 — 변경 4 충돌 미체크, 그룹 D 미반영, frontmatter worktree 미기록 |
| Naming Collision | **LOW** | 큐 이름 spec-코드 불일치 (cross_spec W-1과 동일, 통합 처리) |

---

## 권장 조치사항

1. **[즉시, 착수 전]** **W-2 알고리즘 의도 확정** — refresh 로직 도입 여부를 사용자와 결정한 뒤 spec(§1.4 mermaid, `4-integration.md §6`) 또는 코드를 정렬. 이 결정이 W-4(statusReason)에도 영향을 줌.
2. **[즉시]** **W-1 큐 이름 정정** — `spec/data-flow/integration.md §1.4` 제목·§2.2 Redis 표, `data-flow/0-overview.md §1.2` 큐 목록의 `integration-expiry` → `integration-expiry-scanner`. 코드 변경 없음.
3. **[즉시]** **W-3 schema 추가** — `spec/data-flow/integration.md §2.1`과 `spec/1-data-model.md`에 `integration_expiry_dispatch` 테이블 + UNIQUE 제약 기술.
4. **[즉시]** **W-4 statusReason 정렬** — W-2 결정 이후 `spec §3.2` 또는 코드 0d 분기를 일치시킴.
5. **[착수 전, plan 정리]** **W-7** `cafe24-pending-polish-followup.md` frontmatter → `worktree: cafe24-followup-bullmq-split-198c0a` 갱신.
6. **[착수 전, plan 정리]** **W-5** `cafe24-pending-polish.md` 변경 4에 취소선 + 대체 메모 추가.
7. **[착수 전, plan 정리]** **W-6** `cafe24-pending-polish-followup.md` 그룹 D 체크박스 분리 갱신.
8. **[선택, 낮은 우선순위]** I-1~I-3 가독성 보완 및 조회 조건 정렬 (구현 완료 후 처리 가능).