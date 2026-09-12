# Rationale 연속성 검토 — `plan/in-progress/trigger-uuid-and-guide-error-codes.md` (scope: `spec/5-system/`)

## 검토 범위 및 방법

`--impl-prep` 모드이며 `spec/5-system/` 자체는 이번 배치에서 수정되지 않는다(코드·`content/docs/**`·`lib/i18n/**` 만 변경). 따라서 "target 문서"는 실질적으로 착수 예정 plan(`trigger-uuid-and-guide-error-codes.md`)이고, 이 plan 이 번들에 포함된 spec 들의 `## Rationale` 이 이미 내린 결정·기각한 대안·확립한 invariant 를 건드리는지를 검사했다. 번들에서 컨텍스트 예산으로 생략된 `12-webhook.md`·`14-external-interaction-api.md`·`1-data-model.md`(일부) 등은 실제 저장소 파일을 직접 열어 대조했고, plan 이 인용한 소스 실측(`triggers.controller.ts`, `hooks.service.ts`, `.env.example`)도 직접 grep 으로 재확인했다.

## 발견사항

검토 관점 1~4 (기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / 암묵적 가정 충돌) 어디에도 해당하는 CRITICAL·WARNING 사항을 찾지 못했다. 아래는 그 판단 근거와, 소급 여지가 있어 기록해 두는 INFO 항목이다.

- **[INFO] 항목 A(`rotateBotToken` ParseUUIDPipe 추가)는 기각 대안 재도입이 아니라 기존 원칙의 결손 보정이다**
  - target 위치: plan §A "처분"
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` Rationale `### X-Workspace-Id 헤더 vs :id 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)` — "왜 경로 파라미터는 엄격해도 되는가... 없는 리소스는 어차피 404" 및 `spec/5-system/3-error-handling.md §1.3` `VALIDATION_ERROR`(X-Workspace-Id 형식 오류) 항목의 "조기 거부가 없으면 QueryFailedError(22P02)가 GlobalExceptionFilter 의 어떤 분기에도 안 걸려 500 INTERNAL_ERROR 로 마스킹된다" 서술.
  - 상세: 이 Rationale 은 "경로 파라미터는 엄격한 UUID 파싱(ParseUUIDPipe)이 기본, 헤더는 느슨해야 한다"는 원칙을 이미 확립해 두었다. 실측(`triggers.controller.ts` 6개 형제 엔드포인트 전부 `@Param('id', ParseUUIDPipe)`, `rotateBotToken` 만 순수 `@Param('id')`)과 컨트롤러 자신의 `@ApiNotFoundResponse({ description: 'RESOURCE_NOT_FOUND — trigger 미존재 또는 워크스페이스 권한 없음' })` 선언을 대조하면, 이 엔드포인트는 "의도된 예외"가 아니라 **선언(404 계약)과 실제 동작(비-UUID 입력 시 500) 이 어긋난 outlier**임이 확인된다. 이 자리에 ParseUUIDPipe 를 붙이는 처분은 기존 Rationale 이 정의한 경로-파라미터 엄격성 원칙을 그대로 따르는 것이며, 과거에 이 엔드포인트만 예외로 두기로 한 결정의 흔적(주석·커밋·spec 문구)은 어디에도 없다 — 오히려 가장 최근 배치(`#1326`, 이 endpoint 를 손댐)조차 이 갭을 남겨 두고 다른 축(에러 봉투 통합)만 정리했다.
  - 제안: 없음(정합). plan 이 이미 이 Rationale 을 인용하며 근거를 세웠으므로 그대로 진행 가능. 다만 구현 커밋 메시지에 "UUID 검증 강도 비대칭" Rationale 을 명시적으로 인용해 두면, 다음 검토자가 "왜 이 컨트롤러에만 새 가드를 추가했는가"를 다시 조사하지 않아도 된다.

