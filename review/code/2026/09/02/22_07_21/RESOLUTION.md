# RESOLUTION — `change-password` 코드 정렬 리뷰 1라운드

대상 SUMMARY: 위험도 **MEDIUM** · Critical **0** · Warning **4** · INFO 8

**WARNING 4건 전부 조치.** 그중 둘은 **이 PR 이 스스로 세운 원칙을 내가 끝까지 적용하지
않은 것**이었다.

## W1 (testing) — 내 "전수" 가 세 곳 중 두 곳이었다

`sessions.service.ts` 의 `verifyReauth` 도 공유 상수를 쓰도록 바꿔 놓고, 그 파일의 테스트는
**예외 클래스만** 단언하는 채로 뒀다. 정작 `users.service.spec.ts` 에 *"클래스만 단언하면
코드값 drift 를 놓친다"* 는 주석을 새로 써 넣은 게 이 PR 이다.

소비처는 셋(`auth.service`·`users.service`·`sessions.service`)인데 내가 코드값을 핀 한 것은
둘뿐이었다. **원칙을 문서화하면서 그 원칙의 적용을 한 칸 좁게 잡았다.**

코드값을 **리터럴로** 단언하는 테스트를 추가하고, 실제로 무는지 뮤테이션으로 확인했다:

| 뮤턴트 | 결과 |
|---|---|
| `sessions.service` 의 `.INVALID` → `.REQUIRED` | **RED 1** (조치 전이면 GREEN) |
| 원복 | GREEN 19 |

## W2 (testing·user_guide_sync) — 정작 breaking 인 분기가 HTTP 무검증이었다

자매 분기(불일치 → `PASSWORD_INVALID`)는 e2e 가 있는데, **이 PR 이 실제로 바꾼 쪽**
(OAuth-only → `PASSWORD_REQUIRED`)만 없었다. unit 은 있었지만 이건 **wire 계약** 변경이고
§5 등급 B 로 "저장소 밖 호출자를 배제할 수 없다" 고 내가 직접 적은 항목이다.

`password_hash` 를 NULL 로 만든 계정으로 실제 HTTP 호출을 하고 `401` + `PASSWORD_REQUIRED`
+ **불일치 코드가 아님**(대조군) + 안내 문구 + 감사 미기록을 단언한다.

## W3 (documentation) — CHANGELOG 누락, **선례 주장을 내가 검증했다**

리뷰어가 *"직전 커밋 `d73eff860` 은 항목을 추가한 선례"* 라고 했다. 그대로 믿지 않고 확인했다:

- `git show --name-only d73eff860` → **`CHANGELOG.md` 포함** ✓
- 최근 20커밋 중 CHANGELOG 를 건드린 것 **5건** — 관례로 볼 만하다

지적이 맞다. wire 에러 코드가 바뀌는 breaking 변경인데 항목이 없었다. 두 코드 쌍·영향 엔드포인트·
감사값이 남는 이유·가이드 정정까지 담아 `## Unreleased` 항목을 추가했다.

## W4 (scope) — 무관한 정리가 설명 없이 섞였다

`--spec` 게이트가 INFO 로 짚어 준 draft 2건의 `complete/` 이동을 이 커밋에 함께 넣었는데,
그중 하나가 **WS 배지 플립 트래커**라 주제와 무관하다. 코드는 0줄이지만 `git log -S` 로 WS
이력을 쫓는 사람이 이 커밋에 걸린다.

별도 커밋으로 갈랐어야 했다. 이미 만든 커밋이라 **커밋 메시지에 절을 추가**해 명시했다
(리뷰어가 제시한 최소 조치). 미푸시 상태라 `--amend` 로 메시지만 고쳤다.

## 조치한 INFO

- **#1** `PASSWORD_VERIFY_CODES` JSDoc 이 소비처를 둘만 열거 — 세 번째(`SessionsService.verifyReauth`,
  `.INVALID` only)를 추가했다. W1 과 같은 결함의 주석 판이다.
- **#3** 테스트 제목이 단언 범위보다 넓었다(`"PASSWORD_REQUIRED 를 낸다"` 인데 클래스만 단언).
  제목을 실제 단언에 맞춰 좁혔다 — 코드값은 인접 테스트가 담당한다.
- **#6** baseline 이 `--update` 로 만들어졌는지 diff 만으론 구분 불가 → **비-update 모드로
  재확인**: `OK: backend 198건 / 37파일 — baseline 과 일치`.

## 미조치 (판단 유지)

- **#2** 리뷰 중 워킹트리에 커밋 밖 변경이 보였다 — 그건 다른 에이전트가 아니라 **내가**
  같은 턴에 쓴 예측/실측 기록이다. 의도한 변경이고 이번 커밋에 포함된다.
- **#4** `password.util.spec.ts` 에 상수 자체를 pin 하는 테스트 — W1 해소로 **소비처 3/3 이
  리터럴로 핀** 하게 됐다. 상수 값이 바뀌면 세 파일이 동시에 RED 다. 별도 pin 은 같은 사실을
  네 번째로 적는 것이라 두지 않는다.
- **#5** Swagger description 세분화 — 유효한 개선이나 `swagger.md` 규약 범위라 이 PR 에서
  넓히지 않는다.
- **#7** 실패 사유 차등화의 계정 열거 위험 — 리뷰어가 호출부 전수 추적으로 `@CurrentUser()`
  self-scope 임을 확인했다. 미인증/타인-대상 엔드포인트가 이 코드를 재사용하면 그때 연다.
- **#8** arrange 중복 — 분기가 더 늘면 `it.each` 로 묶는다.

## 검증

lint · unit(backend **9,228** / frontend **289 files**) **PASS** ·
docs·링크 가드 **3155** · backend ratchet **198/37** · frontend ratchet **52/15** ·
뮤테이션 **1축 RED**(W1 자리).
