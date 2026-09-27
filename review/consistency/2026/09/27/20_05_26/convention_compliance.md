# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-cross-workspace-refs.md`

## 발견사항

- **[WARNING] `VALIDATION_ERROR` 를 top-level 로 유지하면서 `details` 를 배열이 아닌 단일 객체로 못박았다**
  - target 위치: `### A. spec/1-data-model.md` → **A1** "`> **거부 응답**: 400 `VALIDATION_ERROR` + `details: { field, code: 'INVALID_FIELD' }`"` 문단, 그리고 이를 그대로 재인용하는 **B1~B4**(`spec/2-navigation/1-workflow-list.md`), **C1**(`spec/data-flow/11-workflow.md`), **D1**(`spec/3-workflow-editor/0-canvas.md`), **E**(`spec/data-flow/12-workspace.md` Rationale 절)의 같은 문구 전체.
  - 위반 규약: `spec/conventions/error-codes.md` 는 Overview 에서 "응답 봉투(envelope) 형식" 의 SoT 를 `5-system/2-api-convention.md §5.3`/`3-error-handling.md §2.1` 로 명시 위임하고 "본 문서는 재선언하지 않는다" 고 적는다 — 즉 그 §5.3 의 `details` 형태 규칙은 error-codes 규약이 그대로 흡수하는 정식 규약의 일부다. §5.3 "`details` 의 형태는 두 가지이고 둘 다 유효하다" 표는 기준을 **top-level 코드의 성격**으로 가른다: **배열** `details: [{field, message, code}]` = top-level 이 generic 기본값(`VALIDATION_ERROR`)이고 "여러 항목이 각각 실패할 수 있을 때"(ValidationPipe 다중 필드), **객체** `details: {field, code, …}` = "**단일 도메인 예외**" 즉 top-level 이 **이미 특화 코드로 교체**된 경우(선례 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `AUTH_CONFIG_NOT_FOUND` — 둘 다 top-level 이 `VALIDATION_ERROR` 가 아니다).
  - 상세: target 의 Rationale 은 "`_NOT_FOUND` 같은 새 top-level 코드를 만들지 않는다" 고 명시적으로 결정해 generic `VALIDATION_ERROR` 를 top-level 로 유지한다. 그런데 바로 그 문단에서 `details` 형태는 `AUTH_CONFIG_NOT_FOUND`(§1.11, top-level 이 이미 도메인 특화 코드인 자리)의 **객체** 형태를 그대로 빌려 온다 — 객체-형태가 성립하는 전제("top-level 이 특화 코드")와 target 이 실제로 지키기로 한 설계(generic `VALIDATION_ERROR` 유지)가 서로 다른 선례에서 온 것이라 어긋난다. 더 가까운 선례는 오히려 `INVALID_TRIGGER_PARAMETERS`/webhook `INVALID_WEBHOOK_PAYLOAD`(§1.7, error-codes §4.2) 다 — 이쪽은 target 과 똑같이 top-level 을 generic 하게 유지한 채 `details[].code` 를 **배열**로 싣는다. 게다가 target 이 다루는 표면 중 캔버스 저장(`saveCanvas`) 은 `nodes[]`/`edges[]` 를 한 요청에 통째로 검증하는 벌크 스냅샷이라, `containerId`·`toolOwnerId`·엣지 두 끝점 등 **여러 필드가 한 요청에서 동시에 위반**될 수 있다 — 바로 §5.3 표가 배열 형태를 지정하는 조건("여러 항목이 각각 실패할 수 있을 때")에 해당한다. 객체 하나로 고정하면 두 번째 이후 위반 필드가 응답에서 조용히 사라진다. (부가: `ErrorResponseDto.details` 는 swagger 규약상 `additionalProperties: true` 로 열려 있어 이 형태 오류를 타입 체크가 잡아 주지 않는다 — 규약 문서 자체가 정확해야 하는 이유이기도 하다.)
  - 제안: A1 의 "거부 응답" 문구를 `details: [{ field, code: 'INVALID_FIELD' }, …]` 배열 형태로 정정하고(§2.1/§5.3 기본 형식과 통일), B1~B4·C1·D1·E 의 동일 문구도 함께 갱신한다. 만약 "이 검사는 항상 첫 위반에서만 멈추고 단일 필드만 보고한다" 는 의도라면, top-level 이 generic 인 채로 객체-형태를 쓰는 것이 §5.3 표의 어느 조건을 충족하는지 근거를 A1 에 명시해야 한다(현재 문구만으로는 표의 두 조건 중 어느 쪽도 명시적으로 충족하지 않는다).

## 요약

target spec draft 는 에러 코드 재사용 원칙(새 `_NOT_FOUND` 코드를 만들지 않음, `AUTH_CONFIG_NOT_FOUND`/`MODEL_CONFIG_NOT_FOUND` 기존 검증기 재사용), `UPPER_SNAKE_CASE` 표기, `details.field` 의 nested 경로 표기(`nodes[2].containerId`), camelCase(API)/snake_case(DB) 구분 등 `spec/conventions/error-codes.md` 와 `spec/5-system/*` 의 정식 규약을 대체로 정확히 인용하며 잘 따르고 있다. 다만 새로 신설하는 검증 규칙의 응답 봉투 `details` 형태(배열 vs 객체)를 top-level 코드 성격이 다른 두 선례(`AUTH_CONFIG_NOT_FOUND`=특화 코드+객체, `INVALID_TRIGGER_PARAMETERS`=generic+배열)에서 서로 다른 축만 가져와 섞어 쓰는 바람에, target 이 유지하기로 한 generic `VALIDATION_ERROR` top-level 과 실제 채택한 객체-형태 `details` 가 §5.3 의 선택 기준과 어긋난다. 캔버스 저장처럼 한 요청에 여러 필드가 동시에 위반될 수 있는 경로에서는 이 불일치가 정보 유실(두 번째 이후 위반 실종)로 이어질 수 있어, 정식 구현 전에 정정이 필요하다.

## 위험도
MEDIUM
