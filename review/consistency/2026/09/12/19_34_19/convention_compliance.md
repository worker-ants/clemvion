# 정식 규약 준수 검토 — `spec/5-system/` (impl-prep, `trigger-uuid-and-guide-codes`)

## 조사 방법 메모

프롬프트 번들이 컨텍스트 예산 초과로 `spec/5-system/` 19개 파일 중 15개, `spec/conventions/**` 대부분을
절단했다. 절단된 파일 중 이번 작업(`plan/in-progress/trigger-uuid-and-guide-error-codes.md`)과 직접
관련된 다음 파일은 저장소에서 **직접 Read** 했다:

- `spec/5-system/15-chat-channel.md` (전문, 1011줄)
- `spec/conventions/error-codes.md` (전문)
- `spec/conventions/swagger.md` (전문)
- `spec/conventions/user-guide-evidence.md` / `spec/conventions/i18n-userguide.md` (관련 절)
- `spec/conventions/spec-impl-evidence.md` (관련 절)
- `spec/data-flow/10-triggers.md` (관련 시퀀스 다이어그램)
- `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken` 실제 데코레이터)

번들에 완전히 포함된 `1-auth.md` · `2-api-convention.md` · `3-error-handling.md` 는 문서 구조(Overview/
Rationale) 관점으로 훑었다. 나머지 elided 파일들은 이번 plan 의 diff 범위와 무관해 보여(격리된 도메인 —
RAG/그래프/webhook/EIA/에이전트 메모리 등) 전수 Read 는 생략했다 — 관련성이 새로 드러나면 재조사 필요.

---

## 발견사항

### [WARNING] `rotateBotToken` 엔드포인트가 swagger.md §5-4 UUID 파라미터 규칙을 어긴다 (코드 레벨, target 문서는 이를 알고 있지 않음)

