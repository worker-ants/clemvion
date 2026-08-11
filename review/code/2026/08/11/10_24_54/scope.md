# 변경 범위(Scope) Review

대상: `claude/webchat-reload-rest-branches` (34 commits, `origin/main` 대비) — 130개 변경 파일
(코드 8·spec 2·plan 6·review 아티팩트 ~114). 최신 커밋 `dfaebfcdc`(10_02_22 라운드 산출물),
직전 코드 커밋 `f924815f1`.

## 발견사항

- **[INFO]** RESOLUTION(`10_02_22`)의 검증 가능한 주장은 전부 실측과 일치
  - 위치: `review/code/2026/08/11/10_02_22/RESOLUTION.md` C1·C2 절, 대상 커밋 `f924815f1`
  - 상세: 다음을 워킹트리를 바꾸지 않고 직접 재현했다.
    - **리듀서 매핑**: `codebase/channel-web-chat/src/lib/widget-state.ts:190-191`
      (`case "ERROR": return { ...state, phase: "ended", ..., error: action.message }`) —
      RESOLUTION 이 적은 "리듀서는 `phase: "ended"` + `error` 로 매핑한다"와 정확히 일치.
    - **Gate C 별도 실행**: `codebase/frontend` 에서
      `npx vitest run src/lib/docs/__tests__/spec-plan-completion.test.ts` 를 독립적으로 재실행
      → **814 passed** (RESOLUTION 의 "814 GREEN" 수치와 정확히 일치). `f924815f1` diff 에서
      `plan/complete/webchat-reload-rest-error-branches.md` frontmatter 에 `spec_impact:`
      (2개 spec 파일) + `worktree: spec-small-followups` 가 실제로 추가됐음을 `git show` 로 확인.
    - **위젯 테스트/타입체크**: `codebase/channel-web-chat` 에서 `npx vitest run` →
      **436 passed (23 files)**, `npx tsc --noEmit` → **0 errors**. RESOLUTION 검증 절
      수치와 일치.
    - **신규 회귀 테스트의 신규성**: `use-widget-eager-start.test.ts` 의
      `"§보안·§고착: 복원 경로의 스트림 오픈 실패…"` 테스트를 직전 커밋(`bd4e5b35f`) 시점
      파일과 대조 — 해당 시나리오(복원 분기 `openStream` throw → `ended`+`error` 단언)는
      그 시점에 **존재하지 않았다**. RESOLUTION 의 "신규 회귀" 표현과 일치.
  - 제안: 없음(주장이 검증됨).

- **[INFO]** "뮤테이션 RED 3건(신규 1 + 기존 2)" 중 "기존 2건"은 이번 세션에서 실측 재현하지 못함
  - 위치: `review/code/2026/08/11/10_02_22/RESOLUTION.md` C1 절 "뮤테이션: dispatch 를 종전의
    warn-only 로 되돌리면 3건 RED(신규 회귀 + 기존 2건)"
  - 상세: 실제로 `dispatch({type:"ERROR",...})` (`use-widget.ts:1272`) 를 원래 형태
    (`console.warn(...)`)로 되돌려 재현하려 했으나, 이번 도구 호출이 권한 분류기에 의해
    차단됐다(소스 파일 쓰기 시도가 거부됨 — 워킹트리 미변경 지시를 준수하기 위해 재시도하지
    않았다). 정적 분석으로는: `dispatch({type:"ERROR",...})` 호출이 파일 전체에 3곳
    (`start()` catch 890행, `sendCommand` catch 934행, `runApplyConfig` catch 1272행)
    있고 이번 라운드가 건드린 것은 `runApplyConfig` 한 곳뿐이다. 신규 회귀 1건은 위에서
    독립 확인했지만, 같은 `runApplyConfig` catch 를 다른 진입 경로(예: `isEmbedAllowed`·
    `establishConfig` 실패 등)로 이미 겨냥하던 **기존** 테스트 2건이 무엇인지는 grep 만으로
    특정하지 못했다.
  - 제안: 반증하는 것은 아니나(정황상 개연성은 있다 — `runApplyConfig` catch 를 건드린
    변경이 유일하고, "3건" 이 그 catch 한 곳으로 수렴하는 값이라는 서술은 일관적이다),
    다음부터 RESOLUTION 에 "기존 2건"을 `it(...)` 제목으로 구체 지목하면 사후 감사가 쉬워진다.

