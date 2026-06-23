# 정식 규약 준수 검토 결과

검토 대상: `spec/7-channel-web-chat/` (구현 완료 후, diff-base=origin/main)
검토 일시: 2026-06-24

---

## 발견사항

### INFO: `5-admin-console.md` frontmatter `id` 가 basename 기반이 아님 (의도된 일관 패턴)

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` frontmatter `id: web-chat-admin-console`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "`id`: 파일 basename 기반 권장"
- 상세: basename 은 `5-admin-console` 이지만 id 는 `web-chat-admin-console`. 그러나 `spec/7-channel-web-chat/` 전체 파일이 동일하게 `web-chat-<meaningful>` 패턴을 사용한다 (`0-architecture.md` → `web-chat-architecture`, `1-widget-app.md` → `web-chat-widget-app`, 등). 영역 내부 일관성은 유지되고, 규약이 "권장(recommended)"으로 명시해 위반이 아닌 영역 관례다. spec-impl-evidence §2.1 은 "중복 시 영역 prefix 로 회피" 를 허용하며, 여기서는 영역 prefix 방식이 전역 관례로 자리잡은 상태다.
- 제안: 현 상태 유지. 단 README 또는 규약에 "web-chat 영역은 `web-chat-<basename-core>` 패턴 사용" 을 INFO 주석으로 명시하면 향후 신규 파일 작성자의 혼선을 방지한다.

---

### INFO: `embed-config.dto.ts` 응답 DTO 파일명이 `*-response.dto.ts` 패턴 미준수

- target 위치: `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`
- 위반 규약: `spec/conventions/swagger.md §5-1` — "응답 DTO 위치: `dto/responses/*-response.dto.ts`"
- 상세: 파일이 `dto/responses/` 폴더에 위치해 경로 규약은 준수하지만, 파일명이 `embed-config-response.dto.ts` 가 아닌 `embed-config.dto.ts`. 단, 동일 패턴이 기존 코드(`auth/dto/responses/session.dto.ts`, `auth/dto/responses/login-history.dto.ts`)에서도 선행 존재한다 — 신규 위반이 아닌 기존 패턴 답습.
- 제안: 현 차기 리팩토링 시 `embed-config-response.dto.ts` 로 rename 고려. 기존 선행 파일들과 함께 일괄 교정. 본 PR 에서 단독 교정은 선행 파일과 불일치를 심화시킴.

---

### INFO: `ko/webChat.ts` 타입 애노테이션 미적용 (영역 관례)

- target 위치: `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts` 첫 줄
- 위반 규약: 해당 없음 (정식 규약 미규정 — 단 i18n-userguide.md §Principle 2 연관)
- 상세: `en/webChat.ts` 는 `export const webChat: Dict["webChat"] = { ... }` 타입 애노테이션을 포함하지만, `ko/webChat.ts` 에는 없음. 그러나 ko 사전 파일 전체(32개)에서 `Dict["..."]` 타입 애노테이션을 사용하는 파일이 0개이며, 이는 ko 가 "source type"(타입 정의 원본)이고 en 이 그 타입으로 conformance 를 선언하는 프로젝트 전반의 패턴이다. 규약 위반이 아닌 의도된 asymmetry.
- 제안: 현 상태 유지. 규약 문서에 이 asymmetry 를 명시하면 신규 locale 추가 시 혼선 방지 가능.

---

## 요약

`spec/7-channel-web-chat/` 영역 전체(0-architecture · 1-widget-app · 2-sdk · 3-auth-session · 4-security · 5-admin-console · _product-overview) 가 정식 규약의 핵심 요구사항을 충실히 준수한다.

- **frontmatter 스키마** (`spec-impl-evidence.md §2`): 모든 비면제 파일에 `id`·`status`·`code`·`pending_plans` 올바르게 선언됨. `_product-overview.md` 는 `_` prefix 면제 대상이라 frontmatter 불필요하며 정상.
- **status 라이프사이클** (`§3`): `5-admin-console.md` 가 `status: partial` + `pending_plans: plan/in-progress/web-chat-console.md` 조합으로 올바르게 선언. plan 파일 실존 확인됨.
- **문서 구조** (CLAUDE.md 규약): `5-admin-console.md` 에 `## Overview (제품 정의)` → 본문 §1~§8 → `## Rationale` 3섹션 권장 구조 준수. `_product-overview.md` 가 영역 index 역할 수행하며 모든 sibling spec 링크 포함(`spec-area-index.test.ts` 통과 가능).
- **i18n 규약** (`i18n-userguide.md §Principle 1·2`): `lib/i18n/dict/{ko,en}/webChat.ts` 양쪽 생성 및 `index.ts` 등록 완료. leaf key parity 확인됨(구조 동일). `lib/i18n/dict/{ko,en}/sidebar.ts` 에 `webChat` 키 양쪽 등록 확인됨 — `5-admin-console §8` 에 명시된 의무 이행.
- **Swagger/API 문서 규약** (`swagger.md §1·§2·§5`): `WebChatAppearanceDto` · `InteractionConfigDto` · `EmbedConfigDto` 모두 JSDoc + `@ApiPropertyOptional`/`@ApiProperty` 패턴 준수. `EmbedConfigDto` 응답 endpoint 에 `ApiOkWrappedResponse` 사용 — §5-3 준수.
- **출력 포맷 규약**: API 응답 봉투 `{ data }` 래핑(TransformInterceptor)이 `3-auth-session.md §3 step 2` 및 `swagger.md §2-5` 와 정합.
- **금지 항목**: 프론트엔드 신규 컴포넌트(`components/web-chat/`·`app/(main)/web-chat/`) 에서 사용자 가시 한국어 하드코딩 없음 — Principle 1 준수.
- **embed-config.dto.ts 파일명**은 기존 codebase 선행 패턴과 동일한 INFO 수준 불일치.

---

## 위험도

**NONE**

정식 규약 직접 위반(CRITICAL/WARNING) 항목 없음. 발견된 3건은 모두 INFO — 의도된 영역 관례이거나 기존 선행 패턴의 답습이다.
