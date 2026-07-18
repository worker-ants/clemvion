# 변경 범위(Scope) 검토 — webchat-boot-single-flight (02_25_54)

## 페이로드 청결 확인 (직접 git 검증)

```
git diff --name-only $(git merge-base origin/main HEAD)..HEAD   → 65개 파일
git diff --name-only origin/main..HEAD                          → 65개 파일
diff <(정렬) <(정렬)                                              → IDENTICAL (차이 없음)
git merge-base origin/main HEAD                                  == 29aa918a653a0efb5f792dc7e105c0887f03ef25
```

두 명령의 파일 목록이 완전히 동일(65개)하고 merge-base 가 `origin/main` 자체와 같다 — 지시받은 예상치와
정확히 일치한다. 브랜치가 `origin/main` 에서 분기한 뒤 `origin/main` 이 전진하지 않았고, base 드리프트나
의도치 않은 커밋 오염이 없다.

## 페이로드 대표성 — 이번 라운드도 동일한 구조적 한계 (WARNING, 이전 라운드와 동종)

`_prompts/scope.md`(2467줄)에 실제로 포함된 "리뷰 대상 파일"은 15개뿐이며, 그 전부가 **이전 라운드
(01_44_21)의 리뷰 산출물 6개**(`meta.json`/`requirement.md`/`scope.md`/`security.md`/`side_effect.md`/
`testing.md`) + **consistency 산출물 8개**(`review/consistency/2026/07/17/19_46_54/**`) + **spec 1개**
(`2-sdk.md`)다. `meta.json`(`review/code/2026/07/18/02_25_54/meta.json`)으로 직접 대조한 결과도 동일—
14개 파일만 등록돼 있고, 지시받은 "초점" 대상인 실제 코드 커밋 `77805bd32`(이중 EventSource fix)·
`0020f9106`(주석 정리)의 diff, 그리고 이번 라운드가 새로 생성한 리뷰 산출물(`01_44_21/RESOLUTION.md`·
`SUMMARY.md`·`concurrency.md`·`documentation.md`·`maintainability.md`·`_retry_state.json`,
`00_51_53/RESOLUTION.md`)은 **payload 어디에도 없다**(`grep -n "^### 파일"` 로 전 섹션 헤더 15개를
확인, `use-widget.ts` 문자열이 등장하는 곳은 전부 01_44_21 리뷰 산출물 *본문 서술* 안일 뿐 실제 diff
hunk 가 아님).

이는 developer 측 scope 위반이 아니라 이전 라운드(01_44_21 scope.md)가 이미 지적한 것과 같은 계열의
**prompt 구성 단계 truncation/선별 문제**다(과거 `ai-review Workflow router empty`,
`Consistency/ai-review Workflow FS-write flakiness` 메모리와 동일 패턴, 두 라운드 연속 재현). 호출자
지시대로 아래는 `git show`/`git diff` 로 저장소를 직접 읽어 보완한 결과다 — payload 미신뢰, 디스크/git
실측 우선 원칙 적용.

## 초점 커밋 직접 검증 — 이중 EventSource fix + stale 주석 정리

### 01_44_21 리뷰 이후 실제로 추가된 커밋 (3개, `git log origin/main..HEAD` 상단부)

```
262ef8e5b docs(review): 01_44_21 SUMMARY + RESOLUTION (이중 EventSource MEDIUM → openStream 게이트)
0020f9106 docs(web-chat): 재설계 후 stale 해진 boot 축 주석 정리 (documentation·maintainability WARNING)
77805bd32 fix(web-chat): 이중 EventSource 생성 — seed 게이트의 짝(openStream 직전 게이트) 추가
2b4f198c1 docs(review): 00_51_53 SUMMARY + RESOLUTION  ← 01_44_21 리뷰 시점의 코드 baseline
```

`git diff --stat 2b4f198c1..HEAD`(01_44_21 리뷰 이후 누적 diff)로 전수 확인한 결과, **비-review 파일은
정확히 2개**뿐이다:

```
codebase/channel-web-chat/src/widget/use-widget.ts               | 33 +++--  (26 insertions, 7 deletions)
codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts | 109 ++--- (97 insertions, 12 deletions)
```

나머지는 전부 `review/code/2026/07/18/{00_51_53,01_44_21}/**` 경로 안(15개 파일, `code-review-agents`
skill 의 지정 쓰기 경로와 일치) — 항목 4(무관한 파일 수정) 위반 없음.

### openStream 게이트 — 정확히 2곳(start·applyConfig)에만 최소 추가 (확인됨)

`grep -n "if (sessionEstablished()) return;" use-widget.ts` 결과:

```
523: (JSDoc 본문 안의 코드 인용 — 실제 게이트 아님, 문서 설명)
673:        if (sessionEstablished()) return;   ← start() 내부, openStream(session, "0") 직전
1018:       if (sessionEstablished()) return;   ← applyConfig() 내부, openStream(saved, "0") 직전
```

`git show 77805bd32 -- use-widget.ts` 로 이 커밋 자체의 diff 를 대조하면:
- hunk 1 (line 511-527): `seedWaitingFromStatus` JSDoc 의 "openStream 이 seed 반환 직후 동기 실행이라
  이중 스트림 원천 차단"이라는 **반증된 주장**을 microtask 경계를 반영한 정확한 서술로 교체. 코드 변경
  없음, 순수 문서 정정.
- hunk 2 (line 664-673): `start()` 안, `isStale(gen)` 체크 직후·`openStream(session, "0")` 직전에
  주석 4줄 + `if (sessionEstablished()) return;` **1줄** 추가.
- hunk 3 (line 1008-1018): `applyConfig()` 안, checkpoint-2(`isAttemptStale`) 직후·
  `openStream(saved, "0")` 직전에 동일 패턴(주석 4줄 + 게이트 1줄) 추가.

두 삽입 지점 모두 지시받은 "openStream 직전"이라는 위치 조건과 정확히 일치하고, 그 외 어떤 함수·분기도
건드리지 않았다(`sendCommand`/`cannotApplyConfig`/`isAttemptStale`/`bootGenRef` 등은 이 hunk 범위 밖).
동반 테스트 diff(`use-widget-eager-start.test.ts` 3385줄 이후)는 새 회귀 테스트 1건(순수 추가, 84줄)
뿐이며 기존 테스트 바디를 건드리지 않았다 — 커밋 메시지의 "393 passed(double-stream 재현 +1)" 주장과
일치. `git diff --check`(공백 오류 검사) 클린, `grep '^[+-]import'` 로 import 라인 변경 0건 확인 —
항목 5(포맷팅)·항목 7(임포트) 위반 없음.

### stale 주석 정리(0020f9106) — 순수 주석, 로직 변경 없음 (확인됨)

`git show 0020f9106` 전체 diff를 직접 대조한 결과, 두 파일 모두 **주석/JSDoc 텍스트만** 바뀌었다:

- `use-widget.ts`(line 257-266): `applyConfig` JSDoc 의 "비대칭 가드 누락 3번" stale 카운트를
  "여러 번"으로 일반화하고 `23_58_23` 사례·`sessionEstablished()` 로의 이관 사실을 추가 서술. 코드
  라인(`+`/`-`) 자체는 텍스트뿐, 실행 가능한 토큰(함수 호출·분기·연산자) 변경 없음.
  - `use-widget-eager-start.test.ts`(line 3039-3116): 기존 테스트 2건의 **선행 주석**만 "boot 축"
    표현을 `sessionEstablished()` 가드로 정정 — `it(...)` 블록 내부의 `expect`/`act`/setup 코드는
    한 글자도 변경되지 않음(diff 로 직접 대조, 변경된 라인은 전부 `//` 로 시작).

