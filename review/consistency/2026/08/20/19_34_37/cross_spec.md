# Cross-Spec 일관성 검토 — `inputOverride` 서버측 마커 리터럴 거부

target: `plan/in-progress/spec-draft-inputoverride-marker-reject.md`
관련 spec: `spec/5-system/14-external-interaction-api.md`(§R17) · `spec/5-system/3-error-handling.md`(§1.7) · `spec/5-system/13-replay-rerun.md`(§8.1·§10.2)

> 참고: 조립된 프롬프트 번들에서 `spec/5-system/14-external-interaction-api.md` 가 컨텍스트 예산 초과로
> **본문 생략**돼 있었다(원래 122,333자). §R17 관련 판정은 실제 파일(`spec/5-system/14-external-interaction-api.md`)을
> 직접 읽어 수행했다.

## 발견사항

- **[CRITICAL]** re-run 호출부는 draft 가 전제하는 "기존과 같은 봉투"가 아니다 — `details[]` 를 안 쓰고, 필드명이 달라 `GlobalExceptionFilter` 가 통째로 버린다
  - target 위치: `plan/in-progress/spec-draft-inputoverride-marker-reject.md` "에러 계약 — 기존 헬퍼를 확장한다" 절, 특히
    "봉투는 기존과 같다 — `INVALID_TRIGGER_PARAMETERS`(execute) · re-run 경로의 400. `details[]` 항목 코드만 새로 는다."
  - 충돌 대상: `spec/5-system/13-replay-rerun.md` §8.1 (`INVALID_INPUT` 행) + `spec/5-system/3-error-handling.md` §1.7 카탈로그 주석
    + 실측 코드 `codebase/backend/src/modules/executions/executions.service.ts:493-503`, `codebase/backend/src/common/filters/http-exception.filter.ts`(`GlobalExceptionFilter`)
  - 상세: draft 는 execute(`workflows.controller.ts:314`)와 re-run(`executions.service.ts:493`) 두 호출부에서
    `resolveTriggerParameters`(및 향후 마커 판정)의 실패가 "기존과 같은" `details[]` 경로로 나간다고 전제하지만, **실측하면
    두 호출부가 이미 다르다.**
    - execute (`workflows.controller.ts:316-324`)는 `toTriggerParameterErrorDetails(err.errors)` 를 호출해 내부
      `reason` → 공개 UPPER_SNAKE `code` 로 정규화한 뒤 `{ code: 'INVALID_TRIGGER_PARAMETERS', details: [...] }` 로 던진다 — spec
      3-error-handling.md §1.7 이 문서화한 그대로.
    - re-run (`executions.service.ts:493-503`)은 `toTriggerParameterErrorDetails` 를 **호출하지 않고**,
      `TriggerParameterValidationException.errors`(내부 소문자 `reason` 원문, 예: `missing_required`)를 그대로
      `{ code: 'INVALID_INPUT', message: 'Invalid input override', errors: err.errors }` 의 **`errors` 필드**에 담아 던진다.
    - `GlobalExceptionFilter.catch()`(`http-exception.filter.ts` L60-69)는 `details = resp.details ?? nested?.details;` 로
      **`details` 필드만** 읽는다. `errors` 는 어떤 분기에도 안 걸려 **클라이언트 응답에서 통째로 사라진다** — re-run 실패 시
      클라이언트는 현재도 `{ error: { code: 'INVALID_INPUT', message: 'Invalid input override', requestId } }` 만 받고
      필드별 사유를 전혀 못 본다(`executions-rerun.service.spec.ts:330` 테스트도 `BadRequestException` 타입만 단언하고
      shape 을 검증하지 않아 이 갭이 회귀 가드 밖에 있다).
    - draft 의 Rationale 은 "#1188 에서 무효 JSON 이 `coerce_failed` 로 거부될 때 사용자가 '마커를 채우라' 대신 일반 오류
      토스트를 본 것이 정확히 이 문제였다. 같은 실수를 서버 계약에 굳히지 않는다" 라고 새 코드 도입 이유를 밝히는데, 정작
      draft 가 지정한 두 거부 대상 호출부 중 하나(re-run)는 **오늘도 이미 이 정확한 실수**(필드별 사유가 클라이언트에
      안 나감)를 갖고 있고, draft 의 "네 번째 항만 더하면 된다"는 범위 서술은 이 gap 을 건드리지 않는다. draft 를 문구
      그대로 구현하면 execute 경로는 `MASKED_VALUE_RESUBMITTED` 안내가 정상 도달하지만, re-run 경로는 400 은 뜨되
      `details[].code` 가 응답에서 **조용히 유실**돼 사용자는 여전히 일반 오류만 본다 — draft 가 명시적으로 막으려던
      바로 그 회귀가 절반의 호출부에서 재현된다.
  - 제안: draft 의 "에러 계약" 절에 re-run 호출부 수정 항목을 **명시로 추가**한다 — (a) `executions.service.ts` 의
    catch 블록이 `toTriggerParameterErrorDetails(err.errors)` 를 거쳐 `details` 필드로 던지도록 변경, (b) 그 사실을
    `13-replay-rerun.md` §8.1 표(`INVALID_INPUT` 행)에 "`details[]` 는 §1.7 카탈로그를 따른다" 로 명문화, (c)
    `3-error-handling.md` §1.7 의 `error.details[].code` scope 주석(`INVALID_WEBHOOK_PAYLOAD`·`INVALID_TRIGGER_PARAMETERS`만
    열거)에 `INVALID_INPUT`(re-run) 도 세 번째 소비처로 추가. 이 셋을 하지 않으면 spec 문서 간 서술이 서로 다른 봉투
    shape 을 "기존과 같다" 로 뭉뚱그려 가리키게 된다.

