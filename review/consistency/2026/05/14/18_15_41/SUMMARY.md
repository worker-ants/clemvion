# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. 모든 5개 Checker 가 LOW 위험도를 판정.

---

## 전체 위험도
**LOW** — Critical 위배 없음. Warning 4건은 모두 단일 문서 1–2줄 갱신으로 해소 가능.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec + Naming Collision (통합) | `CAFE24_INSTALL_INVALID_HMAC` 의미 축소 + `4-cafe24.md §9.4 step 4` 미갱신 — Draft 2J-1 이 step 3 만 수정하고 step 4 는 그대로 두어, `4-integration.md §3.2 step 4` (draft 후: install_token 단일 조회) 와 서술이 어긋남. 또한 에러 코드 분리 패치(`4-integration.md:653`)가 spec-draft 의 replace 패치에 포함되는지 미확인 | `DRAFT 2J-1`, `DRAFT 2E` | `spec/4-nodes/4-integration/4-cafe24.md §9.4 step 4` / `spec/2-navigation/4-integration.md:653` | Draft 2J-1 에 step 4 diff 추가 (`4-integration.md §3.2 step 4` 와 동일 문구로 정렬). `4-integration.md:653` 원본 행 삭제가 Draft 2E replace 패치에 명시적으로 포함되어 있는지 재확인. |
| W2 | Plan Coherence | HTTP 상태 코드 불일치 — `spec-update-cafe24-pending-polish.md §B C4` 는 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (400)` 로 명시하나 draft 는 `(409)` 로 정의 | `DRAFT 2F` | `plan/in-progress/spec-update-cafe24-pending-polish.md §B C4` | `spec-update §B C4` 의 `(400)` → `(409)` 로 1줄 수정 + "spec-draft 에서 swagger 선례에 따라 409 로 수정" 주석 추가. |
| W3 | Plan Coherence | Draft 수정 범위가 상위 plan 열거 목록 초과 — `spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/integration.md §1.2/§1.4/§2.1`, `spec/conventions/cafe24-api-metadata.md §6` 4종이 `cafe24-pending-polish.md` Step 0 및 `spec-update` 대상 파일 목록에 없음 | `DRAFT 2J`/`2J-bis`/`2J-2`/`2J-ter`, `DRAFT 3C`/`3C-bis`/`3D`, `DRAFT 2H` | `plan/in-progress/cafe24-pending-polish.md` Step 0, `plan/in-progress/spec-update-cafe24-pending-polish.md` | `cafe24-pending-polish.md` Step 0 에 4개 파일 병기. `spec-update` 에 "확장 범위 (W-시리즈 해소)" 항목 추가. |
| W4 | Naming Collision | `oauth_token_exchange_failed` (통합 callback `status_reason` DB 저장값) vs `token_exchange_failed` (소셜 로그인 auth URL param) — 동일 의미 에러에 유사 이름이 두 도메인에 공존 | `DRAFT 1C`, `DRAFT 2D`, `DRAFT 3B` | `backend/src/modules/auth/auth.controller.ts:543`, `spec/2-navigation/10-auth-flow.md:326` | spec Rationale 에 "소셜 로그인 URL param `token_exchange_failed` (auth 도메인) 과 통합 callback `status_reason='oauth_token_exchange_failed'` (integration 도메인) 는 도메인이 달라 의도적으로 구분" 한 줄 추가. 이름 변경 불필요. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `data-flow §1.2` 기존 구 API 경로 (`GET /oauth/:service/start`) 잔존 — draft 후에도 `§9.2` 의 `POST /oauth/begin` 과 불일치 | `DRAFT 3C` forward-ref | Draft 3C 범위 확장하여 기존 경로를 `POST /api/integrations/oauth/begin` 으로 수정하거나, forward-ref 에 "기존 §1.2 경로 표기는 구 버전" 명시. |
| I2 | Convention Compliance | 규약 파일(`cafe24-api-metadata.md §6`) 수정이 spec 패치에 혼재 — 리뷰어가 "spec 변경" 과 "규약 변경" 을 구분 없이 일괄 적용할 위험 | `DRAFT 2H` | draft 상단에 "규약 파일 수정 포함: `spec/conventions/cafe24-api-metadata.md §6`" 명시 또는 별도 커밋으로 분리. |
| I3 | Convention Compliance | `410 Gone` 이 `swagger.md §2-4` 표에 미등재 — 구현 시 `@ApiResponse({ status: 410 })` 수동 지정 필요 | `DRAFT 2E`/`2F` (`CAFE24_INSTALL_LEGACY_PATH`) | spec §9.2 deprecated 항에 "(구현 시 `@ApiResponse({ status: 410 })` 수동 지정 — swagger §2-4 표 외 코드)" 노트 추가. 또는 swagger §2-4 에 "410 → 폐기된 경로" 행 추가. |
| I4 | Convention Compliance | Rationale 내 review session 참조 타임스탬프 `2026-05-14_16-48-25` 가 현 worktree 에 존재하지 않음 | `DRAFT 2I ## Rationale` | spec 적용 전 경로 실재 확인. 없으면 참조 제거 또는 `2026-05-14_17-00-12` 로 대체. |
| I5 | Rationale Continuity | `pending_install` 중복 허용 정책 Rationale 미기재 — `connected` 만 차단하고 동일 `(workspaceId, mall_id, app_type='private')` 의 `pending_install` 중복을 허용하는 근거가 없음 | `DRAFT 2F-bis` | DRAFT 2F-bis 또는 DRAFT 2I Rationale 에 "pending_install 중복 허용: 각 행이 고유 install_token 을 가지므로 독립 추적되며 TTL 24h 로 자동 만료" 한 줄 추가. |
| I6 | Plan Coherence | 옛 install 경로 영구 폐기 follow-up 이 `cafe24-pending-polish.md` 에 미등재 | `DRAFT 2I Rationale` (follow-up 예약) | `cafe24-pending-polish.md` "비포함" 섹션에 "옛 install 경로 영구 폐기 시점 결정 — 운영 데이터·외부 등록 URL 잔존 여부 확인 후 별도 plan" 항목 추가. |
| I7 | Plan Coherence | draft 적용 완료 시 `spec-draft` + `spec-update` 양쪽 `plan/complete/` 이동이 `cafe24-pending-polish.md` 에 미명시 | `cafe24-pending-polish.md` 실행 순서 | Step 0 뒤에 "spec-draft 와 spec-update 모두 `plan/complete/` 로 `git mv`" 1줄 추가. |
| I8 | Naming Collision | `statusReason: 'waiting'` — 테스트 픽스처 임의값이 draft 의 status_reason 정의 값 목록에 없음 | `integration-oauth.service.cafe24.spec.ts:449` | 구현 착수 시 해당 픽스처를 `oauth_token_exchange_failed` 등 draft 정의 값으로 교체. |
| I9 | Cross-Spec | Draft 1B 의 `install_token` 컬럼 타입 기술 (`String?`) 이 V042 DDL (`VARCHAR(64)`) 보다 추상적 | `DRAFT 1B` | spec 에 "32바이트 hex = 64자" 또는 `VARCHAR(64)` 길이 힌트 추가. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `4-cafe24.md §9.4 step 4` 미갱신(W1), `data-flow §1.2` 구 API 경로 잔존(I1) — Critical 없음 |
| Rationale Continuity | LOW | 3대 번복(mall_id 스캔→install_token, 자동삭제→expired, HMAC 합산→분리) 모두 acknowledgment 충분. `pending_install` 중복 허용 근거 미기재(I5)만 잔존 |
| Convention Compliance | LOW | 에러 코드·HTTP 상태·문서 구조 모두 규약 준수. 410 수동 처리 필요(I3)·규약 파일 혼재(I2)·타임스탬프 링크 확인(I4) 세 INFO 한정 |
| Plan Coherence | LOW | HTTP 상태 코드 불일치 400 vs 409(W2), 수정 범위 초과(W3) — 상위 plan 단일 줄 수정으로 해소 가능 |
| Naming Collision | LOW | `CAFE24_INSTALL_INVALID_HMAC` 의미 축소(W1 통합), `oauth_token_exchange_failed` 유사 이름(W4) — 이름 변경 불필요, Rationale 1줄 추가로 충분 |

