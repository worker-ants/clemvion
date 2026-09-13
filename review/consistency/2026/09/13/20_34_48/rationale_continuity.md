# Rationale 연속성 검토 — error-code-emission-axis (구현 완료 후, 라운드 4 · HEAD `5778885ce`)

## 검토 범위 재확인

- diff-base `origin/main` = `afaef5bef`. `scope(spec/conventions/)` 델타: **0개 파일** — 이
  브랜치는 그 영역의 spec 을 한 번도 바꾸지 않았다(3라운드 누적, 이번 라운드도 동일). 코드
  전용 배치이므로 정상이며 이 자체를 CRITICAL 근거로 쓰지 않는다.
- 실제 구현 diff(`origin/main...HEAD`, `afaef5bef..5778885ce`)는 4개 codebase 파일 —
  `guide-identifier-scan.ts` · `guide-identifier-existence.test.ts` ·
  `content/docs/02-nodes/logic.mdx` · `logic.en.mdx`. 라운드 3(`a4b98eda8`)→라운드 4(HEAD)
  구간(`git diff a4b98eda8..HEAD`)은 `guide-identifier-existence.test.ts` 의 `staleEntries`
  판별 대조군 추가(+25줄)와 plan 체크리스트 갱신뿐이다 — **`guide-identifier-scan.ts` JSDoc,
  `logic.{mdx,en.mdx}` 본문, `plan §D` 프로즈는 이번 라운드에서도 무변경**임을 직접 diff 로
  확인했다.
- 대조 축: (1) `spec/5-system/3-error-handling.md §1.4`(엔진 수준 에러 카탈로그와 그
  머리말 Rationale-adjacent 서술), (2) `plan/complete/guide-identifier-existence.md`
  (`#1330`)가 세운 "허용목록 없음" 설계 원칙과 그 뒤 `#1331`(`GUIDE_EXTERNAL_VOCABULARY`)의
  첫 번째 번복, (3) 이 PR 자체(`GUIDE_NON_EMITTED_VOCABULARY`)의 두 번째 번복, (4) 직전
  세 라운드(`19_23_31`·`19_51_39`·`20_13_19`) rationale_continuity 산출물과 그 이행 여부.
- `spec/conventions/error-codes.md`(전문 직접 Read — 프롬프트 번들은 예산 초과로 절단됨)와
  `user-guide-evidence.md`(전문)를 이번 라운드에도 다시 확인했다 — 둘 다 이 PR 이 다루는
  "존재 vs 방출" 축·`guide-identifier-*` 가드 가족을 언급하지 않는다(grep 0건, 두 문서
  스스로 선언한 소유 범위 밖). 따라서 발견은 "spec/conventions 문서의 Rationale 직접
  위반"이 아니라 위 (1)~(3) 결정 계보와의 정합 여부다.

## 발견사항

- **[WARNING] `§1.4` "앵커 없는 카탈로그 코드" 관행과 가이드의 "코드가 아니다" 서술의
  불일치 — 3라운드 연속 known-open, 이번 라운드도 상태 불변**
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`,
    `logic.en.mdx:103`("전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요" /
    "there is no dedicated error code, so read the message rather than the code"), 및
    `plan/in-progress/error-code-emission-axis.md` §D("가이드가 '이건 코드가 아니다' 라고
    **올바르게** 설명하려면…")
  - 과거 결정 출처: [`spec/5-system/3-error-handling.md §1.4`](../../../../../spec/5-system/3-error-handling.md#14-워크플로우-실행-에러)
    머리말 — "**나머지 7종은 앵커 없는 맨 문자열**"이라 적으면서도 `MAX_ITERATIONS_EXCEEDED`·
    `RECURSION_DEPTH_EXCEEDED`·`CYCLE_DETECTED` 등을 §1.4 표에 **정식 카탈로그 코드**로
    등재해 둔다.
  - 상세: `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`
    (`execution-engine.service.ts:7121,7125,7130`, `nodeExec.error = { message }` —
    `:8016`에 `code` 필드 자체가 없음, plan §D 실측)는 방출 형태가 §1.4 의 저 6종과
    구조적으로 동형(일반 `Error` 메시지 접두)인데, 가이드는 "코드가 아니다"라고 단정하는
    반면 §1.4 는 같은 형태를 여전히 정식 "코드"로 취급한다. 이 모순은 라운드 1
    (`review/consistency/2026/09/13/19_23_31`)이 처음 지적했고, 라운드 2·3이 "해소되지
    않았으나 은폐되지도 않았다"고 재확인한 것과 동일 상태다. 라운드 3→4 구간은
    `logic.{mdx,en}`·plan §D 를 아예 건드리지 않았으므로(diff 확인) 새 위반이 아니라
    **무변화 이월**이다.
  - 처리 상태(불변): `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (~line 3417-3462)에 두 planner 항목 — "spec 6파일이 `CONTAINER_*`를 코드로 적는다"·
    "§1.4 앵커 없는 코드 7종 카탈로그 표기를 정할 것" — 이 여전히 `[ ]` open 으로 등재돼
    있고, 택일안 (a) §1.4 backfill / (b) anchor-less 표기 명시화가 둘 다 보존돼 있다.
    `developer` 는 `spec/5-system/**` 를 직접 고칠 권한이 없고(자기-반증형 소정정 조건에도
    불해당 — 그 문장은 developer 자신이 쓴 예고가 아니라 기존 spec 표) 택일을 미룬 것은
    회피가 아니라 권한 경계 준수다.
  - CRITICAL 로 올리지 않는 이유(직전 라운드들과 동일): (i) `spec/` 파일 자체는 이번 diff 에서
    전혀 수정되지 않아 "기각된 대안의 재도입"이 발생할 자리가 없다, (ii) 모순이 신규가 아니라
    3라운드 전부터 열려 있던 known-open 항목의 연속이다, (iii) plan 자평(§D·§F·§G)이
    "해결했다"고 과장하지 않고 오히려 스스로 지적·등재했다.
  - 제안: 직전 라운드 제안 유지 — planner 턴에서 (a) `CONTAINER_MISSING_EMIT`/
    `CONTAINER_MULTIPLE_EMIT`을 §1.4 에 backfill해 `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건을
    자동 무효화하거나, (b) §1.4 의 앵커-없는 행에 "메시지 접두" 표기를 달아 「코드」와
    구분한다. 어느 쪽이든 택일 자체를 `3-error-handling.md §1.4` 본문 또는 그
    `## Rationale`에 한 줄 남길 것.

