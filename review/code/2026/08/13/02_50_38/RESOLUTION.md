# RESOLUTION — `02_50_38`

리뷰 결과: **CRITICAL 0 / WARNING 4 / RISK MEDIUM**. reviewer 8명 실행, 강제 7명 전원 결과 확보.
**WARNING 2건 조치 + 2건 기록/유예.**

---

## WARNING #3 (requirement) — 내 수치가 틀렸다 → 조치

CHANGELOG 에 "provider 파서 **4종**" 이라 썼는데 실제로 `idempotencyKey` 를 채우는 파서는
**3종**(telegram·slack·discord)이다. 직접 세어 확인했다(`grep -rln`, providers 하위 3파일).

이 세션에서 반복된 "수량을 프록시로 셌다" 와 같은 형태다 — 이번엔 프록시조차 없이 어림한 것이다.

## WARNING #2 (SPEC-DRIFT) — CCH-NF-03 서술이 새 게이트 순서를 반영 못 함 → 조치

`15-chat-channel.md:113` 이 "`HooksService` 가 **parseUpdate 직후** 한도 초과 시…" 라 적는데,
이제 그 사이에 CCH-SE-02 dedup 게이트가 들어갔다. 코드가 옳고(재도착은 쿼터를 소비하면 안 된다)
문서만 낡았다. **"parseUpdate 직후(CCH-SE-02 dedup 게이트를 통과한 뒤 — 재도착은 같은
트래픽이라 쿼터를 소비하지 않는다)"** 로 갱신.

## WARNING #1 (scope) — spec 직접 수정이 두 파일로 확산 → **기록, 되돌리지 않음**

1차 라운드가 `15-chat-channel.md` 를 지적했는데 이번 라운드에서 `telegram.md` 로 한 파일 더
늘었다. 다만 telegram.md 는 **1차 라운드의 WARNING #2 를 조치한 결과**다 — 그 문서가 "미구현,
consumer 없음" 이라 적고 있어 두면 거짓 문서가 되는 상황이었다.

즉 "확산" 이라기보다 **같은 절차 이탈 아래에서 필요한 정정을 한 것**이다. 되돌리지 않되:

- `plan/in-progress/backend-lint-gate-broken-on-main.md` 해당 항목에 **절차 이탈 사실을 기록**했다
  (`02_50_39` plan_coherence WARNING 4 의 요구). 리뷰 산출물에만 남기면 plan 을 읽는 다음
  사람은 모른다.
- 이 세션에서 planner 턴을 세 번(#1154·#1156·#1160) 분리해 놓고 여기서만 합친 것은
  **일관성이 없었다**. 다음부터 순서를 지킨다.

## WARNING #4 (maintainability) — `handleChatChannelWebhook` 길이 → **유예 유지**

리뷰어도 "직전 라운드의 조건부 유예를 재확인" 으로 판정했다. 트리거는 **다음 게이트 추가
시점**이고, 그때 파싱 후 게이트 체인을 `runInboundGates(...)` 류로 뺀다.

---

## INFO 처분 (11건)

| # | 항목 | 처분 |
|---|---|---|
| 5 | dedup 윈도우 상수·키 포맷이 테스트에서 리터럴로 pin 안 됨 | **유예** — 구현·테스트가 같은 심볼을 참조해 숫자 자체의 회귀는 못 잡는 것이 맞다. 형제 파일과 동일 관례라 이 PR 단독으로 바꾸지 않는다 |
| 8 | `hooks.service.spec.ts` 의 `@nestjs/common` import 2줄 중복 | **유예** — lint 통과, 다음에 그 블록을 만질 때 병합 |
| 9 | warn-spy 복원 방식 3가지 공존 | **유예** — 다음에 `try/finally` 로 통일 |
| 1·2·3·4·6·7·10·11 | 클래스 3중 복제 · 키 길이 · DI 토큰 주석 · JSDoc 동기화 · 폴백 분기/e2e · provider 문서 상세도 · 리뷰 산출물 커밋 · 모듈 docstring | **유예/확인** — 전부 직전 라운드에서 사유와 함께 처분됐거나 선재 |

## 검증

- eslint **0/0** · 관련 단위 **59/59** · backend unit **419 suites / 8544 passed**
- `--impl-done` consistency (`02_50_39`) **BLOCK: NO** — 그 WARNING 4건도 같은 커밋에서 조치
  (거짓 처분 정정 · data-flow 미러 · `R-CC-20` Rationale · plan 절차 기록)
