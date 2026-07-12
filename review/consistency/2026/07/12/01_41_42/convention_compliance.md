# 정식 규약 준수 검토 — spec/7-channel-web-chat

검토 모드: --impl-done (scope=spec/7-channel-web-chat, diff-base=origin/main)
대조 대상: `spec/conventions/**` (특히 swagger.md · i18n-userguide.md · conversation-thread.md ·
interaction-type-registry.md · error-codes.md · spec-impl-evidence.md) + CLAUDE.md 문서 구조 컨벤션.

> 참고: orchestrator 가 번들한 `## 정식 규약 모음` 섹션에는 `audit-actions.md` ·
> `cafe24-api-catalog/**` 만 포함돼 있었고, channel-web-chat 이 실제로 인용하는 conventions
> (swagger/i18n-userguide/conversation-thread/interaction-type-registry/error-codes/
> spec-impl-evidence)는 빠져 있었다. 이 파일들은 `spec/conventions/` 에서 직접 절대경로로
> 다시 읽어 대조했다.

## 발견사항

- **[WARNING]** 위젯 disclaimer 기본 문구가 i18n-userguide.md Principle 6(해요체) 위반
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` §1 스니펫 예시
    `disclaimer: 'AI는 한정된 데이터로 동작하며 …'` (해당 필드가 가리키는 실제 기본값 —
    spec 자체는 `…` 로 truncate 돼 있어 직접적 위반 텍스트는 아님)
  - 위반 규약: `spec/conventions/i18n-userguide.md` §적용 범위 — "여전히 적용: 위젯의 인라인
    한국어도 **Principle 6(글로서리·문체 — 해요체·금지어)**를 따른다" 및 Principle 6
    "해요체로 통일 (`~합니다`, `~한다` 금지)"
  - 상세: 실제 기본값이 구현된 두 위치가 금지된 합니다체를 쓴다 —
    `codebase/channel-web-chat/src/app/demo/demo-config.ts:30`
    (`"AI는 한정된 데이터로 동작하며 답변이 정확하지 않을 수 있습니다."`, `0-architecture.md`
    `code:` 스코프)와 `codebase/packages/web-chat-sdk/examples/snippet.html:44`
    (`"...중요한 정보는 추가 확인이 필요합니다."`, `2-sdk.md` `code:` 스코프). 반면 동일 개념의
    기본 disclaimer 를 다루는 `codebase/frontend/src/content/docs/06-integrations-and-config/
    web-chat-sdk.mdx:50`("...답변이 부정확할 수 있어요.")와 admin 콘솔 dict placeholder
    `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts:47`("...동작해요")는 정확히 해요체로
    올바르다 — 같은 예문이 소스마다 tone 이 갈라진 상태다. 위젯 본체 컴포넌트
    (`components/panel.tsx` confirm 카피, `use-widget.ts` `GENERIC_ERROR_MESSAGE` 등)는 이미
    100% 해요체를 준수하고 있어, 위반은 demo/예시 두 파일에 국한된다(광범위한 회귀 아님).
  - 제안: `demo-config.ts` · `examples/snippet.html` 의 disclaimer 문구를 `web-chat-sdk.mdx`/
    `webChat.ts` 와 동일한 해요체(예: "AI는 한정된 데이터로 동작하며 답변이 정확하지 않을 수
    있어요.")로 정정. target spec(`2-sdk.md`)의 truncate 된 예시도 `…` 대신 해요체로 끝나는
    완전한 예문으로 채우면 향후 copy-paste 시 tone 오염을 예방할 수 있다.

- **[WARNING]** 신규 응답 DTO 파일명이 swagger.md §5-1 컨벤션(`*-response.dto.ts`) 미준수
  - target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter `code:` —
    `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "응답 DTO 위치" —
    `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`
  - 상세: 저장소 `dto/responses/` 아래 36개 파일 중 33개가 `*-response.dto.ts` 패턴을 따른다
    (예: `execution-status-response.dto.ts`, `interact-ack-response.dto.ts`,
    `webhook-response.dto.ts`). 이번 webchat 기능이 신설한 `embed-config.dto.ts`
    (`EmbedConfigDto` — `GET /api/hooks/:endpointPath/embed-config` 응답, target §3-①이
    직접 인용)만 `-response` 접미사가 빠져 있다. (`login-history.dto.ts`/`session.dto.ts` 도
    예외지만 이는 본 PR 이전부터 있던 legacy 라 범위 밖.)
  - 제안: `embed-config.dto.ts` → `embed-config-response.dto.ts` rename(및 import 경로 갱신).
    스펙 문서 자체의 frontmatter `code:` 경로도 rename 에 맞춰 함께 갱신.

