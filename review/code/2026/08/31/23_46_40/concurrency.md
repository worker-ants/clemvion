# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[WARNING]** 아바타 교체 시 "옛 객체 정리"가 read-then-write-then-cleanup 3단 비원자 시퀀스라, 같은 사용자의 동시 요청(더블클릭·다중 탭)이 겹치면 TOCTOU 경쟁이 존재한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:113` (`const user = await this.userRepository.findOne(...)` — 사전 스냅샷), `codebase/backend/src/modules/users/users.service.ts:122` (`const previousUrl = user.avatarUrl;`), `codebase/backend/src/modules/users/users.service.ts:137` (`await this.userRepository.update(userId, { avatarUrl });`), `codebase/backend/src/modules/users/users.service.ts:145` (`await this.deletePreviousAvatarObject(userId, previousUrl);`) — `updateAvatar()`. 같은 패턴이 `codebase/backend/src/modules/users/users.service.ts:232`~`246` 의 `update()` 에도 있다(`'avatarUrl' in data` 분기의 사전 SELECT → `userRepository.update` → 재조회 → 값 비교 → cleanup).
  - 상세: 두 요청이 동시에 같은 사용자의 아바타를 바꾸면, 둘 다 같은 `previousUrl`(교체 전 값)을 읽을 수 있다. 이후 DB 컬럼 갱신은 "마지막에 쓰는 쪽이 이긴다"(last-write-wins, 컬럼 단위 UPDATE라 다른 컬럼은 안전 — 이건 이 PR 이 고친 부분이다)로 수렴하지만, **승자가 아닌 쪽이 업로드한 S3 객체는 어느 cleanup 경로도 대상으로 잡지 못해 영구 고아로 남는다.** 직접 재현 추적(코드 경로 시뮬레이션)으로는 데이터 정합성(최종 `avatarUrl` 이 가리키는 객체가 실제로 존재)이 깨지는 시나리오는 찾지 못했다 — 항상 "고아 객체가 남는다" 로 수렴하고 "존재하지 않는 객체를 가리킨다" 로는 가지 않았다. 즉 사용자에게 보이는 아바타는 항상 올바르며, 새는 것은 과금·용량뿐이다.
  - 제안: 이미 `plan/in-progress/spec-sync-user-profile-gaps.md` 의 W5 항목으로 식별·유예되어 있다(사용자 결정: per-user advisory lock 은 과대, 주기적 orphan-sweep 이 더 맞는 도구, 재개 신호=`avatars/` 객체 수가 사용자 수를 유의미하게 웃돌 때). **본 리뷰는 그 유예 판단에 동의한다** — 락 없이 "쓰는 컬럼을 줄이는" 이번 수정으로 lost-update(다른 컬럼 되돌아감)는 이미 없앴고, 남은 것은 orphan-only 이며 직렬화 비용 대비 편익이 낮다. 다만 이 경쟁이 **새로 도입된 코드**(이 PR 의 `updateAvatar`/`deletePreviousAvatarObject`, 그리고 `update()` 의 avatarUrl 정리 분기)에 있다는 점은 이 리뷰 문서에도 명시해 두어, 다음 사람이 "동시성 리뷰가 이 경로를 못 봤다"고 오독하지 않게 한다.

- **[INFO]** (긍정 확인) 아바타 교체의 진짜 위험이었던 lost-update — S3 업로드가 도는 수백ms~수초 사이 다른 요청(로그인 실패 카운터·계정 잠금·2FA 등록)이 바꾼 컬럼이 스냅샷 `save()` 로 조용히 되돌아가는 문제 — 는 **락이 아니라 컬럼 범위를 좁힌 UPDATE 로 원천 제거**됐다. `codebase/backend/src/modules/users/users.service.ts:137` (`await this.userRepository.update(userId, { avatarUrl });` — `save(user)` 아님), 회귀는 `codebase/backend/src/modules/users/users-avatar.service.spec.ts:318`(`update 는 avatarUrl 단 하나만 싣는다`)이 UPDATE 페이로드의 키 집합을 정확히(`toEqual(['avatarUrl'])`) 고정한다. 복합 연산(읽기→S3 I/O→쓰기)에서 "쓰는 표면을 최소화해 경쟁을 없앤다"는 설계가 올바르게 적용됐다.

- **[INFO]** async/await·이벤트 루프 관점에서 결함 없음. `updateAvatar()`/`update()`/`deletePreviousAvatarObject()` 모두 순차 `await` 체인이고 누락된 await 나 fire-and-forget 은 없다(`deletePreviousAvatarObject` 호출부 2곳 — `users.service.ts:145`, `users.service.ts:243` — 둘 다 `await` 됨). 업로드~삭제 전 구간은 전부 I/O 대기(S3/DB)라 CPU 블로킹도 없다. `S3Service` 는 NestJS 기본 싱글톤 provider이고 내부 상태(`publicBaseUrl`·`bucket`·`client`)는 생성자에서 한 번 설정된 뒤 불변이라 요청 간 공유되어도 스레드 안전성 문제가 없다(Node 단일 스레드 + 상태 불변).

- **[INFO]** `deletePreviousAvatarObject` 의 userId 앵커(`avatarKeyPrefix(userId)` prefix 매칭)가 cross-user 삭제를 구조적으로 차단한다 — 동시성 경쟁이 있어도 "내 아바타가 아닌 키"는 애초에 정리 대상 계산에 들어오지 않는다(`users-avatar.service.spec.ts:164` "남의 아바타 키는 지우지 않는다" 로 회귀 고정). 따라서 위 TOCTOU 는 가용성(고아 객체) 문제일 뿐 격리·권한 경계를 침범하지 않는다.

## 요약

이 PR 의 핵심 동시성 리스크(같은 row 를 향한 두 요청의 "다른 컬럼" lost-update)는 스냅샷 `save()` 대신 `avatarUrl` 단일 컬럼 `update()` 로 전환해 락 없이 제거했고, 회귀 테스트로 UPDATE 페이로드의 키 집합을 정확히 고정해 재발을 막았다 — 복합 연산의 원자성 확보 방식으로 타당하다. 남은 경쟁은 동일 사용자의 동시 아바타 교체 시 "패자" 요청이 올린 S3 객체가 고아로 남는 TOCTOU 하나뿐이며, 데이터 정합성(사용자가 보는 최종 `avatarUrl`)은 항상 올바른 값으로 수렴하고 cross-user 삭제 위험도 없다. 이 경쟁은 이미 `plan/in-progress/spec-sync-user-profile-gaps.md` W5 로 식별되어 advisory lock 대신 주기적 orphan-sweep 을 재개 조건과 함께 명시적으로 유예한 상태이며, 그 판단(직렬화 비용 > 편익, 정합성 무영향)에 동의한다. async/await 사용, 이벤트 루프 블로킹, 스레드 안전성, 리소스 풀링 관점에서는 결함을 찾지 못했다.

## 위험도

LOW
