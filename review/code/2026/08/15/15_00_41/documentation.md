# 문서화(Documentation) 리뷰 — EIA `durationMs` DB=wire 불변식 (3차 라운드, `15_00_41`)

## 사전 확인 — 직전 두 라운드(`13_58_27`, `14_47_14`) 대비 무엇이 새로 들어왔는가

이번 diff 는 `origin/main`(8c2bddbcd, #1171) 대비 5개 커밋(692dfa00e → b4d0ca27e →
b2fd44447 → 5bd198354 → bf0f86ca8)의 누적이다. 앞 두 라운드가 이미 문서화 관점을
매우 촘촘히 훑었고(`13_58_27` WARNING 2, `14_47_14` WARNING 2, 전부 조치 완료),
CHANGELOG·JSDoc·spec §5.3/§6.5·KO/EN 유저가이드 교차 참조는 실제로 정확했다(직접
`Read` 로 재대조 완료). 이번 라운드에서 새로 확인한 것은 최신 커밋
(`bf0f86ca8`, W1/W2/INFO18 조치)이 소스에 정확히 반영됐는지와, **그 두 라운드가
놓친 자리**다.

- `bf0f86ca8` 의 W1(자매 주석 극성 캐비엇) — `execution-engine.service.ts:4994-4999`
  에 반영 확인. W2(nullable 목록에 `durationMs`) —
  `execution-status-response.dto.spec.ts:124` 확인. INFO18(CHANGELOG 경로 통일) —
  `CHANGELOG.md:17` 확인. 셋 다 정확히 적용됨.

## 발견사항

- **[WARNING]** `spec/conventions/node-cancellation.md` 가 **이미 되돌려진 중간 커밋의 동작**을
  여전히 서술한다 — "모두 skip" + "자매와 동형" 은 최종 코드와 모순
  - 위치: `spec/conventions/node-cancellation.md:198` (§2.4 표, `finalizeCancelledExecution` 행),
    `spec/conventions/node-cancellation.md:210-211` (Rationale)
  - 상세: 이 두 자리는 `692dfa00e` 가 함께 써 넣었다 — 그 커밋의 코드는
    `if (!persisted) return;` 로 **0행이면 무조건 skip** 하는 로직이었고, 문서도
    정확히 그걸 서술했다("**...emit 을 모두 skip**", "그 결과를 읽어 종결 이벤트 emit 을
    skip 한다", "자매 `finalizeFailedExecution` 과 **동형**"). 그런데 바로 다음 커밋
    `b4d0ca27e`("내 첫 수정이 사용자가 누른 Stop 을 침묵시켰다")가 **이 로직을 다시
    바꿨다** — 0행이면 DB 를 재조회해 `live.status === CANCELLED` 면 **그래도 emit 한다**
    (case a), FAILED/COMPLETED 로 선점된 경우만 skip 한다(case b). `execution-engine.service.ts`
    의 최신 JSDoc(4872-4879)·인라인 주석(4904-4914)이 이 비대칭을 스스로 명시한다:
    *"두 함수는 극성이 반대라 같은 가드를 복사하면 안 된다"*. `b4d0ca27e` 는 코드·테스트·
    plan·spec §5.3/§6.5 를 광범위하게 고쳤지만 **`spec/conventions/node-cancellation.md`
    는 건드리지 않았다**(`git show b4d0ca27e --stat` 로 확인 — 이 파일이 목록에 없음).
    그 결과 이 convention 문서는 지금 실제 코드가 하지 않는 동작("무조건 skip")을
    "회귀 테스트로 고정" 이라고까지 단정하며, 실제로는 성립하지 않는 대칭("동형")을
    주장한다.
    이 결함 클래스가 이 PR 전체의 출발점이다 — CHANGELOG·plan·commit 메시지가 스스로
    "문서한 보장이 구현보다 넓으면 안 된다"·"같은 과대서술의 세 번째 자리"라고 세 번
    반복해 기록했는데, 바로 그 교훈을 담아야 할 convention 문서 자신이 지금 (반대
    방향으로) 같은 함정에 빠져 있다: 실제로는 조건부인 동작을 단순 대칭으로
    과소·오서술한다. 이 표는 §2.4 의 "이 표에 없으면 커버리지가 아니다" 류 문서라
    다음에 유사한 guarded-cancel 경로를 추가하는 사람이 이 행만 읽고 "0행이면 항상
    skip 하면 된다"·"자매와 동형이니 그대로 복사해도 된다" 고 판단할 위험이 있다 —
    바로 이 시나리오(자매를 형태만 보고 복사)가 `13_58_27` W3 사고의 원인이었다.
    `13_58_27`·`14_47_14` 두 라운드의 documentation 리뷰가 이 Rationale 블록을 직접
    읽고도(`14_47_14/documentation.md` "§2.4 Rationale 정정도... 모범적인 처리다") **취소선
    +정정 노트라는 형식**만 확인했을 뿐, 정정된 **내용**이 그 시점 이후 커밋(`b4d0ca27e`)의
    최종 동작과 일치하는지는 대조하지 않아 놓쳤다.
  - 제안: `finalizeCancelledExecution` 행(§2.4 표)과 Rationale 209-211행을 다시 정정한다 —
    "0행이면 재조회해 DB 가 CANCELLED 면 발행(값은 DB 정본으로 교체), FAILED/COMPLETED
    로 선점됐으면 skip" 로 바꾸고, "자매와 동형"은 "guarded UPDATE + 반환 확인이라는
    **형태**는 같지만 `!persisted` 이후 **극성은 반대**"로 정정. 이 저장소 관행대로
    `~~원문~~` + `**(2026-08-15 재정정)**` 패턴으로 이력을 보존할 것.

- **[WARNING]** `plan/in-progress/eia-db-wire-invariant.md` 체크리스트가 두 번째
  `/ai-review` 라운드(`14_47_14`, WARNING 2, `bf0f86ca8` 로 조치 완료)의 실행·해결을
  전혀 기록하지 않는다
  - 위치: `plan/in-progress/eia-db-wire-invariant.md:107-119` (`## 체크리스트`)
  - 상세: 체크리스트 113-114행은 `13_58_27` 라운드(CRITICAL 0/WARNING 10, RESOLUTION
    참조)만 `[x]` 로 기록한다. 117행은 여전히 *"fix 이후 fresh `/ai-review` (코드가
    리뷰보다 나중이라 게이트 1 미충족)"* 라고 미체크 상태로 남아 있는데, 이 문구가
    쓰인 시점(`5bd198354` 무렵) 이후 실제로 `14_47_14` fresh review 가 **돌았고**,
    WARNING 2건(자매 주석 극성 캐비엇 부재, nullable 목록 누락)을 냈으며, `bf0f86ca8`
    가 **이미 조치했다**(review/code/2026/08/15/14_47_14/RESOLUTION.md 로 확인). 파일
    전체를 `grep -n "14_47_14"` 해도 plan 문서 어디에도 이 라운드가 언급되지 않는다
    — `git log -S` 로도 이 문자열이 plan 파일에 추가된 적이 없음을 확인했다. 이
    저장소가 기록한 "같은 `durationMs` 계열에서 트래커 미동기화가 이미 네 번
    반복됐다"(이 문서 29-31행 자신의 경고)는 지적과 같은 형태의 재발이다 — 이번엔
    자매 트래커가 아니라 **자기 자신의 체크리스트**가 한 라운드를 누락했다. 117행은
    지금 이 3차 라운드(`15_00_41`)가 검토해야 할 상태를 여전히 정확히 가리키고
    있지만("fix 이후 fresh review"), 그 사이에 이미 한 사이클(라운드→WARNING→RESOLUTION)
    이 조용히 지나갔다는 사실 자체가 감사 추적에서 빠졌다.
  - 제안: 113-114행 형식을 본떠 `14_47_14` 라운드용 항목을 추가
    (`[x] /ai-review (14_47_14) WARNING 2 — 8건 조치, RESOLUTION 참조` 형태) 하고,
    117행을 이번 라운드(`15_00_41`) 기준으로 갱신할 것.

