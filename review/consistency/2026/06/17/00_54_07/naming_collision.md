# 신규 식별자 충돌 검토

## 검토 범위

- **Target spec**: `spec/7-channel-web-chat/4-security.md` (git diff origin/main)
- **구현 변경**: `codebase/backend/src/modules/auth/totp.service.ts`, `package.json` (otplib ^12→^13), `codebase/channel-web-chat/package-lock.json` (node >=24, @vitejs/plugin-react ^6, jsdom ^29)

---

## 발견사항

### INFO: §1.1 섹션 앵커 신규 도입 — 동일 spec 파일 내 번호 충돌 없음

- **target 신규 식별자**: `### 1.1 마크다운/HTML sanitize 정책 매트릭스` (섹션 앵커 `#11-마크다운html-sanitize-정책-매트릭스`)
- **기존 사용처**: `spec/7-channel-web-chat/4-security.md` 의 기존 구조는 `## 1. 보안 정책 요약` 바로 아래 `## 2. CORS ...` 로 점프해 `§1.x` 하위 섹션이 없었음. 새 `### 1.1` 은 신규 추가이므로 번호 충돌 없음.
- **상세**: `ALLOWED_TAGS`, `ALLOWED_ATTR`, `ALLOWED_URI_REGEXP`, `afterSanitizeAttributes` 는 DOMPurify 라이브러리 자체의 공개 API 상수/훅 이름이므로 spec 식별자로서 신규 도입이 아니다. 기존 `spec/3-workflow-editor/3-execution.md:539` 에서 `DOMPurify sanitize` 언급이 있으나 이는 Chart 렌더러의 별개 컨텍스트이고, `4-security.md §1.1` 이 위젯·메인 앱 두 렌더러를 처음으로 비교 정리한 것이다 — 동일 이름이 다른 의미로 쓰이는 충돌이 아닌 보완 관계.
- **제안**: 없음. `spec/3-workflow-editor/3-execution.md §Chart` 의 DOMPurify 언급과 교차 참조 링크를 향후 추가하면 좋으나 필수 아님.

### INFO: `ALLOWED_URI_REGEXP` — 기존 `3-execution.md` Chart 렌더러와 용어 공유, 의미 충돌 없음

- **target 신규 식별자**: `ALLOWED_URI_REGEXP` (DOMPurify 설정 키, `4-security.md §1.1`)
- **기존 사용처**: `spec/3-workflow-editor/3-execution.md:539` 에서 Chart 를 `DOMPurify sanitize 적용` 으로만 기술(세부 설정 키 미명시). `4-security.md §1.1` 이 처음으로 DOMPurify 설정 키를 명시적으로 열거한 곳이지만, 이는 위젯 SPA 한정이며 Chart 렌더러(메인 앱 내)와는 코드 경계가 다름.
- **상세**: 두 장소 모두 동일 의미(DOMPurify URL scheme 허용 정규식)로 사용하므로 의미 충돌 없음. Chart 렌더러의 DOMPurify 설정이 `4-security.md §1.1` 의 표에 포함되지 않는 점(메인 앱 Chart 는 표 2행의 `react-markdown` 행과 별개)은 누락이지만 충돌은 아님.
- **제안**: 없음(누락은 별도 gap 이슈).

### INFO: `WEB_CHAT_WIDGET_ORIGINS` ENV var — 기존 정의와 일치, 신규 충돌 없음

- **target 신규 식별자**: `WEB_CHAT_WIDGET_ORIGINS` (env var, `spec/7-channel-web-chat/4-security.md §2.1`)
- **기존 사용처**: 동일 env 키가 이미 `spec/7-channel-web-chat/4-security.md §2.1` + `spec/7-channel-web-chat/0-architecture.md §4` 에 문서화돼 있고 `codebase/backend/.env.example:42~44`, `codebase/backend/src/common/cors/web-chat-cors.ts:109`, `codebase/backend/src/main.ts:36` 에서 동일 의미로 구현됨.
- **상세**: 이 PR 의 diff 는 `4-security.md` 를 수정하지만 `WEB_CHAT_WIDGET_ORIGINS` 키 자체는 이미 main 브랜치에 존재한다. 신규 도입이 아니므로 충돌 없음.
- **제안**: 없음.