커밋 메시지 자체도 "순수 주석 — 런타임 무영향"이라 명시했고, 코드 대조 결과 이 주장과 일치한다. 항목
6(주석 변경) 은 이번 항목의 목적 자체이므로 "불필요한" 주석 변경이 아니라 **지시받은 정확한 범위의
주석 정정**이다.

### 리뷰 산출물 커밋(262ef8e5b) — 범위 내 자기 정정 포함

이 커밋은 `review/code/2026/07/18/01_44_21/**` 신규 12개 파일(SUMMARY·RESOLUTION·8개 리뷰어 산출물+
meta/retry-state) 외에 `review/code/2026/07/18/00_51_53/RESOLUTION.md` 6줄을 수정한다. 이 6줄은
"beginBootAttempt JSDoc 이 전면 재작성됐다"는 00_51_53 라운드의 과거 주장을 "말미 괄호주만 재작성했고
카운트 문단은 실제로 안 건드렸다(01_44_21 maintainability 가 지적)"로 정정하는 자기-감사(audit-trail)
수정이다 — `0020f9106` 커밋 메시지가 명시한 근거("00_51_53 RESOLUTION 이 '해소'로 적었으나 실제론 이
문단을 안 건드렸던 것")와 직접 연결되며, 이번 라운드가 다루는 "stale 주석 정리"와 동일한 문제의식의
연장이다 — 무관한 파일 수정이 아니라 같은 사건의 문서 측 후속 정정.

## 발견사항

- **[WARNING]** scope 리뷰 payload 가 실제 diff 65개 파일 중 15개(전부 01_44_21 라운드 산출물+
  consistency+spec)만 포함, 검증 요구된 초점 커밋(`77805bd32`·`0020f9106`)의 diff 와 이번 라운드
  신규 리뷰 산출물은 payload 밖 — 01_44_21 scope.md 가 지적한 것과 동일 계열 문제가 재현
  - 위치: `_prompts/scope.md`(2467줄, `### 파일` 헤더 15개), `review/code/2026/07/18/02_25_54/meta.json`
    (`files` 배열 14건)
  - 상세: payload 만으로는 이번 라운드 scope 리뷰의 실제 목적("이중 EventSource fix 가 게이트 2줄+JSDoc
    정정 밖으로 번지지 않았는지")을 판정할 수 없다. developer 의 scope 위반이 아니라 리뷰 오케스트레이션
    prompt 생성 단계의 반복 재현 이슈로 판단된다. 이번엔 호출자가 정확한 대상 커밋 해시를 지목해줘
    git 실측으로 완전히 보완했으나, 이런 명시 힌트가 없었다면 이 gap 이 조용히 통과됐을 위험이 있다.
  - 제안: (01_44_21 scope.md 와 동일) payload 생성 로직이 "전체 diff 파일 수 vs payload 포함 파일 수"
    괴리를 자체 점검해 임계치 초과 시 prompt 안에 명시 경고를 남기도록 개선 검토. 두 라운드 연속
    재현이므로 우선순위를 소폭 상향할 가치가 있음(즉각 조치는 이번 라운드엔 불필요 — 호출자 보완
    지시로 커버됨).

- **[INFO]** openStream 게이트는 지시받은 정확히 2곳(`start()`·`applyConfig()`)에만 최소 추가, 그 외
  함수·분기 무변경 — 직접 검증 완료
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:673`(`start()`),
    `:1018`(`applyConfig()`), JSDoc 정정 `:511-527`
  - 상세: `grep`으로 게이트 라인 전수 대조, `git show 77805bd32` hunk 경계로 다른 함수(`sendCommand`,
    `cannotApplyConfig`, `isAttemptStale`, `bootGenRef` 증가 로직)가 diff 범위 밖임을 확인. 동반 테스트도
    신규 회귀 1건 순수 추가뿐. import·설정 파일 변경 0건.
  - 조치 불필요.

- **[INFO]** stale 주석 정리(`0020f9106`)는 두 파일 모두 주석/JSDoc 텍스트에만 국한, 실행 코드(assert·
  분기·호출) 변경 0건 — 커밋 메시지의 "순수 주석" 주장과 diff 가 일치
  - 위치: `use-widget.ts:257-266`, `use-widget-eager-start.test.ts:3039-3116`
  - 상세: 변경된 모든 라인이 `//` 로 시작하거나 JSDoc(`*`) 블록 안. `it(...)` 콜백 본문·`expect`/`act`
    호출은 무변경.
  - 조치 불필요.

- **[INFO]** 리뷰 산출물 커밋(`262ef8e5b`)의 `review/code/2026/07/18/00_51_53/RESOLUTION.md` 6줄 수정은
  무관한 파일 손대기가 아니라 이번 라운드가 다루는 "stale 문서" 문제의식과 직접 연결된 자기-감사 정정
  - 위치: `review/code/2026/07/18/00_51_53/RESOLUTION.md`
  - 상세: `0020f9106` 커밋 메시지가 명시한 근거(00_51_53 RESOLUTION 의 과거 "전면 재작성" 주장이 실제와
    달랐다는 01_44_21 maintainability 지적)와 1:1 대응. 그 외 `review/code/2026/07/18/{00_51_53,
    01_44_21}/**` 경로 밖 파일은 이 커밋에서 변경되지 않음(`git show --stat` 확인).
  - 조치 불필요.

## 요약

`git diff --name-only` 두 명령(merge-base 기준·origin/main 기준)의 파일 목록은 65개로 완전히 동일하고
merge-base 가 `origin/main` 자체(`29aa918a6`)와 같아 base 드리프트는 없다 — 지시받은 예상치와 정확히
일치. 이번 scope.md 라운드의 prompt payload 는 그 65개 중 15개(전부 01_44_21 라운드 산출물+consistency+
spec)만 포함해 초점 커밋의 실제 diff 가 빠져 있었는데, 이는 이전 라운드(01_44_21 scope.md)가 이미 보고한
것과 동일한 payload 대표성 문제가 재현된 것이며 WARNING 으로 기록했다. 호출자 지시에 따라 `git log`/
`git show`/`git diff --stat`로 직접 보완 검증한 결과, 01_44_21 리뷰 이후 추가된 코드 변경은 정확히
2개 파일(`use-widget.ts` 33줄, `use-widget-eager-start.test.ts` 109줄)에 국한되고, 그 안에서도 openStream
게이트는 지시받은 정확히 2곳(`start()`·`applyConfig()`)에만 최소(각 1줄) 추가됐으며 JSDoc 정정은 반증된
불변식 주장을 바로잡는 목적에 정확히 부합한다. 별도 커밋(`0020f9106`)의 stale 주석 정리는 두 파일 모두
주석/JSDoc 텍스트에만 국한돼 실행 코드 변경이 전혀 없음을 diff 라인 단위로 확인했다. 리뷰 산출물 커밋은
지정 경로(`review/code/2026/07/18/**`) 안에서만 파일을 생성·수정했고, 유일하게 경로 밖(00_51_53
RESOLUTION.md)을 건드린 수정도 이번 주석 정리와 직접 연결된 자기-감사 정정이지 무관한 손대기가 아니다.
import·설정 파일 변경 0건, 포맷팅/공백 오류 0건. 종합하면 코드 자체의 변경 범위는 지시된 의도(이중
EventSource fix + 주석 정합)를 벗어나지 않았고, 이번 라운드 절차상 유일한 실질 지적은 리뷰 payload
구성의 대표성 문제(2회 연속 재현)다.

## 위험도

LOW — 코드 diff 자체는 지시된 범위(openStream 게이트 2곳 + JSDoc 정정 + stale 주석 정리)를 정확히
지켰고 CRITICAL/scope 위반 없음. 유일한 WARNING 은 리뷰 프로세스의 payload 대표성 문제(developer 측
scope 위반 아님, 두 라운드 연속 재현이라는 점만 경미하게 상향 고려 요소)다.

STATUS=success scope PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/02_25_54/scope.md risk=LOW
