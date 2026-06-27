# Convention Compliance Review — `spec/7-channel-web-chat/` (--impl-done)

검토 범위: spec/7-channel-web-chat/ 전체 + diff(origin/main...HEAD, codebase/channel-web-chat/src/widget/components/)

---

## 발견사항

### **[WARNING]** 위젯 컴포넌트에 Korean aria-label 하드코딩 — 로케일 미적용

- **target 위치**: `codebase/channel-web-chat/src/widget/components/composer.tsx` (diff 추가분)
  - 기존 라인: `aria-label="메시지 입력"`
  - 신규 추가 라인: `aria-label={loading ? "AI 응답 중" : "전송"}`
- **위반 규약**: `spec/conventions/i18n-userguide.md` Principle 1
  - "프론트엔드 컴포넌트(TSX / TS) 안의 사용자 가시 문자열은 반드시 dict 키 경유"
  - "❌ 금지: JSX attribute(`aria-label`, `alt` 등)에 한국어 문자열을 직접 박는 행위."
  - "모든 신규·변경 코드가 본 규약을 위반하지 않아야 한다."
- **상세**: `aria-label` 은 스크린 리더가 읽는 사용자 가시 문자열이다. `channel-web-chat/`은 `locale: 'ko' | 'en'` boot config를 지원하는 독립 SPA이므로, Korean-only aria-label은 `locale='en'` 환경에서 접근성 문자열이 한국어로 고정되는 문제가 있다. `hardcoded-korean-ratchet.test.ts` 자동 가드는 `codebase/frontend/`만 스캔하므로 빌드에서 자동 차단되지 않는다. 본 diff가 신규 Korean aria-label("AI 응답 중")을 추가하므로 위반이 확대된다.
  - 단, `spec/7-channel-web-chat/1-widget-app.md §2` 가 `aria-label="AI 응답 중"` 을 한국어 값으로 명시적으로 규정하고 있어 코드는 spec을 따른 것이다. 위반의 근본 원인은 spec이 locale 전략 없이 Korean 고정값을 규정했다는 점이다.
- **제안**:
  1. `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행에 "(v1 KO 고정, locale='en' 지원은 후속)" 부기.
  2. 중기적으로 위젯 내 간단한 `t(key)` 메커니즘을 두고 `locale` boot config와 연동해 aria-label 문자열을 locale-aware로 제공.

---

### **[INFO]** `spec/7-channel-web-chat/1-widget-app.md §2` — Korean aria-label 규정과 locale config 간 내부 불일치

- **target 위치**: `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 설명 중 `aria-label="AI 응답 중"` 명시
- **위반 규약**: `spec/conventions/i18n-userguide.md` Principle 1 (간접 — 본 규약이 요구하는 locale-aware 접근을 spec이 제공하지 않음)
- **상세**: 위젯 spec(`2-sdk.md §4 BootConfig`)은 `locale?: 'ko' | 'en'` 을 공개 계약 필드로 정의한다. 그러나 `1-widget-app.md §2`는 접근성 레이블로 Korean 고정값(`aria-label="AI 응답 중"`, `aria-label="전송"`)을 규정하면서, locale config와의 관계(v1 KO 고정 여부, 추후 locale-aware 전환 시점)에 대한 언급이 없다. 규약(`i18n-userguide Principle 1`)의 Spirit은 locale-specific 문자열이 하드코딩되지 않아야 한다는 것이므로, spec이 Korean 고정값을 단독으로 규정하면서 locale 전략을 침묵하는 것은 정식 규약과 거리감이 있는 표현이다.
- **제안**: `1-widget-app.md §2` 입력창 행에 locale 처리 전략(예: "v1 KO 고정. locale-aware aria-label은 §R-locale 후속")을 짧게 추가하거나, `2-sdk.md §4` BootConfig `locale` 필드 설명에 v1 적용 범위(UI 텍스트 한정, 접근성 레이블 미지원)를 명시.

---

## 이슈 없음 항목 (확인 완료)

- **명명 규약**: 파일명(`0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md`, `5-admin-console.md`, `_product-overview.md`), frontmatter `id` 모두 kebab-case 준수. CSS class `wc-composer-spinner` / `wc-composer-send` 는 기존 `wc:` namespace prefix와 일관.
- **frontmatter 스키마** (`spec-impl-evidence.md §2`): 6개 본문 spec 파일 모두 `id`/`status`/`code`/`pending_plans` 필드 보유. `status: partial` 파일들은 `pending_plans` 의무 충족. `status: implemented`(`5-admin-console.md`) 는 `pending_plans` 없음 — 규약 정합. `_product-overview.md` 는 `_` prefix 면제 대상.
- **문서 3섹션 구조** (`CLAUDE.md`): 모든 spec 파일에 `## Rationale` 섹션 존재. `5-admin-console.md` 는 `## Overview (제품 정의)` + 본문 + Rationale 3섹션 완비. 나머지 파일은 Overview 별도 헤더 없이 본문 첫 섹션이 개요 역할 — "권장" 수준이므로 허용.
- **API 문서 규약** (`swagger.md`): diff가 건드리는 코드(`channel-web-chat/src/widget/`)는 backend NestJS Controller/DTO가 아니므로 Swagger 데코레이터 규약 적용 범위 밖. spec에서 언급되는 `EmbedConfigDto`, `WebChatAppearanceDto` 등 backend DTO는 이번 diff 범위 외.
- **에러 코드 규약** (`error-codes.md`): diff에 새 에러 코드 도입 없음.
- **금지 패턴** (`interaction-type-registry.md`): 위젯 spec이 참조하는 `ai_conversation`/`buttons`/`form` EIA 외부 3값은 동 규약에 등록된 값과 일치. 신규 `WaitingInteractionType` 값 미추가.
- **`5-admin-console.md §8` i18n 안내**: `codebase/frontend/` 신규 메뉴·페이지 문자열에 대해 ko/en dict 양쪽 갱신 의무를 올바르게 규약 참조(`i18n-userguide Principle 1·2`)함. admin console측 frontend 문자열은 이 경로로 보호됨.
- **postMessage 타입 namespace**: `wc:boot`, `wc:command`, `wc:ready`, `wc:resize`, `wc:event` 모두 `wc:` prefix — 타 채널 메시지와 충돌 방지 의도에 맞게 일관 적용.

---

## 요약

`spec/7-channel-web-chat/` 영역의 정식 규약 준수 수준은 전반적으로 양호하다. frontmatter 스키마, 문서 3섹션 구조, 명명 규약, 금지 패턴 모두 준수한다. 단, 이번 diff에서 위젯 `composer.tsx`에 Korean aria-label 문자열을 추가한 것이 `i18n-userguide Principle 1`을 위반한다. 자동 가드가 `channel-web-chat/` 경로를 스캔하지 않아 빌드 차단은 발생하지 않지만, 규약의 명시적 금지(aria-label 하드코딩)에 해당한다. 이 위반의 근본 원인은 `1-widget-app.md §2`가 locale 전략 없이 Korean 고정값을 규정한 것이다. spec에 v1 KO 고정 사실과 locale-aware 전환 계획을 명기하는 것이 적절하다.

---

## 위험도

**LOW**

자동 가드 미차단, 실제 기능 동작에 영향 없음. 단 locale='en' 사용자에게 접근성 레이블이 한국어로 노출되는 사용성 결함이 잠재. 규약 자체를 갱신할 의도라면(widget은 자체 locale 메커니즘을 별도 두는 정책을 명시), WARNING이 아닌 INFO로 강등 가능.
