# 정식 규약 준수 검토 — `spec/7-channel-web-chat/`

검토 모드: `--impl-done` (scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`)
대조 대상: `spec/conventions/**` (특히 `swagger.md`, `conversation-thread.md`, `interaction-type-registry.md`,
`i18n-userguide.md`, `error-codes.md`, `spec-impl-evidence.md`) + `spec/5-system/2-api-convention.md` +
CLAUDE.md 문서 구조 규약.

> 주: 호출 payload(`_prompts/convention_compliance.md`)의 "정식 규약 모음" 절은 `cafe24-api-catalog` 위주로 잘려
> 있어 target 과 관련성이 낮았다. 따라서 실제 검토는 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/llm-usage-doc-alignment-01d7a4`)의
> `spec/conventions/**` 원본을 직접 Read 해 대조했다.

## 발견사항

없음 — CRITICAL/WARNING 급 정식 규약 위반을 발견하지 못했다.

아래는 검토 과정에서 확인한 항목과 판단 근거(모두 비위반으로 판정, 참고용 기록).

### 확인 항목 (전부 컴플라이언스 확인, 조치 불요)

1. **문서 구조 3섹션** — `0-architecture.md`/`1-widget-app.md`/`2-sdk.md`/`3-auth-session.md`/`4-security.md`/
   `5-admin-console.md` 모두 `## Overview` → 번호 본문 → `## Rationale` 구조를 따른다. `_product-overview.md` 는
   `## 1. 개요 / 문제` 로 시작하는데, 이는 SKILL.md 문면(`## Overview (제품 정의)`)과 표기가 다르나
   `spec/2-navigation`·`spec/3-workflow-editor`·`spec/4-nodes`·`spec/5-system` 의 `_product-overview.md` 전부가
   동일하게 `## 1. 개요` 패턴을 쓰는 **레포 전역 기정 관행**이라 target 만의 편차가 아니다 — 위반으로 보지 않음.

2. **frontmatter 스키마** (`spec-impl-evidence.md` §2) — 6개 파일 모두 `id`/`status`/`code` 보유, `code:` 글로브가
   실제 파일에 매치함을 확인(예: `codebase/channel-web-chat`, `codebase/packages/web-chat-sdk`,
   `codebase/backend/src/modules/web-chat-cors`, `codebase/frontend/src/lib/web-chat` 등 전부 실존).
   `4-security.md` 의 `id: web-chat-security`(basename `4-security` 와 불일치)는 frontmatter 주석으로 사유를 명시했고,
   `spec-impl-evidence.md §2.1` 의 "같은 basename 충돌 시 후발 문서가 영역 prefix 로 회피"(예: `nav-agent-memory`) 선례와
   동형 — 의도된 패턴.

3. **응답 DTO 명명/위치** (`swagger.md` §5-1) — `spec/7-channel-web-chat/4-security.md` 가 가리키는
   `codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts` 는 실존하며, 파일 접미
   `-response.dto.ts` + 클래스명 `EmbedConfigDto`(짧은 이름) 조합이 `swagger.md` §5-1 예시(`workflow-response.dto.ts`→
   `WorkflowDto`)와 정확히 일치. `EmbedConfigDto`·`WebChatAppearanceDto` 등도 실존 확인.

4. **응답 wrapping / 헬퍼 사용** (`swagger.md` §2-5·§5-2) — `hooks.controller.ts` 의 `getEmbedConfig`/webhook POST
   엔드포인트가 `ApiOkWrappedResponse`/`ApiAcceptedWrappedResponse` 공용 헬퍼를 사용(빈 껍데기 인라인 스키마 아님).
   target 문서가 서술하는 `{ data: { allowlist, enforce } }`, webhook `202 { data: {...} }` 등은 실제 코드·
   `swagger.md §2-5`·`api-convention §5.1` 과 일치.

5. **에러 응답 구조** (`api-convention.md` §5.3) — `1-widget-app.md` §2 표의 `error.details[{field,message,code}]`
   서술이 §5.3 의 `details: [{ field, message, code }]` 스키마와 정확히 일치.

6. **null vs 키 생략** (`api-convention.md` §5.4) — target 이 인용하는 `context.conversationThread` 키 생략 사례는
   §5.4 표의 선례 목록에 그대로 등재돼 있어 target 의 서술이 SoT 를 재확인하는 형태(재정의 아님).

7. **닫힌 union / 열린 map 구분** (`swagger.md` §1-4, Rationale) — target(0-architecture §3, 3-auth-session)은
   `context`/`nodeOutput`/`ConversationThreadDto` 등을 자체 스키마로 재선언하지 않고 `conversation-thread.md`·EIA 문서를
   SoT 로 인용만 한다 — `swagger.md` Rationale("같은 이유로 ConversationThreadDto 도 만들지 않는다")이 명시적으로
   기대하는 패턴과 일치.

8. **interaction-type-registry 정합** — target 의 "EIA 외부 `interactionType` ∈ `form`/`buttons`/`ai_conversation`(3값)"·
   "`ai_form_render` 는 EIA 표면에서 `ai_conversation` 으로 통합" 서술은 `interaction-type-registry.md` §1.1 의
   "내부 4값 ↔ EIA 외부 3값 매핑" 규정과 정확히 일치.

9. **에러 코드 명명** (`error-codes.md`) — `WEBCHAT_IDLE_TIMEOUT`(도메인 prefix `WEBCHAT_` + UPPER_SNAKE_CASE),
   `PUBLIC_WEBHOOK_RATE_LIMIT`/`PUBLIC_WEBHOOK_BODY_TOO_LARGE`(실제 컨트롤러 코드) 모두 §1 "의미 기반 명명 + 도메인
   prefix" 원칙에 부합. `GENERIC_ERROR_MESSAGE` 는 `error.code` 값이 아니라 내부 JS 상수명(위젯 로컬 fallback 문자열)
   이라 error-codes.md 적용 범위 밖 — 위반 아님.

10. **i18n Principle 1/2/6 (위젯 chrome)** — `i18n-userguide.md` 의 "적용 범위" 절이 이미 2026-07-12 위젯 chrome EN
    활성화를 반영해 target 문서(`1-widget-app.md §4`, `2-sdk.md §R6`, `0-architecture.md §R10`)와 동기화돼 있다.
    실제 코드 `codebase/channel-web-chat/src/lib/i18n/catalog.ts` 의 ko/en 키 집합이 target §4 가 나열한 번역 대상
    (세션 컨트롤·확인 문구·입력창·에러·form·carousel·chart·table 잘림 배너·launcher)과 1:1 대응하고, 전부 해요체
    (`~해요`/`~돼요`/`~할까요`)로 Principle 6 문체 규약을 준수함을 코드에서 직접 확인.

11. **금지 글로서리 용어** — `_glossary.md` 의 "엣지"→"연결선" 금지는 워크플로우 그래프 연결선(Edge)에 한정된 규칙이다.
    target 문서에 등장하는 "엣지 CDN"(0-architecture §4/§4.1, 5-admin-console §5/§6, 4-security §2.1)은 네트워킹
    용어(Edge CDN)로 그래프 Edge 와 무관 — 오탐 회피, 위반 아님. "작업 흐름"·"아웃풋" 등 다른 금지어는 target 에
    등장하지 않음.

### 참고 (INFO, 조치 불요 — 스코프 경계 판단)

- **`codebase/channel-web-chat/src/app/demo/demo-host.tsx`** (dev 전용 host 시뮬레이터, `demo-config.isDemoEnabled` 로
  production 게이팅)에 `~합니다`/`~습니다` 형 문장이 여러 곳 있다(예: "...가 있어야 동작합니다.", "...두지 않습니다.").
  `i18n-userguide.md` 의 위젯 chrome 문체 규약(Principle 6, 해요체)이 이 파일까지 요구하는지는 애매하다 —
  이 페이지는 위젯 SPA 자신의 chrome 이 아니라 **host(고객 페이지) 역할을 흉내내는 dev 도구**의 UI 텍스트이고,
  실제 위젯 소유 chrome(`widget/`, `lib/i18n/`)에는 동일 grep 에서 위반 사례가 없었다(§4 catalog 는 전부 해요체로
  이미 정합). 메모리 상 "channel-web-chat 하드코딩 한국어 재플래그는 반복 오탐" 선례가 있어 CRITICAL/WARNING 으로
  격상하지 않고 참고만 남긴다 — 스코프에 포함시킬지는 project-planner 판단.

## 요약

`spec/7-channel-web-chat/` 6개 문서를 `spec/conventions/**`(swagger·conversation-thread·interaction-type-registry·
i18n-userguide·error-codes·spec-impl-evidence)와 `spec/5-system/2-api-convention.md`, CLAUDE.md 문서 구조 규약에
대조한 결과 정식 규약 위반을 발견하지 못했다. 특히 최근 PR #926(응답 DTO 파일명 §5-1 정렬)·#927(위젯 문체 해요체 통일)·
#928(Cache-Control TTL 단일 진실화)이 정확히 이 범주의 문제를 이미 교정해 두었고, 이번 검토 시점의 코드·spec·conventions
3자 상태를 직접 대조(frontmatter code glob 실존 확인, DTO 클래스/파일명 실측, i18n catalog 키·문체 실측, interaction-type
매핑 실측)해도 drift 가 없음을 확인했다. 유일한 참고 사항은 dev 전용 데모 host 페이지의 문체(스코프 밖 가능성이 높은
경계 사례)뿐이며 조치가 필요한 수준은 아니다.

## 위험도

NONE
