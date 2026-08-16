# 문서화(Documentation) 코드 리뷰

## 대상 요약

이번 changeset(101개 파일, +7402/-56)의 실질 코드 표면은 `ExecutionsService` ·
`BackgroundRunsService` · 신규 `shared/utils/redact-stored-error.ts`(+spec) 6개 파일이고,
나머지는 `.claude/docs/plan-lifecycle.md`·`CHANGELOG.md`·`spec/**`(6곳)·`plan/**`(다수)·
`review/**`(이전 3라운드 코드 리뷰·4라운드 consistency 검토 산출물)다. 이 PR 은 이미 같은
changeset 안에서 **3라운드의 `/ai-review`**(`17_12_34`→`17_35_49`→`17_56_15`)를 거쳤고,
그중 documentation 카테고리가 낸 WARNING(CHANGELOG 누락, plan 체크박스 stale, JSDoc 이
`stop`/`stopInternal` 분리 후 얇은 wrapper 에 남음, 고아 JSDoc 등)은 전부 조치돼 있다.
아래는 그 이후 남은/새로 발견된 항목만 적는다.

## 발견사항

- **[WARNING]** `stopInternal` 의 "반환 지점이 넷" 이라는 JSDoc·테스트 서술이 실제 `return` 문
  개수(3개)와 어긋난다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:799`
    (`stop()` JSDoc — *"`stopInternal` 은 반환 지점이 **넷**이라 (waiting 경로 ·
    `affected=0` 재조회 · 정상 재조회 · 각 폴백) 호출부마다 마스킹을 걸면 다섯 번째 반환이
    추가될 때 조용히 빠진다"*), 같은 주장이 테스트 제목에도 반복됨:
    `codebase/backend/src/modules/executions/executions.service.spec.ts:962`
    (`'④-b stop 의 affected=0 분기도 같은 관문을 지난다 (반환 지점이 넷이다)'`)
  - 상세: `stopInternal` 본문(`executions.service.ts:830-911`)을 직접 세면 `return` 문은
    정확히 **3개** 뿐이다 — (1) `WAITING_FOR_INPUT` 경로의 `return updated ?? execution`
    (:869), (2) `affected===0` 재조회의 `return refreshed ?? execution`(:904), (3) 정상
    경로의 `return refreshed ?? execution`(:910). JSDoc 이 괄호 안에 나열한 항목도
    "waiting 경로 · `affected=0` 재조회 · 정상 재조회 · **각 폴백**" 으로 4개인데, 앞의
    셋은 이미 실제 `return` 문 3개와 정확히 대응하고 넷째("각 폴백")는 그 3개 각각에
    이미 내장된 `?? execution`/`?? refreshed` null-coalescing 을 가리키는 것으로 보인다 —
    즉 별도의 4번째 `return` 문이 코드에 존재하지 않는데도 그것을 하나의 독립 항목처럼
    세고 있다. 이 수치는 단순 서술이 아니라 **설계 근거**로 쓰인다("호출부마다 마스킹을
    걸면 **다섯 번째** 반환이 추가될 때 조용히 빠진다" — 다음에 추가될 반환은 실제로는
    4번째다). 이 결함 클래스 자체가 이 PR 의 핵심 주제("자매 하나만 빠뜨림")라, 그 근거로
    쓰이는 숫자가 부정확하면 다음 사람이 "반환 지점을 다 세었는지" 검증할 때 기준을
    잘못 잡을 위험이 있다. (참고: `17_35_49` 라운드의 testing 리뷰어도 이 "4개 반환
    지점" 서술을 그대로 인용해 커버리지 갭을 보고했는데, 그 리뷰도 원 코드의 실제 개수를
    독립적으로 재검증하지는 않았다.)
  - 제안: JSDoc 과 테스트 제목의 "넷"/"4개"를 실제 개수(3개, 그중 각 반환에 `?? execution`
    fallback 이 내장돼 있음을 원하면 "반환 지점 3개(각각 재조회 실패 시 원본으로
    fallback)" 식으로) 로 정정하거나, 만약 넷째가 가리키는 다른 코드 경로가 실제로
    의도됐다면(예: 향후 추가 예정 분기) 그 대상을 명시적으로 가리키도록 문구를 바꾼다.

## 확인했으나 문제 없음 (참고)

- `CHANGELOG.md` 신규 두 `## Unreleased —` 항목(:3, :36)은 이 repo 의 기존 관행(각 항목마다
  고유 부제를 단 별도 `## Unreleased —` 헤더)과 정확히 일치한다 — 중복 헤딩이 아니라 의도된
  패턴.
