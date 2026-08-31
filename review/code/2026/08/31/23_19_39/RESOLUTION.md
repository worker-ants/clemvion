# RESOLUTION — 아바타 업로드 리뷰 3라운드 반영

대상 SUMMARY: 위험도 **CRITICAL** · Critical **1** · Warning **13** · INFO 7

발견의 성격이 옮겨갔다 — 1·2라운드는 **동작 결함**(500 전파, lost update)이었고 3라운드는
**배포 설정 1건 + 구조·문서·테스트 커버리지**다. 동작 결함이 새로 나오지 않은 것이 이 PR 의
수렴 신호다.

## Critical — 신규 env 를 overlay 가 안 덮어 프로덕션에 localhost 가 실린다

`S3_PUBLIC_BASE_URL` 을 base ConfigMap 에 넣으면서 prod·staging overlay 의 patch 목록에는
추가하지 않았다. 두 overlay 는 `S3_ENDPOINT`·`DB_HOST`·`REDIS_HOST` 를 전부 덮는데 신규
var 만 빠졌다. 그대로 배포되면 아바타 업로드는 **200 으로 성공하고** 응답의 `avatarUrl` 이
`http://localhost:9000` 을 가리켜 이미지가 전혀 뜨지 않는다 — 증상이 원인에서 멀다.

두 overlay 에 replace 를 추가하고 **`kubectl kustomize` 로 실제 렌더를 확인**했다:

```
$ kubectl kustomize k8s/overlays/prod    | grep S3_PUBLIC_BASE_URL
  S3_PUBLIC_BASE_URL: https://REPLACE_ME.cloudfront.net
$ kubectl kustomize k8s/overlays/staging | grep S3_PUBLIC_BASE_URL
  S3_PUBLIC_BASE_URL: https://REPLACE_ME.cloudfront.net
```

값은 `REPLACE_ME` sentinel 이다 — `localhost` 는 **그럴듯해 보여서** 넘어가지만
`REPLACE_ME.cloudfront.net` 은 안 고치면 눈에 띈다.

### 한 번 고치는 것으로 끝내지 않았다 — 부팅 경고를 붙였다

같은 클래스(신규 env 를 overlay 에 전파하지 않음)는 조용히 재발한다. `main.ts` 의 warn
정책 블록에, production 에서 공개 base 가 사설/loopback 주소를 가리키면 경고하도록 추가했다.

`throw` 가 아니라 `warn` 인 것은 바로 위 `ALLOW_PRIVATE_HOST_TARGETS` 와 같은 이유다 —
단일 호스트·사내망 self-host 배포는 사설 주소가 정답일 수 있다. `production-guards.ts` 는
스스로 "절대-금지 항목만 넣는다, 정당 용도가 있으면 warn 은 `main.ts`" 라고 경계를 적고
있고, 이 건은 후자다. (2라운드 INFO 3 의 제안과도 같은 방향이다.)

**판정은 손으로 짜지 않았다.** 처음엔 loopback 만 보는 정규식을 썼는데, 저장소에 정본
`isPrivateHost`(`common/utils/ssrf.util.ts`)가 이미 있었다. 그쪽이 loopback 에 더해
RFC1918·link-local·ULA·IPv4-mapped IPv6 까지 다루므로 **내 정규식은 한 칸 좁았다.**
실행해서 확인한 차이:

```
                              내 정규식   isPrivateHost
http://10.0.0.5:9000            미탐         경고
http://192.168.1.10             미탐         경고
http://localhost:9000           경고         경고
https://localhost.evil.com      미탐         미탐   (서브도메인 함정 — 둘 다 정상)
http://minio:9000               미탐         미탐   (DNS 이름은 동기 판정 불가 — 한계)
```

DNS 이름을 못 보는 것은 이 경고의 **한계이지 결함이 아니다** — 동기 부팅 경로에서 이름을
해석할 수 없고, `minio` 같은 이름은 리버스 프록시 뒤의 정당한 내부 DNS 와 구분되지 않는다.

## Warning

