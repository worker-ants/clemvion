# RESOLUTION — `15_00_41` (+ consistency `15_01_13`)

ai-review **CRITICAL 0 / WARNING 4** · `--impl-done` **BLOCK: YES → 해소**. 전부 조치.

**두 게이트가 같은 것을 지목했다.** ai-review W3 과 consistency CRITICAL 이 동일 건이고,
독립 체커 셋(cross_spec · rationale_continuity · documentation-reviewer)이 각각 찾았다.

## CRITICAL (consistency) == W3 — 규약 문서가 **되돌려진 중간 동작**을 서술하고 있었다

**조치 완료. 내가 만든 것이고, 하필 사람들이 복사하는 자리다.**

경위:

1. 원래 결함: 0행이어도 무조건 emit → 나는 `node-cancellation.md` 를 *"guarded UPDATE 가
   걸러낸다"* 가 과대서술이라며 정정했다
2. **1차 수정(`692dfa00e`)**: 자매를 복사해 "0행이면 무조건 skip". 문서도 그렇게 적었다 —
   *"모두 skip · 자매와 동형"*
3. **2차 수정(`b4d0ca27e`)**: 그 수정이 **사용자 Stop 을 무음으로** 만든 걸 리뷰가 반증해
   코드를 뒤집었다(재조회 후 조건부 발행)
4. **그런데 문서를 다시 고치지 않았다** — 정본 규약 문서가 존재하지 않는 동작을 설명한다

consistency 가 `BLOCK: YES` 로 막은 게 옳다. 이 표를 보고 새 guarded-cancel 경로를 만들면
**내가 방금 겪은 사고가 그대로 재현된다**.

§2.4 행과 Rationale 불릿을 최종 동작으로 재정정하고, **두 번의 정정 이력을 취소선으로
보존**했다 — ①원문(과대서술) → ②1차 정정(처방이 틀림) → ③최종. 두 번째가 첫 번째를
뒤집는다는 사실 자체가 다음 사람에게 필요한 정보다.

> **교훈**: 코드를 되돌릴 때 **그 코드를 설명하려고 방금 고친 문서**도 함께 되돌려야 한다.
> 나는 문서를 "고쳐 놨다" 는 이유로 다시 보지 않았다.

## W1 — 재조회가 throw 하면 에러 핸들러가 터진다 (requirement)

**조치 완료.** 내가 넣은 `findOneBy` 재조회가 try/catch 밖이었다. 이 함수의 호출부는
**둘 다 catch 블록 안**이라(`runExecution` catch · `finalizeResumedExecutionOutcome`)
여기서 throw 하면 **에러 핸들러 자체가 터진다**. 형제 `emitCancellationEvent` 가 정확히
같은 이유로 자체 try/catch 를 갖고 있는데 신규 지점엔 적용하지 않았다.

**실패 시 skip 을 택했다.** DB 를 읽지 못하면 이 PR 이 세운 *"wire 는 DB 가 말하는 것만
말한다"* 를 지킬 수 없다. 반대 선택(모르면 일단 발행)은 더 흔한 경우 (a)를 맞히지만 (b)에서
DB 와 모순되는 이벤트를 낸다 — **관측 가능한 무음(warn)이 관측 불가능한 오시그널보다 낫다.**
이 트레이드오프를 주석에 적었다.

판별력: try/catch 없는 상태에서 새 테스트 (d) **RED**.

## W2 — 자매에서 찾은 결함을 형제에 적용하지 않았다 (testing)

**조치 완료.** `finalizeCancelledExecution` 의 `finishedAt` 되쓰기가 무검증이었다 —
그 줄을 지워도 3 tests GREEN 을 **내 뮤테이션으로 직접 확인**했다.

리뷰어의 지적이 정확히 아픈 지점: **같은 PR 이 자매(`retry-turn.service.ts`)에서 이 형태를
스스로 찾아 고쳐 놓고**(두 컬럼 되쓰기인데 한 컬럼만 단언) 형제 함수엔 같은 처방을 적용하지
않았다. `live` fixture 에 `finishedAt` 을 주고 (a) 에서 단언. 뮤턴트 **RED**.

## W4 — 체크리스트가 라운드를 기록하지 않았다 (documentation)

**조치 완료.** `14_47_14` 라운드 실행·해소가 plan 에 없었다. `14_47_14`·`15_00_41`·
`15_01_13` 세 줄 추가.

## consistency WARNING 1 — 자매 plan 의 분류가 stale

**조치 완료.** `update-returning-tuple-shape.md` 가 `finalizeCancelledExecution` 을
*"반환값을 버리는 호출 — 영향 없음"* 으로 분류하는데, 이번 PR ①이 **정확히 그 전제를 깼다**
(이제 `persisted` 를 읽고 분기). 취소선 + "세 번째 stale" 노트로 재분류.

그 문서가 이미 *"이 목록을 두 번 틀렸다"* 고 적고 있었다 — 세 번째다.

## INFO 처분

| # | 처분 |
|---|---|
| 4 (in-place mutation 계약 미노출) | 무조치 — 호출 스코프 안전 확인됨, 비긴급 |
| 7 (단일 UPDATE 원자성 암묵 의존) | 무조치 — 현재 안전, 캐비엇은 비긴급 |
| 5·6·8·9 | 기결정 / 범위 밖(등재됨) / positive finding |
| consistency WARNING 2 (번들 예산) | **harness 이슈** — 본 PR 범위 아님 |
| consistency INFO 1 (`data-flow/15` 필드 열거) | 선존 비-망라 요약, 비차단 |

## 검증

- 백엔드 **425 suites / 8730 passed** · lint `--max-warnings 0` **0 errors** · 타입 **199**
- spec 가드 **20 files / 2935 passed**
- 판별력: W1 (d) RED · W2 되쓰기 제거 RED
- 회귀 테스트가 이제 **4갈래**다 — (a) DB=cancelled → emit · (b) 선점 → skip ·
  (c) 행 없음 → skip · (d) 재조회 throw → 전파하지 않고 skip
