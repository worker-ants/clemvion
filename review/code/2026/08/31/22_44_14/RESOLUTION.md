# RESOLUTION — 아바타 업로드 리뷰 2라운드 반영

대상 SUMMARY: 위험도 **CRITICAL** · Critical **1** · Warning **13** · INFO 7

1라운드(`22_12_54`) 반영이 새 표면을 만들었고, 2라운드가 그중 **내가 이번에 넣은 코드의 결함**을
여러 건 잡았다. 아래에 처리와 근거를 적는다. 유예 2건은 plan 에 등재했다.

## Critical — 아바타 저장이 남의 컬럼을 되돌린다

`updateAvatar` 는 S3 업로드 **앞에서** 읽은 엔티티 스냅샷에 `avatarUrl` 만 얹어
`save(user)` 했다. 업로드는 네트워크 I/O 라 수백 ms~수 초 걸리고, 그 사이 다른 요청이 같은
row 를 바꾸면(로그인 실패 카운터·계정 잠금·2FA 등록 — 전부 `usersService.update()` 의 부분
갱신 경로) 뒤늦은 저장이 그 변경을 **조용히 옛 값으로 되돌린다.**

**고친 방식은 락이 아니라 쓰는 컬럼을 줄이는 것이다.** 아바타 교체가 건드려야 하는 컬럼은
`avatarUrl` 하나뿐이므로, `userRepository.update(userId, { avatarUrl })` 로 바꾸면 다른
컬럼이 UPDATE 문에 실리지 않아 **경쟁 자체가 성립하지 않는다** — 트랜잭션도 `@VersionColumn`
도 필요 없다. 응답 봉투용 최신 상태는 이어지는 `findOneOrFail` 로 읽는다(업로드 도중 바뀐
다른 컬럼도 이때 반영된다).

회귀 축을 "락이 있다" 가 아니라 **"UPDATE 페이로드에 `avatarUrl` 말고 아무것도 없다"** 로
잡았다(`Object.keys(patch)` 를 정확히 비교, `save()` 는 던지는 stub). 뮤턴트 N1(`save` 복원)
→ **RED 11**.

## Warning

| # | 처리 | 내용 |
|---|---|---|
| 1 | 수정 | 프로토타입 체인 우회에 `hasOwnProperty` 가드. **단 리뷰의 "7개" 를 2개로 좁혔다** — 아래 별도 항목 |
| 2 | 수정 | `S3Service` 생성자 주석이 *"폴백은 `s3.config.ts` 한 곳"* 이라 단언하면서 **바로 다음 줄이 `?? endpoint`** 로 다시 폴백하고 있었다. 그 `??` 는 규칙의 사본이 아니라 설정 모듈이 로드되지 않은 조립(부분 mock 테스트)에서 `undefined` 가 URL 에 박히는 것을 막는 **2차 방어**다 — 코드를 지우는 대신 **주장을 코드에 맞춰 정정**했다 |
| 3 | 문서화 | 버킷 세그먼트를 일부러 보지 않는다는 사실을 JSDoc 에 명시. 앵커 앞부분을 버리므로 버킷 이전 시 옛 버킷 객체는 남고 현재 버킷의 같은 키를 지우려 시도한다 — 그 키는 **같은 userId 접두 아래**라 남의 객체를 건드릴 위험이 없고, 없으면 `warn` 으로 떨어진다. 버킷 이전은 별도 마이그레이션이지 best-effort 정리의 몫이 아니다. `S3Service` 로 URL↔key 지식을 옮기는 것은 이 PR 범위 밖 |
| 4 | 캐너리 | OAuth `resolveUser()` 가 raw QueryBuilder 로 `avatarUrl` 을 써 정리 진입점을 우회한다. **오늘은 고아가 생기지 않는다**(`byEmail.avatarUrl ?? profile.avatarUrl` 이라 기존 값이 이긴다). 아래 별도 항목 |
| 5 | **유예 · 등재** | 동시 업로드 TOCTOU 고아. 정합성은 안 깨지고(사용자가 보는 아바타는 승자로 수렴) 남는 것은 과금·용량뿐이다. per-user advisory lock 은 아바타 하나에 치르기 큰 값이고 맞는 도구는 orphan-sweep 인데 범위 밖. **재개 신호를 측정 가능한 양으로** 적었다 — `avatars/` 객체 수가 사용자 수를 유의미하게 웃돌 때 |
| 6 | 수정 | 키 접두 `avatars/{userId}/` 가 생성·복원 두 곳에 독립 하드코딩 → `avatarKeyPrefix()` 헬퍼 |
| 7·8 | 수정 | **내 1라운드 테스트가 좁았다** — 아래 별도 항목 |
| 9 | **유예 · 등재** | e2e 부재. **선행 조건은 이 PR 에서 해소**(compose 에 익명 정책 추가) |
| 10 | 수정 | CHANGELOG·plan 이 `ExpressModule` 이라 적었는데 코드는 `ExpressNS` 다(2라운드 개명). 두 문서 정정 |
| 11 | 수정 | `@throws` 에 `NotFoundException`·에러 코드 3종 명시 |
| 12 | 수정 | 문서가 요구하는 익명 GET 정책이 로컬 인프라에 **없었다**. `createbuckets` 가 `scripts/minio/avatars-public-read.json` 을 `mc anonymous set-json` 으로 적용하게 했다(두 compose). **첫 시도는 틀렸다** — 아래 별도 항목 |
| 13 | 수정 | `USER_NOT_FOUND` 에 `message` 추가. 회귀 테스트도 붙였다(뮤턴트 N6 → **RED**) |

