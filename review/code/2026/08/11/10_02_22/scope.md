# 변경 범위(Scope) Review

## 사전 검증: `18_51_07/RESOLUTION.md` 처분 주장 vs 커밋 `bd4e5b35f`

`git show bd4e5b35f`(및 관련 파일별 diff)로 실제 커밋 내용을 직접 대조했다. 워킹트리를 바꾸는
명령은 사용하지 않았다(`git show`/`git log`/`grep`/`Read` 만 사용).

- **일치 확인**: 커밋 메시지·diff 가 `RESOLUTION.md` 서술(진입점 3곳 redaction, `applyConfig`
  헬퍼 통합, SSE `onError` 타입만 로깅, `redactToken` JSDoc 위협모델 정정, `use-token-refresh.test.ts`
  의 `shouldAdvanceTime` 제거)과 **전부 일치**한다.
- **"뮤테이션 2종 RED" 검증**: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
  에 이번 커밋이 추가한 신규 `it` 은 정확히 2개 — `§보안: start() 경로...`(현재 라인 733)와
  `§보안: SSE onError...`(현재 라인 752, `emitError` 헬퍼는 라인 43). `RESOLUTION.md`(라인 33)가
  주장하는 "뮤테이션 2종 RED"(`errMessage` redaction 제거 / `onError` 원본 이벤트 복원)와 정확히
  1:1 대응한다 — **과대주장 없음**. 단, `applyConfig`(C2) 쪽 fix 에는 대응하는 회귀 테스트가
  **하나도 없다**(아래 발견사항 참조 — `RESOLUTION.md` 자신도 이 셋째 픽스에 대한 뮤테이션/회귀를
  주장하지 않으므로 이 자체는 허위 주장이 아니다. 다만 커버리지 공백은 실재한다).
- **"W2 는 근거를 들어 적용하지 않았다" 검증**: `RESOLUTION.md` 라인 23-27 이 "그 외 `console.warn`
  지점은 Bearer 헤더 방식이라 토큰이 문자열에 실릴 수 없다" 는 근거를 명시한다. 독립적으로
  `eia-client.ts` 를 확인(라인 72-114 부근): `submitCommand`/`getStatus`/`refreshToken` 은 전부
  `headers: { authorization: `Bearer ${token}` }` 이고, 토큰이 URL 쿼리에 실리는 지점은
  `openStream`(라인 120-129, `endpoints.stream?token=`) **하나뿐**이다. `use-widget.ts`/
  `use-token-refresh.ts` 의 나머지 `console.warn` 호출(예: `use-widget.ts:540,730,1025,1075`,
  `use-token-refresh.ts:172,183`)은 전부 `refreshErr.message`/`err.message` 등 Bearer 방식 fetch
  오류를 찍는 자리라, 실제로 토큰이 URL 형태로 실릴 수 없다. **근거가 사실과 일치한다.**
- **"전제 정정" 검증**: `eia-client.ts` diff(라인 184-198 부근)에서 "호스트 페이지의 다른
  스크립트가 콘솔을 읽을 수 있다" 문구가 제거되고 "위젯은 cross-origin iframe 이라 호스트 realm 이
  이 realm 의 `console` 을 패치·읽을 수 없다" 로 교체된 것을 확인. `RESOLUTION.md`(라인 59-70)의
  서술과 코드가 일치한다.

### 발견사항 (검증 과정에서 드러난 것)

- **[WARNING]** `applyConfig`(C2) redaction 픽스에 회귀 테스트가 없고, 그 공백이 어디에도
  기록되지 않았다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `runApplyConfig`(현재 라인
    1243-1250) / `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(전체)
  - 상세: `RESOLUTION.md` 라인 29-31 이 명시한 회귀는 `start()` 경로와 SSE `onError` 둘뿐이고,
    `applyConfig` 의 unhandled-rejection→catch+redact 전환(C2, 이번 라운드의 **CRITICAL 2건 중
    하나**)을 직접 겨냥하는 테스트는 `grep`(`runApplyConfig`, `boot config 적용 실패`,
    `bridge.onBoot` 관련 테스트 전수)으로 확인한 결과 **존재하지 않는다**. 이 저장소는 같은 PR
    체인 안에서 "지금 안 고치는 이유"·"남은 갭"을 코드 주석 + `plan/`에 명시적으로 기록하는
    관례를 반복 준수해 왔는데(`webchat-auth-session-status-reconcile.md` 의 여러 절이 그 예),
    이 갭만 그 관례에서 빠졌다 — `RESOLUTION.md`·`SUMMARY.md`·`plan/complete/
    webchat-reload-rest-error-branches.md`·`plan/in-progress/webchat-auth-session-status-reconcile.md`
    어디에도 "C2 는 회귀가 없다"는 언급이 없다.
  - 제안: `applyConfig` 경로에도 `start()`/`onError` 와 대칭인 회귀(예: bridge `onBoot` 콜백을
    통해 `openStream` 이 던지도록 만들고 `console.warn` 출력에 토큰 부재 + `token=<redacted>`
    존재를 단언) 1건을 추가하거나, 최소한 왜 없는지를 `RESOLUTION.md`/plan 에 명시할 것.

- **[INFO]** `RESOLUTION.md` 자체의 절 제목과 본문이 상충한다(문서 내부 모순, 매우 경미)
  - 위치: `review/code/2026/08/10/18_51_07/RESOLUTION.md:5`(절 제목) vs `:23`(본문)
  - 상세: 절 제목 `## C1·C2·W1·W2·W5 — redaction 을 진입점 전부에 → **고침**` 은 W2 를 "고침"
    범주에 넣지만, 바로 아래 라인 23 은 "**W2**...는 **적용하지 않았다.**" 라고 명시적으로
    반대로 말한다. 실제 처분(적용 안 함 + 근거)은 정확하므로 실질적 오류는 아니지만, 제목만
    보는 독자는 W2 도 반영됐다고 오독할 수 있다.
  - 제안: 조치 불요(경미) — 다음에 이 절을 다시 열 때 제목에서 W2 를 빼거나 `(W2 는 미적용,
    아래 참조)` 를 덧붙이면 재오독을 줄인다.

