# 동시성(Concurrency) 코드 리뷰 — 아바타 업로드(공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** 동시(중복) 아바타 업로드 시 `previousUrl` 이 요청 시작 시점 스냅샷이라, S3 업로드(수백 ms~수 초)
  구간에서 경합이 일어나면 패자(loser) 쪽이 방금 올린 S3 객체가 영구 고아로 남을 수 있다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:79`~`147` (`updateAvatar`), 특히
    `:122`(`const previousUrl = user.avatarUrl;`), `:124`(`await this.s3Service.upload(...)`),
    `:137`(`await this.userRepository.update(userId, { avatarUrl });`), `:145`
    (`await this.deletePreviousAvatarObject(userId, previousUrl);`)
  - 상세: 이 PR 의 CHANGELOG·JSDoc 은 "쓰는 컬럼을 줄여 경쟁 자체를 없앴다" 고 적었는데, 이 주장이
    맞는 범위는 **다른 사용자 컬럼(로그인 실패 카운터·계정 잠금·2FA 등)의 lost update** 뿐이다.
    `avatarUrl` 컬럼 자체를 두 요청이 동시에 갈아 끼우는 race 는 별개이고 남아 있다.

    재현 시나리오(더블클릭·재시도·다중 탭에서 거의 동시에 `POST /api/users/me/avatar` 두 번):
    1. 요청 A, B 가 각각 `findOne` 으로 사용자를 읽는다 — 최초 아바타가 없으면 둘 다
       `previousUrl = null` 을 관측한다(122행).
    2. A 는 S3 에 `key_A` 업로드, DB `avatarUrl` 을 `key_A` 로 갱신(124·137행).
    3. B 가 나중에 커밋되면 DB `avatarUrl` 은 `key_B` 로 덮인다 — `key_A` 는 이제 아무 곳에서도
       참조되지 않는 고아 오브젝트다.
    4. 그런데 A·B 모두 자신의 `previousUrl` 이 `null` 이었으므로 `deletePreviousAvatarObject`
       (167행)는 `if (!previousUrl) return;`(171행)로 즉시 반환한다 — `key_A` 를 지우는 코드
       경로가 **어디에도 없다.** 이후 어떤 사용자 요청도 `key_A` 를 "previous" 로 다시 관측할
       기회가 없으므로 (다음 교체는 `key_B` 를 previous 로 볼 것이다) 영구 고아로 남는다.

    이미 아바타가 있던 상태(A,B 모두 `previousUrl = keyOld`)에서 경합해도 같은 패턴이
    재발한다 — 패자의 신규 업로드 객체만 고아가 되고, `keyOld` 는 승자·패자 양쪽이 중복
    삭제하지만(멱등, 무해) 패자 자신의 신규 객체는 누구도 추적하지 않는다.

    `users-avatar.service.spec.ts` 의 "축 3" 테스트들은 전부 `await` 를 순차로 걸어(예:
    967행 이하 `await service.updateAvatar(...); await service.updateAvatar(...)`) 실행하므로
    이 경합을 재현하지 않는다 — 즉 이 race 는 테스트로 방어되어 있지 않다.
  - 제안: 심각도는 낮다(보안·데이터 손실 없음, 스토리지 누수뿐이고 정상 last-write-wins 의미론은
    유지된다)고 판단해 WARNING 으로 분류했지만, 더블클릭 같은 흔한 UX 패턴으로 촉발되므로 문서화는
    필요하다. 완전한 수정은 `avatarUrl` 컬럼에 조건부 UPDATE(예: `WHERE avatarUrl = :expected`)로
    낙관적 동시성 제어를 걸어 패자가 "내가 진짜로 교체했는지"를 알게 하거나, per-user
    advisory lock(`pg_advisory_xact_lock(hashtext(userId))`)으로 이 메서드를 직렬화하는 것이다.
    최소한으로는 CHANGELOG/JSDoc 의 "경쟁 자체를 없앴다" 는 문구를 "다른 컬럼에 대한 lost
    update 는 없앴다(같은 `avatarUrl` 컬럼끼리의 동시 교체 경합은 별개, best-effort 로 남음)"
    로 좁혀 다음 사람이 이 범위를 과신하지 않게 하는 것을 권한다.

- **[INFO]** `update()`/`updateAvatar()` 모두 `UPDATE` 후 별도 `findOneOrFail` 로 재조회한다 —
  그 사이(자신의 UPDATE 커밋과 자신의 SELECT 사이)에 같은 행에 대한 다른 동시 쓰기가 끼어들면,
  요청이 돌려주는 응답 페이로드가 **자신이 방금 쓴 값이 아니라 그 사이 끼어든 다른 요청의 값**을
  반영할 수 있다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:137-141`(`updateAvatar` 의
    `update` → `findOneOrFail`), `:239-240`(`update()` 의 동일 패턴)
  - 상세: 이 UPDATE→SELECT 분리 패턴 자체는 이 PR 이전부터 있던 기존 설계(`update()` 의 원래
    구현)라 이 PR 이 새로 만든 문제는 아니다. 다만 이 PR 은 `updateAvatar()` 를 이 패턴의 새
    소비자로 추가했고, 그 재조회 값을 `deletePreviousAvatarObject` 의 "무엇이 최종 상태인가"
    판단에 쓰지는 않으므로(정리 판단은 자신이 시작 시점에 읽은 `previousUrl` 만 근거로 함)
    삭제 판단 자체는 이 이슈로 오염되지 않는다 — 영향 범위는 **HTTP 응답 바디**로 한정된다.
    같은 사용자가 다중 탭에서 동시에 프로필을 고칠 때만 노출되는 좁은 엣지 케이스이며, 다른
    사용자의 데이터가 섞이는 것은 아니다(행 자체가 같은 사용자 소유이므로 정보 유출은 아님).
  - 제안: 심각도가 낮아 INFO 로만 남긴다. 만약 클라이언트가 이 응답을 신뢰해 로컬 상태를
    덮어쓰는 UX 라면 낙관적 락 없이도 `RETURNING` 절이 있는 단일 `UPDATE ... RETURNING *` 로
    바꿔 자신의 쓰기와 읽기를 원자적으로 묶는 편이 안전하다(단, TypeORM `update()` 는 기본적으로
    RETURNING 을 안 주므로 raw query 또는 `QueryBuilder` 전환이 필요 — 이 저장소의 raw
    UPDATE/DELETE…RETURNING 가드와 함께 검토).