### W1 을 좁힌 이유 — 리뷰의 실측은 맞지만 코드 경로의 성질이 아니다

리뷰는 원시 객체에서 7개 상속 이름이 전부 truthy 임을 실측했다. 맞다. 그런데 `ext` 는 조회
**전에** `.toLowerCase()` 를 거치고, `Object.prototype` 의 이름들은 camelCase 다:

```
constructor → constructor  (히트)      toString → tostring  (미스)
__proto__   → __proto__    (히트)      valueOf  → valueof   (미스) … 나머지도 미스
```

**실제로 뚫리는 것은 `constructor`·`__proto__` 둘뿐이다.** 뮤턴트 N2(가드 제거)가 26건 중
**2건만 RED** 인 것이 이를 확인해 준다. 테스트 케이스 7개는 그대로 두되, 5개가 왜 이 가드를
가르지 못하는지(vacuous)를 주석에 적었다 — 다음 사람이 "7개를 막는다" 고 오독하지 않게.

도달 표면이 2개라고 가드가 불필요해지지는 않는다. 우회는 하나면 충분하다.

### W7·W8 — 내 테스트의 패턴이 내 주장보다 좁았다

1라운드에서 "Swagger 리터럴 드리프트를 문다" 며 붙인 테스트가 실제로는 일부만 봤다:

- MB 검사가 `최대 (\d+)MB` 로 **접두어를 요구**해, `@ApiPayloadTooLargeResponse` 의
  `'파일 크기 초과 (2MB)'` 를 구조적으로 못 봤다. 파일 안 MB 리터럴은 **4개**인데 3개만 봤다.
- 확장자 검사가 `/g` 없는 `.match()` 라 **첫 occurrence 만** 봤다. `@ApiBody` 쪽이 따로
  갈려도 GREEN 이었다.

**패턴을 한 칸 넓히는 것은 답이 아니다** — 다음에 나올 표현을 또 놓친다. 접두어 요구를 없애고
파일 안의 해당 형태를 **전수 수집해 각각 상수와 대조**하도록 방법을 바꿨다. 리터럴을 지워
검사 대상을 줄이는 편집이 조용히 통과하지 못하도록 **하한(`MIN_*`)도 고정**했다.
뮤턴트 N3(옛 정규식이 못 보던 리터럴만 드리프트)·N4(두 번째 나열에만 svg) → 둘 다 **RED**.

### W4 를 캐너리로 처리한 이유 — 런타임 fixture 가 분기를 못 가른다

