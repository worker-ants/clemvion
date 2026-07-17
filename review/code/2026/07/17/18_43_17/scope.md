# 변경 범위(Scope) 리뷰

대상: `git diff origin/main..HEAD` (2 커밋)
- `a1e2ec8af` fix(frontend): SUMMARY#1 severity 강등("error"→"warn") mutation 을 레이어 가드 테스트가 탐지하게 보강
- `e6e0fdc0d` docs(review): ai-review 세션 산출물 (레이어 가드 후속 개선 3건)

15개 파일 변경(785 insertions / 14 deletions) 확인. 커밋 단위로 분리 검증했다.

## 발견사항

- **[INFO]** 코드 fix 커밋(`a1e2ec8af`)이 WARNING#1(이번 라운드 severity 갭) 외에 저비용 INFO 3건(#4·#5·#6)을 함께 처리
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` — 근접 오탐 negative fixture 2건(`@/components-legacy`, `../componentsShared/x`) 추가(INFO#4), `files:["src/lib/**"]` 리터럴 일치 요구 주석(INFO#5), fail-open throw 메시지 확장(INFO#6)
  - 상세: 커밋 메시지·`RESOLUTION.md` 모두 "WARNING #1 · INFO #4 후속"이라고 명시하고, INFO#5/#6 도 표에 근거와 함께 기재돼 있어 은폐된 확장이 아니라 **의도적으로 고지된 번들링**이다. 세 항목 모두 동일 파일(`eslint-layering-guard.test.ts`)의 동일 관심사(레이어 가드 테스트 견고성)에 국한되고, diff 크기도 각 수 줄 수준으로 저비용이다. 이런 저비용 INFO 를 관련 WARNING fix 커밋에 편승시키는 것은 일반적으로 허용되는 실무 패턴이지만, "의도된 범위 = 선행 리뷰 WARNING#1~#3 후속 + 자체 리뷰 severity 갭 보강"이라는 이번 턴의 좁은 서술과 엄밀히 대조하면 INFO#4~#6 은 그 문장에 명시되지 않은 항목이다.
  - 제안: 조치 불요. 다만 향후 유사 상황에서 "이번 fix 는 WARNING#1 + 부수적으로 저비용 INFO N건 포함"처럼 커밋 스코프를 한 줄로 명시하면 스코프 감사가 더 빨라진다(이미 RESOLUTION.md 표에서 이 역할을 하고 있어 현재도 충분히 투명함).

- **[INFO]** `eslint.config.mjs` 의 `COMPONENTS_PATH_RE` 상수화·`eslint-layering-guard.test.ts` 의 `layeringBlocks`/`mergedRules`/bare 케이스는 이번 커밋에 처음 등장하지만 "선행 리뷰(17_29_21) WARNING #1·#2·#3" 의 실질적 코드 변경분이다
  - 위치: `codebase/frontend/eslint.config.mjs:5-7,55,61`; `eslint-layering-guard.test.ts` 전반
  - 상세: `git show origin/main:codebase/frontend/eslint.config.mjs` 로 대조한 결과 이 상수·병합 로직·bare 케이스는 origin/main 에는 없던 신규 변경이며, 오늘(2026-07-17) 세션 내에서 uncommitted 로 작업되다 이번 fix 커밋에서 처음 커밋됐다. 즉 "선행 리뷰 WARNING#1·#2·#3 후속 처리 3건"이라는 이번 턴 서술과 실제 diff 내용(WARNING#3=regex 중복→상수화, WARNING#1=flat config 병합 미검증→`mergedRules`, WARNING#2=bare 사각지대→bare it.each 4건)이 1:1로 대응됨을 확인했다 — 스코프 이탈 아님.
  - 제안: 조치 불요(검증 목적의 기록).

- **[INFO]** `review/code/2026/07/17/18_06_36/**` 신규 커밋은 CLAUDE.md 명시 저장 위치("코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")와 정확히 일치하며, 동일 트리의 다른 12개 타임스탬프 디렉터리와 동일한 파일 구성(RESOLUTION.md/SUMMARY.md/_retry_state.json/_routing_decision.json/meta.json/개별 reviewer md)을 따른다
  - 위치: `review/code/2026/07/17/18_06_36/` (13 files)
  - 상세: `_retry_state.json`/`_resolution_state.json` 등에 로컬 절대경로(`/Volumes/project/private/clemvion/...`)가 포함돼 있으나, 이는 이 프로젝트의 기존 산출물 포맷에서 이미 일관되게 쓰이는 패턴(과거 세션 디렉터리들도 동일 구조)이라 이번 diff 가 새로 도입한 관례 이탈이 아니다.
  - 제안: 조치 불요.

## 검증한 항목 (문제 없음)

- `codebase/frontend/package.json` 등 설정 파일 변경 없음 — SUMMARY 가 언급한 `--max-warnings` 무제한 이슈는 이번 fix 범위에 포함되지 않았고, 실제로도 손대지 않았다(스코프 이탈 없음, 완전성 판단은 별도 reviewer 몫).
- 대상 코드 diff(파일 1·2) 는 두 파일에 국한되고, 두 파일 모두 "레이어 가드"라는 동일 관심사에 집중 — 무관한 파일·모듈 수정 없음.
- 포맷팅 전용 변경(전체 파일 reflow 등) 없음 — 각 hunk 가 실질 로직 변경(상수 도입, 함수 추가, assertion 추가, 케이스 추가)에 직접 연결됨. 줄바꿈된 문자열 리터럴(`it("두 규칙 모두 severity...")`)은 단순 라인 길이 분할이지 임의 재포맷팅이 아님.
- 신규/불필요 임포트 없음, 기존 임포트(`describe, it, expect`, `Linter`, `eslintConfig`) 변경 없음.
- 주석 변경은 전부 해당 로직 변경을 설명하는 목적 주석(왜 mergedRules 로 바꿨는지, 왜 bare 케이스가 필요한지 등)이며, 무관한 주석 추가/삭제 없음.
- `git diff origin/main..HEAD --stat` 로 15개 파일 전수 확인 — 코드 2개 + 리뷰 산출물 13개, 그 외 파일 없음.

## 요약

코드 fix 커밋(`a1e2ec8af`)은 선언된 스코프(선행 리뷰 WARNING#1·#2·#3 후속 + 이번 라운드 severity 갭 보강)와 실제 diff 내용이 정확히 대응하며, 두 대상 파일(`eslint.config.mjs`, `eslint-layering-guard.test.ts`) 밖으로 번지는 수정이 없다. WARNING#1 fix 에 저비용 INFO#4~#6 을 함께 처리한 점은 "번들링"이라 부를 수는 있으나 커밋 메시지·RESOLUTION.md 에 명시적으로 고지돼 있고 동일 파일·동일 관심사 내 수 줄 규모라 실질적 스코프 이탈로 보기 어렵다. 두 번째 커밋(`e6e0fdc0d`)은 `review/code/**` 전용이며 CLAUDE.md 가 정한 저장 위치·기존 산출물 포맷을 그대로 따른다. 불필요한 리팩터링, 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅, 설정 변경은 발견되지 않았다.

## 위험도

NONE
