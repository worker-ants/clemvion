# 문서화(Documentation) 리뷰 — webchat-boot-single-flight (03_04_45, `fb78bfe60` 정합 검증 라운드)

> 지시받은 핵심 검증 대상: 직전(02_25_54) 라운드에서 내(documentation)가 지적한 비-코드 stale 2건 —
> plan:388 의 반증된 "openStream 동기 실행 원천 차단" 주장, `00_51_53/SUMMARY.md` 의 거짓 주장 — 을
> 커밋 `fb78bfe60` 로 정정했다고 주장한다. 이 정정이 실제 코드/커밋과 일치하는지, 신규 대칭
> double-stream 테스트(`94b66b212`)의 주석이 실제 동작(resolve 순서별 게이트)과 일치하는지, 남은
> stale/반증 서술이 없는지, plan 진행기록(11·12번째 거울상)이 커밋과 일치하는지.

## 검증 방법 — payload 한계 고지

`prompt_file`(2616줄)에 담긴 "리뷰 대상 파일" 27건은 전부 `review/code/2026/07/18/{01_44_21,02_25_54}/**`
· `review/consistency/2026/07/17/19_46_54/**` · `spec/7-channel-web-chat/2-sdk.md` 뿐이며, 이번 라운드가
실제로 검증해야 할 대상(`fb78bfe60`의 diff 자체 — `plan/in-progress/webchat-boot-single-flight.md`,
`plan/in-progress/webchat-usewidget-extraction.md`, `review/code/2026/07/18/00_51_53/SUMMARY.md`)은
payload 어디에도 없다 — 지난 세 라운드(01_44_21 scope·02_25_54 scope·02_25_54 testing 등)가 반복 지적한
것과 동일한 payload 대표성 문제가 이번에도 재현됐다. 호출자 지시대로 payload 를 신뢰하지 않고 `git
show`/`git log`로 저장소를 직접 읽어 검증했다.

1. `git log --oneline -20` + `git show --stat/-p fb78bfe60`로 정정 커밋의 실제 diff 확정(3파일: plan
   본체·`webchat-usewidget-extraction.md`·`00_51_53/SUMMARY.md`).
2. `git show 77805bd32 -- use-widget.ts`·`git show 94b66b212`로 fb78bfe60 가 인용하는 두 코드 커밋의
   실제 diff 대조.
3. `plan/in-progress/webchat-boot-single-flight.md`(현재 439줄) 전문 Read — 정정된 `:388`~`:397` 문단과
   신설된 `## 후속 (01_44_21 · 02_25_54 처리)` 절(`:410`~`:439`)을 커밋 diff 와 라인 단위 대조.
4. **신규 대칭 테스트 검증(핵심)**: `git worktree add --detach`로 완전 격리된 워크트리를 만들어
   `raceStartVsResendSingleStream(resendResolvesFirst)` 헬퍼의 두 방향(`false`/`true`) 각각에 대해
   `start()` 게이트(`:673`)·`applyConfig` 게이트(`:1018`)를 **개별로** mutate(`if (false && ...)`)한 뒤
   `vitest run -t "두 복원 seed"`로 정확히 어느 테스트가 깨지는지 실측(공유 워크트리는 read-only, mutation
   은 격리 워크트리에서만, 매 mutation 후 `diff`로 byte-identical 원복 확인, 종료 후 `git worktree
   remove --force`).
5. `git grep -n "동기 실행"` / `"원천 차단"` 전체 저장소 스윕 — 193건 중 `review/code/**`·`codebase/**`·
   `plan/**` 관련 발생 지점을 개별 판정(이력적 인용 vs 현재형 주장 구분).
6. `npx vitest run`(channel-web-chat 전체) — **394 passed**(22 파일) 재확인.

## 발견사항

