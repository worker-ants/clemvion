# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- prompt 번들의 `## 구현 변경 사항` diff 는 예산에 잘려 비어 있었다. 지시에 따라
  워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
  절대경로로 직접 열어 실측했다.
- 실측 결과: `spec/conventions/**` 델타는 **0개 파일** — 이 브랜치는 spec 을 건드리지 않는다(정상, CRITICAL 근거 아님).
  코드 diff 는 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(+237)·
  `guide-identifier-existence.test.ts`(+451), `codebase/frontend/src/content/docs/02-nodes/logic{,.en}.mdx`(문구 정정),
  `CHANGELOG.md`/`PROJECT.md`, `plan/in-progress/error-code-emission-axis.md`(신규 594줄),
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 갱신)뿐이다. `codebase/backend/**` 변경은 0건.

## 발견사항

- **[WARNING] `guide-identifier-existence.test.ts` 의 SoT 인용이 실제로 착지하지 않는다**
  - target 위치: `PROJECT.md` §"developer workflow 자가 점검" 목록의 `guide-identifier-existence.test.ts` 항목 마지막 —
    `SoT: spec/conventions/user-guide-evidence.md §2`. 같은 주장이
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 파일 머리말에도
    `SoT: spec/conventions/user-guide-evidence.md (가드 가족) · ...` 로 반복된다.
  - 위반 규약: `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" — 표는
    `impl-anchor-existence.test.ts` · `integrations-coverage.test.ts` · `triggers-coverage.test.ts`
    **3건만** 열거한다. `error-codes.md` §4.2 가 스스로 명문화한 실패 클래스("참조가
    **착지하지 않는** 상태")와 같은 형태다.
  - 상세: `user-guide-evidence.md` 는 `<ImplAnchor>` 컴포넌트 기반 GUI-흐름→코드 anchor 검증
    (완전히 다른 메커니즘)만 다룬다. `guide-identifier-existence.test.ts` 는 가이드 본문의
    UPPER_SNAKE 식별자(에러 코드·env 변수) 문자열이 소스에 존재/방출되는지를 검증하는
    **별개 가드**다. `grep -n "guide-identifier" spec/conventions/user-guide-evidence.md` 는
    0건 — 문서 어디에도 이 가드가 언급되지 않는다. 이번 diff 는 이 가드에 **발행 축**(신규
    함수 5개, exported const 1개)을 상당히 확장하면서도, 이미 어긋나 있던 SoT 인용을
    바로잡지 않아 "인용은 있는데 대상 문서가 그 규칙을 모르는" 간극을 넓혔다. 이 가드
    파일 자신의 헤더 주석은 이미 더 정확한 3중 SoT(`user-guide-evidence.md` · `error-codes.md` ·
    `3-error-handling.md §1`)를 적어 두었으나, `PROJECT.md` 색인 줄은 그 개선을 반영하지 않고
    여전히 단일·부정확한 인용을 유지한다.
  - 제안: `PROJECT.md` 의 해당 줄과 `guide-identifier-scan.ts` 헤더의 "SoT" 표기를
    `error-codes.md`(명명·발행 개념) + `3-error-handling.md §1`(카탈로그)로 정정하거나,
    `user-guide-evidence.md` §2 표에 4번째 가드로 정식 등재한다(단, 이 가드는 성격이 달라
    "가드 가족" 이라 부르는 것 자체가 부정확할 수 있음 — 후자보다 전자가 더 적합해 보인다).
    spec 파일 변경이 필요하면 developer 는 직접 고치지 말고 이 항목을 트래커에 적어 planner
    턴으로 넘길 것 (자기-반증형 소정정 5조건 중 "제품 정의·요구사항·API 계약은 해당 없음"
    조건에 해당하는지도 불확실하므로 안전하게 planner 위임 권장).

- **[INFO] "허용목록 없음" 설계 원칙의 두 번째 부분 번복이 spec/conventions 어디에도 기록되지 않는다**
  - target 위치: `guide-identifier-scan.ts` 신규 `GUIDE_NON_EMITTED_VOCABULARY` 상수 및 그 주석
    ("`#1330` 은 '허용목록 없음' 을 설계 원칙으로 세웠다... 이것이 그 원칙의 **두 번째 부분
    번복**이다").
  - 위반 규약: 직접 위반은 아님 — 해당 "허용목록 없음" 원칙 자체가 `spec/conventions/**`
    어디에도 정식 등재돼 있지 않다(`grep -rn "1330" spec/` 0건). 다만 `audit-actions.md` 의
    Rationale("도메인이 늘수록 산문 규약은 누락·표류하기 쉬워... 단일 conventions 문서로
    통합")이 이 저장소가 스스로 정립한 선례다.
  - 상세: 이번 diff 로 같은 패턴(예외 상황마다 사유를 강제하는 명시적 등록부)이 두 번째로
    반복됐다(`GUIDE_EXTERNAL_VOCABULARY` → `GUIDE_NON_EMITTED_VOCABULARY`). 두 목록 모두
    풍부한 근거를 코드 주석과 `plan/in-progress/error-code-emission-axis.md` 에 남기고 있어
    당장 표류 위험은 낮으나, 이 설계 원칙 자체가 spec/conventions 문서 밖(코드 주석 + plan)
    에만 존재해 향후 "왜 허용목록을 두는가" 를 찾는 사람이 conventions 디렉토리를 뒤져도
    찾을 수 없다.
  - 제안: 지금 당장 조치는 불필요(spec_impact: none 이 명시적이고 plan 이 in-progress
    상태). 다만 이 축이 안정화되면 `error-codes.md` 또는 신규 convention 문서에 "예외
    등록부는 있되 사유를 강제한다" 는 설계 원칙을 Rationale 로 승격하는 편이
    `audit-actions.md` 선례와 일관적이다.

- **[INFO] `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 코드로 서술하는 6개 spec 파일과의
  불일치는 이번 diff 가 만든 것이 아니라 이미 올바르게 트래커에 등재돼 있다**
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목
    "spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다" (`spec/5-system/4-execution-engine.md`
    §3.0 외 5개 파일 명시).
  - 위반 규약: 없음 — 확인 목적의 항목. `error-codes.md` §1(의미 기반 명명)의 정신상
    "코드가 아닌 것을 코드로 서술" 하면 클라이언트 계약 오인을 유발할 수 있는 자리이나,
    developer 는 spec 을 직접 고치지 않고(올바른 권한 경계 — `spec/` read-only) 6개 파일을
    전부 열거해 planner 트래커에 남겼다(`spec_impact:` 리스트에 실재 경로 6개 추가,
    `git -C` 로 실존 확인 완료).
  - 상세/제안: 없음. 참고용 기록 — 이후 세션이 이 항목을 다시 "새로 발견" 하며 중복
    등재하지 않도록 확인만 남긴다.

## 요약

이번 PR 은 `spec/conventions/**` 를 전혀 변경하지 않는 코드/테스트-가드 전용 변경이며(델타
0, 정상), 신규 도입한 식별자(`GUIDE_NON_EMITTED_VOCABULARY`, `collectQuotedLiterals` 등)의
명명은 기존 `GUIDE_EXTERNAL_VOCABULARY` 선례·`error-codes.md` §1 의 `<DOMAIN>_<CONDITION>`
UPPER_SNAKE_CASE 패턴과 일관되고, 새로 정정한 유저 가이드 문구("전용 에러 코드는 없으니
메시지를 보라")는 `error-codes.md` 가 규정하는 "클라이언트는 코드로 분기한다" 는 원칙과
정합적이다. 유일한 실질적 지적은 `guide-identifier-existence.test.ts` 의 SoT 인용이
`user-guide-evidence.md` 로 되어 있으나 그 문서가 실제로는 이 가드를 다루지 않는다는
점(WARNING) — 규약 자체 위반이라기보다 규약 참조의 착지 실패이며, 이 저장소가 반복해서
경계해 온 결함 클래스와 같은 형태다. 그 외 항목은 이미 적절히 트래커에 위임됐거나
당장 조치가 불필요한 INFO 수준이다.

## 위험도

LOW
