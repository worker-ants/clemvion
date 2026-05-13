# /profile 안전성 개선 — 하이브리드 편집 패턴

> 승인된 설계: `/Users/gehrig/.claude/plans/profile-atomic-wave.md`
> 관련 spec: `spec/2-navigation/9-user-profile.md` (§1.2 · §2 · §2.1 · §2.2)
> 영향 코드: `frontend/src/app/(main)/profile/**`, `frontend/src/lib/i18n/dict/{ko,en}.ts`, 사이드바 메뉴 라벨

## 목표

`/profile` 페이지가 단일 [Save] 버튼으로 사용자 정보·비밀번호·환경설정의 이질적 변경을 한 번에 커밋하는 footgun 을 제거한다. 위험 수준에 비례한 마찰을 도입:

- 이름·환경설정 → 카드 단위 **인라인 편집 토글** + 저장 전 변경 전·후 **diff 확인 모달**
- 비밀번호 → **별도 sub-route** `/profile/change-password` (진입 자체가 의도 표명)
- 이메일 → spec §2.1 의 "별도 프로세스" 그대로 readonly 유지

## 결정된 정책

- 디폴트는 readonly. 각 카드 우상단 [편집] 버튼이 그 카드만 편집 모드로 전환.
- 환경설정의 theme 토글은 편집 모드 동안 **로컬 임시 state** 로 격리 — [취소] / 모달 닫힘 시 항상 원복.
- 비밀번호 변경 페이지는 react-hook-form + zod (기존 auth 폼 컨벤션). diff 모달 생략(마스킹된 값이라 무의미).
- 사이드바 팝업의 "📋 프로필 편집" 진입점 라벨을 "📋 내 프로필" 톤으로 갱신(readonly 진입 의미 일치).
- 백엔드 무변경 — `PATCH /api/users/me`, `POST /api/users/me/change-password` 그대로 사용.

## 작업 체크리스트

### Phase 1 — spec 갱신 (project-planner 핸드오프) ✅

대상: `spec/2-navigation/9-user-profile.md`

- [x] §1.2 사이드바 팝업 ASCII 박스 — `📋 프로필 편집` → `📋 내 프로필`
- [x] §2 화면 와이어프레임 — 단일 `[Save Changes]` 형태 폐기. (a) readonly 카드 묶음, (b) 이름·환경설정 카드의 [편집] 토글 + 저장 시 diff 확인, (c) 비밀번호 카드는 `[변경하기 →]` 링크로 `/profile/change-password` 진입, (d) 하단 단일 Save 버튼 삭제. §2.0 "편집 흐름" 표 + `/profile/change-password` 와이어프레임도 함께 추가.
- [x] §2.1 프로필 필드 표 — "편집 방식" 컬럼 추가 (인라인 / sub-route / 별도 프로세스). 비밀번호 행 신설.
- [x] §2.2 보안 설정 표 — 비밀번호 변경 행에 "전용 페이지 `/profile/change-password`" 명시. 2FA 행에 `/profile/security` 경로 명시.
- [x] §2.2 다음에 `## Rationale` 섹션 신설 — footgun 해소·위험 비례 마찰·세션 revoke 패턴과 톤 일치 사유 + 폐기된 대안 3종(모달 일원화 / 전 항목 sub-route / 섹션별 Save 버튼) 기록
- [x] `spec/2-navigation/_product-overview.md` NAV-UP-02 (line 169) — "프로필 편집" → "내 프로필" 톤 일치
- [x] `spec/2-navigation/_layout.md` line 101 — 메뉴 라벨 "프로필 편집" → "내 프로필" + 설명 갱신 (디폴트 readonly · sub-route 분리 명시 + 9-user-profile.md §2 링크)
- [x] 다른 spec 에서 `/profile` 단일 Save 흐름 전제 문장 grep — `spec/5-system/_product-overview.md` line 71 의 `/profile/alerts` 는 별도 페이지 언급으로 무관. 영향 없음.

### Phase 2 — 구현 (developer) ✅

