# 동시성(Concurrency) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** `avatarUrl` 갱신 경쟁(TOCTOU) — 이미 식별·완화·문서화되었고 잔여 위험은 의도적으로 유예된 상태임을 확인
  - 위치: `codebase/backend/src/modules/users/users.service.ts:79-149` (`updateAvatar`), `:234-248` (`update`)
  - 상세: 두 메서드 모두 "SELECT(스냅샷) → 느린 I/O(S3 업로드 또는 없음) → UPDATE → 재조회 후 이전 URL 삭제" 패턴을 락 없이 수행한다.
    - **다른 컬럼에 대한 lost update는 실제로 해소됐다.** `updateAvatar`는 `save(snapshot)` 대신 `userRepository.update(userId, { avatarUrl })`로 딱 한 컬럼만 UPDATE 문에 실어, 업로드가 도는 수백 ms~수 초 동안 다른 요청(로그인 실패 카운터·계정 잠금·2FA 등록)이 바꾼 컬럼이 스냅샷의 옛 값으로 되돌아가는 경쟁이 성립하지 않는다. 이는 `users-avatar.service.spec.ts:355-396`에서 `Object.keys(patch)` 가 정확히 `['avatarUrl']` 하나뿐임을 단언해 고정돼 있다(과거 CRITICAL 회귀에 대한 mutation 가드).
    - **`avatarUrl` 자체를 둘러싼 경쟁은 남아 있다.** 같은 사용자가 동시에 두 번 업로드하거나(`updateAvatar` × `updateAvatar`), 업로드와 `PATCH /users/me`(`update`, 외부 URL 문자열 설정 가능)가 겹치면, 두 요청 모두 "정리 대상 이전 키"를 비원자적 사전 SELECT로 각자 독립적으로 계산한다. 최종적으로 DB의 `avatarUrl`은 늦게 쓴 요청의 값으로 수렴하지만, 먼저 쓴("패자") 요청이 업로드한 S3 객체는 어느 쪽 정리 로직도 "이전 URL"로 인식하지 못해 영구 고아로 남는다. 데이터 정합성(사용자가 보는 아바타는 항상 유효한 하나의 URL)은 깨지지 않고, 남는 것은 스토리지/과금 낭비뿐이다.
    - 이 정확한 분석(범위가 `updateAvatar` 끼리만이 아니라 `update`와의 교차 인터리빙까지 포함된다는 점 포함)은 이미 `plan/in-progress/spec-sync-user-profile-gaps.md:83-98`에 "동시 업로드 TOCTOU — 고아 객체"로 등재돼 있고, per-user advisory lock을 도입하지 않고 주기적 orphan-sweep으로 미루기로 한 근거(비용 대비 효과)와 재개 신호(`avatars/` 접두 객체 수가 사용자 수를 유의미하게 웃돌 때 — 프록시가 아니라 직접 측정 가능한 양)까지 명시돼 있다. 직접 소스를 읽고 트레이스를 재구성해 검증한 결과 이 서술은 정확하다 — 과소평가되거나 범위가 좁게 잡힌 부분이 없다.
  - 제안: 조치 불요 — 이미 올바르게 식별·유예된 항목이며 데이터 정합성에 영향이 없다. 다만 재개 신호(고아 객체 수 측정)를 실제로 관측 가능하게 하려면 `avatars/` 접두 객체 수 대비 사용자 수를 비교하는 운영 지표/배치 잡이 이 plan 항목의 향후 스코프에 필요하다는 점만 참고로 남긴다.

## 그 외 점검 결과 (문제 없음)

