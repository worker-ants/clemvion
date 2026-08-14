# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 점검 범위

`git diff origin/main...HEAD` 로 실측한 변경분:

- `spec/5-system/14-external-interaction-api.md` (+104/-39)
- `spec/5-system/6-websocket-protocol.md` (+13/-5)
- 코드: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (신설) ·
  `interaction.service.ts` · `websocket.service.ts` (+테스트)

핵심 변경: `llmCalls`(raw LLM debug payload) 외부 유출 방어를 depth-1(top-level) →
필드명 기준 깊이 무관(recursive) strip 으로 강화하고, WS fanout·EIA REST `getStatus()`
양쪽이 공용 유틸(`stripExternalOnlyFields`)을 쓰도록 통일. 동반해 `error.code`/`nodeId`
의 `null` 가능성 명시, URL 예시를 상대경로로 정정, 채널별 봉투 필드명 매핑을 보강.

prompt_file 이 컨텍스트 예산 초과로 `spec/conventions/**` 본문·diff 본문을 생략했으므로,
아래는 워킹트리에서 `spec/conventions/*.md` 원문을 직접 Read/Grep 하여 대조한 결과다.

## 발견사항

- **[INFO]** `WS §4.4.6` 신규 교차참조에 앵커 프래그먼트 누락
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.3 예시 주석(라인 473)
    · §6.2 payload 예시(라인 682) — 두 곳 모두
    `[WS §4.4.6](./6-websocket-protocol.md) / [Conversation Thread §5.1](../conventions/conversation-thread.md)`
  - 위반 규약: 명시적 조항은 없음(참고 정합 사례) — 같은 diff 안에서 새로 추가된 다른
    정밀 인용은 앵커를 포함한다. 예: 동일 diff 의
    `[WS §4.4](./6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input)`
    (§6.2 blockquote 신설분), 그리고 `conversation-thread.md` §5.1 자신도 WS §4.4.6 을
    인용할 때 앵커를 포함한다(`#446-messagessource-마커`, 기존 문서).
  - 상세: 이번 diff 는 원래 존재하던 오귀속(`Conversation Thread §4.4.6` — 그 섹션은
    conversation-thread.md 에 없고 실제로는 websocket-protocol.md 소유)을 `WS §4.4.6`
    로 바로잡은 것은 정확하다. 다만 그 수정된 링크 자체는 `#446-...` 앵커 없이
    파일 최상단만 가리켜, 같은 문서·같은 diff 안에서 앵커 유무가 갈린다.
  - 제안: `./6-websocket-protocol.md#446-messagessource-마커` 로 앵커를 채워 넣어
    `conversation-thread.md` §5.1 이 이미 쓰는 인용 형식과 통일한다. 사소한 가독성
    이슈이며 BLOCK 사유는 아니다.

- **[INFO]** `Conversation Thread §5.1` 공동 인용의 근거 위치가 정확히 일치하지 않음
  - target 위치: 동일 두 지점(라인 473, 682) — "`messages[].source` 마커 누락 시
    [WS §4.4.6] / [Conversation Thread §5.1] 의 폴백('live' 로 간주) 적용"
  - 위반 규약: 특정 조항 위반은 아님(교차 인용 정확성 문제, 대상 규약이라기보다 spec 간
    상호 참조 정합성 — 통상 cross_spec/consistency 리뷰어 영역과 겹친다).
  - 상세: `conversation-thread.md` §5.1("messages 모드 매핑")은 `turn.source → role`
    변환 표만 담고 있고, "source 필드 누락 시 `'live'` 로 간주" 라는 폴백 문장 자체는
    `websocket-protocol.md` §4.4.6 의 "소비 측 권장 동작" 목록에만 존재한다
    (`spec/5-system/6-websocket-protocol.md:777`). §5.1 은 그 마커 정의를 WS §4.4.6
    으로 되짚어 인용할 뿐(§5.1 blockquote), 폴백 규칙 자체를 재서술하지 않는다.
    따라서 "WS §4.4.6 / Conversation Thread §5.1" 을 폴백 규칙의 공동 SoT 인 것처럼
    병기하면, 독자가 §5.1 을 열어도 해당 문장을 찾지 못할 수 있다.
  - 제안: 폴백 문장의 SoT 는 WS §4.4.6 단독으로 좁히거나(`Conversation Thread §5.1`
    인용 제거), 유지하려면 "매핑 근거"(어떤 source 값이 있는지)와 "누락 시 폴백"(값이
    아예 없을 때 무엇으로 간주하는지)이 별개 진술이라는 점을 괄호로 구분해 준다. 이번
    diff 가 이미 절반(§4.4.6 오귀속)을 고쳤으므로 나머지 절반도 같은 라운드에 정리하는
    편이 재발을 막는다.

## 규약 준수 확인 (위반 아님 — 근거 남김)

