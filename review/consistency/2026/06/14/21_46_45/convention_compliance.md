# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/6-presentation/4-form.md` (spec 문서) + git diff (구현 변경 사항)
검토 모드: `--impl-done` (diff-base=main)

---

## 발견사항

### [INFO] Swagger `@ApiBadRequestResponse` description 이 인라인 문자열 — 에러 DTO 참조 미사용

- target 위치: `codebase/backend/src/modules/executions/executions.controller.ts` diff 내 `@ApiBadRequestResponse({ description: 'VALIDATION_ERROR ...' })`
- 위반 규약: `spec/conventions/swagger.md §5-5 에러 응답 참조` — `@ApiBadRequestResponse({ type: ErrorResponseDto })` 로 참조하는 것을 권장
- 상세: 새로 추가된 `@ApiBadRequestResponse` 는 `description` 문자열만 사용하고 `ErrorResponseDto` 를 type 참조하지 않는다. 기능적 결함은 아니지만 swagger.md §5-5 의 권장 패턴(`{ type: ErrorResponseDto }`)과 거리가 있다.
- 제안: `@ApiBadRequestResponse({ type: ErrorResponseDto, description: '...' })` 형태로 보강하거나, 기존 컨트롤러의 동일 패턴(인라인 description 사용)이 이미 정착된 규범이라면 규약 갱신 불필요 (현재 코드베이스 대다수가 description 만 사용).

---

### [INFO] `interaction.controller.ts` `@ApiBadRequestResponse` description 길이 — 권장 범위 초과

- target 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` diff `description: 'VALIDATION_ERROR (form field — details[]) / INVALID_COMMAND ...'`
- 위반 규약: `spec/conventions/swagger.md §3 주석/설명 톤` — description 은 10~40 자 내외 권장
- 상세: 변경된 description 은 권장 길이 범위를 초과한다. 기존 description 도 같은 길이였으므로 이번 변경이 신규 위반을 만든 것은 아니다.
- 제안: 필요 시 줄이되, 동 컨트롤러의 다른 `@ApiBadRequestResponse` 도 같은 수준의 길이를 유지하므로 프로젝트 내 일관성은 충족된다. 무시 가능.

---

### [INFO] `idempotency.interceptor.ts` 주석 내 이전 코드명 정정 완료 확인 (규약 준수 방향)

- target 위치: `idempotency.interceptor.ts` diff — `VALIDATION_FAILED` → `VALIDATION_ERROR` 로 두 곳 정정
- 위반 규약: 없음 — 이번 변경이 `spec/conventions/error-codes.md §1` 의미 기반 명명 규약 및 `spec/5-system/14-external-interaction-api.md §5.1` EIA spec 과 일치하도록 구 코드명(`VALIDATION_FAILED`)을 제거한 것
- 상세: 변경 전 코드(`VALIDATION_FAILED`)는 spec 에 정의된 코드가 아니었으며 이번 diff 에서 `VALIDATION_ERROR` 로 정정됨. 규약 준수 방향으로의 수정.
- 제안: 추가 조치 불필요.

---

## 주요 규약 적합성 (합격 항목)

1. **에러 코드 명명**: 신규 추가된 `VALIDATION_ERROR` / `INVALID_FIELD` 는 `spec/conventions/error-codes.md §1` 의미 기반 명명 원칙을 충족한다. `VALIDATION_ERROR` 는 `3-error-handling.md §1.1` 에서 "시스템 전역 공용 코드(prefix 없음)" 로 규정된 카테고리에 속하며, `error-codes.md §1 도메인 prefix` 항목이 명시적으로 이 패턴을 허용한다. `INVALID_FIELD` 는 세부 field 실패 사유를 정확히 기술한다.

2. **출력 포맷 규약**: 구현의 에러 응답 shape `{ error: { code, message, details: [{ field, message, code }] } }` 는 `spec/5-system/14-external-interaction-api.md §5.1` 의 예시 shape 과 일치하며, EIA spec 이 정의한 `details[]` 계약을 따른다.

3. **금지 항목**: spec `form.md §5.4 / §5.5` 의 금지 필드(`output.type`, `output.view`, `output.submittedData`, `output.fields` 등)가 구현 diff 어디에도 등장하지 않는다. `node-output.md Principle 1.1.4` 위반 없음.

4. **FormValidationError 클래스 명명**: `PascalCase` 클래스명, `UPPER_SNAKE_CASE` ErrorCode, `camelCase` 필드 — `node-output.md §3.2` 표기 규약 준수.

5. **문서 front matter 구조**: 이번 diff 는 spec 문서(`4-form.md`)를 변경하지 않으므로 spec 문서 구조 규약 검토 대상이 아니다.

6. **구 코드명 `VALIDATION_FAILED` 완전 제거**: interaction.controller, idempotency.interceptor, 프론트엔드 문서(triggers.mdx / triggers.en.mdx)의 구 코드명이 `VALIDATION_ERROR` 로 통일 완료. 단일 규약 준수 달성.

---

## 요약

이번 diff (EIA form validation — W-1~W-3 + G 테스트)는 정식 규약(`spec/conventions/error-codes.md`, `spec/conventions/node-output.md`, `spec/conventions/swagger.md`, `spec/5-system/14-external-interaction-api.md`)과 전반적으로 잘 정합한다. 에러 코드 명명(`VALIDATION_ERROR` / `INVALID_FIELD`)은 의미 기반 규칙을 준수하고, 에러 응답 shape 은 EIA spec §5.1 예시와 일치하며, 금지 필드 패턴을 사용하지 않는다. Swagger 에러 응답 데코레이터에서 `type: ErrorResponseDto` 참조가 없는 점과 description 길이 초과는 모두 INFO 수준이며 기존 컨트롤러의 관행과 일치한다. 구 코드명 `VALIDATION_FAILED` 가 주석과 문서에서 완전히 제거된 점은 규약 정합 방향으로의 긍정적 변화다.

---

## 위험도

NONE
