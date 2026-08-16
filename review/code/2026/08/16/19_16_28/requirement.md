# 요구사항(Requirement) Review — `19_16_28`

## 대상 요약

이번 changeset 은 "같은 `Execution.error`/`NodeExecution.error` 를 표면마다 다른 값으로 말하던"
결함(종결 emit 은 마스킹, 내부 읽기 경로는 원문)을 해소하는 작업(`eia-internal-rest-error-masking`)
전체다. 신규 `redactStoredErrorForResponse`(`codebase/backend/src/shared/utils/redact-stored-error.ts`)를
`ExecutionsService` 4경로(`findById`·`toExecutionDto`·`getChain`·`stop`) + `BackgroundRunsService`
body 노드에 적용하고, spec 5곳 + plan 다수 + 이미 완료된 6라운드 `/ai-review`·6라운드
`consistency-check` 산출물이 함께 포함된 대형 diff다. 실질 코드 변경은 신규 유틸 1개 + 소비처
2개 서비스(+DTO 주석)로 좁고, 나머지는 문서/plan/review 산출물이다.

## 검증 방법

- 핵심 구현 파일 전문 확인: `redact-stored-error.ts`, `redact-stored-error.spec.ts`,
  `executions.service.ts`(전문), `executions.service.spec.ts`(관련 구간), `background-runs.service.ts`(전문),
  `background-runs.service.spec.ts`(관련 구간), 두 응답 DTO 파일.
- `deepRedactSecrets`/`SECRET_LEAK_PATTERNS`(`sanitize-error-message.ts`) 원본 확인 — 문자열/숫자/객체
  타입 보존, copy-on-change, depth cap 동작을 코드 레벨로 대조.
- spec 5곳(`1-data-model.md` §2.14, `2-navigation/14-execution-history.md` R-5, `4-nodes/1-logic/12-background.md`
  §8.2, `5-system/14-external-interaction-api.md` §R17, `5-system/6-websocket-protocol.md`,
  `conventions/secret-store.md` §1)을 코드 구현과 line-level 대조.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커에서 I1·D 항목 종결 여부와
  신규 잔여 등재(workflow-assistant 갭) 확인 → `explore-tools.service.ts:462-464`·`482-484` 실제
  코드로 재검증(값-패턴 마스킹 미적용, `maskSensitiveFields` 키-기반만 적용 — 서술과 일치).
- `.claude/docs/plan-lifecycle.md` 의 `pending_plans` 실측치(spec 17 / plan 4)를 frontmatter-only
  파서로 독립 재현 — **일치 확인**(스크립트로 `spec/**/*.md`·`plan/**/*.md` frontmatter 블록만 파싱).
- `stop()` 의 내부 소비자(`interaction.service.ts` 2곳, `hooks.service.ts` 1곳)가 반환값을 실제로
  버리는지 grep+소스 확인 — JSDoc 주장과 일치.
- `plan/complete/*.md` 로 새로 고친 상대경로 링크(`../complete/eia-terminal-emit-facade.md` 등) 6곳
  대상 파일 실재 확인.
- TODO/FIXME/HACK/XXX 마커 grep — 핵심 구현·테스트 파일 전체 0건.

## 발견사항

없음. CRITICAL·WARNING 급 결함을 찾지 못했다.

