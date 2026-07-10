# 보안(Security) 리뷰 결과

## 리뷰 대상
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx` (신규)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/__tests__/activity-disconnected-banner.test.tsx` (신규)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx` (ActivityTab 에 배너 연결)
- `codebase/frontend/src/lib/i18n/dict/{en,ko}/integrations.ts` (i18n 문자열 3개 추가)
- `plan/in-progress/activity-disconnected-banner.md`, `spec/2-navigation/4-integration.md` (문서)

### 발견사항

없음. 순수 프레젠테이션 배너 컴포넌트로, 신규 API 호출·사용자 자유입력 처리·인증/인가 로직·시크릿·암호화 관련 코드가 없다. 세부 검토 근거:

- **인젝션/XSS**: 렌더링되는 텍스트는 전부 `t("integrations.activityDisconnected*")` i18n 정적 문자열이며 변수 보간(`{{...}}`)이 없다. `dangerouslySetInnerHTML` 사용 없음, React JSX 자식으로만 렌더되어 자동 이스케이프된다. `status` prop 은 `IntegrationDto["status"]` 로 타입이 제한된 enum(`connected`/`error`/`expired`/`pending_install`)이며 문자열을 DOM/속성/URL 에 직접 삽입하지 않고 단순 조건 분기(`if (status === "connected") return null`)에만 사용된다.
- **하드코딩 시크릿**: 없음.
- **인증/인가**: 이 컴포넌트는 인가 판단을 하지 않는다 — `status` 는 상위 `page.tsx` 가 이미 인가된 `GET /api/integrations/:id` 응답에서 받은 값을 그대로 prop 으로 전달할 뿐이며, 배너 표시 여부가 어떤 민감 동작의 접근 제어로 쓰이지 않는다(단순 UX 안내). `onGoToOverview` 도 클라이언트 로컬 탭 상태(`setTab`)만 바꿀 뿐 라우팅·API 호출이 없다.
- **입력 검증**: 사용자 자유 텍스트 입력을 받는 지점이 없다(버튼 클릭 이벤트만 존재).
- **OWASP Top 10**: 해당 사항 없음(CSRF/SSRF/IDOR 등을 유발할 신규 서버 호출이나 URL 조작이 없음).
- **암호화**: 해당 없음.
- **에러 처리**: 이 diff 는 에러 메시지를 다루지 않는다. `page.tsx` 전체 컨텍스트에 보이는 `row.error` 렌더링(활동 테이블의 에러 컬럼)은 이번 diff 범위 밖의 기존 코드이며 변경되지 않았다.
- **의존성 보안**: 신규 의존성 추가 없음(기존 `@/components/ui/button`, i18n, testing-library 재사용).

### 요약
이번 변경은 통합 상세 페이지의 "활동" 탭에 상태 안내용 경고 배너를 추가하는 순수 프레젠테이션 기능으로, 타입이 제한된 enum(`status`) 과 정적 i18n 문자열만 사용하고 신규 네트워크 호출·인증/인가 판단·사용자 자유 입력 처리가 없어 공격 표면 확장이 없다. 보안 관점에서 문제로 지적할 사항이 없다.

### 위험도
NONE
