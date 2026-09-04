# Rationale 연속성 검토 — spec/5-system/ (impl-done)

## 검토 범위 요약

- **scope(`spec/5-system`) 델타**: 0개 파일 — 이 브랜치는 spec 문서를 직접 바꾸지 않았다 (정상, CRITICAL 근거 아님).
- **구현 diff**: 2개 파일 / 125줄 — `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` 및 그 `.spec.ts`. `durationMs`/`currentNode`/`context`/`result`/`error` 5개 필드를 `@ApiPropertyOptional` + `field?: T | null` 에서 `@ApiProperty({nullable:true})` + `field: T | null` (optional `?` 제거)로 정정하고, 테스트에 `NULL_PRESENT_FIELDS` 공유 상수 + `required` 축 단언을 추가했다.
- 이 diff 는 `origin/main..HEAD` 상 커밋 시퀀스의 최종 상태다: `d8b7cb93e → cce8a188b → e55b3a74a → 7979d7daf → 499675277 → 441761478 → 145b7ddcd → 5a2acd664` (nullable/required 표기 정합화 연작).

## 대조한 Rationale 출처

1. `spec/5-system/2-api-convention.md` §5.4 "부재 표현 — `null` vs 키 생략" 및 그 `## Rationale`.
2. `spec/5-system/14-external-interaction-api.md` §5.3 (`getStatus` 응답 스펙) + `## Rationale` R17 ("`getStatus` 의 `currentNode`/`context` 실값 노출").
3. `spec/conventions/swagger.md` §1-4 (nested/enum/union) — `ExecutionStatusDto.context` 를 **정확히 이 예시**로 들어 "왜 `@ApiPropertyOptional` 이 아니라 `@ApiProperty({nullable:true})` 인가"를 이미 규정.
4. 커밋 이력 (`git log -S`) — 해당 5필드가 optional 로 선언된 근거가 과거 Rationale 에 있었는지 확인.

## 발견사항

이번 diff 는 CRITICAL/WARNING 대상이 되는 Rationale 충돌을 만들지 않는다. 오히려 세 개의 독립된 spec/convention 문서(§5.4, R17, swagger.md §1-4)가 이미 "이 5필드는 `null`-present, 즉 `@ApiProperty({nullable:true})` + non-optional TS 타입"이라고 명시하고 있었고, 이번 diff 는 코드가 그 문서화된 계약을 뒤늦게 따라간 것이다(§5.4 규칙: "DTO 선언이 wire 를 반영해야 한다"). `swagger.md` §1-4 는 `ExecutionStatusDto.context` 를 정확히 예시 코드로 들며 동일한 최종 형태(`context: ButtonsContextDto | NodeOutputContextDto | null`, `?` 없음)를 이미 규정해 두고 있었다 — 이번 diff 는 그 예시와 실제 코드 사이의 오래된 drift 를 닫는 것이다.

`git log -S "durationMs?: number | null"` 로 이 필드가 optional 로 선언된 최초 시점(`161bae56e`)을 확인했으나, 그 커밋도 해당 spec 필드를 "optional 이어야 한다"는 별도 Rationale 로 정당화한 바 없다 — 단순 구현 시점의 declaration 실수였고, 이후 §5.4/R17 규칙이 문서화되면서 drift 로 남아 있었다. 즉 **"기각된 대안의 재도입"이 아니라, 한 번도 명시적으로 승인되지 않았던 상태를 규칙에 맞춰 정정**한 것이다.

**결정 번복 시 새 Rationale 동반 여부**: 이 연작은 모범적으로 각 단계마다 근거를 남겼다 — `499675277`(83곳 일괄 정정, tsc 판정 근거), `441761478`(83→15 축소, 리뷰 지적 반영), `5a2acd664`(15→5, "내 기준을 나 자신에게 적용 안 함" W2 반영 + `NULL_PRESENT_FIELDS` 상수 추출로 W3 반영), `145b7ddcd`(WS wire 적용 여부는 plan 에 미결로 명시 이관 — 침묵 처리 아님). 결정 번복이 아니라 **기존 spec 규칙(§5.4/R17)을 뒤늦게 만족시키는 정합화**이므로 새 Rationale 작성 의무 자체가 발생하지 않는 유형이다.

**암묵적 가정 충돌**: 없음. R17 의 "SSE 와 REST 가 동일 wire 형식을 공유해야 위젯의 `parseWaitingForInput` 재사용이 성립한다"는 invariant, §5.4 의 "null-present 필드는 `@ApiProperty({nullable:true})` 로 선언한다"는 invariant 모두 이번 diff 로 오히려 더 강하게 보장된다(테스트가 `nullable` 뿐 아니라 `required` 축까지 명시적으로 단언).

## 요약

검토 대상 코드 diff(EIA `ExecutionStatusDto` 의 5개 필드 optional→required 정정 + 테스트 보강)는 `spec/5-system/2-api-convention.md` §5.4, `spec/5-system/14-external-interaction-api.md` R17, `spec/conventions/swagger.md` §1-4 세 곳의 기존 Rationale/규칙과 완전히 정합하며, 오히려 그 문서들이 이미 규정해 둔 최종 형태로 코드를 맞추는 정정이다. `git log -S` 로 확인한 과거 이력에도 이 필드들을 optional 로 유지해야 한다는 별도 결정이나 기각된 대안이 존재하지 않았다. 관련 커밋 연작(`d8b7cb93e`~`5a2acd664`)은 매 단계 축소·정정 근거를 커밋 메시지에 남겼고, 유일한 미결 사항(§5.4 의 WS wire 적용 여부)은 plan 문서로 명시 이관돼 있어 은폐된 번복이 아니다. Rationale 연속성 관점에서 문제되는 지점을 찾지 못했다.

## 위험도

NONE
