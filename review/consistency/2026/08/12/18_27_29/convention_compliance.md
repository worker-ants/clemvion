# 정식 규약 준수 검토 — spec/data-flow/ (impl-done)

## 검토 범위 요약

- Target: `spec/data-flow/` 전체 (bundle 에 0-overview.md·1-audit.md·3-execution.md·11-workflow.md·12-workspace.md·2-auth.md·4-file-storage.md·5-integration.md 등 포함), 이번 diff 의 실질 변경은 `spec/data-flow/15-external-interaction.md` 1줄(§2.2 Redis 표의 "선재 갭" 각주 제거)뿐이다.
- 구현 diff(`origin/main...HEAD`)는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`(+spec)·`test/external-interaction.e2e-spec.ts` 3개 코드 파일 — 신규 API 엔드포인트·DTO·컨트롤러 데코레이터 변경 없음.
- 대조 대상 정식 규약: `spec/conventions/error-codes.md`(에러 코드 명명), `spec/conventions/secret-store.md`(secret ref 명명), `spec/conventions/swagger.md`(API 문서 데코레이터), `spec/conventions/migrations.md`(V번호 명명) 등.

## 확인한 항목 (위반 없음)

1. **문서 구조 (Overview/본문/Rationale)** — `15-external-interaction.md`·`0-overview.md`·`1-audit.md`·`3-execution.md`·`11-workflow.md`·`12-workspace.md`·`2-auth.md`·`4-file-storage.md` 등 bundle 내 전 파일이 `## Overview` → 본문(`## 1..N`) → `## Rationale` 3섹션 구성을 따른다. CLAUDE.md/SKILL.md 의 3섹션 권장과 일치.
2. **파일 명명** — `spec/data-flow/{0-overview,1-audit,2-auth,...,15-external-interaction}.md` 는 도메인 폴더 전반(`spec/5-system/`, `spec/4-nodes/`, `spec/2-navigation/`)에서 이미 쓰이는 `0-` prefix + 번호-slug 패턴과 일치한다. 신규 위반 없음.
3. **에러 코드 명명 (`error-codes.md` §1)** — 대상 문서가 언급하는 `TOKEN_EXPIRED`/`TOKEN_REVOKED`/`TOKEN_SCOPE_MISMATCH`/`TOKEN_AUDIENCE_MISMATCH`/`TOKEN_INVALID`/`STATE_MISMATCH`/`EXECUTION_TERMINATED`/`TOO_MANY_CONNECTIONS`/`VALIDATION_ERROR`/`WEBCHAT_IDLE_TIMEOUT` 모두 `UPPER_SNAKE_CASE` + 의미 기반 명명(§1)을 따르고, `TOKEN_*` 처럼 도메인 prefix 그룹화도 규약과 일치. §3 historical-artifact 예외 레지스트리에 새로 등재해야 할 lower_snake_case 코드 신설 없음.
4. **Redis idempotency 캐시 서술 (Schema 매핑 §2.2)** — "`2xx`·`409`·`410` 캐시, `400 VALIDATION_ERROR` 만 제외"라는 표 문구는 이번 diff 로 code(`isErrorStatusCacheable` 닫힌 목록: `409`/`410`만 error-side cache 대상)와 표현이 정합하며, `error-codes.md` 의 코드 표기 규약을 위반하지 않는다. (사실관계 정합성 자체는 consistency-checker 담당 관점이라 본 리뷰의 등급 판단에서는 제외.)
5. **Secret ref 명명 (`secret-store.md` §1)** — 대상 문서 §1.5 의 `secret://triggers/<id>/notification-signing`(및 `.v2`)은 `secret-store.md` §1 URI Scheme 표의 예시(`secret://triggers/{triggerId}/notification-signing`)와 정확히 일치. `wsk_<64hex>` 평문 발급 서술도 secret 자체가 아닌 API 응답 필드 설명으로 scheme 위반 아님.
6. **API 문서 규약 (`swagger.md`)** — 이번 diff 는 컨트롤러/DTO 변경이 없어(§4 관점 대상 파일 無) 데코레이터·DTO 명명 패턴 위반 여지가 없다. 참고로 `swagger.md` §2-1 이 문서화한 `interaction-token` Bearer scheme(`iext_<JWT>`/`itk_<opaque>`) 명명과 대상 문서의 토큰 접두어 서술은 일치한다.
7. **마이그레이션 참조 (`migrations.md` §1)** — 대상 문서가 인용하는 `execution_token (V060)`, `execution.execution_path 의 DROP (V036)` 표기는 `V<번호>__snake_case` 명명 규약과 무관하게 본문 내 참조 형식(`V<NNN>`)으로 일관되게 쓰였다. 위반 없음.

## 발견사항

- **[INFO] §R8 gap 해소를 알리는 전용 Rationale 각주 부재**
  - target 위치: `spec/data-flow/15-external-interaction.md` §2.2 Redis 표(변경 라인) 및 `## Rationale`
  - 위반 규약: 특정 `spec/conventions/*` 항목을 직접 위반하지는 않음 — CLAUDE.md 의 "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 원칙에 대한 **형식 일관성** 제안
  - 상세: 이번 변경은 §2.2 표 각주에서 "⚠️ 현행 구현은 `statusCode >= 400` 전체를 제외해 409·410 이 재현되지 않는다 (선재 갭)" 문구를 삭제하는 방식으로 갭 해소를 반영했다. 반면 같은 문서의 §1.5(Notification signing secret 회전) 갭은 `## Rationale` 에 "§1.5 구현 갭 — 해소 이력 (C3 fix)" 라는 전용 절을 두어 해소 배경을 남기는 house style 이 이미 존재한다. §R8 idempotency 갭 해소는 같은 패턴의 Rationale 각주 없이 표 각주만 조용히 지워, 같은 문서 안에서 "갭 해소를 문서화하는 방식"이 두 가지로 갈린다.
  - 제안: 필수는 아니나, 일관성을 원하면 `## Rationale` 에 "§2.2 idempotency 캐시 닫힌 목록(§R8) 구현 갭 해소" 같은 소절을 추가해 §1.5 C3 fix 항목과 같은 패턴을 유지할 수 있다. 굳이 규약화할 사안이 아니면 이 항목은 반영하지 않아도 무방(현재도 명시적 규약 위반은 아님).

## 요약

이번 PR 의 실질 diff 는 `idempotency.interceptor.ts`(+테스트) 3개 코드 파일에 한정되고, `spec/data-flow/` 쪽 변경은 `15-external-interaction.md` §2.2 표에서 이미 해소된 "선재 갭" 각주 1줄을 제거한 것뿐이다. 대상 문서(및 bundle 에 포함된 다른 data-flow 문서들)는 Overview/본문/Rationale 3섹션 구조, 파일 명명(`0-` prefix + 번호-slug), 에러 코드 `UPPER_SNAKE_CASE`+도메인 prefix, `secret://` URI scheme, swagger Bearer scheme 명명 등 `spec/conventions/**` 의 관련 규약을 모두 준수하고 있으며, 신규 API 엔드포인트·DTO 변경이 없어 API 문서 규약(§4) 관점의 위반 표면도 없다. 유일한 관찰 사항은 Rationale 절의 형식 일관성에 대한 INFO 수준 제안이며 강제 규약 위반은 아니다.

## 위험도

LOW
