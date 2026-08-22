# 정식 규약 준수 검토 — spec/4-nodes/7-trigger/ (impl-done, diff-base=origin/main)

## 검토 범위 확인

이번 diff(`git diff origin/main...HEAD -- code_areas`)는 아래 4개 코드 파일만 건드렸고, **전부 주석·JSDoc·Swagger description 텍스트 변경**(영어→한국어 번역 + 설명 보강)이며 실행 로직·타입·식별자 변경은 없다. spec 문서(`spec/4-nodes/7-trigger/**`)도 이번 diff에는 포함되지 않았다(불변).

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — JSDoc 추가
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — JSDoc 확장(SoT 포인터 포함)
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `@ApiPropertyOptional` description 확장
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — inline comment 한국어화

따라서 본 검토는 (a) 이 코멘트/설명 변경 자체의 정식 규약 부합 여부, (b) 변경이 언급하는 에러 코드·마커 명명이 기존 규약 레지스트리와 일치하는지에 집중했다.

**bundler 한계 참고**: 본 prompt bundle 은 예산 제약으로 `spec/conventions/node-output.md`·`swagger.md`·`error-codes.md`(일부) 등 다수 convention 파일을 경로 stub 만 남기고 본문을 누락시켰다(`spec-only`/cafe24 카탈로그류 전부 동일). 이 checker 는 워크트리 절대경로로 `spec/conventions/swagger.md`·`spec/conventions/spec-impl-evidence.md`·`spec/conventions/node-output.md` 를 직접 Read 하여 실제 규약 본문을 확인했다 — bundle 누락이 false negative 로 이어지지 않도록 별도 조치함.

---

### 발견사항

- **[WARNING] `re-run.dto.ts` `inputOverride` description 이 swagger.md §3 의 "보안·정책 캐비엇 예외" 형식(요약 1~2문장 + SoT 링크)을 따르지 않음**
  - target 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` L18-26 (diff 상 `+` 라인, `@ApiPropertyOptional({ description: ... })`)
  - 위반 규약: `spec/conventions/swagger.md` §3 "주석/설명 톤" — "DTO `description`은 10~40자 내외" 및 그 예외 조항(2026-08-17 규약화): "응답 값이 저장된 값과 다를 수 있는 필드(egress 마스킹 대상 등)는 위 길이 제한의 예외다 … 다만 상세 근거는 spec 본문에 두고 여기서는 **요약 1~2문장 + SoT 링크**로 적는다."
  - 상세: 이번 diff 가 해당 description 을 98자(구) → **304자**(신, 약 6문장)로 확장하면서 마스킹 마커 3종 나열·에러 코드·부분일치 예외까지 전부 inline 으로 풀어썼다. 그런데 **SoT 링크가 전혀 없다.** 같은 저장소의 비교 가능한 선례(`execution-response.dto.ts` 의 `inputData`/`outputData`/`error` 필드 JSDoc — 전부 동일한 "egress 마스킹으로 응답 값이 DB 원문과 다를 수 있다" 캐비엇을 다루며 예외 규약이 명시적으로 겨냥하는 사례)는 한결같이 "SoT: EIA §R17 (`spec/5-system/14-external-interaction-api.md`)" 형태로 마무리한다. `spec/3-workflow-editor/3-execution.md` L90 의 동일 캐비엇 서술도 `[EIA §R17](../5-system/14-external-interaction-api.md)` 로 링크를 건다. 이번 diff 는 같은 파일 안에서 `trigger-parameter.types.ts`/`resolve-trigger-parameters.ts` JSDoc 에는 "정의 SoT: `spec/5-system/14-external-interaction-api.md` §R17 · `spec/4-nodes/7-trigger/1-manual-trigger.md` §6" 를 정확히 붙였으면서, 정작 swagger DTO description 에는 그 패턴을 적용하지 않아 같은 PR 내에서도 일관성이 갈린다.
  - 제안: `inputOverride` description 을 1~2문장 요약으로 줄이고 끝에 `SoT: spec/4-nodes/7-trigger/1-manual-trigger.md §6, spec/5-system/14-external-interaction-api.md §R17` 형태의 링크를 추가한다. (대안: 규약을 갱신해 "보안·정책 캐비엇" 예외가 요청 필드의 검증-거부 정책까지 포괄한다는 점과, 상세 설명을 inline 으로 허용하는 조건을 명문화 — 다만 이 경우도 기존 예외 선례들이 전부 SoT 링크를 동반한다는 점과의 정합을 다시 맞춰야 한다.)

- **[INFO] 같은 catch 블록 인접 주석의 언어가 diff 이후에도 혼재**
  - target 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` L314-330 (한국어, 이번 diff 로 갱신) vs 바로 아래 L332-335 (영어, 미변경)
  - 위반 규약: 없음 — `spec/conventions/swagger.md` §3 의 "한국어" 요구는 Swagger 데코레이터(DTO/Controller 설명) 한정이며, 일반 TS 인라인 주석의 언어를 강제하는 정식 규약은 `spec/conventions/**` 에 없음.
  - 상세: 이번 PR 이 "코멘트 명확화/한국어화" 취지의 cosmetic followup 인데, 같은 함수 내에서 몇 줄 차이로 영어 주석(`Stamp the trigger-source marker …`)이 그대로 남아 국소적 언어 비일관을 만든다. 이 자체는 정식 규약 위반은 아니므로 CRITICAL/WARNING 이 아니라 참고용 INFO.
  - 제안: 필수는 아니나, 같은 함수 내 잔여 영어 주석도 함께 한국어화하면 diff 의도(cosmetic consistency)와 더 정합.