## 확인했으나 위반이 아닌 것

- **`#1330` "허용목록 없음" 원칙의 두 번째 부분 번복** (`GUIDE_NON_EMITTED_VOCABULARY` 신설,
  `guide-identifier-scan.ts`). 선언부 JSDoc 이 "`#1330`은 «허용목록 없음»을 설계 원칙으로
  세웠다. 이것이 그 원칙의 두 번째 부분 번복이다(첫 번째는 `GUIDE_EXTERNAL_VOCABULARY`)…
  문맥 술어에 숨기는 대신 명시적으로 적고 사유를 강제한다"라고 계보·이유를 명시하며, 그
  주장은 `plan/complete/guide-identifier-existence.md`(line 24·45·86 등)에 실제로 남아 있는
  이력과 대조해 검증됨(지어낸 이력이 아님). 무근거 번복이 아니라 새 Rationale 을 동반한
  정상 번복이다.
- **문맥 게이팅(prose-context gating)으로 돌아가지 않음** — plan §D-2 가 명시하듯 "문맥을
  파싱해 '이 문장이 코드라고 주장하나'를 판정하는 길은 `#1330`이 이미 가 봤고 `#1331`이
  걷어냈다 — 문맥 게이팅은 원 결함을 놓쳤다"며 그 **기각된 대안으로 회귀하지 않았다**. 이미
  기각된 접근을 다시 채택하지 않은 사례로, 오히려 이 축의 건전한 사례다.
- **카탈로그를 "요구 조건"이 아니라 "탈출구"로 쓰는 설계** (`collectCatalogCodes`) —
  `§1.4`의 "소비자·분류기 쪽 어휘 vs 엔진 발행 경로의 앵커" 구분을 정확히 인용해(원문 대조
  완료) 그 구분과 같은 방향으로 설계했다. 라운드 1 이 스스로 "이 탈출구는 오늘 한 번도
  발화하지 않는다"고 반증한 사실을 지우지 않고 코드·CHANGELOG 양쪽에 그대로 남긴 처리도
  이 저장소의 "근거는 실행해 보고 적는다" 관행과 정합한다.
- **폴더-스코프 bare-citation 가드를 세우지 않음** (plan §G) — `review-citations.md §4`의
  "기존 bare 인용은 일괄 치환하지 않는다"를 실측 확인한 뒤 스스로 철회했다. 4번째 재발이라는
  압력에도 기존 규약을 우선했다 — 규약 위반이 아니라 **규약 준수의 사례**.
- **라운드 3→4 신규 코드(`staleEntries` 진리표 대조군 3건)** — 새로운 설계 결정이 아니라
  기존 술어의 테스트 커버리지 보강이며 Rationale 충돌을 만들지 않는다.

## INFO