| # | 처리 | 내용 |
|---|---|---|
| 2 | **서술 정정** | CHANGELOG 의 "경쟁 자체를 없앴다" 가 **내가 만든 것보다 넓었다** — 아래 별도 항목 |
| 3 | 수정 | 쿼리스트링·프래그먼트 스트립 분기가 미커버(리뷰 실측: 지워도 27/27 GREEN). 3케이스 추가, 뮤턴트 P1 → **RED 3** |
| 4 | 수정 | 생성자 `?? endpoint` 2차 방어가 미커버(리뷰 실측: 81/81 GREEN). **내 주석이 그 방어를 설명하고 있었는데 검증이 없었다.** 테스트 추가, 뮤턴트 P2 → **RED 1** |
| 5·6 | 조치 안 함 | 검증 로직 private 헬퍼 분리 · spec 보일러플레이트 팩토리 통합 — 지금 크기에서 읽기가 나빠지지 않는다 |
| 7 | **기각** | `avatarUrl` 에 URL 대신 S3 key 저장 — 제안대로는 성립하지 않는다. 아래 별도 항목 |
| 8·9 | 유예 · 등재 | 정리 불변식을 쓰기 경로 한 곳으로 + `UserAvatarService` 분리. 재개 신호: **아바타 외에 S3 를 쓰는 사용자-스코프 리소스가 하나 더 생길 때** — 지금 나누면 소비자가 하나뿐인 추상이 된다 |
| 10 | 조치 안 함 | 정리를 fire-and-forget 으로 — 응답은 빨라지지만 **"저장 뒤 정리" 순서를 테스트로 관측할 수 없게 된다.** 그 순서는 실제 결함(저장 실패 시 이미 지워진 URL 이 남는 것)을 막는 축이라 지연보다 우선한다 |
| 11 | 조치 불요 | SPEC-DRIFT — 1라운드에서 이미 planner 위임에 3개 문서 전부 등재. 리뷰도 "처리 경로 정상" 으로 판정 |
| 12 | 수정 | `s3.config.ts` JSDoc 이 가리키는 §6.1 이 아직 "미구현" 이라 오도된다 → 배지 flip 이 planner 트랙임을 명시 |
| 13 | **수치 정정** | plan 두 곳이 회귀 테스트를 "13건" 으로 인용 — 아래 별도 항목 |
| 14 | 수정 | `PATCH /users/me` Swagger 에 아바타 교체 시 옛 객체 정리(best-effort) 부작용 명시 |

### W2 — 또 "문서한 보장이 구현보다 넓다"

CHANGELOG 에 *"쓰는 컬럼을 줄여 **경쟁 자체를 없앴다**"* 고 썼다. 없앤 것은 **다른 컬럼의
lost update** 뿐이다. 같은 사용자가 동시에 두 번 업로드하면 `avatarUrl` 자체를 두고 여전히
경합하고 패자의 객체는 고아로 남는다(2라운드에서 W5 로 유예한 바로 그 건).

두 문장이 같은 문서 안에서 서로를 반증하고 있었다. 서술을 "그 lost update 를 없앴다" 로
좁히고, 남아 있는 경합과 그 등재 위치를 이어 적었다.

### W7 을 유예가 아니라 기각한 이유

"URL 말고 S3 key 를 저장하고 읽을 때 `getPublicUrl(key)` 로 파생하라" 는 제안은 그 컬럼의
현재 계약과 양립하지 않는다. `avatarUrl` 은 **우리가 올린 객체의 URL 만 담지 않는다**:

- `update-me.dto.ts:59` — `@IsUrl({ require_tld: false })`. 계약이 URL 이다.
- `auth-oauth.service.ts:311` — OAuth 제공자의 사진 URL 을 그대로 넣는다.

외부 URL 과 자체 업로드가 **같은 컬럼을 공유**하므로, key 로 바꾸려면 판별 컬럼이나 별도
컬럼이 필요하고 그건 이 항목의 범위를 넘는 데이터 모델 변경이다. URL→key 역산이 남는 것은
그 공유의 대가다. 제안 후반부(역산 로직을 `S3Service` 로 옮겨 build/parse 대칭)는 유효하며
W8·W9 항목과 함께 등재했다.

### W13 — 착수 시점 수치가 그대로 남았다

plan 두 곳이 회귀 테스트를 "13건" 으로 인용하는데, 리뷰 1~3라운드 대응으로 늘어난 뒤라
같은 커밋 안에서 자기모순이었다. **실측**으로 고쳤다:

```
$ npx jest --silent src/modules/users/users-avatar.service.spec.ts
Tests:       30 passed, 30 total
```

"30건(착수 시 3축 13건 + 리뷰 대응 17건)" 으로 적고, 착수 시점 표는 그 시점의 것임을
명시했다. — 문서에 수치를 쓰는 **그 시점에** 다시 재는 습관이 또 필요했다.

## INFO

15(매직바이트)·17(`updateReturningRows`)·18(스트리밍)·20(`StorageModule`)·21(상수 위치)은
리뷰가 "현재 조치 불요/우선순위 낮음" 으로 판정한 항목이라 미조치. 16(버킷 정책 스모크
체크)·19(URL↔key 대칭)는 이미 plan 유예 항목에 포함된다.

## 뮤테이션 2축 (예측 / 실측 — 전부 RED)

```
P1 쿼리·프래그먼트 스트립 제거          RED / RED 3
P2 생성자 ?? endpoint 2차 방어 제거     RED / RED 1
```

두 축 모두 **리뷰어가 뮤테이션으로 "생존" 을 실측해 지목한 자리**다(27/27·81/81 GREEN).
테스트를 붙인 뒤 같은 뮤턴트가 RED 로 뒤집히는지 확인했다.

## 검증

lint(`--max-warnings 0`) · prettier · backend **439 suites / 9140 passed, 1 skipped** ·
docs 가드 **3104** · e2e · `kubectl kustomize` 로 두 overlay 렌더 확인.
