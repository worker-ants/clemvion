# 요구사항(Requirement) Review

## 발견사항

- **[WARNING]** `.claude/docs/plan-lifecycle.md` 의 신규 실측치 "plan 레벨 **4건**" 이 현재 워크트리 상태와 맞지 않는다 — 실제로는 **5건**이다
  - 위치: `.claude/docs/plan-lifecycle.md:88`
  - 상세: 해당 줄은 *"실측(2026-08-16): spec 레벨 **17건** · plan 레벨 **4건**"* 이라고 단언한다. `spec 레벨 17건` 은 `grep -rl '^pending_plans:' spec/` 결과(18개 파일 중 `spec/conventions/spec-impl-evidence.md` 1개는 스키마 예시 텍스트라 제외)와 정확히 일치해 맞다. 그런데 plan 레벨을 같은 방식(`grep -rl '^pending_plans:' plan/`)으로 실측하면 다음 **5개** 파일이 나온다: `plan/complete/spec-draft-ws-types-canonical-location.md` · `plan/complete/spec-draft-eia-error-masking-catalog.md` · `plan/complete/spec-draft-web-chat-console.md` · `plan/in-progress/spec-draft-eia-notification-payload-contract.md` · `plan/in-progress/eia-internal-rest-error-masking.md`(이 PR 자신의 구동 plan, frontmatter `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]` 확인함). 누락된 다섯 번째는 `plan/complete/spec-draft-web-chat-console.md` — `git log`로 확인하면 커밋 `12a24bb90`(PR #684)로 이미 `origin/main` 에 존재하던 파일이라 이 PR 의 diff 에는 전혀 나타나지 않는다. 즉 "실측" 이 `git diff` 로 보이는 범위만 훑고 저장소 전체(특히 이 브랜치가 건드리지 않는 기존 `plan/complete/**`)를 포함하지 않은 것으로 보인다.
  - **역설**: 바로 이 문단(:92-95)이 *"이 수치는 처음에 3 이라고 적었다가 4 로 정정했다 … PR 안의 정량 기록은 'PR 이 닫히는 시점' 기준으로 재야 한다"* 는 자기 교정 사례를 서술하고 있다 — 그런데 그 교정된 값(4) 자체가 이미 review 시점(지금) 기준으로 다시 stale/incorrect 하다. 정확히 이 문단이 경계하는 실패 형태가 같은 PR 안에서 한 번 더 재발했다.
  - 제안: `4건` → `5건` 으로 정정하거나(가장 값싼 수정), 혹은 하드코드된 수치 대신 "`grep -rl '^pending_plans:' plan/` 로 직접 확인" 같은 재현 가능한 커맨드 참조로 바꿔 향후 커밋이 값을 또 stale 하게 만들 위험 자체를 제거하는 편을 권한다.

## 확인했으나 문제 없음 (참고)

핵심 코드 변경(`redactStoredErrorForResponse` 신규 유틸 + `ExecutionsService`/`BackgroundRunsService` 4+1 소비처)을 spec·테스트·컨트롤러·WS 게이트웨이까지 직접 열어 대조했다. 이미 이 PR 이 자체적으로 4라운드 `/ai-review`(`17_12_34`→`17_35_49`→`17_56_15`→`18_14_50`, CRITICAL 0 로 수렴)를 거쳤으므로, 본 라운드에서는 그 결과를 재확인하는 데 집중했다.

- **적용 지점 4+1곳이 spec §R17 서술과 정확히 일치** — `codebase/backend/src/modules/executions/executions.service.ts` 의 `findById`(624-644행, `reconciledNodeExecutions`) · `toExecutionDto`(950행) · `getChain`(564행, `toResponseExecution` 경유) · `stop`(822행, `toResponseExecution` 경유) 4곳 + `background-runs.service.ts` `toNodeExecutionDto`(302행). `spec/5-system/14-external-interaction-api.md:1486-1523` §R17 불릿의 "4곳" 열거·"`nodeExecutions[].error` 도 함께"·"WS `execution.snapshot`/`re-run` 은 `findById` 재사용" 서술이 코드와 line-level 로 일치한다.
- **`@Roles` 게이트 부재 claim 검증** — `executions.controller.ts` 의 `GET :id`(63행)·`GET :id/chain`(293행) 은 실제로 `@Roles` 데코레이터가 없고, `stop`(122행)만 `@Roles('editor')` 다. `websocket.gateway.ts:399` 가 실제로 `this.executionsService.findById(executionId)` 를 호출해 WS `execution.snapshot` 이 같은 마스킹 관문을 상속한다는 주장도 확인.
- **내부 소비자가 `stop()` 반환값을 버린다는 JSDoc 주장 검증** — `interaction.service.ts:226,248`·`hooks.service.ts:407` 모두 `await this.executionsService.stop(...)` 를 결과 미사용으로 호출, 컨트롤러(`executions.controller.ts:145`)만 반환값을 그대로 응답한다.
- **DB 원문 미변이(egress-only) + null/undefined 정규화 + copy-on-change 참조 동일성** — `redact-stored-error.ts`(57-64행)와 그 `.spec.ts` 100줄 스위트, `executions.service.spec.ts` "Execution.error 응답 마스킹 — 표면 전수" describe 블록(854-1108행, ①~⑤-c)이 각각 독립적으로 커버한다. `⑤-c` 는 `toBe`/`not.toBe` 로 참조 동일성까지 단언해 "무조건 spread 로 되돌리는" 회귀를 잡는 형태다.
- **엔티티 `error` 타입이 `Record<string, unknown>`(non-null) 인데 런타임엔 null 가능**(pre-existing, 이 diff 무관) — `redactStoredErrorForResponse`/`ne.error == null` 양쪽 모두 방어적으로 처리해 실질 위험 없음.
- **`spec-impl-evidence.md`·`redact-stored-error.ts`·`background-runs`/`executions` DTO Swagger JSDoc 4곳** 이 서로 참조하는 SoT 포인터(EIA §R17, 데이터 모델 §2.14)가 실제 해당 절 내용과 부합.
- **TODO/FIXME/HACK/XXX 없음** — `git diff origin/main...HEAD -- codebase/` grep 결과 0건.
- **plan 체크리스트 자기 서술** — `eia-internal-rest-error-masking.md` 의 조치 항목 전부 `[x]`(마지막 "push 게이트 통과 → PR" 만 미완료, 정상), `spec-sync-external-interaction-api-gaps.md` 의 I1/D/`NodeExecution.error` 항목이 실제로 `[x]` 로 닫혀 있고 잔여 3항목(①WS emit·②inputData/outputData·③workflow-assistant)은 `[ ]` 로 정확히 열려 있음을 확인.

## 요약

핵심 기능 변경(내부 REST/WS 읽기 경로 `Execution.error`·`NodeExecution.error` egress 마스킹)은 spec(§R17)·구현·테스트가 line-level 로 정확히 일치하고, 4라운드 자체 리뷰를 거치며 null/copy-on-change/캐시-내부/DB-비변이 등 엣지 케이스가 촘촘히 커버돼 있어 요구사항 충족도가 높다. 독립 검증(controller `@Roles`, WS gateway 경유, 내부 소비자의 반환값 미사용)도 모두 문서·주석의 주장과 실제 코드가 일치함을 확인했다. 유일한 실질 발견은 이 PR 이 새로 추가한 프로세스 문서(`plan-lifecycle.md`)의 "plan 레벨 4건" 실측치가 저장소 전체 기준으로는 5건이라는 점이다 — 코드 결함은 아니지만, 바로 그 문단이 "정량 기록은 PR 이 닫히는 시점 기준으로 재라" 는 교훈을 서술하면서 정작 자신이 같은 실패를 반복한 것이라 정정을 권한다.

## 위험도

LOW