검토 중 위반처럼 보였으나 실제로는 `spec/conventions/`·`2-api-convention.md` 규약과
정합한 항목들 — 오탐 방지를 위해 근거를 남긴다.

- **`error.code`/`nodeId` 의 `null` 표현**: EIA §6.4 표에 추가된
  "`code`·`nodeId` 는 `null` 일 수 있다"는 [`2-api-convention.md §5.4`](../spec/5-system/2-api-convention.md)
  의 "부재 표현 — `null`(키 present) 이 **기본값**" 원칙과 정확히 일치하고, 근거까지
  함께 남겼다("부재 표현은 형제 필드 `nodeId` 와 같은 `null`([API 규약 §5.4] — 키
  생략과 택일하되 근거를 남긴다)"). §5.4 는 "그 필드를 문서화하는 절에 사유를 명시"를
  요구하는데, 신설 blockquote(§6.4)가 sentinel 경로만 코드를 채운다는 사유를 정확히
  남겨 규약을 준수한다.
- **URL 표기 정정**: §6.2 예시가 절대 URL(`https://api.clemvion.ai/v1/...`)에서 상대
  경로(`/api/external/executions/{id}/...`)로 바뀌었고, 신설 blockquote 가 "절대
  URL·`/v1/` 버전 세그먼트는 [API 규약 §1] 위반" 이라고 직접 명시한다. 확인 결과
  `2-api-convention.md §1` 은 "버전 | URL 경로에 포함하지 않음"을 규정하므로 정확한
  인용이고, 정정된 경로는 §5.1~§5.5 에 실제 정의된 엔드포인트 경로(`grep` 실측:
  `POST /api/external/executions/:executionId/interact` 등)와 문자 그대로 일치한다.
  **규약 위반 교정이지 새 위반이 아니다.**
- **채널별 봉투(payload 래퍼) 서술**: §6.2 신설 blockquote("두 채널의 차이는
  봉투(`payload` 래퍼 유무)뿐")는 §6 도입부의 기존 normative 표
  ("WS flat / SSE flat+routing / webhook payload 래핑")와 정합한다. 새 서술이 기존
  규약을 재진술만 하고 모순을 만들지 않는다.
- **`strip-external-only-fields.ts` 명명·구조**: 파일명 kebab-case, export
  `EXTERNAL_STRIPPED_FIELDS`(UPPER_SNAKE_CASE)·`stripExternalOnlyFields`(camelCase)
  는 형제 유틸 `sanitize-error-message.ts` 의 `MAX_REDACT_DEPTH`/`deepRedactSecrets`
  네이밍 스타일과 일관된다. `node-output.md` Principle 1.1 의 "spread 로 config 를
  echo 하지 말라" 금지 패턴과는 무관한 범용 object-clone 스프레드(`{...obj}`)라 해당
  금지 항목에 저촉되지 않는다.
- **API 문서(Swagger/OpenAPI) 규약**: 이번 diff 는 DTO 파일을 전혀 건드리지 않는다
  (`git diff --stat` 확인, DTO 매치 0건) — §4 관점(데코레이터·DTO 명명)은 이번
  변경분에 적용 대상이 없다.
- **문서 구조(Overview/본문/Rationale)**: 두 target 문서 모두 기존 3섹션 구조를
  유지하며 이번 diff 가 구조를 흔들지 않았다(`## Overview` → 본문 → `## Rationale`
  섹션 헤더 위치 불변). Rationale 갱신 시 "`(YYYY-MM-DD 갱신)`" blockquote 로 덧붙이는
  패턴도 이 문서군에서 이미 정착된 관례(`6-websocket-protocol.md:978` 등)와 동일하게
  따랐다.
- **frontmatter `code:` 글로브**: 두 문서 모두 신설 파일
  `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 를 `code:`
  리스트에 추가해 SoT 코드 목록을 갱신했다 — plan-lifecycle 이 요구하는 "code 는 실제
  구현 파일을 가리켜야 한다" 관행에 부합.

## 요약

이번 diff(EIA `llmCalls` 유출 방어 강화 + 관련 spec 정정)는 정식 규약 관점에서 대체로
견고하다. `null` 부재 표현·URL 버저닝·채널 봉투 서술은 각각 `2-api-convention.md`
§5.4·§1·§6 도입부와 정확히 인용·정합하며, 코드 네이밍도 형제 유틸과 일관된다. 유일하게
남는 것은 이번 diff 가 새로 손댄 교차참조 두 곳(§4.4.6 인용)의 앵커 프래그먼트 누락과
"Conversation Thread §5.1" 공동 인용의 근거 정밀도 — 둘 다 INFO 수준이며 BLOCK 사유가
되는 CRITICAL/WARNING 은 발견되지 않았다. `spec/conventions/**` 전체를 직접 열어
대조했을 때도 이번 변경이 명시적으로 금지한 패턴(§node-output.md 8.1, §i18n 하드코딩
금지 등)을 답습하는 지점은 없었다.

## 위험도

LOW
