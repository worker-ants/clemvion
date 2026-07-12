# 보안(Security) 리뷰

## 발견사항

- **[INFO]** 신규 `totalCount` (AI 도구 출력 기반, 사실상 신뢰 경계 밖의 입력) 처리 방식은 안전
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `asTotalCount`, `codebase/channel-web-chat/src/widget/components/presentations.tsx` `CarouselView`
  - 상세: `output.itemsTotalCount`/`output.itemsTruncated` 는 백엔드를 경유하지만 원천은 AI 에이전트(`render_carousel` 도구 호출) 산출물이라 위젯 입장에서는 신뢰할 수 없는 입력으로 취급해야 한다. `asTotalCount`가 `typeof v === "number" && Number.isInteger(v) && v >= 0` 로 타입·범위·정수 여부를 모두 정규화(NaN/Infinity/음수/소수/문자열/객체 → `undefined`)하므로, `total NaN개…` 류 정보 유출이나 렌더링 이상값이 새어나갈 여지가 없다. 렌더는 `CarouselView`에서 `t("carousel.truncatedWithCount", { count: totalCount })`로 JSX 텍스트 노드에 삽입되며(`dangerouslySetInnerHTML` 미사용), `context.tsx`의 `makeTranslate`는 `String(params[name])`으로 문자열 치환 후 React 가 자동 이스케이프하는 일반 텍스트로 렌더한다 — count 가 정수로 고정돼 있어 위조 문자열을 통한 XSS/템플릿 인젝션 경로가 없다.
  - 제안: 조치 불요(현재 구현이 안전한 패턴). 향후 `TranslateParams`에 문자열 파라미터(예: 자유 텍스트)를 추가할 경우, React JSX 텍스트 렌더링 경로를 유지(`dangerouslySetInnerHTML` 도입 금지)해야 XSS 안전성이 계속 보장된다는 점만 기억할 것.

- **[INFO]** i18n catalog·CSS·CHANGELOG·plan/spec 변경분은 순수 정적 문자열/문서로 공격 표면 없음
  - 위치: `catalog.ts`, `styles.ts`, `CHANGELOG.md`, `plan/in-progress/webchat-widget-presentation-followups.md`, `spec/7-channel-web-chat/1-widget-app.md`
  - 상세: 신규 문자열(`carousel.truncatedWithCount`/`carousel.truncated`)은 정적 리터럴이며 `deepFreeze`로 런타임 변조 차단이 이미 적용돼 있다. CSS 선택자 추가(`.wc-carousel-truncated`)도 순수 스타일. 하드코딩된 시크릿(API 키/토큰/자격증명)은 diff 전체에서 발견되지 않음(grep 검증).
  - 제안: 없음.

- **[INFO]** `review/code/2026/07/12/{21_59_01,22_18_19}/**` 신규 리뷰 산출물(SUMMARY/RESOLUTION/*.md/*.json)은 이전 라운드의 분석 텍스트일 뿐 실행 코드가 아님
  - 위치: 파일 9~28 (review 산출물 diff)
  - 상세: 인젝션·인증·암호화 등 실질 보안 취약점 표면이 없다. 내용 검토 결과 시크릿/자격증명 유출도 없음.
  - 제안: 없음.

## 요약

이번 변경은 웹채팅 위젯의 carousel 잘림 배너 + 총 개수 노출을 table 과 대칭으로 확장하는 작은 UI/데이터-변환 기능이며, 인증/인가·DB 접근·외부 네트워크 호출·시크릿 관리 등 보안 민감 영역을 건드리지 않는다. 유일하게 눈여겨볼 지점인 AI 산출물 기반 `itemsTotalCount` 는 `asTotalCount` 헬퍼가 유한 비음수 정수만 통과시키는 엄격한 화이트리스트 검증을 적용하고, 렌더 경로도 React 표준 텍스트 노드(자동 이스케이프)를 사용해 XSS/정보유출 벡터가 없다. SQL/커맨드/경로 인젝션, 하드코딩 시크릿, 안전하지 않은 암호화, 민감정보 노출 에러 처리, 취약 의존성 도입 등 어떤 항목에서도 발견사항이 없다.

## 위험도

NONE
