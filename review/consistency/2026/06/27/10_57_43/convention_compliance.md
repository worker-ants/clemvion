# 정식 규약 준수 검토 — `spec/7-channel-web-chat/`

검토 모드: 구현 완료 후 (--impl-done, scope=spec/7-channel-web-chat/, diff-base=origin/main)

---

## 발견사항

- **[WARNING]** 5개 spec 파일에서 `## Overview` 섹션 헤더 누락
  - target 위치: `spec/7-channel-web-chat/0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md` — 최상위 섹션이 `## 1. 레이어 분리`, `## 1. Next.js CSR-only 구성` 등 numbered 본문으로 바로 시작
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장. `5-admin-console.md` 는 `## Overview (제품 정의)` 를 갖추어 정합 기준을 제공함
  - 상세: 각 파일에 `## Rationale` 은 있으나 `## Overview` 섹션이 없어 3섹션 권장 구조 중 1/3 이 누락된 상태. CLAUDE.md 는 "권장"으로 명시하므로 CRITICAL 은 아니나, 5개 파일에 일관되게 빠져 있어 규약과의 거리가 큼
  - 제안: 각 파일의 첫 numbered 섹션 앞에 `## Overview` 를 추가하고 해당 spec 문서의 범위·목적을 1–3문장으로 요약한다. 예: `0-architecture.md` 는 "위젯 SPA·SDK·Clemvion API 의 3-레이어 구조, iframe 격리, EIA 매핑, 배포 설정, 사용 모드(M1/M2)를 정의한다." 수준으로 충분

- **[INFO]** `id` 값이 영역 prefix 형태(`web-chat-*`)로 basename 에서 이탈
  - target 위치: `spec/7-channel-web-chat/` 내 모든 spec frontmatter `id:` 필드 (`web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`, `web-chat-admin-console`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename 기반 권장"
  - 상세: basename 기반이면 `0-architecture`·`1-widget-app` 등이 되어야 하나, 영역 prefix(`web-chat-`) 를 붙인 형태를 사용. `spec-impl-evidence.md §2.1` 은 "같은 basename 이 영역을 달리해 중복될 때 후발 문서가 영역 prefix 로 충돌을 회피한다" 예외를 인정하므로 규약 위반은 아님. 그러나 `architecture`, `security` 등이 다른 영역과 충돌하는지 명시적 근거가 없음
  - 제안: 현 id 값은 허용 범위 내이므로 즉시 변경 불요. 단 의도적 선택임을 인라인 주석 혹은 향후 spec 신규 작성 시 CLAUDE.md 에 패턴으로 문서화하면 충분

- **[INFO]** `_product-overview.md` 의 첫 섹션이 `## Overview` 가 아닌 `## 1. 개요 / 문제`
  - target 위치: `spec/7-channel-web-chat/_product-overview.md` — 섹션 `## 1. 개요 / 문제`
  - 위반 규약: CLAUDE.md "정보 저장 위치 — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"
  - 상세: `_product-overview.md` 는 CLAUDE.md 상 영역 진입 문서 역할을 하며 frontmatter 적용 제외(`_` prefix) 파일이다. 그러나 CLAUDE.md 의 "진입 문서의 `## Overview`" 권장은 이 파일에도 적용될 수 있다. 현재 섹션 `## 1. 개요 / 문제` 는 Overview 내용이지만 헤더 명칭이 다름. `## Rationale` 은 파일 끝에 있어 나머지 구성은 3섹션과 유사
  - 제안: `## 1. 개요 / 문제` → `## Overview` (또는 `## Overview (제품 정의 및 문제)`)로 헤더명 변경 검토. 규약과 일치하면 이후 reviewer 가 구조를 빠르게 파악 가능

---

## 요약

`spec/7-channel-web-chat/` 영역은 정식 규약 준수 관점에서 **대체로 양호**하다. frontmatter (`id`·`status`·`code`·`pending_plans`) 는 6개 spec 파일 모두 완비되어 있으며, `spec-impl-evidence.md` 의 lifecycle 규칙(`partial` → `pending_plans` 의무, `implemented` → `code` 경로 ≥1 매치)도 충족된다. `pending_plans` 참조 경로(`webchat-eager-start.md`, `channel-web-chat-impl.md`, `channel-web-chat-followups.md`)는 `plan/in-progress/` 에 실존한다. 코드 변경(`loader.ts` / `loader.spec.ts`)은 TypeScript naming convention(PascalCase 타입, Korean JSDoc)을 따르며 API 출력 포맷 규약과 무관한 내부 타입 추가·버그 수정이다. 주요 미준수는 `## Overview` 섹션 부재로, 5개 파일이 3섹션 권장 구조(`Overview / 본문 / Rationale`)를 갖추지 못한 채 numbered 본문으로 바로 시작한다. CRITICAL 위반은 없다.

---

## 위험도

LOW
