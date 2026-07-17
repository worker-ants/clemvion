# 문서화(Documentation) 리뷰 — webchat-boot-single-flight (02_25_54, `77805bd32`/`0020f9106` 검증 라운드)

> 지시받은 핵심 검증 대상: 이중 EventSource fix(`77805bd32`)로 재작성된 `seedWaitingFromStatus` JSDoc
> ("seed 게이트=표면 되감기 / openStream 짝 게이트=이중 스트림, microtask 경계")이 실제 코드와 맞는지,
> 직전 라운드의 stale boot 축 주석 2곳(테스트)·`beginBootAttempt` 비대칭 카운트가 `0020f9106` 으로 정정됐는지,
> 남은 stale/반증된 서술이 없는지 전수 grep, `00_51_53/RESOLUTION.md` 의 거짓 주장 정정이 적절한지.

## 검증 방법

`prompt_file` payload 는 (이전 라운드들과 동일 패턴으로) 실제 대상 커밋(`77805bd32`/`0020f9106`)의 코드
diff 를 포함하지 않고 무관 파일(review 산출물 3건)만 담고 있어, worktree 절대경로로 직접 검증했다:

1. `git log --oneline -20` + `git show --stat/--patch 77805bd32 0020f9106 cffee0d28` 로 세 커밋의 실제 diff 확정.
2. `codebase/channel-web-chat/src/widget/use-widget.ts` 전문(1106줄)을 Read — JSDoc 서술과 실제 가드 분기
   (`start()`·`applyConfig` 의 `openStream` 직전 게이트 2곳)를 라인 단위 대조.
3. `ts.getJSDocCommentsAndTags()`(channel-web-chat 의 `typescript@5.9.3`)로 `seedWaitingFromStatus`·
   `beginBootAttempt` 등 8개 심볼의 JSDoc 부착을 스크래치패드 스크립트로 재실측 + 파일 내 모든 `/** */`
   블록(29개)이 선언 없이 떠 있는(orphan) 경우가 있는지 정규식 스캔.
4. `use-widget.ts`+`use-widget-eager-start.test.ts` 전수에서 `boot 축`/`checkpoint 2`/`bootAtStart`/
   `동기 실행`/`원천 차단`/`boot 스냅샷` grep 후 각 발생 지점을 개별 판정.
5. `plan/in-progress/webchat-boot-single-flight.md`(400줄) 전문 + `review/code/2026/07/18/{00_51_53,01_44_21}/
   {SUMMARY,RESOLUTION,documentation,maintainability}.md` 를 상호 대조해 정정 전파 여부 확인.
6. `npx tsc --noEmit`(clean) + `npx vitest run src/widget/use-widget-eager-start.test.ts`(**59/59 passed**)로
   최소 sanity 재확인.

## 발견사항