- **[INFO] 두 차례의 "허용목록 없음 → 도입" 번복 계보가 spec `## Rationale` 어디에도 없고,
  그 등재를 맡은 기존 planner 트래커 항목이 «첫 번째 번복만» 이름으로 지목한다**
  - target 위치: `guide-identifier-scan.ts` 의 `GUIDE_EXTERNAL_VOCABULARY`/
    `GUIDE_NON_EMITTED_VOCABULARY` JSDoc
  - 과거 결정 출처: 없음(구조적 공백) — `user-guide-evidence.md §2`/`§2.1`을 이번 라운드에도
    전문 재확인했으나 `guide-identifier-*` 가드 가족 자체가 여전히 미등재다.
  - 상세: `spec-draft-nullable-notation-followups.md`(~line 3255-3290)의 planner 항목
    "`user-guide-evidence.md §2.1` 관계표에 새 가드 2건이 빠져 있다"가 "**함께 등재할
    Rationale**: `#1330`이 세운 «허용목록 없음» 원칙을 `#1331`이 실측으로 번복했다…"라고
    적어 두는데, 이 문구는 **`GUIDE_EXTERNAL_VOCABULARY`(첫 번째 번복)만 이름으로
    지목**하고 이번 PR 이 신설한 `GUIDE_NON_EMITTED_VOCABULARY`(두 번째 번복)는 언급하지
    않는다(해당 문자열로 grep 0건). 이 트래커 항목 자체는 이 저장소가 이미 한 번 겪은
    "표를 두 번 나눠 등재하면 두 번 미완결이 된다"는 교훈(같은 `#1330` plan 의
    impl-prep WARNING#2 처리 메모)의 대상인데, 지금 상태로 두면 planner 가 이 항목을
    처리할 때 첫 번째 번복만 spec Rationale 에 옮기고 두 번째 번복(이번 PR)은 근거가
    코드 주석에만 남은 채 "처리 완료"로 착지할 위험이 있다 — 정확히 그 저장소가 이름
    붙인 패턴의 재발 소지.
  - CRITICAL/WARNING 이 아니라 INFO 인 이유: (i) 두 번복 모두 코드 JSDoc 에 근거·계보가
    명시돼 있어 "무근거 번복"은 아니다, (ii) `spec_impact: none` + `--impl-done` 스코프가
    `spec/conventions/`라 이 PR 자체가 그 트래커 항목을 처리할 의무는 없다, (iii) 아직
    planner 가 그 항목을 처리하지 않았으므로 실제 누락은 미래 시점의 리스크이지 확정된
    결함이 아니다.
  - 제안: `spec-draft-nullable-notation-followups.md` 의 해당 항목 문구에 `GUIDE_NON_EMITTED_VOCABULARY`
    (이번 PR)를 두 번째 번복 사례로 명시 추가 — 항목을 처리하는 planner 턴이 한 번에 두
    번복을 모두 spec `## Rationale`(예: `user-guide-evidence.md` 스코프 확장본 또는 신설
    절)에 옮기도록. 이 갱신 자체는 `plan/**`이라 developer 권한 안이므로, 이 배치가
    아직 완료 전이면 지금 반영해도 무방하다.

## 요약

이번 라운드(`a4b98eda8`→`5778885ce`)는 `/ai-review` 라운드 3 지적(`staleEntries` 1줄 헬퍼의
판별 대조군 부재)에 대한 테스트 보강만 담았고, `guide-identifier-scan.ts` JSDoc·
`logic.{mdx,en.mdx}` 본문·plan §D 프로즈는 무변경이다. 그 결과 직전 세 라운드가 반복 지적한
WARNING(`§1.4` "앵커 없는 카탈로그 코드" 관행과 가이드의 "코드가 아니다" 서술 간 구조적
불일치)은 상태 변화 없이 그대로 이월됐다 — `spec/` 파일 자체를 이번 diff 가 건드리지 않으므로
"기각된 대안의 재도입"은 발생하지 않았고, 두 planner 항목(§1.4 backfill 택일·spec 6파일 정정)이
이미 트래커에 등재돼 택일을 기다리는 중이다. `GUIDE_NON_EMITTED_VOCABULARY` 신설은 `#1330`
"허용목록 없음" 원칙의 두 번째 부분 번복이지만 계보·근거가 코드 주석에 명시돼 무근거 번복은
아니며, 기각된 대안(문맥 게이팅)으로도 회귀하지 않았다. 다만 그 번복의 spec Rationale 등재를
맡은 기존 planner 트래커 항목이 첫 번째 번복만 이름으로 지목하고 있어, 처리 시점에 두 번째
번복이 조용히 누락될 구조적 위험이 남아 있다(INFO). `spec/conventions/**` 자체는 이 PR
전체(4라운드 누적)에서 한 번도 수정되지 않아 그 스코프 안에서의 Rationale 직접 위반은 없다.

## 위험도

LOW
