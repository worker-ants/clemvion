# 정식 규약 준수 검토 — `spec/7-channel-web-chat/`

검토 모드: 구현 착수 전 검토 (--impl-prep)
대상: `spec/7-channel-web-chat/{_product-overview,0-architecture,1-widget-app,2-sdk,3-auth-session,4-security,5-admin-console}.md`

> 참고: 호출 payload 에 동봉된 "정식 규약 모음" 은 토큰 캡으로 인해 `spec/conventions/audit-actions.md` 와
> `spec/conventions/cafe24-api-catalog/**` 만 포함되어 있었고 둘 다 본 target 과 직접 관련이 없다. 이에 따라
> 본 검토는 저장소의 `spec/conventions/**` 원본(특히 `swagger.md`·`error-codes.md`·`conversation-thread.md`·
> `interaction-type-registry.md`·`spec-impl-evidence.md`)을 직접 Read 해 대조했다.

## 발견사항

- **[INFO]** 응답 DTO 파일/클래스명이 `swagger.md §5-1` 접미사 패턴(`*-response.dto.ts`)에서 벗어남
  - target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter `code:` — `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` (본문 §3-① 에서도 `EmbedConfigDto` 로 명명 인용)
  - 위반 규약: `spec/conventions/swagger.md §5-1` — "응답 DTO 위치: `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`"
  - 상세: 디렉토리 배치(`dto/responses/`)는 규약을 정확히 따르지만, 파일명·클래스명 모두 `-response` 접미사가 없다(`embed-config.dto.ts` / `EmbedConfigDto`, cf. 같은 모듈의 `webhook-response.dto.ts`). 저장소 전체에서도 `login-history.dto.ts`·`session.dto.ts` 2건이 동일하게 접미사를 생략한 pre-existing 사례라, web-chat 이 새로 만든 drift는 아니고 이미 관용적으로 허용되는 듯하다. 다만 `swagger.md` 에는 `error-codes.md §3` 같은 "historical-artifact 예외 레지스트리"가 없어 이 예외가 명문화돼 있지 않다.
  - 제안: 코드 리네임(`EmbedConfigDto`→`EmbedConfigResponseDto` + 파일 리네임)이 breaking 이 아니므로(내부 타입, wire 필드명 무영향) 정합을 맞추는 편이 가장 깔끔하다. 리네임 비용이 부담되면 `swagger.md §5-1` 에 `error-codes.md` 식 예외 각주를 추가해 `embed-config.dto.ts`/`login-history.dto.ts`/`session.dto.ts` 를 "접미사 생략 허용" 사례로 명문화하는 대안도 가능(규약 갱신 쪽 해법).

## 준수 확인 (참고 — 위반 아님, 교차검증 근거로 남김)

- **출력 포맷 규약(`{ data }` wrapping)**: `0-architecture.md §3`, `3-auth-session.md §3 step2`, `4-security.md §3-①` 모두 `TransformInterceptor` 의 `{ data: ... }` 래핑과 위젯측 `res.data` 언랩을 `swagger.md §2-5`·`api-convention.md §5.1` 인용과 함께 정확히 서술.
- **닫힌 union vs 열린 map**: `0-architecture.md`·`3-auth-session.md` 가 EIA `context`/`conversationThread` 를 property-level oneOf 대상으로 다루지 않고 EIA 문서(§5.3/§R17)를 SoT 로 참조 — `swagger.md §1-4`·Rationale("EIA context 는 봉투만 스키마화")과 정합.
- **ConversationTurnSource 5값**: `1-widget-app.md §2` 메시지 리스트 행의 `presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system` role 축약이 `conversation-thread.md §1.1` 의 backend 5값과 정확히 일치.
- **WaitingInteractionType 4→3 매핑**: `0-architecture.md §3`("EIA 외부 `interactionType` ∈ `form`/`buttons`/`ai_conversation`, 3값" + `ai_form_render`→`ai_conversation` 통합)이 `interaction-type-registry.md §1.1` 의 내부 4값/외부 3값 매핑과 정확히 부합.
- **에러 코드 명명(`WEBCHAT_IDLE_TIMEOUT`)**: `1-widget-app.md §3.1`·EIA §R19 가 `<DOMAIN>_<CONDITION>` prefix 원칙(`error-codes.md §1`)을 따르고, `CHANNEL_` 이 아닌 `WEBCHAT_` 을 택한 이유(Chat Channel 모듈과의 네이밍 혼동 회피)까지 명시적으로 근거화됨. `STATE_MISMATCH`/`EXECUTION_NOT_FOUND` 등도 `UPPER_SNAKE_CASE` 준수.
- **frontmatter `id` 충돌 회피**: `4-security.md` frontmatter 주석("basename `4-security` 와 의도적으로 다름 — 영역 prefix 로 전역 유일")이 `spec-impl-evidence.md §2.1` 의 "같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌 회피" 규칙을 정확히 적용한 사례(문서 예시 `nav-agent-memory` 와 동형).
- **문서 구조 3섹션**: 6개 번호 spec 파일 전부 `## Overview` → 번호 본문 → `## Rationale` 순서를 리터럴하게 준수(`project-planner/SKILL.md §Spec 문서 구조`). `_product-overview.md` 도 다중 spec 영역 규칙대로 별도 파일로 분리되어 있고 area index 로서 6개 sibling 문서를 모두 링크.
- **명명 컨벤션 `0-<name>.md`**: `0-architecture.md` 는 리터럴 `0-overview.md` 는 아니지만, 다른 영역(`0-dashboard.md`/`0-canvas.md`)도 동일하게 자유 네이밍을 쓰는 기존 패턴과 일치 — 위반 아님.
- **forbidden 패턴 미답습**: `srcdoc`/`about:blank` iframe 자가생성 금지(§R5) 준수, `ExecutionContext*` 접두 미사용, `discriminator` 오남용 없음(신규 union 미도입), audit action 인라인 문자열 없음(웹챗 영역은 audit 미관여).

## 요약
`spec/7-channel-web-chat/` 는 API 응답 래핑, 에러 코드 명명, `ConversationTurnSource`/`WaitingInteractionType` 매핑, frontmatter `id` 충돌 회피, 3섹션 문서 구조 등 핵심 정식 규약을 광범위하고 정확하게 교차 참조하고 있어 규약 준수 수준이 매우 높다. 유일하게 발견된 사항은 `EmbedConfigDto`(`embed-config.dto.ts`) 가 `swagger.md §5-1` 의 `*-response.dto.ts` 접미사 패턴에서 벗어난 것인데, 이는 저장소 내 기존 2건(예외)과 동형인 pre-existing 스타일 drift 로 web-chat 영역이 새로 만든 위반이 아니며 wire 계약에 영향이 없는 INFO 수준이다.

## 위험도
LOW