- **데드락**: 이번 변경은 락을 전혀 도입하지 않는다(위 lost-update 해소도 "락 대신 쓰는 컬럼을 줄이는" 방식). 락이 없으므로 여러 락 순서로 인한 데드락 가능성 자체가 없다.
- **동기화**: `S3Client`(`s3.service.ts:14`)는 AWS SDK가 동시 요청에 안전하도록 설계된 클라이언트이고, `S3Service`의 다른 상태(`bucket`·`publicBaseUrl`)는 생성자에서만 쓰이는 불변 필드라 요청 간 공유 가변 상태가 없다.
- **스레드 안전성**: Node.js 단일 스레드 이벤트 루프 모델이고, 신규 코드에 전역/모듈 스코프의 가변 공유 변수가 없다(`resolvePublicBaseUrl`은 순수 함수, `S3Service.publicBaseUrl`은 인스턴스별 불변 필드).
- **async/await**: `updateAvatar`·`update`·`deletePreviousAvatarObject`·`getPublicUrl`·`main.ts` 부팅 가드 전부 `await` 누락이나 fire-and-forget 호출 없이 순차/병렬 처리를 올바르게 사용한다. `Promise.all([findOneOrFail, deletePreviousAvatarObject])`(`users.service.ts:143-147`)은 두 프라미스가 서로의 결과에 의존하지 않고, `deletePreviousAvatarObject`는 내부에서 모든 예외를 삼켜(`:184-195`) `warn`으로만 남기므로 `Promise.all`이 그 실패로 조기 reject 되어 `updated` 조회를 가리는 일이 없다.
- **원자성**: "S3 업로드 → DB `avatarUrl` UPDATE → (병렬) 재조회 + 이전 객체 삭제" 순서가 고정돼 있고, 정리(delete)는 반드시 저장(UPDATE) 성공 **이후에만** 실행된다(주석·plan 문서에 명시, 순서를 뒤집으면 저장 실패 시 이미 지워진 URL이 남는 문제가 실제로 이전 리뷰 라운드에서 식별된 바 있음 — 그 회귀는 이번 diff에서 재발하지 않았다).
- **이벤트 루프**: `main.ts`의 신규 부팅 가드(`isPrivateHost` 호출)는 부팅 시 1회만 실행되는 동기 문자열/정규식 연산이며 요청 경로에 없다. 정규식은 앵커된 단순 패턴(`^fc[0-9a-f]{2}:` 류)이라 ReDoS류 이차 시간 위험도 없다.
- **리소스 풀링**: `S3Service`가 `UsersModule`의 로컬 provider로 등록돼 `S3Client`(및 keep-alive 커넥션 풀)가 `KnowledgeBaseModule`과 별개로 하나 더 생성되지만, Nest 싱글톤 스코프상 앱 부팅 시 1회만 생성되고 요청마다 재생성되지 않는다 — 동시성/경쟁 문제는 아니며(별도 `performance.md`가 이미 최적화 여지로만 INFO 기록), 본 리뷰 관점에서는 추가 지적 사항 없음.

## 요약

이번 PR의 동시성 관련 핵심 변경은 아바타 업로드 시 S3 업로드(수백 ms~수 초 I/O)가 진행되는 동안 다른 요청이 같은 사용자 row의 다른 컬럼(로그인 실패 카운터·계정 잠금 등)을 바꾸는 lost-update를 락 없이 — UPDATE 대상 컬럼을 `avatarUrl` 하나로 좁혀서 — 제거한 것이다. 이 수정은 정확하고, mutation-가드 테스트(`Object.keys(patch)` 정확 비교)로 회귀를 막고 있다. 소스를 직접 읽어 재구성한 결과, 락으로 닫지 않은 잔여 경쟁(`updateAvatar`끼리, 그리고 `updateAvatar`와 `update` 사이의 교차 인터리빙으로 인한 "패자" 업로드 객체의 영구 고아화)이 실제로 존재하지만, 이는 데이터 정합성을 깨지 않고(최종 `avatarUrl`은 항상 유효한 값으로 수렴) 저장소 낭비로만 귀결되며, `plan/in-progress/spec-sync-user-profile-gaps.md`에 정확한 범위(교차 인터리빙 포함)와 재개 신호(측정 가능한 양)까지 명시해 의도적으로 유예된 상태다. 그 외 async/await 누락, 원자성 위반, 이벤트 루프 블로킹, 락 순서로 인한 데드락 등 새로 도입된 문제는 발견되지 않았다.

## 위험도

LOW
