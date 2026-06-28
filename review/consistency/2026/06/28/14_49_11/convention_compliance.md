# Convention Compliance Review — spec/7-channel-web-chat/

검토 모드: impl-done (scope=spec/7-channel-web-chat/, diff-base=origin/main)
검토일: 2026-06-28

---

## 발견사항

### [INFO] `id` 필드가 basename 이 아닌 영역-prefix 형식인 이유 미기재 (일부 파일)

- **target 위치**: `spec/7-channel-web-chat/0-architecture.md` 의 frontmatter `id: web-chat-architecture`, `1-widget-app.md` `id: web-chat-widget-app`, `2-sdk.md` `id: web-chat-sdk`, `3-auth-session.md` `id: web-chat-auth-session`, `5-admin-console.md` `id: web-chat-admin-console`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "`id`는 파일 basename(확장자 제외) 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
- **상세**: 모든 파일의 `id` 에 `web-chat-` prefix 가 붙어 basename(`0-architecture`, `1-widget-app` 등)과 다르다. 규약상 basename 기반이 권장이고 prefix 는 충돌 회피 시 허용이므로, 위반은 아니지만 인라인 코멘트로 충돌 회피 이유를 명시하는 것이 좋다. `4-security.md` 는 frontmatter 내에 `# basename '4-security' 와 의도적으로 다름 — 타 영역의 '4-security' 슬러그와 충돌 방지` 주석이 있어 잘 처리되어 있다.
- **제안**: `0-architecture`, `1-widget-app`, `2-sdk`, `3-auth-session`, `5-admin-console` 의 frontmatter 에도 `4-security.md` 와 동일하게 영역 prefix 채택 이유를 인라인 주석으로 표시한다. 규약 위반은 아니므로 INFO.

---

### [INFO] `_product-overview.md` 에 frontmatter 없음 — 규약 면제 대상이지만 명시적 확인 필요

- **target 위치**: `spec/7-channel-web-chat/_product-overview.md` 최상단
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — `_*.md` (밑줄 prefix) 는 frontmatter 의무 **제외**(`EXCLUDE_BASENAMES` 또는 `spec/<영역>/_*.md`)
- **상세**: 파일은 `_product-overview.md` 로 밑줄 prefix이므로 frontmatter 가드 면제가 맞다. `## Overview` 섹션 없이 `## 1. 개요 / 문제` 로 시작한다. CLAUDE.md 는 `_product-overview.md` 또는 진입 문서의 `## Overview` 에 제품 정의를 두도록 규정하는데, 이 파일은 `## 1. 개요 / 문제` 로 시작해 `## Overview` 헤더가 없다. 그러나 이것은 product-overview 문서의 관습적 구성이며 가드 대상이 아니다.
- **제안**: 현행 유지. 명시적 위반 없음.

---

### [INFO] `_product-overview.md` 에 `## Rationale` 섹션 없음

- **target 위치**: `spec/7-channel-web-chat/_product-overview.md` 하단
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: CLAUDE.md 는 "각 SKILL.md 참고"라고 명시하며 3섹션은 "권장"이다. `_product-overview.md` 는 `## Rationale` 섹션을 가진다 (프롬프트 파일에서 확인). 실제로 파일을 보면 Rationale 이 있으므로 문제 없다. 혼동을 방지하기 위해 다른 spec 파일들의 Rationale 섹션을 확인한다: `0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md`, `5-admin-console.md` 모두 `## Rationale` 섹션을 보유하고 있어 3섹션 권장 구조를 준수한다.
- **제안**: 현행 유지. 위반 없음.

---

### [INFO] `4-security.md` `id` 주석 패턴이 다른 파일에는 없음 — 불일치이나 경미

- **target 위치**: `spec/7-channel-web-chat/4-security.md` frontmatter `id: web-chat-security  # basename...`
- **위반 규약**: 직접 위반 규약 없음
- **상세**: `4-security.md` 만 `id` 필드 뒤에 인라인 주석으로 이유를 기재한다. 다른 파일(`0-architecture`, `1-widget-app` 등)도 basename 과 다른 `id` 를 사용하나 이유 주석이 없다. 일관성 차이일 뿐 규약 위반은 아니다.
- **제안**: 다른 파일에도 `4-security.md` 방식으로 인라인 주석을 추가하면 유지보수성이 높아진다. 강제 요건은 아님.

---

### [INFO] `5-admin-console.md §8` 에서 i18n 규약 cross-reference 가 구체적이나 dict 파일 경로 패턴 확인

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §8 i18n`
- **위반 규약**: `spec/conventions/i18n-userguide.md Principle 1·2`
- **상세**: `5-admin-console.md §8` 은 i18n 규약을 참조하며 `lib/i18n/dict/{ko,en}/sidebar.ts` 와 `lib/i18n/dict/{ko,en}/webChat.ts` 에 키 추가를 명시한다. 이는 i18n-userguide Principle 2(ko/en 동반 의무)를 올바르게 반영한다. spec 자체의 규약 준수는 정상이다.
- **제안**: 현행 유지. 위반 없음.

---

## 요약

`spec/7-channel-web-chat/` 내 6개 문서(`_product-overview.md`, `0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md`, `5-admin-console.md`) 는 정식 규약(`spec/conventions/`) 과의 주요 정합성이 잘 유지되어 있다. 모든 `.md` 파일은 `spec-impl-evidence.md` 가 요구하는 frontmatter(`id`/`status`/`code:`) 를 보유하고 있으며, `_product-overview.md` 는 밑줄 prefix 로 면제 대상에 해당한다. `id` 필드에 영역 prefix(`web-chat-*`)를 사용하는 것은 규약 §2.1 의 충돌 회피 패턴과 일치하고, `4-security.md` 는 그 이유를 인라인 주석으로 명시하고 있다. 문서 3섹션 구조(Overview / 본문 / Rationale)가 전 파일에서 준수된다. CRITICAL 또는 WARNING 발견사항은 없으며, 발견된 사항은 모두 사소한 형식 일관성 제안(INFO)이다.

## 위험도

NONE
