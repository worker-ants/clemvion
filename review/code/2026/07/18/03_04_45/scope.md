# 변경 범위(Scope) 검토 — webchat-boot-single-flight (03_04_45)

## 페이로드 청결 확인 (직접 실행)

```
$ git merge-base origin/main HEAD
29aa918a653a0efb5f792dc7e105c0887f03ef25
$ git rev-parse origin/main
29aa918a653a0efb5f792dc7e105c0887f03ef25

$ git diff --name-only $(git merge-base origin/main HEAD)..HEAD | wc -l
77
$ git diff --name-only origin/main..HEAD | wc -l
77
$ diff <(git diff --name-only $(git merge-base origin/main HEAD)..HEAD) \
       <(git diff --name-only origin/main..HEAD)
(출력 없음) → IDENTICAL
```

두 명령의 파일 목록이 **77개로 완전히 동일**하고, `merge-base(origin/main, HEAD)` 가 `origin/main` 자체
(`29aa918a6`)와 같다. 브랜치 분기 이후 `origin/main` 이 전진하지 않았고 3-dot/2-dot 대조 오염이 없다 —
호출자가 예상한 수치(77파일, merge-base=origin/main=29aa918a6)와 정확히 일치.

## 페이로드 대표성 — 한계 재확인 (WARNING, 신규 아님·이미 이월 처리됨)

`_prompts/scope.md`(2617줄)에 실제 포함된 파일은 27개뿐이다(`### 파일 1`~`27`): `review/code/2026/07/18/01_44_21/*`
6개, `review/code/2026/07/18/02_25_54/*` 12개(=`61e07f3ec` 전체), `review/consistency/2026/07/17/19_46_54/*`
7개, `spec/7-channel-web-chat/2-sdk.md` 1개. **이번 라운드가 검증해야 할 실제 대상인 `94b66b212`
(`use-widget.ts`+테스트)·`fb78bfe60`(plan 2개+review SUMMARY 1개)의 diff 는 payload 어디에도 없다.**
`2-sdk.md` 조차 payload 에 실린 4줄 diff(`host-bridge.ts`/`use-widget.ts` 증거 링크)가 실제로는
`7386acb72`(2026-07-17, `01_44_21` 라운드보다도 이전) 커밋분으로,02_25_54 이후 재변경이 아니다 — 즉 이
payload 는 "이번 델타"가 아니라 오래된 스냅샷을 다시 실어 나르고 있다.

이 이슈는 신규 발견이 아니다. `02_25_54/SUMMARY.md`·`RESOLUTION.md` 자신이 이미 "payload 대표성
(scope·security) → 이월(알려진 한계). git 으로 보완." 이라고 기록해 두었고, `01_44_21/scope.md` 도 동일
패턴을 WARNING 으로 남긴 바 있다. 호출자 지시대로 payload 를 신뢰하지 않고 `git show`/`git log`/`git diff`
로 worktree 를 SoT 삼아 아래를 직접 검증했다.

## 초점 직접 검증 — 02_25_54 이후 델타 3개 커밋

```
94b66b212 2026-07-18 02:51:13 test(web-chat): openStream 게이트 2곳을 개별 고정 + start() 누락 dep (02_25_54 WARNING)
fb78bfe60 2026-07-18 02:52:53 docs: 02_25_54 비-코드 WARNING 정합 + 잔여 문서화
61e07f3ec 2026-07-18 03:04:19 docs(review): 02_25_54 SUMMARY + RESOLUTION (코드버그 0, 테스트 커버리지 갭 처리)
```

`262ef8e5b`(01_44_21 RESOLUTION, 02:25:12)~`94b66b212` 사이 `codebase/` 커밋 유무를 확인한 결과
`94b66b212` 이 그 구간의 **유일한** 코드 커밋이다(`git log --oneline 262ef8e5b..94b66b212 -- codebase/`
→ 이 커밋 자신만 출력). 세 커밋 각각의 변경 파일 전수:

| 커밋 | 변경 파일 | 유형 |
| --- | --- | --- |
| `94b66b212` | `use-widget-eager-start.test.ts`(+34/-16), `use-widget.ts`(+1/-1) | 테스트 + 프로덕션 코드 1줄 |
| `fb78bfe60` | `webchat-boot-single-flight.md`, `webchat-usewidget-extraction.md`, `review/code/2026/07/18/00_51_53/SUMMARY.md` | plan 문서 2 + review 문서 1 |
| `61e07f3ec` | `review/code/2026/07/18/02_25_54/{RESOLUTION,SUMMARY,_retry_state.json,concurrency,documentation,maintainability,meta.json,requirement,scope,security,side_effect,testing}.md·json` (12개) | review 산출물만 |

