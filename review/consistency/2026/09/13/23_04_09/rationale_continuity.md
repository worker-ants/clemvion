# Rationale 연속성 검토 — error-code-emission-axis (구현 완료 후, HEAD `d39d91a84`)

## 검토 범위 재확인

- diff-base `origin/main`(`afaef5bef`) 대비 `scope(spec/conventions/)` 델타: **0개 파일**.
  전수 확인 결과 `spec/` 전체(0개 파일) 도 무변경 — 이 브랜치는 처음부터 끝까지 `spec/`
  을 한 번도 건드리지 않은 코드 전용 배치다. 델타 0 자체는 CRITICAL 근거로 쓰지 않는다.
- 실제 구현 diff(`afaef5bef..d39d91a84`, 4 파일/989줄): `guide-identifier-scan.ts` ·
  `guide-identifier-existence.test.ts` · `content/docs/02-nodes/logic.mdx` · `logic.en.mdx`.
  이 세션은 라운드 4(`5778885ce`, `review/consistency/2026/09/13/20_34_48`) 이후 라운드
  5~9(`57288e47f`…`d39d91a84`) 누적분을 포함한 **최종 상태**를 본다.
- 대조 축: (1) [`spec/5-system/3-error-handling.md §1.4`](../../../../../spec/5-system/3-error-handling.md#14-워크플로우-실행-에러)
  (엔진 수준 에러 카탈로그, "앵커 없는" 코드 취급), (2) [`spec/conventions/error-codes.md`](../../../../../spec/conventions/error-codes.md)
  전문(직접 Read — 프롬프트 번들은 예산 초과로 절단됨), (3) `plan/complete/guide-identifier-existence.md`
  (`#1330`)가 세운 "허용목록 없음" 원칙과 `#1331`(`GUIDE_EXTERNAL_VOCABULARY`)의 1차 번복,
  (4) 이 PR(`GUIDE_NON_EMITTED_VOCABULARY`)의 2차 번복, (5) 직전 라운드
  (`19_23_31`·`19_51_39`·`20_13_19`·`20_34_48`·`21_19_52`·`21_41_25`·`22_06_21`·`22_38_43`)
  rationale_continuity 산출물이 지목한 항목의 이행 여부.
- `spec/conventions/user-guide-evidence.md` 전문도 재확인 — 여전히 `guide-identifier-*` 가드
  가족을 언급하지 않는다(grep 0건). `plan/in-progress/spec-draft-nullable-notation-followups.md`
  (~line 3259-3308)의 planner 항목이 그 등재를 아직 `[ ]` open 상태로 보유 중임도 재확인.

## 발견사항

- **[WARNING] `§1.4` "앵커 없는 카탈로그 코드" 관행과 가이드의 "코드가 아니다" 서술의
  구조적 불일치 — 9라운드 누적, 상태 불변(known-open)**
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`,
    `logic.en.mdx:103` ("전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요" /
    "there is no dedicated error code, so read the message rather than the code"),
    및 `plan/in-progress/error-code-emission-axis.md` §D·§F.
  - 과거 결정 출처: [`spec/5-system/3-error-handling.md §1.4`](../../../../../spec/5-system/3-error-handling.md#14-워크플로우-실행-에러)
    머리말 — "**나머지 7종은 앵커 없는 맨 문자열**"이라 명시하면서도 `RECURSION_DEPTH_EXCEEDED`·
    `MAX_ITERATIONS_EXCEEDED`·`CYCLE_DETECTED`·`INVALID_EXPRESSION`·`VARIABLE_NOT_FOUND`·
    `TYPE_MISMATCH`(§1.4 표, 앵커 열 "없음")를 **정식 카탈로그 코드**로 등재해 둔다. 즉
    "앵커 없는 문자열이라도 카탈로그에 오르면 '코드'로 인정한다"가 이 spec 이 실제로 적용
    중인 불문 invariant다.
  - 상세: `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`
    (`execution-engine.service.ts:7121·7125·7130`, `nodeExec.error = { message }` —
    `code` 필드 자체가 없음, plan §D 실측)는 방출 형태가 §1.4 의 저 6종과 구조적으로
    동형(앵커 없는 일반 `Error` 메시지 접두)이다. 그런데 이 PR 은 가이드에 "이건 코드가
    아니다"라고 단정적으로 고쳐 적으면서, 같은 spec 이 구조적으로 동일한 6종은 여전히
    정식 "코드"로 카탈로그에 남겨 둔 상태를 그대로 둔다 — 판정 기준이 "발행 형태(앵커
    유무)"가 아니라 "§1.4 표 등재 여부"라는 임의적 축으로 갈라진다. `HEAD` 시점까지
    `logic.{mdx,en}` 본문·plan §D 프로즈가 라운드 5~9 에서 전혀 수정되지 않았음을 diff
    (`5778885ce..d39d91a84` 대상 파일 unchanged)로 확인했다 — 새 위반이 아니라 순수
    무변화 이월이다.
  - 처리 상태(불변): `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (~line 63-183, 460-465, 519 대역)에 택일안 (a) `CONTAINER_*` 를 §1.4 에 backfill /
    (b) §1.4 앵커-없는 행에 "메시지 접두" 표기 명시화 — 둘 다 `[ ]` open 으로 보존돼
    있고, 이번 PR 이 라운드 9 에서 그 항목에 **양방향 역참조**("backfill 이 won't-do 로
    처분되면 카탈로그 탈출구 자체가 제거 대상"이라는 조건부 서술)까지 추가해 결합 관계를
    명시화했다 — 회피가 아니라 권한 경계(spec/5-system/** 는 developer 쓰기 금지) 안에서
    가능한 최선의 명문화다.
  - CRITICAL 로 올리지 않는 이유(직전 라운드들과 동일, 9라운드째 유지): (i) `spec/` 파일
    자체는 이 브랜치에서 전혀 수정되지 않아 "기각된 대안의 재도입"이 발생할 자리가 없다,
    (ii) 모순이 신규가 아니라 라운드 1부터 열려 있던 known-open 항목의 연속이다, (iii)
    plan 자평이 "해결했다"고 과장하지 않고 스스로 지적·등재하며, 라운드 9 는 오히려 그
    등재를 더 정밀하게 다듬었다.
  - 제안: 변화 없음 — planner 턴에서 (a)/(b) 중 하나를 택하고 그 택일 자체를
    `3-error-handling.md §1.4` 본문 또는 `## Rationale` 에 한 줄 남길 것.

- **[INFO] "허용목록 없음" 원칙의 두 차례 번복 계보가 spec `## Rationale` 에는 여전히
  미착지 — 단, 직전 라운드가 지목한 "1차만 이름으로 지목됨" 결함은 이번 세션에서 실측상
  해소됐다**
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의
    `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` JSDoc.
  - 과거 결정 출처: 구조적 공백 — `user-guide-evidence.md §2`/`§2.1` 전문 재확인 결과
    `guide-identifier-*` 가드 가족 자체가 여전히 미등재.
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md`(~line 3259-3308)의
    planner 항목이 이번 세션 중 "(2026-09-13 보강)"으로 갱신돼 이제 **1차**
    (`GUIDE_EXTERNAL_VOCABULARY`, 존재 축, "기준집합에 없을 것") 와 **2차**
    (`GUIDE_NON_EMITTED_VOCABULARY`, 발행 축, "기준집합에 있을 것") 를 **둘 다 이름으로
    지목**하고, "제약이 정반대라 합칠 수 없다"·"표·frontmatter·Rationale 을 한 턴에"까지
    명시한다 — 직전 라운드(`20_34_48`)가 INFO 로 지적한 "1차만 지목됨" 결함은 실측상
    해소됐다. `plan/in-progress/error-code-emission-axis.md` §M("이미 등재돼 있던 것 —
    재등재 안 함")의 자평도 이 실측과 일치한다(지어낸 이력이 아님, 대조 완료).
  - 다만 그 planner 항목은 여전히 `[ ]` open 이며, **실제 spec `## Rationale` 착지는
    아직 발생하지 않았다** — "어디에 적을지"(Overview 스코프 확장 vs 신설 절) 조차
    미결이다(같은 항목 line 3293-3308). 근거·계보 자체는 code JSDoc + plan 양쪽에
    상세히(그리고 실제 이력과 대조해 검증 가능하게) 남아 있어 "무근거 번복"은 아니다.
  - CRITICAL/WARNING 이 아니라 INFO 인 이유: (i) 두 번복 모두 지금 이름·근거가 명시돼
    있다, (ii) `spec_impact: none` + 이 PR 의 `--impl-done` 스코프(`spec/conventions/`)가
    이 PR 자체에 그 항목 처리 의무를 지우지 않는다(developer 는 spec 쓰기 권한이 없다),
    (iii) 아직 planner 가 그 항목을 처리하지 않았으므로 실제 누락은 확정된 결함이 아니라
    미래 시점의 리스크로 남아 있다.
  - 제안: 변화 없음(직전 라운드와 동일) — `spec-draft-nullable-notation-followups.md` 의
    해당 항목을 처리하는 **다음 planner 턴**이 (a)/(b) 택일과 함께 1·2차 번복을 한 번에
    `## Rationale`(예: `user-guide-evidence.md` 스코프 확장본 또는 신설 절)로 옮길 것.
    이번 세션에서 새로 할 일은 없다 — 이미 두 번복이 이름으로 등재돼 다음 턴이 놓칠
    구조적 위험은 낮아졌다.

## 확인했으나 위반이 아닌 것

- **카탈로그를 "요구 조건"이 아니라 "탈출구"로 쓰는 설계**(`collectCatalogCodes`) —
  §1.4 의 "소비자·분류기 쪽 어휘 vs 엔진 발행 경로의 앵커" 구분을 정확히 인용해 그 구분과
  같은 방향으로 설계했다. "이 탈출구는 오늘 한 번도 발화하지 않는다"는 자기 반증을 지우지
  않고 코드·CHANGELOG 양쪽에 그대로 남긴 처리는 "근거는 실행해 보고 적는다"는 이 저장소의
  기존 관행과 정합한다.
- **문맥 게이팅(prose-context gating)으로 회귀하지 않음** — `#1330`이 이미 시도했다가
  `#1331`이 걷어낸 기각된 접근을 다시 채택하지 않았다(plan §D-2 가 명시).
- **라운드 5~9 신규 변경**(줄 번호 인용 → 앵커 문구 전환, 라운드 번호 자기 정정, `AST 로
  특정" 예고 문장의 취소선 정정) — 모두 이 저장소가 이미 이름 붙인 교훈("내가 편집하는
  파일을 줄 번호로 인용하지 마라", "예고를 반증했으면 그 자리에서 정정하라")을 스스로
  적용한 사례이며 새로운 Rationale 충돌을 만들지 않는다.
- **PROJECT.md·CHANGELOG.md 갱신** — SoT 를 `error-codes.md` + `3-error-handling.md §1`
  로 명시하고 "`user-guide-evidence.md §2` 표에는 아직 없다"고 스스로 밝혀, 위 INFO 항목의
  구조적 공백을 은폐하지 않는다.

## 요약

이 브랜치는 `spec/`(conventions 포함) 을 처음부터 끝까지 한 번도 수정하지 않은 코드 전용
배치이며, 그 결과 "기각된 대안의 재도입"이나 "spec Rationale 직접 위반"이 발생할 자리가
없다. `GUIDE_NON_EMITTED_VOCABULARY` 신설은 `#1330` "허용목록 없음" 원칙의 2차 번복이지만
코드 JSDoc 과 plan 양쪽에 계보·근거가 실제 이력과 대조 가능하게 명시돼 있어 무근거 번복이
아니며, 기각된 대안(문맥 게이팅)으로도 회귀하지 않았다. 라운드 4가 지적한 "1차 번복만
이름으로 지목됨" 결함은 이번 세션 중 실측상 해소됐다(둘 다 지목) — 다만 그 Rationale 이
실제로 spec `## Rationale` 에 착지하는 것은 여전히 미래의 planner 턴(위치 택일 포함)에
달려 있어 INFO 로 유지한다. 반면 `§1.4` "앵커 없는 코드도 카탈로그에 오르면 정식 코드"
관행과 이 PR 이 가이드에 새로 적은 "CONTAINER_* 는 코드가 아니다" 단정 사이의 구조적
불일치는 라운드 1부터 9까지 상태 변화 없이 열려 있다 — spec 파일 자체가 무변경이라
CRITICAL 대상은 아니지만, 다음 planner 턴이 §1.4 backfill 또는 앵커-없는 표기 명시화 중
하나를 택해 그 결정을 spec 에 남겨야 완전히 닫힌다.

## 위험도

LOW
