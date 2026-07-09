# Convention Compliance 검토 결과 — `spec/7-channel-web-chat/` (impl-done)

> 이 파일은 원래 write 가 차단되어 디스크에 남지 않았던 convention_compliance checker 산출물을
> `journal.jsonl`(`subagents/workflows/wf_4e2e8f5e-06e/journal.jsonl`, agent 응답 원문)에서 복원한 것입니다
> (MEMORY 기록 "Workflow subagent success인데 output파일 부재→journal.jsonl 복원" 패턴). 내용은 agent 최종 응답 verbatim.

All these error codes (`EXECUTION_NOT_FOUND`, `STATE_MISMATCH`, `TOO_MANY_CONNECTIONS`) follow the UPPER_SNAKE_CASE convention correctly per `error-codes.md`. No violations found here.

Based on this thorough review, here are my findings.

### 발견사항

- **[INFO]** 정식 규약 payload 스코핑 누락 — 검토 프로세스 메타 이슈
  - target 위치: 본 checker 에 전달된 `_prompts/convention_compliance.md` 의 "정식 규약 모음 (spec/conventions/)" 섹션 (파일 1237~1584행)
  - 위반 규약: 해당 없음 (target 문서 자체의 위반이 아니라 입력 payload 구성 문제)
  - 상세: orchestrator 가 번들링한 conventions 목록이 `audit-actions.md` + `cafe24-api-catalog/**` 뿐이며, `spec/7-channel-web-chat/**` 가 실제로 인용·의존하는 `conversation-thread.md`·`interaction-type-registry.md`·`error-codes.md`·`swagger.md`·`i18n-userguide.md`·`spec-impl-evidence.md` 는 누락돼 있다. cafe24/audit-actions 는 web-chat 영역과 무관하다. 이는 MEMORY 에 기록된 "impl-prep 대형 spec 영역 payload 오배선" 패턴과 동일 증상이다.
  - 제안: 본 checker 는 이 갭을 파일시스템 직접 Read/Grep 로 우회해 실제 관련 conventions(위 6개 파일)를 별도로 조회·대조했다. 후속 세션에서는 orchestrator 의 convention 선별 로직이 target spec 의 실제 cross-reference(`> 관련:` 헤더, 본문 링크)를 기준으로 번들링하도록 점검 권장.

- **[NONE — 확인 사항, 위반 아님]** `4-security.md` frontmatter `id` 가 파일명과 다름
  - target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter (`id: web-chat-security  # basename ...`)
  - 위반 규약: 아님 — `spec/conventions/spec-impl-evidence.md §2.1` 이 명시하는 "같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다" 예시 패턴과 정확히 일치 (문서 내 인라인 주석으로 근거까지 명시).
  - 상세/제안: 정식 규약을 정확히 준수한 사례로, 리뷰상 문제 없음. 참고로 기록.

### 점검 결과 요약 (위반 없음 확인 항목)