### INFO: `EPOCH_TOLERANCE_SECONDS` 모듈-로컬 상수 — spec 식별자 비등재, 충돌 없음

- **target 신규 식별자**: `EPOCH_TOLERANCE_SECONDS = 30` (`codebase/backend/src/modules/auth/totp.service.ts:19`, 모듈 내부 상수)
- **기존 사용처**: spec 어디에도 등재되지 않은 구현-내부 상수. 기존 `spec/1-data-model.md:74` 는 `two_factor_secret`(otplib base32) 을 언급하지만 tolerance 값은 명시하지 않음.
- **상세**: 구현 내부 상수이므로 spec 식별자 충돌 대상이 아님. otplib v13 의 `epochTolerance` 옵션명(라이브러리 공개 API)과 혼동 여지도 없음 — 의미가 동일하고 내부 별칭.
- **제안**: 없음.

### INFO: otplib v13 신규 import 심볼 (`generateSecret`, `generateURI`, `verifySync`, `generateSync`) — 기존 `authenticator` 심볼 대체, spec 식별자 충돌 없음

- **target 신규 식별자**: `generateSecret`, `generateURI`, `verifySync` (otplib v13 named export, `totp.service.ts`); `generateSync` (test fixture, `totp.service.spec.ts`)
- **기존 사용처**: `codebase/backend/src/modules/auth/totp.service.ts` (origin/main) 에서 `import { authenticator } from 'otplib'` 으로 v12 API 사용 중. spec 에는 `spec/1-data-model.md:74` 의 `otplib base32` 언급만 있으며, API 심볼은 미등재.
- **상세**: 구현 코드 내부의 라이브러리 API 변경(v12→v13 major migration)이므로 spec 식별자 충돌 대상이 아님. spec `1-data-model.md` 의 `otplib base32` 표기는 라이브러리 버전 무관 추상 표현이며, v13 으로 업그레이드해도 그대로 유효.
- **제안**: 없음.

### INFO: `@otplib/plugin-base32-scure`, `@otplib/plugin-crypto-noble`, `@scure/base`, `@noble/hashes` 신규 패키지 — spec 미등재, 충돌 없음

- **target 신규 식별자**: `@otplib/plugin-base32-scure`, `@otplib/plugin-crypto-noble`, `@scure/base`, `@noble/hashes` (otplib v13 transitive deps, `package-lock.json`)
- **기존 사용처**: spec 어디에도 해당 패키지가 명시되지 않음. 기존 `@otplib/plugin-crypto`, `@otplib/plugin-thirty-two`, `@otplib/preset-default`, `@otplib/preset-v11`, `thirty-two` 는 v12 번들이었으며 제거됨.
- **상세**: 런타임 의존성 구현 세부이므로 spec 식별자 충돌 대상이 아님. `@otplib/plugin-crypto-noble` 내부의 `@noble/hashes` 가 `node >= 20.19.0` 엔진 요건을 선언하고 있고 이 PR 이 `engines.node >= 24` 를 추가했으므로 엔진 요건 일관성은 충족됨.
- **제안**: 없음.

---

## 요약

이번 변경에서 `spec/7-channel-web-chat/4-security.md` 에 신규 도입된 식별자(`§1.1` 섹션, `ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP`/`afterSanitizeAttributes` 등 DOMPurify 설정 키)는 기존 corpus 에 다른 의미로 중복 등재된 사례가 없으며, 구현 변경(`totp.service.ts` otplib v12→v13, package 업그레이드)에서 도입된 코드-레벨 심볼들은 spec 식별자에 해당하지 않아 충돌이 없다. 모든 발견 사항은 INFO 등급(참고 수준)이며, 차단이나 즉시 수정이 필요한 충돌은 발견되지 않았다.

---

## 위험도

NONE
