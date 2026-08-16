# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `plan/in-progress/eia-internal-rest-error-masking.md` 의 `## 조치` 절이 이후 라운드에서 **틀렸다고 정정된 수치를 그대로 보존**하고 있다 — "`stop` 은 반환 지점이 넷" 서술이 수정되지 않았다
  - 위치: `plan/in-progress/eia-internal-rest-error-masking.md:226` (`> **\`stop\` 은 반환 지점이 넷**이라(waiting · \`affected=0\` · 정상 · 각 폴백) 호출부 마스킹으로는 다섯 번째가 추가될 때 빠진다 …`)
  - 상세: 같은 파일 `:339-340`(`## 체크리스트`)은 `18_14_50` 라운드가 *"내가 센 `stopInternal` 반환 지점 수가 틀림"* 을 WARNING 으로 지적했다고 기록하고, 실제 소스(`executions.service.ts` `stop()` JSDoc)는 이미 *"종전 이 문장은 '반환 지점이 넷' 이라고 썼는데 틀렸다 … `return` 문은 셋이다"* 로 정정돼 있다. 그런데 같은 정정이 이 plan 문서의 앞쪽 `## 조치` 절(`:226`)에는 역전파되지 않아, 이 문서를 위에서부터 읽는 사람은 여전히 "반환 지점 넷" 을 사실로 받아들이게 된다. 이 세션 자체가 *"근거를 실제보다 넓게/부정확하게 쓴 것"* 을 이미 네 차례(§R17 적용범위·표면 전수·반환 지점 수·secret 근거) 반복해 잡아냈다고 스스로 기록한 만큼, 같은 오류가 소스에서는 고쳐지고 plan 문서에서는 안 고쳐진 채 남는 것은 그 반복 패턴의 다섯 번째 사례에 해당한다.
  - 제안: `:226` 블록에 `18_14_50` 정정을 반영(예: "`stop` 은 `return` 문이 셋이고, 각 폴백을 포함하면 나갈 수 있는 객체는 여섯 가지다 — 호출부 마스킹으로는 새 반환 경로가 추가될 때 빠진다") 하거나, 최소한 "이 수치는 `18_14_50` 에서 정정됨, 아래 체크리스트 참조" 각주를 단다.

- **[INFO]** 문서화 관점에서는 이번 변경셋이 이례적으로 충실하다 — 확인 근거를 남긴다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts`(신규 JSDoc), `codebase/backend/src/modules/executions/executions.service.ts`(`ResponseExecution`/`ResponseNodeExecution`/`stop`/`stopInternal`/`toResponseExecution` JSDoc), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`(Swagger JSDoc 2곳), `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`(`@ApiPropertyOptional description`), `CHANGELOG.md`, `.claude/docs/plan-lifecycle.md`
  - 상세: (1) 신규 공개 함수 `redactStoredErrorForResponse` 는 SoT 링크·설계 이유(`toTerminalErrorPayload` 미재사용 이유)·보장의 경계·`@param`/`@returns` 를 모두 갖춘 JSDoc 을 갖는다. (2) 응답 DTO 4곳(`ExecutionDto.error`, `NodeExecutionSummaryDto.error`, `BackgroundRunNodeExecutionDto.error`) 이 마스킹 부수효과·SoT 포인터를 Swagger `description` 에 명시해 API 문서(Swagger UI)에도 그대로 반영된다 — API 계약 변경이 문서에 동반됐다. (3) `CHANGELOG.md` 에 wire 변화(바이트 변경 가능성)·영향 범위·잔여 갭을 상세히 기록했다. (4) `stop()`/`stopInternal()` 분리 시 TOCTOU 계약 JSDoc 을 실제 로직이 있는 본체로 옮기고 얇은 wrapper 에는 위임 포인터만 남겨, "로직 이동 시 설명도 함께 이동" 원칙을 지켰다. (5) `.claude/docs/plan-lifecycle.md` 의 `pending_plans` 신규 절은 재현 가능한 측정 방법(frontmatter-only 파싱 vs `grep` 과다계상 차이, 오탐 파일 2곳 이름까지)을 명시해 "다시 셀 때 같은 논쟁이 반복되지 않게" 설계했다 — 실측으로 현재 수치(spec 17 · plan 4)가 여전히 정확함을 별도로 확인했다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** `review/code/**`·`review/consistency/**` 하위 신규 산출물(RESOLUTION/SUMMARY/체커 리포트/`meta.json`/`_retry_state.json`)은 리뷰 세션의 이력 기록물로, 이 저장소의 정착된 관용(코드 리뷰·일관성 검토 산출물을 `review/` 에 커밋)과 일치한다
  - 위치: `review/code/2026/08/16/{17_12_34,17_35_49,17_56_15,18_14_50,18_33_52}/**`, `review/consistency/2026/08/16/{16_03_57,16_32_42,16_48_55,17_35_13,18_20_34}/**`
  - 상세: 별도의 사용자向 문서화 대상이 아니며(내부 감사 로그 성격), CLAUDE.md 의 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 저장 규약과 일치한다. 각 라운드 RESOLUTION.md 가 "왜 이 조치를 택했는지"와 "왜 일부 지적을 되돌렸는지"(예: `17_12_34` RESOLUTION `#7`)를 근거와 함께 남겨, 사후에 같은 논쟁이 반복되지 않도록 하는 문서화 관행 자체가 양호하다.
  - 제안: 조치 불필요.

## 요약

이번 변경셋은 EIA 내부 REST/WS 읽기 경로 `Execution.error`/`NodeExecution.error` egress 마스킹이라는 실질 코드 변경(신규 `redact-stored-error.ts` + 4개 소비처)에 대해, JSDoc·Swagger 설명·CHANGELOG·plan 트래커까지 문서화가 매우 충실하다. 이미 5라운드에 걸친 `/ai-review`(포함 documentation reviewer)가 CHANGELOG 누락·plan 체크박스 stale·고아 JSDoc·수치 오류 등을 반복적으로 찾아내 즉시 수정해 왔고, 이번 검토에서 재확인한 `pending_plans` 실측치(spec 17 · plan 4)도 현재 트리와 정확히 일치한다. 유일하게 남은 흠은 `eia-internal-rest-error-masking.md` 의 `## 조치` 절이 이후 라운드(`18_14_50`)가 소스 JSDoc 에서는 이미 정정한 "`stop` 반환 지점 수" 오류를 그 문서 앞쪽에는 역전파하지 않아, 같은 문서 안에서 정정 사실과 정정 전 서술이 공존하는 사소한 불일치다 — 프로덕션 코드나 spec SoT 가 아니라 내부 작업 추적 문서(plan)에 한정된 문제이므로 WARNING 으로 등급을 매긴다.

## 위험도

LOW
