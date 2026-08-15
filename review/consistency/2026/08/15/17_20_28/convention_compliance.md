# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md`

검토 모드: `--impl-prep` (구현 착수 전), scope=`spec/5-system/`
대상 conventions: `spec/conventions/**` (프롬프트 번들이 컨텍스트 예산으로 대부분 절단되어,
`redis-keys.md` / `error-codes.md` / `audit-actions.md` / `swagger.md` / `spec-impl-evidence.md` /
`migrations.md` 는 저장소에서 직접 읽어 대조했다 — `feedback_consistency_spec_mode_budget` 교훈 반영).

## 검토 방법

target 문서가 이번 작업(§R8 "Idempotency-Key 캐시 키 스코프")에서 참조하는 규약을 축으로,
아래 5개 관점을 실측 대조했다:

1. **명명 규약**: Redis 키(`interaction:idempotency:<executionId>:<route>:<key>`), 에러 코드
   (`UPPER_SNAKE_CASE` 전수), 감사 액션(`trigger.notification_secret_rotated` 등), DTO/literal 명명.
2. **출력 포맷 규약**: 응답 봉투(`{ data }`), pass-through 예외, `null` vs 키 생략, 에러 봉투 형태.
3. **문서 구조 규약**: frontmatter 스키마(`id`/`status`/`code`/`pending_plans`), Overview/본문/Rationale
   3섹션, 영역 index(`_product-overview.md`) 링크.
4. **API 문서 규약**: swagger.md §2-1(Bearer scheme 신설)·§5-1(응답 DTO 위치)·§5-2(공용 래퍼).
5. **금지 항목**: redis-keys.md §1 형태 규칙, error-codes.md §1 명명 원칙 위반 여부.

## 발견사항

없음 — 실측 대조한 범위 안에서 CRITICAL/WARNING 위반을 찾지 못했다.

### 대조 상세 (근거 기록)

- **Redis 키 스코프 (§R8 핵심 대상)**: target §R8 "캐시 키 스코프"가 정의하는
  `interaction:idempotency:<executionId>:<route>:<key>` 는 `spec/conventions/redis-keys.md §3`
  전역 인벤토리에 **이미 등재**되어 있고, 그 SoT 포인터(`data-flow/15-external-interaction.md §2.2`)도
  실제로 그 절에 동일 키·동일 스코프 설명이 존재함을 확인했다 (`spec/data-flow/15-external-interaction.md:260`).
  키 형태도 redis-keys.md §1 "머리 2세그먼트 고정(`interaction:idempotency`) + 꼬리 가변(3식별자)"을
  그대로 따른다. R8 Rationale 이 스스로 인용하는 선례(`exec:seq:<executionId>` — "executionId 가 이미
  전역 유일 UUID")도 redis-keys.md 의 실제 서술과 일치한다.
- **에러 코드**: target 전체에서 쓰는 코드(`VALIDATION_ERROR`, `STATE_MISMATCH`, `TOKEN_REVOKED`,
  `RATE_LIMITED`, `TOO_MANY_CONNECTIONS`, `IDEMPOTENCY_KEY_CONFLICT` 등)는 전수 `UPPER_SNAKE_CASE`로
  error-codes.md §1 표기 규율을 따르며, `EXECUTION_TIMEOUT` 처럼 레이어가 겹치는 이름은 이미
  error-codes.md §4 각주가 그 이원화를 명시적으로 다룬다.
- **감사 액션**: target §3.1 EIA-NX-12 / §3.3 EIA-AU-07 이 쓰는
  `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked` 는
  `audit-actions.md §3` 레지스트리에 "구현 (2026-08-11)"로 정확히 동일 표기가 등재되어 있고,
  §3 각주가 "왜 셋으로 갈랐는지 / 왜 `revoked`만 다른지"까지 근거를 남겨 target 서술과 합치한다.
- **Swagger/DTO**: `@ApiBearerAuth('interaction-token')` 신규 scheme 도입은 swagger.md §2-1의
  "혼합/신규 scheme" 절차를 target §10.1이 그대로 인용·준수한다. 응답 DTO 위치
  (`dto/responses/*-response.dto.ts`)도 실제 코드베이스에 `interact-ack-response.dto.ts` /
  `execution-status-response.dto.ts` / `refresh-token-response.dto.ts` 로 존재해 §5-1과 합치한다.
  `EIA_EXECUTION_STATUS_VALUES`(도메인 접두)+`ExecutionStatusLiteral`(`Literal` 접미)도 §5-1의
  형제 DTO enum 공유 패턴과 일치.
- **frontmatter**: `id: external-interaction-api`(kebab-case) · `status: partial` ·
  `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]`(실존 확인) ·
  `code:` 11개 경로(대표 경로 실존 확인) — spec-impl-evidence.md §2 스키마·§3 라이프사이클을
  모두 만족한다.
- **문서 구조**: `## Overview (제품 정의)` → 본문(§1~§12) → `## Rationale` 3섹션 구조,
  `spec/5-system/_product-overview.md` 영역 index 가 `14-external-interaction-api.md` 를
  링크(§spec-area-index 가드 대상)하는 것도 확인했다.
- **출력 포맷**: target §5.3/§5.4의 `null` vs 키 생략 서술은 `2-api-convention.md §5.4`가
  스스로 **정본 사례로 역인용**하고 있어(같은 문서가 EIA §5.3 을 "실사례"로 지목) 정합성이
  이중으로 확인된다. `InteractAckDto` 봉투(§5.4 alias 수정 이력)도 §2-5 pass-through 규칙과 맞는다.

### 소극적으로 검토했으나 위반으로 보지 않은 항목

- **`X-Clemvion-Signature` / `X-Clemvion-Delivery` 커스텀 헤더 접두**: `2-api-convention.md`엔
  헤더 명명을 규율하는 명시적 절이 없다. 다만 동일 접두가 `15-chat-channel.md` ·
  `conventions/chat-channel-adapter.md` · `data-flow/15-external-interaction.md`에서도 이미
  쓰이는 기존 패턴이라(target 이 새로 도입한 게 아님) 위반도 새 관례도 아니다. — INFO 조차
  아니라고 판단해 발견사항에서 제외.

## 요약

이번 검토 대상(§R8 Idempotency-Key 캐시 키 스코프 결정과 그 주변 표면)은 명명(Redis 키·에러
코드·감사 액션)·출력 포맷(응답 봉투·null vs 키 생략)·문서 구조(frontmatter·3섹션·영역 index)·
API 문서(swagger DTO/Bearer scheme) 5개 관점 전부에서 `spec/conventions/**` 의 정식 규약과
1:1로 대조되며 어긋남을 찾지 못했다. 특히 이번 변경의 핵심인 Redis 캐시 키 스코프는
`redis-keys.md` 전역 인벤토리에 이미 등재되어 있고 그 SoT 포인터가 가리키는 절에도 실제
내용이 존재해, 과거 이 저장소에서 반복됐던 "빈 포인터"·"등재 누락" 결함 클래스가 이번
변경에는 나타나지 않았다. git 이력을 봐도 이 문서는 최근까지 여러 라운드의 정합성 정정을
거쳐 규약과의 괴리를 능동적으로 좁혀온 상태였다.

## 위험도

NONE
