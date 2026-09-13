# Rationale 연속성 검토

## 조사 방법 메모

- `--impl-done` 스코프(`spec/conventions/`)의 실제 델타는 **0개 파일** — `git diff origin/main...HEAD --stat -- spec/`
  로 직접 확인, 이 배치는 `spec/` 어디에도 손대지 않았다(`plan/in-progress/error-code-emission-axis.md`
  frontmatter `spec_impact: none` 과 일치). prompt 번들의 `spec/conventions/**` 전량과 예산 절단된
  `error-codes.md`·diff 블록은 절대경로 워킹트리에서 직접 재확인했다.
- 실제 코드 diff(`git -C ".../error-code-emission-axis-56c9ff" diff origin/main...HEAD -- codebase/`)는
  6개 파일 897줄: `logic.mdx`/`logic.en.mdx`(각 1줄) · `guide-identifier-scan.ts` ·
  `guide-identifier-existence.test.ts` · `CHANGELOG.md` · `PROJECT.md`. 나머지는
  `plan/in-progress/**`(spec 아님).
- **HEAD(`53d29a6f4`)는 이미 라운드 1~7 의 `/ai-review`+`--impl-done` 을 모두 통과한 상태**이고, 직전
  라운드 리뷰(`review/consistency/2026/09/13/21_41_25/rationale_continuity.md`)가 같은 diff 를 거의
  그대로 검토해 **위험도 NONE** 을 냈다. 이번 라운드(8)에서 추가된 유일한 코드 변경은 `53d29a6f4`
  자체(라운드 7 fix) 두 파일 — (a) `resolveSourceLines` 유일성 가드에 분기별 뮤테이션 대조군 3건 추가,
  (b) 스캐너/테스트 헤더의 SoT 인용을 `user-guide-evidence.md §2`(그 문서에 이 가드가 없음, 실측
  `grep -c guide-identifier` → 0)에서 `error-codes.md`+`3-error-handling.md §1`로 정정 — 이므로, 이번
  라운드에서는 그 증분만 새로 확인하고 이전 라운드가 이미 검증한 3개 항목(§B-3 판별 vs
  `chat-channel-adapter.md R-CCA-9`, §1.4 앵커 정책 재사용, 가이드 문구 정정의 `#1330` 선례 일치)은
  원문을 재대조해 유지 여부만 판정했다.

## 발견사항

검토 결과 CRITICAL·WARNING 급 충돌은 발견하지 못했다.

- **[INFO]** 라운드 7 의 SoT 인용 정정은 사실 정정이며 새 결정이 아니다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 상단 주석,
    `guide-identifier-existence.test.ts` JSDoc
  - 과거 결정 출처: 없음(정정 대상 자체가 developer 자신의 오기) — 다만 원칙은
    `CLAUDE.md` "spec 은 project-planner 소유" 경계
  - 상세: `spec/conventions/user-guide-evidence.md §2` 표에 이 가드가 실제로 등재돼 있는지
    `grep -c "guide-identifier" spec/conventions/user-guide-evidence.md` 로 직접 재확인 —
    **0건**. 즉 "SoT: user-guide-evidence.md §2" 표기는 처음부터 착지하지 않는 인용이었고,
    이번 커밋은 그것을 `error-codes.md`+`3-error-handling.md §1`로 옮기며 "가족 규약 문서는
    맞지만 이 가드의 등재는 planner 트래커 대기" 라고 정확히 적었다. `spec/` 파일 자체는
    건드리지 않았으므로 developer 권한 경계도 지켰다. Rationale 을 뒤집는 것이 아니라
    존재하지 않던 앵커를 존재하는 앵커로 바꾼 것.
  - 제안: 조치 불요.

