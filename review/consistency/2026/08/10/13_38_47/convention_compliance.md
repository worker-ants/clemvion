# 정식 규약 준수 검토 — spec/7-channel-web-chat (impl-done)

검토 모드: `--impl-done`, scope=`spec/7-channel-web-chat`, diff-base=`origin/main`
target: `spec/7-channel-web-chat/{_product-overview,0-architecture,1-widget-app,2-sdk,3-auth-session,4-security,5-admin-console}.md`
대조 규약: `spec/conventions/**` (프롬프트 번들이 예산 초과로 대부분 절단되어, `swagger.md`·`i18n-userguide.md`·`conversation-thread.md`·`interaction-type-registry.md`·`error-codes.md`·`spec-impl-evidence.md` 는 워크트리에서 직접 Read 했다)

## 검토 방법

1. 번들된 6개 target 문서(`_product-overview`/`0-architecture`/`1-widget-app`/`2-sdk`/`3-auth-session`/`4-security`/`5-admin-console`) 전문을 `_prompts/convention_compliance.md` 에서 읽었다.
2. 번들이 예산 초과로 절단한 `spec/conventions/*` (특히 target 이 명시 참조하는 `swagger.md §2-5`·`conversation-thread.md §1.1/§1.3/§2.1/§9.x`·`i18n-userguide.md`·`interaction-type-registry.md §1.2`·`error-codes.md`) 를 워크트리 절대경로로 직접 Read 했다.
3. frontmatter (`id`/`status`/`code`/`pending_plans`) 의 `spec-impl-evidence.md` 준수 여부를 코드 경로 실존 확인으로 검증했다.
4. target 이 인용하는 DTO(`EmbedConfigDto`)·컨트롤러 데코레이터를 실제 코드에서 열어 `swagger.md` 패턴과 대조했다.
5. 위젯 chrome i18n 카탈로그(`codebase/channel-web-chat/src/lib/i18n/catalog.ts`)와 JSX 소스 내 하드코딩 한국어 여부를 grep 으로 확인했다.
6. `origin/main...HEAD` diff (`use-widget.ts`/`use-widget-eager-start.test.ts` 의 `StreamClaim` 리팩터)를 읽었다 — 명명 규약·출력 포맷 규약에 영향 없는 내부 함수 반환 타입 리팩터임을 확인.

## 발견사항

이번 검토에서 CRITICAL/WARNING 급 정식 규약 위반은 발견하지 못했다. 아래는 INFO 수준 관찰 1건뿐이다.

- **[INFO]** `4-security.md` frontmatter 의 `id` 충돌-회피 주석이 현재는 가상의 전제
  - target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter `id: web-chat-security  # basename 4-security 와 의도적으로 다름 — 타 영역의 4-security 슬러그와 충돌 방지`
  - 관련 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
  - 상세: 규약 §2.1 의 예시(`agent-memory`/`nav-agent-memory`)는 **실제로 같은 basename 을 가진 두 spec 파일이 존재할 때**의 회피 패턴이다. 현재 리포 전체에서 `4-security.md`·`0-architecture.md` 같은 basename 을 가진 다른 spec 파일은 없다(`find spec -name "4-security.md"` 결과 1건뿐, `id: security`/`id: architecture` 로 등록된 다른 문서도 없음). 즉 이 주석이 방지한다고 말하는 충돌은 현재 존재하지 않는 가상의 전제다. 다만 이 영역의 다른 5개 spec(`web-chat-architecture`/`web-chat-sdk`/`web-chat-widget-app`/`web-chat-auth-session`/`web-chat-admin-console`)도 모두 동일하게 `web-chat-` prefix 를 선제적으로 쓰고 있어, 영역 내부적으로는 일관된 선택이고 규약이 금지하는 패턴도 아니다(§2.1 은 "권장" 이지 강제가 아니며, prefix 선사용을 금지하지 않는다).
  - 제안: 위반이 아니므로 target 수정은 불필요. 다만 주석의 "충돌 방지" 표현이 실제 충돌 사례를 가리키는 것으로 오독될 수 있으므로, 굳이 다듬는다면 "영역 전체가 `web-chat-` prefix 로 통일하는 선제적 선택(현재 실제 충돌은 없음)" 식으로 명확히 해도 좋다 — 선택 사항.

## 세부 대조 결과 (위반 없음 확인 항목)

