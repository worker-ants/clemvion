# Rationale 연속성 검토 — error-code-emission-axis (구현 완료 후, 라운드 2)

## 검토 범위 재확인

- `spec/conventions/` scope 델타: **0개 파일** — 이 브랜치는 그 영역의 spec 을 바꾸지 않았다. 정상.
- 실제 구현 diff(2 커밋: `65256a109` → `a397ccc55`, 총 4 codebase 파일)는
  `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` ·
  `guide-identifier-existence.test.ts` · `02-nodes/logic{,.en}.mdx` 뿐이다.
- 대조 축: (1) `spec/5-system/3-error-handling.md §1.4`(엔진 수준 에러 카탈로그) 및 그
  `## Rationale`, (2) `#1330`(`plan/complete/guide-identifier-existence.md`)이 세운 "허용목록
  없음" 설계 원칙, (3) 직전 라운드 산출물
  `review/consistency/2026/09/13/19_23_31/rationale_continuity.md`(WARNING·INFO)의 이행 여부.
- 위 셋 모두 `spec/conventions/`의 `## Rationale` 그 자체는 아니다 — `spec/conventions/error-codes.md`
  §명명 규약과 `user-guide-evidence.md` §2 관계표는 이 배치가 건드리는 어휘와 무관함을
  직접 읽어 확인했다(허용목록/`guide-identifier-*` 언급 0건). 따라서 본 라운드의 발견은
  "spec/conventions 문서의 Rationale 위반"이 아니라, 위 (1)·(2)의 결정 계보와의 정합 여부다.

## 발견사항

- **[WARNING] §1.4 "앵커 없는 카탈로그 코드" 서술과 가이드/plan 의 "코드가 아니다" 서술이
  여전히 정면으로 어긋난 채 남아 있다 — 단, 이번 라운드는 이를 은폐하지 않고 정확히
  자기-제한했다 (직전 라운드 WARNING 카본카피, 신규 아님)**
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.{mdx,en.mdx}`(정정된
    Callout — "전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요"), 및
    `plan/in-progress/error-code-emission-axis.md` §D (라운드 0 원문, 변경 없음 — "가이드가
    '이건 코드가 아니다' 라고 **올바르게** 설명하려면…")
  - 과거 결정 출처: [`spec/5-system/3-error-handling.md §1.4`](../../../../../spec/5-system/3-error-handling.md#14-워크플로우-실행-에러)
    머리말 — "**나머지 7종은 앵커 없는 맨 문자열**"이라면서도 `MAX_ITERATIONS_EXCEEDED` 등
    6종을 표에 **정식 카탈로그 코드**로 등재해 둔다. `CONTAINER_MISSING_EMIT`/
    `CONTAINER_MULTIPLE_EMIT`(`execution-engine.service.ts:7121,7125,7130`)은 방출 형태가
    이 6종과 **완전히 동형**(일반 `Error` 메시지 접두, `.code` 필드 없음)인데도 가이드는
    "코드가 아니다"라고 단정한다 — 같은 저장소가 구조적으로 동일한 것을 두 곳에서 반대로
    부르는 상태다.
  - 상세: 직전 라운드(`19_23_31`)가 정확히 이 지점을 WARNING(옵션 (a) 서술 정정 / (b)
    §1.4 backfill)으로 지적했다. 이번 라운드는 그 WARNING을 **해소하지 않았다** — 다만
    은폐하지도 않았다. 확인한 처리:
    1. `plan/in-progress/error-code-emission-axis.md` 체크리스트가 스스로 "이행한 것은
       (a) 도 (b) 도 아니다"라고 명시하고, "그 택일은 `spec/` 이라 planner 몫"이라고 정확히
       경계를 그었다(직전 라운드 INFO#2가 요구한 자평 축소를 그대로 반영).
    2. `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목 두 개를
       새로 등재했다 — "spec 6파일이 CONTAINER_\*를 코드로 적는다"(가이드 vs spec 서술
       불일치 자체를 등재) 및 "`§1.4`의 앵커 없는 코드 7종이 실제로는 메시지 접두다 —
       카탈로그 표기를 정할 것"(§1.4 backfill 대 anchor-less 표기 명시화의 택일을 그대로
       옮김). 둘 다 (a)/(b) 두 옵션을 온전히 보존해 등재했다.
    3. `developer`는 `spec/5-system/**`을 직접 고칠 권한이 없다(§자기-반증형 소정정 조건에도
       해당 안 함 — 이 문장은 developer 가 쓴 예고 문장이 아니라 기존 spec 표 자체다) — 즉
       이번 라운드가 택일을 미룬 것은 **정확한 처신**이지 회피가 아니다.
  - 이 상태를 CRITICAL 로 올리지 않는 이유: (i) 실제 spec 파일은 이번 diff 에서 전혀
    수정되지 않았으므로 "기각된 대안의 재도입"이 발생할 자리가 없다, (ii) 모순의 존재
    자체가 새로 생긴 것이 아니라 직전 라운드가 이미 잡아 등재까지 마친 known-open 항목의
    **연속 상태**다, (iii) plan 자평이 "해결했다"고 과장하지 않아 다음 사람이 오판할
    위험이 없다.
  - 제안: 직전 라운드 제안을 그대로 유지한다 — planner 턴에서 (a) §1.4 anchor-less 6종에
    "메시지 접두" 표기를 달아 카탈로그 의미를 명확히 하거나, (b) `CONTAINER_*` 를 §1.4 에
    backfill 하고 `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건을 자동 무효화한다. 어느 쪽이든
    **택일 자체를 `3-error-handling.md §1.4` 또는 그 Rationale 에 한 줄 남길 것** — 지금처럼
    plan 트래커에만 있으면 `plan/in-progress/` → `complete/` 이동 시 근거가 옅어진다.

## 확인했으나 위반이 아닌 것 (기록용, 직전 라운드와 판정 유지)

- **`#1330` "허용목록 없음" 원칙의 두 번째 부분 번복** (`GUIDE_NON_EMITTED_VOCABULARY` 신설).
  `guide-identifier-scan.ts` JSDoc 이 스스로 "이것이 그 원칙의 두 번째 부분 번복이다(첫
  번째는 `GUIDE_EXTERNAL_VOCABULARY`)"라고 계보·이유(문맥 술어에 숨기지 않고 명시적으로
  적어 사유를 강제)를 명시한다. 무근거 번복이 아니라 **새 Rationale 을 동반한 정상 번복**
  이다. 다만 이 "허용목록 없음" 원칙 자체가 애초에 `spec/**`의 `## Rationale`에 기록된 적이
  없고(`plan/complete/guide-identifier-existence.md`와 코드 주석에만 존재), 이번 배치도
  그 공백을 spec 쪽에 메우지 않았다 — `spec-draft-nullable-notation-followups.md`가 "그
  근거가 지금 plan·코드 주석에만 있고 spec `## Rationale` 에는 없다"고 이미 자인하며
  planner 항목("«어디에» 적을지가 아직 안 정해졌다")으로 등재해 두었다. 새로 발견된
  결함이 아니라 기존에 이미 열려 있던 구조적 공백이므로 별도 WARNING 으로 올리지 않고
  INFO 로만 남긴다.
