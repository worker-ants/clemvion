# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `pending_plans` 실측치가 이미 다시 stale — 문서가 스스로 경고한 실패가 재발
  - 위치: `.claude/docs/plan-lifecycle.md:88`
  - 상세: 해당 줄은 "실측(2026-08-16): spec 레벨 **17건** · plan 레벨 **4건**." 이라고 명시한다.
    직접 재실측한 결과(`grep -rl '^pending_plans:' spec/` / `plan/`, 빈 리스트·`none` 없음을
    확인한 뒤) 현재 워크트리 상태는 **spec 레벨 18건 · plan 레벨 5건**이다. `git diff
    origin/main...HEAD`로 대조하면 이번 PR 자신이 추가한 `pending_plans:` 선언은 정확히
    1건(신규 `plan/in-progress/eia-internal-rest-error-masking.md`, plan 레벨)뿐이고, spec
    레벨 18건은 **이 PR 착수 이전(`origin/main`)부터 이미 18건**이었다 — 즉 "17"이라는 숫자는
    drift 때문이 아니라 **애초에 카운트가 틀렸다**. plan 레벨도 `origin/main` 기준 4건이었는데
    이 PR이 자신의 신규 plan 문서 1건을 더해 5건이 됐으니, "PR이 닫히는 시점" 기준으로 재라는
    이 문단 자신의 원칙(:92-95, `17_35_49` 라운드가 3→4로 정정하며 남긴 캐비엇)을 지키면 지금
    시점의 정답은 "18 · 5"다. 이 세션의 RESOLUTION 기록들이 스스로 "근거를 실제보다 넓게 쓴
    것"을 이미 4회 자백했는데(마스킹 범위 → 표면 전수 → 반환 지점 수 → secret-store 근거),
    이 수치는 그 뒤에도 재발한 **5번째 사례**다 — 다만 이번엔 문서 자체가 "PR 닫히는 시점에
    재라"고 그 자리에서 선언까지 했다는 점에서 더 눈에 띈다.
  - 제안: `18` · `5`로 정정하고, 이 통계가 이후에도 계속 드리프트할 수밖에 없는 성격(spec/plan
    양쪽이 이 PR과 무관한 병행 작업으로도 늘어난다)임을 한 줄 더 명시하거나, 애초에 "정확한
    시점 스냅샷"보다 "이 필드가 존재한다"는 사실 자체가 요점이라면 구체적 건수 대신 "여러 건"
    처럼 드리프트에 강한 표현으로 낮추는 것도 고려할 만하다.

