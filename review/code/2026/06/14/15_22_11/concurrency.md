# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] Promise.all 병렬화 — 올바른 패턴
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `getUsage()` 내 `Promise.all([...])` 블록
- 상세: 3개의 독립 TypeORM 쿼리(getCount / getRawOne / getMany)를 `Promise.all`로 병렬 실행하는 것은 올바르다. 각 쿼리는 별도 `createQueryBuilder` 인스턴스를 사용하므로 공유 상태 오염이 없고, 파라미터 혼용 위험도 없다. 주석(W-4, W-11)에서 이 설계 의도를 명확히 기술하고 있으며 테스트도 독립 QB 객체로 검증한다.
- 제안: 해당 없음.

### [INFO] `now = Date.now()` 단일 캡처
- 위치: `auth-configs.service.ts` 560번째 줄 근처 `const now = Date.now()`
- 상세: `Promise.all` 진입 전에 `now`를 한 번 캡처하고 3개 쿼리의 시간 파라미터를 모두 동일 기준 시각으로 계산한다. 각 쿼리가 DB에 도달하는 시점 차이(수 ms)는 롤링 윈도 경계 판단에 실질적 영향이 없다. 올바른 접근이다.
- 제안: 해당 없음.

### [INFO] async/await 누락 없음
- 위치: 모든 변경 파일의 async 함수
- 상세: `getUsage`, `handleWebhook`, `execute` 등 변경된 모든 async 함수에서 `await` 누락은 발견되지 않았다. `Promise.all` 반환값도 올바르게 `await`한다.
- 제안: 해당 없음.

### [INFO] 이벤트 루프 블로킹 없음
- 위치: 전체 변경 범위
- 상세: `safeCount` 함수는 순수 동기 연산으로 이벤트 루프를 블로킹하지 않는다. DB 쿼리는 모두 TypeORM 비동기 API를 사용한다. 프론트엔드 React 컴포넌트 변경(`page.tsx`)도 TanStack Query를 통한 표준 비동기 데이터 페칭 패턴이다.
- 제안: 해당 없음.

## 요약

변경된 코드에서 동시성 관련 문제는 발견되지 않았다. 핵심 변경인 `getUsage`의 `Promise.all` 병렬 쿼리는 각 QB 인스턴스가 완전히 독립적이어서 경쟁 조건·파라미터 혼용 위험이 없다. `now` 단일 캡처로 롤링 윈도 기준 시각 일관성을 확보했으며, async/await 패턴도 적절히 사용되었다. SQL 마이그레이션(V096)은 DDL 단계의 동시성 이슈(테이블 락)를 내포할 수 있으나, 이는 DB 운영 레벨 문제로 애플리케이션 코드 범위 밖이다.

## 위험도

NONE

STATUS=success ISSUES=0
