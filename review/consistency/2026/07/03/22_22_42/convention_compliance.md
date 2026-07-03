# 정식 규약 준수 검토 — spec/5-system/4-execution-engine.md

검토 모드: --impl-prep (M-4 착수 전 target spec 문서 자체의 정식 규약 준수 점검)

## 방법론 메모

전달된 prompt payload(`_prompts/convention_compliance.md`)는 cafe24-api-catalog 관련 conventions 스니펫으로 채워져 있었고 target 문서(`spec/5-system/4-execution-engine.md`)와 무관했다(첨부 규약 선택 오류로 추정). 이에 target 문서 전체(1494줄)를 직접 읽고, 실제로 관련된 정식 규약 — `spec/conventions/error-codes.md`, `spec/conventions/node-output.md`, `spec/conventions/execution-context.md`, `spec/conventions/spec-impl-evidence.md`, CLAUDE.md 문서 구조 규약 — 을 대조해 분석했다.

## 발견사항

- **[INFO]** `INVALID_NODE_CONFIG` 에러 코드가 `error-codes.md` §3 historical-artifact 레지스트리 및 `3-error-handling.md` 카탈로그 어디에도 등재되지 않음
  - target 위치: §5.6 "노드 실행 흐름" step 3 (`handler.validate(rawConfig) → 유효하지 않으면 즉시 실패 (INVALID_NODE_CONFIG)`)
  - 위반 규약: `spec/conventions/error-codes.md` — 카탈로그 SoT 는 `5-system/3-error-handling.md §1`이며, 발행되는 에러 코드는 그곳에 등재되는 것이 원칙(§1 "의미 기반 명명"은 지키고 있으나 카탈로그 등재 여부는 별도 축)
  - 상세: 코드베이스 조회 결과(`execution-engine.service.ts:4556`)에서 실제로 `throw new Error(\`INVALID_NODE_CONFIG: ...\`)` 형태로 발행되며 UPPER_SNAKE_CASE 명명 자체는 준수하지만, 구조화된 `{code, message}` envelope(node-output.md §3.2)이 아니라 `Error.message` 문자열 prefix 로 실려 있다. 이는 pre-flight throw 경로(Principle 3.1)라 `output.error` 표준 형태 대상은 아니므로 §3.2 위반은 아니지만, 코드명이 3-error-handling.md 카탈로그에 없어 client-facing 에러 코드 문서화 완결성 관점에서 갭이다.
  - 제안: 이 갭은 target 문서 자체의 새 결함이 아니라 기존 코드의 pre-existing 상태이며, M-4(fire-and-forget setup 실패 처리) 작업 범위와도 직접 겹치지 않는다. spec 수정이 필요하다면 `3-error-handling.md` 카탈로그에 `INVALID_NODE_CONFIG` 를 등재하는 별건 작업으로 분리 권장 — 본 impl-prep 을 차단할 사유는 아님.

- **[INFO]** §9 "Redis 키 네이밍 컨벤션"이 `spec/conventions/` 가 아닌 spec 본문에 위치
  - target 위치: §9 전체 (Redis 키 패턴·TTL·pub/sub 채널·BullMQ 큐 목록)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "정식 규약" 은 `spec/conventions/<name>.md` 에 저장 원칙
  - 상세: §9.1의 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴은 성격상 명명 규약(convention)에 가깝다. 다만 이 규약은 execution-engine 도메인에 강하게 결합된 인프라 세부(Redis 키·BullMQ 큐 목록)이고, 다른 문서가 재사용할 범용 명명 규칙이 아니라 실행 엔진 자신의 구현 계약 성격이 강하다 — `node-output.md`/`error-codes.md` 처럼 여러 노드·여러 도메인이 참조하는 cross-cutting 규약과는 다른 층위다.
  - 제안: 현행 유지가 합리적(불필요한 분리는 오히려 §9 참조 지역성을 해침). 별도 `spec/conventions/redis-key-naming.md` 로 승격할 실익이 낮다고 판단되면 규약 갱신 불요 — 문서화만 남김.

- **[INFO]** frontmatter/구조 규약은 완전 준수
  - target 위치: 문서 전체
  - 상세: `id: execution-engine`(kebab-case, basename 일치) / `status: partial` / `code:` 배열(글로브 허용, R-1) / `pending_plans:` 배열(4개 실존 경로) — `spec-impl-evidence.md` §2.1 스키마와 정확히 일치. `## Overview` → `## 1~11` 본문 → `## Rationale` 3섹션 구조도 CLAUDE.md·SKILL.md 권장 형태를 준수. `_` prefix·`0-` prefix 오용 없음.

- **[INFO]** 에러 코드 명명·레이어 분리는 error-codes.md 원칙에 정합
  - target 위치: §7.5.1(`INVALID_EXECUTION_STATE` vs REST `INVALID_STATE` vs EIA `STATE_MISMATCH`), §7.5.2(`ExecutionError` typed vs plain Error 분리, `EXECUTION_INTERNAL_ERROR` fallback), §8(`EXECUTION_TIME_LIMIT_EXCEEDED` vs Code 노드 `EXECUTION_TIMEOUT` 레이어 구분)
  - 상세: 모두 UPPER_SNAKE_CASE, 의미 기반 명명(§1), "동일 의미의 서로 다른 레이어별 코드는 의도적 분리"라는 §3/§4 원칙과 정확히 합치한다. `WORKER_HEARTBEAT_TIMEOUT` 재정의(§7.1, 코드명 유지+의미 재정의)도 error-codes.md §3 레지스트리 항목과 1:1로 정합.
  - 발견 없음 — 준수 확인용 기록.

- **[INFO]** node-output.md Principle 0/4/4.2.1 대비 상태 필드·재개 payload shape 전부 정합
  - target 위치: §1.3 (블로킹/재개 컨트랙트, `_resumeState`/`_resumeCheckpoint`/`_retryState`), §1.3 interaction.data 표
  - 상세: `waiting_for_input`/`resumed`/`ended` 3-status 전이, `_resumeCheckpoint`·`_retryState` strip 예외, `interaction.type` enum(`form_submitted`/`button_click`/`button_continue`/`message_received`) 모두 node-output.md 원문과 문자열 단위로 일치.

## 요약

target 문서(`spec/5-system/4-execution-engine.md`)는 frontmatter 스키마(spec-impl-evidence.md), 3섹션 구조(Overview/본문/Rationale), 에러 코드 명명·레이어 분리 원칙(error-codes.md), 노드 출력 상태·재개 payload 규약(node-output.md), 실행 컨텍스트 내부 필드 분류(execution-context.md) 전반에 걸쳐 정식 규약을 정확히 준수하고 있다. 발견된 항목은 모두 INFO 등급으로, 기존부터 존재하던 `INVALID_NODE_CONFIG` 코드의 카탈로그 미등재(별건 후속 권장)와 §9 Redis 네이밍 규약의 위치(현행 유지 권장) 뿐이며 M-4(executeAsync fire-and-forget 처리) 착수를 차단할 CRITICAL/WARNING 은 없다. 참고로 orchestrator 가 전달한 prompt payload 의 "정식 규약 모음" 섹션이 target 과 무관한 cafe24-api-catalog 컨벤션으로 채워져 있어 별도로 관련 규약을 직접 조회해 검증했다 — payload 생성 로직 점검을 권장한다.

## 위험도

NONE