- **AST 기반 방출-위치 특정 축을 다시 시도하지 않음** — `#970`(정밀 파서 대 blind 정규식
  경계) 원칙과 정합 유지.
- **카탈로그를 "요구 조건"이 아니라 "탈출구"로 쓴다는 설계**는 `§1.4` Rationale의 "소비자·
  분류기 쪽 어휘 vs 발행 경로의 앵커" 구분과 방향이 일치하며, 라운드 1에서 스스로
  반증(`MAX_ITERATIONS_EXCEEDED`가 실제로는 탈출구가 아니라 소비자-인용 경로로 통과함을
  실측)하고 그 반증을 지우지 않고 코드에 그대로 남긴 처리도 이 저장소의 "근거는 실행해
  보고 적는다" 관행과 정합한다.

## INFO

- **[INFO] `#1330`/`#1331` 원칙 계보가 spec 어디에도 없다 — 이번 기회에 닫을 자리가
  이미 planner 트래커에 있다**
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
    (`GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` JSDoc)
  - 과거 결정 출처: 없음(이것이 지적의 핵심) — `spec/conventions/user-guide-evidence.md`
    직접 확인 결과 `guide-identifier-*` 가드 가족 자체가 §2 관계표·frontmatter `code:`에
    미등재이며, 이는 이번 diff 이전부터 있던 gap 이다.
  - 상세: 두 차례의 "허용목록 없음 → 허용목록 도입" 번복이 전부 코드 주석에만 기록돼
    있다. 코드 주석은 파일이 재작성되면 함께 소실될 수 있어(이 파일 자체가 이미
    "재작성하다 자기 주석을 지운 전력"이 있다고 트래커에 등재돼 있음) 결정 계보의
    영속성이 약하다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md`의 기존 항목("함께
    등재할 Rationale: `#1330`이 세운 '허용목록 없음' 원칙을 `#1331`이 실측으로 번복했다…")을
    처리하는 planner 턴에서, `user-guide-evidence.md`(또는 그 스코프 확장본) `## Rationale`에
    "왜 허용목록을 결국 두 벌 두게 됐는가"를 존재/방출 두 축으로 나눠 명문화할 것. 이미
    등재돼 있으므로 새로 만들 필요는 없고, 이 규모가 "SoT 를 spec 쪽에 옮기지 않으면 다음
    번복도 같은 자리에서 코드 주석에만 남는다"는 근거로 우선순위를 뒷받침한다.

## 요약

이번 라운드의 구현 diff(`a397ccc55`)는 직전 라운드 rationale_continuity 가 지적한 두
항목(WARNING: §1.4 "앵커 없는 카탈로그 코드" 관행과의 불일치, INFO: 자평이 실제 이행
범위보다 넓게 들림) 중 INFO 는 정확히 이행했고(체크리스트 자평을 "이행한 것은 (a) 도
(b) 도 아니다"로 정직하게 축소), WARNING 은 **해소하지 않았지만 올바른 경로로 처리**했다
— spec 파일을 직접 고치는 대신 두 개의 명시적 planner 항목으로 등재해 택일을 미뤘다.
`spec/conventions/**` 자체에는 이번 diff 가 손대지 않았으므로 "기각된 대안의 재도입"이나
"spec Rationale 직접 위반"은 발생하지 않는다. 유일하게 남는 긴장은 가이드 본문("코드가
아니다")과 `3-error-handling.md §1.4`의 기존 관행("앵커 없어도 카탈로그 코드로 등재")이
구조적으로 동형인 두 사례를 반대로 취급한다는 점인데, 이는 신규 결함이 아니라 이미
planner 트래커에 명시적으로 등재된 known-open 항목의 연속이며 BLOCK 사유가 아니다.
"허용목록 없음" 원칙의 두 번째 번복도 코드 주석 안에서는 새 Rationale 을 동반한 정당한
처리이나, 그 계보 자체가 spec `## Rationale` 밖에 있다는 구조적 공백은 여전히 열려 있다.

## 위험도

LOW