- **frontmatter/lifecycle (`spec-impl-evidence.md`)**: 6개 문서 모두 `id`(kebab-case, `web-chat-` prefix 일관)·`status`·`code:` 를 갖췄고, `status: partial` 인 `3-auth-session.md` 만 `pending_plans:` 를 명시(의무 충족) — 해당 plan(`plan/in-progress/webchat-reload-rest-error-branches.md`) 실존 확인. `code:` glob/명시 경로는 전부 워크트리에 실존(위젯 lib/widget 파일 7개, backend CORS/hooks 파일 7개, admin-console 3개 디렉토리 등 표본 확인). `_product-overview.md` 는 `_` prefix 로 frontmatter 의무 제외 대상(§1)이라 frontmatter 없음이 정상.
- **문서 구조**: `_product-overview.md` 는 다른 영역(`2-navigation`/`5-system` 등)의 `_product-overview.md` 와 동일하게 "## Overview" 헤더 대신 번호 섹션(`## 1. 개요/문제` ~ `## Rationale`) 구조를 쓴다 — 리포 전역에서 확립된 `_product-overview.md` 패턴과 일치. 나머지 5개 기술 spec 은 모두 `## Overview` → 본문(§1~) → `## Rationale` 3섹션 구성을 지킨다.
- **API 문서 규약 (`swagger.md`)**: `EmbedConfigDto`(`dto/responses/embed-config-response.dto.ts`)는 JSDoc + `@ApiProperty` 패턴(§1-1/§1-2)을 따르고, 컨트롤러(`hooks.controller.ts`)는 `@Public()` 엔드포인트에 `@ApiBearerAuth` 를 넣지 않으며(§2-1) `@ApiOkWrappedResponse(EmbedConfigDto)` 공용 헬퍼(§5-2)를 사용한다. target 문서가 서술하는 "전역 `TransformInterceptor` 가 `{ data }` 로 래핑" 표현도 `swagger.md §2-5` 와 정확히 일치. `ConversationThreadDto` 를 별도 선언하지 않는다는 swagger.md Rationale 의 금지 패턴도 실제로 코드 테스트(`execution-status-response.dto.spec.ts`)가 `expect(schemas.ConversationThreadDto).toBeUndefined()` 로 가드하고 있어 위반 없음.
- **conversation-thread 규약 정합**: `1-widget-app.md`(메시지 리스트 매핑·§R8 복원 범위)·`3-auth-session.md`(durable thread 복원)의 서술이 `conversation-thread.md §1.1`(backend 5-source enum)·`§2.1`(presentation 표시물 thread 비영속)·`§9`(임베드 위젯 2-way 말풍선 축약 carve-out, §9.3/§9.4/§9.5 는 위젯에도 강제)과 문구 수준까지 일치.
- **interaction-type-registry 정합**: `0-architecture.md §3`·`1-widget-app.md` 의 `ai_form_render`→`ai_conversation` 4→3 통합 서술이 `interaction-type-registry.md §1.1/§1.2` 와 일치.
- **i18n 규약 (`i18n-userguide.md`)**: 위젯 chrome i18n 은 규약의 "적용 범위" 절이 명시한 carve-out(메인 앱 dict 기구는 스코프 밖, 위젯 로컬 catalog + ko/en parity 는 스코프 안)을 정확히 따른다. 실제 `catalog.ts` 는 `{{name}}` 이중 중괄호 보간(Principle 3-C 와 동일 컨벤션), ko/en leaf key parity, 해요체(P6) 를 지킨다. `5-admin-console.md §8` 은 콘솔 자체 메뉴/페이지 문자열에 대해 정확히 Principle 1·2(메인 dict 경유)를 명시하고 실제 `dict/{ko,en}/{sidebar,webChat}.ts` 파일이 존재한다. `codebase/channel-web-chat/src/widget/components/**.tsx` 전수 grep 결과 하드코딩 한국어는 주석뿐이고 JSX 텍스트는 모두 `t()` 경유.
- **에러 코드 명명 (`error-codes.md`)**: `WEBCHAT_IDLE_TIMEOUT`(도메인 prefix `WEBCHAT_` + 의미 기술) 은 §1 원칙에 부합. `GENERIC_ERROR_MESSAGE` 는 wire `error.code` 가 아니라 UI 표시 상수라 error-codes.md 적용 대상이 아니며 명명 스타일도 이질적이지 않다.
- **diff 검토**: `use-widget.ts`/`use-widget-eager-start.test.ts` 의 `StreamClaim`(`"opened" | "already_owned" | "no_client"`) 리팩터는 위젯 내부 함수 반환 타입 정리로, API 응답·이벤트 페이로드·DTO·에러 코드 등 정식 규약이 다루는 어떤 표면도 건드리지 않는다.

## 요약

`spec/7-channel-web-chat` 6개 문서는 `spec/conventions/` 전반(swagger DTO/컨트롤러 패턴, conversation-thread source enum·UI 렌더 규약, interaction-type-registry 4→3 매핑, i18n-userguide 위젯 carve-out, error-codes 명명 원칙, spec-impl-evidence frontmatter 라이프사이클)과 문구·코드 양쪽에서 높은 정합성을 보였다. 프롬프트 번들이 예산 초과로 관련 conventions 파일 대부분을 절단했으나, 워크트리에서 직접 원본을 대조한 결과 실질적 위반은 발견되지 않았고, target 문서 자체가 이미 각 규약 조항을 명시 인용하며 자기검증적으로 작성되어 있다. 유일한 관찰(4-security.md id 접두 주석)은 규약 위반이 아니라 문구의 사소한 정확성 이슈에 불과하다.

## 위험도

NONE
