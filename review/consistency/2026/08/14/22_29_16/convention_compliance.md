# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md` (+ 관련 `spec/5-system/**`)

## 검토 범위
- Target: `spec/5-system/` (impl-prep, 실질적으로 `14-external-interaction-api.md` 가 이번 변경분의 중심)
- 대조: `spec/conventions/**` 전체 (error-codes.md, swagger.md, redis-keys.md, audit-actions.md,
  execution-context.md, spec-impl-evidence.md 등), `spec/5-system/2-api-convention.md`
- 작업 중 diff(uncommitted): `spec/5-system/14-external-interaction-api.md` §6 종결 이벤트 필드 표 /
  `error.code` 관련 Rationale 문구 정정 (durationMs 비용 재서술, `code` non-null 경로 확장 서술)

## 발견사항

- **[WARNING]** `/api/external/*` 네임스페이스 prefix 패턴이 중앙 규약(`2-api-convention.md §2.2`)에
  예외 유형으로 등재돼 있지 않음
  - target 위치: `14-external-interaction-api.md` §5(전체 엔드포인트), §10(`@Controller('external/executions')`
    주석), §12(호환성), Rationale **R11 "외부 endpoint 경로 prefix 분리"**
  - 위반 규약: `spec/5-system/2-api-convention.md §2.2` "명명 규칙" 표. 이 표는 예외 유형을 단 하나만
    등재한다 — `/api/{resource}/{id}/{channel}/{action}` 형태의 RPC-style sub-channel action
    (`rotate-secret`, `revoke-token` 류). `/api/external/executions/...` 처럼 **리소스 앞에 별도
    정적 네임스페이스 세그먼트를 두고 인증 family 자체를 분리하는 패턴**은 §2.1/§2.2 어디에도
    범주화돼 있지 않다.
  - 상세: EIA 자체 Rationale R11 은 이 결정을 충분히 논증하고 있고(라우팅 prefix·인증 family 분리
    필요성), 심지어 "미래 확장 (예: `/api/external/triggers/*`, `/api/external/workflows/:id/runs/*`)
    도 동일 prefix 아래 확장 가능"이라고 **재사용을 명시적으로 전제**한다. 그런데 이 프로젝트는
    반복적으로 "재사용될 결정은 중앙 conventions 문서에 등재"하는 패턴을 따른다 — 예:
    `redis-keys.md §3` 인벤토리, `error-codes.md §3` historical exception registry,
    `audit-actions.md §3` 도메인별 분류 레지스트리. 동일한 잣대라면 `/api/external/*` 도
    `2-api-convention.md §2.2` 표에 두 번째 예외 행으로 등재돼야 다음 spec 작성자가 R11 원문을
    다시 찾아 재논증하지 않고 재사용할 수 있다. 현재는 EIA 문서 내부에만 근거가 있어, 다음에
    유사 패턴(별도 인증 family 를 쓰는 신규 외부 표면)이 생기면 "이게 허용된 패턴인지" 를 처음부터
    다시 판단해야 한다.
  - 제안: `2-api-convention.md §2.2` 표에 "예외 — 별도 인증 family 를 쓰는 top-level 네임스페이스"
    행을 추가하고 `/api/external/*` (→ EIA §R11) 를 대표 사례로 링크. 또는 최소한 §2.2 표 각주에
    "reserved prefix" 로 `/api/external/` 을 언급. 이 자체가 CRITICAL 은 아니다 — 실제 코드/문서
    사이 모순은 없고, 결정도 합리적으로 근거가 있다. 다만 **SoT 분산**(재사용을 스스로 예고한
    패턴이 중앙 규약에 없음)이라 규약 갱신을 권한다.