## 양호한 점 (재확인, 참고)

- `bf0f86ca8` 의 세 조치(W1 극성 캐비엇, W2 nullable 목록, INFO18 경로 통일) 모두
  소스에서 정확히 확인됨 — RESOLUTION.md 의 주장과 실제 diff 가 어긋나는 곳 없음.
- `execution-engine.service.ts` 의 `finalizeCancelledExecution`/`finalizeFailedExecution`
  JSDoc 은 정정 이력을 삭제하지 않고 누적 서술하며, 서로의 극성 차이를 **코드
  주석 레벨에서는** 정확하고 대칭적으로 설명한다 — 이번에 지적한 것은 그 정확한
  서술이 `spec/conventions/node-cancellation.md` 로는 전파되지 않았다는 점뿐이다.
- `Execution` 엔티티 nullable 불일치는 실제로 plan "범위 밖(등재됨)" 절에 등재돼
  있고(`13_58_27` W9 재발 없음), 테스트 주석이 파일·절을 구체적으로 명시한다.
- CHANGELOG·spec §5.3/§6.5·DTO JSDoc·KO/EN triggers.mdx 의 `durationMs` 서술은
  예시값(`4242`)·null 규약·caveat(§6.5 대기 경과 시간) 모두 일치.

## 요약

이번 3차 라운드는 앞선 두 라운드가 이미 CRITICAL 0 으로 정리한 코드 위에서, **두
라운드 모두가 놓친 문서-구현 drift** 를 하나 새로 찾았다: `spec/conventions/node-cancellation.md`
가 `692dfa00e`(나중에 `b4d0ca27e` 로 되돌려진 "0행이면 무조건 skip" 로직)를 서술한
채로 남아 있고, 최종 코드는 조건부 재발행(case a/b)이라 표의 "모두 skip"·"자매와
동형" 주장이 실제와 어긋난다. 이 PR 자체가 "문서가 구현보다 넓으면 안 된다"는
교훈을 세 번째로 배운 PR 이라는 점에서 아이러니가 크고, 다음에 유사한 guarded-cancel
경로를 추가하는 사람이 이 표만 보고 잘못된 패턴을 복사할 위험이 있어 WARNING 으로
기록한다. 두 번째로, plan 체크리스트가 `14_47_14` fresh-review 사이클(WARNING 2건,
이미 조치됨)의 존재를 전혀 기록하지 않아 감사 추적에 구멍이 있다. 둘 다 런타임
동작에는 영향이 없고 문서/plan 쓰기 권한(spec 은 planner, plan 은 developer) 범위
안에서 짧은 정정으로 해소 가능하다. 그 외에는 이미 두 라운드가 검증한 CHANGELOG·
JSDoc·spec·KO/EN 문서 정합성이 그대로 유지되고 있음을 재확인했다.

## 위험도

LOW
