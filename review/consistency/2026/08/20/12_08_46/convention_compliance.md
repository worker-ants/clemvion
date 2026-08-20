STATUS=success convention_compliance: 2 findings (0 CRITICAL, 0 WARNING, 2 INFO) — target=spec/5-system/14-external-interaction-api.md
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md`

검토 모드: `--impl-prep`, scope=`spec/5-system/`. Target 은 `spec/5-system/14-external-interaction-api.md`
(1713줄) 전문을 직접 읽고, 교차 인용된 정식 규약 (`spec/conventions/error-codes.md` ·
`swagger.md` · `redis-keys.md` · `secret-store.md` · `audit-actions.md` · `interaction-type-registry.md` ·
`execution-context.md` · `spec-impl-evidence.md` · `chat-channel-adapter.md`) 및 `spec/5-system/2-api-convention.md`
을 직접 열어 대조했다 (bundle 프롬프트가 컨텍스트 예산으로 절단한 파일들은 실제 저장소 파일을 `Read` 로 직접 확인).

## 검토 방법 및 범위

- 프레임워크(`.claude/skills/project-planner/SKILL.md`)의 spec 문서 구조 규약(3섹션 `## Overview (제품 정의)` /
  본문 / `## Rationale`, `spec/<영역>/N-name.md` 명명)과 target 의 실제 구조를 1:1 대조.
- frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)를 `spec-impl-evidence.md` §2 와 대조하고,
  `code:` 글로브 15개 전부·`pending_plans:` 경로 1개를 파일시스템에서 직접 존재 확인.
- 본문이 인용하는 다른 spec/convention 문서의 앵커(`#절-번호`)를 대상 문서에서 `grep` 으로 실존 확인
  (`2-api-convention.md` §5/§5.3/§5.4/§6, `4-execution-engine.md` §1.1/§1.2/§1.3/§7.4/§7.5/§7.5.1/§7.5.2/§8/§9.2/§9.3,
  `node-output.md` Principle 7, `execution-context.md` 원칙 3·4, `chat-channel-adapter.md` §1.3, `redis-keys.md` §3,
  `secret-store.md` §1, `audit-actions.md` §3, `data-flow/15-external-interaction.md` §1.2/§2.2).
- 에러 코드 명명(UPPER_SNAKE_CASE·의미 기반 원칙), Redis 키 형태, secret 보관 예외, 감사 액션 명명, Swagger DTO/컨트롤러
  데코레이터 패턴, URL 명명 규칙(`2-api-convention.md §2.2`)을 개별 대조.

## 발견사항

### [INFO] `X-Refresh-Token-Url` 헤더가 문서 내부의 벤더 접두 패턴과 다르다
- target 위치: §5.1 말미 "`X-Refresh-Token-Url` 헤더 (모든 401 토큰 실패 공통)" 콜아웃, §5.5 도입부
- 위반 규약: 명시적 규약 위반은 아님 — `spec/5-system/2-api-convention.md` 에 전역 커스텀 헤더 접두 규칙이 없고,
  기존 헤더도 `X-Workspace-Id`/`X-RateLimit-*`/`X-API-Key` 등 벤더 접두 없이 혼용되고 있어 프로젝트 전체
  차원의 "정식 규약" 은 존재하지 않는다.
- 상세: 그러나 **같은 문서** §6.1 의 outbound notification 헤더 6종(`X-Clemvion-Event` / `-Execution-Id` /
  `-Trigger-Id` / `-Workflow-Id` / `-Delivery` / `-Timestamp` / `-Signature`)은 모두 `X-Clemvion-` 벤더
  접두로 일관되게 명명되어 있다. 같은 스펙의 inbound 표면에서 신설하는 유일한 커스텀 응답 헤더
  `X-Refresh-Token-Url` 만 이 국소 패턴을 따르지 않는다(`Idempotency-Key`/`Last-Event-Id` 는 표준
  HTTP/SSE 헤더라 예외가 자연스럽지만, `X-Refresh-Token-Url` 은 이 spec 이 만든 자체 헤더다).
- 제안: 정식 규약을 새로 만들 정도는 아니나, `X-Clemvion-Refresh-Token-Url` 로 통일하면 동일 spec 안의
  outbound/inbound 커스텀 헤더 명명이 한 벡터로 수렴한다. 이미 구현·e2e 가 현재 이름에 결속돼 있다면
  (에러 코드 rename 과 동형의 breaking 비용) 굳이 rename 하지 않고 이 caveat 를 spec 에 한 줄 남기는
  선택도 합리적 — 결정을 내리지 않는 것 자체가 문제는 아니다.

### [INFO] §10.1 Swagger 신규 Bearer scheme 서술에 구현 상태 라벨이 빠져 있다
- target 위치: §10.1 "Swagger / API 문서" — "`main.ts` 에 신규 Bearer scheme 등록: `interaction-token` (...)"
- 위반 규약: 명시적 규약 위반은 아님 — 문체 일관성 관찰.
- 상세: `spec/conventions/swagger.md` §2-1 은 이미 "main.ts는 추가로 **`interaction-token`** Bearer scheme 도
  등록합니다" 라고 **현재형/기정 사실**로 적고 있어, 이 확장이 이미 구현·반영된 상태임을 시사한다. 반면
  target §10.1 은 "등록: interaction-token" 을 지시문처럼 서술할 뿐, 이 문서가 다른 항목들(예: EIA-NX-06,
  EIA-NX-11, EIA-IN-07)에서 일관되게 쓰는 **"구현됨"** 마커를 붙이지 않는다. frontmatter `status: partial` 인
  문서라 이 절만 놓고 미구현으로 오독될 여지가 있다(실제로는 swagger.md 쪽 서술과 `interaction.controller.ts`
  코드 SoT 인용으로 미루어 구현된 것으로 보인다).