- **[WARNING]** `3-error-handling.md` §1.7 `details[].code` scope 주석이 re-run 의 `INVALID_INPUT` 을 소비처로 열거하지 않는다
  - target 위치: draft "spec 변경 3곳" 항목 2 — "`3-error-handling.md` §1.7 주석 — `details[].code` 목록에
    `MASKED_VALUE_RESUBMITTED` 등재(정의 SoT 는 §R17)"
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.7 (line 327 부근) — "Manual 실행 경로(`POST /:id/execute`)와 저장
    경로(`POST /:id/save`, `WorkflowsService.validateManualTrigger`)의 `INVALID_TRIGGER_PARAMETERS` 도 동일 헬퍼를 쓴다."
    라고만 적혀 있고 re-run(`INVALID_INPUT`)은 언급이 없다.
  - 상세: 위 CRITICAL 항목의 spec 표기 측면. draft 는 이 주석에 새 코드 **한 항목**만 추가할 계획이라고 적었는데, 이
    주석 자체가 이미 "이 카탈로그를 누가 쓰는가" 를 execute/save(`INVALID_TRIGGER_PARAMETERS`)·webhook
    (`INVALID_WEBHOOK_PAYLOAD`) 로 **닫힌 목록**처럼 서술하고 있어, re-run 이 이 카탈로그를 쓰는지 여부가 spec 상
    불명확하다(실제로는 코드가 안 쓴다 — 위 CRITICAL 참고). draft 가 이 gap 을 못 보고 넘어가면 "5곳 중 2곳을 거부
    대상으로 좁혔다"는 draft 의 범위 좁히기 노력이 무색해진다 — 코드 표는 맞았지만 그 코드가 실제로 도달하는 응답
    shape 표는 비대칭이었다.
  - 제안: 위 CRITICAL 제안 (c) 와 동일 — scope 주석에 `INVALID_INPUT`(re-run) 을 명시 추가.

- **[INFO]** `INVALID_INPUT` 코드가 `3-error-handling.md` §1 전체 카탈로그(§1.3 유효성 검증 에러)에 미등재
  - target 위치: draft 전체 (직접 언급 없음 — §1.7 만 손댐)
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1 — §1.3 유효성 검증 에러 표에 `INVALID_INPUT` 행이 없다.
    같은 문서 Rationale 은 "§1 카탈로그 완결성" 을 이 프로젝트가 반복해 챙겨온 관행으로 기술한다(2FA/WebAuthn·KB/Graph
    RAG·워크스페이스 멤버 직접추가 등 완결성 pass 이력). `INVALID_INPUT` 은 `spec/5-system/13-replay-rerun.md` §8.1 에만
    등재돼 있고 §1 공용 카탈로그에는 없다.
  - 상세: 이번 draft 가 §1.7 을 손대는 김에, 같은 문서 §1 의 등재 관행에 맞춰 `INVALID_INPUT` 도 함께 등재하면 카탈로그
    완결성 pass 의 재작업을 줄인다. 필수는 아니나 같은 PR 범위에서 값싸게 닫을 수 있는 항목.
  - 제안: `3-error-handling.md` §1.3 에 `INVALID_INPUT`(400) 행 추가 검토, SoT 참조는 `13-replay-rerun.md §8.1`.

