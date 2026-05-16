---
worktree: cafe24-mall-dup-ux-a7f2c8
started: 2026-05-16
owner: developer
---

# Cafe24 동일 mall_id 중복 감지 UX 보강

## 문제

기존:
- **Private begin** 에만 사전 중복 가드 (`connected` 만 차단) → 영문 backend 메시지를 toast 로만 노출.
- **Public begin** 에는 사전 가드 없음 → 사용자가 Cafe24 동의까지 다 끝낸 뒤 `POST /api/integrations` 의 V045 UNIQUE 충돌이 500 으로 빠짐 (`throwIfUniqueViolation` 이 `idx_integration_cafe24_workspace_mall` 미처리).
- **사전 감지 없음**: 사용자가 mall_id 입력 단계에서 이미 연결돼 있는지 알 수 없음 — Connect 클릭 후에야 알림.

## 해결안

### Backend (1) Public begin 가드
`integration-oauth.service.ts` cafe24 public 분기에 private 와 동일한 사전 체크 추가. `connected` row 존재 시 즉시 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)`. 공통 로직은 private/public 공유 helper `findExistingConnectedCafe24Mall(workspaceId, mallId)` 로 추출.

### Backend (2) `throwIfUniqueViolation` 확장
`integrations.service.ts` 의 `throwIfUniqueViolation` 에 `idx_integration_cafe24_workspace_mall` 분기 추가 — race / public 흐름의 finalize 단계 V045 UNIQUE 충돌을 동일한 409 코드로 변환.

### Backend (3) Precheck endpoint
```
GET /api/integrations/cafe24/precheck?mallId=<mall>
→ 200 { conflict: bool, existingIntegrationId?, existingName?, status? }
```
인증된 사용자의 current workspace 기준. throttle 적용 (debounce 호출이라 limit 60/분 수준).

### Frontend (4) 사전 감지 + 한글 toast
`integrations/new/page.tsx` cafe24 분기:
- `mall_id` 입력 후 350ms debounce → `GET /api/integrations/cafe24/precheck` 호출.
- `conflict=true` 시 inline 경고 배너 (`AlertTriangle` 아이콘) + Connect 버튼 disabled + 기존 통합 상세로 가는 링크.
- `connected` / `pending_install` / `expired` / `error` 별 안내 메시지 분기.
- 사후 toast 도 한글 i18n 메시지를 primary 로, `e.response?.data?.message` 는 괄호 안 보조 정보.
- i18n 키 추가 (`ko/integrations.ts` + `en/integrations.ts` parity 유지).

### Spec (5) — 별도 plan 노트로 위임
`plan/in-progress/spec-update-cafe24-public-dup-guard.md` 작성 → `project-planner` 호출.

## 검증

- backend unit: `integration-oauth.service.cafe24.spec.ts` 에 public-flow duplicate guard 케이스 추가, `integrations.service.spec.ts` 의 race backstop, `precheck` endpoint controller spec.
- backend e2e: `backend/test/integrations-cafe24.e2e-spec.ts` (또는 기존 spec 에 케이스 추가) — public + private 둘 다 같은 mall 로 시도 시 사전 거부 + precheck 응답.
- frontend unit: `new/page.tsx` 의 precheck call · 배너 표시 · Connect 비활성화.

## Consistency check 결과 (2026-05-16 14:28)

`review/consistency/2026/05/16/14_28_20/SUMMARY.md` — **BLOCK: YES** (Critical 3건).

- **Critical 1·2** (Attention 칩 삭제, `appUrl` 필드 삭제 ↔ 프론트 코드 충돌) — **본 작업 범위 밖**. spec 의 기존 불일치로 별도 worktree (`integration-attention-filter-053b74` 등) 가 처리 중일 가능성. 본 worktree 는 §9.2 (OAuth begin) + §9.4 (errors) + Rationale 신설만 다루므로 영향 없음.
- **Critical 3** (`cafe24-hmac-raw-fix-b8e2d1` 가 같은 Rationale 말미 수정 중) — 본 worktree 는 spec 본문을 직접 수정하지 않고 project-planner 에 위임하므로 위임 단계에서 rebase 처리. 코드 구현 자체에는 영향 없음.

### Warning 반영 결정

- **Warning 7** (NestJS route order) — 반영. `@Get('cafe24/precheck')` 를 `@Get(':id')` 위에 선언.
- **Warning 8** (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` rename) — **기각**. 사용자 지시: "에러 코드는 기존 그대로 재사용해 호환성 유지. 메시지 문구만 일반화". spec line 725 가 이미 "app_type 무관" 으로 정의해 의미상 모순 없음.
- **Warning 9 / INFO 9** (helper 이름) — 반영. `findConnectedCafe24MallIntegration` 사용 (precheck 의 전체 status 조회는 별도 `findAnyCafe24MallIntegration` 으로 분리).
- **Warning 6** (plan 체크박스) — 본 commit 에서 갱신.
- 나머지 Warning (배너 조건, errors 표기 컨벤션, §11 expire 표현) — `spec-update-cafe24-public-dup-guard.md` 에 위임 추가 항목으로 기록.

## 진행 상태

- [x] 스펙 / 코드 흐름 파악
- [x] plan 노트 작성
- [x] consistency-check --impl-prep
- [x] Backend (1) Public begin guard
- [x] Backend (2) throwIfUniqueViolation 확장
- [x] Backend (3) Precheck endpoint
- [x] Frontend (4) Inline pre-detection + Korean toast
- [x] TEST + REVIEW WORKFLOW (rebase 후 재리뷰, Critical 0건, Warning 조치 완료)
- [ ] Spec 위임 (project-planner)
