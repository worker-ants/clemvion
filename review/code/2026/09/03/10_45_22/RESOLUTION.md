# RESOLUTION — `change-password` 코드 정렬 리뷰 2라운드

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **1** · INFO 9

**WARNING 1건 + INFO 3건 조치.** 1R 의 WARNING 4건은 독립 뮤테이션으로 해소 재검증됐다
(testing reviewer 가 직접 뮤턴트를 걸어 확인).

## W1 (requirement·documentation 중복) — 내가 방금 끝낸 일을 미완료로 남겼다

plan 의 developer 턴 항목만 `[ ]` 로 남아 있었다. 바로 위 spec 5건은 이번 라운드에 `[x]` 로
바꿨는데 정작 **이 커밋이 완료한 항목**을 빠뜨렸다. 두 reviewer 가 독립적으로 잡았다.

`[x]` 로 전환했다. 남은 `[ ]` 는 **1건**(`User.passwordHash` 타입 — 별개 PR)뿐이다.

## 조치한 INFO

### #3 (testing) — 가드 `throw` 가 자기 `catch` 에 잡힌다

신규 테스트 2건이 *"reject 하지 않으면 실패시키는"* 가드 `throw` 를 **`try` 안**에 뒀다.
서비스가 reject 하지 않는 회귀가 나면 그 가드가 자기 `catch` 에 잡혀
`getResponse is not a function` 이라는 **무관한 메시지**로 실패한다.

> reviewer 가 뮤테이션으로 직접 확인했다 — **RED 이긴 하다**(vacuous 아님). 문제는 진단이
> 거짓말을 한다는 것이다. 다음 사람이 그 메시지를 보고 엉뚱한 곳을 판다.

`rejectionOf()` 헬퍼로 뽑아 **가드 단언을 `catch` 밖**으로 옮겼다. 같은 파일의 `codeOf()` 가
이미 쓰던 올바른 패턴이고, 이걸로 **#4(형제 파일 간 패턴 비일관)도 함께 줄었다.**

### #2 (documentation) — `@throws` JSDoc 이 소비처를 과소열거

`changePassword` 의 `@throws` 가 `AuthService` 만 적어 `SessionsService.verifyReauth` 를
빠뜨렸다. **열거를 하나 더 만드는 대신 위임**했다 — 발행처 목록은 `PASSWORD_VERIFY_CODES`
JSDoc 이 소유하고 여기서는 그것을 가리킨다.

> 열거를 복제하면 갈릴 자리를 하나 더 만든다. 이 PR 이 고치고 있는 결함이 정확히
> **"열거가 실제보다 좁다"** 인데, 그걸 세 번째 자리에 또 만들 뻔했다.

## 미조치 (판단 유지)

- **#1** Swagger description 세분화 — `swagger.md` 규약 범위라 이 PR 에서 넓히지 않는다(1R 과 동일 판단).
- **#5** e2e 의 `UPDATE ... SET password_hash = NULL` — reviewer 가 `WHERE id = $1` 로 테스트
  전용 신규 계정에만 국한됨을 확인했다. 결함 아님.
- **#6** `PASSWORD_VERIFY_CODES` 에 `Object.freeze()` 미적용 — 같은 파일의 `BCRYPT_ROUNDS` 도
  동일 패턴이라 이 changeset 이 도입한 위험이 아니다.
- **#7** WS 트래커 plan 이동 — 1R W4 의 disclosure 로 완결됐음을 reviewer 가 재확인.
- **#8** `changePassword` 에 `@Throttle` 미적용 — **선재 상태**이고 이번 diff 의 회귀가 아니다.
  다만 인접 엔드포인트에는 있으므로 비대칭이 맞다 → plan 에 별도 항목으로 등재하지 않고
  여기 기록만 남긴다(스코프 밖, 사용자 요청 없음).
- **#9** breaking change governance — reviewer 가 §5 등급 B 등재·CHANGELOG·spec 3곳·e2e 를
  전부 확인했다. 조치 불요.

## 별건 — `--impl-done` 이 내 설계 근거를 반증했다

같은 턴에 돈 `--impl-done`(BLOCK: NO)이 WARNING 으로 짚었다: 내가 세 곳(spec §5 note ·
`PASSWORD_VERIFY_CODES` JSDoc · plan)에 쓴 *"`UsersService` 는 `AuthService` 를 주입할 수
없다(순환)"* 가 **거짓**이다.

직접 확인했다 — `UsersController` 가 이미 `@Inject(forwardRef(() => AuthService))` 로 주입하고
`UsersModule` 도 `forwardRef(() => AuthModule)` 을 import 한다. 저장소에서 `forwardRef` 를 쓰는
파일이 **34개**다.

세 곳 모두 **측정된 근거**로 교체했다(원문은 취소선으로 보존):

1. `verifyPasswordForUser` 는 `findById` 를 스스로 한다(`auth.service.ts:71`) — `changePassword`
   는 이미 `user` 를 들고 있어(`users.service.ts:278`) 재사용하면 **같은 조회가 2회**.
2. 그 헬퍼는 `!user` 를 `PASSWORD_REQUIRED` 로 접지만 변경 경로는 `USER_NOT_FOUND`(404) 유지.
3. 안내 문구가 흐름마다 다르다.

**"구조적으로 불가능하다" 는 검증 가능한 주장인데 확인 없이 썼고, 그것도 세 곳에 썼다.**

## 검증

lint · unit(backend **9,228** / frontend **289 files**) **PASS** ·
docs·링크 가드 **3155** · backend ratchet **198/37** · frontend ratchet **52/15**.
