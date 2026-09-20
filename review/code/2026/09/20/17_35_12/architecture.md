# Architecture Review — rotate() lost-update 수정

## 발견사항

- **[WARNING]** `rotate()` 안에서 "조직 스코프 권한 재검사" 로직이 락 전/후로 그대로 복제됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1093-1099` (락 밖, `entity.scope`) 와 `codebase/backend/src/modules/integrations/integrations.service.ts:1159-1165` (락 안, `fresh.scope`)
  - 상세: 두 블록은 검사 조건(`scope === 'organization' && !this.isAdmin(userRole)`)과 예외 페이로드(`code: 'FORBIDDEN'`, 동일 메시지 문자열)가 완전히 동일하며, 대상 변수만 `entity` → `fresh` 로 바뀌었다. 지금은 "스캐폴딩" 성격의 방어적 재검사이지만, 이 메시지나 판정 규칙이 나중에 바뀌면(예: role 종류 추가, 메시지 다국어화) 한쪽만 고치고 다른 쪽을 놓치는 실수가 나기 쉽다. 하필 이 함수는 이번 PR 이 "락 안에서 다시 검사해야 한다" 는 불변식을 새로 세운 자리이므로, 그 불변식을 지키는 코드 자체가 복제돼 있으면 다음 사람이 그 불변식의 소스가 두 곳이라는 것을 알아채기 어렵다.
  - 제안: `private assertRotatePermission(scope: string, userRole: string | null): void` 같은 private 헬퍼로 추출해 두 지점에서 호출한다. 그러면 "권한 판정은 이 함수 하나" 라는 불변식이 코드 구조로 강제된다.

- **[WARNING]** "credentials 병합 + 구조 검증" 로직이 락 전/후로 사실상 복사-붙여넣기됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1104-1118` (`baseCreds`/`merged`/`errors`, `entity` 기준) 와 `codebase/backend/src/modules/integrations/integrations.service.ts:1167-1182` (`freshBase`/`committed`/`freshErrors`, `fresh` 기준)
  - 상세: `isUnreadableCredentials(...) ? {} : x.credentials` → `{ ...base, ...body.credentials }` → `validateCredentials(x.serviceType, x.authType, merged)` → `errors.length` 체크 → `BadRequestException({ code: 'INTEGRATION_INVALID_CREDENTIALS', ... })` 시퀀스가 변수명만 바뀐 채 두 번 존재한다. `isUnreadableCredentials` + `validateCredentials` 조합은 이 파일 안에서 이미 여러 번(963행, 1451행 등) 독립적으로 반복돼 온 패턴인데, 이번 PR 로 그 반복이 **같은 메서드 안에서** 한 번 더 늘었다. 코드 리뷰 코멘트 자체가 "머지 base 가 바뀌었으므로 구조 검증을 다시 돌린다" 고 명시적으로 설명하고 있어 의도는 분명하지만, 그 설명이 곧 "핵심 로직이 두 곳에 있다" 는 뜻이기도 하다 — 예컨대 `validateCredentials` 호출 인자 순서를 바꾸는 리팩터링이나, 병합 시 특정 필드를 제외해야 하는 새 요구사항이 생기면 두 블록 중 하나만 고쳐질 위험이 있고, 하필 그 대상이 동시성 유실을 막는 재검증 경로다.
  - 제안: `private mergeAndValidateCredentials(target: { serviceType: string; authType: string; credentials: Record<string, unknown> }, patch: Record<string, unknown>): Record<string, unknown>` (검증 실패 시 스스로 `BadRequestException` throw) 형태로 추출해 두 지점(사전 검사·락 안 재검사)에서 재사용한다.