- **[INFO]** Rationale 항목 번호(R-numbering)가 파일별로 불연속
  - target 위치: `1-widget-app.md` Rationale(R4부터 시작, R1~R3 없음) ·
    `2-sdk.md`(R2부터, R1 없음) · `3-auth-session.md`(R3부터, R1~R2 없음).
    `0-architecture.md`/`4-security.md`는 R1부터 연속.
  - 위반 규약: 해당 없음 — `spec/conventions/**` 어디에도 "Rationale 항목은 파일 내 R1부터
    연속 번호" 를 명문화한 규정이 없다(CLAUDE.md 는 Overview/본문/Rationale 3-섹션 존재만
    요구). 엄밀한 "정식 규약 위반"은 아니다.
  - 상세: git 이력 확인 결과 최초 커밋(`a652f8733`, 2026-05-30)부터 이미 이 gap 이 존재했다 —
    당시 `0-architecture.md` 는 `R1, R5, R6, R7, R8` 로, 나머지 파일들은 각각 `R4`/`R2`/`R3`
    로 시작해, 애초에 **영역 5개 문서 전체에 걸친 전역 공유 번호 체계**로 설계된 흔적이다.
    이후 `0-architecture.md` 만 `R1-R5` 로 재정렬됐지만 나머지 3개 파일은 옛 전역 번호를
    그대로 유지해, 지금은 파일 내부적으로 앞 번호가 "누락"된 것처럼 보인다(처음 읽는 사람이
    R1~R3 을 찾아 헤맬 수 있음). 외부에서 이 anchor(`1-widget-app.md#r4-...` 등)를 참조하는
    다른 spec 문서는 없다(grep 확인) — 즉 렌더 anchor 안정성 문제는 아니다.
  - 제안: (강제 아님) 가독성 개선을 원하면 세 파일의 Rationale 을 파일 내 R1부터 연속
    재번호. 진행 전 다른 파일이 구 번호를 anchor 로 참조하지 않는지 재확인.

