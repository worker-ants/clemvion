# 보안(Security) Review — webchat-carousel-truncation

## 리뷰 대상
- `codebase/channel-web-chat/src/lib/i18n/catalog.ts` (carousel 잘림 배너 ko/en 문자열 추가)
- `codebase/channel-web-chat/src/lib/presentation.ts` (`CarouselData.truncated`/`totalCount` 추가, `toCarousel` 투영 로직)
- `codebase/channel-web-chat/src/lib/presentation.test.ts` (변환 테스트)
- `codebase/channel-web-chat/src/widget/components/presentations.tsx` (`CarouselView` 잘림 배너 렌더)
- `codebase/channel-web-chat/src/widget/components/presentations.test.tsx` (렌더 테스트)
- `plan/in-progress/webchat-widget-presentation-followups.md`, `spec/7-channel-web-chat/1-widget-app.md` (계약 문서화, 코드 아님)

### 발견사항

- **[INFO]** 신뢰 못 할 `totalCount` 입력에 대한 방어적 검증 — 긍정적 관찰
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `toCarousel()` (약 686-698행)
  - 상세: `output.itemsTotalCount` 는 backend/AI 가 채우는 신뢰 경계 밖 데이터다. 코드가
    `typeof rawTotal === "number" && Number.isFinite(rawTotal) && rawTotal >= 0` 로 좁혀
    문자열·`NaN`·`Infinity`·음수를 모두 `undefined` 로 떨어뜨린 뒤에만 렌더 배너에 노출한다.
    이는 "총 NaN개 중 일부만 표시돼요." 같은 신뢰 못 할 값의 UI 유출을 막는 적절한 입력 검증이며,
    기존 `toTable` 의 동일 패턴과 대칭을 이뤄 새 공격면을 추가하지 않는다. 취약점 아님 — 모범 사례로 기록.
  - 제안: 없음(유지).

- **[INFO]** 배너 텍스트는 JSX 텍스트 노드로만 렌더 — XSS 벡터 없음
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` `CarouselView` (잘림 배너 블록, 1766-1772행)
  - 상세: `t("carousel.truncatedWithCount", { count: totalCount })` 결과는 `<div>{...}</div>` 로 일반
    텍스트 렌더되며 `dangerouslySetInnerHTML` 을 쓰지 않는다(그 API 는 같은 파일의 `TemplateView` 에서만 쓰이고
    DOMPurify sanitize 를 거친다 — 이번 diff 범위 밖, 변경 없음). `count` 파라미터도 위에서 검증된 `number`
    타입만 허용되므로 React 의 기본 이스케이핑과 이중으로 안전하다. i18n 보간 함수(`makeTranslate`,
    `src/lib/i18n/context.tsx`)도 `String.replace` 기반 템플릿 치환이며 HTML 파싱을 하지 않는다.
  - 제안: 없음.

- **[INFO]** 정적 문자열 카탈로그 추가 — 시크릿·PII 없음
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts` (`carousel.truncatedWithCount`/`carousel.truncated` ko/en 4줄 추가)
  - 상세: 순수 UI 문자열(하드코딩된 시크릿·토큰·엔드포인트 없음). `deepFreeze` 로 런타임 변조도 이미 차단.
  - 제안: 없음.

이번 diff 는 (1) 순수 정적 문자열 카탈로그 확장, (2) 이미 검증된 `toTable` 패턴을 `toCarousel` 에 대칭 적용한
안전한 숫자 검증 로직, (3) 검증된 값만 plain-text JSX 로 렌더하는 배너 UI, (4) 테스트/plan/spec 문서 갱신으로
구성된다. 인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가, 암호화, 에러 처리, 의존성 관련 신규
위험은 발견되지 않았다. `isSafeUrl`(javascript:/data:/vbscript:/blob:/file: 스킴 차단) 등 기존 XSS 방어 로직도
이번 diff 로 변경되지 않았으며 그대로 유지된다.

### 요약
이번 변경은 카루셀 잘림 배너에 총 개수를 노출하는 순수 프레젠테이션 기능 확장으로, 신뢰 못 할 backend/AI
숫자 입력을 `Number.isFinite && >= 0` 가드로 검증한 뒤 plain-text JSX 로만 렌더한다. 새로운 인젝션·인증·시크릿·
암호화·에러노출 취약점은 발견되지 않았으며, 기존 `toTable` 대칭 패턴을 재사용해 공격면이 늘지 않았다. 보안
관점에서 이 변경은 안전하다.

### 위험도
NONE
