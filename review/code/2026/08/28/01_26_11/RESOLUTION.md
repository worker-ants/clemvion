# RESOLUTION — `01_26_11` (`/ai-review`, forced 7/7)

RISK=LOW · **CRITICAL 0** · WARNING 4 → **전부 반영**. INFO 5 도 반영.

## W1 — **어제 지적받은 실수를 오늘 다시 했다**

`asRecord` 를 `extractNodeErrorPayload` **앞에** 끼워 넣어 그 함수의 JSDoc 을 대상에서
떼어 놨다. 게다가 그 JSDoc 은 **정정 전 서술**(*"`error` 또는 `output.error` 중 어디로
오든"* · `error: string` 을 "legacy" 로 표기 · SoT 인용이 구 `§4.1`)을 그대로 갖고 있었다 —
**이 결함의 출처인 문장**이다. 나는 본문 인라인 주석만 고치고 그 위 JSDoc 을 안 봤다.

`19_36_17`(어제 PR #1214) W1 과 **같은 클래스**다 — 그때도 두 단계로 편집하다 JSDoc 을
떼어 놨고, 그때도 네 reviewer 가 독립 지목했다. **이틀 연속이다.**

JSDoc 을 §4.1-a 기준으로 재작성하고 `asRecord` 를 함수 **위**로 올려 인접성을 복원했다.

## W4 — `direct` 분기를 **지웠다** (남기지 않았다)

리뷰어가 `const direct = null` 뮤테이션으로 **87/87 GREEN** 을 실증했다 — 커버리지 0 이다.
내 fixture 정정(객체 → 문자열)이 그 분기의 유일한 양성 커버를 `nested` 로 옮겨 갔다.

선택지는 (a) 양성 테스트 추가 (b) 제거였고 **(b)** 를 골랐다:

- **도달하지 않는다** — 호출부 2곳 모두 `rawError` 가 문자열/`undefined` 다.
- 더 중요하게, 그 분기는 **이 버그를 낳은 계약을 그대로 인코딩**한다. 남겨 두면 다음
  사람이 *"객체로 보내면 되겠네"* 로 읽고, spec §4.1-a 가 정정한 방향으로 되돌아간다.

`rawError` 파라미터도 함께 제거해 시그니처를 `extractNodeErrorPayload(rawOutput)` 으로
좁혔다. 호출부 2곳 동반 수정.

## W2 — 자매 호출부 주석 (또 한 겹 얕았다)

`handleNodeCompleted` 위 주석이 *"`output.error` 를 운반한다"* 로 **한 겹 얕은** 서술을
유지하고 있었다. `handleNodeFailed` 쪽만 고치고 인접 형제를 안 본 것 — 이 세션이 반복해
겪은 형태다. `output.output.error` + 래퍼 근거로 정정.

## W3 — **내 수정이 근본 원인을 다시 심을 뻔했다**

지적이 날카롭다: 이 결함의 원인이 *"fixture 가 production shape 을 못 따라가 결함을
가렸다"* 인데, 내 정정은 래퍼를 **손으로 5곳에 복제**해 같은 drift 위험을 재생산했다.

`wrapNodeHandlerOutput(domain)` 빌더로 뽑고 5곳을 전부 통과시켰다.

**빌더가 진짜 단일 지점인지 뮤테이션으로 확인**:

| | 예측 | 실측 |
| --- | --- | --- |
| M3 빌더에서 래퍼를 벗김(`return domain`) | **4 failed** (구조화 에러를 읽는 4곳; CT-S15 는 동등성만 보므로 GREEN) | **4 failed** — 일치 |

## INFO 5 — 테스트 제목도 한 겹 얕았다

`"node.completed with output.error APPENDs…"` → `output.output.error`.

## INFO 1 — PR 설명에 반영

*"이 변경으로 `system_error` 배너가 **처음** 노출된다"* — 관측 시 회귀로 오인되지 않도록
PR 본문에 명시한다.

## 넘김 (사유)

- **INFO 3** `handleNodeCompleted` 분기의 production 도달 가능성 100% 확증 안 됨 — 리뷰어도
  *"회귀/결함은 아님"* 판정. 이 PR 이 그 경로를 **고쳤고**(M2 가 RED 로 확인) 도달성 자체는
  백엔드 emit 조사라 별건이다.
- **INFO 4** 두 핸들러의 errorPayload→append 블록 ~20줄 중복 — **diff 이전부터** 있던 것이고
  리뷰어도 *"이번 PR 범위 밖"* 으로 판정. 추출은 두 핸들러의 다른 차이까지 건드린다.
- **INFO 2** XSS 안전 확인 · **INFO 6** 캐너리가 백엔드 emit 과 일치 확인 — 조치 불요.

TEST WORKFLOW 4단계 PASS — frontend 87/87(이 스위트) · e2e 285.