---

## 권장 조치사항

1. **[W2 — 즉시]** `plan/in-progress/spec-update-cafe24-pending-polish.md §B C4` 의 `(400)` → `(409)` 1줄 수정.
2. **[W3 — 즉시]** `plan/in-progress/cafe24-pending-polish.md` Step 0 에 4개 추가 파일 병기 + `spec-update` 에 "확장 범위 (W-시리즈 해소)" 항목 추가.
3. **[W1 — spec 적용 전]** `DRAFT 2J-1` 에 `4-cafe24.md §9.4 step 4` diff 추가 (`4-integration.md §3.2 step 4` 문구와 정렬). `4-integration.md:653` 삭제가 Draft 2E replace 패치에 포함되어 있는지 명시적 확인.
4. **[I1 — spec 적용 전]** `DRAFT 3C` 에 기존 `data-flow §1.2` 구 경로 수정 diff 추가 또는 forward-ref 강화.
5. **[I5 + W4 — spec 작성 시]** `DRAFT 2I Rationale` 에 `pending_install` 중복 허용 근거 1줄 + `oauth_token_exchange_failed` vs `token_exchange_failed` 도메인 구분 주석 추가.
6. **[I6 + I7 — plan 정리 시]** `cafe24-pending-polish.md` "비포함" 섹션에 영구 폐기 follow-up 등재 + 완료 처리 시 두 plan 파일 모두 `git mv` 명시.
7. **[I2 + I3 + I4 — 낮은 우선순위]** 규약 파일 수정 별도 명시, 410 구현 노트 추가, Rationale 타임스탬프 링크 실재 확인.