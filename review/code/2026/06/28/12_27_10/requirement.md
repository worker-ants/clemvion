# 요구사항(Requirement) 리뷰

## 발견사항

### **[INFO]** `INVALID_SCHEMA` 코드가 webhook 런타임 경로에서 실제로는 도달하지 않음
- 위치: `/codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` 40–44행 (`REASON_TO_DETAIL` 매핑), `/codebase/backend/test/webhook-trigger.e2e-spec.ts` B3 테스트
- 상세: `toTriggerParameterErrorDetails`는 `invalid_schema` → `INVALID_SCHEMA` 매핑을 포함하며, 단위 테스트도 `(root)` 필드에 `invalid_schema`를 주입해 검증한다. 그러나 실제 webhook·manual 런타임 경로에서는 `invalid_schema`가 도달하지 않는다. `loadTriggerParameterSchema`는 `validateTriggerParameterSchema`를 호출해 schema error가 있으면 `undefined`를 반환하고 warn 로그를 남기며, `resolveTriggerParameters`(`hooks.service.ts:164`, `workflows.controller.ts:302`)는 `invalid_schema`를 throw하지 않는다. 즉 `INVALID_SCHEMA`를 throw하는 코드 경로가 현재 public webhook/manual 실행 흐름에 존재하지 않는다. 매핑을 가지는 것은 방어적으로 무해하며, spec(error-handling §1.7 주석)도 "스키마 구조 위반"을 `INVALID_WEBHOOK_PAYLOAD` `details[]` 코드로 등재하고 있다. 단위 테스트의 `(root)` / `invalid_schema` 케이스는 헬퍼 함수의 완전성을 검증하는 white-box 테스트로서 유효하다. 실 런타임에서 이 코드가 관측될 경로가 없으므로, e2e에서 이를 검증하지 않는 것은 자연스럽다.
- 제안: 현 상태 유지. 선택적으로 `toTriggerParameterErrorDetails` JSDoc에 "runtime webhook/manual 경로에서는 `invalid_schema` 도달 불가" 설명을 추가해 향후 혼란을 예방할 수 있으나 필수는 아님.

---

### **[INFO]** `hooks.service.spec.ts` 테스트가 `workflows.controller` 의 동일 변경(manual 경로)을 대칭으로 커버하지 않음
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.spec.ts`
- 상세: `hooks.service.spec.ts`는 webhook 경로(`INVALID_WEBHOOK_PAYLOAD`)에 대한 `details[]` 변경을 검증한다. manual-trigger 경로(`workflows.controller`, `INVALID_TRIGGER_PARAMETERS`)의 `errors`→`details` 변경은 별도 `workflows.controller.spec.ts`에 상응하는 테스트가 없거나 본 changeset에 포함되지 않은 것으로 보인다. 스펙 parity 언급(spec manual-trigger §6)에 따르면 두 경로 모두 동일 헬퍼를 사용하는 것이 요구사항이며 코드에서는 그렇게 구현됐다. 이는 test coverage 누락이지 기능 누락은 아니다.
- 제안: `workflows.controller.spec.ts`(또는 별도 파일)에 `INVALID_TRIGGER_PARAMETERS` + `details[]` 경로 단위 테스트 추가를 권장하나, 현 e2e(webhook-trigger B3) 커버가 있어 CRITICAL은 아님.

---

### **[INFO]** e2e B3 테스트에서 직접 DB UPDATE로 schema 주입 — schema validation 우회 가능성
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` 1148–1156행
- 상세: `UPDATE node SET config = $1 WHERE workflow_id = $2 AND type = 'manual_trigger'`로 required 파라미터를 직접 DB에 주입한다. 이는 `loadTriggerParameterSchema` → `validateTriggerParameterSchema` 경로를 거치지 않는 유효한 schema를 주입하는 것이므로 테스트 목적에 적합하다. 단, 이 방식이 `loadTriggerParameterSchema`의 schema validation 실패 경로(warn + undefined 반환)를 은폐할 수 있다 — 잘못된 schema를 주입하면 `undefined`로 처리되어 `parameters = {}`로 폴백하고, 400이 아닌 202를 반환하게 된다. 현재 B3 테스트는 valid schema를 주입하므로 문제없다.
- 제안: 테스트 전제가 명확하고 valid schema 주입이므로 허용. 단 "invalid schema → 폴백 동작" 경로에 대한 e2e 케이스가 없음을 인지하고 필요 시 별도 추가.