- **target 위치**: `spec/5-system/15-chat-channel.md` §5.4 (`rotate-bot-token` 실패 응답 표, L365-380) 및 §3.4 CCH-SE-04 — 이 문서는 `rotateBotToken` 의 `:id` 파라미터 처리 방식에 대해 아무 것도 서술하지 않는다(서술 누락 자체가 위반은 아니다).
- **위반 규약**: `spec/conventions/swagger.md` §5-4 새 엔드포인트 체크리스트 — *"경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용"*.
- **상세**: 실제로 `codebase/backend/src/modules/triggers/triggers.controller.ts` 를 열어보면 같은 컨트롤러의 다른 6개 엔드포인트는 전부 `@ApiParam({ name: 'id', format: 'uuid' })` + `@Param('id', ParseUUIDPipe)` 조합인데, `rotateBotToken` 만 `@Param('id') triggerId: string` — `ApiParam` 데코레이터 자체가 없고 `ParseUUIDPipe` 도 없다. 비-UUID 입력 시 Postgres `QueryFailedError`(22P02)가 `GlobalExceptionFilter` 의 세 분기 어디에도 걸리지 않아 `500 INTERNAL_ERROR` 로 떨어진다(클라이언트 입력 오류가 서버 장애로 위장). 이는 `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §A 가 이미 실측(145건 `@Param` 전수 스캔, id-형 136건 중 유일한 예외)해 놓은 것과 정확히 일치한다.
- **제안**: target 문서(spec) 를 고칠 필요는 없다 — 이것은 spec 텍스트의 결함이 아니라 코드가 이미 문서화된 형제 패턴(swagger.md §5-4, 같은 컨트롤러 6곳)에서 이탈한 사례다. plan §A 가 `@Param('id', ParseUUIDPipe) triggerId: string` 부착 + 전수 가드(`param-uuid-pipe-guard`) 신설로 정확히 이 조항을 겨냥하고 있으므로 **그대로 진행**하면 된다. 다만 같은 김에 `@ApiParam({ name: 'id', format: 'uuid' })` 데코레이터도 형제 6곳과 맞춰 추가하는 것을 plan 체크리스트에 명시적으로 올리는 편이 안전하다 — 현재 plan 체크리스트는 `ParseUUIDPipe` 부착만 명시하고 `@ApiParam` 데코레이터는 언급하지 않는다(같은 조항의 절반만 겨냥).

### [INFO] target 문서의 에러 코드 SoT 는 이미 정확 — plan §B 의 "가이드 정정" 대상과 충돌 없음

- **target 위치**: `spec/5-system/15-chat-channel.md:371` (`404 RESOURCE_NOT_FOUND`), `spec/data-flow/10-triggers.md:74` (`Hk-->>Ext: 404 TRIGGER_NOT_FOUND`, `Hk`=`HooksController`).
- **관련 규약**: `spec/conventions/error-codes.md` §1 (의미 기반 명명) · §3 (historical exception registry).
- **상세**: plan 은 "가이드(mdx)·i18n 주석이 `TRIGGER_NOT_FOUND` 를 chat-channel REST API(`rotateBotToken`)의 코드로 잘못 적었고, 실제로는 hooks webhook inbound 전용" 이라고 진단했다. 두 SoT 문서를 대조한 결과 **spec 은 이미 정확하다** — `15-chat-channel.md` 는 `rotateBotToken` 404 를 `RESOURCE_NOT_FOUND` 로, `data-flow/10-triggers.md` 는 webhook inbound 404 를 `TRIGGER_NOT_FOUND` 로 각각 올바르게 귀속하고 있다. 즉 plan §B 가 고치려는 6곳(mdx 4곳 + `backend-labels.ts`/`backend-labels.test.ts` 주석 2곳)은 모두 `spec/**` 바깥(`content/docs/**`, `codebase/frontend/src/lib/i18n/**`)에 있고, 그 정정은 spec 을 새로 따라가는 것이지 spec 자체를 바꾸는 작업이 아니다.
- **제안**: 조치 불필요. spec 쪽에 추가 수정이 필요하지 않음을 확인하는 것으로 충분하다.

### [INFO] plan §C 의 `ERROR_KO` 부재 유예 결정은 `i18n-userguide.md` Principle 3-C 와 정합

- **target 위치**: plan §C ("일반 API 코드의 KO 라벨 부재… 별 건으로 둔다").
- **관련 규약**: `spec/conventions/i18n-userguide.md` Principle 3-C (L129) — *"`ErrorCode` enum 전체(~25개)의 `ERROR_KO` 화는 일괄 강제하지 않는다… 강제 parity 는 graphWarningRule 전체 + 명시 등록된 user-facing API 코드 집합으로 한정"*, 자동 가드(P3-C-2, L133)는 현재 `GRAPH_VALIDATION_FAILED` 1건만 강제 대상으로 등록.
- **상세**: `RESOURCE_NOT_FOUND`·`AUTH_REQUIRED`·`FORBIDDEN`·`VALIDATION_ERROR`·`RESOURCE_CONFLICT` 는 강제 등록 집합에 없으므로 `ERROR_KO` 부재가 규약 위반이 아니다. plan 이 이를 "축의 결정이 필요한 별건" 으로 미룬 것은 규약 문언과 어긋나지 않는다.
- **제안**: 조치 불필요.

### [INFO] `code:` frontmatter 인라인 YAML 주석(`15-chat-channel.md`)은 2026-09-06 파서 수정 이후 안전 — 과거 위험 패턴 아님

- **target 위치**: `spec/5-system/15-chat-channel.md` frontmatter `code:` 블록(R-CC-22 근거 주석 2곳).
- **관련 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 표 `code:` 행 각주.
- **상세**: 과거(`review_guard._parse_frontmatter_code`)에는 `code:` 리스트 중간의 `#` 주석 뒤 항목이 파서에서 조용히 유실되는 결함이 있었으나(§2.1 각주, 실측 41개 entry 유실 사례), 2026-09-06 수정 이후 인라인 주석이 안전하다고 명시돼 있다. 이 문서의 `code:` 리스트는 그 이후 관행이므로 위반 아님.
- **제안**: 조치 불필요 — 다만 새로 `code:` 리스트에 주석을 넣는 사람은 여전히 "2026-09-06 이전 파서 결함" 각주를 참고할 필요가 있다는 점만 상기.

---

## 검토했으나 위반 없음으로 확인된 항목 (반증 기록)

- **문서 구조(Overview/본문/Rationale)**: `1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`15-chat-channel.md` 전부 `## Overview` 로 시작, 말미 `## Rationale`(또는 그 하위 `### R-CC-*`) 로 종결 — 3섹션 구조 준수.
- **`15-chat-channel.md` §3.x 번호 중복** (Overview `3.1~3.6` vs 본문 `3.1~3.3`): 새 위반이 아니라 이미 `R-CC-24` 에서 실측·기각 근거와 함께 "인용 규칙(제목 병기)" 으로 정착된 상태 — 재-flag 불필요.
- **`INVALID_BOT_TOKEN` 명명**: `error-codes.md` §4.2 표의 `INVALID_TRIGGER_PARAMETERS`/`INVALID_WEBHOOK_PAYLOAD`/`INVALID_SCHEMA` 와 동일한 `INVALID_<NOUN>` 패턴 — 위반 아님.
- **`chat-channel-adapter.md#112-…` 앵커**: `15-chat-channel.md:378` 이 인용하는 `§1.1.2` 앵커가 실제로 `chat-channel-adapter.md:160` 에 존재 — 링크 정합.

---

## 요약

이번 plan(`trigger-uuid-and-guide-error-codes.md`)은 `spec/` 을 직접 수정하지 않고 `codebase/backend`
(triggers.controller.ts) · `content/docs/**` · `codebase/frontend/src/lib/i18n/**` 를 고친다. 대조
결과 target 영역인 `spec/5-system/`(특히 `15-chat-channel.md`)의 에러 코드 명명·문서 구조·`code:`
frontmatter 관행은 `spec/conventions/**`(error-codes.md·swagger.md·i18n-userguide.md·
spec-impl-evidence.md) 을 이미 준수하고 있으며, plan 이 고치려는 `TRIGGER_NOT_FOUND`/
`RESOURCE_NOT_FOUND` 오귀속·`ERROR_KO` 부재 유예는 모두 spec SoT 와 정합적이다. 유일한 실질
발견은 코드 레벨(`rotateBotToken` 의 `ParseUUIDPipe`/`@ApiParam` 부재, swagger.md §5-4)인데 이는
target spec 문서 자체의 결함이 아니라 plan §A 가 이미 겨냥한 gap이며, 다만 plan 체크리스트가
`ParseUUIDPipe` 만 명시하고 `@ApiParam({format:'uuid'})` 데코레이터 보강은 누락하고 있어 이를
같은 조항의 나머지 절반으로 함께 챙기도록 보완을 제안한다. CRITICAL 은 발견되지 않았다.

## 위험도

LOW