- `redact-stored-error.ts`(:26)의 상대경로 링크(`../../../../../spec/2-navigation/
  14-execution-history.md`)는 실측으로 정확히 해석됨을 확인했다(5단계 상위 → repo root →
  `spec/2-navigation/14-execution-history.md`, 파일 존재).
- `.claude/docs/plan-lifecycle.md` 의 "실측(2026-08-16): spec 레벨 **17건** · plan 레벨
  **4건**" 수치를 frontmatter 만 대상으로(본문 언급 오검출 배제) 재실측해 정확히 일치함을
  확인했다(spec 17 · plan 4). `17_35_49` 라운드가 이미 3→4 로 한 차례 정정했고, 그 이후
  추가 커밋에도 stale 이 재발하지 않았다.
- `executions.service.ts` DTO 응답 필드 4곳(`ExecutionDto.error`, `NodeExecutionSummaryDto.error`,
  `background-run-response.dto.ts` `BackgroundRunNodeExecutionDto.error`) 의 JSDoc/Swagger
  `description` 은 전부 마스킹 부수효과("DB 원문과 다를 수 있음")를 명시하고 SoT(§R17)를
  가리켜 정확하다.
- `stop()`/`toResponseExecution()`/`ResponseExecution`/`ResponseNodeExecution` 의 JSDoc은
  "왜 이 타입이 필요한가"(`as Execution` 캐스트가 null 가능성을 숨겨 컴파일러가 이 PR 이
  고치는 결함 클래스를 잡을 기회를 줄인다)를 명확히 설명하고, 실제 코드(`Omit<Execution,
  'error'|'trigger'|'executor'> & {error: ... | null}`)와 일치한다.
- `spec/5-system/14-external-interaction-api.md` §R17 교체 불릿은 이전 라운드에서 지적된
  "총칭 vs 열거" 문제(적용 범위를 "모든 내부 읽기 경로"로 과대 서술하던 것)를 이미
  "적용 범위는 총칭이 아니라 열거다" 캐비엇으로 교정했고, 잔여 갭 3종(WS `execution.node.*`
  emit · `inputData`/`outputData` · workflow-assistant LLM 도구)을 이름으로 못박아 등재했다
  — spec-code drift 없음.
- `plan/in-progress/eia-internal-rest-error-masking.md` 의 체크리스트는 consistency
  checker(`16_03_57` plan_coherence W1)가 지적한 "I1·D 닫기와 신규 잔여 등재를 한
  체크박스로 결합" 문제를 두 항목(:258, :260)으로 분리해 반영했고, 두 항목 모두 `[x]`다.
  `spec-sync-external-interaction-api-gaps.md` 쪽 원장(:180-232)도 I1·D 결정 확정 문구 +
  `NodeExecution.error` 심각도 격상 정정 + 잔여 2건(WS node emit, inputData/outputData)
  등재가 실제로 반영돼 있어 plan-tracker 간 정합이 맞다.

## 요약

이 changeset 은 이미 3라운드의 `/ai-review` 로 documentation 관점 결함(CHANGELOG 누락,
plan 체크박스 stale, JSDoc-코드 분리, 고아 JSDoc)을 전부 조치한 상태이고, 신규 코드
(`redact-stored-error.ts` + 4개 소비처)의 JSDoc·인라인 주석·Swagger description·spec
교차 참조는 전반적으로 상세하고 정확하다 — "왜 이렇게 했는가"뿐 아니라 "왜 다른 방법을
안 썼는가"(`toTerminalErrorPayload` 미재사용)까지 근거를 남긴 점은 모범적이다. 유일하게
새로 찾은 항목은 `stopInternal` 의 반환 지점 개수를 JSDoc 과 테스트 제목이 "넷"이라
서술하는데 실제 `return` 문은 3개뿐이라는 점이다 — 기능적 결함은 아니지만, 이 서술이 바로
"반환 지점을 하나도 안 빠뜨렸는지" 를 검증하는 근거로 쓰이는 자리라 정정을 권고한다.

## 위험도

LOW
