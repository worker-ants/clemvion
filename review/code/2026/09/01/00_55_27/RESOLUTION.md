# RESOLUTION — 아바타 업로드 리뷰 7라운드 반영

대상 SUMMARY: 위험도 **CRITICAL** · Critical **1** · Warning **2** · SPEC-DRIFT 3 · INFO 16

6라운드가 LOW 로 내려온 뒤 7라운드가 다시 CRITICAL 을 냈다. 신규 발견 하나 때문이고,
**그 발견은 내가 2라운드에 한 수정이 절반짜리였음을 보여준다.**

## Critical — 내가 고친 경쟁이 반대 방향으로 그대로 있었다

2라운드에서 `updateAvatar` 를 `save(user)`(스냅샷 전체) → `update(userId, {avatarUrl})`
(컬럼 단위)로 바꿨다. 그때 나는 "쓰는 컬럼을 줄여 경쟁 자체를 없앴다" 고 적었다.

**한쪽 writer 만 고쳤다.** `incrementLoginAttempts` 는 여전히 `findOneOrFail` → 필드 수정
→ `save(user)` 였다. 그래서 이런 순서가 가능하다:

```
1. 로그인 실패 요청이 user 를 읽는다            (메모리: avatarUrl = 옛 URL)
2. 아바타 업로드: update(avatarUrl = 새 URL)
3. 아바타 업로드: 옛 S3 객체를 지운다
4. 1의 save(user) 커밋                          (DB: avatarUrl = 옛 URL)
```

DB 가 **이미 삭제된 객체를 가리키는 URL** 로 되돌아간다. 이건 고아 객체보다 나쁘고,
`updateAvatar` 가 정리를 저장 **뒤로** 미뤄서 막으려던 바로 그 상태다 — 내 코드가 한쪽에서
막은 것을 다른 쪽이 되돌리고 있었다.

**부수적으로 로그인 잠금 자체도 약했다.** read-modify-write 라 동시 실패 둘이 같은 값을
읽으면 카운터가 2 가 아니라 1 이 된다. 보안 카운터가 경쟁에서 지는 것은 그 자체로 결함이다.

증가와 잠금 판정을 **한 문장**에 넣어 고쳤다(`updateReturningRows` 규약 준수). 잠금 시각은
앱 시계가 아니라 DB `NOW()` 로 잡는다 — 앱 서버가 여럿이면 `Date.now()` 는 인스턴스마다
다르다.

### 이 메서드에는 테스트가 하나도 없었다

`incrementLoginAttempts` 를 부르는 유일한 참조가 `auth.service.spec.ts` 의 **mock** 이었다.
즉 내 재작성은 전부 무방비였고, 고친 직후 `npx jest src/modules/users` 가 81건 GREEN 을 낸
것은 **아무 증거도 아니었다.**

`users-login-attempts.service.spec.ts` 6건을 신설했다. 고정한 것은 "잠금이 동작한다" 가
아니라 **"이 메서드가 자기 컬럼 둘 말고는 아무것도 쓰지 않는다"** 다 — SET 절의 컬럼 집합을
정확히 비교하고, `findOneOrFail`·`save` 는 호출되면 던지는 stub 을 준다.

## 반증된 유예 근거를 실측으로 다시 썼다

plan 의 TOCTOU 유예 노트는 "데이터 정합성은 깨지지 않는다" 고 적고 있었다. **이 CRITICAL 이
그 반례다.** 그 문장이 성립하려면 `avatarUrl` 을 쓰는 **모든** 경로가 컬럼 단위여야 하는데,
나는 `updateAvatar` 만 보고 반대편 writer 를 확인하지 않은 채 그렇게 적었다.

고친 뒤 전제를 실측했다 — 기존 `User` 를 스냅샷 전체로 저장하는 곳은 이제 없다:

| 지점 | 형태 |
|---|---|
| `users.service.ts:224` `create()` | 신규 엔티티 (스냅샷 아님) |
| `auth-oauth.service.ts:391` | QueryBuilder — 값을 **명시**해서 씀 |
| `auth-oauth.service.ts:408` · `auth.service.ts:166` | 트랜잭션 내 신규 생성 |
| `auth.service.ts:230` | 컬럼 단위 `update()` |
| `auth.service.ts:1172,1177` | 읽기 전용 `findOne` |

이 표를 유예 노트에 **전제로 명시**했다 — 스냅샷 전체 `save()` 가 새로 생기면 근거는 다시
무너진다. 반증 이력도 함께 남겼다.

## Warning

| # | 처리 | 내용 |
|---|---|---|
| 1 | 조치 불요 | OAuth `resolveUser()` 우회 — 이미 소스 캐너리 + plan W8/W9 로 추적 중이고, 5라운드에서 캐너리의 존재·작동을 뮤턴트로 재확인했다 |
| 2 | 수정 | 2MB 상한의 **강제**를 아무도 검증하지 않았다 — Swagger 는 `@ApiPayloadTooLargeResponse('파일 크기 초과 (2MB)')` 로 문서화하는데 413 을 실제로 받아 보는 테스트가 없었다. **또 문서한 보장이 구현보다 넓은 상태**다. e2e 에 2MB+1 바이트 → 413 케이스를 추가했다 |

## SPEC-DRIFT · INFO

SPEC-DRIFT 3건은 리뷰가 "코드 유지, planner 트랙에 대상 줄 번호까지 등재됨" 으로 판정.
INFO 16건도 전부 조치 불요이거나 이미 유예 등재다. INFO 1 이 지목한 "유예 노트의 정합성
문장이 반례를 만났다" 는 위에서 처리했다.

## 뮤테이션 5축 (예측 / 실측 — 전부 RED)

```
T1 원 결함 복원 (read-modify-write + save)      RED / RED 6
T2 SET 절에 avatar_url 추가                     RED / RED 1
T3 임계값을 SQL 리터럴로 하드코딩                RED / RED 1
T4 빈 결과에서 던지지 않고 0 반환                RED / RED 1
T5 잠금 시각을 DB NOW() 대신 파라미터로          RED / RED 1
```

T3 은 첫 시도에서 prettier 재포맷 때문에 파라미터 앵커가 안 맞은 **무효 뮤턴트**였다 —
그때의 GREEN 은 증거가 아니라 치환이 안 된 것이다. 실제 텍스트로 다시 돌려 RED 를 확인했다.

## 검증

lint(`--max-warnings 0`) · prettier · backend **440 suites / 9167 passed, 1 skipped** ·
docs 가드 **3104** · e2e(413 케이스 포함). 수치는 커밋 메시지에 실측으로 기록한다.
