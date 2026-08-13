# RESOLUTION — `00_00_44` (+ consistency `00_00_45`)

ai-review **CRITICAL 0 / WARNING 1** (forced 7명 전원). consistency 는 **BLOCK: YES** 인데
그 CRITICAL 은 스코프 아티팩트다 — 아래 §consistency 참조. 실질 WARNING 3건 전부 조치.

## ai-review W1 — OAuth 콜백 e2e 부재 (user_guide_sync·testing 공동)

**조치 완료.** 지적이 정확하다. 이 결함이 4개월 살아남은 구조가 *"단위 테스트가 mock 을
잘못 세웠고 e2e 는 없었다"* 인데, 고치면서 **그 구조를 그대로 두면** 드라이버 버전이 다시
바뀔 때 같은 클래스가 재발한다.

`codebase/backend/test/auth-oauth-callback.e2e-spec.ts` 신설 — 실제 Postgres 에
`auth_oauth_state` 를 심고 `/api/auth/oauth/:provider/callback` 왕복을 관측한다.
**성공/거절 양방향**을 다 본다.

### 이 e2e 가 실제로 버그를 잡는가 — 되돌려서 확인했다

`updateReturningRows` 언랩을 제거해 **버그 상태로 되돌리고** 컨테이너를 재빌드해 실행:

| 테스트 | 버그 상태 |
|---|---|
| 유효한 state → 성공 | **✕ 실패** |
| 재사용 → 첫 번째는 성공 | **✕ 실패** |
| 만료 → 거절 | ✓ (버그 상태에선 **전부** 거절되므로 통과) |
| 미존재 → 거절 | ✓ (동일) |
| provider 불일치 → 거절 | ✓ (동일) |

**2 failed / 3 passed → 사살.** 그리고 이 결과가 파일 docstring 의 설계 의도를 그대로
증명한다 — *"한쪽만 보면 '전부 실패' 도 '전부 통과' 도 절반은 초록이다."* 거절 방향만
테스트했으면 **버그가 있는 채로 5/5 GREEN** 이었다.

> **부수 소득**: 첫 실행이 5/5 실패였다. `setGlobalPrefix('api')` 를 빠뜨려 전부 404 였다.
> **작성만 하고 GREEN 을 가정했으면 vacuous 테스트가 들어갈 뻔했다** — 실행이 잡았다.

## consistency W1 — 세 번째 자매 plan 이 빠져 있었다

**조치 완료.** `exec-intake-followups.md` 의 *"admission 회귀 보강 완료(2026-07-04)"* 가
GREEN 이던 근거가 `[{ id: 'eSQL' }]`(INSERT 형태) mock 이었다. `ie-resume-turn-boundary-cancel`
· `retry-turn-terminal-guard` 두 자매는 소급 배너를 받았는데 이 하나가 빠졌다.
배너를 넣으며 **무엇이 유효하고 무엇이 아닌지** 갈라 적었다 — 파라미터 순서·cap 매핑
검증은 유효하고, "admission 이 실제로 승인한다" 만 그 mock 위에서만 참이었다.

## consistency W2 — 위임 5건이 집결 티켓에 없었다

**조치 완료.** `spec-update-node-cancellation-shutdown-classification.md` 에 `#12` 로 등재.
`node-cancellation.md` 항목은 **소비 경로 단위**로 적었다(영향 있음/없음을 갈라서) —
행 라벨로 뭉개면 반대 방향 drift 가 난다는 `23_46_01` WARNING 5 의 지적을 반영.

## consistency 의 CRITICAL — 스코프 아티팩트다

`--impl-done spec/5-system/` 이 *"target 에 diff 가 0건"* 을 CRITICAL 로 올렸다.
**코드 전용 PR 에 내재된 사실**이고 결함이 아니다:

- 동일 스코프로 돌린 직전 **5개 라운드가 전부 BLOCK: NO** 였다
  (`20_36_36`·`22_45_25`·`23_07_12`·`23_27_49`·`23_46_01`) — 같은 입력, 다른 판정
- 그 checker 자신이 *"근본 원인은 spec 콘텐츠 결함이 아니라 세션/워크트리 라우팅 불일치"*,
  *"planner 인계 대상 없음"* 이라고 적었다
- 이 PR 은 `spec/` 을 1줄도 바꾸지 않는다. `spec_impact` 는 planner 위임 5건 때문에
  리스트로 두었을 뿐이다(§Gate C 근거는 plan 상단 배너)

즉 "검사할 spec 변경이 없다" 를 "spec 정합성 미확인" 으로 등급화한 것이다. 그 지적 자체는
타당한 경고지만(0 발견을 보증으로 읽지 말라), **이 PR 을 막을 근거는 아니다.**
plan WARNING 2건은 위에서 실제로 조치했다.

## 검증

- 새 e2e **5/5 통과**, 버그 상태로 되돌리면 **2 failed(사살)**
- `lint --max-warnings 0` 통과 · ratchet **199/38 일치**

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| ai INFO 10·11 | 배포 후 관측 — plan §후속에 5항목 등재됨 |
| ai INFO 14·15·16·20 | 3~5라운드 연속 유예된 스타일. 이 파일들을 다음에 실질 변경할 때 함께 |
| ai INFO 18 | `[null, 1]` 류 엣지 — **실측 근거 없는 이론적 형태**다. 실제 드라이버가 그런 걸 돌려준다는 관측이 나오면 그때 고정한다 |
| ai INFO 19 | `knowledge-base.service.ts:727` 의 "①" 포워드 레퍼런스 — 최초 커밋부터 있던 것, 이 diff 밖 |
| ai INFO 22 / DB | `reEmbedAll` 3단계 비-트랜잭션 — 기존 구조. plan 후속 대상 |