### 1) `94b66b212` — 프로덕션 코드는 정확히 1줄

`use-widget.ts` 전체 diff:

```diff
-  }, [openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale]);
+  }, [openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale, sessionEstablished]);
```

`start()` useCallback 의 의존성 배열에 `sessionEstablished` 1개 심볼을 추가한 것이 전부(+1/-1, 다른 hunk
없음). 함수 본문·로직·주석 어디에도 다른 변경이 없다 — 호출자가 지목한 "start deps 1줄" 진술과 정확히
일치.

`use-widget-eager-start.test.ts` 는 기존 단일 테스트(`두 복원 seed 가 같은 flush 에서 resolve 해도
EventSource 는 하나만 생성된다`)를 파라미터화된 헬퍼 `raceStartVsResendSingleStream(resendResolvesFirst:
boolean)` 로 추출하고, 이를 호출하는 `it` 2개(C 먼저=applyConfig 게이트 검증 / D 먼저=start() 게이트
검증)로 나눈 것이 전부다. 확인한 점:

- 헬퍼는 해당 `describe` 블록 안에 로컬 선언되고 신설된 두 `it` 외 다른 곳에서 참조되지 않는다
  (`grep -n raceStartVsResendSingleStream` → 정의 1곳 + 호출 2곳뿐, 파일 내 다른 위치나 다른 테스트
  파일로 새어나가지 않음).
- 제거된 지역 변수 `latestEs`(`EventSource` mock 생성자에서 대입만 되고 이후 어떤 단언에도 쓰이지 않던
  dead variable)는 추출 리팩토링에 직접 종속된 정리이지 별도 tidy-up 이 아니다.
- 주석 변경은 (a) "두 방향을 모두 고정해야 하는 이유"(비대칭 mutation 이 안 잡히는 이유)를 설명하는
  신규 단락, (b) `C=[0]`/`D=[1]` 인덱스 표기를 파라미터화에 맞춰 보강한 인라인 주석뿐 — 이번 fix 의도
  (비대칭 커버리지 갭 해소)를 직접 서술하는 필수 문서화이지 무관한 주석 손질이 아니다.
- import 라인 변경 0건(`git diff origin/main..HEAD -- use-widget.ts | grep '^[+-]import'` 공백, 전체
  PR 기준).

### 2) `fb78bfe60` — 비-코드, `codebase/` 변경 0건

