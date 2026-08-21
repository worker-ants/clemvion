# 신규 식별자 충돌 검토 — `inputOverride` 서버측 마커 리터럴 거부

대상: `plan/in-progress/spec-draft-inputoverride-marker-reject.md`

## 발견사항

- **[CRITICAL]** 신규 `MASKED_VALUE_RESUBMITTED` 의 목표 위치(`error.details[].code`)가 re-run 경로에는 **존재하지 않는다** — 봉투가 "기존과 같다"는 전제가 실측과 다르다
  - target 신규 식별자: `MASKED_VALUE_RESUBMITTED`(공개 `code`) / `masked_marker`(내부 `reason`) — `trigger-parameter.types.ts` 의 `REASON_TO_DETAIL` 4번째 항으로 추가 예정
  - 기존 사용처:
    - `codebase/backend/src/modules/executions/executions.service.ts:493-500` — re-run 의 `inputOverride` 검증 실패 시 `throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Invalid input override', errors: err.errors })` — 키가 `details` 가 아니라 **`errors`** 이고, 값도 `toTriggerParameterErrorDetails()` 로 정규화되지 않은 **raw `{field, reason}`** 그대로다.
    - `codebase/backend/src/common/filters/http-exception.filter.ts:73` — `details = resp.details ?? nested?.details;` 로 **`details` 키만** 읽는다. `resp.errors` 는 이 필터가 보지 않으므로 그대로 버려진다.
    - `codebase/backend/src/common/filters/http-exception.filter.ts:99-106` — 최종 응답은 `details` 가 있을 때만 `{...(details ? { details } : {})}` 로 포함시킨다. re-run 경로는 `details` 가 `undefined` 이므로 **현재 이 경로의 400 응답 body 에는 `details` 키 자체가 없다.**
    - `spec/4-nodes/7-trigger/1-manual-trigger.md:180` — "Manual re-run (inputOverride) → `400 Bad Request` code `INVALID_INPUT`" (execute/webhook 과 별개 행)
    - `spec/4-nodes/7-trigger/1-manual-trigger.md:184` — "**Manual·Webhook** 경로의 컨트롤러/서비스는 `BadRequestException({ code, message, details })` 를 throw" — 이 문장은 re-run 을 **명시적으로 제외**하고 execute(Manual)·Webhook 두 경로만 묶는다. 기존 spec 자신이 이미 re-run 의 봉투가 다르다고 문서화하고 있다.
    - `spec/5-system/13-replay-rerun.md:246` — re-run §8.1 API 표에서도 `INVALID_INPUT` 만 등재, `details[]` 언급 없음.
  - 상세: target 문서 §"에러 계약" 은 "봉투는 기존과 같다 — `INVALID_TRIGGER_PARAMETERS`(execute) · re-run 경로의 400. `details[]` 항목 코드만 새로 는다" 라고 적어, execute·re-run 두 경로 모두 이미 `details[].code` 정규화 카탈로그를 공유한다고 전제한다. 그러나 실측하면 re-run 은 `toTriggerParameterErrorDetails` 를 호출하지 않고 raw `err.errors`(내부 lowercase `reason` 그대로)를 **`details` 가 아닌 `errors`** 키로 던지며, `GlobalExceptionFilter` 는 `details` 키만 인식하므로 그 `errors` 배열은 응답 직렬화 단계에서 **조용히 소실**된다. target 이 §"에러 계약" 그대로 구현되면(즉 `masked_marker→MASKED_VALUE_RESUBMITTED` 매핑만 추가하고 re-run 호출부의 throw 형태를 고치지 않으면) execute 경로에서는 `error.details[].code === 'MASKED_VALUE_RESUBMITTED'` 가 정상 노출되지만, **re-run 경로에서는 여전히 `{ error: { code: 'INVALID_INPUT', message: 'Invalid input override', requestId } }` 뿐이고 details 자체가 없다** — 정확히 이 문서가 "왜 지금인가" 절에서 비판한 것과 같은 형태(사용자가 특정 안내 대신 일반 오류만 보는 것)가 **두 거부 대상 호출부 중 하나(re-run)에서 그대로 재발**한다. §"어떤 형태로 거부하는가/판정 기준" 이 지목한 5곳 중 거부 대상 2곳(`executions.service.ts:493` re-run, `workflows.controller.ts:314` execute) 가운데 정확히 재제출 성격이 더 강한 re-run 쪽이 이 갭의 영향을 받는다.
  - 제안: target 의 "에러 계약" 절에 re-run 경로용 수정 항목을 명시적으로 추가한다 — (a) `executions.service.ts` 의 해당 `BadRequestException` 호출을 `errors: err.errors` 대신 `details: toTriggerParameterErrorDetails(err.errors)` 로 바꾸거나, (b) 최소한 이 카탈로그 확장이 execute 경로에만 유효하고 re-run 은 별도 배선이 필요하다는 점을 spec 본문(§R17 신규 행·`3-error-handling.md §1.7`)에 캐비엇으로 남긴다. spec 3곳 변경 목록의 "봉투는 기존과 같다" 전제 문장도 "re-run 은 details 미노출 상태이므로 함께 배선한다" 로 정정 필요.

## 요약

target 이 새로 도입하는 식별자(`MASKED_VALUE_RESUBMITTED` 공개 코드·`masked_marker` 내부 reason)는 리포지토리 전역에 문자 그대로 사전 사용례가 없어 **명명 자체의 충돌은 없다** — 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 6개 축 모두 재사용/중복이 발견되지 않았고, 프런트 `isMaskedMarker`/`hasMaskedMarkerLeaf`/`MAX_REDACT_DEPTH` 등 target 이 인용하는 기존 식별자도 실제 정의와 정확히 일치한다. 다만 새 식별자가 안착할 **목적지(`error.details[].code`)** 가 target 이 전제한 대로 execute·re-run 두 경로에 균일하게 존재하지 않는다 — re-run 경로(`executions.service.ts:493`)는 `details` 가 아니라 `errors` 키로 raw reason 을 던지고 `GlobalExceptionFilter` 는 `details` 만 인식해 그 배열을 버린다(기존 spec `1-manual-trigger.md:184` 도 이 비대칭을 이미 문서화하고 있다). 이 갭은 순수한 "동일 식별자 재사용" 충돌은 아니지만, target 이 두 거부 대상 호출부 중 하나로 명시한 re-run 경로에서 새 식별자가 실제로는 클라이언트에 도달하지 못하는 배선 공백이라 별도 조치 없이는 spec 이 약속하는 "사용자가 특정 안내를 받는다" 결과를 그 경로에서 못 낸다. 참고로 CLAUDE.md 프로젝트 지시가 다른 병렬 워크트리(`eia-inputdata-marker-guard`)를 가리키고 있고 거기도 같은 트래커 항목(`inputOverride` 서버측 마커 리터럴 거부, 미착수 `[ ]`)을 갖고 있으나, 관련 3개 spec 파일과 `trigger-parameter.types.ts` 는 두 워크트리 간 diff 가 없어 이 시점 기준 실제 식별자 충돌은 없다(병렬 세션 병합 시 재확인 권장).

## 위험도

HIGH