- **문서 구조**: `spec/7-channel-web-chat/` 6개 문서(`0-architecture`~`5-admin-console`, `_product-overview.md`) 모두 `## Overview` / 본문 / `## Rationale` 3섹션 구성을 준수. `0-` prefix·`_product-overview.md` 명명도 CLAUDE.md 규약과 일치.
- **frontmatter**: `id`(kebab-case)/`status`/`code:` 필드 모두 `spec-impl-evidence.md §2` 스키마 준수. `status: implemented` 문서들의 `code:` 글로브도 실제 코드 경로(`codebase/channel-web-chat/**`, `codebase/packages/web-chat-sdk/**`, `codebase/backend/src/modules/hooks/**` 등)와 대응.
- **API 문서 규약(swagger.md)**: 확인한 `EmbedConfigDto`(`codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`)는 JSDoc + `@ApiProperty(description/example)` 패턴 준수, `hooks.controller.ts` 는 `ApiOkWrappedResponse(EmbedConfigDto, …)` 공용 래퍼 사용 — §5-2 규약과 일치. 다만 `dto/responses/embed-config.dto.ts` 파일명이 swagger.md §5-1 권장 접미사(`*-response.dto.ts`)와는 다른데, 이는 target PR 신규 도입이 아니라 `auth/dto/responses/session.dto.ts`·`login-history.dto.ts` 등 기존에도 있는 프로젝트 전역 기존 관행이라 본 target 고유의 위반으로 보기 어려움(INFO 수준, 별건 후속 과제).
- **출력 포맷 규약**: `0-architecture.md §3`·`3-auth-session.md §3`·`R5` 가 명시하는 전역 `TransformInterceptor { data }` 래핑 서술이 `swagger.md §2-5`·`§5` 및 실제 `ApiOkWrappedResponse` 구현과 정합. `4-security.md` 의 `/embed-config` 응답 서술(`{ allowlist, enforce }`)은 `{ data }` 래핑을 재언급하지 않으나 이는 이미 `0-architecture §3`에서 cross-cutting 으로 확립된 사실의 생략(문체상 축약)이며 실제 컨트롤러도 `ApiOkWrappedResponse` 를 사용해 코드와 어긋나지 않음.
- **에러 코드 명명**: 문서에 등장하는 `EXECUTION_NOT_FOUND`·`STATE_MISMATCH`·`TOO_MANY_CONNECTIONS`·`EXECUTION_TIME_LIMIT_EXCEEDED` 등은 모두 `error-codes.md §1` 의 `UPPER_SNAKE_CASE` 규칙 준수.
- **interaction-type-registry / conversation-thread 정합**: `0-architecture.md §3` 의 EIA 외부 `interactionType` 3값(`form`/`buttons`/`ai_conversation`) 서술은 `interaction-type-registry.md §1.1` 의 "내부 4값 ↔ EIA 외부 3값 매핑" 노트와 정확히 일치. `1-widget-app.md` 의 `ai_message.messages[] raw 직접 노출 금지`·`[user-input]…[/user-input] strip` 서술은 `conversation-thread.md §9.4`·`§9.5` 강제 규칙과 정확히 일치하며 인용 섹션 번호도 실제와 맞음(broken link 없음).
- **i18n 규약**: `5-admin-console.md §8` 이 인용하는 `i18n-userguide.md Principle 1·2`(dict 키 경유, ko/en parity)에 맞춰 실제 `lib/i18n/dict/{ko,en}/{sidebar,webChat}.ts` 가 양쪽에 존재함을 확인.
- **금지 항목**: `conversation-thread.md §1.6` 이 금지하는 "정의되지 않은 신규 inline marker" 도입, `swagger.md §6` 이 금지하는 레거시 빈 스키마 패턴 등 target 문서에서 이를 답습하는 사례를 발견하지 못함.

### 요약

`spec/7-channel-web-chat/**` 는 문서 구조(Overview/본문/Rationale)·frontmatter 스키마·DTO/swagger 데코레이터 패턴·에러 코드 명명·`{ data }` 응답 래핑·`interaction-type-registry`/`conversation-thread` cross-cutting 규약·i18n dict parity 등 점검한 모든 축에서 `spec/conventions/**` 를 충실히 준수하고 있으며, 특히 `4-security.md` 의 `id` 오버라이드는 `spec-impl-evidence.md` 가 명시한 예외 패턴을 정확히 따른 모범 사례다. 발견된 유일한 이슈는 target 문서 자체의 결함이 아니라, 본 checker 에 전달된 정식 규약 번들(prompt payload)이 `audit-actions.md`/`cafe24-api-catalog` 만 포함하고 실제 관련 규약(`conversation-thread.md`/`interaction-type-registry.md`/`swagger.md`/`error-codes.md`/`i18n-userguide.md`)을 누락한 오배선(mis-scoping)이었다 — 이는 직접 파일시스템 조회로 보완했다.

### 위험도

NONE