- `plan/in-progress/webchat-boot-single-flight.md`: "최종 불변식" 절의 반증된 주장("openStream 이 seed
  반환 직후 동기 실행이라 이중 스트림도 원천 차단")을 microtask 경계 설명으로 정정 + "11·12번째 거울상"
  진행 기록과 수용한 잔여 2건(3-way 순간 표면 race, 짝 게이트 구조 강제 부재) 문서화. 전부 이미 코드로
  구현된 내용에 대한 사후 서술 정정·기록이며 새 코드 결정을 이 파일이 발명하지 않는다.
- `plan/in-progress/webchat-usewidget-extraction.md`: 체크리스트 항목 1개 추가("seed 게이트 + openStream
  게이트 짝의 구조적 강제 검토") — frontmatter/본문에 이미 있던 "미착수·기능 변경 없음" 백로그 plan 에
  대한 이연 항목 추가일 뿐, 이번 PR 안에서 실행되지 않는다(체크박스 미체크 상태로 추가).
- `review/code/2026/07/18/00_51_53/SUMMARY.md`: 기존 표의 한 셀을 "✅ 재작성" → "⚠ 미정정"으로 정정 —
  이미 커밋된 과거 리뷰 산출물 자신의 오류를 바로잡는 self-correction. sibling `RESOLUTION.md` 는 이미
  정정된 상태였고 `SUMMARY.md` 만 누락됐던 것을 맞춘 것으로, 확인 결과(아래) 내용도 실제로 정합적이다.

세 파일 모두 `codebase/`·설정 파일·spec 은 건드리지 않는다. 커밋 메시지가 진술한 3가지 항목(반증
정정·SUMMARY 정정·잔여 2건 문서화)과 실제 diff 가 1:1 대응한다 — 진술 밖 추가 서술 없음.

### 3) `61e07f3ec` — review 산출물만

12개 파일 전부 `review/code/2026/07/18/02_25_54/` 하위(RESOLUTION·SUMMARY·8개 리뷰어 산출물·meta.json·
_retry_state.json)로, `code-review-agents` skill 의 지정 쓰기 경로와 정확히 일치한다. `codebase/`·`plan/`·
`spec/` 변경 없음. `RESOLUTION.md`/`SUMMARY.md` 내용을 직접 Read 해 위 표와 대조한 결과 "처리 커밋:
`94b66b212`/`fb78bfe60`" 서술이 실제 git 로그와 정확히 일치함을 확인했다 — 산출물 자체의 진술 정확성도
scope 관점에서 이상 없음.

## 델타 밖 참고 확인 (이번 초점은 아니지만 교차확인)

- `widget-state.ts`/`widget-state.test.ts` 변경(`8b37e8bef`/`c5d08c45d`/`ca92a1b7f`)은 모두
  2026-07-17 17:36~19:19 커밋으로, `02_25_54` 라운드(같은 날 02:25 이후)보다 훨씬 이전이다 — 이번 초점
  ("02_25_54 이후")의 델타에 속하지 않으며 이미 그 이전 라운드들(18_39_11·23_58_23·00_51_53)이 검증했다.
- `spec/7-channel-web-chat/2-sdk.md` 는 `7386acb72`(2026-07-17, `01_44_21` 이전) 이후 재변경이 없다
  (`git log --oneline 262ef8e5b..HEAD -- spec/7-channel-web-chat/2-sdk.md` 공백) — payload 에 실린
  4줄 diff 는 이번 라운드가 새로 만든 변경이 아니라 브랜치 diff 범위 안에 있던 과거 커밋분이 다시
  실린 것이다.

## 설정·임포트 변경 점검

- 이번 3개 커밋(`94b66b212`/`fb78bfe60`/`61e07f3ec`) 범위에 `package.json`/`tsconfig`/`eslint*`/CI
  yml 등 설정 파일 변경 **0건**(`git diff --name-only 262ef8e5b..61e07f3ec | grep -Ei
  'package\.json|tsconfig|eslint|\.ya?ml$'` 공백) — 항목 8(설정 변경) 위반 없음.
- `use-widget.ts` 전체 PR(`origin/main..HEAD`) 기준 import 라인 변경 **0건** — 항목 7(임포트 변경)
  위반 없음.

## 발견사항

- **[WARNING]** scope 리뷰 payload(27개 파일)에 이번 라운드 검증 대상인 실제 코드 델타
  (`94b66b212`/`fb78bfe60`)가 전혀 포함되지 않음 — 신규 이슈 아님, 이미 이월 처리된 한계
  - 위치: `_prompts/scope.md` 전체(2617줄, 파일 1~27)
  - 상세: payload 는 이전 두 라운드(`01_44_21`·`02_25_54`)의 review 산출물 전체와 오래된 `2-sdk.md`
    스냅샷만 담고 있어, "커버리지 갭 fix + dep 1줄" 이라는 이번 초점의 실제 diff 를 payload 만으로는
    검증할 수 없다. 이 한계는 `02_25_54/SUMMARY.md`·`RESOLUTION.md` 가 이미 "payload 대표성
    (scope·security) → 이월(알려진 한계). git 으로 보완." 으로 기록해 둔 것과 동일 패턴이며 developer
    측 scope 위반이 아니라 프롬프트 구성 단계의 반복적 truncation/선별 이슈다. 호출자 지시에 따라
    `git show`/`git log`/`git diff` 로 직접 보완 검증했다(본 문서의 "초점 직접 검증" 절).
  - 제안: 조치 불필요(알려진 한계로 이미 이월됨). 근본 fix 는 payload 생성 로직 쪽 백로그 항목.

- **[INFO]** 프로덕션 코드 변경은 정확히 1줄(`use-widget.ts` `start()` deps 배열에 `sessionEstablished`
  추가) — 호출자 진술과 일치, 반증 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:685`(`useCallback` deps 배열)
  - 상세: `git show 94b66b212 -- use-widget.ts` 전체 diff 가 `+1/-1` 단일 hunk. 함수 본문·다른 로직·
    다른 deps 배열·다른 파일 변경 없음.
  - 조치 불필요.

- **[INFO]** 테스트 리팩토링(헬퍼 추출 + 2방향 파라미터화)이 이번 fix 의도(비대칭 커버리지 갭 해소)에
  정확히 종속 — 무관한 정리·다른 테스트 오염 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3412`
    (`raceStartVsResendSingleStream` 정의), `:3479`·`:3485`(신설 `it` 2개)
  - 상세: 헬퍼는 `describe` 블록 로컬 스코프, 정의 1곳 + 신설 `it` 2곳 외 참조 없음. 제거된 dead
    variable(`latestEs`)은 추출에 직접 종속. 주석 추가는 "왜 두 방향이 필요한가"를 설명하는 fix 의도
    문서화뿐, 다른 테스트·주석 손질 없음.
  - 조치 불필요.

- **[INFO]** `fb78bfe60`(비-코드 정합)은 커밋 메시지가 진술한 3항목(plan 반증 정정 · SUMMARY 거짓 주장
  정정 · 잔여 2건 이연 기록)과 실제 diff 가 1:1 대응, `codebase/`·설정·spec 변경 0건
  - 위치: `plan/in-progress/webchat-boot-single-flight.md`,
    `plan/in-progress/webchat-usewidget-extraction.md`, `review/code/2026/07/18/00_51_53/SUMMARY.md`
  - 상세: 신규 체크리스트 항목("짝 게이트 구조적 강제 검토")은 미체크 상태로 별도 백로그 plan 에 이연될
    뿐 이번 PR 안에서 실행되지 않는다 — "불필요한 리팩토링"(항목 2) 유혹을 실제로 피한 사례.
  - 조치 불필요.

- **[INFO]** `61e07f3ec`(review 산출물 12개)은 전부 `review/code/2026/07/18/02_25_54/**` 하위 —
  `code-review-agents` skill 지정 쓰기 경로와 일치, 코드·plan·spec 변경 0건
  - 위치: `review/code/2026/07/18/02_25_54/*`
  - 조치 불필요.

## 요약

`git diff --name-only` 두 명령(merge-base 기준·origin/main 기준)은 77개 파일로 완전히 동일하고
merge-base 가 `origin/main`(`29aa918a6`) 자체와 같아 base 드리프트가 없다 — 호출자 예상 수치와 정확히
일치한다. 다만 이번 scope.md 라운드의 prompt payload(27개 파일)는 이전 두 라운드의 review 산출물과 오래된
`2-sdk.md` 스냅샷만 담고 있어, 검증 대상인 실제 델타(`94b66b212`+`fb78bfe60`)의 코드 diff 는 payload
밖에 있었다 — 이는 이미 `02_25_54/SUMMARY.md`·`RESOLUTION.md` 자신이 "알려진 한계·이월"로 기록해 둔
반복 패턴이라 WARNING 으로만 남기고 developer scope 위반으로 보지 않았다. 호출자 지시대로 `git
show`/`git log`/`git diff` 로 worktree 를 직접 조사한 결과, 02_25_54 리뷰 이후 추가 변경은 정확히 세
커밋 — 테스트 커버리지 갭 fix(`94b66b212`: 프로덕션 코드는 `start()` deps 배열에 심볼 1개 추가하는
`+1/-1` 뿐, 테스트는 헬퍼 추출 + 대칭 2방향 파라미터화로 이번 fix 의도에 정확히 종속), 비-코드 정합
(`fb78bfe60`: plan 문서 2개 + 기존 review SUMMARY self-correction 1개, `codebase/` 변경 0건), review
산출물(`61e07f3ec`: `review/code/2026/07/18/02_25_54/**` 12개, 지정 경로 준수) — 뿐이었다. 설정 파일
변경 0건, `use-widget.ts` 전체 PR 기준 import 변경 0건도 재확인했다. 종합하면 이번 델타는 호출자가
기대한 범위(커버리지 갭 fix + dep 1줄)를 정확히 지켰고, 그 밖의 리팩토링·기능 확장·무관한 파일 수정은
발견되지 않았다. 유일한 지적은 리뷰 프로세스 자체의 payload 대표성 한계이며, 이는 이미 알려져 이월
처리된 사안이다.

## 위험도

LOW
