# Architecture Review — rotate() lost-update 수정 (follow-up 라운드)

## 스코프 메모

이번 changeset 은 이전 리뷰 라운드(`review/code/2026/09/20/17_35_12/`)가 커밋된 뒤의 diff 다.
실제 아키텍처 판단 대상은 파일 1~4(`CHANGELOG.md`, `integrations.service.spec.ts`,
`integrations.service.ts`, `integration-rotate-concurrency.e2e-spec.ts`)와 계획 문서(파일 5~7)뿐이다.
파일 8~41(`review/code/2026/09/20/17_35_12/**`, `review/consistency/**`)은 이전 라운드의 리뷰/검토
산출물 그 자체이며 자동 생성 문서라 SOLID·결합도 같은 코드 아키텍처 기준이 적용되지 않는다.

이전 라운드의 `architecture.md` 가 지적한 두 WARNING(권한 재검사 로직 복제, credentials 병합+검증 로직
복제)은 `af6cc0d2c` 에서 `assertCanRotate()`(`integrations.service.ts:1082`)·
`mergeAndValidateCredentials()`(`integrations.service.ts:1100`) private 헬퍼로 추출돼 해소됐다 —
`git diff origin/main...HEAD`로 실제 코드를 직접 열어 각 헬퍼가 `rotate()` 안에서 정확히 2회
(락 전 `entity` 기준, 락 안 `fresh` 기준)만 호출되는 것을 확인했다. 재-flag 하지 않는다.

## 발견사항

