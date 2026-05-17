# Consistency Check 통합 보고서 (r2)

**BLOCK: NO** — Critical 발견 없음. 모든 위배가 WARNING 또는 INFO 등급.

> r1 (`../15_53_16/SUMMARY.md`) 의 BLOCK 사유 (DELETE 동사) 가 `POST /:id/dismiss` + `POST /dismiss-all` 패턴으로 해소됨.

---

## 전체 위험도

**MEDIUM** — WARNING 4건 중 plan_coherence 의 미결 의사결정 우회(W-48)와 worktree 경합 2건이 병합 후 재작업 위험을 내포함. Critical 차단 사유는 없으나 spec 반영 전 WARNING 2건 조치 권장.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 | r2 대응 |
|---|---------|------|-------------|-----------|------|---------|
| W-1 | plan_coherence | `spec/2-navigation/4-integration.md` 동시 수정 — `cafe24-token-expiry-fix-a3b8f1` worktree 가 동일 파일 unstaged 수정 중이나 영향 점검 표에 미등록 | 변경안 #4 §11.2 한 줄 추가 | `cafe24-token-expiry-fix-a3b8f1` worktree (§10.2 / Rationale 수정 중) | plan 영향 점검 표에 추가 | **해소** — diff 확인 결과 §10.2 (라인 555) + Rationale (라인 1326+) 만 건드림. 본 변경 §11.2 (라인 848) 와 hunk 겹침 없음. spec Rationale 의 영향 점검 표에 명시. |
| W-2 | plan_coherence | 미결 의사결정 W-48("PATCH 패턴") 범위를 합의 없이 우회해 dismiss endpoint 를 POST 로 단방향 확정 | §"HTTP 동사 정책" + 변경안 #1-E Rationale | `plan/in-progress/20260516-full-review/RESOLUTION.md` W-48 보류 항목 | RESOLUTION 에 합의 메모 명시 | **해소** — W-48 은 단건 상태 PATCH 패턴(예: `PATCH /resource/:id` status 변경) 의 표준화 미결이고, mark-all-read / dismiss-all 같은 일괄 액션 endpoint 는 W-48 결정과 직교. spec Rationale 에 이 분리 근거 inline. |
| W-3 | convention_compliance | 신규 응답 DTO 파일명 `dismiss-result.dto.ts` / `dismiss-all-result.dto.ts` 가 `*-response.dto.ts` 패턴(swagger.md §5-1) 미준수 | 변경안 #1-D §4.2 DTO 위치 절 | `spec/conventions/swagger.md §5-1` | `*-response.dto.ts` 패턴으로 정정 | **해소** — spec 본문에 `dismiss-notification-response.dto.ts` / `dismiss-all-notifications-response.dto.ts` 로 명시. |
| W-4 | cross_spec | `spec/1-data-model.md §3` 의 두 번째 Notification 인덱스 `(workspace_id, created_at DESC)` 에 `dismissed_at IS NULL` 필터 미적용 여부가 명시되지 않아 두 인덱스의 필터 정책 불균형이 의도된 설계인지 불명확 | 변경안 #2-B §3 인덱스 갱신 | `spec/1-data-model.md §3` 인덱스 전략 표 + `spec/data-flow/8-notifications.md` 변경안 #1-B | 설명 컬럼에 정책 차이 명시 | **해소** — §3 의 `(workspace_id, created_at DESC)` 항목에 "partial 미적용 (향후 admin/감사 쿼리가 dismissed 포함 전체 row 를 볼 여지)" 명시. 8-notifications.md §2.1 표에도 동일 정책 차이 설명. |

---

## 참고 (INFO) — 핵심만

- I-1 (cross_spec): 상태 전이 다이어그램이 단일 차원만 표현 → 다이어그램 아래 blockquote 로 "is_read 와 dismissed_at 가 별개 차원" 교차 참조 추가. **해소.**
- I-4 (rationale_continuity): mark-all-read POST 채택 원래 근거가 Rationale 에 없어 dismiss 대칭 논거 체인 불완전 → Rationale "옛 spec 의 `PATCH /notifications/read-all` 표기 정정" 항목 안에 한 문단 추정 근거 포함. **해소.**
- I-5 (rationale_continuity): `hasRecentByResource` 결정이 본문 §4.4 에만 → Rationale "중복 방지에 dismissed row 포함" 항목 신설, 본문은 참조. **해소.**
- I-6 (rationale_continuity): `active` 어휘 회피가 본문 blockquote 에만 → Rationale "어휘 선택 — `visible` / `dismissed`" 항목 신설. **해소.**
- I-7 (convention_compliance): migration 번호 placeholder 표기 → `V<NNN>` 꺾쇠 + "착수 직전 확인" 주석. **해소.**
- I-8 (convention_compliance): `ApiOkWrappedResponse` 인라인 객체 표기 → DTO 클래스명 명시 (`DismissNotificationResponseDto` / `DismissAllNotificationsResponseDto`). **해소.**
- I-11 (naming_collision): `DismissAllNotificationsResponseDto` shape 재사용 방향 → 동일 shape 이라도 의미 분리 위해 별도 클래스, `PickType` 등 재사용은 구현 단계 선택. **해소.**

미해소 INFO:
- I-2 (cross_spec): 앵커 정확성 → spec 반영 후 grep 으로 확인 완료, 외부 참조 0건.
- I-3 (cross_spec): WebSocket follow-up 이벤트명 충돌 예방 → follow-up plan 작성 시점 점검.
- I-9, I-10 (plan_coherence): follow-up plan 미등록 (WebSocket 동기화·dismissed row 청소) → 본 spec 의 §4.5 / §4.6 에 follow-up 임을 명시. 별도 plan 은 필요 시 생성.
- I-12 (naming_collision): UI 의 `Active/Inactive` 뱃지 어휘 미사용 주의 → spec Rationale "어휘 선택" 항목에 명시.

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 4개 spec 간 내부 일관성 양호 |
| rationale_continuity | LOW | 기존 Rationale 위반 없음 |
| convention_compliance | LOW | CRITICAL 없음, DTO 파일명 정정 후 해소 |
| plan_coherence | MEDIUM → LOW (대응 후) | worktree 경합 검증 / W-48 직교성 명시로 해소 |
| naming_collision | NONE | 신규 식별자 충돌 없음 |

---

## 결정

r2 의 모든 WARNING 을 spec 본문 / Rationale 에 반영 후 spec write 진행. r2 BLOCK: NO 가 최종 결정.
