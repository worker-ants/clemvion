# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** JSDoc 주석 한 줄이 인접 줄 대비 눈에 띄게 길다 (158자, 인접 줄은 평균 ~100자)
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:179` (`recordAuditWriteFailed` JSDoc, "왜 클램핑인가" 절)
  - 상세: `**컴파일러가 닫힘을 증명하지 못한다**. 증명되지 않은 닫힘을 타입으로 주장하는 대신` 문장이 줄바꿈 없이 이어져 있다. Prettier 는 블록 주석 산문을 재포장(reflow)하지 않으므로 포맷터가 못 잡는다. 기능에는 영향 없는 순수 가독성 이슈.
  - 제안: 문장 중간에 줄바꿈을 넣어 인접 줄들과 폭을 맞춘다.

- **[INFO]** `audit-logs.spec.ts` 신설 테스트 3건이 바로 위 `build()` 헬퍼를 쓰지 않고 `repo`/`service` 조립을 각각 인라인으로 반복한다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:202`, `:223`, `:239` (헬퍼 정의는 `:154`)
  - 상세: `build(saveRejects: boolean)` 이 바로 위에서 정의됐는데, 이어지는 세 테스트(`metrics 호출이 던져도 삼킨다`, `metrics provider 없이 DI 조립이 성공한다`, `metrics 없이도 감사 기록은 동작한다`)는 각각 `repo`/`service` 생성 보일러플레이트를 새로 쓴다. 각 테스트가 `metrics` mock 의 동작(던지는 mock, provider 부재, 인자 자체 생략)이 서로 달라 `build()` 시그니처를 그대로는 재사용할 수 없어서 생긴 결과이므로 의도적 트레이드오프에 가깝다.
  - 제안: `build()` 에 `metrics` 오버라이드 파라미터(예: `metrics?: Partial<...> | 'omit'`)를 추가하면 세 테스트 모두 헬퍼로 흡수할 수 있으나, 테스트당 5~8줄 수준이라 우선순위는 낮다.

- **[INFO]** `findUnboundHelpers` 의 바인딩 판정이 제네릭 인자를 비교하지 않고 접두 문자열(`startsWith`)만 본다
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:152-157` (`findUnboundHelpers`)
  - 상세: `action: AuditActionFor<typeof WRONG_RESOURCE_TYPE>` 처럼 `AuditActionFor<` 로 시작하기만 하면 어떤 리소스에 묶였는지와 무관하게 "바인딩됨" 으로 통과한다. 순수 문자열 판정이라 오귀속(다른 리소스 상수를 넣는 실수)은 이 가드가 아니라 TS 컴파일러(`_NoCrossDomain` 계열 가드)에 의존한다. 이미 3라운드 RESOLUTION 에서 "우선순위 판단으로 미조치" 로 명시 처분된 항목이라 재차단 사유는 아니다.
  - 제안: 현행 유지로 충분 — 컴파일러가 실질적으로 막는 경계이므로 추가 조치 불요. 다음에 이 가드를 손댈 일이 생기면 제네릭 인자 비교를 얹는 정도로 충분.

- **[INFO]** `record()` catch 블록의 근거 주석이 12줄로 실제 코드(9줄)보다 길다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:97-108`
  - 상세: swallow 계약·관측 실패 처리·chokepoint 근거를 모두 catch 블록 안에 인라인 주석으로 적어 코드 대 주석 비율이 역전됐다. 근거 자체는 값지지만(왜 이렇게 짰는지가 다음 사람에게 중요), 메서드 본문의 시각적 밀도를 낮춘다. 이미 이전 라운드에서 "rationale 주석 비대화" 로 3라운드 연속 INFO 이월된 항목과 같은 클래스다.
  - 제안: 조치 불요(기존 처분 유지) — 근거를 JSDoc 이나 별도 설계 노트로 옮기는 리팩터는 이 PR 범위 밖.

## 요약

핵심 변경(감사 적재 실패 관측성 추가, `auth_config` `recordAudit` 타입 바인딩 수정, AST 기반 `audit-action-binding` 가드 신설)은 전반적으로 유지보수성이 높다. 함수는 짧고 단일 책임(`clampLabel`, `auditHelperParams`, `extractActionType`, `findUnboundHelpers` 등)이며 중첩 깊이도 2단계를 넘지 않는다. `PROMETHEUS_LABEL_MAX_LEN` 상수화는 오히려 기존에 두 곳에 흩어져 있던 매직넘버(`64`)를 제거해 유지보수성을 개선한 변경이다. 네이밍은 도메인 의도를 잘 드러내고(`recordAuditWriteFailed`, `findUnboundHelpers`, `AuditActionFor`), 신규 가드는 기존 자매 가드(`engine-error-code-anchor-guard.ts`)와 동일한 파서/소비 spec 분리 컨벤션을 따라 기존 스타일과 일관적이다. 다만 이전 라운드(1·2라운드)에서 실제로 발생했던 "삽입 지점이 옮기며 주석-대상 귀속이 끊어지는" 결함과 "구현을 어느 테스트도 실행하지 않는" 결함은 이번 확인 시점 기준 모두 정정된 상태다. 남은 항목은 전부 INFO 수준의 사소한 가독성/근거 배치 이슈이며 차단 사유가 될 만한 것은 없다.

## 위험도
NONE
