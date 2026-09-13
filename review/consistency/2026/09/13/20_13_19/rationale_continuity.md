# Rationale 연속성 검토 — error-code-emission-axis (구현 완료 후, 라운드 3 · `a4b98eda8`)

## 검토 범위 재확인

- `spec/conventions/` scope 델타: **0개 파일** — 이 브랜치는 그 영역의 spec 을 바꾸지 않았다. 정상
  (harness 가드 + 가이드 mdx 전용 배치).
- 실제 구현 diff(`origin/main...HEAD`, 4 codebase 파일)는
  `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` ·
  `guide-identifier-existence.test.ts` · `content/docs/02-nodes/logic.mdx` ·
  `content/docs/02-nodes/logic.en.mdx` 뿐이다. 이번 라운드(`a397ccc55` → `a4b98eda8`)가 새로
  더한 것은 `isMessagePrefixOnly` 추출·`parseWhereRefs` 전수화·`staleEntries` 중복 제거·
  CHANGELOG 자기모순 정정 — **`logic.{mdx,en.mdx}` 본문과 `plan §D` 프로즈는 이번 라운드에서
  손대지 않았다**(`git diff a397ccc55 a4b98eda8 -- codebase/frontend/src/content/docs/
  plan/in-progress/error-code-emission-axis.md` 로 확인 — §D 절 무변경, §F 절만 신규 추가).
- 대조 축: (1) `spec/5-system/3-error-handling.md §1.4`(엔진 수준 에러 카탈로그) 및 그
  `## Rationale`, (2) `#1330`(`plan/complete/guide-identifier-existence.md`)이 세운 "허용목록
  없음" 설계 원칙과 `#1331`(`GUIDE_EXTERNAL_VOCABULARY`)의 첫 번째 번복, (3) 직전 두 라운드
  산출물(`review/consistency/2026/09/13/19_23_31`, `19_51_39`)의 rationale_continuity 발견과
  그 이행 여부.
- `spec/conventions/error-codes.md` `## Rationale`(의미 기반 명명·rename 정책)과
  `user-guide-evidence.md §2`(build-time 가드 3건 목록)를 이번 라운드에도 직접 다시 읽어
  확인했다 — 둘 다 이 배치가 다루는 "존재 vs 방출" 축·`guide-identifier-*` 가드 가족을
  언급하지 않는다(grep 0건, 문서 SoT 밖). 따라서 본 라운드의 발견도 "spec/conventions 문서의
  Rationale 직접 위반"이 아니라, 위 (1)·(2)의 결정 계보와의 정합 여부다.

## 발견사항

