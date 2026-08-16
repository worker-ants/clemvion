# 요구사항(Requirement) Review

## 범위 요약

이번 changeset 의 실질 코드 변경은 5개 backend 파일(신규 `shared/utils/redact-stored-error.ts`
+ `.spec.ts`, `executions.service.ts`(+`.spec.ts`), `background-runs.service.ts`(+`.spec.ts`),
DTO JSDoc 2곳)과 spec 6곳(`spec/5-system/14-external-interaction-api.md` §R17,
`spec/1-data-model.md` §2.14, `spec/2-navigation/14-execution-history.md` R-5,
`spec/4-nodes/1-logic/12-background.md` §8.2, `spec/5-system/6-websocket-protocol.md`,
`spec/conventions/secret-store.md` §1), 그리고 다수의 `plan/**`·`review/**` 문서 정리로 구성된다.
목적은 `Execution.error`/`NodeExecution.error` 컬럼 값이 종결(WS/SSE/webhook) emit 경로에서만
자격증명 값-패턴 마스킹(#1177)되고, 같은 값을 싣는 내부 REST 읽기 경로(4곳)와 WS
`execution.snapshot`(`findById` 재사용) · `background-runs` body 노드는 원문으로 새고 있던
비대칭을 닫는 것이다.

이 PR 은 같은 브랜치에서 5라운드 `/ai-review`(누적 CRITICAL 0 · WARNING 15, 전부 조치)와
6라운드 consistency-check(`--impl-prep`→`--spec`→`/ai-review`×5)를 이미 거쳤다. 아래는 그
결과를 그대로 재확인하지 않고, 실제 소스·spec·테스트를 직접 열어 독립적으로 재검증한 결과다.

## 발견사항

- **[INFO]** 표면 전수(4곳 + 재사용 2곳 + 자매 1곳) 주장을 실측으로 확인 — 정확함
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `toResponseExecution`(994-1000행) · `findById`(638-644행 `reconciledNodeExecutions`) · `toExecutionDto`(950행) · `stop`/`stopInternal`(821-915행); `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `toNodeExecutionDto`(285-304행)
  - 상세: `findById`·`getChain`·`stop` 셋은 `toResponseExecution` 공통 관문을 지나고, `toExecutionDto`(목록)는 별도로 직접 호출한다. `reRun`(493행 `this.findById(newExecutionId)`)과 WS `execution.snapshot`(`websocket.gateway.ts:399` `this.executionsService.findById(executionId)`, 소스로 직접 확인)은 `findById` 를 재사용하므로 함께 덮인다. `stopInternal`(834-915행)의 `return` 문은 정확히 **3개**이고(waiting 경로 · `affected=0` 재조회 · 정상 재조회), 각각 `?? execution` 폴백이 있어 나갈 수 있는 객체는 6가지이지만 전부 `stop()` 하나의 바깥 관문을 지난다 — JSDoc 의 "return 문 셋" 서술과 코드가 일치한다.
  - 제안: 조치 불필요. 확인 완료.

- **[INFO]** `NodeExecution.error` 형제 필드 우회 방어가 실제로 걸려 있음 — data-model §2.14 "복사" 관계와 line-level 일치
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:638-644` (`reconciledNodeExecutions`, copy-on-change `ne.error == null ? ne : {...ne, error: redactStoredErrorForResponse(ne.error)}`), `spec/1-data-model.md:561,564` (§2.14 "복사"/"응답 마스킹" 행)
  - 상세: spec §2.14 는 `Execution.error` 를 "최초 failed NodeExecution 의 에러 정보를 복사" 로 정의하고 "응답 마스킹" 행에서 "두 필드 모두 응답 egress 에서 자격증명 값-패턴 마스킹을 거친다 … 반드시 함께 건다" 고 규정한다. 코드가 정확히 그렇게 되어 있고(`executions.service.spec.ts:1005-1022` `⑤` 테스트가 최상위/노드 양쪽을 함께 단언), 자매 표면 `background-runs.service.ts:302` 도 동일 함수를 호출한다. `⑤-c`(`executions.service.spec.ts:1060-1090`)가 `error` 없는 행의 참조 동일성(`toBe`)까지 단언해 "무조건 spread 로 되돌리는" 회귀를 잡는다 — 값 비교만으로는 이 회귀가 GREEN 이었을 것이므로 판별력이 있다.
  - 제안: 조치 불필요.

- **[INFO]** spec 본문(EIA §R17 2026-08-16 결정 불릿)과 구현이 함수 시그니처·적용 범위·타입 계약까지 line-level 로 일치
  - 위치: `spec/5-system/14-external-interaction-api.md:1486-1525` vs `codebase/backend/src/shared/utils/redact-stored-error.ts:28-35`
  - 상세: spec 이 명시한 함수명(`redactStoredErrorForResponse`) · 위임 대상(`deepRedactSecrets`) · "형태 보존"(`toTerminalErrorPayload` 미재사용, 반환 타입 `Record<string, unknown> | null` 그대로) · 4경로 열거(`findById`/`toExecutionDto`/`getChain`/`stop`) · 재사용 경로(`re-run`, WS `execution.snapshot`) · `nodeExecutions[].error` 확장 · `background-runs` body 노드 확장 · "적용 범위는 총칭이 아니라 열거"(잔여 ①②③ 이름으로 명시) 가 전부 코드·테스트와 대응된다. `spec/5-system/6-websocket-protocol.md`(`execution.snapshot` 행에 "마스킹 관문을 상속한다" + `execution.node.*` emit 은 원문이라는 대비), `spec/4-nodes/1-logic/12-background.md`(§8.2 `nodeExecutions.data` 행), `spec/conventions/secret-store.md`(§1 `triggerToken` 비대상 예외 + Overview 캐비엇), `spec/2-navigation/14-execution-history.md`(R-5 범위 caveat) 5곳도 각각 실제 diff 와 대조해 불일치를 찾지 못했다.
  - 제안: 조치 불필요.

- **[INFO]** `redactStoredErrorForResponse` 의 TS 반환 타입(`Record<string, unknown> | null`)이 런타임에서 문자열/숫자(레거시 JSONB) 를 그대로 통과시키는 경우와 어긋난다 — 단, 의도적 단일 캐스트로 문서화·테스트됨
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:32-34` (`return deepRedactSecrets(err) as Record<string, unknown>;`), `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:59-74` (레거시 문자열/숫자 캐너리)
  - 상세: JSDoc 이 "단언을 이 한 자리에 모은다 — 호출부 4곳에 흩으면 한 곳이 다른 캐스트를 쓴다" 고 명시적으로 그 타협을 밝히고, 두 캐너리 테스트가 실제 런타임 동작(문자열은 문자열로, 숫자는 숫자로 통과)을 고정한다. 타입과 런타임이 어긋나는 지점이지만 의도·근거·테스트가 모두 갖춰진 설계 트레이드오프라 CRITICAL/WARNING 대상은 아니다.
  - 제안: 조치 불필요(기록용).

- **[INFO]** `.claude/docs/plan-lifecycle.md` 의 `pending_plans` 실측치(spec 17건·plan 4건)를 frontmatter-only 파싱으로 독립 재현 — 일치
  - 위치: `.claude/docs/plan-lifecycle.md` (신설 §, "실측(2026-08-16 스냅샷): spec 레벨 17건 · plan 레벨 4건" 문단)
  - 상세: `grep -rl '^pending_plans:'` 로 전체 파일을 훑으면 `spec/conventions/spec-impl-evidence.md`(스키마 예시 2곳)·`plan/complete/spec-draft-web-chat-console.md:158`(펜스 코드블록 안 예시)가 오탐으로 잡혀 과다 계상된다는 문서의 경고 그대로, frontmatter 블록만 파싱하는 스크립트로 재계산하면 spec 17 · plan 4 가 나온다(직접 재현, 아래 스크립트로 확인). plan 4건은 `plan/complete/spec-draft-ws-types-canonical-location.md` · `plan/complete/spec-draft-eia-error-masking-catalog.md` · `plan/in-progress/spec-draft-eia-notification-payload-contract.md` · `plan/in-progress/eia-internal-rest-error-masking.md`.
  - 제안: 조치 불필요. 수치 확인 완료.

- **[INFO]** 이전 라운드(`16_32_42` naming_collision CRITICAL — spec 초안에 폐기된 함수명 `redactExecutionErrorValue` 잔존)가 최종 spec 반영본에서 실제로 해소됐는지 직접 확인 — 해소됨
  - 위치: `spec/5-system/14-external-interaction-api.md:1487-1489`, `plan/in-progress/eia-internal-rest-error-masking.md:162-166`
  - 상세: 현재 spec 본문·plan 의 "spec 초안" 섹션 모두 `redactStoredErrorForResponse` 로 정정되어 있다. `redactExecutionErrorValue` 문자열은 저장소 전체에서 `plan/in-progress/eia-internal-rest-error-masking.md`(과거형 narration, `:92,272`)에만 남아 있고 이는 이름을 바꾼 이유를 설명하는 히스토리 서술이라 그대로 둬도 무방하다고 그 문서 스스로 밝히고 있다(`review/code/**/_prompts/**` 안의 동일 문자열은 `.gitignore` 대상이라 커밋 diff 밖).
  - 제안: 조치 불필요.

- **[INFO]** `stop()` 의 반환 타입 축소(`Execution` → `ResponseExecution`, `trigger`/`executor` 제외) 주장 — "응답에서 사라지는 필드는 없다"를 실측으로 재확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:834-835` (`stopInternal` 의 `this.executionRepository.findOne({ where: { id } })`, `relations` 미지정), `codebase/backend/src/modules/executions/entities/execution.entity.ts:38-40,86-88` (`trigger`/`executor` `@ManyToOne`, `eager` 미설정)
  - 상세: `relations` 옵션도 `eager: true` 도 없으므로 이 `findOne` 호출은 애초에 `trigger`/`executor` 관계를 로드하지 않는다 — 타입에서 제거된 것이지 실제 값이 사라지는 변경이 아니라는 JSDoc/CHANGELOG 주장이 정확하다.
  - 제안: 조치 불필요.

- **[INFO]** `tsc --noEmit` 독립 재실행 — 변경 파일 관련 오류 0건 확인
  - 위치: `codebase/backend` (전체 `tsc -p tsconfig.json`)
  - 상세: 저장소 전역에는 이 PR 과 무관한 기존 타입 오류가 다수 있으나(예: `alerts-evaluator.service.spec.ts`, `execution-engine.service.spec.ts` 등), `redact-stored-error.ts`/`.spec.ts`, `executions.service.ts`/`.spec.ts`, `background-runs.service.ts`/`.spec.ts`, `execution-response.dto.ts`, `background-run-response.dto.ts` 어디에도 매칭되는 오류가 없다.
  - 제안: 조치 불필요.

## 요약

핵심 변경(신규 leaf 유틸 `redactStoredErrorForResponse` + `ExecutionsService`/`BackgroundRunsService` 소비처 5곳)은 의도한 기능(종결 emit 전용이던 자격증명 값-패턴 마스킹을 내부 읽기 경로·WS snapshot·형제 필드(`NodeExecution.error`)·자매 표면(`background-runs`)까지 확장)을 완전하고 정확하게 구현한다. 함수 시그니처·null/undefined 정규화·copy-on-change(참조 동일성 테스트 포함)·DB 원문 비변이·레거시 JSONB(문자열/숫자) 통과·보장 경계(자격증명 없는 문자열은 무변화) 등 엣지 케이스가 캐너리 테스트로 고정돼 있고, TODO/FIXME/HACK 류 미완성 표식은 없다. `spec/5-system/14-external-interaction-api.md` §R17·`spec/1-data-model.md` §2.14를 비롯한 6개 spec 문서는 함수명·적용 범위(4경로+재사용 2곳+자매 1곳)·타입 계약(형태 보존, wire 정규화 아님)·잔여 갭(WS `execution.node.*` emit · `inputData`/`outputData` · workflow-assistant 세 필드)까지 코드와 line-level로 일치하며, 의도적으로 남긴 범위 밖 항목은 정본 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에 명시적으로 등재돼 있어 조용히 누락된 지점이 없다. 독립적으로 재현한 `pending_plans` 수치, `tsc --noEmit` 결과, 이전 라운드 CRITICAL(naming collision) 해소 여부도 모두 문서/코드의 주장과 일치했다. 새로운 CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

NONE