- **[INFO]** RESOLUTION 이 자인한 "두 번의 오판"은 서술형 주장이라 커밋 이력만으로 직접 검증 불가
  - 위치: `review/code/2026/08/11/10_02_22/RESOLUTION.md` C1 절 마지막 인용문
    ("이 검증에서 내가 두 번 틀렸고 둘 다 실측이 뒤집었다…")
  - 상세: "뮤턴트가 파일에 실제로 앉았는지 확인 안 하고 vacuous 로 오판"·"`ERROR`가
    `phase:"error"`로 간다고 가정하고 코드 미확인" 은 세션 내부 디버깅 과정에 대한 서술이라
    그 시행착오 자체는 git 아티팩트에 남지 않는다 — 반증도 입증도 직접적으로는 불가능한
    범주다. 다만 (a) 이 서술이 가리키는 **결과**(리듀서가 실제로 `phase:"ended"`+`error` 로
    매핑한다는 사실)는 위 1번에서 코드로 확인됐고, (b) "뮤턴트 적용 여부를 실측 전에
    판단하지 말라"는 형태는 이 프로젝트가 이미 반복 기록해 온 교훈과 결이 같아(뮤테이션
    유효성 관련 기존 사례들과 동형) 지어낸 서술로 의심할 근거는 없다.
  - 제안: 없음 — 서술형 주장의 구조적 한계로 기록.

- **[WARNING]** `10_02_22/SUMMARY.md` 자체의 reviewer별 Warning 개수 표와 실제 W1~W7 나열의
  attribution 이 서로 어긋난다(합계만 우연히 일치)
  - 위치: `review/code/2026/08/11/10_02_22/SUMMARY.md` 집계 표 vs `## Warning` 표
  - 상세: 집계 표는 `side_effect=2`·`requirement=1`·`scope=1`(Warning 합계 9)로 적지만,
    실제 W1~W7 목록을 reviewer 별로 세면 `side_effect`는 W1 1건뿐, `requirement`는
    W1+W7 2건, `scope`는 W2+W6 2건이다 — 세 reviewer 모두 표와 실제가 다르고, 우연히
    총합(9)만 맞는다. 파일 맨 아래 `## WARNING_COUNT: 7` 은 목록 항목 수(7)와는 맞지만
    표의 합계(9)와는 다시 어긋난다. RESOLUTION 은 "Warning 7 전부 처분"이라 적어 개수를
    목록 기준(7)에 맞춰 일관되게 다뤘고, 실제로 W1~W7 전부 RESOLUTION 본문에서 언급됨을
    확인했다 — 처분 자체의 누락은 없다. 다만 SUMMARY 표의 산술 오류는 그대로 남아 있다.
  - 제안: scope 리뷰 소관 밖(documentation 성격)이나, RESOLUTION 이 근거로 삼는 집계표에
    산술 결함이 있다는 점은 다음 documentation 라운드에서 잡을 만하다. 이번 처분의 정합성
    자체를 무효화하지는 않는다.

- **[INFO]** plan 상호 링크 재배치(`./webchat-reload-rest-error-branches.md` →
  `../complete/webchat-reload-rest-error-branches.md`)는 이 PR 이 만든 링크 파손의 기계적
  후속수정 — 스코프 내
  - 위치: `plan/in-progress/webchat-command-failure-is-not-termination.md`,
    `plan/in-progress/webchat-usewidget-extraction.md`
  - 상세: 두 plan 모두 형제 plan 이 이 PR 안에서 `in-progress/` → `complete/` 로 이동했기
    때문에 생긴 상대경로 파손을 같은 PR 에서 고친 것이다. 이동을 일으킨 PR 이 그 부수효과를
    같이 정리하는 것은 범위 이탈이 아니라 정상적 마무리다.
  - 제안: 없음.

