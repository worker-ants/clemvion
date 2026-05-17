# Consistency Check 통합 보고서 (r1)

**BLOCK: YES** — CRITICAL 발견 2건 (naming_collision). `DELETE` HTTP 동사를 soft delete semantics 로 사용하는 endpoint 설계가 코드베이스 기존 관례 및 미결 W-48 API 패턴 이슈와 충돌한다. spec 반영 전 endpoint 동사 정책 확정 필요.

> 후속 처리: r2 (`../16_07_00/SUMMARY.md`) 에서 `POST /:id/dismiss` + `POST /dismiss-all` 패턴으로 변경 후 재검토. BLOCK 해소.

---

## 전체 위험도

**HIGH** — CRITICAL 2건(DELETE 동사·soft delete 의미 충돌), WARNING 9건(endpoint 정정 단일진실, partial index 분리, worktree 동시수정 경합 3건, active 레이블, Cafe24 명칭 혼동, migration placeholder), INFO 5건

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C-1 | naming_collision | `DELETE /notifications/:id` 를 soft delete (dismissed_at 갱신) 로 정의 — 코드베이스 전반에서 `DELETE` 는 hard delete 를 의미하는 기존 관례와 충돌. W-48(알림 API 동사 일관성 미결) 맥락에서 dismiss endpoint 만 독립 확정하면 알림 API 전체 동사 정책이 불일치 상태로 고착된다. | 변경안 #1 §4.2 Endpoint 표, §1-C 상태 전이 다이어그램 | 코드베이스 전반 `DELETE` hard delete 관례; `plan/in-progress/20260516-full-review/RESOLUTION.md` W-48 미결 | `PATCH /notifications/:id` + body `{ dismissed: true }` 로 read/dismiss 를 같은 PATCH 패턴으로 통일하거나, `POST /notifications/:id/dismiss` 명시적 액션 경로 사용. `DELETE` 동사 회피 필요. W-48 API 패턴 결정과 동시에 처리 권장. |
| C-2 | naming_collision | `DELETE /notifications` 를 일괄 dismiss 로 정의 — API 소비자가 "모든 알림 hard delete" 로 오해할 위험. `POST /notifications/mark-all-read` (일괄 읽음) 와 비대칭 동사 충돌. `DELETE` 메서드에 response body 를 포함하는 구조는 일부 HTTP 클라이언트·게이트웨이에서 미지원. | 변경안 #1 §4.2 Endpoint 표 "일괄 dismiss" | `POST /notifications/mark-all-read` (읽음 처리와 동사 비대칭); HTTP DELETE+body 호환성 문제 | `POST /notifications/dismiss-all` 로 통일하면 `mark-all-read` 와 대칭. 또는 `PATCH /notifications` + body `{ dismissed: true }`. 어느 방안이든 `DELETE` 동사 회피 및 W-48 결정과 연동. |

> 중복 통합: cross_spec(WARNING), rationale_continuity(INFO), convention_compliance(INFO) 도 동일한 DELETE 동사 문제를 지적했으나, naming_collision 의 CRITICAL 판정(코드베이스 관례 위반)으로 통합.

---

## 경고 (WARNING) — 요약

| # | Checker | 핵심 |
|---|---------|------|
| W-1 | cross_spec + naming_collision | `PATCH /notifications/read-all` → `POST /notifications/mark-all-read` 정정이 spec 본문 inline 주석으로만 — Rationale 로 이동 |
| W-2 | cross_spec + plan_coherence | partial index 전환을 단일 migration 으로 묶으면 `CREATE INDEX CONCURRENTLY` 트랜잭션 블록 불가 — 2단계 migration 분리 |
| W-3 | plan_coherence | W-48 미결 항목과 dismiss endpoint 동사 결정이 직접 접점 |
| W-4 | plan_coherence | spec-overview-ui-patterns-followup (worktree TBD) 가 `_layout.md` 동시 수정 가능성 |
| W-5 | plan_coherence | prod-rereview-fix-a7c93f 가 §11 재구성 — 머지 완료 여부 확인 필요 |
| W-6 | naming_collision | "active" 레이블이 `is_active` 와 충돌 — `visible`/`undismissed` 로 |
| W-7 | naming_collision | Cafe24 외부 `notification` 과 내부 entity 명명 공간 혼재 (future concern) |
| W-8 | convention_compliance + plan_coherence | migration 번호 `V0NN` placeholder — 착수 직전 재확인 명시 |
| W-9 | convention_compliance | spec 본문에 endpoint 오류 정정 경위 주석 포함 (CLAUDE.md latest-state 원칙) |

상세는 본 세션의 checker별 파일 참조.

---

## 참고 (INFO) — 요약

I-1 ~ I-5: PATCH→POST 정정 이력 Rationale 기재, DELETE 동사 응답 코드 차이 근거, `unread-count` dismissed 제외 명시, WebSocket follow-up 메모, §4 → §5 앵커 이동 영향.

---

## 권장 조치사항 (r1 결정)

1. **[BLOCK 해소 필수] DELETE 동사 정책 확정** → POST 액션 endpoint 채택 (mark-all-read 와 대칭).
2. **[BLOCK 해소 필수] W-48 합의** → POST 액션은 W-48 의 PATCH 결정과 직교하므로 별도 합의 불필요.
3. **[착수 전 확인] Worktree 머지 상태 직렬화 검증** → full-review-fixes 는 Integration 엔티티만, cafe24-token-expiry 는 §10.2/Rationale 만 건드려 hunk 겹침 없음 확인.
4. **[스펙 반영 시] Migration 분리** → 컬럼 추가 + partial index 전환 2 파일로.
5. **[텍스트 정리] spec 본문 이력 주석 제거** → Rationale 로 이동.
6. **[레이블 변경] `active` → `visible`/`undismissed`** → `visible` 채택.
7. **[Plan 갱신] Migration 번호 재확인 절차 명시** → plan checklist 에 추가.
8. **[선택적] unread-count 정의 동기화** → `_layout.md §3.1` 벨 배지 설명에 "dismissed 제외" 명시.

→ r2 draft 작성 후 재호출.