- 제안: §10.1 에도 다른 §3.x/§5.x/§6.x 처럼 "(구현됨)" 라벨을 붙이거나, 최소한 swagger.md §2-1 과 표현 시제를
  맞춘다. 이 문서 자신이 §5.2 에서 "이 항목은 2026-07-17 에 닫혔으나 본 §5.2 만 '미배선' 서술로 남아 있었다"는
  형태의 stale 서술을 스스로 경계하고 있으므로, 같은 유형의 소소한 표류를 미리 방지하는 차원의 제안이다.

## 정식 규약과의 정합 — 긍정 확인 사항 (참고용, 발견사항 아님)

아래는 위반이 아니라 검토 과정에서 실측으로 확인한 **정합** 사례다. 이 spec 이 이례적으로 촘촘하게
convention 과 교차 동기화되어 있다는 근거로 남긴다.

- **문서 구조**: `## Overview (제품 정의)` → 본문(§3~§12) → `## Rationale` 3섹션이 `project-planner/SKILL.md`
  §Spec 문서 구조와 정확히 일치. 파일명 `spec/5-system/14-external-interaction-api.md` 도 `N-name.md` 명명과 일치.
- **frontmatter**: `id`/`status: partial`/`code:`(15개 glob)/`pending_plans:`(1개 경로) 모두
  `spec-impl-evidence.md` §2 스키마 준수. `code:` 15개 파일 전부·`pending_plans:` 경로 전부 저장소에 실존 확인.
- **URL 명명**: `/api/external/executions/:id/*` 는 `2-api-convention.md §2.2` 가 "예외 — 인증 family 전용
  네임스페이스" 로 **본 spec 을 SoT 로 명시**하며 정확히 같은 예시(`/api/external/executions/:id`,
  `/api/external/executions/:id/interact`)를 든다 — 이미 규약 자체에 역참조로 등재된 승인된 예외.
- **에러 코드**: `VALIDATION_ERROR`/`TOKEN_*`/`STATE_MISMATCH`/`EXECUTION_TERMINATED`/`RATE_LIMITED` 등
  전부 UPPER_SNAKE_CASE, `error-codes.md` §1 의미 기반 명명 원칙 준수. `EXECUTION_TIMEOUT` 동명 코드
  레이어 충돌은 `error-codes.md` §4 캐비엇이 이 spec 을 정확히 지목해 이미 해소.
- **Swagger**: `interaction-token` Bearer scheme, `@ApiBearerAuth`, `dto/responses/*-response.dto.ts` 파일
  명명, `context` 필드의 닫힌 union → `oneOf`(discriminator 미사용) 전부 `swagger.md` §2-1/§5-1/§1-4 와
  일치 — 오히려 `swagger.md` §1-4/Rationale 의 worked example 자체가 이 spec 의 `ExecutionStatusDto.context`
  사례를 원용하고 있어 두 문서가 상호 참조로 고정돼 있다.
- **Redis 키**: `eia:rl:interact:<executionId>` / `eia:rl:status:<executionId>` / `eia:notif:rl:<triggerId>`
  가 `redis-keys.md` §3 전역 인벤토리에 동일 문자열로 등재.
- **Secret 보관**: `Trigger.config.interaction.triggerToken` 평문 보관이 `secret-store.md` §1 의 "비대상"
  예외로 자기 근거(a~c)와 함께 별도 등재되어 있고, target §7.1 캐비엇과 표현이 정합.
- **감사 액션**: `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked` 가
  `audit-actions.md` §3 레지스트리에 과거분사 패턴(§2.1)으로 등재, target §3.1/§3.3 인용과 일치.
- **interactionType enum**: 외부 3값(`form`/`buttons`/`ai_conversation`)이 내부 4값(`ai_form_render` 포함)의
  파생 뷰라는 점이 `interaction-type-registry.md` §1.1 에 명시적으로 EIA §6.2 를 SoT 로 지목하며 정합.
- **anchor 무결성**: 본문이 인용하는 `2-api-convention.md`/`4-execution-engine.md`/`node-output.md`/
  `execution-context.md`/`chat-channel-adapter.md`/`data-flow/15-external-interaction.md` 의 절 번호
  앵커 전부 대상 문서에 실존.

## 요약

target 문서는 정식 규약(`spec/conventions/**`) 준수 관점에서 매우 높은 정합도를 보인다. 명명 규약(URL·에러
코드·Redis 키·감사 액션), 출력 포맷 규약(응답 봉투·부재 표현·닫힌 union `oneOf`), 문서 구조 규약(3섹션·
frontmatter 스키마), API 문서 규약(Swagger DTO/Bearer scheme 패턴), 금지 항목(secret 평문 보관 등) 전 영역에서
명시적 위반을 찾지 못했다. 오히려 다수의 conventions 문서(`error-codes.md`·`redis-keys.md`·`secret-store.md`·
`audit-actions.md`·`swagger.md`·`2-api-convention.md`·`interaction-type-registry.md`)가 이 spec 을 직접
인용하거나 이 spec 의 사례를 예외/예시로 등재하는 양방향 동기화 상태였다. 발견한 두 건은 모두 규약 위반이
아니라 같은 문서 내부의 국소 표기 일관성(커스텀 헤더 접두, 구현 상태 라벨 부재)에 대한 INFO 수준 제안이다.

## 위험도
NONE