OAuth stub 모드는 `profile.avatarUrl` 을 **항상 `null`** 로 준다. 그래서 우선순위를 뒤집어도
`byEmail.avatarUrl ?? null` 과 `null ?? byEmail.avatarUrl` 이 같은 값을 내고, 런타임 단언은
두 분기를 **가르지 못한다**(vacuous). 실제로 가르려면 공급자 사진이 있는 fixture 가 필요한데
그건 stub 계약을 바꾸는 일이라 범위 밖이다.

그래서 표현식 자체를 소스 캐너리로 고정했다. **목적은 우선순위를 바꾸는 사람이 그 주석을 읽게
하는 것**이다 — 그때 정리 경로를 함께 손봐야 한다. 뮤턴트 N5(우선순위 뒤집기) → **RED**.

### W12 를 고치다 내가 구멍을 낼 뻔했다 — `set download` 는 목록도 연다

처음에는 `mc anonymous set download local/workflow-storage/avatars` 를 넣고, CHANGELOG·
`.env.example`·`k8s/README.md` 에 **"`ListBucket` 은 열지 않는다"** 고 적었다. `exit 0` 이
무조건이라 e2e 통과만으로는 정책이 걸렸는지도 알 수 없어 따로 확인했는데, 정책 JSON 이
내 문장을 반증했다:

```
$ mc anonymous get-json local/workflow-storage
… {"Action":["s3:ListBucket"],"Condition":{"StringEquals":{"s3:prefix":["avatars"]}} …

$ curl -s 'http://minio:9000/workflow-storage?list-type=2&prefix=avatars'
<ListBucketResult …><Contents><Key>avatars/user-123/9f8e-uuid.png</Key>…
```

**익명 요청이 UUID 를 포함한 전체 키를 열거할 수 있었다.** 이 기능에서 아바타를 지키는
유일한 수단이 키의 추측 불가능성인데, 열거되면 추측할 필요가 없다. 문서는 정확히 반대를
약속하고 있었으므로, 그대로 머지됐으면 **문서를 믿은 만큼 더 위험했다.**

`s3:GetObject` 만 담은 명시 정책 파일로 교체하고 재실측했다 — 목록 **403**, GET **200**.
정책을 인라인 문자열이 아니라 파일(`scripts/minio/avatars-public-read.json`)로 둔 것은
이스케이프 때문만이 아니라 **정책이 리뷰 대상이 되게** 하려는 것이다. 기각 근거와 재현
명령은 `scripts/minio/README.md` 에 남겼다.

교훈은 익숙한 것이다: **설정값이 존재한다는 확인은 그 설정이 내 주장과 일치한다는 확인이
아니다.** `download` 라는 이름을 읽고 의미를 넘겨짚었다.

## INFO

INFO 1(매직바이트)·2(nosniff 헤더)·3(운영 fail-fast)·4(전용 throttle)·5(MemoryStorage)·
6(`UsersService` 다책임)은 미조치 — 리뷰가 전부 "현 규모에서 낮음 / 조건부 / 향후 검토" 로
판정한 항목이다. INFO 7(SPEC-DRIFT)은 1라운드에서 이미 planner 위임에 등재했다.

## 뮤테이션 6축 (예측 / 실측 — 전부 RED)

```
N1 컬럼 단위 update → 스냅샷 전체 save (원 결함 복원)   RED / RED 11
N2 hasOwnProperty 가드 제거                            RED / RED 2   (도달 가능 2개와 일치)
N3 옛 정규식이 못 보던 MB 리터럴만 드리프트              RED / RED 1
N4 두 번째 확장자 나열에만 svg 추가                     RED / RED 1
N5 OAuth 아바타 우선순위 뒤집기 (캐너리)                RED / RED 1
N6 USER_NOT_FOUND 의 message 제거                      RED / RED 1
```

N6 은 첫 시도에서 치환 대상이 2건이라 **무효 뮤턴트**였다(그때의 GREEN 은 증거가 아니다).
고유 앵커로 다시 돌려 RED 를 확인했다.

## 검증

lint(`--max-warnings 0`) · prettier · backend 전체 · docs 가드 · e2e.
수치는 커밋 메시지에 실측으로 기록한다.
