# 변경 범위(Scope) 리뷰 — 4라운드

대상: `64334e708` → `HEAD`(`cfd195fb4`, "규약을 세우자 그 규약 문장이 틀렸다 — 3라운드 3건 반영")

## 검증 결과 요약

| 항목 | 결과 |
|---|---|
| 이번 라운드 `codebase/` 변경 = 주석·라벨 전용 2파일 | **확인** (기계적 검증, 완전 동일) |
| `codebase/` 전체(브랜치 전체) 여전히 3파일뿐 | **확인** |
| `spec/` diff | **0** |
| 설정 파일 diff (프로젝트 config) | **0** (review 세션 산출 JSON만 존재, 프로젝트 설정 아님) |
| `triggers.service.ts` md5 == `origin/main` | **일치** (`f1377a76ef26dde2a12d0be65370d773`, 3곳 모두) |
| §N 백업-차단 사고 절 추가가 이 작업 범위에 속하는가 | 판단: **범위 위반 아님** (근거 아래) |
| 포맷 노이즈 (backend 핀 prettier) | **없음** |

## 발견사항

- **[INFO]** 이번 라운드의 `codebase/` 실행 코드는 before/after 완전 동일 — fixture 교체조차 없음
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`, `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`
  - 상세: `git diff 64334e708..HEAD -- codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` 와 `...trigger-workflow-ref.ts` 를 직접 열어 확인한 결과, 변경 hunk 전부가 `/** */`·`//` 주석 본문과 `// ── 가드 N ──` 라벨 재번호("가드 5"→"가드 6" 등, ⑤ 누락 반영)뿐이었다. 이를 재현 가능하게 재확인하기 위해 두 파일의 `64334e708` 버전과 `HEAD` 버전을 저장소 밖 scratch(`/private/tmp/.../scratchpad/{before,after}`)로 추출한 뒤, 문자열/템플릿 리터럴을 보존하면서 `//` 줄주석과 `/* */` 블록주석을 제거하고 빈 줄을 걷어낸 뒤 내부 공백을 정규화하는 Python 스트리퍼(`strip_comments.py`, state machine)를 직접 작성해 돌렸다. 결과: 두 파일 모두 `diff` **exit code 0**(바이트 단위 완전 동일, 재배치조차 없음) — spec.ts 는 raw 196→214줄이 stripped 121→121줄로, impl.ts 는 raw 137→140줄이 stripped 33→33줄로 수렴해 스트리퍼가 실제로 주석을 제거했음도 확인했다(no-op 아님). `git diff --stat 64334e708..HEAD` 상 `codebase/` 변경 파일은 정확히 이 2개뿐이었다(3번째 파일 `test/trigger-workflow-ref.e2e-spec.ts` 는 이번 라운드에 손대지 않음). **"주석·라벨 전용 2파일"이라는 이번 라운드의 주장은 사실이다.**
  - 제안: 없음 (검증 완료, 조치 불필요)

- **[INFO]** 브랜치 전체 스코프 재확인 — `codebase/` 3파일 고정, `spec/`·설정 diff 0, `triggers.service.ts` 미변경
  - 위치: 저장소 루트 (범위: `git merge-base origin/main HEAD` = `2ebd8a86e`)
  - 상세: `git diff --stat origin/main...HEAD -- codebase/ spec/` 결과 변경 파일은 `trigger-workflow-ref.spec.ts`(214줄) · `trigger-workflow-ref.ts`(140줄) · `test/trigger-workflow-ref.e2e-spec.ts`(266줄) 셋뿐이고 `spec/` 는 0건. `'*.json' '*.yml' '*.yaml' 'package.json' 'tsconfig*.json' '.eslintrc*' '.prettierrc*'` 패턴으로 다시 훑어도 걸리는 것은 `review/code/**`·`review/consistency/**` 세션 산출 JSON(`_routing_decision.json`, `_retry_state.json`) 뿐이며 이들은 프로젝트 설정이 아니라 리뷰 하네스의 실행 로그다. `triggers.service.ts` 는 working tree·`HEAD`·`origin/main` 세 지점의 md5 가 전부 `f1377a76ef26dde2a12d0be65370d773` 로 동일 — 이 캐너리 PR 이 프로덕션 코드를 한 줄도 바꾸지 않는다는 RESOLUTION.md 의 서술과 부합한다.
  - 제안: 없음

