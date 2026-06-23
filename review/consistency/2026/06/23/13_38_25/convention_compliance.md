# Convention Compliance Review — `spec/7-channel-web-chat/`

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/7-channel-web-chat/, diff-base=origin/main)

---

## 발견사항

### [INFO] `5-admin-console.md` — `## Overview` 섹션 위치
- target 위치: `spec/7-channel-web-chat/5-admin-console.md` 의 `## Overview (제품 정의)` 섹션
- 위반 규약: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장
- 상세: `5-admin-console.md` 는 문서 내부에 `## Overview (제품 정의)` 섹션을 두고 있다. 다른 영역 파일(`0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md`)은 Overview 섹션 없이 introductory blockquote + 구분선 + 본문으로 시작하는 패턴을 따른다. `5-admin-console.md` 만 `## Overview` 헤딩을 가지며 이는 동일 영역 내에서 스타일이 불일치하다. 그러나 CLAUDE.md는 이 3섹션 구조를 "권장"으로만 명시하고 있어 규약 위반이라기보다는 일관성 차이다.
- 제안: 다른 파일들과 마찬가지로 `## Overview` 헤딩을 제거하고 blockquote + 구분선 패턴으로 통일하거나, 반대로 전 파일에 `## Overview` 섹션을 추가하는 방향으로 일관성을 맞춘다.

### [INFO] `_product-overview.md` — `## Rationale` 내 소제목 패턴 불일치
- target 위치: `spec/7-channel-web-chat/_product-overview.md` 의 `## Rationale` 섹션 소제목들
- 위반 규약: CLAUDE.md "문서 구조 규약" — Rationale 섹션 소제목이 다른 spec 파일(예: `R1.`, `R2.` 또는 `### R1. ...` 패턴)과 달리 `### 제품 영역 분리 (vs 5-system 흡수)` 형태로 식별자 없이 서술형으로만 작성되어 있다.
- 상세: 다른 `7-channel-web-chat/` 파일들은 모두 `### R1.`, `### R2.` 등 인덱스 식별자를 Rationale 소제목에 사용한다. `_product-overview.md` 는 `_` prefix 파일이어서 `spec-impl-evidence.md §1` 가드에서 제외되므로 frontmatter 의무는 없지만, 동일 영역의 Rationale 스타일 일관성은 별개다.
- 제안: `_product-overview.md` 의 Rationale 소제목에 `### R1. ...`, `### R2. ...` 형태 식별자를 추가해 동일 영역 패턴을 따른다. (필수 아님 — INFO 수준)

### [INFO] `spec/7-channel-web-chat/` frontmatter `status: partial` + `pending_plans` 포함 여부
- target 위치: `spec/7-channel-web-chat/` 아래 6개 파일(0~5) 각각의 frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 이면 `pending_plans:` 의무
- 상세: 검토 대상 모든 파일(`0-architecture.md` ~ `5-admin-console.md`)이 `status: partial` 이고 모두 `pending_plans:` 를 포함하고 있다. 규약 충족으로 확인됨 — 기록 목적의 PASS 항목.
- 제안: 없음.

### [INFO] `5-admin-console.md` i18n dict 키 경로 명시 방식
- target 위치: `spec/7-channel-web-chat/5-admin-console.md §8` i18n 섹션
- 위반 규약: `spec/conventions/i18n-userguide.md Principle 1·2`
- 상세: `§8` 는 신규 dict 파일 경로를 `lib/i18n/dict/{ko,en}/web-chat.ts` 로 명시하고 있다. 이는 `spec/conventions/i18n-userguide.md Principle 2` 의 ko/en 사전 parity 요건과 일치한다. 구현 diff에서도 i18n 추가에 대한 명시적 코드는 보이지 않는다 — i18n 파일 자체는 diff 에 미포함이나 spec 은 올바르게 명시하고 있다. 실제 dict 파일 존재 여부는 별도 확인 필요이나 규약 명시 측면에서는 이상 없다.
- 제안: 구현 완료 후 `lib/i18n/dict/{ko,en}/web-chat.ts` 와 `sidebar.ts` 의 `sidebar.webChat` 키가 실제로 양쪽(ko/en) 모두 추가됐는지 확인한다 (`i18n.test.ts` 가드가 자동 검증).

### [INFO] `spec/7-channel-web-chat/` 소속 파일 `id:` 와 파일 basename 일치
- target 위치: 각 파일 frontmatter `id:` 필드
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `id:` 는 파일 basename(확장자 제외) 기반 권장
- 상세: `0-architecture.md` → `id: web-chat-architecture`, `1-widget-app.md` → `id: web-chat-widget-app`, `2-sdk.md` → `id: web-chat-sdk`, `3-auth-session.md` → `id: web-chat-auth-session`, `4-security.md` → `id: web-chat-security`, `5-admin-console.md` → `id: web-chat-admin-console`. 모든 파일이 basename 이 아닌 prefix 포함 형태를 사용한다. `spec-impl-evidence.md §2.1` 은 "파일 basename 기반 **권장**"이고 "같은 basename 이 영역을 달리해 중복될 때 prefix 로 충돌 회피" 예를 명시한다. 이 영역의 basename(`0-architecture`, `1-widget-app` 등)은 타 영역과 충돌 가능성이 있으므로 prefix 사용은 의도된 패턴으로 판단된다 — 규약 위반 아님. 확인 목적의 기록.
- 제안: 없음. 의도된 패턴으로 수용.

---

## 요약

`spec/7-channel-web-chat/` 영역의 6개 spec 파일과 `_product-overview.md` 는 전반적으로 정식 규약을 잘 준수하고 있다. 모든 파일에 `id`/`status`/`code`/`pending_plans` frontmatter 가 올바르게 작성되어 `spec-impl-evidence.md` 가드 요건을 충족한다. i18n 규약 참조(`5-admin-console §8`)도 Principle 1·2 와 일치하는 방식으로 명시되었다. 발견된 사항은 모두 INFO 등급이며, `5-admin-console.md` 의 `## Overview` 헤딩이 동일 영역 내 다른 파일 스타일과 불일치하는 점과 `_product-overview.md` Rationale 소제목에 식별자가 없다는 경미한 일관성 차이만 존재한다. CRITICAL 또는 WARNING 수준의 규약 위반은 없다.

## 위험도

NONE

STATUS: OK