- **[검증 완료 — 위반 없음] 에러 코드/마커 명명은 규약과 정확히 일치**
  - target 위치: 4개 diff 파일 전체
  - 확인 내용: diff 가 언급/추가하는 `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`(details 항목 코드) 및 `INVALID_TRIGGER_PARAMETERS`(envelope 코드)는 `spec/conventions/error-codes.md` §4.2 "Trigger 파라미터 검증 사유 → 봉투 `error.details[].code`" 표와 정확히 일치. 마스킹 마커 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 표기도 `codebase/packages/masked-markers/src/index.ts`(SoT 패키지)·`spec/3-workflow-editor/3-execution.md`·`spec/5-system/14-external-interaction-api.md` 와 동일 문자열로 정확히 인용됨. `details` vs `errors` 키 정정 코멘트도 GlobalExceptionFilter 의 실제 동작(§4.2 상단 서술)과 일치. 새 식별자·엔드포인트 명명은 이번 diff 에 없음(명명 규약 위반 표면 자체가 없음).

---

### 요약

이번 변경분은 마스킹 마커 재제출 거부 로직 관련 4개 코드 파일의 **주석/JSDoc/Swagger description 을 한국어화·상세화한 순수 cosmetic 커밋**이며, 새 식별자·엔드포인트·출력 필드·spec 문서 변경은 없다. 언급된 에러 코드·마스킹 마커 명명은 `spec/conventions/error-codes.md` §4.2 레지스트리·`masked-markers` 패키지 SoT 와 정확히 일치해 명명 규약 위반은 발견되지 않았다. 유일한 실질 이슈는 `re-run.dto.ts` 의 `inputOverride` Swagger description 이 대폭 길어지면서(304자, ~6문장) `spec/conventions/swagger.md` §3 의 "보안·정책 캐비엇" 예외가 요구하는 "요약 1~2문장 + SoT 링크" 형식을 지키지 않았다는 점이다 — 같은 diff 안의 다른 두 파일 JSDoc 은 정확히 이 SoT-링크 패턴을 따르고 있어 국소적 비일관이다. 시스템 invariant 를 깨뜨리는 CRITICAL 은 없다.

### 위험도

LOW