## 요약

이번 변경의 핵심 동시성 리스크는 이미 저자가 인지하고 방어한 "S3 업로드 대기 중 다른 요청이 사용자
행의 다른 컬럼을 바꾸는" lost-update 케이스(`save()` 대신 컬럼 단위 `update()`로 해소, 테스트로
고정됨)는 잘 처리되어 있다. 다만 그 방어의 서술("경쟁 자체를 없앴다")이 다루는 범위보다, 실제로
남아 있는 `avatarUrl` 컬럼 자체에 대한 동시 교체 경합(더블클릭·다중 탭에서 두 업로드가 겹치는 경우)이
있다 — 패자의 신규 S3 객체가 추적 불가능한 영구 고아로 남을 수 있다. 보안·데이터 무결성 이슈는
아니고 스토리지 누수에 그치므로 전체 위험도는 낮게 평가하되, 문서 주장의 범위 축소와 향후 낙관적
락/advisory lock 검토를 권고한다. 그 외 `S3Service`, `s3.config.ts` 의 `publicBaseUrl` 폴백은
읽기 전용 불변 설정이라 동시성 이슈가 없고, `async/await` 사용·에러 전파(특히 `decodeURIComponent`
를 `try` 안으로 옮긴 정정)는 정확하다. 데드락·락 사용은 없으므로(설계상 lock-free) 해당 리스크는
없다.

## 위험도

LOW