- **[WARNING]** plan 진행기록의 "최종 불변식" 절이 `77805bd32` 로 반증된 주장을 여전히 사실로 서술 —
  정정 섹션 없음
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:382-392`(`### 최종 불변식 — boot 축을 버리고
    sessionEstablished() 로`), 특히 `:388`.
  - 상세: `:388` "`openStream` 이 seed 반환 직후 동기 실행이라 이중 스트림도 원천 차단." 은 이 절이
    작성된 시점(00_51_53 처리 라운드, 2026-07-18)엔 참이었다. 그런데 바로 다음 라운드(01_44_21)에서
    testing·side_effect·concurrency 3인이 이 정확한 불변식을 반증했다(겹친 두 seed 가 같은 microtask
    flush 에서 resolve 하면 둘 다 스트림 미열림을 보고 통과 → `esCount=2`). `77805bd32` 커밋 메시지가
    스스로 "내 초기 JSDoc … 은 그 microtask 경계를 간과한 오판이었다(11번째 거울상)" 이라 명시하고,
    실제 코드 JSDoc(`use-widget.ts:521`)·신규 회귀 테스트 주석(`use-widget-eager-start.test.ts:3400`)
    양쪽에서 정확히 이 문장을 정정했다. 그런데 이 plan 파일 — "이 클래스가 왜 반복 실패했는지와 최종
    불변식을 남긴다"(`:364`)는 스스로 명시한 목적을 가진 바로 그 섹션 — 은 `77805bd32`/`0020f9106`
    이후 한 번도 갱신되지 않았다(파일 끝 `:400`까지 "이월 추가 (01_44_21)" 류 신규 섹션 없음 — grep
    확인). 코드 자체는 정확하지만, 이 plan 은 정확히 이런 부류의 실수(불완전한 불변식을 "최종"으로
    기록했다가 반증됨)를 10회 반복했다고 스스로 기록한 audit-trail 이므로, 향후 이 축을 다시 손대는
    개발자가 이 절을 "최종"으로 신뢰하면 openStream 직전 짝 게이트가 불필요하다고 오판할 위험이 있다
    (정확히 `beginBootAttempt` JSDoc `:260` 이 "축을 하나 더 늘리면서 관용구를 손으로 복제하면 같은
    실패를 초대한다"고 경고하는 바로 그 패턴).
  - 제안: plan 에 `## 이월 추가 (01_44_21 처리 — 11번째 거울상)` 절 신설 — 이중 EventSource 버그·
    pair 게이트 fix(`77805bd32`)·정정된 불변식(seed 게이트=표면 되감기 / openStream 짝 게이트=이중
    스트림, microtask 경계 때문에 필요)을 기존 섹션 패턴(9·10번째 거울상)과 동일하게 기록. 최소한
    `:388` 문장에 "(반증됨 — 01_44_21. `await seedWaitingFromStatus` 와 `openStream` 사이 microtask
    경계 때문에 별도 짝 게이트가 필요했다. `use-widget.ts:518-525` 참조)" 각주 추가.

