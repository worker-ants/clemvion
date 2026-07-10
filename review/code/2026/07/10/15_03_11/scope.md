# 변경 범위(Scope) 리뷰 — activity-disconnected-banner

## 검토 대상

- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/__tests__/activity-disconnected-banner.test.tsx` (신규)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx` (신규)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx` (수정)
- `codebase/frontend/src/lib/i18n/dict/en/integrations.ts` (수정)
- `codebase/frontend/src/lib/i18n/dict/ko/integrations.ts` (수정)
- `plan/in-progress/activity-disconnected-banner.md` (신규)
- `spec/2-navigation/4-integration.md` (수정, +1 라인)

## 발견사항

발견된 범위 이탈 없음.

- 신규 컴포넌트(`activity-disconnected-banner.tsx`)와 그 단위테스트는 plan에 기술된 배너 기능 하나만 구현한다. `status`/`onGoToOverview`/`t` 세 prop 외 부가 로직 없음.
- `page.tsx` 변경은 (a) 신규 컴포넌트 import 1줄, (b) `ActivityTab`에 `status`/`onNavigate` prop 추가, (c) 빈 상태·목록 두 렌더 분기 위에 `disconnectedBanner`를 삽입하는 것으로 국한된다. 기존 로직(catalog fetch, `renderApiCell`, 테이블 렌더 등)은 그대로 유지되고 손대지 않았다. `IntegrationDto` 타입은 기존에 이미 import돼 있어 재사용했을 뿐 신규 import가 아니다.
- 추가된 주석(`// §4.6 — …`)은 새로 삽입한 코드 블록을 설명하는 것으로, 기존 코드에 대한 불필요한 주석 변경은 없다.
- i18n dict 변경은 두 로케일 모두 동일한 3개 키(`activityDisconnectedTitle`/`Hint`/`Action`) 추가뿐이며 기존 키 재배열·삭제 없음.
- `spec/2-navigation/4-integration.md`는 §4.6에 배너 설명 1문장만 추가. 프롬프트에 포함된 "전체 파일 컨텍스트"가 방대해 보이지만 실제 diff는 `+1 -0` 한 줄이며, plan frontmatter의 `spec_impact`도 이 파일 하나만 가리켜 정합적이다.
- `plan/in-progress/activity-disconnected-banner.md` 신규 생성은 이 작업 자체의 추적 문서로 스코프 내.
- 포맷팅 전용 변경, 미사용 임포트, 설정 파일 변경, 관련 없는 리팩토링은 발견되지 않았다.

## 요약

전체 변경분은 plan에 명시된 "활동 탭 연결 안 됨 배너" 기능 하나로 강하게 수렴한다. 신규 파일(컴포넌트+테스트+plan) 추가와 기존 `page.tsx`/i18n dict/spec 문서에 대한 최소한의 삽입형 diff만 존재하며, 의도 이상의 리팩토링·기능 확장·무관한 파일 수정·포맷팅 잡음·불필요한 주석/임포트 변경은 확인되지 않았다.

## 위험도

NONE
