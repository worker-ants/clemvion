# 문서화(Documentation) 리뷰 — error-code-emission-axis

## 발견사항

- **[WARNING]** 이 PR 이 정확히 해소한 트래커 항목의 체크박스가 갱신되지 않았다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3404`
    (`- [ ] **`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT` 도 방출 코드가 아니다 (선재)**`)
  - 상세: 이 항목은 "`02-nodes/logic{,.mdx,.en.mdx}` 가 '…로 실행 실패해요' 라고 적는데 실제로는
    `execution-engine.service.ts:7121·7125` 의 메시지 접두이고 `.code` 로 방출되지 않는다"
    고 지목하며, 처분 선택지 (A)"문장을 '메시지에 이 접두가 붙는다' 로 정정" / (B)"엔진이 전용
    코드를 방출하도록"을 제시해 두었다. 이번 PR 의 `plan/in-progress/error-code-emission-axis.md`
    §D-2 는 정확히 (A)를 택해 `logic.mdx`/`logic.en.mdx` 의 두 문장을 "실패 메시지 앞에 붙어요 —
    전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요" 로 고쳤다(실측 확인함, KO/EN 쌍
    모두 반영). 즉 이 트래커 항목이 요구한 작업은 **이미 끝났는데** 체크박스는 여전히 `[ ]`
    이고, 새 plan(`error-code-emission-axis.md`) 도입부는 "닫는다"고 명시한 트래커 항목으로
    naming_collision CRITICAL(존재-vs-방출 가드) 하나만 인용할 뿐 이 형제 항목(3404행)은
    언급하지 않는다. 이 저장소가 반복해 지적해 온 "plan 체크박스 = 실제 상태" 원칙과 정확히
    어긋나는 형태이며, 방치하면 다음 사람이 이미 끝난 문장 정정 작업을 다시 착수 대상으로
    오인할 수 있다.
  - 제안: `spec-draft-nullable-notation-followups.md:3404` 항목을 `[x]` 로 체크하고
    "`error-code-emission-axis` 배치에서 (A) 문장 정정으로 해소"라는 완료 근거 한 줄을 추가.
    `error-code-emission-axis.md` 도입부의 "닫는다" 목록에도 이 항목을 함께 명시.

- **[WARNING]** 같은 세션의 consistency-check WARNING 중 2건이 plan tracker 로 옮겨지지 않았다
  (`review/**` 는 SoT 가 아니라는 이 저장소의 기존 원칙과 어긋남)
  - 위치: `review/consistency/2026/09/13/18_40_54/SUMMARY.md` WARNING #2·#3(및 그 상세본
    `cross_spec.md`·`rationale_continuity.md`)
  - 상세: WARNING #1(impl-prep 번들이 SoT 문서를 예산 초과로 누락)은
    `plan/in-progress/spec-draft-nullable-notation-followups.md:4014-4026` 에 정확히
    옮겨져 harness 백로그 처분안까지 적혀 있다(모범 사례). 그러나 같은 SUMMARY 의
    - WARNING #2 (`CONTAINER_MISSING_EMIT`/`MULTIPLE_EMIT` 을 "메시지/코드"로 혼용하는
      spec 문서 7곳 — `9-foreach.md §6` 열 제목, `0-common.md`, `3-workflow-editor/{0-canvas,
      2-edge}.md`, `5-system/4-execution-engine.md §3.0` — 및 "별도 plan 항목으로 열 제목
      통일 + `3-error-handling.md §1.4` 각주 추가를 등재" 라는 명시적 권고)
    - WARNING #3 (rationale_continuity — plan §D 의 "코드가 아니다" 서술이 §1.4 의 앵커-없는
      카탈로그 코드 6종 취급 관행과 어긋난다는 지적, "별도 체크리스트 항목으로 남길 것"이라는
      명시적 권고)

    는 저장소 전체(`plan/`)를 grep 해도(`앵커 없는 카탈로그 코드`, `foreach.md §6`,
    `열 제목.*메시지` 등) 어디에도 등재되지 않았다. `error-code-emission-axis.md` 체크리스트는
    "`/consistency-check --impl-prep` … WARNING 3건은 전부 이 배치 밖이거나 이 plan 의 §D
    서술을 정정하라는 것이었고, 그 지적이 §B~§B-3 재설계를 낳았다" 라고만 적어, 마치 3건 모두
    처리됐거나 범위 밖으로 정리된 것처럼 읽히지만 실제로는 WARNING #2·#3 의 "별도 plan 항목
    등재" 권고 자체가 어디에도 실행되지 않았다. `review/consistency/**` 는 이 세션이 끝나면
    재참조되지 않을 산출물이라, 지금 옮기지 않으면 그 권고는 사실상 소실된다.
  - 제안: WARNING #1 과 같은 방식으로 `spec-draft-nullable-notation-followups.md`(또는 새
    plan 항목)에 WARNING #2(spec 7곳 "메시지/코드" 표기 통일 + `3-error-handling.md §1.4`
    backfill)·WARNING #3(§D 서술 "코드가 아니다" → "앵커 없는 카탈로그 코드" 정정) 각각을
    한 줄씩 등재.

- **[INFO]** `GUIDE_NON_EMITTED_VOCABULARY` 의 `CONTAINER_MULTIPLE_EMIT` 항목이 자신이
  정의한 `where` 필드의 설계 목표에 못 미친다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` —
    `GUIDE_NON_EMITTED_VOCABULARY` 배열, `CONTAINER_MULTIPLE_EMIT` 항목의 `where: "execution-engine.service.ts — 형제 접두"`
  - 상세: 같은 파일의 `where` 필드 JSDoc 은 "접두를 붙이는 자리. 사유가 «어디서» 를 지목하지
    못하면 등록이 통행증이 된다" 라고 명시한다. 형제 항목 `CONTAINER_MISSING_EMIT` 은
    `execution-engine.service.ts:7121·7125` 로 정확한 줄 번호를 지목하는데(실측 확인함,
    두 줄 모두 `CONTAINER_MISSING_EMIT` 리터럴), `CONTAINER_MULTIPLE_EMIT` 은 실제로는 같은
    파일 7130행 단일 지점(`` `CONTAINER_MULTIPLE_EMIT: Container "${...}" has ${emitEdges.length} nodes wired...` ``)
    인데도 "형제 접두"라고만 적어 줄 번호를 지목하지 않는다. 테스트의 `where.length > 10`
    vacuity 하한은 통과하지만, 필드 자신이 세운 "어디서"라는 기준에는 못 미친다.
  - 제안: `where: "execution-engine.service.ts:7130 — 형제 접두"` 로 줄 번호를 보강.

- **[INFO]** rationale_continuity WARNING(§1.4 카탈로그 관행과의 용어 정합)이 CHANGELOG 에서는
  더 정밀한 표현으로 반영됐지만 가이드 본문에는 그대로 남아 있음 — 이미 추적 중이므로 참고용
  - 위치: `CHANGELOG.md`("구조화된 코드로는 발행되지 않는다") vs
    `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114` /
    `logic.en.mdx:103`("전용 에러 코드는 없으니 코드가 아니라" / "there is no dedicated error
    code … rather than the code")
  - 상세: `review/consistency/2026/09/13/18_40_54/rationale_continuity.md` 는 §1.4 카탈로그가
    `MAX_ITERATIONS_EXCEEDED` 등 앵커 없는 문자열 6종을 정식 "코드"로 취급해 온 관행과
    "코드가 아니다"라는 단정이 암묵적으로 어긋난다고 WARNING 을 냈다. CHANGELOG 항목은
    "구조화된 코드로는 발행되지 않는다"는 더 정확한 표현으로 이를 완화했지만, 실제 사용자가
    보는 가이드 문장(logic.mdx/logic.en.mdx)은 여전히 "코드가 아니라"/"rather than the code"
    라는 단순화된 표현을 쓴다. 사용자 가이드 수준에서는 이 단순화가 실용적으로 정확하다
    (`finalizeFailedExecution` 이 `ErrorPortFallbackError`/`ExecutionTimeLimitError` 두
    sentinel 타입만 `.error.code` 로 보존하도록 의도적으로 좁혀 놓아, 이 토큰이 실제로
    구조화된 `error.code` 필드에 실리지 않는다는 사실 자체는 맞다). 다만 §1.4 backfill·
    용어 통일은 위 두 번째 WARNING findng 대로 아직 plan 에 등재되지 않은 채 남아 있다.
  - 제안: 위 WARNING(§1.4 backfill) 항목 등재 시 함께 처리. 신규 조치 불요, 교차 기록만 필요.

- **확인 후 문제 없음(참고)**: `CHANGELOG.md`·`PROJECT.md`·`logic.mdx`/`logic.en.mdx`·
  `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts` 의 실측 인용은 전수
  검증했다 — `execution-engine.service.ts:7121·7125`(`CONTAINER_MISSING_EMIT` 두 지점, 실제
  라인과 일치) · `loop-executor.ts:64,85` + `execution-failure-classifier.ts:76`
  (`MAX_ITERATIONS_EXCEEDED` 메시지 접두·소비자 Set 인용, 실제 라인과 일치) ·
  `spec/5-system/3-error-handling.md §1.4` 의 "나머지 7종은 앵커 없는 맨 문자열"(실제 표에서
  앵커 "없음" 행 정확히 7개, `CONTAINER_*` 두 코드는 표에 미등재 — plan 의 "카탈로그에 없다"
  주장과 일치) · 가드 스위트 `it(` 개수 46(plan 체크리스트의 "39 → 46" 과 일치). 새로 추가된
  세 스캔 함수(`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`)와
  `GUIDE_NON_EMITTED_VOCABULARY` 는 JSDoc 이 표·대칭 제약 비교표까지 포함해 이례적으로
  충실하다. KO/EN 가이드 문장 쌍도 의미·구조가 정확히 대응한다. `guide-identifier-scan.ts`
  상단 주석은 `lastIndex` 보일러플레이트를 늘리지 않기 위한 `matchAll` 채택 근거를 표로
  설명하고 있어 인접 리팩터 트래커(4곳 중복)와의 관계도 명확하다.

## 요약

핵심 코드·가이드 문서(CHANGELOG, PROJECT.md, logic 가이드 KO/EN, 스캐너 JSDoc, 테스트 주석)는
전수 실측 대조 결과 정확하고 이례적으로 충실하다. 다만 이 PR 이 실질적으로 완료한 트래커
항목(`spec-draft-nullable-notation-followups.md:3404`)의 체크박스가 갱신되지 않았고, 같은
세션의 consistency-check 가 명시적으로 "별도 plan 항목으로 등재"를 권고한 WARNING 2건
(spec 문서 7곳의 메시지/코드 표기 통일 + `§1.4` backfill, §D "코드가 아니다" 서술 정정)이
`plan/` 어디에도 옮겨지지 않아 review/ 세션 산출물 안에만 존재한다 — 이 저장소가 반복해 겪은
"review/** 는 SoT 아님, 미룬 항목은 그 턴에 plan/ 에 적어라" 패턴의 재발이다. 두 건 모두 코드
동작에는 영향이 없고 BLOCK 사유도 아니지만, 방치하면 그 권고 자체가 소실된다.

## 위험도
MEDIUM
