# 변경 범위(Scope) 리뷰 — `17_35_49`

## 조사 방법

프롬프트에 diff 가 생략된 파일(`executions.service.ts`/`.spec.ts`, `plan/complete/*`,
`plan/in-progress/*` 다수)은 `git diff origin/main...HEAD -- <path>` 로 직접 열어 확인했다.
리뷰 대상은 branch `claude/eia-followups-1464c0` 전체 누적 diff(5 커밋:
`fafb57e46` · `4f27fe5ba` · `b8b5d4d77` · `4c1f89e55` · `9dee1caa0`, 67 files / +4059 -50)다.

## 발견사항

- **[WARNING]** 브랜치의 핵심 과제(`plan/in-progress/eia-internal-rest-error-masking.md` — 내부
  REST 읽기 경로 `Execution.error` 마스킹, 정본 트래커 I1/D 집행)와 무관한 **plan 위생 chore
  가 같은 브랜치에 번들**돼 있다.
  - 위치: `.claude/docs/plan-lifecycle.md:80`-`96`(`pending_plans` 대조표 신설) ·
    `plan/complete/eia-stalled-atomicity.md`(신규, 전체) · `plan/in-progress/backend-lint-gate-broken-on-main.md:787`
    (`./eia-terminal-emit-facade.md` → `../complete/eia-terminal-emit-facade.md`) ·
    `plan/in-progress/retry-turn-terminal-guard.md:308,372` (동일 링크 재배선) ·
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md:106` ·
    `plan/in-progress/ws-event-types-extract.md:293`
  - 상세: 커밋 `fafb57e46862d2e3aa58fdc575b5944279208339`(`chore(plan): mark 6 EIA plans
    complete`)는 이미 머지된 6개의 별개 PR(#1173, #1174, #1176, #1177, #1178 및 `spec-draft-eia-r8-alignment`)
    의 stale 체크박스를 정리하고 해당 plan 6건을 `plan/complete/` 로 이동하며, 그 인입 참조를
    7곳에서 재배선한다. 여기에 딸린 `.claude/docs/plan-lifecycle.md` 의 `pending_plans` 필드
    의미 문서화(plan-레벨 vs spec-레벨 대조표 신설)도 이 chore 의 종속 작업이다. 커밋 메시지
    자체가 *"이번 턴이 그 별도 턴이다"* 라고 명시하듯, 이 작업은 현재 plan
    (`eia-internal-rest-error-masking.md`)의 체크리스트 어디에도 등재돼 있지 않다 — 그 plan 의
    `## 체크리스트` 는 `--impl-prep` → TEST WORKFLOW → `--spec` → `/ai-review` → (미완)
    `--impl-done`/push 만 나열한다. 즉 이 브랜치는 "보안 마스킹 수정"과 "plan 라이프사이클
    위생"이라는 **두 개의 독립적 관심사**를 한 push 에 담고 있다.
  - 참고(완화 요인): 각 변경은 자체 커밋으로 분리돼 있고 커밋 메시지가 근거(3라운드 연속
    consistency checker 지적, `10_19_31` plan_coherence INFO2 등)를 상세히 남겼다. 저장소에
    유사 선례(`f8c334947 chore(plan): in-progress grooming — …`)가 있어 이 계열 chore 를
    developer 턴에 끼워 넣는 것 자체는 이 저장소의 기존 관행과 일치한다. 코드 파일은 건드리지
    않고 plan/doc 파일에 한정돼 위험도도 낮다.
  - 제안: 이 브랜치를 그대로 하나의 PR 로 올린다면, PR 설명에 "본 PR 은 두 개의 독립 변경
    (① I1/D 마스킹 수정 ② 6개 stale EIA plan 정리)을 포함한다"는 점을 명시하거나, 가능하면
    plan chore 를 별도 PR/커밋 시퀀스로 분리해 리뷰어가 마스킹 보안 수정만 집중해서 볼 수
    있게 한다. 최소한 `eia-internal-rest-error-masking.md` 의 체크리스트에 이 동반 chore 를
    한 줄로 등재해 "이 브랜치가 실제로 한 일"과 "그 plan 이 선언한 범위"의 불일치를 없앤다.