- **[INFO]** `stop()` 의 `WAITING_FOR_INPUT` 취소 분기가 자격증명-형태 `error` 값으로 마스킹 관문
  통과를 직접 단언하는 테스트가 없다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` `describe('stop — WAITING_FOR_INPUT cancel (C-1)')` (`732`행 부근)
  - 상세: `stop()` 은 `toResponseExecution(await this.stopInternal(id))` 로 **모든** 분기를 단일
    관문에 통과시키므로 기능적 위험은 낮다(다른 두 분기는 credential-shaped fixture 로 직접
    검증됨, `Execution.error 응답 마스킹 — 표면 전수` describe 블록). `WAITING_FOR_INPUT` 분기만
    `baseFake` 로 `error` 필드에 자격증명 모양 값을 넣지 않는다. 이 갭은 직전 라운드
    `17_35_49` testing reviewer 가 이미 INFO 로 지적했고 "필수는 아니다" 로 판단되어 의도적으로
    보류됐다 — 재발견이 아니라 확인.
  - 제안: 선택적 하드닝. `waiting` fixture 에 credential-shaped `error` 를 채우고
    `engine.cancelWaitingExecution` 성공 경로에서도 마스킹 단언을 하나 추가하면 "표면 전수"
    describe 명과 실제 커버리지가 완전히 일치한다.

## Spec fidelity 상세 확인 결과 (참고, 전부 일치)

- `spec/5-system/14-external-interaction-api.md` §R17 "내부 읽기 경로도 같은 마스킹을 적용한다"
  불릿의 함수명(`redactStoredErrorForResponse`)·적용 표면 4곳(`findById`·`toExecutionDto`·
  `getChain`·`stop`)·재사용 경로(`re-run`→`findById`, WS `execution.snapshot`→`findById`)·
  `nodeExecutions[].error` 확장·`BackgroundRunsService` body 노드 확장·"열거이지 총칭이 아니다"
  캐비엇·잔여 3항목(WS `execution.node.*` emit·`inputData`/`outputData`·workflow-assistant) —
  전부 코드와 line-level 로 일치.
- `spec/1-data-model.md` §2.14 신규 "응답 마스킹" 행의 4경로 열거 + "DB 는 원문 보존" + "어디서
  나가든 마스킹된다로 읽으면 안 된다" 캐비엇 — `executions.service.ts`/`background-runs.service.ts`
  구현과 일치.
- `spec/2-navigation/14-execution-history.md` R-5 위에 추가된 범위 캐비엇("Config 탭 echo 와
  `Execution.error` egress 마스킹은 별개 정책") — R-5 원문이 실제로 Config 탭(§3.3)에 한정돼
  있음을 확인, 캐비엇이 정확히 그 경계를 명시.
- `spec/4-nodes/1-logic/12-background.md` §8.2 `nodeExecutions.data` 행의 마스킹 서술 —
  `background-runs.service.ts` `toNodeExecutionDto` 의 `redactStoredErrorForResponse(row.error)`
  적용과 일치.
- `spec/5-system/6-websocket-protocol.md` `execution.snapshot` 행의 "관문 상속 + `execution.node.*`
  emit 은 원문" 대비 서술 — `findById` 재사용 경로와 emit 경로(마스킹 미적용) 실제 구조와 일치.
- `spec/conventions/secret-store.md` §1 신규 `interaction.triggerToken` 비대상 예외 — 앵커
  `#1-uri-scheme` 이 실제 `## 1. URI Scheme` 헤더와 일치, 근거 (a)(b)(c) 가 `AuthConfig.config`
  예외 문구를 재사용하지 않고 독립적으로 서술됨을 확인.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` I1·D 항목의 `[x]` 종결과 신규
  잔여(workflow-assistant 갭, `NodeExecution.error` 격상) 등재 — 실제 코드 상태와 일치.

## 요약

핵심 신규 로직(`redactStoredErrorForResponse`)과 그 4+1개 소비처는 기능적으로 완전하고,
null/undefined/레거시 문자열·숫자·중첩 credential 키 등 엣지 케이스가 캐너리 테스트로 고정돼
있으며, copy-on-change 참조 동일성까지 검증하는 테스트가 존재한다. TODO/FIXME 류 미완성 표식은
없고, 함수명·JSDoc·실제 동작 간 괴리도 발견되지 않았다(오히려 "왜 `toTerminalErrorPayload` 를
재사용하지 않는지" 등 의도와 경계를 명시적으로 문서화). 반환값은 모든 코드 경로(`stop` 의 3개
분기 포함)에서 일관된 `ResponseExecution`/`ResponseNodeExecution` 타입으로 마스킹된 값을
반환한다. 관련 spec 본문 6개 문서를 line-level 로 대조한 결과 함수 시그니처·적용 표면 열거·
"열거이지 총칭이 아니다" 경계·DB egress-only 원칙·잔여 갭 서술이 모두 구현과 정확히 일치하며,
불일치(코드 오류든 SPEC-DRIFT 든)를 발견하지 못했다. `pending_plans` 실측치(spec 17/plan 4)도
지정된 파싱 기준으로 독립 재현해 정확함을 확인했다. 유일한 관찰 사항은 이미 이전 라운드에서
의도적으로 보류된 INFO 수준의 테스트 커버리지 갭(‘stop’의 waiting 분기 마스킹 직접 단언 부재)
뿐이며 기능적 위험은 없다.

## 위험도

NONE
