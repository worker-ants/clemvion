# 성능(Performance) 코드 리뷰

## 발견사항

- **[WARNING]** `updateAvatar` 응답 경로에서 서로 독립적인 두 I/O(갱신된 엔티티 재조회, 옛 아바타 S3 삭제)를 불필요하게 직렬로 기다린다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:139` (`findOneOrFail`) 및 `:145` (`deletePreviousAvatarObject` 호출) — `updateAvatar` 메서드
  - 상세: `139| const updated = await this.userRepository.findOneOrFail({ where: { id: userId } });` 로 최신 상태를 읽은 **뒤에** `145| await this.deletePreviousAvatarObject(userId, previousUrl);` 를 또 기다린다. 두 호출 모두 앞선 `137| await this.userRepository.update(userId, { avatarUrl });` 이 성공한 뒤에만 실행되면 되고, 서로의 결과값을 소비하지 않는다(`updated` 는 `deletePreviousAvatarObject` 에 넘기지 않고, `deletePreviousAvatarObject` 의 반환값도 쓰지 않음). 즉 "DB 재조회(SELECT)" 와 "S3 DELETE 네트워크 호출" 이 인과관계 없이 순서만 강제돼 있어, 매 아바타 업로드/교체 요청마다 두 I/O 왕복 시간이 그대로 더해져 응답 지연에 누적된다.
  - 제안: `const [updated] = await Promise.all([this.userRepository.findOneOrFail({ where: { id: userId } }), this.deletePreviousAvatarObject(userId, previousUrl)]);` 형태로 병렬화한다. "정리는 DB 저장 **뒤에** 일어나야 한다"는 순서 불변식(저장 실패 시 정리 금지)은 이미 `update()` 호출 성공 이후 지점에서 두 작업을 시작하므로 그대로 보존된다 — 재조회와 삭제 사이의 순서는 정합성에 영향을 주지 않는다.

- **[INFO]** 아바타 업로드 1건이 응답 전 5개의 순차 I/O(SELECT → S3 PUT → UPDATE → SELECT → S3 DELETE)를 완주해야 응답이 나간다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:113`(`findOne`), `:124`(`s3Service.upload`), `:137`(`update`), `:139`(`findOneOrFail`), `:145`(`deletePreviousAvatarObject`) — `updateAvatar`
  - 상세: 특히 옛 객체 삭제(S3 DELETE, `:145`)는 클라이언트가 필요로 하는 응답 데이터(`updated`)와 무관한 부수 정리 작업인데도 응답 전송을 막는다. MinIO/S3 응답 지연이 그대로 사용자 체감 지연으로 전이된다.
  - 제안: 이미 `plan/in-progress/spec-sync-user-profile-gaps.md` (W10)에서 fire-and-forget 대안이 검토됐고 "저장 뒤 정리 순서를 테스트로 관측할 수 없게 만든다"는 이유로 의도적으로 기각된 것으로 보인다. 그 판단 자체는 합리적이나(정합성 > 지연), 성능 관점의 관찰로 남겨둔다 — 위 F1의 `Promise.all` 병렬화만으로도 정합성 보장을 유지한 채 지연을 일부 줄일 수 있다. 만약 향후 S3/MinIO 지연이 커지면(리전 간 CDN 미도입 등) 정리 실패를 별도 큐/백그라운드로 옮기되 실패를 로그·메트릭으로 계속 관측하는 절충안을 고려할 것.

- **[INFO]** `UPDATE` 후 별도 `findOneOrFail` SELECT 를 또 실행해 DB 왕복이 1회 더 늘어난다(총 SELECT→UPDATE→SELECT 3왕복).
  - 위치: `codebase/backend/src/modules/users/users.service.ts:137`(`update`), `:139-141`(`findOneOrFail`)
  - 상세: PostgreSQL 의 `UPDATE ... RETURNING` 을 쓰면 2왕복(SELECT + UPDATE...RETURNING)으로 줄일 수 있다. 다만 이 저장소의 기존 `update()` 메서드(`:232-246`, 동일 파일)도 같은 2단계(`update` 뒤 `findOneOrFail`) 패턴을 이미 쓰고 있어, 이번 PR 이 새로 만든 회귀가 아니라 기존 관례를 따른 것이다. CHANGELOG 에 "raw UPDATE/DELETE … RETURNING 회귀 가드"가 이미 존재한다는 점에서, 이 경로도 여지가 있다는 정도로만 기록한다(우선순위 낮음 — 아바타 업로드는 hot path 가 아님).
  - 제안: 급하지 않음. 추후 `RETURNING` 패턴을 이 서비스 전반에 도입할 때 함께 처리.

- **[INFO]** `update()` 는 payload 에 `avatarUrl` 이 있을 때만 사전 SELECT 를 수행하도록 가드해, 17개 호출부(로그인 실패 카운터·2FA 등 대부분 hot path) 에 불필요한 N+1 SELECT 를 추가하지 않았다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:233-238` — `update()` 의 `'avatarUrl' in data` 조건부 조회
  - 상세: 긍정적 설계 판단이라 조치 불필요. 참고로 남긴다 — 무조건 사전 조회를 했다면 인증·TOTP 등 자주 호출되는 부분 갱신 경로 전체에 SELECT 가 하나씩 추가되는 실질적 N+1 이 됐을 것이다.

## 요약

이번 변경은 주로 정합성(lost update 제거·키 추측 불가능성·Content-Type 스푸핑 방지)에 초점이 맞춰진 PR 로, 알고리즘 복잡도·N+1 쿼리·부적절한 자료구조·과도한 메모리 할당 같은 구조적 성능 문제는 발견되지 않았다. 업로드 파일은 multer 메모리 스토리지로 `AVATAR_MAX_BYTES`(2MB) 상한이 걸려 있어 메모리 사용량이 유계이고, `AVATAR_CONTENT_TYPES` 조회·`getPublicUrl` 의 세그먼트 인코딩 등은 요청당 상수 시간 연산이라 문제 없다. 유일하게 눈에 띄는 것은 `updateAvatar` 응답 경로가 서로 의존관계 없는 DB 재조회와 S3 삭제를 불필요하게 직렬로 기다린다는 점(F1)과, 그 결과 요청 하나가 5단계 순차 I/O를 완주해야 응답한다는 점(F2)이다. F1은 `Promise.all` 로 즉시 고칠 수 있는 무해한 개선이고, F2·F3 은 이미 plan 문서에서 의식적으로 검토·기각되었거나 기존 관례를 따른 것이라 우선순위가 낮다. docker-compose/k8s/README 등 인프라·문서 변경분은 애플리케이션 런타임 성능과 무관하다.

## 위험도

LOW
