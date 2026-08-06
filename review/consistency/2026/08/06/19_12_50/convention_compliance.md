# 정식 규약 준수 검토 — spec/7-channel-web-chat

## 검토 방법 메모
prompt 에 번들된 `spec/conventions/**` 발췌본은 `audit-actions.md` + `cafe24-api-catalog/*` 4건뿐이었으나, target 문서(`spec/7-channel-web-chat/*.md`)는 audit/cafe24 를 전혀 언급하지 않고 대신 `conversation-thread.md`·`swagger.md`·`i18n-userguide.md`·`error-codes.md`·`interaction-type-registry.md`·`frontend-layering.md`·`spec-impl-evidence.md`·`data-hydration-surfaces.md` 를 수십 회 명시 참조한다(§발견사항 1). 이 gap 을 메우기 위해 워크트리 절대경로로 실제 `spec/conventions/*.md` 원본과 대응 코드(`codebase/channel-web-chat`·`codebase/backend/src/modules/hooks`·`codebase/frontend/src/lib/web-chat` 등)를 직접 Read/Grep 하여 대조했다.

## 발견사항

- **[WARNING] convention 번들 선정이 target 이 실제로 참조하는 규약을 누락**
  - target 위치: 전체 (`spec/7-channel-web-chat/*.md` 전 파일이 관련 규약을 프론트매터·본문에서 명시 링크)
  - 위반 규약: 없음(target 문서 자체 문제 아님) — orchestrator 의 convention bundling 단계
  - 상세: prompt `## 정식 규약 모음 (spec/conventions/)` 섹션에 포함된 파일은 `audit-actions.md`·`cafe24-api-catalog/_overview.md`·`cafe24-api-catalog/category.md`·`cafe24-api-catalog/store.md`·`cafe24-api-catalog/translation.md` 5건뿐이다. target 문서는 이들을 전혀 인용하지 않는다(`grep -in "audit\|cafe24" spec/7-channel-web-chat/*.md` = 0건). 반면 target 이 실제로 SoT 로 인용하는 `conversation-thread.md`(§9.3~9.5·§2.1)·`swagger.md`(§2-5·§5)·`i18n-userguide.md`(적용범위·Principle 1·2·6)·`interaction-type-registry.md`(§1.2)·`error-codes.md`·`spec-impl-evidence.md`(frontmatter 스키마)·`frontend-layering.md`·`data-hydration-surfaces.md` 는 번들에 전혀 없다. 이 checker 는 파일시스템 직접 접근으로 실제 원본을 대조해 검토를 완료했지만(아래 발견사항 참고), **파일시스템 접근이 없거나 번들만 신뢰하는 실행 경로**라면 이번 라운드는 사실상 무관한 규약(audit/cafe24) 만 대조하고 "위반 없음"으로 오판정했을 것이다 — 거짓 음성 위험.
  - 제안: convention bundling 로직이 target 문서의 frontmatter `code:`/본문 내 `../conventions/*.md` 링크를 파싱해 실제 참조되는 규약 파일을 우선 포함하도록 개선. (본 세션은 실제 규약을 직접 열람했으므로 아래 발견사항은 이 gap 과 무관하게 유효하다.)

- **[INFO] `web-chat-security` id 의 슬러그 충돌 방지 주석이 현재는 가상의 충돌을 전제**
  - target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter `id: web-chat-security # basename 4-security 와 의도적으로 다름 — 타 영역의 4-security 슬러그와 충돌 방지`
  - 위반 규약: 없음(오히려 `spec-impl-evidence.md §2.1` "같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다" 규칙을 정확히 따르는 모범 사례)
  - 상세: 현재 워크트리에는 `spec/7-channel-web-chat/4-security.md` 가 유일한 `4-security.md` 이며(`find spec -iname "4-security.md"` = 1건), 실제로 경합하는 다른 영역의 `4-security.md` 는 존재하지 않는다. 즉 주석이 서술하는 "충돌"은 현재 시점에 실재하지 않는 선제적 방어다.
  - 제안: 내용상 문제는 아니며 수정 불요 — 향후 다른 영역이 `4-security.md` 를 추가할 때 유효해지는 선제적 조치로 그대로 두어도 무방. 참고로만 기록.