- **[WARNING]** CHANGELOG 새 항목의 "위 항목" 지시어가 실제로는 **아래**에 있는 항목을 가리킨다
  - 위치: `CHANGELOG.md:5`
  - 상세: 신규 항목(`## Unreleased — 같은 Execution.error 를 표면마다 다른 값으로 말하고
    있었다`, 파일 3번째 줄)의 본문이 "**위 항목**이 종결 emit 경로에 값-마스킹을 넣었는데
    읽기 경로는 그대로 원문이었다"로 시작한다. 이 문장이 가리키는 대상(#1177, "종결 이벤트
    error 가 자격증명 마스킹 없이 외부로 나가고 있었다")은 실제로는 이 신규 항목보다 **뒤(파일
    36번째 줄)**에 있다 — CHANGELOG 는 최신 항목을 파일 맨 위에 추가하는 관례(commit
    `9dee1caa0`가 이번 항목을 `107c8038f`(#1177) 항목보다 위에 삽입)를 쓰기 때문에, 이번
    신규 항목의 물리적 "위"에는 `# Changelog` 제목 외에 아무것도 없다. 이 저장소가 같은 파일
    안에서 "위 항목"을 실제로 물리적으로 위에 있는 항목을 가리키는 데 쓰는 기존 용례가
    이미 있다(예: `CHANGELOG.md:568`·`:571`, 같은 항목 안의 앞선 번호 목록을 가리킴) — 즉 이
    표현은 이 문서에서 spatial(문서상 위치) 의미로 확립돼 있는데, 이번만 반대 방향을 가리켜
    독자가 위에서 아래로 읽을 때(가장 흔한 changelog 소비 방식) 혼란을 준다.
  - 제안: "위 항목이" → "아래 항목(#1177)이" 또는 "직전 커밋(#1177)이" 처럼 방향을 문서 실제
    위치에 맞게 정정하거나, PR 번호(`#1177`)로 직접 지칭해 위치 의존성을 아예 없앤다.

## 확인했으나 문제 없음 (참고)

- `codebase/backend/src/shared/utils/redact-stored-error.ts`/`.spec.ts` (신규) — 함수·모듈
  JSDoc 이 "왜 필요한가"·"왜 다른 기존 함수를 재사용하지 않는가"·"보장의 경계"(캐너리 표까지)를
  전부 갖췄고, 상대경로 링크(`../../../../../spec/2-navigation/14-execution-history.md`)도
  실제로 해당 파일에 해석됨을 확인했다.
- `executions.service.ts` — `stopInternal` JSDoc의 "`return` 문 셋, 폴백 포함 여섯 가지" 주장을
  직접 소스에서 재검산해 정확함을 확인했다(3개 `return` 문 × 각 `?? execution` 폴백). `stop`/
  `toResponseExecution`/`toExecutionDto`가 각각 4경로 중 몇 곳을 담당하는지에 대한 서술도
  `grep`으로 호출부를 재대조해 정확함을 확인했다(`toResponseExecution` 호출부 3곳:
  `getChain`/`findById`/`stop`, 나머지 하나는 `toExecutionDto`가 직접 호출).
  Swagger `@ApiPropertyOptional` 위 JSDoc 4곳(`execution-response.dto.ts` 2곳,
  `background-run-response.dto.ts` 1곳 — 나머지 1곳은 `codebase/backend/src/modules/
  executions/background-runs/dto/background-run-response.dto.ts`)이 모두 마스킹 부수효과와
  SoT 포인터(EIA §R17)를 담고 있어 API 문서(Swagger) 관점에서도 최신 상태다.
- `spec/5-system/14-external-interaction-api.md` §R17 신규 불릿(diff 생략됐던 파일, 직접
  Read로 확인) — "4경로" 서술, `secret-store.md` §1 인용 앵커(`#1-uri-scheme`), API 규약
  §5.3 앵커(`./2-api-convention.md#53-에러-응답`, 실제 헤더 "### 5.3 에러 응답"과 일치)까지
  전부 실측 검증했고 이상 없다.
- `plan/complete/eia-terminal-emit-facade.md` 외 5개 이동된 plan 문서 — 실제로 새 경로에
  존재함을 확인했고, `plan/in-progress/**`·`plan/complete/**` 전체에서 이들을 여전히
  `./` 상대경로(구 in-progress 위치 기준)로 가리키는 stale 링크가 남아있지 않음을 grep으로
  확인했다(파일 17·22·24·28의 `../complete/...` 치환이 누락 없이 전수 반영됨).
- `review/**`(SUMMARY/RESOLUTION/개별 reviewer 산출물) 다수 — 이번 diff의 대부분을 차지하지만
  전부 과거 리뷰 라운드의 이력 기록이라 "문서화" 관점의 결함 대상이 아니라고 판단, 채점
  대상에서 제외했다(코드/spec 문서만 채점).

## 요약

핵심 코드 변경(`redact-stored-error.ts` 신규 유틸과 그 4~5개 소비처, DTO Swagger JSDoc, spec
`14-external-interaction-api.md`/`1-data-model.md`/`12-background.md`/`6-websocket-protocol.md`/
`secret-store.md`)은 이미 4~5 라운드의 documentation reviewer 검토를 거치며 독스트링·주석
정확성·상호링크·CHANGELOG 누락 등을 반복적으로 잡아 고친 상태라 이번 라운드에서 코드 쪽 새
결함은 발견되지 않았다. 다만 그 반복 수정 과정 자체가 남긴 흔적에서 두 건을 새로 잡았다 —
(1) "PR 닫히는 시점 기준으로 재라"고 스스로 규정해 놓고 실제로는 이미 다시 어긋난
`plan-lifecycle.md`의 `pending_plans` 실측치(17·4 → 실제 18·5), (2) CHANGELOG 신규 항목이
"위 항목"이라 부르는 대상이 실제로는 문서상 아래에 있는 위치 지시어 오류. 둘 다 기능에는
영향이 없는 문서 정확성 문제이지만, 이 PR 세션이 이미 여러 차례 겪은 "근거·수치를 실제보다
넓게/부정확하게 쓴다"는 실패 클래스와 같은 계열이라 WARNING으로 등재한다.

## 위험도

LOW
