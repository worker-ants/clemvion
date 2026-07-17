# Rationale 연속성 Check — `plan/in-progress/spec-draft-frontend-layering.md` + `spec/conventions/frontend-layering.md`

## 조사 방법

- target plan(`plan/in-progress/spec-draft-frontend-layering.md`)과 실제로 워크트리에 작성된
  `spec/conventions/frontend-layering.md`(신설 문서, `## Rationale` 포함)를 함께 실측 대조.
- `spec/` 전역에서 frontend 디렉터리 의존 방향(레이어링)을 다루는 기존 `## Rationale`을 검색 —
  직전 세션(19_44_52)의 결론(신설 영역, 직접 충돌 후보 없음)을 재확인. prompt_file 첨부의 방대한
  `0-overview.md`·`1-data-model.md`·`2-navigation/*.md` Rationale 발췌는 전부 백엔드/제품 도메인
  결정이며 frontend 디렉터리 레이어링과 무관 — 재확인 결과도 동일.
- 직전 세션(19_44_52) `rationale_continuity.md`의 WARNING(D2 "순환 방지" 근거 vs 실제 구현 위임
  범위 불일치)을 이번 target에 재적용해, plan 레벨 수정 여부 + 실제 spec 본문(§1/§2/§4)의 정합
  여부를 별도로 검증.