frontend 신규:
- [x] `frontend/src/app/(main)/profile/components/confirm-diff-dialog.tsx` + `__tests__/confirm-diff-dialog.test.tsx` (4 케이스)
- [x] `frontend/src/app/(main)/profile/components/profile-info-card.tsx` + `__tests__/profile-info-card.test.tsx` (6 케이스)
- [x] `frontend/src/app/(main)/profile/components/profile-preferences-card.tsx` + `__tests__/profile-preferences-card.test.tsx` (6 케이스, theme 라이브 프리뷰 임시 state 격리 검증 포함)
- [x] `frontend/src/app/(main)/profile/change-password/page.tsx` + `__tests__/change-password.test.tsx` (5 케이스, react-hook-form + zod)

frontend 수정:
- [x] `frontend/src/app/(main)/profile/page.tsx` — readonly + 신규 카드 조립, 단일 Save 버튼 삭제, 비밀번호 카드 → KeyRound 아이콘 + Link
- [x] `frontend/src/lib/i18n/dict/ko.ts` 의 `sidebar.profile` 값 "프로필" → "내 프로필", profile namespace 에 `edit`, `confirmDiffTitle/Description`, `fieldBefore/After`, `changePasswordPage*`, `changePasswordCard*`, `changePasswordMin/MaxLength`, `emailReadonlyHint` (총 14개) 추가
- [x] `frontend/src/lib/i18n/dict/en.ts` 동일 갱신 — `sidebar.profile` → "My Profile" + 신규 키들 영문

### Phase 3 — 검증 ✅

- [x] 신규 컴포넌트 RTL 유닛 테스트 (readonly 디폴트, 편집 토글, 취소 원복, diff 모달 → 확정 → API 호출 mock + 에러 경로) — 27 케이스 / 4 파일
- [x] `cd frontend && npm run lint` — 0 errors
- [x] `cd frontend && npx vitest run` — 1276/1277 (사전 회귀 1건은 `executions-list-test-regression.md` 로 분리, 본 변경과 무관)
- [x] `cd frontend && npm run build` — 통과
- [x] `/profile` playwright e2e 시나리오 추가 — `frontend/e2e/profile/profile-edit.spec.ts` 신규 4 케이스 (디폴트 readonly · 이름 편집→diff→확정→PATCH · 환경설정 [취소]→PATCH 미호출 · 비밀번호 sub-route 진입→POST→리다이렉트). 4/4 통과.
- [x] backend e2e — backend 변경 없음 → 대상 아님 (N/A)
- [x] 수동 확인 (dev server) — 사이드바 진입 readonly · Network 탭 PATCH 격리 · 테마 라이브 프리뷰 후 [취소] 원복 모두 정상 (2026-05-13)

### Phase 4 — 마무리 ✅ (라이프사이클 이동 대기)

- [x] ai-review 실행 — `review/2026-05-13_08-07-24/` (13개 에이전트 병렬 리뷰)
- [x] `review/2026-05-13_08-07-24/RESOLUTION.md` 작성 — CRITICAL 1 + WARN 11 + INFO 11 처리, 보류 8건 사유 명시
- [x] 조치 후 TEST WORKFLOW 재통과 (lint·vitest·build 모두 통과)
- [x] 모든 항목 완료 — `git mv plan/in-progress/profile-safer-edit.md plan/complete/profile-safer-edit.md`

## 후속 follow-up (별도 plan)

- 이메일 변경 플로우 (spec §2.1 의 "별도 변경" 미구현) — 확인 메일 발송 흐름 설계 필요
- 아바타 업로드 (`POST /api/users/me/avatar`) — 현재 page.tsx 미구현
- 비밀번호 변경 페이지의 TOTP 재인증 옵션 — 현재 백엔드가 password 만 요구, spec 개정 시 확장

## 명시적 비범위

- 백엔드 변경 (DTO·서비스·라우트 모두 그대로)
- 2FA / 활성 세션 페이지 (이미 sub-route 분리되어 있음)
