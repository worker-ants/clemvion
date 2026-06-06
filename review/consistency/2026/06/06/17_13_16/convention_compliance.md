# Convention Compliance Review

**Target**: `spec/5-system/14-external-interaction-api.md`
**Mode**: `--impl-prep` (구현 착수 전 검토)
**Date**: 2026-06-06

---

## 발견사항

### [INFO] 에러 코드 표기 — `TOO_MANY_CONNECTIONS` UPPER_SNAKE_CASE 준수 확인

- target 위치: §5.2 SSE 스트림 규약 ("연결 수 제한 초과 시 `429 Too Many Requests`"), §8.4 Rate Limit 표 ("초과 시 `429 TOO_MANY_CONNECTIONS`")
- 위반 규약: `spec/conventions/error-codes.md §1` (에러 코드는 UPPER_SNAKE_CASE)
- 상세: 본문 §5.2 에서는 "429 Too Many Requests" 라고만 기술하고 에러 코드 문자열은 언급 없으나, §8.4 에서 `TOO_MANY_CONNECTIONS` 로 명시한다. UPPER_SNAKE_CASE 준수 확인 — 문제 없음. 단, §5.2 본문에는 에러 코드 값이 명시되지 않아 §8.4 와 불일치가 있다. 구현 측이 코드 문자열을 놓칠 수 있다.
- 제안: §5.2 SSE 스트림 규약의 "연결 수 제한 초과 시 429 Too Many Requests" 부분에 `TOO_MANY_CONNECTIONS` 코드를 병기. 예: "초과 시 `429 TOO_MANY_CONNECTIONS`" (§8.4 와 일관되게).

---

### [INFO] Swagger 규약 — `@ApiAcceptedWrappedResponse` 래퍼 명시 필요

- target 위치: §10.1 Swagger / API 문서
- 위반 규약: `spec/conventions/swagger.md §5-2` (공용 래퍼 헬퍼 사용 의무), §5-4 체크리스트
- 상세: §10.1 은 `@ApiBearerAuth('interaction-token')` 를 사용해야 함을 명시했으나, 주요 endpoint 가 `202 Accepted` 로 응답(`/interact`, `/cancel`)하는 점에 대해 swagger 래퍼 (`ApiAcceptedWrappedResponse`) 를 쓰도록 안내하지 않았다. 구현자가 `@ApiOkResponse({ schema: { ... } })` 빈 껍데기 패턴(swagger.md §6 금지 패턴)으로 오구현할 위험이 있다.
- 제안: §10.1 에 "응답 코드별 래퍼 헬퍼 사용" 문단 추가. `POST /interact` · `POST /cancel` 은 `ApiAcceptedWrappedResponse`, `GET /status` 는 `ApiOkWrappedResponse`, SSE 엔드포인트는 인터셉터 미경유이므로 래퍼 제외임을 명기.

---

### [WARNING] 성공 응답 body 와 `202 Accepted` — `TransformInterceptor` 봉투 관계 불명확

- target 위치: §5.1 인터랙션 명령 제출, 성공 응답 (`202 Accepted`) JSON 블록
- 위반 규약: `spec/conventions/swagger.md §2-5` (응답 wrapping — TransformInterceptor `{ data: ... }` 반영 의무), §5.1 규약 참조 노트 (§5 공통 봉투 안내)
- 상세: §5 서두에 "아래 §5.1~§5.5 성공 응답은 논리 payload" 라고 공통 안내가 있으나, §5.1 본문의 성공 응답 블록에는 `{ "executionId": ..., "accepted": true, "currentStatus": ... }` 가 **wire format 처럼** 표기돼 있고, §5.1 에 "예외 2: §5.1(`interact`)는 성공 시 `202 Accepted` + body 없음(no-content path)" 라는 주석과 병존해 혼란이 생긴다. 현재 구현 파일(`interaction.controller.ts`)이 어느 형태를 따르는지에 따라 spec 이 부정확할 수 있다.
- 제안: §5.1 성공 응답 JSON 블록 위에 명시적으로 "현재 구현이 no-content(body 없음) 인지 `{ data: { ... } }` 봉투인지" 를 확정해 기술하거나, `// 미구현(body 없음)` 임을 JSON 블록에 inline 주석으로 표기해 혼동을 없앤다.

---

### [INFO] 에러 코드 — `RATE_LIMITED` 신규 코드의 도메인 prefix 부재

