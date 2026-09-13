# Rationale 연속성 검토 — error-code-emission-axis (구현 완료 후, HEAD `57288e47f`, 라운드 5)

## 검토 범위 재확인

- diff-base `origin/main` = `afaef5bef`. `scope(spec/conventions/)` 델타: **0개 파일** — 이
  브랜치는 전 라운드에 걸쳐 그 영역의 spec 을 한 번도 바꾸지 않았다. 코드 전용 배치이므로
  정상이며 델타 0 자체를 CRITICAL 근거로 쓰지 않는다.
- 실제 구현 diff(`origin/main...HEAD`)는 4개 codebase 파일 — `guide-identifier-scan.ts` ·
  `guide-identifier-existence.test.ts` · `content/docs/02-nodes/logic.mdx` · `logic.en.mdx`
  (+ `CHANGELOG.md`/`PROJECT.md`/plan 문서). `git rev-parse HEAD` = `57288e47f`(라운드 4
  수정 커밋)로 워킹트리 상태와 일치함을 확인했고, 작업 디렉토리에는 미커밋 변경이 없다
  (`git status --short` 는 이 검토 세션 자신이 쓰는 `review/**` 신규 디렉토리만 보고한다).
- 대조 축: (1) `spec/5-system/3-error-handling.md §1.4`(엔진 수준 에러 카탈로그의
  "앵커 없는 코드" 서술), (2) `#1330`/`#1331` 이 세운 "허용목록 없음 → 도입" 설계 계보와
  이 PR 의 두 번째 번복(`GUIDE_NON_EMITTED_VOCABULARY`), (3) 직전 4라운드
  (`19_23_31`·`19_51_39`·`20_13_19`·`20_34_48`) rationale_continuity 산출물과 그 처분
  이행 여부, (4) `spec/conventions/review-citations.md §4`("기존 bare 인용은 소급 정리
  대상이 아니다") 준수 여부.
- `spec/conventions/error-codes.md`·`node-output.md`·`user-guide-evidence.md`·
  `review-citations.md` 를 전문 직접 Read(프롬프트 번들은 예산 초과로 절단)로 재확인했다.
  넷 다 `guide-identifier-*` 가드 가족 자체를 언급하지 않는다(grep 0건) — 발견은 "spec/
  conventions 문서의 Rationale 직접 위반"이 아니라 위 (1)~(4) 결정 계보와의 정합 여부다.

## 발견사항

- **[WARNING] `§1.4` "앵커 없는 카탈로그 코드" 관행과 가이드의 "코드가 아니다" 서술 간
  불일치 — 4라운드 연속 known-open, 이번 라운드도 상태 불변 (신규 위반 아님)**
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`,
    `logic.en.mdx:103`("전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요") 및
    `guide-identifier-scan.ts` 의 `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건
    (`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`)
  - 과거 결정 출처: [`spec/5-system/3-error-handling.md §1.4`](../../../../../spec/5-system/3-error-handling.md#14-워크플로우-실행-에러)
    머리말 — "**나머지 7종은 앵커 없는 맨 문자열**"이라 적으면서도 `MAX_ITERATIONS_EXCEEDED`·
    `RECURSION_DEPTH_EXCEEDED`·`CYCLE_DETECTED` 등을 §1.4 표에 **정식 카탈로그 코드**로
    유지한다.
  - 상세: 실측(`execution-engine.service.ts:7121,7125,7130` 템플릿 리터럴 메시지 접두,
    `:8016` `nodeExec.error = { message }` — `code` 필드 없음)으로 `CONTAINER_*` 가 §1.4 의
    저 7종과 발행 형태상 동형임이 확인됐는데, 가이드는 이제 "코드가 아니다"라고 정확히
    단정하는 반면 §1.4 는 같은 형태의 문자열을 여전히 "코드"로 표기한다. 이 모순은 라운드 1
    (`19_23_31`)이 처음 지적했고 라운드 2~4가 "해소되지 않았으나 은폐되지도 않았다"고 재확인한
    것과 동일 상태이며, 같은 라운드의 `cross_spec.md` 도 독립적으로 같은 결론에 도달했다
    (spec 6파일이 `CONTAINER_*` 를 인라인 코드로 서술).
  - CRITICAL 로 올리지 않는 이유(직전 라운드들과 동일): (i) `spec/` 파일 자체는 이번 diff 에서
    전혀 수정되지 않아 "기각된 대안의 재도입"이 발생할 자리가 없다, (ii) 모순이 신규가 아니라
    4라운드 전부터 열려 있던 known-open 항목의 연속이다, (iii) plan(§D·§F·§G·§H) 이 "해결
    했다"고 과장하지 않고 스스로 지적·등재했으며 두 처분 항목이 실제로
    `plan/in-progress/spec-draft-nullable-notation-followups.md` (~line 3427, ~3448)에
    `[ ]` open 으로 등재돼 택일을 기다리고 있음을 재확인했다(택일 (a) `CONTAINER_*` 를
    §1.4 backfill, (b) §1.4 앵커-없는 행에 "메시지 접두" 표기 추가 — 둘 다 여전히 보존).
  - 제안: 직전 라운드 제안 유지 — planner 턴에서 (a)/(b) 중 택일하고 그 근거를
    `3-error-handling.md §1.4` 본문 또는 `## Rationale` 에 한 줄 남길 것. `developer` 는
    `spec/5-system/**` 를 직접 고칠 권한이 없고(자기-반증형 소정정 조건 불해당 — 그 표는
    developer 자신이 쓴 예고가 아니다) 택일을 미룬 것은 회피가 아니라 권한 경계 준수다.

## 확인했으나 위반이 아닌 것 (전 라운드 대비 변화 포함)

- **`#1330` "허용목록 없음" 원칙의 두 번째 부분 번복 — spec Rationale 공백 INFO 는 라운드 4에서
  해소됨.** 직전 라운드(`20_34_48`) rationale_continuity INFO#2 는 "번복이 두 차례인데
  트래커 항목이 첫 번째(`GUIDE_EXTERNAL_VOCABULARY`)만 이름으로 지목하고 두 번째
  (`GUIDE_NON_EMITTED_VOCABULARY`)는 누락돼 있다"고 지적했다. 라운드 4 수정 커밋
  (`57288e47f`)이 `plan/in-progress/spec-draft-nullable-notation-followups.md` (~line
  3266-3271)에 "번복은 두 번이다" 절을 추가해 두 번째 번복을 명시하고, 두 목록이 정반대
  제약(존재 축 "없을 것" vs 발행 축 "있을 것")이라 통합할 수 없다는 구조를 함께 적었음을
  `git log -S"번복은 두 번이다"` 로 직접 확인했다 — **해당 INFO 는 이행 완료**. 두 번복 모두
  코드 JSDoc·plan 양쪽에 계보·이유가 명시돼 있어 "무근거 번복"이 아니다.
- **문맥 게이팅(prose-context gating)으로 회귀하지 않음** — `#1330`이 시도했고 `#1331`이
  "원 결함을 놓쳤다"며 걷어낸 접근을 이 PR 이 다시 채택하지 않았다(plan §D-2, 코드 diff 로
  재확인). 이미 기각된 대안으로 복귀하지 않은 사례다.
- **카탈로그를 "요구 조건"이 아니라 "탈출구"로 쓰는 설계** (`collectCatalogCodes`) —
  `§1.4`의 "소비자·분류기 쪽 어휘 vs 엔진 발행 경로의 앵커" 구분을 원문 그대로 인용해 같은
  방향으로 설계했다. "이 탈출구는 오늘 한 번도 발화하지 않는다"는 라운드 1 자기반증을 지우지
  않고 코드·CHANGELOG 양쪽에 남긴 처리도 이 저장소의 "근거는 실행해 보고 적는다" 관행과
  정합한다.
- **폴더-스코프 bare-citation 가드를 세우지 않음** (plan §G, `20_13_13`/`20_13_19` 라운드) —
  `review-citations.md §4`("기존 bare 인용(`codebase/**` 499건)은 다음에 건드릴 때 함께
  맞춘다. 일괄 치환은 하지 않는다")를 실측 확인(가드 폴더 자체에 선재 bare 인용 3건 존재)한
  뒤 스스로 철회했다. "3번째 재발이면 코드로 막아라" 라는 이 저장소의 다른 관행과 충돌하는
  상황에서 **더 구체적인 기존 컨벤션을 우선**했다 — 규약 위반이 아니라 준수 사례.
- **라운드 2~4의 후속 변경(`collectMatches` 공용화, `matchAll` 전환, `staleEntries`→
  `staleGuideEntries` 개명, JSDoc 재배치)** — 모두 라운드 1이 세운 설계(존재 축 ∩ 발행 축
  교집합 술어, 카탈로그 탈출구, 거울상 예외 목록)를 뒤집지 않는 구현 보강이며 새로운 Rationale
  충돌을 만들지 않는다.

## 요약

이 PR 은 `spec/conventions/**`(및 `spec/**` 전체)를 4라운드에 걸쳐 한 번도 수정하지 않아
"기각된 대안의 재도입"이 발생할 표면이 없다. 코드 측에서는 `#1330`의 "허용목록 없음" 원칙을
두 번째로 부분 번복(`GUIDE_NON_EMITTED_VOCABULARY` 신설)했지만 계보·근거를 코드 주석과 plan
양쪽에 명시했고, 직전 라운드가 지적한 "두 번째 번복이 트래커에 이름으로 지목되지 않는다"는
INFO 는 라운드 4 커밋에서 해소됐다(git log 로 직접 확인). 유일하게 남은 known-open 항목은
`3-error-handling.md §1.4` "앵커 없는 카탈로그 코드" 관행과 이 PR 이 정정한 가이드의 "코드가
아니다" 서술 간 구조적 불일치(WARNING)인데, 4라운드 전부터 상태 불변으로 이월되는 것이며
`spec/` 파일 자체를 이 PR 이 건드리지 않으므로 신규 위반이 아니다. 처분 택일(§1.4 backfill
vs 앵커-없음 표기 명시화)이 이미 `spec-draft-nullable-notation-followups.md` 에 planner
소유 항목으로 등재돼 택일을 기다리고 있고, `developer` 권한 밖 영역이라 이 PR 을 막을 이유가
아니다. Rationale 연속성 관점에서 이 PR 은 CRITICAL 이 없다.

## 위험도

LOW