---

## Spec Fidelity 점검

**관련 spec 문서**: `spec/5-system/12-webhook.md` §5.2, `spec/5-system/3-error-handling.md` §1.7, `spec/4-nodes/7-trigger/1-manual-trigger.md` §6

**결과**: 코드와 spec이 line-level로 일치한다.

1. **`error.code` = `INVALID_WEBHOOK_PAYLOAD`** (spec §5.2 "도메인 특화 400 override"): `hooks.service.ts:171`에서 `code: 'INVALID_WEBHOOK_PAYLOAD'`로 일치.
2. **`error.details[]` 구조** (`{ field, code, message }`, spec §5.2 JSON 예시): `TriggerParameterErrorDetail` 인터페이스 및 `REASON_TO_DETAIL` 매핑이 spec JSON 예시의 필드명·값과 정확히 일치.
3. **field code** `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` (spec §5.2, error-handling §1.7): `REASON_TO_DETAIL` 매핑과 일치.
4. **`GlobalExceptionFilter`의 `details` 전달**: `http-exception.filter.ts:57`에서 `details = resp.details ?? nested?.details`로 `details` 키를 그대로 전달하며, 출력 봉투 `error.details`로 직렬화된다. spec 구현 기술("GlobalExceptionFilter가 `details`를 그대로 봉투로 전달")과 정확히 일치.
5. **manual 경로 parity** (`INVALID_TRIGGER_PARAMETERS`, spec manual-trigger §6): `workflows.controller.ts:582`에서 `details: toTriggerParameterErrorDetails(err.errors)` 사용 — spec §6 응답 봉투 기술과 일치.
6. **구 `errors` 배열 제거**: `hooks.service.ts` 및 `workflows.controller.ts` 양쪽에서 `errors`가 `details`로 교체됨. e2e B3에서 `res.body.errors` 및 `res.body.error.errors`가 `undefined`임을 단정.
7. **spec/plan 갱신**: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 응답 봉투 설명이 "Planned"에서 "구현 완료" 서술로 갱신. `spec/5-system/12-webhook.md` §5.2의 "현행(implemented)"/"목표(Planned)" 이중 기술이 단일 구현 기술로 정리됨. `plan/in-progress/spec-sync-webhook-gaps.md` WH-EP-05-2 항목이 `[x]`로 완료 처리됨.

---

## 요약

이번 변경은 spec/5-system/12-webhook.md §5.2(WH-EP-05-2) 및 manual-trigger §6의 "필드별 사유를 `error.details[]`로 노출" 요구사항을 완전히 구현한다. `toTriggerParameterErrorDetails` 헬퍼가 내부 분류 코드(`missing_required`/`coerce_failed`/`invalid_schema`)를 공식 UPPER_SNAKE_CASE field code로 정규화하고, webhook(`hooks.service`)과 manual(`workflows.controller`) 두 경로 모두에서 `errors` → `details`로 교체했다. `GlobalExceptionFilter`가 `details`를 그대로 봉투에 전달하는 기존 경로가 이미 구현돼 있어 연결이 완성됐다. spec, plan, 코드, 테스트(unit + e2e)가 모두 정합하며 기능 완전성 관점에서 요구사항을 충족한다. CRITICAL 또는 WARNING 수준의 발견사항 없음.

## 위험도

NONE

STATUS: SUCCESS
