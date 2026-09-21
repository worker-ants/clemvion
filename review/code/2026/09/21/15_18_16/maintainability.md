# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `remove()` 의 처방 근거 주석이 실제 로직 대비 매우 길다(주석 ~15줄 vs 로직 ~5줄)
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:301`~`315` (주석), 실 로직은 `316`~`320`
  - 상세: 동시성 처방(원자적 `DELETE`, `affected === 0` 명시 비교, `remove(entity)`→`delete(criteria)` 전환이 cascade/훅에 영향 없음 등)을 모두 인라인 주석으로 붙였다. 다만 이 파일 전체가 `recordAudit`(81~94행 파라미터 주석), `ipInWhitelist`/`parseIp`(420~468행 JSDoc), `getUsage`(568~585행 JSDoc)처럼 "왜"를 코드 옆에 남기는 스타일을 이미 확립하고 있어, 이번 주석 밀도는 **기존 컨벤션과 일치**한다. 결함이 아니라 트레이드오프 관찰이다.
  - 제안: 조치 불요. 다만 향후 이 메서드가 더 커지면 주석 내용 중 "판정 규율" 부분(`affected === 0` 명시 비교 이유)은 `throwAuthConfigNotFound` 처럼 재사용 가능한 형태(예: 공용 유틸 함수 JSDoc)로 승격할 여지가 있다.

- **[INFO]** 동시-삭제 e2e 스펙 계열이 7개 파일로 늘었고 구조적 보일러플레이트가 상당 부분 중복된다
  - 위치: `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` 전체(신규) vs 기존 `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts`
  - 상세: 두 파일을 diff 해 보면 `beforeAll`/`afterAll`(DB 커넥션 2개 생성·해제), `fireDelete`/요청 헬퍼, `Promise.race` 공허성 가드, `pending.sort(...)` 판정, `try/finally` 락 해제 골격이 거의 동일한 형태로 반복된다(달라지는 것은 엔드포인트 경로·시드 데이터·락 종류·판정 상태쌍 정도). 이 PR 자체의 주석이 "이 결함 클래스의 일곱 번째 짝"이라고 스스로 명시할 만큼 패턴이 누적되고 있다. `createDbClient`/`registerAndLogin`/`createTeamWorkspace` 등 공통 유틸은 이미 `test/helpers/`로 추출돼 있으나, 레이스-공허성 가드·요청 병렬 실행·정렬 판정 부분은 아직 파일마다 재작성된다.
  - 제안: 이번 PR을 막을 사유는 아니다(도메인별 락 종류·시드 흐름 차이로 완전 통합은 무리가 있고, 테스트 코드의 중복은 프로덕션 코드보다 허용 폭이 넓다). 다만 8번째(`model-config`)·9번째(`webauthn`) 짝이 예고돼 있으므로(plan §"이 PR 이 하지 않는 것"), 그 시점에 `test/helpers/concurrency.ts` 같은 공용 헬퍼(예: `raceTwoRequests(fn)` + 공허성 가드)로 추출하는 것을 고려할 만하다.

- **[INFO]** `throwAuthConfigNotFound()` 추출은 중복 제거·명명 일관성 면에서 잘 됐다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:149`(정의), `134`·`320`(사용처)
  - 상세: 형제 서비스들의 `throwTriggerNotFound`/`throwScheduleNotFound`/`throwIntegrationNotFound`/`throwMemberNotFound`와 동일한 형태(`private ...(): never`)이고, 리턴 타입 `never`가 TS 제어 흐름 분석에 의해 `findById`의 `config` non-null narrowing에도 기여한다. JSDoc이 `triggers.service.ts`의 400 `AUTH_CONFIG_NOT_FOUND`와의 혼동 가능성을 명시적으로 차단해 두었다(consistency-check WARNING #1 대응) — 좋은 사전 방어다. 조치 불요, 긍정적 관찰로만 기록.

## 요약

핵심 프로덕션 변경(`auth-configs.service.ts`의 `remove()` 원자적 DELETE 전환 + `throwAuthConfigNotFound` 추출)은 형제 PR 4건(#1370~#1373)과 동일한 형태를 따르고, 네이밍·에러 코드·감사 액션 재사용이 기존 컨벤션과 정확히 일치한다. 함수 길이·중첩 깊이·순환 복잡도 모두 문제 없는 수준이고, 매직 넘버는 전부 주석으로 근거가 붙어 있다. 단위 테스트(`auth-configs.service.spec.ts`)는 `seed()` 헬퍼로 반복을 줄였고 대조군(`it.each`)으로 판정 규율의 이유를 코드에 남겨 두는 등 가독성이 좋다. 유일하게 눈에 띄는 유지보수성 트레이드오프는 (1) `remove()`의 주석 밀도가 매우 높다는 점(다만 파일 전체의 기존 스타일과 일치)과 (2) 동시-삭제 e2e 스펙 계열이 7번째 인스턴스에 이르도록 상당한 구조적 보일러플레이트를 파일마다 재작성하고 있다는 점이다. 두 항목 모두 이번 PR을 막을 사유는 아니며 INFO 수준의 관찰로 남긴다.

## 위험도

LOW
