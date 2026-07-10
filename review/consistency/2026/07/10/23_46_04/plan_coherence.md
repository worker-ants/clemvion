# Plan 정합성 검토 — EIA `getStatus.context` 스키마화 (--impl-done)

## 검토 대상

- diff base: `origin/main` (4 commits: `311015832` spec → `60c4c8900` impl → `efc9e791e` ai-review Warning 5건 fix → `b1d69ed8c` RESOLUTION hash 정정)
- 구동 plan: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md`
- 병행 확인 요청: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`

실제 git 이력을 직접 검증했다(commit별 diff, `git show --stat`, `git merge-base --is-ancestor`, 파일 grep) — payload 서술을 그대로 신뢰하지 않았다.

## 발견사항

### [INFO] 구동 plan 체크리스트의 첫 "e2e PASS (250)" 항목이 그 시점 실제 상태와 어긋남 (250 vs 249)

- target 위치: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` 체크리스트 — "`- [x] TEST WORKFLOW: lint PASS · unit PASS · build PASS · e2e PASS (250)`" 줄 (ai-review 이전 시점 항목)
- 관련 커밋: `60c4c8900` (최초 구현 커밋) 자신의 commit message 는 "lint·unit·build·e2e(**249**) 통과" 라고 명시했고, 그 시점 diff 로 plan 파일에 실제로 쓰인 문구도 `e2e PASS (249)` 였다(직접 `git show 60c4c8900 -- plan/...` 로 확인). 이후 `efc9e791e`(ai-review Warning 5건 fix, `I-2` e2e 신규 1건 추가로 249→250)가 plan 파일을 편집하면서 이 **과거 시점 줄 자체를 249→250 으로 덮어썼다** — 새 줄(`fix 후 TEST WORKFLOW 재통과 (e2e 250)`)을 추가하는 대신, 이전 체크포인트의 숫자를 현재 값으로 소급 정정한 것.
- 상세: 결과적으로 지금 plan 문서에는 "ai-review 이전"과 "ai-review 이후" 두 e2e 통과 기록이 **둘 다 250** 으로 남아, "warning fix 로 e2e 가 249→250 으로 늘었다"는 실제 이력(두 commit message 모두 일치)을 문서 자체에서는 재구성할 수 없다. 작업 실체(각 시점에 lint/unit/build/e2e 가 실제로 통과했다는 것) 자체는 참이라 "forward-looking `[x]`" 급 위반은 아니지만, 괄호 안 숫자는 그 시점 실제 상태(249)와 다르다 — "체크박스 = 실제 상태" 원칙을 괄호 수치 레벨에서 어겼다.
- 제안: 구동 plan 문서를 갱신할 여지가 있다면 첫 줄을 `e2e PASS (249)` 로 되돌리는 편이 이력 추적성에 낫다. 다만 **차단 사유는 아니다** — RESOLUTION.md 와 두 commit message 에 249→250 실제 이력이 정확히 남아 있어 감사 가능성은 유지된다.

### [INFO] `## 후속 (본 PR 밖)` 은 완료 이동을 막지 않음 — 기존 선례와 일치

- target 위치: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` 말미 `## 후속 (본 PR 밖)` (2항목: `dto/responses.dto.ts` flat→subdirectory 이관, `eia-types.ts` variant union 좁히기)
- 관련 plan: `plan/complete/spec-sync-5-system-metrics-gap.md`, `plan/complete/webchat-widget-refactor.md` 등 25개 `plan/complete/*.md` 가 동일 패턴(`## 후속 (별도 PR)` / `(이번 PR 조치 안 함)` 프로즈 bullet, 체크박스 아님)을 그대로 유지한 채 `complete/` 에 있다.
- 상세: `.claude/docs/plan-lifecycle.md §2` 를 문자 그대로 읽으면 "미해결 follow-up 항목이 하나라도 있으면 in-progress" 로 보이지만, 실제 운영 관행은 "본 PR 범위 밖으로 명시된" 프로즈 후속 노트는 완료 이동을 막지 않는 것으로 확립돼 있다(위 선례 다수). 본 항목은 그 확립된 예외에 해당하므로 이동 차단 사유가 **아니다** — 다만 참고용으로 기록한다.