- **[INFO]** `id: web-chat-security` 충돌 방지 주석의 근거가 현재 spec tree 와 정확히
  일치하지 않음
  - target 위치: `4-security.md` frontmatter —
    `id: web-chat-security  # basename '4-security' 와 의도적으로 다름 — 타 영역의
    '4-security' 슬러그와 충돌 방지 (영역 prefix 'web-chat-' 로 전역 유일)`
  - 위반 규약: 엄밀한 위반 아님 — `spec/conventions/spec-impl-evidence.md` §id 행("같은
    basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다")과
    부합하는 정당한 패턴 스타일이다.
  - 상세: 현재 spec tree 전체에 다른 `4-security.md` 파일이나 `id: security` 는 존재하지
    않는다(grep 확인) — 즉 오늘 시점엔 실제 충돌이 없다. 나머지 4개 문서
    (`web-chat-architecture`/`web-chat-widget-app`/`web-chat-sdk`/`web-chat-auth-session`/
    `web-chat-admin-console`)도 모두 basename 과 무관하게 동일한 `web-chat-` 접두어를 쓰지만
    그 중 `4-security.md` 만 사유 주석이 달려 있어, "영역 전체 id 네임스페이스 정책"인지
    "이 파일만의 실제 충돌 회피"인지 문면상 모호하다.
  - 제안: 주석을 "영역 전체 id 네임스페이스 정책(`web-chat-*`)의 일부"로 정정하거나, 실제
    충돌 사례가 있다면 그 문서를 인용해 근거를 명확히 한다. 기능 영향 없음(INFO).

## 준수 확인 (긍정 사례 — 참고용)

- 6개 target 문서 모두 Overview / 번호 섹션(본문) / Rationale 3-섹션 구조를 갖춘다
  (CLAUDE.md, 각 SKILL.md 준수).
- `_product-overview.md` 는 다른 영역들과 동일하게 `## 1. 개요` 로 시작하는 패턴을 따른다
  (`## Overview` 리터럴 헤더 미사용 — 전 영역 공통 관행과 일치, 위반 아님).
- `0-architecture.md` 의 `0-` prefix 사용은 `spec/4-nodes/0-overview.md` 선례와 일치하는
  영역-레벨 진입 문서 패턴이다.
- `0-architecture.md` §3 의 SSE wire 필드명(`interactionType`/`waitingNodeId`/
  `conversationThread` 등) vs EIA §6.2·WS §4.4 공식 표기(`nodeId`/`node.id`) 간 drift 를
  스스로 명시하고 코드(`eia-events.ts`)를 SoT 로 지목한 것은 투명한 처리로, swagger.md
  §1-4 Rationale 이 다루는 바로 그 `interactionType` unsound-discriminator 사례와 정확히
  같은 문제의식을 공유한다 — 규약과 상충 없음.
- i18n-userguide.md 의 channel-web-chat 스코프 carve-out(Principle 1·2 제외, Principle 6
  잔존 적용)을 `2-sdk.md` R6·`5-admin-console.md` §8 이 정확히 인용·반영한다(admin 콘솔은
  in-scope 로 올바르게 구분).
- conversation-thread.md §8.2/§2.1 의 위젯 2-way 말풍선 축약 carve-out을 `1-widget-app.md`
  §2 가 정확히 반영(source 매핑, 표시-전용 presentation 노드 복원 비대상 등).
- npm scope `@workflow/web-chat` 명명은 기존 결정(`eia-sdk-publish.md` §결정 #3, `@workflow/
  sdk` 일관)을 정확히 인용.
- 에러 코드 `WEBCHAT_IDLE_TIMEOUT` 은 error-codes.md §1 의 의미 기반 명명 + 도메인 prefix
  원칙(`<DOMAIN>_<CONDITION>`)과 정합.
- API 응답 wrapping(`{ data }` TransformInterceptor, pass-through 예외) 서술은
  swagger.md §2-5 / api-convention §5.2 와 정확히 일치.

## 요약

target 6개 문서는 CLAUDE.md 문서 구조 컨벤션, swagger.md 의 응답 wrapping·oneOf/discriminator
지침, conversation-thread.md/interaction-type-registry.md 의 위젯 축약 carve-out,
i18n-userguide.md 의 스코프 제외+Principle 6 잔존 적용, error-codes.md 의 의미 기반·도메인
prefix 명명을 대부분 정확히 인용·준수하며, 특히 자기 문서 내에서 발견한 spec-code drift(SSE
wire 필드명)를 은폐하지 않고 명시한 점은 모범적이다. 다만 두 가지 WARNING 이 있다 — (a)
i18n-userguide.md Principle 6(해요체)이 `demo-config.ts`·`web-chat-sdk/examples/snippet.html`
두 개의 예시/데모 disclaimer 기본값에서 금지된 합니다체로 위반됐고(위젯 본체 컴포넌트는 이미
준수), (b) 신규 `embed-config.dto.ts` 가 swagger.md §5-1 의 `*-response.dto.ts` 파일명 패턴을
따르지 않는다(33/36 기존 파일은 패턴 준수). 둘 다 기능 결함이 아닌 명명/톤 일관성 결함이라
WARNING 수준이며 low-cost fix 다. 나머지 두 발견(Rationale 번호 gap, id 주석 근거 불일치)은
정식 규약이 명문화하지 않은 영역이라 INFO 로 낮춘다.

## 위험도
LOW