- **[INFO] 항목 B 의 `TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND` 정정은 기존 카탈로그와 정합하며 새 결정이 아니다**
  - target 위치: plan §B 축 2, "그래서 이 클래스는 네 곳이 아니라 여섯 곳이다"
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §1.3` (`RESOURCE_NOT_FOUND | 리소스 없음 | 404` 기본값 카탈로그), `spec/data-flow/10-triggers.md:74`(`TRIGGER_NOT_FOUND` 는 webhook 인입 시퀀스 전용) — 실제 코드도 `hooks.service.ts:120` 한 곳만 이 코드를 발행한다(전수 grep 확인).
  - 상세: guide 문서(`telegram.mdx` 등)가 트리거 REST API(`rotate-bot-token` 등)의 404 를 `TRIGGER_NOT_FOUND` 로 잘못 적었던 것은, 컨트롤러 자신의 Swagger 선언(`RESOURCE_NOT_FOUND`)과도, 카탈로그 SoT 와도 어긋나는 **문서만의 오류**였다. 정정은 새 결정이 아니라 이미 서 있는 카탈로그로 되돌리는 것이라 Rationale 번복에 해당하지 않는다.
  - 제안: 없음(정합).

- **[INFO] `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 정정도 동일 성격**
  - target 위치: plan §B 축 1 "환경변수 오기"
  - 과거 결정 출처: `spec/5-system/11-mcp-client.md` (production fail-closed 강제 Rationale, refactor 04 M-7) 가 `MCP_ALLOW_INSECURE_URL` 을 유일한 이름으로 일관되게 사용.
  - 상세: 코드(`mcp.config.ts`, `.env.example:331`)·spec·테스트 전부 `MCP_ALLOW_INSECURE_URL` 만 쓰고 `MCP_INSECURE_URL_ALLOWED` 는 어디에도 없다. 오타 정정이며 Rationale 위반 소지 없음.
  - 제안: 없음(정합).

- **[INFO] 항목 C(등재만 하고 고치지 않는 5개 에러 코드)가 남겨두는 문서-스펙 간극**
  - target 위치: plan §C "이번 배치에서 하지 않는 것"
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §1.4` 본문(Rationale 절은 아님) — "구 에러 코드 `NODE_EXECUTION_FAILED` / `INTEGRATION_ERROR` / `LLM_ERROR` 는 노드 수준 envelope 에 더 이상 사용하지 않는다."
  - 상세: plan 은 guide 문서가 언급하는 `NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`(및 근접 오기 `LLM_AUTH_ERROR` 등)를 "대응하는 실재 코드를 먼저 확정해야 한다"는 이유로 이번 배치에서 고치지 않고 트래커에만 등재한다. 이 코드들은 spec 본문이 이미 "은퇴"로 선언한 이름이라, 남겨진 guide 문서는 계속 은퇴된 코드가 살아 있는 것처럼 사용자에게 노출한다. 이는 plan 이 스스로 만든 결함이 아니라 **기존 결함을 방치**하는 결정이고, plan 은 그 방치 이유를 명시(코드 확정 불가)했으므로 "무근거 번복"에는 해당하지 않는다. 다만 §1.4 의 "더 이상 사용하지 않는다" 선언을 별도로 인용해 두면 트래커 항목이 이 문서를 SoT 로 참조하기 쉬워진다.
  - 제안: 후속 트래커 항목(`spec-draft-nullable-notation-followups.md`)에 `spec/5-system/3-error-handling.md §1.4` "구 에러 코드... 더 이상 사용하지 않는다" 문구를 근거로 명시하는 것을 권장(선택 사항, 필수 아님).

## 요약

plan 이 이번 impl-prep 대상으로 삼은 두 항목(트리거 `rotateBotToken` 의 `ParseUUIDPipe` 부재 보정, 유저 가이드/코드 주석의 오귀속 에러 코드·환경변수명 정정)은 `spec/5-system/` 및 `spec/data-flow/12-workspace.md` 의 기존 `## Rationale` — 특히 "UUID 검증 강도 비대칭"과 §1.3 의 500-마스킹 서술, `RESOURCE_NOT_FOUND` 기본 카탈로그, `MCP_ALLOW_INSECURE_URL` 명명 — 을 뒤집거나 기각된 대안을 되살리는 것이 아니라, 오히려 그 결정들이 이미 요구하는 상태로 outlier 를 정렬시키는 작업이다. 실측(컨트롤러 소스·`.env.example`·`hooks.service.ts`)도 plan 의 주장과 일치했다. 유일한 잔여 사항은 은퇴된 에러 코드 3~5종을 이번 배치에서 고치지 않고 트래커로 미루는 결정인데, plan 이 그 사유(대응 코드 미확정)를 명시했으므로 Rationale 연속성 위반이 아니라 정보성 참고 사항으로만 남긴다.

## 위험도

NONE
