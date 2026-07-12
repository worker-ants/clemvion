# 보안(Security) 코드 리뷰

대상: channel-web-chat 위젯 chrome 문자열 EN i18n(locale 활성) — `.claude/config/doc-sync-matrix.json`, `PROJECT.md`,
`codebase/channel-web-chat/src/lib/i18n/**`(신규), 5개 위젯 컴포넌트(`composer`/`dynamic-form`/`launcher`/`panel`/`presentations`)
의 하드코딩 문자열 → `t()` 치환, `use-widget.ts` GENERIC_ERROR_MESSAGE 소스 변경, 관련 테스트, `plan/**` 신규 plan/consistency
산출물, `spec/**` 문서(0-overview·7-channel-web-chat/{1-widget-app,2-sdk,4-security,5-admin-console,_product-overview}·
conventions/i18n-userguide) 개정.

## 발견사항

전 범위를 8개 관점(인젝션·하드코딩 시크릿·인증/인가·입력 검증·OWASP Top 10·암호화·에러 처리·의존성)으로 점검했다.
**CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.** 코드 변경 실질은 (a) 정적 ko/en 문자열 카탈로그 신설, (b) 컴포넌트의
하드코딩 한국어 문자열을 `t(key, params?)` 호출로 치환, (c) locale 해석 함수 신설 — 신뢰 경계·인증·저장소·네트워크 호출을
건드리지 않는 순수 프레젠테이션 리팩터다. 아래는 INFO 수준 관찰이다.

- **[INFO] i18n 보간 결과는 항상 JSX 텍스트/속성 경로로만 소비 — XSS 벡터 없음**
  - 위치: `codebase/channel-web-chat/src/lib/i18n/context.tsx` `makeTranslate()` (정규식 `/\{\{(\w+)\}\}/g` 로 `{{name}}` 치환),
    소비처 전부(`composer.tsx`/`panel.tsx`/`launcher.tsx`/`presentations.tsx`/`dynamic-form.tsx`)
  - 상세: `t()` 반환값은 모두 `{t(...)}` JSX 텍스트 노드 또는 `aria-label={t(...)}` 속성으로만 렌더된다. React 는 텍스트
    노드·속성 값을 자동 이스케이프하므로, params(`count`/`type`/`label`)가 어떤 문자열이어도 HTML/스크립트로 해석되지
    않는다. `dangerouslySetInnerHTML` 사용처는 없음(기존 AI 콘텐츠 렌더 전용 `renderTemplateHtml`/`@/lib/safe-html` 은 이
    diff 밖이며 `presentations.tsx` 는 그것을 import 만 하고 이번 변경에서 로직 변경 없음). 보간 파라미터(`unread`,
    `totalCount`, chart `type`)도 모두 내부 상태/고정 문자열에서 유래해 사용자 원문 그대로가 아니다.
  - 제안: 조치 불필요. 향후 `t()` 결과를 `dangerouslySetInnerHTML` 등 raw-HTML 경로에 사용하는 변경이 생기면 그 시점에
    이스케이프 재검토 필요(현재는 해당 없음).

- **[INFO] `resolveLocale()` 의 화이트리스트 검증이 위젯 카탈로그 키 접근을 안전하게 제한**
  - 위치: `codebase/channel-web-chat/src/lib/i18n/resolve-locale.ts:9-14`
  - 상세: `explicit`(호스트 postMessage `BootConfig.locale`, 외부/embed 페이지가 제공하는 신뢰되지 않은 입력)은
    `explicit === "ko" || explicit === "en"` 등가 비교로만 통과되고, 그 외 임의 값은 무시되어 `navigator.language`
    auto-detect 또는 `ko` fallback 으로 흡수된다. 결과 `Locale` 타입은 TypeScript 상으로도 `'ko'|'en'` 로 좁혀져
    `WIDGET_STRINGS[locale]` 객체 인덱싱이 임의 키로 확장될 수 없다(prototype-pollution/임의 속성 접근 불가). `navigator.language`
    정규식(`/^en([-_]|$)/i`)도 고정 패턴 + bounded 입력이라 ReDoS 위험이 없다.
  - 제안: 조치 불필요. 좋은 입력 검증 패턴으로, 다른 신규 enum형 boot config 필드에도 동일 화이트리스트 비교 패턴을
    재사용할 것을 권고(참고용).

- **[INFO] 에러 메시지 일반화(민감정보 비노출) 기존 보안 설계가 리팩터 후에도 유지됨**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `GENERIC_ERROR_MESSAGE` 가 하드코딩 리터럴에서
    `WIDGET_STRINGS.ko["error.generic"]` 참조로 변경. `panel.tsx` 는 렌더 시 `t("error.generic")` 로 로케일 지역화.
  - 상세: `spec/7-channel-web-chat/4-security.md` "에러 메시지 노출" 행이 명시하는 "서버/예외 원문을 UI 에 비노출,
    일반화 문구만 표시, 진단 원문은 console 로만" 불변식이 이번 리팩터로 깨지지 않았음을 코드 대조로 확인했다.
    `errMessage(e)` 는 여전히 진단 원문을 console 전용으로 두고(diff 범위 밖, 미변경), UI 노출 값은 항상 catalog 의
    `error.generic` 고정 문구다 — 에러 원문이 EN/KO 전환 로직에 섞여 우회 노출되는 경로는 없다.
  - 제안: 조치 불필요. 확인 목적의 기록.

- **[INFO] `catalog.ts`/plan/spec 문서에 시크릿·자격증명 없음**
  - 위치: 전체 diff(신규 `catalog.ts`, 테스트, `plan/in-progress/spec-draft-webchat-en-i18n.md`, `spec/**` 문서,
    `review/consistency/**` 산출물, `.claude/config/doc-sync-matrix.json`)
  - 상세: 하드코딩 API 키/토큰/비밀번호/인증서 패턴 검색 결과 없음. 테스트의 `apiBase: "https://api.example.com"` 은
    RFC 2606 예약 도메인의 placeholder 이며 실 자격증명이 아니다.
  - 제안: 조치 불필요.

## 요약

이번 변경 셋은 channel-web-chat 위젯의 하드코딩 한국어 chrome 문자열을 ko/en 로컬 i18n 카탈로그로 옮기는 순수
프레젠테이션 계층 리팩터와, 그에 수반하는 문서(`doc-sync-matrix.json`/`PROJECT.md`/`spec/**`)·plan/consistency-review
산출물 동기화로 구성된다. 신뢰 경계(호스트 postMessage 입력)를 넘나드는 유일한 신규 입력값(`BootConfig.locale`)은
`resolveLocale()` 이 엄격한 등가 화이트리스트로 검증해 임의 키 접근·인젝션 여지를 차단하며, 번역 결과는 전부 React의
자동 이스케이프 경로(JSX 텍스트/속성)로만 소비되어 XSS 벡터가 없다. 기존에 확립된 "에러 원문 비노출" 보안 설계도
카탈로그 참조로 옮겨졌을 뿐 실질적으로 그대로 유지된다. 시크릿 하드코딩, 인증/인가 변경, 암호화·전송 계층 변경, 신규
의존성 도입은 없다. 보안 관점에서 이 변경 셋을 차단할 사유는 없다.

## 위험도
NONE
