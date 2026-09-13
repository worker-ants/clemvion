# 문서화(Documentation) 코드 리뷰 — error-code-emission-axis (라운드 5)

## 검토 범위

`origin/main`(`afaef5bef`) 대비 이 브랜치의 실질 변경 파일은 8개다 — `CHANGELOG.md`,
`PROJECT.md`, `codebase/frontend/src/content/docs/02-nodes/logic{,.en}.mdx`,
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-{existence.test.ts,scan.ts}`,
`plan/in-progress/error-code-emission-axis.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`. 나머지(`review/**` 다수)는
이전 4개 `/ai-review`·`consistency-check` 라운드의 산출물이라 이번 라운드가 새로 만든 코드가
아니다. 프롬프트가 컨텍스트 예산으로 생략한 부분은 `git diff origin/main...HEAD` 로 직접
전문을 열어 확인했고, JSDoc/CHANGELOG 가 인용하는 소스 줄 번호(`execution-engine.service.ts`,
`loop-executor.ts`, `makeshop.handler.ts`, `execution-failure-classifier.ts`,
`spec/5-system/3-error-handling.md`)는 전부 `grep -n` 으로 대조해 정확함을 확인했다. 이전
라운드(19_23_22 · 19_51_33 · 20_13_13 · 20_34_32)가 지적한 문서화 결함은 각 RESOLUTION.md
대로 고쳐진 상태를 실측으로 재확인했다(JSDoc 이동, `MAX_ITERATIONS_EXCEEDED` 회귀 제목 정정 등).

## 발견사항

- **[WARNING]** 신규 JSDoc 이 자기 자신의 개명 이력을 **자기모순으로** 서술한다 — "X 로
  개명했다, 첫 판도 X 였다"
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:66`
    (`staleGuideEntries` 함수 선언 바로 위 JSDoc, 3번째 줄)
  - 상세: 해당 JSDoc 원문은 다음과 같다 —
    ```
    * **`staleGuideEntries` 로 이름을 바꿨다** — 첫 판은 `staleGuideEntries` 였는데
    * `repo-guards/__tests__/internal-package-registration-guard.ts:129` 에 **export 된 동명
    * 함수**가 이미 있었고 시그니처가 다르다(...)
    ```
    "**`staleGuideEntries` 로 이름을 바꿨다** — 첫 판은 `staleGuideEntries` 였는데" 는
    "X로 개명했다 — 원래도 X였다"는 자기모순 문장이다. 실제 이력은
    `review/consistency/2026/09/13/20_34_48/naming_collision.md:19-42`(WARNING, 원본
    선언부 `function staleEntries(...)` 인용) 및 같은 배치의
    `plan/in-progress/error-code-emission-axis.md:205,209,248,284,317,331` 전부가 일관되게
    확인하듯 **원래 이름은 `staleEntries`** 였고, `repo-guards/__tests__/
    internal-package-registration-guard.ts:129` 의 기존 export 함수와 이름이 겹쳐
    `staleGuideEntries` 로 개명했다. 즉 JSDoc 의 "첫 판은 `staleGuideEntries` 였는데" 는
    `staleEntries` 의 오타이며, 문장이 성립하지 않는다 — 이 개명이 **왜** 필요했는지(무엇과
    충돌했는지)를 다음 사람에게 설명하려고 쓴 주석이, 정작 그 "무엇"(원래 이름)을 잘못
    적어 설명력을 잃었다. 커밋 `57288e47f`(이번 브랜치의 가장 최근 커밋, 라운드 4 수정)에서
    이 JSDoc 이 신규로 추가됐고, `plan/in-progress/error-code-emission-axis.md` 의 동일
    사건 서술(라운드 4 절, 317번째 줄 "라운드 3 에서 만든 `staleEntries` 가...")은 정확히
    쓰여 있어 **같은 커밋 안에서 plan 서술과 코드 JSDoc 서술이 갈린다.**
  - 제안: `첫 판은 `staleGuideEntries` 였는데` → `첫 판은 `staleEntries` 였는데` 로 한 단어만
    정정.

## 확인 후 문제 없음으로 판단한 항목 (전 라운드 이월분 재검증)

- `CHANGELOG.md` — "카탈로그 탈출구가 오늘 한 번도 발화하지 않는다"·"앵커 없는 코드 7종" 서술을
  `spec/5-system/3-error-handling.md:105-128`(§1.4 표, "없음" 앵커 행 정확히 7개:
  `EXECUTION_TIMEOUT`·`RECURSION_DEPTH_EXCEEDED`·`MAX_ITERATIONS_EXCEEDED`·
  `CYCLE_DETECTED`·`INVALID_EXPRESSION`·`VARIABLE_NOT_FOUND`·`TYPE_MISMATCH`)와 대조해
  정확함을 확인했다. 라운드 2 RESOLUTION 이 지적한 자기모순(카탈로그 덕에 통과 vs 소비자
  인용 때문에 통과)도 현재 본문에는 남아 있지 않다.
- `PROJECT.md:300` — `guide-identifier-existence.test.ts` 항목 설명에 "발행 축(2026-09-13
  추가)" 단락이 정확히 반영돼 있고, 기존 3축·베이스라인 0·외부 어휘 허용목록 서술과 충돌하지
  않는다.
- `logic.mdx:114` / `logic.en.mdx:103` — KO/EN 두 문장 모두 "전용 에러 코드는 없으니 코드가
  아니라 메시지를 봐야 해요"(KO) / "there is no dedicated error code, so read the message
  rather than the code"(EN) 로 의미가 정확히 대응하며, 다른 mdx 파일 어디에도
  `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 인용하는 곳이 없어(grep 전수) 수정
  누락 자매 문서가 없다.
- `guide-identifier-scan.ts` 의 신규 JSDoc(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`
  경계 표, `collectCatalogCodes` 의 `MAX_ITERATIONS_EXCEEDED` 단계표, `GUIDE_NON_EMITTED_
  VOCABULARY` 3항목의 `where` 줄 번호) — 인용된 소스 줄 번호(`execution-engine.service.ts:
  7121,7125,7130`, `makeshop.handler.ts:436`, `loop-executor.ts:64,85`,
  `execution-failure-classifier.ts:76`)를 전부 `grep -n` 으로 대조해 정확함을 확인했다.
- 라운드 4 커밋(`57288e47f`)이 고쳤다고 주장한 "orphan JSDoc" — `발행 축 수집기 3종의
  합성 경계 대조군` JSDoc(:570)이 현재 `describe("발행 축 수집기 — 경계 대조군"` (:577)
  바로 위에 인접해 있음을 `grep -n` 으로 확인했다. 표류 지점(`staleGuideEntries — 판별
  대조군`, :520)에는 JSDoc 이 남아 있지 않다 — 이동이 실제로 완료됐다.
- `plan/in-progress/error-code-emission-axis.md`/`spec-draft-nullable-notation-followups.md`
  추가분 — `execution-engine.service.ts:8016`(`nodeExec.error = { message }`, `code` 필드
  없음)을 직접 열어 대조, spec 6파일의 `CONTAINER_*` 서술이 실제로 코드처럼 적혀 있는지도
  `spec/4-nodes/1-logic/3-loop.md:189-191`(발행 문자열 전문 인용 선례)와 비교해 근거가
  일관됨을 확인했다.

## 요약

이번 배치는 유저 가이드 문장 2건 정정 + 그 정확성을 지키는 정적 스캐너("발행 축") 추가로,
전반적으로 JSDoc·CHANGELOG·PROJECT.md·plan 문서가 소스 줄 번호까지 포함해 이례적으로
정밀하게 유지되고 있음을 다수 대조로 확인했다(4라운드에 걸친 자기-반증·정정 이력 자체가
CHANGELOG·주석에 그대로 보존돼 있다). 유일하게 새로 발견한 결함은 라운드 4의 마지막 수정
커밋이 남긴 것으로, 함수 개명을 설명하는 JSDoc 한 줄이 "X 로 바꿨다 — 원래도 X 였다"는
자기모순 문장이 됐다(원래 이름은 `staleEntries` 인데 `staleGuideEntries` 로 잘못 적음).
같은 배치의 plan 문서는 이 사건을 정확히 서술하고 있어, 코드 쪽 JSDoc만 단어 하나가 어긋난
국소적 오타다. 기능·테스트·다른 문서에는 영향이 없다.

## 위험도

LOW
