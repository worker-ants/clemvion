# 정식 규약 준수 검토 — `spec/5-system/`

검토 모드: `--impl-prep` (구현 착수 전 검토), scope = `spec/5-system/` 전체 (15개 파일 + `_product-overview.md`).
대조 대상: `spec/conventions/**` (audit-actions / error-codes / redis-keys / swagger / node-output / conversation-thread /
egress-masking / spec-impl-evidence 등) + `CLAUDE.md` 문서 구조 컨벤션.

참고: 본 worktree(`eia-tracker-groom-7d0396`)는 `origin/main`(merge-base `ee7559635`) 대비 `spec/5-system/` 를
**변경하지 않았다** (`git diff origin/main..HEAD -- spec/5-system/` 결과 없음, 유일한 diff 는 backend 테스트 파일 1개).
즉 아래 발견사항은 이번 작업이 새로 만든 위반이 아니라 **착수 전 현재 target 상태**에 대한 것이다.

## 발견사항

- **[WARNING] `## Overview (제품 정의)` 표준 헤딩 미사용 — 5-system 내 6개 파일**
  - target 위치: `spec/5-system/2-api-convention.md`(L21 `## 1. 기본 원칙`) ·
    `5-expression-language.md`(L18 `## 1. 개요`) · `6-websocket-protocol.md`(L26 `## 1. 연결`) ·
    `7-llm-client.md`(L26 `## 1. 개요`) · `11-mcp-client.md`(L19 `## 1. 개요`) ·
    `16-system-status-api.md`(L14 `## 1. 대상 큐 레지스트리`)
  - 위반 규약: `CLAUDE.md` "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" ·
    `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — `## Overview (제품 정의)` 헤딩 리터럴 지정
  - 상세: 같은 `spec/5-system/` 안에서 9개 파일(`1-auth.md`·`3-error-handling.md`·`4-execution-engine.md`·
    `8-embedding-pipeline.md`·`9-rag-search.md`·`10-graph-rag.md`·`12-webhook.md`·`13-replay-rerun.md`·
    `14-external-interaction-api.md`·`15-chat-channel.md`·`17-agent-memory.md`)는 `## Overview` 또는
    `## Overview (제품 정의)` 헤딩을 명시적으로 쓰는 반면, 위 6개 파일은 바로 `## 1. 개요`(또는 동급) 로 시작해
    본문과 Overview 섹션이 헤딩 레벨로 구분되지 않는다. `status: implemented`(대부분) 인 오래된 문서라 최근
    작업이 만든 결함은 아니지만, "권장" 규약과 문서 안에서도 일관되지 않다 — 특히 이번 그루밍 대상인
    `14-external-interaction-api.md §11` 이 `6-websocket-protocol.md §4.6` 을 표 형태로 참조하는 등 두 문서가
    긴밀히 얽혀 있어, EIA 작업이 이 영역을 추가로 건드릴 때 함께 정리할 기회가 있다.
  - 제안: 신규/개정 작업 시 (a) 6개 파일에 `## Overview (제품 정의)` 헤딩을 소급 추가하거나, (b) 이 6개가
    "기술 규약/프로토콜 참조" 성격이라 제품 PRD 성 Overview 가 불필요하다는 판단이면 그 예외를 SKILL.md 에
    명문화한다(현재는 암묵적 패턴일 뿐 문서화된 예외가 없다). CRITICAL 은 아니므로 이번 EIA 작업 착수를
    막을 사유는 아니다.

- **[INFO] `_product-overview.md` 는 `## Rationale` 미보유 — 규약 의도와 정합**
  - target 위치: `spec/5-system/_product-overview.md`
  - 위반 규약: 없음(정보성) — `CLAUDE.md`/SKILL.md 의 3섹션 구성은 `_product-overview.md` 를 Overview 전용
    분리 파일로 규정하므로 그 파일 자체에 `## Rationale` 이 없는 것은 위반이 아니다.
  - 상세: `spec/5-system/*.md` 전체에서 `## Rationale` 이 없는 파일은 이 파일뿐이며, 이는 설계대로다.
  - 제안: 조치 불요 — 오탐 방지 차원의 확인 기록.

## 정합성이 확인된 항목 (특기할 위반 없음)

