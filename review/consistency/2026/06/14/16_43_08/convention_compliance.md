# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md` + 구현 diff (diff-base=fc5d832b)
검토 모드: `--impl-done`
검토 일시: 2026-06-14

---

## 발견사항

### [INFO] `@ApiAcceptedResponse` 직접 사용 — 래퍼 헬퍼 미사용

- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` L67, L108 (`@ApiAcceptedResponse({ type: InteractAckDto })`)
- **위반 규약**: `spec/conventions/swagger.md §5-2` — 성공 응답은 공용 래퍼 헬퍼(`ApiAcceptedWrappedResponse(Dto)`)를 사용한다. 단순 `@ApiAcceptedResponse({ type: Dto })` 는 `{ data: ... }` 봉투를 Swagger 스키마에 반영하지 않는다.
- **상세**: `interaction.controller.ts` 의 `POST interact` 와 `POST cancel` 엔드포인트가 `@ApiAcceptedResponse({ type: InteractAckDto })` 를 사용한다. 전역 `TransformInterceptor` 가 응답을 `{ data: ... }` 로 래핑하므로 실제 wire format 은 `{ "data": { "executionId", "accepted", "currentStatus" } }` 이나 Swagger UI 의 응답 스키마는 래핑 없는 `InteractAckDto` 직접 노출로 표시된다. `spec/conventions/swagger.md §5-2` 는 이 케이스를 위해 `ApiAcceptedWrappedResponse(Dto)` 헬퍼를 명시적으로 제공한다.
- **제안**: `@ApiAcceptedResponse({ type: InteractAckDto })` 를 `@ApiAcceptedWrappedResponse(InteractAckDto)` 로 교체. `@ApiOkResponse({ type: RefreshTokenResponseDto })` (L131) 와 `@ApiOkResponse({ type: ExecutionStatusDto })` (L159) 도 동일하게 `ApiOkWrappedResponse` 헬퍼로 교체 대상이다. 단, 이는 Swagger 문서화 정확성 이슈이며 런타임 동작에는 영향이 없다.

---

### [INFO] 응답 DTO 파일명 규약 — `responses.dto.ts` vs `*-response.dto.ts`

- **target 위치**: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts`
- **위반 규약**: `spec/conventions/swagger.md §5-1` — 응답 DTO 위치는 `dto/responses/*-response.dto.ts` 패턴을 명시한다.
- **상세**: 현재 파일명은 `responses.dto.ts` (단수형 없는 집합 파일). 규약이 정의한 패턴은 `dto/responses/<name>-response.dto.ts` 의 하위 디렉토리+개별 파일 형태다. 세 DTO(`InteractAckDto`, `RefreshTokenResponseDto`, `ExecutionStatusDto`)를 한 파일에 모아 `dto/responses.dto.ts` 로 두는 것은 규약의 디렉토리 구조와 다르다.
- **제안**: 규약 방향으로 가려면 `dto/responses/` 하위 디렉토리를 만들고 `interact-ack-response.dto.ts`, `refresh-token-response.dto.ts`, `execution-status-response.dto.ts` 로 분리하는 것이 정석이다. 다만 세 DTO 모두 이 모듈 전용 소규모 파일이라 실용적 한 파일 관리도 흔한 패턴이므로, 규약 갱신(소규모 모듈 예외 허용)을 검토하거나 현 파일명을 유지하며 INFO 수준으로 수용하는 선택도 가능하다.

---

### [INFO] `spec-impl-evidence` frontmatter `pending_plans` — 이번 구현과 연결된 plan 문서 참조 누락

- **target 위치**: `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1 / §3` — `status: partial` 인 spec 의 `pending_plans:` 는 미구현 surface 를 책임지는 plan 을 모두 열거해야 한다.
- **상세**: diff 에서 `TerminalRevokeReconcilerService` (EIA-RL-06 reconciliation sweep) 가 신규 구현됐고 spec `§9.3 / R15` 에 명시된 기능이다. 현재 `pending_plans` 에는 `spec-sync-external-interaction-api-gaps.md` 와 `fix-webchat-sse-field-map.md` 만 있고, 이번 구현(EIA-RL-06 sweep)과 연결된 plan 참조가 없다. 이 구현이 어떤 plan 문서를 통해 추진됐는지 `pending_plans` 추적이 없으면 spec-lifecycle 가드의 plan↔spec 연결고리가 끊긴다. 다만 `pending_plans` 에 없던 plan 이 완료되어 `complete/` 로 이동한 경우라면 `spec-pending-plan-existence.test.ts` 가드는 통과하나 흐름 추적이 불명확하다.
- **제안**: 이번 EIA-RL-06 sweep 구현을 추진한 plan 문서를 확인하고, 완료 처리(plan/complete/ 이동) 또는 frontmatter `spec_impact` 선언이 gate-C 규약(`spec-impl-evidence.md §4.2`)에 따라 처리됐는지 검토한다.

---

## 요약

정식 규약 준수 관점에서 전반적으로 양호하다. 명명 규약(`UPPER_SNAKE_CASE` 에러 코드, `terminal-revoke-reconcile` BullMQ 큐명 kebab-case, `reconcileTerminalRevocations` camelCase 메서드명), 에러 코드 규약(error-codes.md 의 의미 기반 명명 — 기존 코드 재사용), API endpoint prefix 분리(`/api/external/executions/*`), 신규 서비스 파일명 패턴(`terminal-revoke-reconciler.service.ts`), 문서 구조(Overview / 본문 / Rationale 3섹션), frontmatter `id`/`status`/`code`/`pending_plans` 기본 적용, Swagger `@ApiBearerAuth('interaction-token')` 및 `@ApiTags` 배치 모두 규약을 준수한다. 발견된 3건은 모두 INFO 등급으로, Swagger 래퍼 헬퍼 미사용(wire format 과 Swagger 스키마 불일치), 응답 DTO 파일명 패턴 경미 차이, plan 추적 연결 누락이다. CRITICAL·WARNING 수준의 규약 위반은 없다.

## 위험도

LOW
