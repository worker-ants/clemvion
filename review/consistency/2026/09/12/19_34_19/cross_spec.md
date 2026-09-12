# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-prep: trigger UUID pipe + 가이드 코드 정정)

## 컨텍스트

검토 대상 plan(`plan/in-progress/trigger-uuid-and-guide-error-codes.md`)은 두 축을 한 배치로 닫는다.

- **A**: `TriggersController.rotateBotToken` 의 `:id` 경로 파라미터에 `ParseUUIDPipe` 가 없는 유일한 예외를 제거 (135/136 → 136/136).
- **B**: `content/docs/**`(사용자 가이드 MDX) · `lib/i18n/backend-labels.ts` 및 test 파일이 `404 TRIGGER_NOT_FOUND` 를 chat-channel REST API 의 에러로 잘못 귀속한 6곳 정정, `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 오탈자 2곳 정정.

두 항목 모두 **`codebase/**` (controller·frontend content/i18n) 만 변경**하며 `spec/` 파일은 대상이 아니다(plan 에 `spec_impact` 항목 없음). 따라서 본 Cross-Spec 검토는 "target 초안이 다른 spec 과 충돌하는가" 가 아니라, **`spec/5-system/` 이 이 구현이 딛고 설 다른 영역 spec 과 이미 정합적인가**를 확인하는 게 핵심이다.

## 확인한 교차 지점과 실측

프롬프트 번들이 컨텍스트 예산으로 `spec/5-system/4-,6-,8-,9-,10-,12-,13-,14-,15-,17-` 등 다수 파일과 `spec/2-navigation/2-trigger-list.md` 본문을 절단했으므로, 해당 파일들은 리포지토리에서 직접 열어 대조했다(`spec/`, `codebase/backend/src`, `codebase/frontend/src` 전수 grep 포함).

| 축 | target(`spec/5-system/3-error-handling.md` 등) | 대조 spec | 정합 여부 |
|---|---|---|---|
| Trigger REST API 404 코드 | §1.11 은 `*_NOT_FOUND` 는 전부 404(`RESOURCE_NOT_FOUND`·`MODEL_CONFIG_NOT_FOUND` 등)라고 명시 | `spec/2-navigation/2-trigger-list.md:246` "동시 삭제 시 `404 RESOURCE_NOT_FOUND`" · `spec/5-system/15-chat-channel.md:371` "404 `RESOURCE_NOT_FOUND` — trigger 미존재" (rotate-bot-token 전용 표) | **일치**. rotateBotToken 의 404 는 이미 두 문서 모두 `RESOURCE_NOT_FOUND` 로 선언 — `ParseUUIDPipe` 추가가 이 계약을 바꾸지 않는다 |
| `TRIGGER_NOT_FOUND` 의 범위 | error-handling.md 의 어떤 카탈로그(§1.6~§1.12)에도 `TRIGGER_NOT_FOUND` 미등재 | `spec/data-flow/10-triggers.md:74` `Hk-->>Ext: 404 TRIGGER_NOT_FOUND` (webhook 인입 시퀀스, `hooks.service.ts:120` 이 실제 발신처) | **일치**. SoT 는 이미 webhook 인입 경로로만 정확히 귀속돼 있다. plan 이 고치려는 6곳(MDX 4·`backend-labels.ts`·test)은 전부 `codebase/frontend` 쪽이며 spec 이 아니다 — spec 사이 모순이 아니라 codebase↔spec 어긋남 |
| `Trigger.id` 타입 | error-handling.md·chat-channel.md 모두 UUID 전제로 서술 | `spec/1-data-model.md:238` `id | UUID | PK` | **일치**. `ParseUUIDPipe` 부착이 데이터 모델과 상충하지 않는다 |
| `MCP_ALLOW_INSECURE_URL` 명명 | `spec/5-system/11-mcp-client.md`·`1-auth.md`·`7-llm-client.md`·`conventions/secret-store.md`·`4-nodes/4-integration/1-http-request.md` 전부 `MCP_ALLOW_INSECURE_URL` | `codebase/backend/.env.example:331`·`production-guards.ts`·`mcp.config.ts` 등 코드 전체가 동일 이름 사용 | **일치**. spec 내부·spec↔코드 모두 하나의 이름으로 수렴 — `MCP_INSECURE_URL_ALLOWED` 오기는 `content/docs/**` MDX 2곳에만 있다(spec 문제 아님) |
| Trigger RBAC (rotate 액션) | error-handling.md §1.12 은 rotate-bot-token 을 Editor+ 특권 작업으로 전제 | `spec/5-system/1-auth.md:374` Trigger 행 RBAC 매트릭스(Owner/Admin/Editor=CRUD) · `:431` "Editor+ 가 호출 가능한 특권 작업" | **일치**. 컨트롤러의 `@Roles('editor')` 와 상충 없음 |
| API 규약 400 기본값 | `ParseUUIDPipe` 통과 실패 시 낼 코드는 §1.3 일반 규칙에 위임 | `spec/5-system/2-api-convention.md:1118` "400=`VALIDATION_ERROR`" 기본값 · `data-flow/12-workspace.md` "UUID 검증 강도 비대칭" Rationale 이 이미 `:id` 경로 파라미터엔 `ParseUUIDPipe`(RFC v1–v5)가 기준이라고 명시 | **일치**. 이 plan 은 기존에 문서화된 일반 패턴을 유일한 예외 자리에 맞추는 것이지 새 규칙을 만들지 않는다 |

## 발견사항

이번 구현이 딛고 설 `spec/5-system/`·`spec/2-navigation/2-trigger-list.md`·`spec/data-flow/10-triggers.md`·`spec/1-data-model.md`·`spec/conventions/*` 사이에서 **CRITICAL/WARNING 급 충돌은 발견되지 않았다.** 관련 스펙들은 이미 이 구현이 전제하는 사실(Trigger.id=UUID, rotate-bot-token 404=RESOURCE_NOT_FOUND, TRIGGER_NOT_FOUND=webhook 인입 전용, MCP_ALLOW_INSECURE_URL 단일 명칭, Editor+ RBAC)에 대해 상호 일치한다. plan 이 고치는 어긋남(§B 의 6곳 + MCP 오탈자 2곳)은 전부 **`codebase/frontend/src/content/docs/**` 와 `lib/i18n/**`** 쪽에 있으며 spec 문서 자체는 처음부터 옳게 서술돼 있었다 — 이는 spec-coverage(SoT vs 사용자 가이드 문서) 성격의 어긋남이지 spec 영역 간(Cross-Spec) 모순이 아니다.

- **[INFO]** `rotateBotToken` 의 `@ApiBadRequestResponse` 설명이 `VALIDATION_ERROR`(malformed UUID) 를 명시하지 않음
  - target 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:269-272` (swagger 데코레이터, spec 아님— 참고용)
  - 충돌 대상: 없음(spec 모순 아님). `spec/5-system/2-api-convention.md` §5.3 의 400 기본값 규칙이 이미 일반 규칙으로 커버
  - 상세: `ParseUUIDPipe` 부착 후 malformed `:id` 는 400 `VALIDATION_ERROR` 를 내지만, 컨트롤러의 `@ApiBadRequestResponse` 설명 문자열은 `INVALID_BOT_TOKEN`/`BOT_TOKEN_INVALID`/`CHAT_CHANNEL_*` 네 가지만 나열한다. 이는 코드베이스 문서화 완결성 이슈이며 spec 간 충돌은 아니다(같은 컨트롤러의 나머지 6개 엔드포인트도 동일하게 `VALIDATION_ERROR` 를 swagger 설명에 별도로 적지 않는 관례를 따른다).
  - 제안: 이번 PR 범위 밖. 필요하면 코드 리뷰(`/ai-review`) 단계에서 스타일 정합성으로 다룰 사안이며 spec 갱신은 불필요.

## 요약

target 구현(`ParseUUIDPipe` 부착 + 가이드 문서/라벨 귀속 정정)이 근거로 삼는 `spec/5-system/3-error-handling.md`·`2-api-convention.md`·`1-auth.md`·`15-chat-channel.md` 는 `spec/2-navigation/2-trigger-list.md`·`spec/data-flow/10-triggers.md`·`spec/1-data-model.md`·`spec/conventions/*` 와 대조한 6개 축(트리거 404 코드, TRIGGER_NOT_FOUND 범위, id 타입, MCP 플래그명, RBAC, 400 기본값) 모두에서 이미 상호 일치했다. plan 이 정정하는 어긋남은 spec 문서 자체가 아니라 `codebase/frontend` 의 사용자 가이드·i18n 라벨이 SoT 를 잘못 인용한 자리이므로, 이번 구현 착수를 막을 Cross-Spec 모순은 없다.

## 위험도

NONE