- **[INFO]** 누적 diff 의 코드 파일 footprint 는 하나의 인과 사슬 위에 있다 — 무관 모듈 없음
  - 위치: `codebase/channel-web-chat/src/lib/{eia-client.ts,eia-client.test.ts,session-store.ts}`,
    `codebase/channel-web-chat/src/widget/{use-widget.ts,use-widget-eager-start.test.ts,
    use-token-refresh.ts,use-token-refresh.test.ts}`, `CHANGELOG.md`,
    `spec/7-channel-web-chat/3-auth-session.md`, `spec/0-overview.md`
  - 상세: 최초 커밋(`deb9b6978`, "재로드 REST 오류 분기 3종 구현")부터 최신(`f924815f1`)까지
    9회의 ai-review 라운드가 이어졌지만, 실제로 건드린 코드 파일은 전부 SSE 스트림 오픈 →
    토큰 노출 → 세션/부팅 상태 전이라는 **같은 함수 군**(`openStream`·`applyConfig`·
    `seedWaitingFromStatus`·`recoverFromExpiredToken`)의 인접면이다. 관리 콘솔·다른 채널·
    백엔드 등 무관 모듈은 전혀 건드리지 않았다. `isTerminalAuthError`·`applyRefreshedToken`
    두 신규 공유 함수는 `use-widget.ts`·`use-token-refresh.ts` **양쪽 모두**에서 실제로
    소비됨을 grep 으로 확인했다(죽은 추상화 아님).
  - 제안: 없음 — 파일 단위로는 스코프 이탈 없음.

## 범위 판정 — 어느 지점에서 멈췄어야 했는가

**결론: 지금 형태는 응집적이다. 그러나 "멈출 지점"을 요구한다면 `18_23_54`~`18_51_07` 사이,
즉 세 진입점 전수 redaction 이 끝난 시점이 합리적인 체크포인트였다.**

근거:

1. **9라운드 확장의 대부분은 새 기능이 아니라 이 PR 자신의 앞선 fix 가 만든 회귀를 그
   PR 안에서 되짚은 것이다.** `10_02_22` C1 자체가 "이 PR 이 고치려던 형태를 이 PR 의
   직전 fix 가 성공 경로에서 재현했다"는 자기 회귀이고, `16_09_40`·`18_23_54` 등 앞선
   라운드들도 형태가 같다 — 커밋 메시지가 스스로 "여덟 번째 같은 뿌리"라 적을 정도로
   반복됐다. 자신이 같은 브랜치에서 만든 회귀를 같은 PR 안에서 고치는 것은 스코프 이탈이
   아니라 오히려 필수다 — 분리했다면 알려진 CRITICAL(부팅 실패 고착) 위에서 머지하게 된다.
2. **로그 redaction 확장(3개 진입점 전수)까지는 명백히 필요했다** — 처음 fix 가 한
   진입점에만 적용됐던 것 자체가 이 PR의 앞선 커밋이 만든 결손이었고(`18_23_54` 발견),
   나머지 두 곳(`start()`, `applyConfig`)을 방치하면 같은 취약점이 절반만 닫힌 채 머지된다.
3. **경계선에 있는 두 갈래**: (a) SSE `onError` 진단 필드를 `e.type`(죽은 값)에서
   `readyState`로 개선한 것(W1/W5, `10_02_22`)과 (b) `applyRefreshedToken`/
   `isTerminalAuthError` 공유 헬퍼 추출은 보안 결함의 직접 수정이라기보다 **관찰가능성·
   유지보수성 개선**에 가깝다. 둘 다 "같은 파일이 반복해 낸 결함 클래스"라는 구체적 근거
   (JSDoc 에 CRITICAL 재발 2회 명시)를 대고 있어 무리한 확장은 아니지만, 순수 보안
   correctness 관점에서는 후속 plan/backlog 로 넘겨도 무방했을 항목이다.
4. **부팅 실패 상태 전이(`f924815f1`, `10_02_22` C1)는 다시 되돌릴 수 없는 선을 넘은 종류다**
   — `dispatch` 를 빼먹은 채 머지됐다면 이 PR 이 원래 고치려던 증상(고착)을 다른 경로로
   재도입한 상태로 남는다. 이건 명백히 이번 PR 범위 안에서 마무리해야 하는 항목이었다.