- **에러 코드 명명**: `14-external-interaction-api.md` §5.1/§5.5/§6.4 의 전 에러 코드(`VALIDATION_ERROR` ·
  `TOKEN_REFRESH_NOT_IN_WINDOW` · `TOKEN_REFRESH_FORBIDDEN` · `STATE_MISMATCH` · `EXECUTION_TERMINATED` 등)가
  `error-codes.md` §1 `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙을 따른다. `13-replay-rerun.md` 의
  `INVALID_TRIGGER_PARAMETERS`(← `INVALID_INPUT` rename)도 `error-codes.md` §5 Rename 이력 표(#1193, 등급 B)와
  1:1 대응한다.
- **감사 액션 명명**: `1-auth.md §4.1` 의 `trigger.notification_secret_rotated` /
  `trigger.chat_channel_bot_token_rotated` / `trigger.interaction_token_revoked` 가
  `audit-actions.md §1`(`<resource>.<verb>` dot-prefix) + §2.1(과거분사) + §3 레지스트리(2026-08-11 등재)와
  정합한다. `14-external-interaction-api.md` EIA-NX-12/EIA-AU-07 의 인용도 착지한다.
- **Redis 키 명명**: `14-external-interaction-api.md §8.4` 의 `eia:rl:interact:<executionId>` /
  `eia:rl:status:<executionId>` / `eia:notif:rl:<triggerId>` 가 `redis-keys.md` §1(머리 2세그먼트 고정) 및
  §3 전역 인벤토리 포인터와 일치한다.
- **API endpoint 네임스페이스**: `/api/external/executions/:id/*` 가 `2-api-convention.md §2.2` "인증 family
  전용 네임스페이스" 예외 항목에 명시적으로 등재되어 있고 SoT 로 §14 를 가리킨다 — 규칙 위반이 아니라
  문서화된 예외.
- **Swagger/DTO 규약**: `14-external-interaction-api.md §10.1` 의 `@ApiBearerAuth('interaction-token')` 별도
  scheme 도입, `dto/responses/*-response.dto.ts` 명명(`execution-status-response.dto.ts` 등)이
  `swagger.md §2-1`/`§5-1` 패턴과 일치. `getStatus.context` 의 `additionalProperties`/`oneOf` 미채택 판단도
  `swagger.md §1-4 Rationale`(닫힌 union vs 진짜 열린 map 구분, discriminator soundness)과 정합한다.
- **출력 포맷/부재 표현**: `§5.3`의 `context.conversationThread` 키 생략 vs 형제 필드 `null` 관례 구분이
  `2-api-convention.md §5.4`(부재 표현: null vs 키 생략)의 판단 기준 (a)를 명시적으로 인용해 따른다.
- **미구현 필드의 명시적 표기**: `§6 종결 이벤트 필드 집합` 표의 `result.outputs` = "미구현 (Planned)" 이
  `pending_plans:`(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)와 연결되어
  `spec-impl-evidence.md` 의 frontmatter 의무(`status: partial` + `pending_plans`)를 충족한다 — "빈 약속이
  영구 누락"되는 형태가 아니라 추적 가능한 gap 으로 명시됨.

## 요약

`spec/5-system/` 은 대부분 `spec/conventions/**` 와 매우 촘촘하게 상호 참조되어 있고(에러 코드 rename 이력,
감사 액션 레지스트리, Redis 키 인벤토리, Swagger DTO 패턴, 부재 표현 기준 등), 이번 --impl-prep 검토에서
정식 규약을 직접 위반하는 CRITICAL 항목은 발견되지 않았다. 유일한 실질 발견은 문서 구조 규약(Overview 3섹션
권장) 미준수 파일 6개(`2-api-convention.md`/`5-expression-language.md`/`6-websocket-protocol.md`/
`7-llm-client.md`/`11-mcp-client.md`/`16-system-status-api.md`) 이며, 이는 pre-existing 상태이고(이번
worktree 는 `spec/5-system/` 을 변경하지 않음) "권장" 등급이라 구현 착수를 차단할 사유는 아니다. EIA 관련
작업(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)이 `6-websocket-protocol.md` 를 함께
건드리게 되면 헤딩 정리를 곁들이는 것을 권한다.

## 위험도

LOW
