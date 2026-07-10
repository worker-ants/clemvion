# 보안(Security) 리뷰 결과

## 리뷰 대상

- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx` (신규 컴포넌트)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/__tests__/activity-disconnected-banner.test.tsx` (신규 테스트)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx` (`ActivityTab` 에 배너 연결)
- `codebase/frontend/src/lib/i18n/dict/{en,ko}/integrations.ts` (i18n 문자열 3개 추가)
- `CHANGELOG.md`, `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.{mdx,en.mdx}`, `spec/0-overview.md`, `spec/2-navigation/4-integration.md`, `plan/in-progress/activity-disconnected-banner.md`, `review/code/**`, `review/consistency/**` (문서/plan/이전 리뷰 산출물 — 모두 non-executable, 보안 스코프 밖)

이번 diff 는 앞선 라운드(`review/code/2026/07/10/15_03_11`)의 security 서브에이전트가 이미 NONE 으로 판정한 기능(활동 탭 "연결 안 됨" 배너)에 대해, 그 리뷰/consistency-check 의 WARNING 을 반영한 **RESOLUTION 커밋**이다. 실질 변경은 톤 분기 추가(`isError` 3-way → red/amber)와 `role="status"` 추가, 문서·spec·CHANGELOG 보강뿐이며 신규 공격 표면은 없다.

### 발견사항

없음. 세부 검토 근거는 다음과 같다.

- **인젝션(SQL/XSS/커맨드/경로탐색)**: `activity-disconnected-banner.tsx` 가 렌더하는 모든 텍스트는 `t("integrations.activityDisconnected*")` i18n 정적 문자열이며 사용자 입력이나 서버 응답의 자유 텍스트를 보간하지 않는다(`{{...}}` placeholder 없음). `dangerouslySetInnerHTML` 미사용, React JSX 자식으로만 렌더되어 자동 이스케이프된다. `status` prop 은 `IntegrationDto["status"]` 로 타입이 제한된 4-value enum(`connected`/`error`/`expired`/`pending_install`)이며 DOM 속성·URL·쿼리에 직접 삽입되지 않고 순수 조건 분기(`status === "connected"` → `null`, `status === "error"` → red 톤, 그 외 → amber 톤)에만 쓰인다. `cn()` 유틸에 전달되는 클래스 문자열도 전부 하드코딩 리터럴(`"border-red-300 bg-red-50 ..."` 등)이라 클래스 인젝션 여지가 없다.
- **하드코딩된 시크릿**: 없음. API 키/토큰/자격증명 관련 코드 변경 없음.
- **인증/인가**: 이 컴포넌트는 인가 판단을 하지 않는다. `status` 는 상위 `page.tsx` 가 이미 인증/인가된 `GET /api/integrations/:id` 응답에서 받은 값을 그대로 prop 으로 전달할 뿐이고, 배너 노출 여부가 어떤 민감 동작(삭제·재연결 실행 등)의 접근 제어로 쓰이지 않는 순수 UX 안내다. `onGoToOverview` 콜백도 `page.tsx` 의 로컬 탭 상태(`setTab("overview")`)만 바꿀 뿐 신규 API 호출·라우팅·권한 우회 경로가 없다. 톤 분기(`isError` = `status === "error"`)가 새로 추가됐지만 이는 시각적 강조 로직일 뿐 인가 판단과 무관하다.
- **입력 검증**: 사용자 자유 텍스트 입력을 받는 지점이 없다(버튼 클릭 이벤트 하나뿐이며 페이로드 없음). 테스트 파일도 마찬가지로 고정 fixture(`status` enum, mock 콜백)만 사용한다.
- **OWASP Top 10**: 해당 사항 없음 — CSRF/SSRF/IDOR/Broken Access Control 을 유발할 신규 서버 호출, URL 구성, 리소스 ID 조작이 없다. 문서(mdx/spec/CHANGELOG) 변경도 정적 콘텐츠 서술 추가일 뿐 실행 코드가 아니다.
- **암호화**: 해당 없음. 해시/암호화 알고리즘·평문 전송 관련 코드 변경 없음.
- **에러 처리**: 이 diff 는 에러 메시지 생성·노출 로직을 다루지 않는다. i18n hint 문구(`"이 통합이 연결되어 있지 않아 새 호출이 기록되지 않아요..."`)는 통합 자체의 연결 상태(이미 사용자에게 공개된 정보)를 안내할 뿐 스택 트레이스·내부 경로·시스템 세부정보를 노출하지 않는다. `page.tsx` 의 기존 `row.error`(활동 테이블 에러 컬럼) 렌더링은 이번 diff 범위 밖의 기존 코드이며 변경되지 않았다.
- **의존성 보안**: 신규 npm 의존성 추가 없음. 기존 `@/components/ui/button`, `@/lib/utils/cn`, `@/lib/i18n`, `@testing-library/react`, `@testing-library/user-event`, `vitest` 재사용뿐이다.

### 요약

이번 변경은 통합 상세 페이지 "활동" 탭에 연결 상태 안내용 경고 배너를 추가하고, 선행 리뷰(WARNING)를 반영해 톤 분기(error=red/expired·pending_install=amber)와 `role="status"`, 문서·CHANGELOG·spec 갱신을 더한 순수 프레젠테이션 기능이다. 타입이 제한된 enum 과 정적 i18n 문자열만 사용하고, 신규 네트워크 호출·인증/인가 판단·사용자 자유 입력 처리·시크릿·암호화 관련 코드가 전혀 없어 공격 표면 확장이 없다. 문서/plan/이전 리뷰 산출물(md/json) 변경도 실행되지 않는 정적 콘텐츠로 보안 영향이 없다. 보안 관점에서 지적할 사항이 없다.

### 위험도

NONE
