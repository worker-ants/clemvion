# 변경 범위(Scope) 리뷰

## 작업 의도

`kb-model-change-reembed-followup` plan (선택지 ③): `embeddingDimension == null` KB 상세 페이지 상단에 "검색 불가" 배너(UnsearchableBanner)를 추가하고, idle 상태에서 editor 권한자에게 "지금 재임베딩" CTA를 제공한다. 신규 API 없음, 기존 `POST /re-embed` 재사용, frontend-only 변경.

## 발견사항

### 파일 1: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx`

- **[INFO]** import 추가와 JSX 삽입이 목적에 완전히 부합한다. `UnsearchableBanner` import 1개(line 35), 렌더 게이트 블록 8줄(lines 43–50)이 전부이며 기존 코드 변경 없음. 전체 파일 컨텍스트에서도 무관 수정이나 포맷팅 정리 흔적이 없다.

### 파일 2: `codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx`

- **[INFO]** 신규 파일. 4개 테스트 케이스(idle+editor CTA, idle+viewer 텍스트만, in_progress 진행표시, dismiss 버튼 없음)가 모두 배너 컴포넌트 자체 동작 검증에 한정된다. 기존 다른 컴포넌트 테스트나 무관 픽스처 추가가 없다.

### 파일 3: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`

- **[INFO]** 신규 파일. presentational 컴포넌트 76줄로, props 인터페이스·JSX·i18n 호출·RoleGate만 포함한다. 다른 기능 확장이나 전역 부수효과 없음.

### 파일 4: `codebase/frontend/src/lib/i18n/dict/en/knowledgeBases.ts`

- **[INFO]** 3개 키(`reembedNow`, `unsearchableBannerIdleDesc`, `unsearchableBannerInProgressDesc`) 추가만 있다. 기존 키 수정·삭제·순서 변경 없음.

### 파일 5: `codebase/frontend/src/lib/i18n/dict/ko/knowledgeBases.ts`

- **[INFO]** en 사전과 동일하게 3개 키 추가만 있다. 기존 항목 무변경.

### 파일 6: `plan/in-progress/kb-model-change-reembed-followup.md`

- **[INFO]** 남은 작업 체크리스트 4개 항목을 `[ ]` → `[x]` 로 완료 표시하고, 각 항목에 실행 결과 인라인 주석을 추가했다. plan 파일의 정상적인 진행 기록이며 무관 변경 없음.

## 요약

6개 변경 파일 모두 plan이 명시한 "상세 배너 강화(선택지 ③)" 범위 내에 정확히 수렴한다. 신규 컴포넌트 파일 2개(구현+테스트), page.tsx에 import+렌더 게이트 삽입, ko/en i18n 키 각 3개 추가, plan 체크박스 갱신으로 구성되며, 기존 코드의 리팩토링·포맷팅 변경·불필요한 임포트 정리·무관 기능 추가가 일절 없다. 범위 이탈 항목이 없다.

## 위험도

NONE