## 점검 관점별 결론

### (a) 체크박스가 실제 상태와 일치하는가

- **spec 커밋 4항목** (`swagger.md` §1-4/§5-2, `api-convention.md` §5.4, EIA §5.3 예시, `spec-sync-...` cross-ref) — `a02db4f9a`(=`311015832` 의 실제 커밋, plan 이 인용한 해시와 로그 상 커밋 하나로 확인) 에 전부 반영됨을 `git show` 로 직접 대조 완료. 일치.
- **`/consistency-check --spec`** (`review/consistency/2026/07/10/22_30_47/`) — 세션 실재, SUMMARY.md 존재, Critical 0 / Warning 5 / Info 6 claim 과 파일 내용 일치. Warning 5건(W1~W5) 모두 draft 에 반영됐음을 이후 커밋 diff 로 확인.
- **`/consistency-check --impl-prep`** (`review/consistency/2026/07/10/22_50_15/`) — 세션 실재, Critical 0 / Warning 1 / Info 8 claim 과 파일 내용 일치. W1(flat 파일 위치 미준수)은 후속으로 defer 됐고 plan §후속 에 실제로 등재됨. I1~I4(Info→구현 반영 의무화 항목: nullable 명시, `| null` 금지, `CurrentNodeDto` 신설)는 diff 에서 전부 반영 확인.
- **구현 6개 sub-item** — `ButtonsContextDto`/`NodeOutputContextDto`(discriminator 없음)+`@ApiExtraModels`, `CurrentNodeDto` 신설, `result`/`error` `nullable: true`, stale JSDoc 정정, `eia-types.ts` 정정, `interaction.service.ts` `WaitingContextBase(Dto)` 명시 annotate — 전부 실제 diff 에서 확인.
- **테스트 개수** — `responses.dto.spec.ts` 신규 15건: 직접 카운트(단일 `it(` 11개 + `it.each` 2블록×2케이스=4) = **15, 정확히 일치**. `interaction.service.spec.ts` 신규 2건 — diff 로 정확히 2개 `it(` 블록 확인. e2e `I-2` 1건 — diff 로 확인, 신규 추가는 `efc9e791e`(ai-review fix 커밋)에서 이뤄짐(초기 구현 커밋 `60c4c8900` 에는 없었음 — W5(b) 조치로 신설된 것이 맞음).
- **e2e count 250** — **최종 상태는 정확**(현재 코드베이스에 `I-2` 존재, RESOLUTION.md·`efc9e791e` commit message 가 "249→250(+1)" 을 명시). 다만 **ai-review 이전 시점을 기록한 첫 체크리스트 줄**이 소급 편집으로 249 대신 250 을 표시하는 하자가 있음 (위 INFO 항목 참조) — 차단급은 아님.
- **`/ai-review` SUMMARY + RESOLUTION** (`review/code/2026/07/10/23_20_33/`) — 세션 실재. SUMMARY: Critical 0 / Warning 5(W1 링크 off-by-one, W2 `WaitingContextBase` 명명, W3/W4 약한 assertion, W5(a)/(b) 테스트 중복·e2e 갭), 위험도 LOW — 파일 내용과 plan 인용 일치. RESOLUTION.md: 5건 전부 조치(defer 0), commit hash 는 최초 `d47e0d4d5`(placeholder) → `b1d69ed8c` 에서 실제 커밋 해시 `efc9e791e` 로 정정 — 이 정정 자체가 "이력 기록의 정확성"을 개발자가 능동적으로 지킨 좋은 신호. 조치 내역(6단계 링크, `WaitingContextBaseDto` export, `toBeUndefined()`, `allOf` 직접 단언, `buttons`+thread부재 테스트 교체 + `I-2` e2e 신설)을 diff 로 전부 실측 확인.
- **`origin/main` rebase (PR #899 선병합)** — `git merge-base --is-ancestor origin/main HEAD` 로 확인(참). `52f46f95f`(PR #899, `docs(spec): PR #874 defer 문서 보강`)가 본 브랜치의 EIA 커밋들보다 먼저 로그에 등장 — rebase 주장과 일치. 두 PR 이 건드리는 파일(EIA 3개 spec + `spec-sync-...` plan vs `1-widget-app.md`+`conversation-thread.md`)이 겹치지 않아 "충돌 없음" claim 도 실제와 일치.
- **결론**: 유일한 미체크 항목은 `- [ ] /consistency-check --impl-done` 뿐이며, 이는 바로 본 검토 세션이다 — 정상적인 forward-reference (아직 안 끝난 항목을 `[ ]` 로 정직하게 남긴 경우)이지 위반이 아니다. 그 외 모든 `[x]` 는 repo 상태와 대조해 실제로 참이다(위 249/250 괄호 숫자 1건 제외 — INFO 급).

### (b) `complete/` 이동 자격

**이번 커밋에서는 아직 아니다** — `/consistency-check --impl-done` 자체가 미완료 항목으로 남아 있기 때문. 이 검토(5개 checker: cross_spec·rationale_continuity·convention_compliance·plan_coherence·naming_collision)가 종합 **BLOCK: NO** 로 귀결되면, 오케스트레이터가 같은 PR 안에서:

1. 이 마지막 체크박스를 `[x]` 로 정정
2. `## 후속 (본 PR 밖)` 2항목은 위 [INFO] 근거로 이동을 막지 않음 확인
3. frontmatter 에 `spec_impact` 추가 — **YAML 리스트**(bare string 아님, Gate C 회귀 방지):

   ```yaml
   spec_impact:
     - spec/conventions/swagger.md
     - spec/5-system/2-api-convention.md
     - spec/5-system/14-external-interaction-api.md
   ```

   (이 3개는 plan 본문 "Rationale (draft — 반영 시 아래 배정대로 각 spec 의 `## Rationale` 로 이관)" 절이 명시한 이관 대상과 정확히 일치하며, 실제로 커밋 `311015832` 가 세 파일을 전부 수정했음을 `git show --stat` 으로 확인했다.)
4. `git mv plan/in-progress/spec-draft-eia-context-schema-absence-convention.md plan/complete/` + `chore(plan): mark spec-draft-eia-context-schema-absence-convention complete` 커밋

으로 **같은 PR 안에서** 이동 가능하다 (plan-lifecycle §3 "이동은 마지막 작업 PR 안에서" 원칙과 부합).

### (c) `spec-sync-external-interaction-api-gaps.md` 정합성

**정합 — 충돌 없음.** 두 가지를 직접 대조했다:

1. **축-분리 note** — 커밋 `311015832`(본 PR 첫 커밋)가 이 plan 의 `[x] GET .../executions/:id 의 currentNode / context 실값` 항목 바로 아래에 "**축 분리 주의**: 본 항목은 런타임 실값만 종결한다. 그 실값의 OpenAPI 스키마 표현과 부재 표현 컨벤션은 별도 축이며 `spec-draft-eia-context-schema-absence-convention.md` 에서 진행한다" 를 추가했음을 `git show` 로 확인 — 정확히 요청된 내용이고, 기존 `[x]` 판정(런타임 wire 는 이미 정확했다는 결론)과 모순되지 않는다(본 PR 은 wire 를 바꾸지 않고 스키마 표현만 바꿨으므로).
2. **PR #899(`52f46f95f`)가 추가한 2항목**(`getStatus 일반 nodeOutput 키-allowlist`, `host resetSession booting 중 중복 webhook 가드`) — 둘 다 이번 PR 의 diff 범위(oneOf 봉투 스키마 표현) 와 무관한 축(redaction allowlist 정책, 위젯 host SDK 레이스)이다. 본 PR 이 이 두 항목을 무효화하거나 선점하는 결정을 내리지 않았다 — 그대로 열린 채 남아 있고 그게 맞다.

### (d) 다른 in-progress plan 무효화 여부

`responses.dto.ts`/`ExecutionStatusDto`/`eia-types.ts`/`getStatus`/`swagger.md`/`api-convention.md`/`external-interaction` 키워드로 `plan/in-progress/**` 전체를 grep 한 결과, 관련된 것으로 나온 항목은 모두 **본 PR 이 건드리지 않은 EIA 의 다른 절**을 가리키는 cross-ref 뿐이었다:

- `ai-agent-tool-connection-rewrite.md` — EIA §5.2 SSE `execution.tool_call_*` payload `name` namespace (본 PR 무관, §5.3 아님)
- `merge-p2-async-fanin.md` — EIA §R7 monotonic seq 보장 (본 PR 무관)
- `node-output-redesign/README.md` — EIA §6.3 `execution.failed` notification payload (본 PR 무관, REST `getStatus` 아님)
- `self-hosting-deployment.md` — EIA §8.1 SSRF allowlist (본 PR 무관)

이 중 어느 것도 `getStatus.context`(§5.3)의 oneOf 스키마 표현을 다루거나 그것에 의존하지 않는다 — 무효화된 후속 항목 없음.

**참고(차단 대상 아님, 별건)**: `plan/in-progress/spec-draft-pr874-deferred-docs.md` (PR #899 의 구동 plan) 는 자신의 커밋(`52f46f95f`)이 이미 `origin/main` 에 병합됐음에도 `- [ ] doc-guard 통과` / `- [ ] commit + PR` 2항목이 아직 `[ ]` 로 남아 있다. 이는 본 PR 의 diff 밖(본 PR 이 그 파일을 건드리지 않음)이고 본 PR 이 유발한 무효화가 아니므로 이번 검토의 발견사항으로 등재하지 않으나, 별도로 정리가 필요해 보인다(오케스트레이터가 인지할 만한 hygiene 잔여).

## 요약

구동 plan `spec-draft-eia-context-schema-absence-convention.md` 의 체크리스트는 마지막 `/consistency-check --impl-done` 한 줄을 제외하면 실제 repo 상태와 정확히 일치한다 — spec 커밋 해시, 두 차례 consistency-check 세션, ai-review SUMMARY/RESOLUTION, 테스트 개수(15/2/1), rebase 사실을 모두 git 으로 직접 재확인했다. 유일한 흠은 ai-review 이전 시점 e2e 통과 개수가 실제(249) 대신 최종값(250)으로 소급 편집된 괄호 숫자 1건인데, 최종 249→250 이력 자체는 commit message·RESOLUTION.md 에 정확히 남아 있어 감사 가능성은 유지되고 차단 사유가 아니다. `## 후속 (본 PR 밖)` 2항목은 `plan/complete/` 의 확립된 선례와 일치하므로 이동을 막지 않는다. 이번 --impl-done 검토가 (다른 4개 checker 포함) 종합 BLOCK: NO 로 귀결되면, 마지막 체크박스를 `[x]` 로 정정하고 `spec_impact` 를 `swagger.md`/`api-convention.md`/`14-external-interaction-api.md` 3개 리스트로 선언한 뒤 **같은 PR 안에서** `plan/complete/` 로 이동 가능하다. `spec-sync-external-interaction-api-gaps.md` 는 축-분리 note 가 정확히 반영됐고 PR #899 가 추가한 2개 신규 미해결 항목과도 축이 달라 충돌이 없다. 다른 in-progress plan 중 이번 변경으로 무효화되는 항목은 없다.

## 위험도

NONE

STATUS: SUCCESS