- **[WARNING] §1.4 "앵커 없는 카탈로그 코드" 관행과 가이드/plan 의 "코드가 아니다" 서술의
  불일치 — 직전 두 라운드에서 이미 지적된 known-open 항목의 연속, 이번 라운드도 미해소 (신규
  아님, 상태 불변)**
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`,
    `logic.en.mdx:103`(정정된 Callout — "전용 에러 코드는 없으니 코드가 아니라 메시지를
    봐야 해요" / "there is no dedicated error code, so read the message rather than the
    code"), 및 `plan/in-progress/error-code-emission-axis.md` §D(원문 그대로 — "가이드가
    '이건 코드가 아니다' 라고 **올바르게** 설명하려면…")
  - 과거 결정 출처: [`spec/5-system/3-error-handling.md §1.4`](../../../../../spec/5-system/3-error-handling.md#14-워크플로우-실행-에러)
    머리말 — "**나머지 7종은 앵커 없는 맨 문자열**"이라면서도 `MAX_ITERATIONS_EXCEEDED`·
    `RECURSION_DEPTH_EXCEEDED`·`CYCLE_DETECTED` 등 6종을 표에 **정식 카탈로그 코드**로
    등재해 둔다.
  - 상세: `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`(`execution-engine.service.ts:
    7121,7125,7130`)은 방출 형태가 이 6종과 구조적으로 동형(일반 `Error` 메시지 접두,
    `.code` 필드 없음 — `execution-engine.service.ts:8016` 의 `nodeExec.error = { message }`
    로 재확인됨)인데, 가이드는 "코드가 아니다"라고 단정하는 반면 §1.4 는 같은 형태를 여전히
    "코드"로 취급한다. 이 모순은 라운드 1(`review/consistency/.../19_23_31`)이 처음 지적,
    라운드 2(`19_51_39`)가 "해소되지 않았으나 은폐되지도 않았다"고 재확인한 것과 **동일
    상태**다 — 이번 라운드(라운드 2 코드리뷰 fix, `a397ccc55`→`a4b98eda8`)는 `logic.{mdx,en}`
    과 plan §D 프로즈를 아예 건드리지 않았으므로 상태가 그대로 이월됐다. 새로 생긴 위반이
    아니라 **이미 등재된 known-open 항목의 무변화 연속**이다.
  - 확인된 처리 상태(불변): `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (line 3417-3424, 3440-3462)에 두 planner 항목("spec 6파일이 `CONTAINER_*`를 코드로
    적는다" · "§1.4 앵커 없는 코드 7종 카탈로그 표기를 정할 것")이 여전히 `[ ]` open 상태로
    등재돼 있고(`git diff a397ccc55 a4b98eda8` 로 이 파일 무변경 확인), 택일 옵션 (a)
    §1.4 backfill / (b) anchor-less 표기 명시화가 둘 다 보존돼 있다. `developer` 는
    `spec/5-system/**` 를 직접 고칠 권한이 없어(자기-반증형 소정정 조건에도 불해당 — 이
    문장은 developer 가 쓴 예고 문장이 아니라 기존 spec 표 자체) 택일을 미룬 것은 회피가
    아니라 정확한 권한 경계 준수다.
  - CRITICAL 로 올리지 않는 이유(직전 라운드와 동일): (i) `spec/` 파일 자체는 이번 diff 에서
    전혀 수정되지 않아 "기각된 대안의 재도입"이 발생할 자리가 없다, (ii) 모순이 신규가 아니라
    두 라운드 전부터 열려 있던 known-open 항목의 연속이다, (iii) plan 자평(§D·§F)이 "해결
    했다"고 과장하지 않는다.
  - 제안: 직전 라운드 제안 유지 — planner 턴에서 (a) `CONTAINER_MISSING_EMIT`/
    `CONTAINER_MULTIPLE_EMIT` 을 §1.4 에 backfill 하고 `GUIDE_NON_EMITTED_VOCABULARY` 등록
    2건을 자동 무효화하거나, (b) §1.4 의 앵커-없는 행에 "메시지 접두" 표기를 달아 「코드」와
    구분한다. 어느 쪽이든 택일 자체를 `3-error-handling.md §1.4` 본문 또는 그 `## Rationale`
    에 한 줄 남길 것 — `plan/in-progress/` → `complete/` 이동 시 이 근거가 옅어진다.

## 확인했으나 위반이 아닌 것 (기록용, 직전 라운드와 판정 유지)

- **`#1330` "허용목록 없음" 원칙의 두 번째 부분 번복** (`GUIDE_NON_EMITTED_VOCABULARY` 신설,
  `guide-identifier-scan.ts`). 선언부 JSDoc 이 여전히 "`#1330` 은 «허용목록 없음»을 설계
  원칙으로 세웠다. 이것이 그 원칙의 두 번째 부분 번복이다(첫 번째는
  `GUIDE_EXTERNAL_VOCABULARY`)… 문맥 술어에 숨기는 대신 명시적으로 적고 사유를 강제한다"
  라고 계보·이유를 명시한다(이번 라운드도 이 텍스트 무변경 확인). 무근거 번복이 아니라 새
  Rationale 을 동반한 정상 번복이다.
- **round 2→3 신규 코드(`isMessagePrefixOnly` 추출, `parseWhereRefs` 전수화, `staleEntries`
  공유, CHANGELOG 자기모순 정정)는 새로운 Rationale 충돌을 만들지 않는다.** CHANGELOG 정정은
  "카탈로그 탈출구가 `MAX_ITERATIONS_EXCEEDED` 에 발화한다"는 라운드 1 의 반증된 주장을 지운
  것이 아니라 **정확히 반증된 형태로 재서술**한 것 — 이 저장소의 "근거는 실행해 보고 적는다"
  관행(§B-3/§E 의 0회 발화 단언 고정과 동형)과 정합한다.
- **AST 기반 방출-위치 특정 축을 다시 시도하지 않음** — `#970`(정밀 파서 대 blind 정규식
  경계) 원칙과 정합 유지.
- **카탈로그를 "요구 조건"이 아니라 "탈출구"로 쓰는 설계** — `§1.4` Rationale 의 "소비자·
  분류기 쪽 어휘 vs 발행 경로의 앵커" 구분과 방향이 일치하며, 라운드 1 의 자기반증(0회 발화)을
  지우지 않고 코드·CHANGELOG 양쪽에 그대로 남긴 처리도 정합적이다.

## INFO

- **[INFO] `#1330`/`#1331` 원칙 계보가 spec `## Rationale` 어디에도 없다는 구조적 공백 —
  상태 불변, 이미 planner 트래커에 등재됨**
  - target 위치: `guide-identifier-scan.ts`(`GUIDE_EXTERNAL_VOCABULARY`/
    `GUIDE_NON_EMITTED_VOCABULARY` JSDoc)
  - 과거 결정 출처: 없음 — `user-guide-evidence.md §2`(build-time 가드 3건 목록)를 이번
    라운드에도 다시 확인했으나 `guide-identifier-*` 가드 가족이 여전히 미등재다.
  - 상세: 두 차례의 "허용목록 없음 → 허용목록 도입" 번복이 전부 코드 주석에만 기록돼 있다.
    이번 라운드도 이 공백을 spec 쪽에 메우지 않았지만, 그럴 스코프도 아니었다
    (`spec_impact: none`, `--impl-done` 스코프 = `spec/conventions/`).
  - 제안: 직전 라운드와 동일 — `spec-draft-nullable-notation-followups.md` 의 기존 planner
    항목을 처리하는 턴에서 `user-guide-evidence.md`(또는 스코프 확장본) `## Rationale`에
    "왜 허용목록을 결국 두 벌 두게 됐는가"를 존재/방출 두 축으로 나눠 명문화할 것.

## 요약

이번 라운드(`a397ccc55` → `a4b98eda8`)는 `/ai-review`·`--impl-done` 라운드 2 지적에 대한
코드 품질 수정(핵심 술어 함수 추출, `where` 다중 매치 검증, 테스트 중복 제거, CHANGELOG
자기모순 정정)만 담고 있으며 `logic.{mdx,en.mdx}` 본문과 plan §D 프로즈는 건드리지 않았다.
그 결과 직전 두 라운드가 지적한 WARNING(§1.4 "앵커 없는 카탈로그 코드" 관행과 가이드의
"코드가 아니다" 서술 간 구조적 불일치)은 **상태 변화 없이 그대로 이월**됐다 — 새로운 위반이
아니라 known-open 항목의 연속이며, spec 파일 자체를 이번 diff 가 건드리지 않으므로 "기각된
대안의 재도입"은 발생하지 않는다. `#1330` "허용목록 없음" 원칙의 두 번째 부분 번복
(`GUIDE_NON_EMITTED_VOCABULARY`)은 여전히 코드 주석에 계보·이유가 명시된 정당한 처리이고,
그 계보가 spec `## Rationale` 밖에 있다는 구조적 공백도 상태 불변인 채 planner 트래커에
이미 등재돼 있다. `spec/conventions/**` 자체는 이번 브랜치 전체(3라운드 누적)에서 한 번도
수정되지 않았으므로 그 스코프 안에서의 Rationale 직접 위반은 없다.

## 위험도

LOW