- `codebase/frontend/eslint.config.mjs`(main `e370d1d02`, PR #969 반영본) 실물을 읽어 `no-restricted-imports`의
  `group`이 `@/components` 계열만 포함하고 `@/lib` 계열은 없음을 확인.
- `git diff origin/main -- spec/0-overview.md`로 §4 표 등재 1줄 diff만 있음을 확인 (범위 외 변경 없음).

## 발견사항

- **[WARNING]** §1 계층 표가 선언하는 전칭 invariant(모든 계층의 "위로 의존: 금지")와 §2/§4가 실제로
  강제(예정)하는 범위(`{lib, types} → components` 단일 pair)가 어긋나며, 그 gap을 명시하는 Rationale이
  `types → lib` 페어에 대해서만 빠져 있음
  - target 위치: `spec/conventions/frontend-layering.md` §1 "계층 정의" 표(`types` 행 "위로 의존: 금지") vs
    §2 "금지 방향"(`` `src/lib/**` 과 `src/types/**` 은 `@/components/**` 를 import 할 수 없다 `` — `@/lib`
    타겟은 언급 없음) vs §4 "CI 강제"(현재도, Phase 2 이후도 group에 `@/components`만 존재) 및
    `plan/in-progress/spec-draft-frontend-layering.md` Phase 3("§4의 단서 블록 제거")
  - 과거 결정 출처: 직전 세션(19_44_52) `rationale_continuity.md` WARNING — "D2의 Why가 주장하는 순환
    방지 범위(`types ↛ lib` 포함)와 구현 위임이 실제로 강제하는 범위(`types ↛ components`만)가
    어긋난다"는 지적. 동일 문서 내부에서는 §1 자체와 §2/§4 사이의 self-consistency 문제.
  - 상세: §1 서두("의존은 위에서 아래로만 흐른다")와 표는 `types` 행에 "위로 의존: 금지"를 명시한다 —
    `types` 위에는 `lib`·`components`·`app` 이 모두 있으므로 문면 그대로 읽으면 `types → lib`도
    금지 대상이다. 그러나 §2의 실제 "금지 방향" 문장은 `@/components/**` 타겟만 명시하고
    `types → lib`는 다루지 않는다. `eslint.config.mjs`를 확인한 결과 `no-restricted-imports`의
    `group`은 `"@/components"`/`"@/components/**"`/상대경로 우회형만 포함하고 `@/lib` 계열 항목이
    없다 — Phase 2가 `files`를 `["src/lib/**", "src/types/**"]`로 넓혀도 `group`을 손대지 않는 한
    `types → lib`는 영구히 무가드다. 직전 세션 WARNING이 지적한 문제는 **plan D2 문구 레벨**에서는
    수정됐다(현재 D2는 "types → components 역전은 lib → components보다 엄격히 더 나쁘다"로
    `→ components`에만 스코프를 좁혀 서술 — "여기서 위를 참조하면 순환이 된다" 류의 과잉 claim은
    삭제됨). 하지만 그 수정이 **실제로 작성된 spec 본문**에는 역전파되지 않았다 — §1 표는 여전히
    "전 계층 위로 의존 금지"라는 전칭 문구를 그대로 유지한 채, §2/§4가 그중 한 pair만 구현하는
    비대칭이 spec 자체에 남아 있다. `app` 경계 제외는 "왜 `app` 경계는 가드하지 않나" Rationale이
    명시적으로 정당화하고(§1 표에는 명시하되 CI는 `lib`·`types → components`에만 건다는 문장까지
    있음), 이 원칙을 두 번(§2 하단, §4.1 근처 "왜 규칙 2종 조합인가")에 걸쳐 "경계가 1쌍"이라고
    재확인한다 — 그런데 그 "1쌍"이 왜 `types → lib`가 아니라 `types → components`인지, 즉 §1의
    전칭 선언 중 `types → lib` sub-case가 왜 가드 스코프 밖인지에 대한 대칭적 Rationale은 없다.
    오히려 "왜 `src/types/**`도 규약 범위에 넣었나" 절의 논거("`types`의 0은 우연이라 언제든 깨진다"
    — `app`의 구조적 0과 대비)는 `types → lib` 방향에도 그대로 적용 가능한 논리인데, 그 결론이
    `→ components`에만 적용되고 `→ lib`에는 적용되지 않는 이유가 문서에 없다. 더해 plan Phase 3는
    "§4의 '현재 CI 커버리지는 `files: ["src/lib/**"]` 뿐' 단서 블록 제거"를 지시하는데, 이 블록은
    `files` glob 누락(types 자체가 대상 밖)만 알리는 문구라 삭제돼도 무방하지만, **그 삭제로 인해
    "CI가 `files`에 types를 포함시킨 뒤에도 `types → lib`는 group 미포함으로 여전히 무가드"**라는
    사실을 알리는 유일한 텍스트가 사라지지는 않는다(§4.1 근처 "경계가 1쌍" 문구는 유지) — 다만 그
    잔존 문구도 "경계가 1쌍"이라는 설계 선택 서술일 뿐, §1의 전칭 invariant와의 gap을 명시적으로
    "이것은 알려진/의도된 축소"라고 선언하지 않는다는 점은 Phase 3 이후에도 그대로 남는다.
  - 제안: 다음 중 하나로 §1과 §2/§4 사이의 선언 범위 vs 강제 범위를 명시적으로 일치시킨다.
    (1) §1 표의 `types` 행 "위로 의존: 금지" 옆에 각주를 달아 "CI가 강제하는 것은 `→ components`
    방향뿐이며 `types → lib`는 관측 압력이 없어(0건) 별도 결정 사안으로 남긴다"는 문장을 §2 또는
    Rationale에 `app` 경계와 대칭되는 위치("왜 `types → lib`는 가드하지 않나")로 추가한다.
    (2) 또는 §1의 "위로 의존" 열 의미를 "이 규약이 CI로 강제하는 범위에 한정"으로 좁혀 재정의하고,
    설계 의도(전 계층 top-down)는 §1 서두 문장 한 줄로만 원칙 선언, 표는 실제 강제 범위만 표기하도록
    분리한다. 어느 쪽을 택하든 Phase 3에서 §4 단서 블록을 삭제할 때 이 gap을 알리는 문장이 최소
    한 곳(§1 근접 또는 §2)에는 영구히 남도록 plan Phase 3 지시에 한 줄을 추가할 것을 권한다.

- **[INFO]** 직전 세션 WARNING의 plan 레벨 조치는 확인됨 — 참고용 positive 기록
  - target 위치: `plan/in-progress/spec-draft-frontend-layering.md` D2
  - 과거 결정 출처: 직전 세션(19_44_52) `rationale_continuity.md` WARNING 본문.
  - 상세: 직전 WARNING이 인용한 D2의 옛 문구("`src/types`는 `lib`·`components`가 함께 소비하는
    최하위 leaf라 레이어 순서상 가장 아래다 — 여기서 위를 참조하면 순환이 된다")는 현재 target에서
    "`types → components` 역전은 `lib → components`보다 엄격히 더 나쁘다"로 교체돼, `→ lib` 방향에
    대한 과잉 주장이 제거됐다. plan 자체는 이제 스스로 정확한 스코프만 주장한다. 다만 위 WARNING이
    지적하듯 이 정정이 실제 spec 본문 §1의 표 문구까지는 미치지 못했다.
  - 제안: (조치 불요, 기록용) 위 WARNING의 제안이 반영되면 이 항목은 자동 해소된다.

- **[INFO]** 직전 세션 INFO(D2/D3 "관측 압력에 비례" 원칙의 비대칭)는 실제 spec Rationale에서 명시적으로
  해소됨
  - target 위치: `spec/conventions/frontend-layering.md` Rationale "왜 `app` 경계는 가드하지 않나" —
    "`src/types`와 `app`은 둘 다 '현재 위반 0건'이지만 결론이 갈리는 이유는 0의 성격이 다르기
    때문이다 ... `types`의 0은 우연이라 언제든 깨질 수 있는 반면 ... `app`의 0은 구조적이다."
  - 과거 결정 출처: 직전 세션(19_44_52) `rationale_continuity.md` INFO — "D3가 D2의 논리('위반
    0건도 회귀 차단 가치가 있다')를 `app`에는 대칭 적용하지 않아 톤 불일치가 있다"는 지적.
  - 상세: 최종 spec은 이 비대칭을 별도 문단으로 정면 대응해 두 결정 사이의 논리적 긴장을 해소했다 —
    "우연한 0"과 "구조적 0"을 구분하는 명시적 기준을 제시. Rationale 연속성 관점에서 모범적인
    보완이다.
  - 제안: 없음 (참고 기록).

## 요약

target(`plan/in-progress/spec-draft-frontend-layering.md` + 실제 작성된
`spec/conventions/frontend-layering.md`)은 frontend 디렉터리 레이어링을 다루는 최초의 spec
Rationale이라, 기존 spec의 `## Rationale`에서 명시적으로 기각된 대안을 재도입하거나 외부 합의
원칙을 위반하는 CRITICAL 유형의 충돌은 없다. 직전 세션(19_44_52)이 지적한 두 항목 중 하나
(D3/D2의 "관측 압력에 비례" 원칙 비대칭, INFO)는 최종 spec의 별도 Rationale 문단으로 명시적으로
해소됐고, 나머지 하나(D2 "순환 방지" claim의 과잉 스코프, WARNING)는 plan D2 문구 레벨에서는
정확히 수정됐다. 다만 그 수정이 실제 spec 본문에는 완전히 반영되지 않아, §1 계층 표가 선언하는
전칭 top-down invariant와 §2/§4가 실제로 (그리고 Phase 2 완료 이후에도 영구히) 강제하는
`{lib,types} → components` 단일 pair 사이의 gap — 특히 `types → lib` sub-case — 이 `app` 경계
제외처럼 명시적 대칭 Rationale 없이 spec에 남아 있다. 이는 "규약이 선언하는 범위"와 "가드가
강제하는 범위"를 구분해 서술하라는 이번 검토 요청의 핵심 관점에서 유일하지만 실질적인 gap이며,
Phase 3가 계획한 §4 단서 블록 삭제와 맞물리면 향후 spec만 읽는 독자에게 "전 계층이 CI로
강제된다"는 과신을 줄 위험이 있다. 현재 관측 위반이 0건이라는 점에서 즉시 차단 사유는 아니다.

## 위험도

LOW