- **[INFO]** `executions.service.ts`/`background-runs.service.ts`/`redact-stored-error.ts` 에
  추가된 인라인 주석·JSDoc 이 매우 길다(예: `toResponseExecution` JSDoc, `stop()` JSDoc). 다만
  전부 "왜 이 마스킹 관문이 여기 있는가"·"왜 이 타입으로 좁혔는가" 같은 비자명한 설계 결정을
  설명하고 있고, 이 저장소의 rationale-heavy 컨벤션(spec 문서의 `## Rationale` 섹션과 동일한
  스타일)과 일치한다. 불필요한 주석 추가로 보지 않는다 — 정보 제공 목적 참고로만 기록.

- **[INFO]** `CHANGELOG.md` 는 새 `## Unreleased — …` 섹션을 파일 최상단에 추가로 쌓는다(4행
  근처). 기존에 이미 20개 이상의 `## Unreleased —` 섹션이 스택돼 있는 것을 확인했다 — 이
  저장소의 확립된 컨벤션이며 포맷팅 이슈가 아니다.

## 스코프 밖 확인(문제 없음)

- `codebase/backend/src/modules/executions/executions.service.ts` / `.spec.ts`,
  `background-runs.service.ts` / `.spec.ts`, 신규 `redact-stored-error.ts` / `.spec.ts` — 전부
  "읽기 경로 `Execution.error` 마스킹" 이라는 단일 목적에 부합. 불필요한 리팩토링·기능 확장·
  무관한 import 없음(`redactStoredErrorForResponse` import 만 추가, 실제 4곳에서 사용).
- 신규 `.json` 설정 파일 변경 없음(`package.json`/`tsconfig*` 등 미변경) — 변경된 `.json` 은
  전부 `review/**/_retry_state.json` · `review/**/meta.json` 등 리뷰 프로세스 산출물.
- `review/code/2026/08/16/17_12_34/*`, `review/consistency/2026/08/16/{16_03_57,16_32_42,16_48_55}/*`
  — 프로젝트 컨벤션상 `review/` 는 gitignore 대상이 아니며 리뷰·컨시스턴시 세션 산출물을
  커밋하는 것이 정상 워크플로다. 코드 스코프 이슈로 보지 않는다.
- `spec/2-navigation/14-execution-history.md`, `spec/4-nodes/1-logic/12-background.md`,
  `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`,
  `spec/conventions/secret-store.md` — 프로젝트 규약("코드와 spec 은 같은 PR")에 따라 이번
  마스킹 결정을 등재한 것으로, 실제 편집된 5개 코드/유틸 파일과 1:1 대응돼 범위 이탈이 아니다.

## 요약

핵심 코드 변경(내부 REST 읽기 경로 `Execution.error` egress 마스킹: `redact-stored-error.ts`
신설 + 4개 반환 경로 적용 + 테스트 + spec 등재 + CHANGELOG)은 선언된 목적에 정확히 부합하고
불필요한 리팩토링·포맷팅 뒤섞임·무관한 import·설정 변경이 없다. 다만 브랜치 누적 diff 에는
이 목적과 무관한 "6개 이미 머지된 EIA plan 을 `complete/` 로 정리"하는 chore(`fafb57e46`)가
함께 실려 있다 — 각 변경은 잘 문서화돼 있고 저장소 관행과도 부합하지만, 현재 plan 의
체크리스트에는 선언되지 않은 별개 작업이라 "의도 이상의 변경" 관점에서 WARNING 으로 기록한다.
코드 파일은 영향받지 않아 실질 리스크는 낮다.

## 위험도

LOW