- **[INFO]** 금번 diff(§6.4)에서 신규로 언급된 에러 코드는 모두 기존 등재 코드 재사용
  - target 위치: §6.4 Rationale `code` non-null 경로 서술 — `WORKER_HEARTBEAT_TIMEOUT` /
    `RESUME_*` / `EXECUTION_QUEUE_WAIT_TIMEOUT` / `WEBCHAT_IDLE_TIMEOUT`
  - 확인: 전부 `UPPER_SNAKE_CASE`(`error-codes.md §1` 표기 규약 준수)이며, `WORKER_HEARTBEAT_TIMEOUT`
    은 `error-codes.md §3` historical registry 에, 나머지는 동일 spec 본문 §6.5/§3.4(EIA-RL-07)에
    이미 정의돼 있어 신규 명명이 아니다. 신규 코드 발행이 아니므로 조치 불요 — 준수 확인 차원의
    기록.

## 교차 확인한 정합 지점 (위반 아님 — 명시적으로 확인됨)

- `interaction:idempotency:<executionId>:<route>:<key>` — `redis-keys.md §3` 인벤토리에 이미
  동일 키가 등재돼 있음(§R8 "캐시 키 스코프"와 정합).
- `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked` /
  `trigger.chat_channel_bot_token_rotated` — `audit-actions.md §3` 레지스트리(2026-08-11)에
  과거분사(§2.1) 패턴으로 등재, dot-prefix 구조(`<resource>.<verb>`) 준수.
- 모든 EIA 표면 전용 에러 코드(`VALIDATION_ERROR`/`STATE_MISMATCH`/`TOKEN_*`/`RATE_LIMITED`/
  `TOO_MANY_CONNECTIONS` 등) — `UPPER_SNAKE_CASE` 준수, `error-codes.md §1` 의미기반 명명 원칙과
  정합.
- `@ApiBearerAuth('interaction-token')` bearer scheme, DTO 위치(`dto/responses/*-response.dto.ts`),
  닫힌 union `oneOf`+`discriminator` 생략 판단(`context` 필드) — `swagger.md §1-4/§2-1/§5-1` 이
  오히려 이 spec 의 실제 사례(`ExecutionStatusDto`/`context`)를 근거로 서술돼 있어 완전히 co-evolved.
- 응답 봉투(`{ data }`)/SSE 예외/`null` vs 키 생략 규칙 — `2-api-convention.md §5.2/§5.4` 가 EIA
  `getStatus` 를 실사례로 직접 인용.
- frontmatter(`id`/`status: partial`/`code:`/`pending_plans:`) — `spec-impl-evidence.md §2/§3` 스키마
  준수. `pending_plans` 경로(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`) 실존 확인.
- 문서 구조 — `## Overview (제품 정의)` → 번호 섹션(§3~§12) → `## Rationale` 3단 구성, CLAUDE.md 의
  Overview/본문/Rationale 권장 구조 준수.

## 요약

target(`14-external-interaction-api.md`)은 파일명·에러 코드 표기·API 응답 봉투·DTO 배치·Redis 키
네임스페이스·감사 액션 명명·frontmatter 스키마 등 검토한 모든 축에서 `spec/conventions/**` 및
`2-api-convention.md`/`spec-impl-evidence.md` 와 정합했다. 특히 이례적으로 여러 conventions 문서
(`error-codes.md`, `swagger.md`, `redis-keys.md`, `audit-actions.md`, `2-api-convention.md`)가
이 spec 의 실제 사례를 인용해 co-evolve 된 상태라, 규약과의 괴리가 거의 없다. 금번 uncommitted
diff(§6.4 durationMs/`code` null 서술 정정)도 신규 명명 없이 기존 등재 코드만 참조해 규약 위반이
없다. 유일한 지적은 `/api/external/*` 네임스페이스 prefix 패턴이 자체 Rationale(R11)에서 재사용을
예고하고 있음에도 중앙 API 명명 규약(`2-api-convention.md §2.2`)에 예외 유형으로 등재되지 않은
점 — 실질적 모순은 아니고 향후 재사용 시 참조 지점을 명확히 하기 위한 규약 보강 권고다.

## 위험도
LOW