- **[INFO]** `GUIDE_NON_EMITTED_VOCABULARY`/`GUIDE_EXTERNAL_VOCABULARY` 를 분리 유지하는 설계는
  `user-guide-evidence.md §Rationale R-2` 의 기존 원칙과 오히려 정합한다
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` §C
    ("두 목록을 합치면 예외 하나가 두 축의 결함을 동시에 덮는다 — 합칠 수 없다")
  - 과거 결정 출처: `spec/conventions/user-guide-evidence.md §Rationale R-2`
    ("`registry.test.ts` 와 분리 — symbol grep 검증의 필요성" — "두 가드가 보완 관계 —
    한쪽으로 통합하지 않음")
  - 상세: R-2 는 이미 이 저장소가 "같은 가족의 두 가드/두 예외축은 통합하지 말고 보완 관계로
    둔다" 는 원칙을 세워 뒀다. 이번 배치가 존재축(`GUIDE_EXTERNAL_VOCABULARY`, 제약: 기준집합에
    **없을 것**)과 방출축(`GUIDE_NON_EMITTED_VOCABULARY`, 제약: 기준집합에 **있을 것**)을
    분리 유지한 것은 그 원칙의 새로운 적용이지 위반이 아니다. 다만 이 대응이 spec 문서에는
    아직 명시되지 않았다(코드 주석·plan 에만 있음) — 이는 이미 plan 이 스스로 지적하고
    planner 등재분으로 남겨 둔 사실이라 추가 조치가 필요하지 않다.
  - 제안: 조치 불요(참고용 긍정 대조).

- **[INFO]** (라운드 1~7 재검증 유지) `GUIDE_NON_EMITTED_VOCABULARY` 판별이 `chat-channel-adapter.md
  §R-CCA-9` ("`message` 접두 파싱으로 제어흐름을 가르는 패턴" 명시적 기각)과 어휘가 겹쳐 보이지만
  층이 다르다
  - target 위치: `guide-identifier-scan.ts` 의 `isMessagePrefixOnly`/`collectMessagePrefixes`
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md` `## Rationale` §R-CCA-9
    (직접 재확인: "discord 어댑터가 실제로 쓰던 방식이라 관례의 승격으로 제안했다가 기각했다.
    여전히 문자열 파싱으로 제어흐름을 가르는 형태이고 … 그 접두는 관례가 아니라 규칙 부재의
    흔적이었다")
  - 상세: R-CCA-9 이 기각한 것은 **런타임에서 `err.message` 문자열을 파싱해 분기**하는
    패턴이다(어댑터가 `code` 프로퍼티 대신 message 접두로 사유를 실어 호출자가 그것을 파싱하게
    만드는 설계). 이번 가드는 **빌드타임 정적 스캐너가 소스 텍스트를 읽어** 가이드 문서의 서술
    정확성(코드로 방출되는지 vs 메시지에만 등장하는지)을 검증하는 것으로, 런타임 제어흐름이 아니다.
    오히려 이 가드가 발견을 통해 만든 결과("이건 코드가 아니라 메시지다" 라고 가이드를 정정)는
    R-CCA-9 의 정신(선언되지 않은 것을 코드처럼 취급하지 말라)과 같은 방향이다. 재확인 결과 이전
    라운드의 판단이 유지된다.
  - 제안: 필수 아님 — `guide-identifier-scan.ts` 헤더에 "이 판별은 런타임 분기가 아니라 문서-검증
    정적 스캔이며 R-CCA-9 의 대상과 다르다" 한 줄을 남기면 향후 과잉 일반화를 막는다.

- **[INFO]** (라운드 1~7 재검증 유지) `3-error-handling.md §1.4` 의 "앵커 없는 맨 문자열도 정식
  카탈로그 항목" 결정을 "카탈로그=탈출구" 설계로 재사용한 것은 새 결정이 아니라 기존 결정의 재사용
  - target 위치: `guide-identifier-scan.ts` §B-3 판별식(`collectCatalogCodes` 를 등록 면제
    조건으로 사용)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §1.4` 머리말(직접 재확인, line 109-115:
    "이 표는 단일 등재처를 뜻하지 않는다 … 나머지 7종은 앵커 없는 맨 문자열이라 오탈자가 tsc 를
    통과한다 … 그것은 소비자·분류기 쪽 어휘이지 엔진 발행 경로의 앵커가 아니다")
  - 상세: `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 는 §1.4 가 이미 정식으로 인정한
    "앵커 없는 문자열" 부류(`MAX_ITERATIONS_EXCEEDED` 등)와 발행 형태가 동일한데 카탈로그에만
    없어 "왜 이 둘만 카탈로그 밖인가" 라는 비일관성이 남는다. 이 PR 은 그 비일관성을 spec 을
    직접 고쳐 해소하지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
    planner 대상 항목으로 등재했다(양방향 역참조 포함, `complete/` 봉인 대비 조치까지 완료) —
    developer 권한 경계를 지킨 올바른 처분이다. spec 6파일(`4-execution-engine.md` 등)이
    `CONTAINER_*` 를 여전히 "코드" 로 서술하는 것도 같은 등재분에 이미 반영돼 있다(실측:
    `grep -rn "CONTAINER_MISSING_EMIT\|CONTAINER_MULTIPLE_EMIT" spec/` → 6개 파일, 등재 목록과
    1:1 일치).
  - 제안: 조치 불요 — 이미 planner 트래커에 정확히 등재됨.

- **[INFO]** (라운드 1~7 재검증 유지) 가이드 문구 정정(`logic.mdx`/`logic.en.mdx`)은 과거 결정
  번복이 아니라 `#1330`(`ce454e046`) 선례의 두 번째 적용
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx`/`logic.en.mdx`
  - 과거 결정 출처: `#1330` 이 `MAKESHOP_UNRESOLVED_PATH_PARAM` 에 대해 같은 갈림에서 "(A) 문장
    정정" 을 택한 선례(plan §D 인용, `logic.mdx` diff 문형과 대조해 동일 패턴 확인:
    "전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요")
  - 상세: "(B) 엔진이 전용 코드를 방출하도록 바꾸는" 동작 변경안은 스스로 배제하고 트래커
    항목으로 남겼다(§D 명시) — 새 Rationale 없이 결정을 뒤집은 것이 아니라 기존에 확립된
    분기 기준(가이드는 *현재 동작*을 서술)을 그대로 재적용한 것이다.
  - 제안: 조치 불요.