- target 위치: §5.1 에러 응답 표 (`429 Too Many Requests` / `RATE_LIMITED`)
- 위반 규약: `spec/conventions/error-codes.md §1` ("도메인 prefix 권장" — `<DOMAIN>_<CONDITION>`)
- 상세: `RATE_LIMITED` 는 도메인 prefix 없이 범용 코드로 표기돼 있다. `error-codes.md §1` 은 `VALIDATION_ERROR` 처럼 "시스템 전역 공용 코드" 는 prefix 없이 쓰는 별개 범주로 인정하므로, `RATE_LIMITED` 가 EIA 전용인지 시스템 전역 범용인지가 불분명하다. 단, §5.1 의 `RATE_LIMITED` 주석에 "(현재 발생하지 않음, Planned)" 라고 명시돼 있어 실제 신규 코드 발행은 아직 없다.
- 제안: 구현 시 `RATE_LIMITED` 가 시스템 전역 코드인지 EIA 한정인지 결정해 `error-codes.md §3` 에 등재하거나 도메인 prefix(`EIA_RATE_LIMITED`)를 부여. 신규 코드는 "처음부터 의미 정확한 이름을 부여" (`error-codes.md §2`) 원칙 적용.

---

### [INFO] spec 문서 구조 — Rationale 섹션 위치 준수 확인

- target 위치: 문서 끝 `## Rationale` (R1~R12)
- 위반 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- 상세: 문서 구조가 Overview → 본문(§3~§12) → Rationale 순서를 정확히 따른다. 위반 없음.

---

### [INFO] frontmatter `pending_plans` 파일 존재 확인

- target 위치: 문서 frontmatter (`pending_plans` 필드)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` (`pending_plans` — `plan/in-progress/` 에 실존 의무)
- 상세: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `plan/in-progress/fix-webchat-sse-field-map.md` 모두 실존 확인. 위반 없음.

---

### [INFO] frontmatter `status: partial` + `pending_plans` 조합 적정성

- target 위치: 문서 frontmatter (`status: partial`, `pending_plans`)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (`status: partial` 시 `pending_plans` 의무)
- 상세: `status: partial` 에 `pending_plans` 2건이 명시돼 규약 준수. 위반 없음.

---

### [WARNING] Inbound Endpoint 경로 표기 일관성 — `:executionId` vs `{executionId}` 혼용

- target 위치: §5.1 HTTP 요청 예시 (`POST /api/external/executions/{executionId}/interact`), §3.2 표 (`:executionId`), §5.3 (`:executionId`), §5.2 코드블록 (`{executionId}`)
- 위반 규약: `spec/conventions/swagger.md §2-3` (Path 파라미터 표기 일관성)
- 상세: spec 본문 내에서 path parameter 표기가 `{executionId}` (OpenAPI 스타일, §5.1·§5.2 HTTP 코드블록)와 `:executionId` (Express/NestJS 스타일, §3.2·§5.3 서술문) 가 혼용된다. 이 자체가 NestJS 구현 코드와 OpenAPI 문서 생성 시 혼동을 유발할 수 있다.
- 제안: HTTP 요청 예시 코드블록에서는 OpenAPI 스타일 `{executionId}` 로, 서술 문장에서는 `:executionId` (NestJS) 로 구분함을 spec 서두 주석으로 명시하거나, 코드블록은 일관되게 OpenAPI 스타일로 통일.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 는 정식 규약 준수 관점에서 전반적으로 양호하다. frontmatter(`id`/`status`/`code`/`pending_plans`) 가 `spec-impl-evidence.md` 규약을 정확히 따르고, 문서 구조(Overview → 본문 → Rationale)도 CLAUDE.md 권장 패턴에 부합한다. Swagger 규약(`swagger.md`) 연관 항목(§10.1)은 `@ApiBearerAuth` scheme 분리를 명시했으나 202 응답에 대한 래퍼 헬퍼 안내가 누락돼 구현 시 오도 위험이 있다(WARNING). 에러 응답 형식은 `{ error: { code, message, details } }` 컨벤션을 채택하고 명시했으며, 에러 코드 표기는 UPPER_SNAKE_CASE 를 유지한다. 단 `RATE_LIMITED` 의 도메인 prefix 결정이 보류 상태이고, §5.1 의 `202` 성공 응답 body 유무가 spec 내에서 자기 모순적으로 기술돼 있어 구현 전 명확화가 권장된다. 이상의 WARNING 2건은 구현 착수 전 spec 내 수정으로 해소 가능하며 채택 차단 수준은 아니다.

## 위험도

LOW
