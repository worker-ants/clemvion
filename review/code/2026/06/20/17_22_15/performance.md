# 성능(Performance) 리뷰 결과

## 발견사항

### 발견사항 없음 — 성능 관점에서 중립적이거나 긍정적인 변경

이번 리팩터(refactor 02 C-3)는 순수한 레이어 이동(Controller → AuthService)이다. 아래 8개 점검 관점 각각에 대해 이슈가 없음을 확인한다.

---

- **[INFO]** `verifyPasswordForUser` 는 `usersService.findById` 1회 + `bcrypt.compare` 1회로 구성
  - 위치: `/codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser` 메서드
  - 상세: 기존 컨트롤러 코드(`usersService.findById` + `bcrypt.compare`)와 호출 횟수·순서·비용이 동일하다. 이동만 이루어졌으므로 알고리즘 복잡도·메모리 할당·블로킹 I/O 프로파일이 변경되지 않았다.
  - 제안: 없음.

- **[INFO]** 테스트 코드의 `bcrypt.hash(BCRYPT_ROUNDS)` 사용 (cost factor 12 → 해시 파일 내 `BCRYPT_ROUNDS` import)
  - 위치: `/codebase/backend/src/modules/auth/auth.service.spec.ts` — `verifyPasswordForUser` describe 블록
  - 상세: 신규 테스트 3개 중 2개가 `bcrypt.hash('...', BCRYPT_ROUNDS)` 를 `beforeEach` 외부 `it` 블록 상단에서 직접 호출한다. `BCRYPT_ROUNDS = 12` 는 운영 수준 cost factor이므로 단위 테스트에서는 느리게 실행된다. 그러나 이는 기존 spec 파일(e.g., `login` describe)에서도 동일하게 사용하던 패턴이며, **이번 변경이 추가한 구조적 비효율은 없다**. (참고로 컨트롤러 테스트에서 제거된 `bcrypt.hash('OldP@ssw0rd1', 4)` 는 cost 4였는데, 이를 `authService.verifyPasswordForUser.mockResolvedValue(undefined)` 로 대체해 테스트 실행 비용이 오히려 줄었다.)
  - 제안: 기존 auth.service.spec.ts 전체가 `BCRYPT_ROUNDS=12` 를 쓰는 것이 일관성 의도라면 현행 유지. 테스트 속도가 문제라면 스펙 파일 레벨에서 `jest.mock('bcrypt', ...)` 로 고정 해시를 반환하게 하는 것이 이 PR 범위를 넘어서는 별도 개선 사항이다.

- **[INFO]** `comparePassword` 헬퍼를 재사용 — bcrypt 계층 단일화
  - 위치: `/codebase/backend/src/common/utils/password.util.ts`
  - 상세: 기존 컨트롤러가 `import * as bcrypt from 'bcrypt'` 후 `bcrypt.compare` 를 직접 호출하던 것을 `comparePassword` 헬퍼로 통일함으로써, 향후 알고리즘 교체 시 변경 범위가 `password.util.ts` 한 곳으로 집중된다. 성능에 직접 영향을 주지는 않으나 유지보수 면에서 긍정적이다.
  - 제안: 없음.

---

## 요약

이번 변경은 bcrypt 비밀번호 재확인 로직을 `AuthController.disable2fa` 에서 `AuthService.verifyPasswordForUser` 로 이관하는 순수 레이어 리팩터이다. 새로 추가된 `verifyPasswordForUser` 는 기존 컨트롤러 코드와 동일하게 DB 조회 1회 + bcrypt.compare 1회를 수행하며, 반복문 내 호출·캐싱 필요성·메모리 누수·불필요한 연산·데이터 구조 오용 등 성능 관련 패턴 변화가 전혀 없다. 컨트롤러 테스트에서 실제 bcrypt 해시 생성을 mock 위임으로 대체해 테스트 실행 시간이 소폭 개선된 점도 긍정적이다.

## 위험도

NONE