## 요약

이번 라운드(8)의 diff 는 라운드 7 리뷰가 이미 NONE 으로 판정한 코드와 사실상 동일하며, 유일한
증분(`53d29a6f4`)은 (1) 기존 뮤테이션 가드의 분기 커버리지 보강, (2) 착지하지 않던 SoT 인용을
사실대로 정정한 것뿐이다. `spec/conventions/`(및 `spec/` 전체)에는 이 배치가 손댄 파일이 0개이고,
코드 쪽에서 발견된 spec 비일관성(`CONTAINER_*` 를 "코드" 로 서술하는 spec 6파일, `3-error-handling.md
§1.4` 카탈로그 앵커 정책의 모호성)은 모두 developer 권한을 넘지 않고 planner 트래커에 양방향
역참조와 함께 정확히 등재됐다. `GUIDE_NON_EMITTED_VOCABULARY` 판별 로직은 `chat-channel-adapter.md
R-CCA-9`(런타임 message-parsing 금지)와 어휘만 겹칠 뿐 층이 다른 정적 문서-검증이라 원본 재확인
결과 충돌이 아니며, 두 예외 목록을 분리 유지하는 설계는 오히려 `user-guide-evidence.md §Rationale
R-2`("두 가드는 보완 관계, 통합하지 않음")의 기존 원칙을 새 축에 그대로 적용한 것이다. 기각된
대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 관측되지 않았다.

## 위험도
NONE