- **[정상 확인]** `fb78bfe60`의 plan:388 정정은 실제 코드(`77805bd32`)와 정확히 일치 — 신규 문단·
  `## 후속` 절 모두 검증됨
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:391-397`(정정 문단), `:410-439`(신설
    `## 후속 (01_44_21 · 02_25_54 처리)` 절).
  - 상세: `:391-397`이 서술하는 "`await seedWaitingFromStatus` 와 호출부 `openStream` 사이 microtask
    경계 때문에 겹친 두 seed 가 같은 flush 에서 통과하면 둘 다 openStream 을 부른다" · "seed 게이트의
    짝으로 `openStream` 직전에도 `sessionEstablished()` 게이트를 `start()`·`applyConfig` 양쪽에 뒀다
    (`77805bd32`)"는 `git show 77805bd32 -- use-widget.ts`의 실제 diff(JSDoc 재작성 hunk + `:673`·
    `:1018` 두 지점에 `if (sessionEstablished()) return;` 삽입)와 라인 단위로 일치한다. 현재
    `use-widget.ts`에서 `grep -n "if (sessionEstablished()) return;"` 결과도 `:673`·`:1018` 정확히
    일치(JSDoc 안의 코드 인용 `:523` 제외). `## 후속` 절의 "11번째(01_44_21)"·"12번째(02_25_54)" 요약도
    각각 `01_44_21/SUMMARY.md`(이중 EventSource MEDIUM, `77805bd32` fix)·`02_25_54/SUMMARY.md`(테스트
    커버리지 갭 MEDIUM·코드버그 없음, `94b66b212` fix)의 실제 내용·수치("8인 전원"·"start() 게이트만
    제거해도 전원 통과"·"resolve 순서 파라미터 헬퍼로 두 방향 대칭 고정")와 정확히 대응한다. "openStream
    =closeStream→set 이라 최종 상태는 단일 스트림으로 수렴"이라는 서술도 `use-widget.ts:450-455`의 실제
    구현(`openStream` 진입 즉시 `closeStream()` 선행 호출 후 `streamRef.current` 대입)과 일치.
  - 조치 불필요 — 정정이 정확하다.

- **[정상 확인]** `00_51_53/SUMMARY.md`의 "JSDoc 전면 재작성" 정정은 자매 문서(`RESOLUTION.md`)와
  이제 일치, 커밋 메시지의 "sibling RESOLUTION 은 이미 정정" 서술도 사실
  - 위치: `review/code/2026/07/18/00_51_53/SUMMARY.md:33`, `review/code/2026/07/18/00_51_53/
    RESOLUTION.md:33-36`(`262ef8e5b`에서 선-정정).
  - 상세: `git show 262ef8e5b -- review/code/2026/07/18/00_51_53/RESOLUTION.md`로 대조한 결과
    `RESOLUTION.md`는 이미 "위 '전면 재작성' 서술은 과장이었다 … 그 카운트는 다음 라운드(01_44_21)에서
    정정했다"로 자기-정정돼 있었다. `fb78bfe60`가 `SUMMARY.md:33`을 동일 문구("⚠ 이 라운드엔
    **미정정**(RESOLUTION 의 '전면 재작성' 은 과장 — 말미 괄호주만 고쳤음). 카운트는 후속 01_44_21 에서
    정정. sibling `RESOLUTION.md` 및 01_44_21 참조")로 갱신해 두 문서가 이제 서로 모순되지 않는다.
  - 조치 불필요.

- **[정상 확인]** 신규 대칭 double-stream 테스트(`94b66b212`)의 주석 — "C 먼저 → applyConfig 게이트 고정
  / D 먼저 → start() 게이트 고정"이라는 resolve-순서-대-게이트 대응 주장을 **격리 워크트리 mutation 으로
  독립 재현**, 100% 일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3404-3409`(주석),
    `:3412-3477`(`raceStartVsResendSingleStream` 헬퍼), `:3479-3489`(두 `it` — "(start 먼저 —
    applyConfig 게이트)"/"(재전송 먼저 열려도 하나만 생성된다 (start() 게이트))"), 대응 소스
    `use-widget.ts:673`(`start()` 게이트)·`:1018`(`applyConfig` 게이트).
  - 실측: 격리 detached worktree(`node_modules`는 root 심링크 + `codebase/channel-web-chat/node_modules`
    는 `rsync -a` 실카피)에서 baseline(`vitest run -t "두 복원 seed"` → 2 passed)을 확인한 뒤:
    - `:673`(`start()` 게이트)만 `if (false && sessionEstablished()) return;`로 무력화 →
      **"재전송 먼저 열려도 하나만 생성된다 (start() 게이트)" 단 1건만 실패**(`expected 2 to be 1`),
      "start 먼저 — applyConfig 게이트" 는 그린 유지.
    - 원복(byte-identical `diff` 확인) 후 `:1018`(`applyConfig` 게이트)만 무력화 →
      **"start 먼저 — applyConfig 게이트" 단 1건만 실패**(`expected 2 to be 1`), "재전송 먼저..." 는
      그린 유지.
    - 두 결과가 정확히 상호 배타적으로 교차해, 주석이 주장하는 "resolve 순서에 따라 먼저 여는 쪽이
      갈리므로 각 게이트가 개별로 필요"라는 문장이 코드 레벨에서 정확함을 확인했다(과대·과소 주장 없음).
    - 격리 워크트리 원복·삭제 후 공유 워크트리 `git status --short`로 무오염 확인, `npx vitest run`
      (channel-web-chat 전체) 재실행 결과 **394 passed** — 커밋 메시지·SUMMARY/RESOLUTION 수치와 일치.
  - 조치 불필요 — 주석·테스트·실제 동작 3자가 완전히 정합한다.

- **[WARNING]** `review/code/2026/07/18/00_51_53/RESOLUTION.md`에 반증된 "동기 실행 원천 차단" 주장이
  **여전히 남아 있음** — `fb78bfe60`의 정정 범위 밖에서 발견된 세 번째 인스턴스, plan:388 과 완전히
  동일한 종류의 stale 서술
  - 위치: `review/code/2026/07/18/00_51_53/RESOLUTION.md:24-26`
    ```
    - **반대 구멍 점검**(재설계): 종료 확정 분기는 가드 안 탐(world 사실) / replay_unavailable 은
      opt-in 으로 통과(자기 재동기화) / 정상 경로는 스트림 미열림이라 dispatch / 이중 스트림은 openStream
      이 seed 반환 직후 동기 실행이라 원천 차단. mutation 양방향으로 고정(아래).
    ```
  - 상세: 이 문장은 plan:388(정정됨)·`use-widget.ts:521`(정정됨)·`use-widget-eager-start.test.ts:3401`
    (정정됨, "오판" 프레이밍으로 인용)과 **문자 그대로 동일한 반증된 주장**("openStream 이 seed 반환
    직후 동기 실행이라 이중 스트림 원천 차단")을, 다른 3개의 실제로-여전히-유효한 "반대 구멍 점검" 항목
    (종료 확정 분기·replay_unavailable opt-in·정상 경로)과 나란히, **"오판"/"정정" 같은 과거형 표시 없이
    현재형 사실로** 서술한다. `git log --oneline --follow -- review/code/2026/07/18/00_51_53/
    RESOLUTION.md`로 확인한 결과 이 파일은 `2b4f198c1`(00_51_53 SUMMARY+RESOLUTION 생성, 이중
    EventSource 버그가 발견되기 **전**)에서 이 문장을 얻었고, 이후 유일한 수정(`262ef8e5b`)은 WARNING
    절의 `beginBootAttempt` JSDoc 카운트 문단만 고쳤을 뿐 이 CRITICAL 절의 "반대 구멍 점검" 문장은 한
    번도 건드리지 않았다(`git show 262ef8e5b -- .../RESOLUTION.md`로 직접 대조). `fb78bfe60`의 커밋
    메시지·diff 도 `plan:388`과 `00_51_53/SUMMARY.md:33`만 언급·수정할 뿐 `RESOLUTION.md`는 diff
    범위에 없다(`git show --stat fb78bfe60` — 3파일: plan 본체·`webchat-usewidget-extraction.md`·
    `SUMMARY.md`). 직전 라운드(02_25_54)의 내 자신의 방법론(`documentation.md:19` "4. `use-widget.ts`+
    `use-widget-eager-start.test.ts` 전수에서 … `동기 실행`/`원천 차단` … grep")은 이 grep 을 **소스
    코드 두 파일에만** 적용했고, `plan.md`는 별도로 "전문 Read"했지만 `RESOLUTION.md`의 CRITICAL 본문에는
    같은 문구 grep 을 적용하지 않아 이 인스턴스를 놓쳤다(SUMMARY.md 쪽 "JSDoc 전면 재작성" 문제는
    발견했으나, 그와 무관한 이 별개의 "동기 실행" 문장은 발견 못함). `RESOLUTION.md`는 CRITICAL 을
    "해소 완료"로 선언하는 문서라 향후 이 라운드를 audit-trail 로 참조하는 사람(또는 plan-coherence
    checker 류 자동화)이 "이중 스트림은 이미 원천 차단이 검증됐다"로 오독할 위험이 plan:388 때와 동형
    으로 남아 있다.
  - 제안: `:24-26`에 plan:388·`SUMMARY.md:33`와 같은 패턴으로 각주 추가 — 예: "(이중 스트림 부분은
    **반증됨** — 01_44_21. `await seedWaitingFromStatus` 와 `openStream` 사이 microtask 경계로 짝
    게이트가 별도로 필요했다. `77805bd32`/plan `§11번째` 참조)". 코드 영향 없는 1~2문장 각주라
    저비용·즉시 처리 가능. 향후 이런 grep 을 다시 할 때는 `review/code/**/{RESOLUTION,SUMMARY}.md`도
    스윕 대상에 포함할 것을 권고(이번에 `git grep`으로 전체 저장소를 스윕해 이 인스턴스 외의 추가
    누락은 없음을 확인했다 — 나머지 발생 지점은 전부 "오판"/"정정" 프레이밍이 있는 정당한 이력적 인용).

- **[INFO]** 전체 저장소 grep 결과 — 이 RESOLUTION.md 건 외에 추가 stale/반증 인스턴스는 발견되지 않음
  - 위치: `git grep -n "동기 실행"`/`"원천 차단"` 전체(193건).
  - 상세: `use-widget.ts:521`·`use-widget-eager-start.test.ts:3401`은 "초기 JSDoc이 … 라 적었으나"/
    "오판이었다" 프레이밍으로 과거 주장을 인용하며 즉시 정정하는 정당한 서술. `01_44_21/{RESOLUTION,
    SUMMARY,concurrency,requirement,side_effect,testing}.md`·`02_25_54/{SUMMARY,documentation,
    requirement,scope,security}.md`의 인용은 전부 "그 라운드가 무엇을 발견·수정했는지"를 서술하는
    시제가 명확한 리뷰 이력 기록(과거 진단 인용)이라 재정정 대상이 아니다. `spec/7-channel-web-chat/
    2-sdk.md`·`CHANGELOG.md`에는 이 표현이 아예 등장하지 않는다(무관·클린). 그 외 `동기 실행`의
    나머지 매치(backend 노드·타 리뷰 라운드 등)는 이번 diff 와 완전 무관한 별개 문맥.
  - 조치 불필요(참고용 스윕 결과).

- **[INFO]** `plan/in-progress/webchat-usewidget-extraction.md`의 사전-존재 체크리스트 항목("현재
  391건")이 현재 테스트 수(394건)와 어긋남 — `fb78bfe60` 책임 범위 밖의 경미한 잔여
  - 위치: `plan/in-progress/webchat-usewidget-extraction.md:48`(`- [ ] 기존 테스트 전원 통과 유지(현
    391건) + 훅 단위 테스트 신설`).
  - 상세: `git log -p --follow` 대조 결과 이 줄은 `a2cd6ebb7`(23_58_23 라운드, 2026-07-18 00:35)에서
    "391건"으로 처음 작성됐고 이후 어떤 커밋도(포함 `fb78bfe60`) 수정하지 않았다. 그 사이 테스트 수는
    392(`cffee0d28`)→393(`77805bd32`)→394(`94b66b212`)로 세 차례 증가해 현재 `npx vitest run` 결과
    (394 passed, 22 파일)와 3건 차이난다. `fb78bfe60`는 같은 파일에 새 체크리스트 항목(`:50-54`, 짝
    게이트 구조적 강제)만 **추가**했을 뿐 이 기존 줄은 diff 범위 밖이라 이번 정정 커밋의 책임은 아니다.
    다만 이 항목은 "미착수 리팩토링 백로그"의 목표 수치라 착수 시점에 재확정하면 되는 낮은 우선순위
    항목이고, 함수 정확성이나 리뷰 audit-trail 신뢰도에 영향을 주지 않는다.
  - 제안: 급하지 않음 — `useEiaSession` 분리 착수 시점에 "현재 N건"을 그 시점 실측치로 갱신. 지금
    즉시 고칠 필요는 없다(INFO).

- **[INFO]** plan `:415`의 "11번째 (01_44_21) — 이중 EventSource (MEDIUM, **3인**)" 라벨은
  `01_44_21/SUMMARY.md`의 "**5인 관측**"과 표면적으로 다르지만, 실제로는 같은 문서의 더 상세한 구절을
  정확히 압축 인용한 것 — 오류 아님
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:415`, `review/code/2026/07/18/01_44_21/
    SUMMARY.md:7`("5인 관측")·`RESOLUTION.md:15`("testing·side_effect·concurrency 3인이 재현").
  - 상세: `SUMMARY.md`는 위험도 산정에 5인(testing·side_effect·concurrency·requirement + 판정 근거를
    제공한 문서화/유지보수성 인접 서술 포함)의 관측을 반영하지만, `RESOLUTION.md`의 CRITICAL 처리
    절은 "testing·side_effect·concurrency **3인이 재현**"이라는 더 구체적인 표현을 쓴다. plan 의
    "(MEDIUM, 3인)"은 `RESOLUTION.md`의 이 구체적 문구를 그대로 따른 것으로, 사실관계 오류가 아니라
    두 소스 문서 중 어느 것을 압축했는지의 차이다. 혼동 방지 차원에서 "3인 재현(5인 관측)"처럼 두
    숫자를 함께 적으면 더 명확하겠으나, 현재도 반증된 서술은 아니라 조치 불요 수준의 참고 사항이다.
  - 조치 불필요(선택적 명확화 여지만 있음).

## 요약

호출자가 지시한 핵심 검증 세 가지는 모두 **정확함을 확인**했다: (1) `fb78bfe60`가 plan:388 에 추가한
정정 문단과 신설 `## 후속` 절은 `77805bd32`/`94b66b212`의 실제 diff·라인 번호·수치와 완전히 일치한다.
(2) `00_51_53/SUMMARY.md`의 "JSDoc 전면 재작성" 거짓 주장 정정은 이미 정정돼 있던 자매 문서
`RESOLUTION.md`(`262ef8e5b`)와 이제 서로 모순되지 않는다. (3) 신규 대칭 double-stream 테스트
(`94b66b212`)의 주석("resolve 순서에 따라 먼저 여는 쪽이 갈리므로 각 게이트가 개별로 필요")은 격리
워크트리에서 두 게이트를 개별 mutate 해 정확히 예측된 짝(각 방향이 각자의 게이트만 검증)이 재현됨을
직접 실측 확인했다 — 과대·과소 주장 없음. 다만 "남은 stale/반증 서술이 없는지" 전수 확인 과정에서
`review/code/2026/07/18/00_51_53/RESOLUTION.md:24-26`에 plan:388 과 문자 그대로 동일한 반증된 주장
("이중 스트림은 openStream 이 seed 반환 직후 동기 실행이라 원천 차단")이 "오판" 표시 없이 현재형 사실로
여전히 남아 있음을 새로 발견했다(WARNING) — `fb78bfe60`의 정정 범위(plan 본체 + `SUMMARY.md`)가 이
파일의 CRITICAL 절 본문까지는 미치지 못했고, 이는 직전 라운드(내 자신의 02_25_54 방법론)가 이 grep 을
소스코드 두 파일에만 적용하고 `RESOLUTION.md` 본문에는 적용하지 않았던 경계에서 비롯된 것으로 보인다.
런타임·코드 정확성에는 영향이 없으나(코드는 8인+이번 실측으로 재확인 완결), CRITICAL "해소 완료" 선언
문서에 반증된 근거가 현재형으로 남아 있으면 향후 이 라운드를 감사 자료로 신뢰하는 사람(또는 자동
plan-coherence 검사)을 오도할 수 있어 plan:388 때와 동일한 위험 계열로 판단한다. 부수적으로
`webchat-usewidget-extraction.md`의 사전-존재 "391건" 체크리스트 목표치가 현재 394건과 어긋나는
경미한 잔여(INFO, `fb78bfe60` 책임 범위 밖)와, plan 의 "3인" 라벨이 `SUMMARY.md`의 "5인"과 표면적으로만
다를 뿐 `RESOLUTION.md`의 더 구체적인 문구를 정확히 따른 것(INFO, 오류 아님)을 확인했다. 전체 저장소
grep 으로 이 두 건 외의 추가 stale 인스턴스는 발견되지 않았다.

## 위험도

LOW — CRITICAL 없음. 호출자가 지시한 세 핵심 검증(정정 정확성 2건 + 신규 테스트 주석 정합성)은 모두
실측으로 확증됐고 코드·테스트(394 passed)는 정확하다. 발견한 WARNING 1건은 **코드 밖** 문서
(`review/code/2026/07/18/00_51_53/RESOLUTION.md`, 이미 "해소 완료"로 닫힌 과거 라운드의 산출물)의
정정 전파 gap이며 런타임·사용자 영향은 없다 — 다만 정확히 "잘못된 불변식을 현재형으로 기록한 채 방치"
라는, 이 프로젝트가 11회 넘게 반복 경험한 실패 패턴과 같은 계열이고 수정 비용이 각주 한두 줄로 매우
낮으므로 WARNING 으로 기록해 다음 정합 라운드에서 처리를 권고한다.

STATUS=success documentation PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/03_04_45/documentation.md risk=LOW
