# 정식 규약 준수 검토 — `spec/7-channel-web-chat/`

검토 모드: --impl-prep (구현 착수 전 검토) · scope=`spec/7-channel-web-chat/`
대상 정식 규약: `spec/conventions/**` (특히 `swagger.md`·`error-codes.md`·`node-output.md`·`interaction-type-registry.md`·`conversation-thread.md`·`spec-impl-evidence.md`·`i18n-userguide.md`) + CLAUDE.md/SKILL.md 의 문서 구조·명명 컨벤션.

## 발견사항

- **[WARNING]** `/embed-config` 응답 봉투(`{ data }` wrap) 표기 누락
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3 세션 시퀀스 step 0(라인 44) · `spec/7-channel-web-chat/4-security.md` §3-①(라인 101-109) · §3 Rationale I3(라인 188-190)
  - 위반 규약: `spec/conventions/swagger.md` §2-5(전역 `TransformInterceptor` 가 "이미 top-level `data` 키가 있는 경우만" pass-through, 그 외 모든 성공 응답은 `{ data }` wrap) · §5-2(`ApiOkWrappedResponse(Dto)` → `{ data: <Dto> }`)
  - 상세: 실제 구현(`codebase/backend/src/modules/hooks/hooks.controller.ts` `getEmbedConfig` — `@ApiOkWrappedResponse(EmbedConfigDto, …)`)은 `{ data: { allowlist, enforce } }` 를 반환하는데, target 은 3곳 모두 `{ allowlist, enforce }`(wrap 없이)로만 표기한다. 같은 문서 3-auth-session.md §3 은 step 2(webhook 시작)에 대해서는 `202 { data: { executionId, … } } ↑ 전역 TransformInterceptor 가 … { data } 로 래핑 … 위젯은 res.data 를 언랩` 이라고 명시적으로 wrap 을 표기하는데, step 0(`embed-config`)만 이 표기를 생략해 두 endpoint 간 표기 비대칭이 생긴다. 더 나아가 §Rationale R5("REST 응답 `{ data }` 봉투 언랩 + 폴백")는 언랩 대상 endpoint 를 "webhook 시작·상태 조회·토큰 갱신" 3종으로만 열거하고 `embed-config` 를 빠뜨렸다 — R5 가 정식 언랩 계약의 SoT 로 기능하는데 그 목록에서 실제 wrap 되는 endpoint 하나가 누락된 것은 §2 (출력 포맷 규약) 관점의 문서 불완전성이다. 실제 클라이언트 코드(`codebase/channel-web-chat/src/widget/use-widget.ts` `fetchEmbedConfig`)는 `json.data ?? json` 폴백으로 이미 두 shape 모두 안전 처리하므로 **런타임 영향은 없다** — 순수 spec 문서 완결성 갭.
  - 제안: (1) `3-auth-session.md` §3 step 0 을 `→ { data: { allowlist, enforce } }` 로 정정하고 다른 step 과 동일하게 wrap 주석 추가. (2) `4-security.md` §3-①·I3 의 `{ allowlist, enforce }` / `{ allowlist: [], enforce: false }` 표기에도 봉투를 명시. (3) `3-auth-session.md` §Rationale R5 의 언랩 대상 열거("webhook 시작·상태 조회·토큰 갱신")에 `embed-config` 를 4번째 항목으로 추가.

- **[INFO]** `_product-overview.md` 제목 포맷이 형제 영역 문서와 상이
  - target 위치: `spec/7-channel-web-chat/_product-overview.md:1`
  - 위반 규약: `spec/conventions/**` 자체의 강제 조항은 아니며 `.claude/skills/project-planner/SKILL.md` "명명 컨벤션"(`_product-overview.md` — 다중 spec 영역의 제품 정의) 및 CLAUDE.md 가 지시하는 "문서 구조 규약" 점검 범위에 속하는 스타일 사안.
  - 상세: `spec/2-navigation/_product-overview.md`·`3-workflow-editor/_product-overview.md`·`4-nodes/_product-overview.md`·`4-nodes/4-integration/_product-overview.md`·`4-nodes/3-ai/_product-overview.md`·`5-system/_product-overview.md` 6개 전부 H1 을 `# PRD: <이름>` 으로 시작하는 반면, `7-channel-web-chat/_product-overview.md` 만 `# Channel Web Chat — 임베드형 웹채팅 위젯 + SDK + 샘플 (제품 정의)` 로 다른 타이틀 포맷을 쓴다. 본문 섹션 구성(`## 1. 개요/문제` → … → `## Rationale`)은 형제 문서들과 동일해 실질적 구조 위반은 아니다.
  - 제안: 강제 규약 위반은 아니므로 차단 사유는 아님. 일관성을 원하면 H1 을 `# PRD: Channel Web Chat` 형태로 맞추는 것을 고려(선택).