## 검증한 항목 (충돌 없음 확인)

- `resolveTriggerParameters` 호출부 "5곳" 실측 — `workflows.controller.ts:314`·`schedule-runner.service.ts:78,88`·
  `hooks.service.ts:183`·`executions.service.ts:493` grep 으로 정확히 일치 확인. `WorkflowsService.validateManualTrigger`
  (save 경로, `INVALID_TRIGGER_PARAMETERS` 소비처 중 하나)는 `validateTriggerParameterSchema`(스키마 *정의* 구조 검증)를
  쓰지 `resolveTriggerParameters`(입력 *값* 검증)를 쓰지 않으므로 draft 가 "5곳" 에서 제외한 것은 정확하다 — 재제출된
  마스킹 마커 값이 흘러들 수 있는 경로가 아니다.
- `MAX_REDACT_DEPTH = 10` (`sanitize-error-message.ts`) — draft 의 "깊이 상한은 backend MAX_REDACT_DEPTH(10)와 같게" 주장과
  일치.
- 마스킹 마커 3종 `***`(`VALUE_MASK_MARKER`)·`[REDACTED]`(`KEY_MASK_MARKER`)·`[REDACTED_DEPTH]`(`DEPTH_MASK_MARKER`) —
  draft 가 인용한 세 마커 리터럴과 정확히 일치.
- §R17 "닫는 조건" 문구가 실제로 프런트 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리)만 나열하고 서버측 행이
  없다는 draft 의 전제("완전 폐쇄로 오독됐다") — 실제 파일(`spec/5-system/14-external-interaction-api.md` §R17,
  L1565-1582)을 직접 읽어 확인, 정확하다. draft 의 §R17 갱신 계획(표에 서버측 행 추가) 자체는 기존 §R17 서술 구조와
  충돌하지 않는다.
- `13-replay-rerun.md` §10.2 는 이미(2026-08-20, 선행 커밋 c9cc2a923) 프런트 마커 가드로 갱신돼 있고 "근거·카탈로그의
  SoT 는 EIA §R17" 로 §R17 을 참조한다 — draft 가 §10.2 에 추가하려는 "차단이 클라이언트 전용이라는 전제 갱신" 은 기존
  본문과 상충하지 않고 자연스러운 후속이다.

## 요약

가장 중요한 발견은 draft 가 "봉투는 기존과 같다"고 전제한 지점이 실제로는 같지 않다는 것이다 — draft 가 거부 대상으로
지정한 두 호출부(execute·re-run) 중 execute 는 이미 표준 `details[]` 경로를 쓰지만, re-run 은 `toTriggerParameterErrorDetails`
를 거치지 않고 비표준 `errors` 필드로 내부 `reason` 원문을 던지며 `GlobalExceptionFilter` 가 `details` 만 읽어 그 필드를
조용히 버린다. 이 상태로 draft 를 문구 그대로 구현하면, draft 가 신규 코드 도입의 근거로 든 "#1188 의 일반 오류 토스트"
회귀가 re-run 호출부에서 그대로 재현된다 — CRITICAL. `3-error-handling.md` §1.7 의 catalog scope 주석도 이 비대칭을
반영하지 않고 있어 함께 갱신이 필요하다 — WARNING. 그 외 draft 의 실측(5곳 호출부, MAX_REDACT_DEPTH, 마커 리터럴, §R17
서술)은 실제 spec·코드와 정확히 일치했고, §R17·§10.2 갱신 계획도 기존 문서 구조와 충돌하지 않는다.

## 위험도

HIGH
