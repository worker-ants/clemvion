# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/7-channel-web-chat/`
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] `_product-overview.md` 에 frontmatter 없음 — 면제 대상이므로 정상

- target 위치: `spec/7-channel-web-chat/_product-overview.md` 첫 줄 (frontmatter 없음)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` 면제 목록
- 상세: `_product-overview.md` 는 basename 이 `_` prefix 이므로 `spec-frontmatter.test.ts` 가드 면제 대상이다(`spec/<영역>/_*.md`). frontmatter 없는 것은 규약과 정합. 다만 확인 차 기록.
- 제안: 현행 유지. 면제 처리 이미 올바름.

---

### [INFO] `id` 필드가 basename-exact 가 아닌 `web-chat-<basename>` 패턴 — 의도된 충돌 방지

- target 위치: `spec/7-channel-web-chat/*.md` 전체 frontmatter `id:` 필드 (예: `0-architecture.md` → `id: web-chat-architecture`, `1-widget-app.md` → `id: web-chat-widget-app`)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename 기반 권장"
- 상세: 규약은 "basename 기반 **권장**" 이며, "같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다" 는 명시적 예외 패턴이 있다. `7-channel-web-chat` 의 모든 spec 은 `web-chat-` prefix 를 일관되게 붙여 전역 유일성을 확보했다. `4-security.md` 의 `id: web-chat-security` 는 YAML 인라인 주석(`# basename …`)으로 의도를 명문화했고 YAML 파서가 `web-chat-security` 값만 추출함을 확인. 규약 위반이 아니라 허용 예외 패턴 적용이다.
- 제안: 현행 유지. 모든 파일이 `web-chat-<basename-without-numeric-prefix>` 패턴으로 일관되어 있어 전역 id 충돌 위험 없음.

---

### [INFO] `0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md` 에 `## Overview` 섹션 없음

- target 위치: `spec/7-channel-web-chat/0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md` 의 최상위 섹션 구조
- 위반 규약: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장
- 상세: `4-security.md` 와 `5-admin-console.md` 는 `## Overview` 를 갖추었으나 나머지 4개 파일은 없다. CLAUDE.md 는 "Overview / 본문 / Rationale 3섹션 권장" 이라 표기했으며 의무 사항이 아니다. 해당 4개 문서는 `>` blockquote 형식으로 영역 개요 진입 링크를 두거나(`_product-overview.md` 참조 유도), 곧바로 `## 1.` 섹션 본문으로 시작한다. Rationale 섹션은 전 파일에 존재해 필수 구성요소인 근거 문서화는 완비됨.
- 제안: 규약이 "권장"이므로 차단 사항 아님. 다만 향후 문서 갱신 시 `## Overview` 섹션(제품 정의·목적)을 추가하면 4-security·5-admin-console 과 일관성이 높아진다. 현 상태는 임베드형이라 `_product-overview.md` 로 위임하는 구조로 볼 수도 있어 수용 가능.

---

### [INFO] `4-security.md` frontmatter `id` 필드에 YAML 인라인 주석 사용

- target 위치: `spec/7-channel-web-chat/4-security.md` 프론트매터 1행 `id: web-chat-security  # basename …`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2` — frontmatter 스키마
- 상세: YAML 1.1/1.2 에서 인라인 `#` 주석은 유효하며 파서가 `web-chat-security` 만 추출한다(파이썬 `yaml.safe_load` 검증 완료). 기능적 문제는 없으나 다른 파일의 frontmatter 에는 인라인 주석이 없다. 해당 코멘트는 basename 불일치의 의도를 명문화하는 유용한 설명이며, 규약이 인라인 주석을 금지하지 않는다.
- 제안: 현행 유지. 다만 spec-frontmatter 파서가 future 에 주석을 포함한 id 값을 오인식하지 않도록 유의.

---

### [INFO] `_product-overview.md` 에 `## Overview` 없이 내용 직접 시작

- target 위치: `spec/7-channel-web-chat/_product-overview.md` 구조
- 위반 규약: CLAUDE.md "제품 정의·요구사항 — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"
- 상세: `_product-overview.md` 는 `## 1. 개요 / 문제` 로 바로 시작한다. `## Overview` 섹션을 두지 않고 번호 있는 섹션(`## 1.`, `## 2.`, ...)으로 구성됐다. CLAUDE.md 에는 `_product-overview.md` 또는 진입 문서의 `## Overview` 로 제품 정의를 담으라 했으므로 `_product-overview.md` 자체가 진입 문서 역할을 하며 `## 1. 개요 / 문제` 가 사실상 Overview 역할을 한다. 정식 규약 위반은 아니다.
- 제안: 현행 수용. 다만 CLAUDE.md 의 "진입 문서의 `## Overview`" 와 일치시키려면 첫 섹션명을 `## Overview` 로 변경하는 것도 고려 가능. 차단 사항 아님.

---

## 요약

`spec/7-channel-web-chat/` 의 전체 6개 spec 파일은 정식 규약(`spec/conventions/`) 을 전반적으로 잘 준수하고 있다. frontmatter 의무 필드(`id`, `status`, `code:`)가 전 파일에 존재하고 올바른 형식이며, `status: implemented` 와 `code:` glob 경로는 일관성 있게 기록됐다. `id` 필드가 `web-chat-<basename>` 패턴으로 basename-exact 에서 벗어나지만 이는 규약이 명시 허용한 전역 충돌 방지 패턴이다. `## Overview` / `## Rationale` 3섹션 권장 구조에서 일부 파일(`0-architecture`, `1-widget-app`, `2-sdk`, `3-auth-session`)이 `## Overview` 섹션을 갖추지 않았으나 규약이 "권장" 사항이므로 차단 대상이 아니다. API 문서 규약(Swagger/DTO 패턴), 에러 코드 명명, 감사 액션 명명 등은 본 spec 영역이 클라이언트 SDK·위젯이라 직접 적용 대상이 아니다. 전체적으로 구현 착수를 블로킹할 Critical 또는 Warning 발견사항이 없다.

## 위험도

NONE