## 상세 대조 결과 (위반 미검출 — 근거 명시)

아래 항목은 실제 `spec/conventions/*.md` 원본 및 대응 구현 코드를 워크트리 절대경로로 직접 열람해 target 과 대조한 결과, 위반을 발견하지 못했다.

1. **문서 구조 규약(Overview/본문/Rationale, `_product-overview.md`, `0-` prefix)**: `1-widget-app.md`·`2-sdk.md`·`3-auth-session.md`·`4-security.md`·`0-architecture.md`·`5-admin-console.md` 전부 `## Overview` → 번호 섹션 → `## Rationale` 3단 구성을 따른다. `_product-overview.md`(제품 정의, frontmatter 없음)·`0-architecture.md`(영역 진입, `0-` prefix)는 각각 `spec/2-navigation/_product-overview.md` 등 타 영역과 동일 패턴(`find spec -maxdepth 2 -name "_product-overview.md"` 5건, `find spec -maxdepth 2 -name "0-*.md"` 5건)이라 일관적이다. "## Overview" 헤딩(`(제품 정의)` 접미사 없이)도 `spec/5-system/4-execution-engine.md` 등 타 개별 기술 문서와 동일 패턴이라 이질적이지 않다.

2. **spec frontmatter 규약(`spec-impl-evidence.md`)**: 6개 파일 중 5개(`_product-overview.md` 제외)의 `id`/`status: implemented`/`code:` 를 스키마(§2)와 대조 — 모두 유효. `code:` glob 이 가리키는 경로(`codebase/channel-web-chat/**`, `codebase/packages/web-chat-sdk/**`, `codebase/channel-web-chat/src/widget/{host-bridge,use-widget,use-token-refresh}.ts`, `codebase/channel-web-chat/src/lib/{session-store,api-base,eia-client}.ts`, `codebase/backend/src/common/cors/web-chat-cors.ts`, `codebase/backend/src/modules/web-chat-cors/**`, `codebase/backend/src/modules/hooks/{public-webhook-throttle.guard,public-webhook-quota.service,embed-config.service}.ts`, `codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts`, `codebase/channel-web-chat/src/lib/safe-html.ts`, `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx`, `codebase/frontend/src/app/(main)/w/[slug]/web-chat/**`, `codebase/frontend/src/components/web-chat/**`, `codebase/frontend/src/lib/web-chat/**`)를 모두 실제 파일 존재로 확인(ls). `_product-overview.md` 는 `_*.md` 제외 규칙(§1)에 정확히 해당해 frontmatter 부재가 정당.

3. **API 문서 규약(swagger.md)**: `EmbedConfigDto`(`codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts`)는 §5-1 위치 규약(`dto/responses/*-response.dto.ts`) 정확 준수, 필드 JSDoc + `@ApiProperty(description/example)` 패턴 준수. 컨트롤러(`hooks.controller.ts`)가 `ApiOkWrappedResponse(EmbedConfigDto, …)` 공용 래퍼 헬퍼(§5-2)를 사용해 `{ data: {...} }` wrapping 규약과 정합 — target 4-security.md §3-① 의 "성공 응답은 `{ data }` 로 래핑" 서술과 실제 구현이 일치.