- **[WARNING]** `00_51_53/SUMMARY.md` 가 이미 정정된 거짓 주장("JSDoc 전면 재작성")을 그대로 보유 —
  자매 문서 `RESOLUTION.md` 만 수정됨
  - 위치: `review/code/2026/07/18/00_51_53/SUMMARY.md:33` vs `review/code/2026/07/18/00_51_53/
    RESOLUTION.md:33-36`.
  - 상세: `RESOLUTION.md`(:33-36)는 01_44_21 라운드 이후 정확하게 자기 정정됐다 — "위 '전면 재작성'
    서술은 과장이었다 (후속 01_44_21 maintainability 가 audit-trail 로 지적). 그 카운트는 다음
    라운드(01_44_21)에서 정정했다." `git show cffee0d28 -- use-widget.ts` 로 직접 대조한 결과 이 정정
    자체는 정확하다 — `cffee0d28` 는 `beginBootAttempt` JSDoc 의 **말미 괄호주**(`*(sendCommand 는 …)*`
    문단)만 재작성했고, "이 파일이 비대칭 가드 누락으로 3번 CRITICAL 을 냈다" 카운트 문단(현재
    `use-widget.ts:260-262`)은 diff hunk 밖이라 실제로 손대지 않았다 — 그 문단은 다음 라운드
    `0020f9106` 에서야 "3번"→"여러 번"(+`23_58_23` 항목 추가)으로 수정됐다. 즉 `RESOLUTION.md` 의
    정정은 사실과 일치한다. 그런데 같은 디렉터리의 `SUMMARY.md:33` 은 "maintainability │
    `beginBootAttempt` JSDoc 거울상 카운트 stale │ ✅ 재설계에서 JSDoc 전면 재작성(카운트 서술 제거)"
    를 무수정 상태로 여전히 갖고 있다 — `RESOLUTION.md` 가 스스로 "과장이었다"고 인정한 바로 그
    문장이다. `SUMMARY.md` 는 통상 `RESOLUTION.md` 보다 먼저/자주 참조되는 상위 요약 문서라, 정정이
    전파되지 않으면 오히려 거짓 주장이 더 눈에 띄는 자리에 남는다.
  - 제안: `SUMMARY.md:33` 셀에도 동일한 정정 각주(예: "⚠ 실제로는 말미 괄호주만 재작성 — 카운트
    문단은 `0020f9106`(01_44_21)에서 정정, RESOLUTION.md 참조") 추가 또는 "✅" 를 "🔶 부분(01_44_21
    에서 완결)" 로 하향. 필수 조치는 아님(과거 라운드의 이미 닫힌 문서 정정) — 다만 이 프로젝트가
    review 산출물의 audit-trail 정확성을 명시적으로 중요시한다는 점(정확히 이번 요청의 검증 대상 4)을
    고려하면 완결하는 편이 일관적이다.

- **[INFO]** `seedWaitingFromStatus` JSDoc 재작성이 실제 코드(openStream 직전 게이트 2곳)와 정확히
  일치 — `ts.getJSDocCommentsAndTags()` 재실측 포함
  - 위치: `use-widget.ts:502-525`(JSDoc "표면 되감기 vs 이중 스트림" 구분 서술) · `:568`(seed 게이트) ·
    `:673`(`start()` 의 `openStream` 직전 게이트) · `:1018`(`applyConfig` 의 `openStream` 직전 게이트).
  - 상세: 컴파일러 API(`ts.createSourceFile` + `ts.getJSDocCommentsAndTags`)로 재실측한 결과
    `seedWaitingFromStatus` 의 JSDoc 은 **하나의 연속된 JSDoc 노드**(라인 474-536, 3543자, `@param`×3·
    `@returns`(내부 `{@link SeedOutcome}`)×1)로 해당 `VariableStatement` 에 정확히 부착돼 있다(고아
    코멘트 아님, 스크립트 출력: `node range: line 474 - 536`, `raw char count: 3543`). 이 JSDoc 본문
    (§509-525)이 서술하는 "seed 가드는 **표면 되감기만** 막는다 / **이중 스트림**은 호출부의 짝 가드가
    막는다 — `await seedWaitingFromStatus` 와 `openStream` 사이 microtask 경계 때문에 필요"는 코드의
    두 호출부와 라인 단위로 일치한다: `start()`(`:665` seed 호출 → `:668` `isStale` → `:673`
    `if (sessionEstablished()) return;` → `:674` `openStream`)와 `applyConfig`(`:1003` seed 호출 →
    `:1006` outcome 게이팅 → `:1012` `isAttemptStale`(boot+world 축, checkpoint 2, 소유권 정합용) →
    `:1018` `if (sessionEstablished()) return;` → `:1019` `openStream`) 둘 다. 초기 JSDoc 의 "openStream
    이 seed 반환 직후 동기 실행이라 원천 차단" 오판은 코드 JSDoc(`:521` "초기 JSDoc이 … 라 적었으나 그
    microtask 경계를 간과한 오판이었다")과 테스트 주석(`:3400` "내 초기 JSDoc … 은 microtask 경계를
    간과한 오판이었다") 양쪽에서 명시적으로 정정돼 있다. `tsc --noEmit` 클린, `use-widget-eager-start.
    test.ts` 단독 실행 **59/59 passed** 로 재확인(전체 393개 중 이 파일 서브셋).
  - 제안: 없음(검증됨).

- **[INFO]** "boot 축" 오서술 전수 grep — 소스코드에는 잔존 없음, checkpoint 1/2·종료 확정의 boot 서술은
  정확히 구분됨
  - 위치: `use-widget.ts` 전문 + `use-widget-eager-start.test.ts` 전문(둘 다 `boot 축`/`checkpoint 2`/
    `bootAtStart`/`동기 실행`/`원천 차단`/`boot 스냅샷` grep 완료).
  - 상세: seed `WAITING` 게이트를 여전히 boot 축으로 잘못 서술하는 곳은 소스코드에 없다. 남은 "boot 축"
    언급은 전부 실제로 boot 축을 쓰는 지점이거나 과거형 역사 기술이다 — (1) checkpoint 1
    `cannotApplyConfig`(config 적용 경합, `:973`, `boot 축 전용` 서술 정확) · (2) checkpoint 2
    `isAttemptStale`(applyConfig 소유권 정합, `:1012`, "boot+world 재검증" 서술 정확 — 이번 재설계가
    안 건드린 축) · (3) 종료 확정은 "world 만"(boot 안 봄, JSDoc 표 `:504-507`·테스트 제목
    `:3114` "종료 확정은 boot 축을 보지 않는다") · (4) 과거 시점을 정확히 과거형으로 서술하는 역사
    기술(예: test `:3220` "23_58_23 은 이 자리에 boot 스냅샷을 썼다가 … 00_51_53 에서 sessionEstablished
    로 교체했다", plan `:382-391` "9·10번째 거울상"). `0020f9106` 이 직전 라운드(01_44_21) documentation
    리뷰가 정확히 지목한 두 테스트 주석(`:3042`, `:3106` — 당시 boot 축/checkpoint 2 로 오서술)만
    수정하고, 정확한 checkpoint 1/2·종료 확정 서술은 손대지 않았음도 확인 — 제안된 정정 방향
    ("`(boot 축)` → `(sessionEstablished())`", "표면 갱신은 boot 축을 보고 → sessionEstablished() 를
    보고")과 실제 diff 가 의미상 1:1 대응한다(문구는 약간 다르나 요지 동일). `beginBootAttempt` JSDoc
    의 "비대칭 가드 누락 3번" 카운트도 특정 숫자 대신 "여러 번"(+ `23_58_23` 항목 추가)으로 바뀌어,
    향후 5번째 사례가 나와도 재수정이 불필요한 더 견고한 표현으로 개선됐다.
  - 제안: 없음.

- **[INFO]** `CHANGELOG.md` 항목3은 이중 EventSource fix 를 언급하지 않으나, 기존 서술에 반증된 주장은
  없어 사실 오류는 아님
  - 위치: `CHANGELOG.md` Unreleased §"웹채팅 위젯: 마지막 `wc:boot` 적용(§3(재전송))" 항목3("지연 도착한
    `getStatus` seed 가 화면을 되감지 않는다").
  - 상세: `git show --stat 77805bd32`/`0020f9106` 모두 `CHANGELOG.md` 를 건드리지 않았다. 항목3 은
    seed 게이트(표면 되감기 방지)만 서술하고 EventSource 개수·이중 생성에 대해 어떤 주장도 하지
    않으므로 반증된 문장을 포함하지 않는다 — 사실 오류는 없다(완전성 gap일 뿐). 이번 라운드가 찾은
    "이중 EventSource 생성" 결함은 severity 가 MEDIUM/무해(`openStream`=closeStream→set 이라 최종
    상태는 단일 스트림으로 수렴, correctness 버그 아님)로 판정됐고 사용자 가시 영향이 없었다 — 이
    CHANGELOG 가 다른 항목에 채택한 "(사용자 가시 버그 수정)" 라벨 기준에 비춰보면 이 fix 는 원래도
    등재 필수 기준에 못 미칠 가능성이 크다.
  - 제안: 필수 아님. 원하면 항목3 말미에 "(겹친 두 seed 가 같은 microtask flush 에서 동시 통과하는
    좁은 창에서 낭비성 EventSource 재생성이 있었고, 이후 라운드에서 `openStream` 직전 짝 게이트로
    닫았다 — 무해, correctness 영향 없음)" 한 줄만 추가해 완결성을 높일 수 있음 — LOW 우선순위.

- **[INFO]** README·설정 문서 — 신규 env·public API 변경 없음, 갱신 불요 확인
  - 위치: `codebase/channel-web-chat/README.md`, `git show --stat 77805bd32 0020f9106`.
  - 상세: 두 커밋 모두 `use-widget.ts` + 동반 테스트 파일 2개만 변경(신규 env·설정·의존성·public
    API 없음). `README.md` 는 명시적으로 내부 동작을 spec(SoT)에 위임하고("Spec(SoT):
    `spec/7-channel-web-chat/`") 훅 내부 게이트 메커니즘 같은 구현 세부는 다루지 않는 문서라, 이번
    순수 내부 concurrency-hardening fix 에 대한 README 갱신 필요성 없음. grep 결과
    `sessionEstablished`/`EventSource` 언급 자체가 README 에 없음(있어야 할 이유도 없음) — 정합.
  - 제안: 없음.

## 요약

지시받은 핵심 검증 대상(`77805bd32` 의 `seedWaitingFromStatus` JSDoc 재작성)은 실제 코드와 정확히
일치한다 — `start()`·`applyConfig` 의 `openStream` 직전 게이트 2곳을 라인 단위로 대조했고,
`ts.getJSDocCommentsAndTags()` 컴파일러 API 재실측으로 해당 JSDoc 이 고아 코멘트 없이 올바른 심볼에
부착됐음을 확인했다. 내 초기 "openStream 이 seed 반환 직후 동기 실행이라 이중 스트림을 원천 차단한다"는
오판은 코드 JSDoc·테스트 주석 양쪽에서 "11번째 거울상"으로 명시 정정됐다. `boot 축` 서술 전수 grep
결과 소스코드(`use-widget.ts`/`use-widget-eager-start.test.ts`)에는 stale/반증된 서술이 남아있지 않다 —
직전 라운드가 지목한 테스트 주석 2곳은 `0020f9106` 이 정확히 정정했고, checkpoint 1(`cannotApplyConfig`)·
checkpoint 2(`isAttemptStale`)·종료 확정의 boot 관련 서술은 (재설계와 무관한 축이므로) 여전히 정확해
올바르게 손대지 않은 채 남아있다. 다만 **소스코드 밖에서 두 건의 stale 서술을 새로 발견했다**: (1)
`plan/in-progress/webchat-boot-single-flight.md:388` 의 "최종 불변식" 절이 `77805bd32` 로 반증된 "동기
실행이라 원천 차단" 주장을 여전히 사실로 서술 중이며, 이 절 자체가 "이 클래스의 반복 실패를 막기 위한
최종 기록"을 자임하는 자리라 위험이 있다(WARNING). (2) `review/code/2026/07/18/00_51_53/SUMMARY.md:33`
가 자매 문서 `RESOLUTION.md` 는 이미 정정한 "JSDoc 전면 재작성" 거짓 주장을 그대로 보유하고 있다
(WARNING) — `RESOLUTION.md` 의 정정 자체는 `git show cffee0d28` 로 직접 대조해 정확함을 확인했다(질문
4에 대한 답: 정정은 적절하다, 단 전파가 불완전하다). CHANGELOG·README 는 이번 두 커밋과 관련해 갱신
불요이거나(README, 내부 세부라 spec 위임) 완전성 gap만 있고 사실 오류는 없다(CHANGELOG 항목3, INFO).

## 위험도

LOW — CRITICAL 없음. 소스코드(JSDoc·인라인 주석·회귀 테스트 주석)는 이번 두 라운드(`77805bd32`/
`0020f9106`)를 거쳐 정확하고 실제 게이트 구현과 완전히 정합한다. 발견한 두 WARNING 은 모두 **코드 밖**
문서(plan 진행기록·과거 review 산출물 SUMMARY)의 정정 전파 gap이며 런타임·사용자 영향은 없다 — 다만
정확히 "잘못된 불변식을 최종으로 기록"이라는, 이 프로젝트가 10회 넘게 반복 경험한 실패 패턴과 같은
계열이라 방치 시 향후 리팩터링에서 재발 위험이 있어 WARNING 으로 유지한다.

STATUS=success documentation PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/02_25_54/documentation.md risk=LOW