## 범위 판정 — (b) `applyConfig` unhandled rejection 닫기 · (c) SSE `onError` 로그 축소가 이 티켓 범위인가

**사실관계 확인**(git 히스토리 실측, worktree 비변경):

- `errMessage()`(`use-widget.ts` 현재 라인 1325)의 무-redaction `console.warn` 과 SSE
  `onError`(라인 477-483)의 원본 이벤트 로깅은 `git show origin/main:codebase/channel-web-chat/src/widget/use-widget.ts`
  에도 동일하게 존재한다 — 즉 **이 브랜치가 시작되기 전부터 있던 코드**다.
- 더 거슬러 올라가면 `git log --oneline -- codebase/channel-web-chat/src/lib/eia-client.ts` 의
  최초 커밋 `a652f8733`("임베드형 웹채팅 위젯 + SDK", #384)까지 `openStream`·`console.warn` 패턴이
  이어진다. `applyConfig`(`void applyConfig(...)`, catch 없음)도 origin/main 라인 982/1018 에서
  동일하게 확인된다.
- 이 PR(브랜치) 이 새로 만든 유일한 토큰 노출은 `resumeDeferredStream`/`recoverFromExpiredToken`
  경로의 신규 `catch` 였다(직전 라운드 `38b49780e` 커밋 메시지가 "**내가 추가한 catch** 의
  `console.warn`" 이라고 스스로 명시). 즉 **(b)(c) 는 사용자 지적대로 이 PR 이 만든 노출이
  아니라 기존 결함이다** — git 히스토리로 확정된다.

**정당성 판단**: 결론적으로 **같은 PR 안에서 닫은 것이 방어 가능하나, 근거가 완전히 매끈하지는
않다.**

찬성 근거:
1. `redactToken` 자체가 이 PR 이 새로 만든 유틸리티이고, `applyConfig`·`onError`·`errMessage` 는
   전부 이 PR 이 이미 대폭 수정 중인 파일(`use-widget.ts`)의 함수다. 새 방어 메커니즘을 "만든
   시점에 만든 파일 안에서 형제 호출부까지 전수로 덮는다"는 판단은 사용자 메모리에도 기록된 이
   프로젝트의 반복 관례("방어의 정의를 한 칸 좁게 잡는다" 패턴을 능동적으로 경계)와 부합한다.
2. `CLAUDE.md` 는 "구현 완료 후 `/ai-review` + Critical/Warning fix 는 상시 승인된 강제 의무"
   라고 명시한다 — 이 PR 의 forced 7명 리뷰(`18_51_07`)가 CRITICAL 로 낸 이상, 반영은 그 자체로
   규약 준수다. 리뷰가 diff 범위를 벗어나 파일 전체 맥락(`openStream` 호출부 전수)까지 본 것은
   security reviewer 의 정상 재량이다.
3. 실제 코드 변경 크기가 작다(각 픽스 수 줄, 신규 파일·의존성 없음) — 별도 티켓으로 쪼갠다고
   리스크나 리뷰 비용이 유의미하게 줄지 않는다.

반대/유보 근거:
1. 티켓 제목("재로드 REST 오류 분기")과 `CHANGELOG.md` 항목(파일 1, 라인 166-175)은 `404`/`401`/
   `410` 분기 동작만 서술하고, 이번에 추가된 일반 로그-redaction 하드닝(진입점 3종)은 **전혀
   언급하지 않는다** — CHANGELOG 관례("사용자-관측 가능 동작 변경"뿐 아니라 이전 라운드
   `54a181f0a` 는 문서화 관례 위반 자체를 WARNING 으로 잡았던 선례가 있다)에 비춰보면, 보안
   하드닝처럼 향후 참조 가치가 있는 변경이 CHANGELOG 에서 빠진 것은 완전히 매끈하다고 보기
   어렵다.
2. (b)(c) 는 "이 PR 이 새로 만든 방어의 형제 호출부"라기보다는, **이 PR 이전부터 한 달 이상
   존재해 온 별개의 오래된 코드**다. 유일하게 "이 PR 의 방어"인 것은 `resumeDeferredStream`
   뿐이고, 그 방어가 좁았던 것을 고치는 것과, **그 방어와 무관하게 애초부터 있던 두 지점**의
   결함을 같은 이름("진입점 전수")으로 묶어 처리한 것은 논리적으로 구분되는 두 개의 결정이
   하나로 합쳐진 것이다. `RESOLUTION.md`/`SUMMARY.md` 도 "정확히 그 형태로 걸렸다"(같은 실수의
   반복)로 프레이밍하는데, 실제로는 "이 PR 의 실수"(진입점 1/3 만 덮음)와 "레거시 결함"(나머지
   2/3 이 애초에 방어가 없었음)이 섞여 있다 — 이 구분이 리뷰 문서 어디에도 명시되지 않는다.
3. 위 발견사항의 커버리지 공백(C2 무-회귀)은, 만약 (b)가 애초에 "이 PR 의 부산물"이 아니라
   "별도 하드닝 티켓"으로 갔다면 그 자체 리뷰·테스트 사이클을 거쳤을 가능성이 높다는 점에서
   이번 처리의 완성도가 다소 급했음을 방증한다.

**종합**: 차단할 사안은 아니다(CLAUDE.md 의 강제 fix 의무·작은 diff·같은 파일이라는 세 조건이
정당화 근거로 충분히 작동한다). 다만 "이미 결정된 사실 동기화"급으로 조용히 넘어갈 사안도
아니다 — 최소한 CHANGELOG 에 한 줄, 그리고 C2 회귀 테스트 공백을 명시적으로 기록해 두는 편이
이 저장소의 다른 모든 유사 사례(레거시 결함을 같은 PR 에서 닫을 때 근거를 남기는 관례)와
일관된다.

## 그 외 범위 관점 점검 (요청 파일 전체)

- **[INFO]** 커밋에 포함된 산출물 다수(review/code/**, plan/** 링크 정정, spec/0-overview.md
  미러)는 이 저장소의 명시 관례(리뷰 산출물은 `review/code/**` 커밋 대상, plan 이동 시 역링크
  전수 정정 의무)에 부합하는 부수 변경이지 무관한 리팩토링이 아니다. `plan/in-progress/
  webchat-command-failure-is-not-termination.md`(파일 12)·`webchat-usewidget-extraction.md`
  (파일 14)의 1줄 링크 경로 정정(`./webchat-reload-rest-error-branches.md` →
  `../complete/webchat-reload-rest-error-branches.md`)은 plan 이 `complete/` 로 이동한 데 따른
  기계적 동기화이며 스코프 이탈이 아니다.
- **[INFO]** 무관한 포맷팅·주석 변경·미사용 임포트 정리는 발견되지 않았다. `eia-client.test.ts`
  의 import 추가(`isTerminalAuthError, redactToken`)는 같은 파일에서 새로 추가한 두 유틸리티의
  테스트에 대응하는 필수 변경이다.

## 요약

`18_51_07/RESOLUTION.md` 의 처분 주장(뮤테이션 2종 RED·W2 미적용 근거·전제 정정)은 커밋
`bd4e5b35f` 대조 결과 **전부 사실과 일치**하며 과대·허위 주장은 없다. 다만 검증 과정에서
`applyConfig`(C2) 픽스에 회귀 테스트가 전혀 없고 그 공백이 어디에도 기록되지 않은 점, 그리고
`RESOLUTION.md` 절 제목과 본문의 경미한 상충을 새로 발견했다. 범위 판정 관련: (b) `applyConfig`
unhandled rejection 닫기와 (c) SSE `onError` 로그 축소는 git 히스토리로 확정되는 **기존 결함**
(이 PR 이 만든 노출이 아님)이며, 같은 PR 안에서 닫은 결정은 CLAUDE.md 의 강제 review-fix 의무·
작은 diff 크기·같은 파일이라는 근거로 방어 가능하나, "이 PR 자신의 방어가 좁았다"는 프레이밍과
"애초부터 있던 레거시 결함을 같이 닫았다"는 사실이 리뷰 문서에서 명확히 구분되지 않았고
CHANGELOG 에도 반영되지 않아 완전히 매끈한 처리는 아니다. 차단 사유는 아니다.

## 위험도

LOW
