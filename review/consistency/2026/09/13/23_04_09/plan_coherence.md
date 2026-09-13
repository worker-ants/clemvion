# Plan 정합성 검토 — error-code-emission-axis (round 10 대상)

## 검토 방법

target scope(`spec/conventions/`)의 실제 델타는 0이다 — 이 브랜치는 spec/conventions 를 건드리지 않는다. 실질 diff 는 `codebase/frontend` 의 guide-identifier 가드 2파일 + `docs/02-nodes/logic{,.en}.mdx` 문구 정정 + `plan/in-progress/error-code-emission-axis.md`(신규) + `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커, 141줄 변경)다. 따라서 이번 검토는 프롬프트 번들의 절단된 `spec/conventions/*.md` 대신 **워킹트리 절대경로**로 두 plan 파일과 실제 가드 코드(`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 등)를 직접 읽어 대조했다.

이 배치는 이미 9라운드를 거쳤고 매 라운드 `plan_coherence` checker 가 별도로 돌았다(`18_40_54`~`22_38_43`). 아래는 그 9라운드가 아직 못 잡은 것만 보고한다.

## 발견사항

- **[WARNING]** 라운드 9 "전수 판정"이 실제로는 전수가 아니었다 — `error-code-emission-axis.md` 자기 자신 안에 스테일 줄번호 인용이 2건 더 있다
  - target 위치: `plan/in-progress/error-code-emission-axis.md:188` (`동작 변경 + spec 이라 별 배치이고, 트래커 3404 가 그 갈림을 이미 적어 두었다.`), 같은 파일 `:404-405` (`그 항목(3394)이 미체크였다`, `자매(3404)는 닫았는데`)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — `CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT` 항목(현재 `:3459`, `origin/main` 기준 `:3404`), `가이드 에러 코드 가드가 "존재"만 보고 "방출"을 안 본다` 항목(현재 `:3422`, `origin/main` 기준 `:3386`)
  - 상세: 이 plan 의 §M(라운드 9)은 *"내가 편집하는 파일을 줄 번호로 인용하지 마라"* 규칙 위반을 **클래스로 전수 판정했다**고 적으며 "브랜치 편집 파일 8개에서 «편집 대상을 줄 번호로 가리키는» 인용 5건"을 표로 나열하고 각각 처분했다(`scan.ts→:3407`, `§L→scan.ts:77`, `트래커→PROJECT.md:40-41`, `트래커→PROJECT.md:315`, `§A→PROJECT.md:300`). 그런데 이 표는 `파일:줄` 콜론 형식만 훑었고, **콜론 없는 괄호/나열 형식**(`트래커 3404`, `(3404)`, `그 항목(3394)`)은 같은 파일(`error-code-emission-axis.md` 자신, 즉 "편집 파일 8개"에 포함된 그 파일)에 남아 있는데도 표에 안 잡혔다. 실측: `origin/main` 기준 `CONTAINER_MISSING_EMIT` 항목은 정확히 `:3404`였다(`git show origin/main:plan/in-progress/spec-draft-nullable-notation-followups.md | grep -n` 로 확인) — 이 PR 이 그 파일 위쪽(§1 카탈로그 항목 보강·spec_impact 5파일 추가 등, 총 141줄 순증)을 편집하면서 그 항목은 지금 `:3459`로 밀렸고, **현재 `:3404` 자리에는 완전히 다른 항목**("가이드 에러 코드 가드가 한 방향만 본다"의 "선실측할 것" 문단)이 와 있다. `:188`의 인용은 현재 서술("트래커 3404 가 그 갈림을 이미 적어 두었다")대로 그 줄을 열면 엉뚱한 항목을 가리키는 **거짓 위치 정보**가 된다. `:404-405`는 라운드 1/5 시점을 과거형으로 서술하는 이력 문장이라 당시엔 정확했을 수 있지만(중간 편집 시점의 줄번호), 현재 시점 독자에게는 마찬가지로 오도한다.
  - 제안: `plan/in-progress/error-code-emission-axis.md` 를 이 라운드(10)에서 마저 편집한다면, `:188`의 `트래커 3404` 를 라운드 9가 다른 5건에 쓴 것과 같은 **앵커 문구**로 바꾼다 — 예: `` `CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT` 도 방출 코드가 아니다 `` 항목. `:404-405`의 `(3394)`/`(3404)`는 과거 라운드 서술이므로 굳이 고치지 않아도 되지만, 고친다면 마찬가지로 앵커 문구가 안전하다. 라운드 9의 "전수 판정" 서술 자체도 "콜론 형식 5건"으로 스코프를 좁혀 적었어야 정확하다 — 지금은 실제보다 넓게 "전수"를 주장하고 있다.

## 요약

이 배치가 닫으려는 트래커 항목(가이드 발행 축 CRITICAL)과 그 처분(카탈로그를 탈출구로 쓰는 술어, `GUIDE_NON_EMITTED_VOCABULARY` 2건 등록, `CONTAINER_*` 문장 정정)은 인접 미해결 결정(§1.4 backfill 택일, spec 6파일 정정)을 선점하지 않고 양방향 forward-note 로 정확히 위임했으며, `spec_impact` 6파일도 이번 라운드에 전수로 채워져 있다 — 세 검토 관점(미해결 결정 충돌 / 선행 plan 미해소 / 후속 항목 누락) 중 핵심 결정 축에서는 새 결함이 없다. 유일한 잔여는 라운드 9가 "전수 판정했다"고 자평한 줄번호-인용 정리 작업이 콜론 형식만 훑어 같은 파일 안의 괄호형 인용 2곳을 놓친 것으로, plan 자신의 완결성 주장을 좁게 만드는 사소하지만 정정 가치가 있는 흠이다.

## 위험도
LOW