5. **plan 위생은 실제로 지켜졌다** — 사이드 발견 중 이 PR 범위를 벗어나는 것(예:
   `1-widget-app.md §2` Form 실패 표시 약속과 `ERROR→ended` 매핑의 불일치, `use-widget.ts`
   934행 주변 주석 "남은 gap(이 PR 범위 밖)…이 PR 이전부터 있던 문제라 여기서 넓히지
   않고 plan 에 이월했다")는 실제로 손대지 않고 기존 plan(`plan/complete/
   spec-sync-form-gaps.md` 등)에 위임됐음을 확인했다. `16_09_40` 라운드에서도 머지 순서
   의존 문제를 신규 plan(`webchat-auth-session-status-reconcile.md`)으로 분리했다 —
   "review 는 SoT 아니다, 미룬 항목은 plan 에 적어라"는 원칙이 이번 PR 안에서 반복
   실천됐다.

**요약 판단**: 파일 footprint 기준으로는 스코프 이탈이 없고(무관 모듈 0), 자기 회귀를
자기 PR 에서 되짚는 패턴이 반복 확장의 대부분을 설명한다. 다만 (a) 로그 redaction 이
세 진입점 전수로 끝난 `18_23_54`~`18_51_07` 시점 이후에 추가된 두 갈래(SSE 진단 필드
개선, 공유 헬퍼 추출)는 "이 PR 이 만든 회귀의 수정"이 아니라 "이 PR 이 발견한 별개
품질 개선"에 더 가까워, 그 시점에 한 번 멈춰 별도 plan(`webchat-token-handling-
hardening` 류)으로 분리했더라도 프로세스상 더 깔끔했을 것이다. 그러나 실제로 그
갈래들도 최종적으로는 CRITICAL(부팅 실패 재발)과 얽혀 같은 커밋에 들어갔기 때문에,
사후적으로 보면 지금 형태(단일 PR)가 "틀렸다"고 하기보다는 "체크포인트를 한 번 더
둘 수 있었다" 정도의 개선 여지로 보는 것이 타당하다.

## 요약

이 PR 은 명목상 "재로드 REST 오류 분기 3종 구현"에서 출발해 9회의 ai-review 라운드를
거치며 로그 redaction 전수화·SSE 진단 필드 개선·부팅 실패 상태 전이 수정까지 확장됐지만,
건드린 코드 파일은 전부 SSE 스트림 오픈/토큰/세션 상태 전이라는 하나의 인과 사슬 위에
있고 무관 모듈은 없다. 확장의 대부분은 새 기능이 아니라 이 PR 자신의 앞선 커밋이 만든
회귀(특히 두 차례의 CRITICAL — 갱신 전 토큰으로 SSE 오픈, 부팅 실패 고착)를 같은 PR
안에서 되짚은 결과이며, 이는 스코프 이탈이 아니라 "머지 가능한 상태로 남기기" 위한
필수 수정이다. `10_02_22/RESOLUTION.md` 의 검증 가능한 처분 주장(리듀서 매핑, Gate C
814/814, 위젯 vitest 436, tsc 0 errors, 신규 회귀 테스트의 신규성)은 이번 세션에서
독립적으로 재실행해 전부 일치를 확인했다. 다만 "뮤테이션 RED 3건 중 기존 2건"의 구체적
정체와 "두 번의 오판" 서술은 아티팩트만으로 직접 검증 가능한 범주를 넘어서며(전자는
권한 분류기가 실측 재현을 막았고, 후자는 세션 내부 서술이라 본질적으로 사후 검증 불가),
개연성은 있으나 완전한 확증은 아니다. 부수적으로 `SUMMARY.md` 자체의 reviewer별 Warning
집계 표에 산술 오류(합계는 우연히 일치, 개별 attribution 은 3곳에서 어긋남)를 발견했다 —
처분 누락은 없었지만 다음 documentation 라운드에서 정정할 만하다. 스코프 관점에서
"멈췄어야 할 지점"을 굳이 꼽자면 redaction 전수화가 끝난 `18_23_54`~`18_51_07` 이후
추가된 진단 필드 개선·공유 헬퍼 추출 갈래이나, 그마저도 결국 같은 커밋에서 CRITICAL과
얽혔기 때문에 지금 단일 PR 형태를 잘못됐다고 보긴 어렵다.

## 위험도

MEDIUM
