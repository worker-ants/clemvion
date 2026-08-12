# 정식 규약 준수 검토 — spec/data-flow/**

## 범위

- 검토 모드: `--impl-done`, diff-base `origin/main`, target `spec/data-flow/`
- 실 diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  + `.spec.ts` 두 파일만 변경 (spec 파일 변경 없음) — idempotency 캐시 손상(엔트리/payload
  두 겹) fail-open 강화. `IDEMPOTENCY_KEY_CONFLICT` 등 wire 계약·에러 코드는 신설되지 않았다.
- 대조한 conventions: `spec/conventions/error-codes.md`(전문), `swagger.md`(전문),
  `migrations.md`(전문), `interaction-type-registry.md`(전문). `execution-context.md` 는
  목차 확인 — ExecutionContext 필드 설계 규약이라 본 diff/target 범위와 무관해 제외.
- target 문서 16개(`spec/data-flow/0-overview.md` ~ `15-external-interaction.md`) 전체의
  Overview/본문/Rationale 3섹션 구성, 파일 명명, 에러 코드 표기를 스캔.

## 발견사항

없음 — CRITICAL/WARNING 급 위반을 찾지 못했다.

## 점검 내역 (근거)

1. **문서 구조 규약** — `grep -l '^## Overview'` / `'^## Rationale'` 로 `spec/data-flow/*.md`
   16개 전수 확인, 16개 전부 두 섹션 보유. 파일명은 전부 `<N>-<kebab-case>.md`, entry 문서
   `0-overview.md` 가 `0-` prefix 규칙(CLAUDE.md) 을 따른다.

2. **명명 규약 — 에러 코드** — `spec/data-flow/15-external-interaction.md` 가 사용하는
   `TOKEN_EXPIRED`/`TOKEN_REVOKED`/`TOKEN_SCOPE_MISMATCH`/`TOKEN_AUDIENCE_MISMATCH`/
   `TOKEN_INVALID`/`STATE_MISMATCH`/`EXECUTION_TERMINATED`/`TOO_MANY_CONNECTIONS`/
   `VALIDATION_ERROR`/`IDEMPOTENCY_KEY_CONFLICT`/`WEBCHAT_IDLE_TIMEOUT` 전부
   `error-codes.md §1` 의 `UPPER_SNAKE_CASE` + 의미 기반 명명을 만족한다(구현 세부·전이적
   맥락을 이름에 박지 않음). 도메인 prefix 는 §1 상 "권장"이며, `TOKEN_*` 계열은
   `2-auth.md` 와 공유하는 prefix-less 공용 어휘로 기존에 정착된 패턴 — 신규 drift 아님.
   `data-flow/*.md` 전체를 대상으로 한 UPPER_SNAKE 스캔(`grep -noE
   "[A-Z_]{4,}_[A-Z_]{2,}"`)에서도 표기 위반 후보는 나오지 않았다.

3. **명명 규약 — 마이그레이션 버전** — `15-external-interaction.md` 가 인용하는
   `execution_token` 테이블 `(V060)` 은 `migrations.md §1` 의 `V<번호>__<snake_case>` 포맷과
   충돌 없음(문서 인용이 번호만 언급, 파일명 자체를 재선언하지 않음).

4. **API 문서 규약(swagger.md)** — 이번 diff 는 컨트롤러·DTO·Swagger 데코레이터를 건드리지
   않는다(`idempotency.interceptor.ts` 는 인터셉터 내부 로직 + private 헬퍼 2개
   `isIdempotencyEntry`/`describeShape` 신설, 둘 다 API 응답 스키마에 노출되지 않는
   내부 타입가드). §5-1 "엔티티 직접 노출 금지", §1-4 "닫힌 union vs 열린 map", §5-4
   체크리스트 등 어느 항목도 적용 대상 변경분이 없다.

5. **출력 포맷 규약** — `15-external-interaction.md §2.2` 의 idempotency 캐시 키 포맷
   (`interaction:idempotency:<executionId>:<route>:<key>`, `{bodyHash, responseJson,
   statusCode}`, 24h, `409`/`410`/`2xx` 닫힌 캐시 대상, `400 VALIDATION_ERROR` 제외)은
   diff 로 바뀐 동작(캐시 엔트리/payload 손상 시 fail-open 신규 처리)과 그대로 정합한다 —
   Rationale "Fail-open 정책의 일관 표기" 절이 이미 "idempotency 저하 = 캐시 미스 다운스트림
   중복 실행 가능" 위험을 명시해 두어, 이번 diff 가 강화한 손상 처리 경로도 기존 서술
   프레임(닫힌 캐시 대상·fail-open·warn) 안에 들어간다. 신규 캐시 목적 값이나 wire 포맷
   변경이 없어 §R8 닫힌 목록을 다시 열 필요도 없다.

6. **금지 항목** — `swagger.md §6` "레거시 패턴"(빈 껍데기 스키마, double-wrap 페이지네이션),
   `error-codes.md §1` 위반(비-UPPER_SNAKE 신규 코드), `migrations.md §3` append-only 위반
   (기존 V파일 수정) 등 명시적 금지 패턴에 해당하는 변경이나 서술을 찾지 못했다.

## 참고 (규약 위반은 아니지만 기록)

- 코드 diff 의 JSDoc 이 인용하는 문구("Redis … 전 경로 fail-open (warn) — 가용성 우선")는
  `15-external-interaction.md §4 외부 의존` 표의 Redis 행과 문자 그대로 일치 — 인용 정합
  확인됨(정본 변경 시 조용히 거짓이 되는 인용 패턴에 해당하지 않음).
- 이번 진단은 `spec/conventions/**` 정합성에 한정한다. spec-본문 vs 구현의 세부 정합성(예:
  캐시 손상 5-경로 표가 `15-external-interaction.md` 본문에 별도로 반영돼야 하는지)은
  본 checker 의 관점(정식 규약 준수) 밖이며 별도 spec-consistency 검토의 영역이다.

## 요약

이번 PR 의 실제 diff(`idempotency.interceptor.ts`/`.spec.ts`)는 spec 문서를 변경하지 않고,
target 으로 지정된 `spec/data-flow/**` 16개 문서는 문서 구조(Overview/본문/Rationale)·파일
명명(`<N>-kebab.md`, `0-` prefix)·에러 코드 표기(`UPPER_SNAKE_CASE`, 의미 기반 명명)·
마이그레이션 버전 인용·idempotency 캐시 포맷 서술 모두 `spec/conventions/**`(error-codes.md,
swagger.md, migrations.md, interaction-type-registry.md 등)와 정합한다. 코드 변경분에는
Swagger 데코레이터·DTO·신규 wire 에러 코드가 없어 API 문서 규약(§4 관점)도 적용 대상이
없다. CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE
