# RESOLUTION — retry/ie 잔여(C-4) 리뷰 3라운드 (수렴)

대상 SUMMARY: 위험도 **LOW** · Critical **0** · **Warning 0** · INFO 10

**수렴한다.** 리뷰가 스스로 *"즉시 조치가 필요한 항목 없음 — 이 changeset 은 push/머지 가능
상태로 판단된다"* 고 판정했다. **코드 변경 0건.**

1·2라운드 WARNING 6건이 전부 해소됐음을 8명이 소스 직접 재대조로 확인했고, testing 리뷰어는
**독립 뮤테이션 2건**(`prepareSuccessTermination` 의 `error=null` 제거 · `phase` 보간 치환)으로
**RED 를 처음 재현**했다 — 내 실측을 남이 재현한 것이라 값어치가 다르다.

## INFO 1 — 새 관찰 하나는 등재한다

concurrency 리뷰어가 찾은 것: `markNodeCancelled` catch 의 진단 로그가 내부
`save()`/`emitNode()` **두 순차 await 중 어느 쪽이 실패했는지 구분하지 않는다.** `save()` 는
성공하고 `emitNode()` 만 실패한 경우에도 *"짝 row 가 non-terminal 로 잔류할 수 있다"* 를
남겨, 실제로는 이미 CANCELLED 로 커밋된 상태를 오도할 수 있다.

**내가 쓴 로그 문구가 실제보다 넓게 주장하는 자리다.** "~할 수 있다" 라 엄밀히 거짓은
아니지만, 조사자가 그 문장을 읽고 non-terminal row 를 찾으러 갈 근거가 된다.

그래도 **이번에 고치지 않는다** — 정확한 진단을 내려면 `save()`/`emitNode()` 를 별도 `try` 로
쪼개야 하고, 그건 이 PR 이 닫은 결함(취소 분류)과 무관한 **구조 변경**이다. 리뷰어도 조치
불요로 판정했다. `ie-resume-turn-boundary-cancel.md` 에 등재했다 — **미조치이며 우선순위
판단**이고, 재개 신호는 "그 로그가 실제 조사에서 오도한 관측" 이다.

## INFO 9건 미조치

전부 **재확인**이다 — 이미 우선순위 판단이 끝난 백로그(mock-capture 중복 · `markSpawnedRowFailed`
인접 `string` 인자 순서 · `ResponseExecution.error` 재선언 · `warnSpy` `mockRestore` 생략) 또는
문서화된 트레이드오프(마킹 실패 흡수의 대가 · 로그 싱크 접근통제 전제) 또는 spec 회색지대
확인이다. 새로 성격이 바뀐 것은 없다.

INFO 9(두 트래커의 처분 표 형식이 서로 다름)는 사실관계 오류가 아니라 스타일 지적이라
그대로 둔다.

## 수렴 근거

| 라운드 | 위험도 | Critical | Warning | 성격 |
|---|---|---|---|---|
| 1 | LOW | 0 | 5 | JSDoc 고아화 · 내 관측이 미검증 · 타입 변경이 남의 문서 무효화 · CHANGELOG |
| 2 | LOW | 0 | 1 | 내 수정이 같은 트래커의 다른 항목을 무효화 |
| 3 | **LOW** | **0** | **0** | 코드 변경 0 |

Critical 은 세 라운드 내내 0이었다. 발견의 성격이 **코드 → 문서 정합성 → 없음** 으로 좁아졌다.

세 라운드가 잡은 것을 한 줄로 줄이면: **내가 넣은 것을, 그것이 인용되던 자리들이 안 따라갔다.**
JSDoc(1R) · 테스트(1R) · 남의 파일 JSDoc(1R) · 같은 트래커의 중복 항목(2R) · 내가 쓴 수치(2R).
코드 결함은 1라운드 전에 끝나 있었고, 세 라운드는 전부 **정합성**을 봤다.

## 검증

lint(`--max-warnings 0`) · prettier · backend **442 suites / 9218 passed, 1 skipped** ·
execution-engine **42 suites / 1185** · docs 가드 **3120** ·
e2e **342**(backend 291 + playwright 51) · 뮤테이션 **10축** 전부 예측 RED / 실측 RED.