- **[INFO]** §N 백업-차단 사고 절 추가는 스코프 위반이 아니라고 판단한다 — 단, 경계 판단이므로 근거를 명시한다
  - 위치: `plan/in-progress/harness-review-gate-followups.md` §N (기존 절, 헤딩 `## §N. 「리뷰어 뮤테이션」...`) 아래 신규 하위절 `### 3라운드가 더 나쁜 축을 하나 드러냈다 — 백업이 차단되고 뮤테이션만 진행된다`
  - 상세: `git diff 64334e708..HEAD -- plan/in-progress/harness-review-gate-followups.md` 로 직접 확인한 결과, §N 헤딩 자체는 **이번 라운드에 신설된 것이 아니다** — `git show 64334e708:...` 에 이미 §M·§N 헤딩이 존재한다(3라운드에서 등재). 이번 라운드는 그 기존 §N 밑에 하위절 하나(체크박스 2개 포함)를 덧붙였을 뿐이다. 내용은 `review/code/2026/09/10/16_26_57`(3라운드) 의 `testing` reviewer 가 스스로 밝힌 사고 — 백업용 `cp` 명령에 `git … status` 를 같이 넣었다가 워크트리 격리 훅이 스크립트 전체를 사전 차단해 백업 없이 뮤테이션이 진행된 사건 — 를 그대로 기록한 것이며, 프롬프트의 지시("3라운드 reviewer 가 밝힌 자기 사고가 근거")와 정확히 일치한다.
    판단 근거: (1) `plan/in-progress/harness-review-gate-followups.md` 는 이 트리거 캐너리 작업 전용 트래커가 아니라 리뷰 하네스 전반의 follow-up 을 모으는 **공용 트래커**이며, CLAUDE.md·이 프로젝트의 확립된 관례("review/**는 SoT 아님 — 미룬 항목은 그 턴에 plan/ 에 적어라")에 따라 리뷰 도중 발견된 하네스/프로세스 결함을 이 파일에 적는 것이 정규 경로다. (2) 이 사고는 **바로 이 세션의 3라운드 리뷰 실행 중**에 실제로 발생한 관측이라, 뒤로 미루지 않고 발견한 턴에 기록하는 것이 이 프로젝트의 반복된 관례(같은 세션이 §M 도 동일한 방식으로 이미 기록)와 일치한다. (3) 브랜치 전체에서 이 파일은 이미 119줄이 추가돼 왔고(1~3라운드 누적), 그 세 라운드 모두 scope reviewer 가 NONE 판정을 내렸다 — 이번 라운드의 23줄 추가는 그 기존 패턴의 연장이지 새로운 종류의 스코프 확장이 아니다. (4) 순수 문서 추가(체크박스 2개, 프로덕션 코드·설정 무관)이고 `codebase/` 변경과 분리된 파일이라 diff 가 섞여 판정을 흐리지 않는다.
    다만 엄밀히는 이 절의 소재("리뷰어 프롬프트 뮤테이션 계약")가 이 캐너리 작업(TriggerDto.workflow 검증 헬퍼)의 제품 목적과는 무관한 메타 주제다 — "관련 없는 파일 수정" 관점에서 완전히 결백하다고 하기보다는, "이 프로젝트가 명시적으로 지정한 하네스 백로그 파일에, 이 세션이 직접 만든 관측을 정해진 관례대로 적재"한 경계 사례로 본다.
  - 제안: 조치 불필요. 다만 앞으로 유사 사례에서 "이 파일에 적는 것이 왜 이 작업의 스코프 안인가"를 판단할 명시적 기준(예: "이 세션이 직접 생성한 리뷰 아티팩트에서 나온 관측만 당일 커밋에 동반 가능")이 있으면 향후 라운드에서 이런 경계 판단을 반복하지 않아도 된다 — 후속 검토자가 참고할 수 있도록 이 판단 근거를 그대로 남겨 둔다.

- **[INFO]** 포맷 노이즈 없음 — backend 핀 prettier(3.9.6) 기준 완전 준수, drive-by 리포맷 없음
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`, `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`
  - 상세: 워크스페이스 루트에는 prettier 가 없고(`find . -maxdepth 3 -iname package.json | xargs grep prettier` 결과 `codebase/backend/package.json` 단 한 곳, `^3.9.6`), 과거 세션에서 재발한 "루트 npx 가 다른 prettier 버전을 잡아 무관한 코드까지 리포맷" 문제가 이 PR 에는 구조적으로 발생할 수 없다(핀 하나뿐). `codebase/backend/node_modules/.bin/prettier`(로컬 설치, `3.9.6`)로 두 파일에 `--check` 를 직접 실행 — `All matched files use Prettier code style!` (exit 0). `git diff 64334e708..HEAD -- codebase/` 에 추가된 줄에 대해 trailing whitespace(`grep -E '^\+.*[ \t]$'`)·CRLF 흔적을 전수 검사했으나 0건.
  - 제안: 없음

## 요약

4라운드 커밋(`64334e708`→`HEAD`)의 핵심 주장 — "`codebase/` 변경은 주석·라벨 전용 2파일" — 을 스트리퍼(주석 제거+정규화) 기계적 검증으로 재확인했고, 두 파일 모두 실행 코드가 **완전 동일**(재배치도 없음)이었다. 브랜치 전체로 확대해도 `codebase/` 변경은 3파일 고정, `spec/`·프로젝트 설정 diff 는 0, `triggers.service.ts` 는 `origin/main` 과 md5 완전 일치 — 4라운드 내내 유지돼 온 "프로덕션 코드 미변경" 전제가 이번에도 성립한다. `plan/in-progress/harness-review-gate-followups.md` §N 에 붙은 백업-차단 사고 하위절은 이 캐너리 작업 자체와는 주제가 다르지만, 그 관측이 바로 이 세션의 리뷰 실행 중 나온 것이고 이 프로젝트가 지정한 전용 하네스 백로그 파일에 관례대로 적재된 것이라 스코프 위반으로 판정하지 않는다(경계 사례로 근거를 남겨 둠). 포맷 노이즈도 없다. 종합적으로 이번 라운드는 3라운드 산문의 사실 오류 3건을 정정하는 순수 주석 편집이며, 스코프 관점에서 문제될 것이 없다.

## 위험도

NONE
