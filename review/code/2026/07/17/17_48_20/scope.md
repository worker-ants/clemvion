# 변경 범위(Scope) 리뷰 — webchat-boot-single-flight

세션: `review/code/2026/07/17/17_48_20` · 브랜치 `claude/webchat-boot-single-flight-8c92b4`
(HEAD `215cd1c3f`) · plan `plan/in-progress/webchat-boot-single-flight.md`

## 검증 방법

`_prompts/scope.md` 가 제시한 diff 를 그대로 신뢰하지 않고, orchestrator 의 사전 경고("직전
라운드에서 페이로드 오염을 지적했고 rebase 로 해결했다")를 실측으로 재검증했다.

```
git fetch origin main
git merge-base origin/main HEAD      → 14bc86a53 (동일, fetch 전후 불변)
git rev-parse origin/main            → 67871ffbd
git log --oneline 14bc86a53..origin/main
  → 67871ffbd fix(harness): report-path 규칙을 공유 모듈로 — … (#966)
git diff origin/main..HEAD --stat    → 37 files (2-dot)
git diff origin/main...HEAD --stat   → 6 files, 596(+)/30(-)  (3-dot, merge-base 기준)
git log --format='%ci %h %s' 14bc86a53..HEAD  → 4 commits, 전부 17:46:17
```

## 발견사항

- **[CRITICAL]** 리뷰 페이로드 재오염 — 직전 라운드(`17_36_57`)에서 지적된 것과 **동일 클래스의
  결함이 재발**했다. `_prompts/scope.md` 의 37개 파일 중 31개(파일 1~12, 17~21, 23 이하)는 이
  브랜치의 커밋이 아니라 **branch 분기 후 origin/main 에 추가로 병합된 커밋**이다.
  - 위치: `_prompts/scope.md` 전체 및 **이 세션의 다른 14개 reviewer prompt 전부**
    (`_router.md`, `api_contract.md`, `architecture.md`, `concurrency.md`, `database.md`,
    `dependency.md`, `documentation.md`, `maintainability.md`, `performance.md`,
    `requirement.md`, `security.md`, `side_effect.md`, `testing.md`, `user_guide_sync.md` —
    전원 `### 파일 ` 헤더 37개로 동일), 그리고 세션 자체의 `meta.json`(`"files"` 배열이 37개 항목).
  - 상세: 타임라인 실측 — 이 브랜치의 merge-base(`14bc86a53`, `#965`)는 16:52:37 커밋. 이 브랜치의
    4개 커밋은 전부 17:46:17 에 만들어졌다(같은 base 기준). 그런데 그 **1분 뒤인 17:47:29**,
    origin/main 에 `#966 "fix(harness): report-path 규칙을 공유 모듈로 — …"` 가 추가로 병합됐다 —
    공교롭게도 `.claude/_shared/report_paths.py` 신설 + `review_guard.py`/`code_review_
    orchestrator.py`/`consistency_orchestrator.py` 공유화 + `plan/complete/harness-report-
    contract-followups.md` 완료 처리 + sidebar 테스트 리팩터(#958 W#4) + 구세션(`15_48_02`)
    정리를 담은 커밋이다. 세션 생성 시각 17:48:20 은 그 1분 뒤라, `origin/main..HEAD`(2-dot) 비교가
    이 새 커밋을 "HEAD 에서 삭제됨"으로 오인해 diff 에 끌어들였다. `origin/main...HEAD`(3-dot,
    merge-base 기준)로 비교하면 정확히 **6개 파일, 4개 커밋**만 남는다 — orchestrator 가 사용자에게
    보고한 "2-dot = 3-dot = 6파일" 은 **그 검증 시점엔 참이었을 수 있으나 지금은 거짓**이다. 즉
    "rebase 로 해결했다" 는 조치 자체는 유효했지만, 그 직후 원본이 다시 앞서가면서 같은 종류의
    경합이 재현된 것 — 근본 원인은 페이로드 생성이 **고정된 merge-base 가 아니라 매 순간 움직이는
    `origin/main` ref** 를 기준으로 diff 를 재계산하는 방식에 있다. 더 심각한 점은 이 오염이
    `meta.json`(router 의 `auto` 모드 에이전트 선정 입력)에도 그대로 들어가 있어, 실제로 14개
    에이전트가 fan-out 됐고(`database`, `dependency`, `api_contract`, `concurrency`, `performance`,
    `architecture` 포함) `agents_forced` 7개가 확정됐다는 것이다 — 순수 `channel-web-chat` 프론트엔드
    diff 6파일이라면 이 조합(특히 database/dependency/api_contract)이 선택될 근거가 희박하다.
    즉 오염이 **리뷰 결과 표시 문제를 넘어 라우팅 의사결정 자체**를 왜곡했을 가능성이 높다.
  - 제안: (1) 이 세션(`17_48_20`) 전체를 폐기하고, **고정된 merge-base**(`git merge-base origin/main
    HEAD` 를 세션 생성 시점 1회만 계산해 캐시)를 기준으로 `git diff <base>...HEAD` (3-dot) 로 재생성할
    것. (2) 페이로드 생성 스크립트가 2-dot(`A..B`)을 쓰고 있다면 항상 3-dot(`A...B`)으로 교체 —
    "브랜치 분기 이후 내 커밋만" 이 3-dot 의 정의 그 자체이므로 이런 경합에 원리적으로 면역이다.
    (3) 재생성 전엔 이번 라운드의 어떤 reviewer 산출물도(본 파일 포함) 라우팅·차단 판정의 근거로
    쓰지 말 것 — 아래 발견사항은 내가 `git`으로 직접 재구성한 **참 diff**(merge-base `14bc86a53`,
    6파일, 4커밋)를 기준으로 작성했다.

- **[INFO]** A-6(`RESTORED`/`BOOTED` 리듀서의 `ended` 가드 확대) — 범위 내.
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` (RESTORED/BOOTED 케이스),
    `widget-state.test.ts`(`it.each` 2케이스), `use-widget-eager-start.test.ts`(통합 회귀 1건),
    커밋 `215cd1c3f`.
  - 상세: plan 본문이 착수 시점에 이미 "A-6. `RESTORED`/`BOOTED` 가드 확대 트리거 재점검 — A 가
    겹침을 없애 판단 기준이 달라질 수 있으니 **구현 후 재점검**하고 결론을 plan 에 기록" 을 정식
    체크리스트 항목으로 못박아 뒀다(즉 "이 김에" 가 아니라 사전 예고된 후속 점검). 재점검 결과
    실패 사례(`ERROR` 종료 후 세션이 `teardownSession` 을 안 거쳐 잔존 → `wc:boot` 재전송 시
    `RESTORED` 가 `ended → streaming` 으로 부활)를 실측 재현했고, 조치는 이미 `WAITING` 에어
    적용돼 있던 동일 패턴(`08_29_33` W4)을 대칭 확대하는 최소 diff(가드 2줄 × 2케이스)다. 별도
    커밋(`215cd1c3f`)으로 분리돼 있어 "fix(사용자 가시)" 로 명확히 라벨링됨.
  - 제안: 없음 — 계획대로 실행된 범위.

- **[INFO]** `applyConfig` world 축 회귀 테스트 신설 — 이 diff 가 만들지 않은 **기존 갭**을 닫음.
  경계선상이나 정당화됨.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 신규 테스트
    `"embed-config 왕복 중 언마운트 → 지연 응답이 세션·SSE 를 되살리지 않는다"`(커밋 `68ff69ba7`,
    +28줄, 프로덕션 코드 변경 없음).
  - 상세: plan·커밋 메시지 모두 "`applyConfig` 의 world 가드는 `origin/main` 코드에서도(=이 PR
    변경 전) 제거 시 44/44 전부 통과 — 한 번도 고정된 적 없던 기존 갭. 내 변경이 만든 게 아니지만
    mutation 매트릭스가 드러냈으므로 닫았다" 고 명시적으로 자인한다. plan §A-5 "mutation 검증"이
    요구한 검증 배터리(비대칭 케이스 전수 확인)를 이 PR 이 새로 도입한 `isAttemptStale` predicate
    에 실제로 돌리는 과정에서 발견됐고, 그 predicate 의 world 축은 정확히 이 PR 이 `isStale(gen)`
    을 대체한 자리다 — 즉 "무관한 영역" 이 아니라 **이 PR 이 만진 바로 그 코드**를 검증하는
    테스트다. 순수 테스트 추가(프로덕션 로직 불변)이고 커밋 메시지에 축약 없이 근거가 남아있어
    투명성 기준은 충족한다. 다만 엄밀히는 plan 제목("A+B")이 약속한 범위를 살짝 넘는 추가이므로
    WARNING 대신 INFO 로 두되 기록한다 — 이 파일이 비대칭 가드 누락으로 3번 CRITICAL 을 낸 전력을
    고려하면 "발견 즉시 같은 PR 에서 닫는다"는 판단이 오히려 이 코드베이스의 방어적 관례와
    부합한다.
  - 제안: 향후 유사 상황에서는 커밋 **subject** 에도(현재는 body 에만) "+ 기존 world-axis 커버리지
    갭" 같은 1구 언급을 더하면 `git log --oneline` 만으로도 범위 확장 여부를 바로 알 수 있다
    (현재도 body·plan 문서로는 충분히 추적 가능하므로 필수는 아님).

- **[INFO]** 기존 회귀 테스트 2건의 기대값 변경 — A 의 논리적 필연, 범위 내.
  - 위치: `use-widget-eager-start.test.ts` 내 기존 테스트 2건(겹친 부팅 결과가 갈릴 때 / 나중
    진입이 차단으로 먼저 끝날 때), 커밋 `68ff69ba7`.
  - 상세: plan 이 구현 착수 **전에** "핵심 발견 — A 는 기존 회귀 테스트 2건의 기대값을 바꾼다" 절을
    두어 이 변경을 예고했고, 동시에 "테스트가 깨졌다고 테스트를 고치는 것은 이 파일에서 정확히
    사고를 냈던 패턴" 이라며 안티패턴을 명시적으로 경계, 계약 문서(JSDoc) 선행 갱신을 조건으로
    걸었다(A-1 → A-3 순서). 실제 diff 는 두 테스트를 **서로 다른 이유**로 구분해 수정한다 — 하나는
    최종 단언이 아니라 전제(`phase === "blocked"`)가 깨진 것이라 전제를 뒤집었고, 다른 하나는
    의미가 실제로 바뀌어 `hookPosts` 기대값을 낮추되 **"소실이 아니라 다음 성공 부팅으로 이월"**
    임을 후속 boot 을 추가해 명시적으로 단언한다(단순히 `0` 으로 낮추기만 하면 소실과 구분 안 됨을
    스스로 경계). 사전 계약화 → 사후 구현이라는 순서와 "왜 바뀌는지" 를 각 hunk 에 남긴 방식 모두
    이 항목이 요구하는 "임의 수정이 아님" 기준을 충족한다.
  - 제안: 없음.

- **[INFO]** spec `2-sdk.md` `code:` 프런트매터 보강 — plan 명시 항목, A-6 fix 커밋에 번들.
  - 위치: `spec/7-channel-web-chat/2-sdk.md` (+4줄), 커밋 `215cd1c3f`.
  - 상세: plan 체크리스트에 "spec `code:` frontmatter 확인 — `2-sdk.md` 가 이 동작의 구현 파일을
    가리키는지. 갱신 필요 시 포함" 이 명시돼 있어 범위 내다. 다만 A-6 버그 fix 와 같은 커밋에
    묶였다 — 커밋 메시지 자체가 "곁들여 spec 2-sdk.md code: 증거 보강" 이라고 스스로 부수적임을
    라벨링해 은폐는 아니다. 순수 문서(주석 포함 4줄) 추가라 리스크는 사실상 0.
  - 제안: 없음 — 원하면 차후 관례로 "버그 fix"와 "spec 메타데이터 정합화"를 커밋 단위로 더 쪼갤 수
    있으나 이번 규모에서는 실익이 낮다.

## 요약

**참 diff**(merge-base `14bc86a53` 기준 3-dot, 6파일·4커밋·596(+)/30(-))로 재구성해 판단하면, 이
브랜치의 실제 작업은 plan(`webchat-boot-single-flight.md`)이 정한 범위 A(§106 single-flight)·B(동기
구간 불변식)와 그 자연스러운 부산물(A-6 재점검, 기존 회귀 테스트 2건 기대값 정제, spec `code:`
보강, mutation 검증 중 드러난 world 축 커버리지 갭 봉합)에 정확히 대응한다 — 4가지 질의 항목 전부
plan 문서가 사전에 명시했거나(A-6, 기존 테스트 변경, spec code:) 이 PR 이 새로 만든 코드 경로를
검증하는 과정에서 투명하게 발견·기록됐다(world 축 테스트). "이 김에" 끼워 넣은 무관한 리팩터링·
포맷팅·임포트 정리·주석 잡음은 발견되지 않았다. 다만 이번 세션에 전달된 **페이로드 자체는 신뢰할 수
없다** — orchestrator 가 "오염 없음" 이라 보고한 것과 달리 실측하면 origin/main 이 세션 생성
1분여 전에 무관 커밋(#966)을 하나 더 흡수해 2-dot 비교가 다시 오염됐고, 이는 `scope.md` 뿐 아니라
이 세션의 15개 reviewer prompt 전부와 라우팅 입력(`meta.json`)에 공통으로 박혀 있어 14개 에이전트
fan-out(그중 `database`/`dependency`/`api_contract` 등은 순수 프론트엔드 diff 라면 선택 근거가
약함) 자체가 왜곡됐을 가능성이 있다. 코드 변경 자체의 범위 판정과, 이번 세션 산출물의 신뢰도는
별개 축으로 봐야 한다.

## 위험도

CRITICAL

(사유: 코드 자체 — 참 diff 4커밋 6파일 — 만 놓고 보면 범위 이탈 없음, LOW 도 과할 정도로 clean.
그러나 이 세션에 전달된 페이로드가 라우팅 입력까지 포함해 재오염돼 있어, 세션을 고정
merge-base 기준으로 재생성하고 이번 라운드의 다른 reviewer 산출물도 함께 재검증하기 전까지는
"즉시 차단·재작업 필요" 급으로 다뤄야 한다는 판단에서 전체 등급을 CRITICAL 로 표기한다.)