- **[INFO]** 트랜잭션 관리(락 획득 → 재읽기 → 병합 → 부분 `update`)가 서비스 레이어에 직접 인라인돼 있고, 같은 모듈에 이미 동일 모양의 블록이 하나 더 있음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1146-1209` (`rotate()` 의 `this.dataSource.transaction(...)` 블록) vs `codebase/backend/src/modules/integrations/integration-oauth.service.ts:721-785` (재인증 콜백의 `CONC H-3` 블록)
  - 상세: `IntegrationsService`/`IntegrationOAuthService` 둘 다 "raw `DataSource.transaction` 진입 → `manager.getRepository(Integration)` → `pessimistic_write` 로 재조회 → 병합 → 쓰기" 라는 동일한 모양의 unit-of-work 를 서비스 메서드 본문에 직접 펼쳐 놓는다. 이는 트랜잭션 경계·락 모드 같은 영속성 계층 관심사가 비즈니스 서비스 메서드 안에 그대로 노출된 것으로, 두 서비스가 이미 이 모양을 공유하는데도 추상화를 공유하지 않는다(리포지토리 계층에 "락을 쥐고 재조회" 를 캡슐화한 메서드가 없다). 이번 PR 로 등장 횟수가 2회가 됐으므로 지금 당장 추출을 강제할 정도는 아니지만("Rule of Three" 미달), 세 번째 사례가 생기면 공통 헬퍼(예: `IntegrationsRepositoryHelper.withRowLock(id, workspaceId, fn)`)로 뽑아낼 필요가 있다. 코드 자체의 주석이 CONC H-3 을 정확히 인용하고 있어 "왜 같은 모양인가" 는 잘 설명돼 있다.
  - 제안: 지금 당장 조치 불필요. 다음에 세 번째 "재조회+락+병합" 케이스가 생기면 공통 유틸로 추출을 고려.

- **[INFO]** 단위 테스트가 `findOne` mock 호출 순서(인덱스)에 의존해 "락 안 재읽기" 를 식별함
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1401-1405` (`integrationRepo.findOne.mock.calls[1]`)
  - 상세: `dataSource.transaction` mock(`integrations.service.spec.ts:171-178`)이 `manager.getRepository()` 를 항상 같은 `integrationRepo` mock 으로 되돌리기 때문에, `requireEntity()`(직접 주입된 `integrationRepository`)와 트랜잭션 안 `repo.findOne()`(`manager.getRepository(Integration)`)이 **같은 mock 객체의 같은 `mock.calls` 배열**을 공유한다. 테스트는 이 배열의 두 번째 호출(`calls[1]`)이 "락 안 재읽기" 라고 가정하는데, 이는 이름이 아니라 호출 순서에 의존하는 암묵적 계약이다 — `rotate()` 앞부분에 `findOne` 호출이 하나 더 늘면(예: 별도 사전 검증) 이 인덱스가 조용히 어긋나면서 테스트가 실패하지 않고 엉뚱한 호출을 검증하게 될 수 있다. 다만 이 패턴은 "형제 모듈 `integration-oauth.service.spec.ts` 와 같은 패턴" 이라는 주석(`integrations.service.spec.ts:69-70`)이 밝히듯 기존 테스트 관례를 그대로 따른 것이라 이번 PR 이 새로 만든 문제는 아니다.
  - 제안: 당장 조치 불요(기존 관례와 일관). 다만 향후 `rotate()` 앞단에 `findOne` 호출을 추가할 일이 생기면 이 인덱스 가정이 깨지지 않는지 함께 확인할 것.

- **[INFO]** e2e 테스트가 API 계약이 아니라 테이블/컬럼명을 직접 겨냥해 레이어 경계를 넘어감
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts:80-103` (`locker.query('SELECT … FROM integration … FOR UPDATE')`, `UPDATE integration SET credentials = …`)
  - 상세: 이 e2e 는 블랙박스로 HTTP API 만 두드리는 대신, 별도 pg 커넥션으로 `integration` 테이블에 직접 `FOR UPDATE`/`UPDATE` 를 실행해 "동시 rotate 가 커밋한 상태" 를 흉내 낸다. 서비스 API 계층을 우회해 스키마(테이블명·컬럼명)에 테스트가 결합되므로, 향후 스키마 리팩터(예: 테이블명 변경, 컬럼 rename 마이그레이션)가 있으면 이 e2e 가 API 계약과 무관하게 깨진다. 다만 이 기법은 파일 docblock(11-20행)이 스스로 근거를 밝히듯 "credentials 는 컬럼 transformer 로 암호화돼 있어 평문 SQL 삽입이 불가능하고, rotate API 를 한 번 더 부르면 같은 락에 막힌다" 는 제약을 우회하기 위한 의도적 선택이며, 선례(`plan/complete/trigger-config-lost-update.md §C`)도 같은 기법을 쓴다. 결정론적 레이스 재현을 위한 정당한 트레이드오프로 보인다.
  - 제안: 조치 불요(의도적·선례 일치). 스키마 변경 시 이 e2e 도 함께 갱신해야 한다는 점만 인지.

## 요약

핵심 아키텍처 결정 — 외부 연결 테스트(수 초 소요)는 트랜잭션 밖에 두고, DB 트랜잭션은 "재조회 + 병합 + 부분 update" 라는 짧은 임계 구간에만 `pessimistic_write` 로 좁힌 것 — 는 건전하다. 같은 모듈의 기존 선례(재인증 콜백 CONC H-3)와 모양을 맞췄고, `4-integration.md` 가 기각한 advisory lock 재도입이 아님을 주석으로 정확히 구분해 근거를 남겼으며, 테넌트 격리(`workspaceId` 조건)도 락 안 재조회에 유지된다. 다만 이 처방을 구현하며 "권한 재검사" 와 "credentials 병합+구조검증" 두 로직 블록을 락 전/후에 사실상 복사-붙여넣기했다 — 정확히 이 PR 이 강화하려는 불변식(락 안에서 다시 검사해야 진짜)을 지키는 코드 자체가 두 곳에 흩어져, 다음 변경이 한쪽만 반영하고 다른 쪽을 놓칠 위험을 남긴다. 트랜잭션 관리 코드가 서비스 레이어에 직접 노출되는 것과 테스트의 mock 호출-순서 의존은 모두 기존 저장소 관례를 그대로 따른 것이라 이번 PR 이 새로 도입한 문제는 아니며 INFO 수준으로만 기록한다.

## 위험도

MEDIUM
