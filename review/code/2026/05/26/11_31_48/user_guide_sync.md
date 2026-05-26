# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

해당 없음 — 아래 분석 참조.

## 분석 상세

### 변경 파일 목록 (main 브랜치 분기 이후)

- `codebase/frontend/src/app/(main)/docs/layout.tsx` — DocsMobileSidebar 컴포넌트 삽입, 레이아웃 클래스 조정
- `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` (신규) — 모바일/태블릿 사이드바 토글 컴포넌트
- `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx` (신규) — 단위 테스트
- `codebase/frontend/src/components/ui/slide-drawer.tsx` — `side` prop 추가 (left/right)
- `codebase/frontend/src/components/ui/__tests__/slide-drawer.test.tsx` (신규) — 단위 테스트
- `codebase/frontend/src/lib/i18n/dict/ko/docs.ts` — `mobileSidebarToggle`, `mobileSidebarTitle` 키 추가
- `codebase/frontend/src/lib/i18n/dict/en/docs.ts` — 동일 키 영어 번역 추가
- `plan/in-progress/docs-mobile-sidebar.md`, `plan/in-progress/spec-update-user-guide-mobile.md` (plan 파일)

### 매트릭스 trigger 매칭 결과

| 매트릭스 trigger | 매칭 여부 | 판정 |
|---|---|---|
| 새 노드 추가 (`codebase/backend/src/nodes/`) | 미해당 (backend 변경 없음) | SKIP |
| 노드 schema 변경 | 미해당 | SKIP |
| 신규 UI 문자열 (TSX) | **해당** — `docs-mobile-sidebar.tsx` 가 `t("docs.mobileSidebarToggle")`, `t("docs.mobileSidebarTitle")` 신규 사용 | PASS |
| 통합 신규/제공자 변경 | 미해당 | SKIP |
| 유저 가이드 신규 섹션 디렉토리 | 미해당 (신규 `<NN>-<name>/` 디렉토리 없음) | SKIP |
| 인증·권한·세션 흐름 변경 | 미해당 | SKIP |
| 표현식 언어 변경 | 미해당 | SKIP |
| 실행·디버깅 흐름 변경 | 미해당 | SKIP |
| 신규 warningCode/errorCode | 미해당 (backend 변경 없음) | SKIP |

### 신규 UI 문자열 parity 점검

`docs-mobile-sidebar.tsx` 에서 사용하는 두 i18n 키의 등록 상태:

| 키 | `dict/ko/docs.ts` | `dict/en/docs.ts` |
|---|---|---|
| `docs.mobileSidebarToggle` | "가이드 목차" (line 9) | "Guide contents" (line 11) |
| `docs.mobileSidebarTitle` | "사용자 가이드" (line 10) | "User Guide" (line 12) |

ko/en 양쪽 동시 등록 확인됨. i18n parity 충족.

`slide-drawer.tsx` 의 `t("common.close")` 키는 기존에 이미 `dict/ko/common.ts` (line 9: "닫기"), `dict/en/common.ts` (line 11: "Close") 에 등록된 키이며 이번 변경이 신규로 도입한 키가 아님. parity 이상 없음.

### 하드코딩 한국어 확인

`docs-mobile-sidebar.tsx` 와 `slide-drawer.tsx` 내 한국어 문자는 전부 JSDoc/주석 내부에만 존재. 렌더링되는 UI 문자열에 하드코딩 한국어 없음. ratchet 위반 없음.

### docs MDX / backend-labels / locale.ts 동반 갱신 필요 여부

변경 set 에 backend 코드, 노드, 통합 제공자, 섹션 디렉토리 신규 생성이 포함되지 않으므로 docs MDX 갱신, `backend-labels.ts` 갱신, `locale.ts` SECTION_LABELS_BY_LOCALE 갱신이 모두 불필요.

## 요약

PROJECT.md §변경 유형 → 갱신 위치 매핑 매트릭스의 9개 trigger 를 점검한 결과, 이번 변경에 해당하는 trigger 는 "신규 UI 문자열 (TSX)" 1건이다. 해당 trigger 의 동반 갱신 의무(ko/en dict 양쪽 등록)는 `dict/ko/docs.ts` + `dict/en/docs.ts` 에 두 키가 동시 추가됨으로써 충족되었다. 누락 발견 0건.

## 위험도

NONE