- **[INFO]** `rotate()` 여전히 다중 책임을 한 메서드에서 오케스트레이션함 — 헬퍼 추출 후에도 길다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1121` (`async rotate(...)` 시작부터 트랜잭션 콜백 종료까지)
  - 상세: 엔티티 조회 → oauth2 여부 검사 → 권한 재검사 → 병합+검증 → 외부 연결 테스트(I/O) → 트랜잭션 진입 → 락 안 재검사(권한+병합+검증) → 부분 `update` → 감사 로그 → 캐시 버스 publish 까지, 하나의 퍼블릭 메서드가 인가·도메인 검증·외부 I/O 디스패치·영속성 트랜잭션·감사·이벤트 발행을 모두 오케스트레이션한다. 이전 라운드에서 헬퍼 2개를 뽑아 144줄 → 약 105줄로 줄었지만(RESOLUTION.md WARNING 5), 여전히 한 메서드가 여러 레이어의 관심사를 순서대로 나열하는 절차형 오케스트레이터다. 지금 당장 분리를 강제할 만큼 복잡도가 임계를 넘지는 않았고(cyclomatic 분기 대부분은 방금 추출한 헬퍼로 옮겨졌다), 이 형태는 같은 파일의 다른 메서드들과도 일관된 관례다.
  - 제안: 조치 불요. 다음에 rotate() 에 새 검증 단계(예: rate limit, 추가 필드 재검사)가 붙을 때는 순서형 나열을 더 늘리지 말고 그 시점에 커맨드/파이프라인 형태로 재구성을 고려할 것.

- **[INFO]** 트랜잭션 unit-of-work 가 서비스 레이어에 인라인된 패턴이 이번에도 그대로 유지·확산됨 (신규 결함 아님, 이전 라운드 INFO 재확인)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1166` (`this.dataSource.transaction(async (manager) => { ... })`) vs `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 의 `CONC H-3` 블록
  - 상세: `manager.getRepository(Integration)` → `pessimistic_write` 재조회 → 병합 → 쓰기라는 동일한 모양의 unit-of-work 가 두 서비스에 각각 인라인돼 있다. 영속성 계층 관심사(트랜잭션 경계, 락 모드)가 비즈니스 서비스 메서드 본문에 직접 노출된 것은 이전 라운드에서 이미 INFO 로 기록됐고(Rule of Three 미달), 이번 diff 로 등장 횟수가 바뀌지는 않았다(여전히 2회). 재조치를 요구하지 않는다.
  - 제안: 조치 불요. 세 번째 "재조회+락+병합" 사례가 생기면 그때 공통 헬퍼로 추출.

## 긍정적으로 기록할 설계 선택

- **의존성 역전(DIP)을 통한 테스트 용이성**: `DataSource` 를 생성자 주입(`integrations.service.ts:434`)으로 받아 `dataSource.transaction(...)` 을 호출하는 구조라, 단위 테스트(`integrations.service.spec.ts`)가 실제 DB 없이 `transaction` mock 하나로 트랜잭션 콜백 내부까지 검증할 수 있다. 같은 모듈의 `integration-oauth.service.ts` 가 이미 쓰던 패턴과 동일해 모듈 내부 관례가 일관되고, 새 순환 의존성도 만들지 않는다(`Integration` 엔티티는 이미 이 파일에서 import 돼 있었다).
- **인터페이스 분리(ISP) 스타일의 헬퍼 시그니처**: `assertCanRotate(row: Pick<Integration, 'scope'>, ...)`, `mergeAndValidateCredentials(row: Pick<Integration, 'credentials' | 'serviceType' | 'authType'>, ...)` 처럼 필요한 필드만 구조적 타입으로 요구해, 락 전의 `entity: Integration` 과 락 안의 `fresh: Integration | null`(non-null 체크 후)이 모두 같은 헬퍼를 별도 어댑터 없이 만족시킨다. 헬퍼도 `private` 로 캡슐화돼 클래스 경계 밖으로 새 표면을 노출하지 않는다.
- **레이어 책임 분리 유지**: 외부 I/O(연결 테스트, 수 초)를 트랜잭션 밖에 두고 DB 트랜잭션은 "재조회+병합+쓰기"라는 짧은 임계 구간에만 좁힌 설계는 같은 모듈의 기존 선례(`CONC H-3`)와 형태를 맞췄고, `4-integration.md` Rationale 이 기각한 advisory-lock 재도입이 아님을 코드 주석이 정확히 구분해 남겼다 — 아키텍처 결정의 근거가 코드와 문서(plan/CHANGELOG) 양쪽에 일관되게 남아 있다.
- **계약 변경 회피의 아키텍처적 정당성**: `plan/complete/spec-draft-rotate-conflict.md` 가 기록하듯, 이 팀은 처음엔 새 409 계약(`INTEGRATION_ROTATE_CONFLICT`)을 얹으려 했다가 `/consistency-check --spec` 반증(같은 형태의 락 선례가 이미 있음, spec status 하락 비용)으로 되돌려 **기존 컬럼·기존 락 메커니즘만으로 코드 레벨에서 닫는 쪽**을 택했다. 새 API 표면(에러 코드·상태)을 만들지 않고 기존 확장점(같은 모듈의 트랜잭션 패턴)을 재사용한 것은 개방-폐쇄 원칙 관점에서 합리적인 최소 변경이다.

## 요약

핵심 변경(`IntegrationsService.rotate()` 의 lost-update 수정)은 이전 아키텍처 리뷰 라운드가 지적한 두 건의 로직 복제(권한 재검사, credentials 병합+검증)를 `assertCanRotate`/`mergeAndValidateCredentials` private 헬퍼로 정확히 해소했고, 직접 diff 를 대조해 각 헬퍼가 의도한 두 호출 지점(락 전/락 안)에서만 쓰이는 것을 확인했다. 새로 도입된 Critical/Warning 급 아키텍처 결함은 없다. `DataSource` 생성자 주입은 같은 모듈의 기존 관례(`integration-oauth.service.ts`)와 일치해 새 순환 의존성이나 모듈 경계 위반을 만들지 않았고, `Pick<>` 기반 헬퍼 시그니처는 ISP 를 잘 지킨 작은 설계 선택이다. 남은 두 항목(트랜잭션 unit-of-work 의 서비스 레이어 인라인, `rotate()` 메서드가 여전히 여러 레이어를 오케스트레이션하는 절차형 구조)은 신규 결함이 아니라 이전 라운드부터 이어진 INFO 급 관찰이며, Rule-of-Three 미달·복잡도 임계 미도달을 근거로 지금 조치를 요구하지 않는다.

## 위험도

LOW