4. **conversation-thread.md 대조**: target `1-widget-app.md §2` 의 "1차 소스 = `waiting_for_input.conversationThread.turns` snapshot, `ai_message.messages[]` raw 노출 금지"는 §9.3·§9.4 와 정확히 일치. `[user-input]…[/user-input]` strip 언급은 §9.5 와 일치. **특히 conversation-thread.md line 468 은 "임베드형 채널 위젯은 §9.1/§9.2 의 5-source 세분 매핑을 따르지 않고 `presentation_user`·`ai_user`→user / `ai_assistant`·`ai_tool`·`system`→assistant 의 2-way 말풍선으로 의도적 축약 렌더한다(단 §9.3·§9.4·§9.5 는 그대로 강제)" 라는 명시적 스코프 예외를 두고 있고, 이는 target `1-widget-app.md §2` 메시지 리스트 행의 서술과 글자 그대로 대응한다** — 규약 문서 자체가 target 의 축약 렌더링을 승인한 상태.

5. **i18n-userguide.md scope 대조**: target `1-widget-app.md §4`·`2-sdk.md R6`·`5-admin-console.md §8` 의 "위젯 chrome = 위젯 로컬 catalog(ko/en parity) + 메인 앱 dict 기구 미적용, 운영 콘솔은 in-scope(메인 앱 dict 대상)" 서술은 `i18n-userguide.md` "적용 범위(Scope)" 절의 "부분 제외 — `codebase/channel-web-chat/**`… 위젯 chrome 문자열은 위젯 로컬 catalog + ko/en parity 대상(2026-07-12 EN 활성)… 운영 콘솔은 frontend 표면이므로 in-scope" 서술과 정확히 일치. 실제 구현도 `codebase/channel-web-chat/src/lib/i18n/{catalog,resolve-locale,context}.ts(+.test.ts)` 로 존재.

6. **interaction-type-registry.md 대조**: target `0-architecture.md §3` 의 "EIA 외부 `interactionType` ∈ `form`/`buttons`/`ai_conversation`(3값), `render_form` blocking 은 `ai_conversation` 으로 통합 노출"은 registry 문서의 "내부 4값(`form`/`buttons`/`ai_conversation`/`ai_form_render`) ↔ EIA 외부 3값 매핑, `ai_form_render`→`ai_conversation` 흡수" 서술과 일치.

7. **error-codes.md 대조**: target 이 사용하는 `WEBCHAT_IDLE_TIMEOUT`(3-auth-session.md·1-widget-app.md·R9)은 `<DOMAIN>_<CONDITION>` UPPER_SNAKE 명명 원칙(§1)에 부합하고, 실제 코드(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1114`, `webchat-idle-reaper.service.ts`)에도 동일 문자열로 존재.

8. **frontend-layering.md 대조**: 운영 콘솔 lib 파일(`codebase/frontend/src/lib/web-chat/*.ts`)에서 `@/components` import 없음 확인 — 레이어 역전 없음.

## 요약
target `spec/7-channel-web-chat/*.md` 6개 파일은 문서 구조(Overview/본문/Rationale), frontmatter(`id`/`status`/`code:`) 스키마, Swagger DTO·응답 wrapping 패턴, `conversation-thread`/`interaction-type-registry`/`i18n-userguide`/`error-codes`/`frontend-layering` 등 실제 `spec/conventions/**` 정식 규약과 대조했을 때 CRITICAL/WARNING 급 위반이 발견되지 않았다. 특히 위젯의 2-way 말풍선 축약 렌더·chrome 전용 i18n catalog·`ai_form_render`→`ai_conversation` 통합 노출 같은 target 고유 결정들은 대응 정식 규약 문서(`conversation-thread.md`·`i18n-userguide.md`·`interaction-type-registry.md`) 가 이미 명시적으로 이 예외/매핑을 승인·서술하고 있어 규약과 target 이 상호 정합함을 직접 확인했다. 유일한 지적 사항은 target 문서 자체가 아니라 이번 검토에 주어진 convention 번들이 target 이 실제로 참조하는 규약 파일들을 포함하지 않았다는 harness 단계의 gap(WARNING) 이며, 이는 파일시스템 직접 열람으로 우회·보완했다.

## 위험도
LOW
