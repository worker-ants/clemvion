# 문서화(Documentation) Review

## 발견사항

- **[INFO]** 신규 `resolveManualOverrideInput` 의 JSDoc 에 `@throws`/`@param`/`@returns` 태그가 없다 — 같은 파일의 자매 메서드는 태그를 단다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:530-583` (JSDoc 530-545, 메서드 본체 546-583)
  - 상세: 새로 추출된 `resolveManualOverrideInput` 은 `BadRequestException({ code: 'INVALID_TRIGGER_PARAMETERS', ... })` 를 던진다(566-578행). 그런데 JSDoc 은 "왜 이 덩어리만 뽑았나" 설계 근거만 담고 `@throws` 태그가 없다. 같은 파일에서 이 메서드와 나란히 있고 성격이 동일한(둘 다 `reRun` 이 위임하는 pre-flight/입력 처리 헬퍼이자 특정 코드의 예외를 던짐) `assertDryRunSupported`(594행)는 `@throws {BadRequestException} RERUN_DRY_RUN_NOT_APPLICABLE — …` 를, `getChain`(619행)은 `@param`/`@throws` 를 명시한다. 본문 인라인 주석이 `INVALID_TRIGGER_PARAMETERS`/`details` 근거를 충실히 설명하므로 이해에 지장은 없지만, 파일 내에서 예외를 던지는 헬퍼는 `@throws` 로 태깅하는 기존 패턴과 이 메서드만 어긋난다.
  - 제안: JSDoc 말미에 `@throws {BadRequestException} INVALID_TRIGGER_PARAMETERS — 마커 재제출 또는 스키마 검증 실패 시.` 한 줄과 `@param workflowId`/`@param inputOverride`/`@returns` 를 추가해 자매 메서드와 스타일을 맞춘다(선택, 비차단).

- **[INFO]** 이동된 인라인 주석의 지시대상이 정확히 갱신됐다 (문제 아님, 확인 기록)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:559` (신규) vs 삭제된 원본(구 `reRun` 본문, 옛 62행 상당)
  - 상세: `resolveTriggerParametersRejectingMasked` 호출 직전 주석이 "검사 시점(raw 우선)은 **이 함수**가 소유한다" → "검사 시점(raw 우선)은 **그 wrapper**가 소유한다" 로 바뀌었다. 코드가 `reRun` 본문에서 `resolveManualOverrideInput` private 헬퍼로 옮겨가면서, "이 함수"가 가리키는 대상이 달라지므로(전: `reRun`, 후: 새 헬퍼 자신) 그대로 뒀다면 오해를 유발했을 자리인데, 정확히 "그 wrapper"(= 바로 아래 호출되는 `resolveTriggerParametersRejectingMasked`)로 재지정해 정확성을 유지했다. 리팩터 시 주석을 기계적으로 복사-붙여넣기 하지 않고 지시대상을 재검토한 좋은 사례로, 별도 조치는 불필요.

## 요약

이번 변경의 핵심(코드)은 `ExecutionsService.reRun` 의 40줄 입력 해석 블록을 `resolveManualOverrideInput` private 헬퍼로 추출하는 순수 리팩터이며, 새 메서드에는 "왜 이 덩어리만 뽑았나"·"useOriginal 판정을 왜 호출부에 남겼는가"·"`__triggerSource` 봉투를 왜 여기서 만드는가"를 설명하는 풍부한 JSDoc이 붙었고, 이동된 인라인 주석은 지시대상(이 함수→그 wrapper)까지 정확히 갱신되어 오래된 주석 문제가 없다. 유일한 개선 여지는 새 메서드가 도메인 예외를 던짐에도 파일 내 자매 메서드(`assertDryRunSupported`/`getChain`)가 쓰는 `@throws` 태그 관례를 따르지 않는다는 점(INFO, 비차단)이다. README·API 문서·CHANGELOG·환경변수 문서는 이번 변경 범위(동작 무변경 순수 추출) 특성상 갱신 대상이 아니며, 실제로 손대지 않았다 — CHANGELOG.md 는 이 마커 시리즈의 동작 변화 PR들만 항목화하고 있고 이번 PR은 그 목록에 해당하지 않는다. 나머지 12개 대상 파일(plan 이동/신설, consistency-check 산출물)은 코드가 아니라 작업 기록·리뷰 산출물이며, 스스로 자신의 실수(전 PR에서 plan 이동을 놓친 원인)까지 근거와 함께 정정해 기록하는 등 문서화 위생이 양호하다. 특히 consistency-check가 찾아낸 `spec/5-system/13-replay-rerun.md` §8.1/§8.2 의 401 코드 표기 drift(`UNAUTHORIZED`→표준은 `AUTH_REQUIRED`, 런타임은 이미 정상)는 이번 diff가 도입한 결함이 아니고, `spec-sync-external-interaction-api-gaps.md` 트래커에 신규 항목으로 정확히 등재되어 유실되지 않았다(developer 권한 밖이라 planner 턴으로 명시 이관).

## 위험도

LOW