## 정상 확인 항목 (참고 — 위반 아님)

다음은 규약 준수가 잘 지켜진 사례로, 검토 중 명시적으로 대조 확인했다:

- **문서 구조**: 6개 spec 파일(`0-architecture`~`5-admin-console`) 전부 `## Overview` → 본문(번호 섹션) → `## Rationale` 3섹션 구조 + frontmatter(`id`/`status`/`code`) 를 보유. `0-` prefix 사용은 `2-navigation/0-dashboard.md`·`3-workflow-editor/0-canvas.md`·`4-nodes/0-overview.md` 등 기존 영역 진입 문서 패턴과 일치(루트 `spec/0-overview.md` 와는 별개 계층 — 위반 아님).
- **`id:` 충돌 회피**: `4-security.md` 의 `id: web-chat-security # basename 4-security 와 의도적으로 다름` 주석은 `spec/conventions/spec-impl-evidence.md` §2.1 "같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다" 규정을 정확히 따른 사례.
- **enum/명명 정합**: `interactionType ∈ {form, buttons, ai_conversation}` 표기는 `spec/conventions/interaction-type-registry.md` §1.1 의 "내부 4값 ↔ EIA 외부 3값 매핑"과 정확히 일치. `turn.source` 5값(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`) → user/assistant 축약 매핑, `turn.presentations[]` 의 `source: 'ai_assistant'` 한정 서술은 `spec/conventions/conversation-thread.md` §1.1·§2.1 과 정확히 일치(§2.1 은 실제로 본 web-chat spec 을 소비처로 명시 cross-ref).
- **에러 코드 명명**: `STATE_MISMATCH`(409)·`EXECUTION_NOT_FOUND`(404)·`TOO_MANY_CONNECTIONS`(429) 등 wire 상 노출되는 코드는 모두 `UPPER_SNAKE_CASE`로 `spec/conventions/error-codes.md` §1 규약 및 `5-system/14-external-interaction-api.md` 카탈로그와 일치.
- **API 문서(DTO) 명명**: `EmbedConfigDto`·`WebChatAppearanceDto`·`InteractAckDto` 등은 `spec/conventions/swagger.md` §1/§5-1 의 PascalCase + `Dto` 접미사 패턴을 따름.
- **i18n**: `5-admin-console.md` §8 이 `spec/conventions/i18n-userguide.md` Principle 1·2(ko/en dict parity) 를 명시 인용하고 `lib/i18n/dict/{ko,en}/*.ts` 경로 패턴을 정확히 따름.
- **금지 항목**: `srcdoc`/`about:blank` iframe 자가생성 금지(§R5) 등은 target 이 스스로 선언한 설계 제약이며 본문 전체에서 그 금지를 위반하는 서술은 발견되지 않음. `spec/conventions/conversation-thread.md` §1.6 이 금지하는 신규 inline marker 도입도 없음.

## 요약

`spec/7-channel-web-chat/` 6개 문서는 문서 구조(Overview/본문/Rationale)·명명(`id:` 충돌 회피, 파일 prefix, DTO/에러코드 표기)·cross-cutting enum 레지스트리(interaction-type-registry, conversation-thread) 정합 측면에서 `spec/conventions/**` 를 대체로 충실히 따른다. 유일하게 실질적인 갭은 `GET /api/hooks/:endpointPath/embed-config` 응답의 `{ data }` 봉투 표기가 문서 3곳(시퀀스 다이어그램·§3-①·Rationale R5 목록)에서 일관되게 누락된 것으로, `swagger.md` §2-5/§5-2 의 전역 wrap 규칙과 문서 자체의 다른 endpoint 표기 관행에 비춰 봤을 때 표기 불완전성이다. 실제 코드(`fetchEmbedConfig`)는 이미 방어적 언랩(`json.data ?? json`)을 구현해 두어 런타임 리스크는 없으므로 차단 사유는 아니고, 문서 정정으로 충분하다. `_product-overview.md` 의 제목 포맷 차이는 강제 규약 위반이 아닌 스타일 참고 사항이다.

## 위험도

LOW
