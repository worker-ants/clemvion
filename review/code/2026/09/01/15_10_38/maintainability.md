# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 클래스 레벨 JSDoc 이 새 코드 삽입으로 소속을 잃고 허공에 뜬다 (`BusinessMetricsService`)
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:48-58` (원래 `@Injectable() export class BusinessMetricsService` 바로 위에 있던 클래스 설명 JSDoc), 그 사이에 삽입된 `:59-71` (`PROMETHEUS_LABEL_MAX_LEN` JSDoc + `clampLabel` 함수), 클래스 선언은 `:73-74`
  - 상세: 원래 이 파일은 `/** NF-OB-07 도메인/비즈니스 커스텀 메트릭 ... */` 로 시작하는 8줄짜리 JSDoc(48-58행)이 `@Injectable() export class BusinessMetricsService` 바로 위에 붙어 클래스를 설명했다. 이번 diff 가 `PROMETHEUS_LABEL_MAX_LEN` 상수와 `clampLabel` 함수(+ 각각의 JSDoc)를 그 사이에 끼워 넣으면서, 48-58행 JSDoc 뒤에 바로 오는 것이 클래스 선언이 아니라 **또 다른 주석 블록**(59-65행)이 됐다. JSDoc/TSDoc 은 "바로 다음에 오는 선언"에만 귀속되므로, 48-58행 블록은 이제 어떤 선언에도 귀속되지 않는 완전히 붕 뜬 텍스트다 — IDE hover 나 TypeDoc 에서 `BusinessMetricsService` 클래스를 열어 봐도 이 설명(no-op meter 동작, NF-OB-07 이원화 정책 등 아키텍처 배경)이 더 이상 뜨지 않는다. 이 PR 자신의 `review/code/.../RESOLUTION.md` 가 "테스트는 통과하는데 파일이 깨져 있었다"(데코레이터가 엉뚱한 선언에 붙은 사례)를 이미 한 번 잡아 교훈으로 남겼는데, 같은 원인(새 코드를 주석과 그 대상 선언 "사이"에 끼워 넣음)의 다른 증상이 이번엔 안 잡히고 남았다.
  - 제안: `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel` 블록을 클래스 JSDoc **위**(예: import 문 바로 아래, 또는 파일 최상단 유틸리티 섹션)로 옮기거나, 반대로 클래스 JSDoc(48-58행)을 새 블록 아래로 옮겨 `@Injectable()` 바로 위에 다시 붙인다. 어느 쪽이든 "주석은 그 다음에 오는 선언만 설명한다"는 불변식을 회복해야 한다.

- **[WARNING]** 테스트 설명 주석이 대상 테스트에서 분리돼 엉뚱한 테스트 위에 얹힌다 (`business-metrics.service.spec.ts`)
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:62-66` (원래 `recordRedisFailOpen` 테스트를 설명하던 주석), `:67-72` (이번에 신설된, `recordAuditWriteFailed` 테스트를 설명하는 주석 — "위 `recordRedisFailOpen` 주석이 이미 적어 둔 그 함정" 이라고 스스로 인용), `:73-78`(`recordAuditWriteFailed` 카운터 테스트), `:90-94`(정작 `recordRedisFailOpen` 테스트 — 바로 위에 아무 설명 주석이 없음)
  - 상세: 62-66행 주석은 원래 "`recordRedisFailOpen` 자체는 인터셉터 쪽 mock 때문에 어느 테스트도 실행하지 않는다"는 사실을 설명하며 바로 아래(원래는 인접했던) `recordRedisFailOpen` 테스트를 가리켰다. 이번 diff 가 그 사이에 `recordAuditWriteFailed` 테스트 2건을 끼워 넣으면서, 62-66행 주석은 이제 물리적으로 `recordAuditWriteFailed` 테스트(73행) 바로 위에 놓이고, 정작 그 내용이 설명하던 `recordRedisFailOpen` 테스트(90행)는 30줄 가까이 떨어진 채 설명 주석 없이 남았다. 새로 추가된 67-72행 주석이 "위 주석이 이미 그 함정을 적어 뒀다"고 앞의 62-66행을 가리켜 문맥은 이어지지만, 이는 저자가 인지한 상태로 남긴 배치이지 우연한 사고는 아닌 것으로 보인다 — 다만 결과적으로 (a) `recordAuditWriteFailed` 절 위에 다른 메서드(`recordRedisFailOpen`) 이름이 먼저 등장해 처음 읽는 사람이 혼동하기 쉽고, (b) 정작 `recordRedisFailOpen` 테스트 자체는 그 근거 설명을 잃었다.
  - 제안: 62-66행 주석을 90행(`recordRedisFailOpen` 테스트) 바로 위로 되돌리고, 67-72행 새 주석은 "형제 메서드 `recordRedisFailOpen` 이 같은 이유로 직접 테스트를 갖는다(위 참고)"처럼 순방향 참조로 바꾸면 두 설명이 각자의 대상 옆에 남으면서 관계도 유지된다.

- **[INFO]** (이전 라운드에서 이미 지적, 여전히 미반영) `audit-logs.spec.ts` 안에 목적이 같은 조립 헬퍼가 두 벌 — `makeService` / `build`
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:89-94`(`makeService`), `:154-167`(`build`), `entry` 리터럴 중복은 `:96-102`와 `:146-152`
  - 상세: 두 헬퍼 모두 mock repo 로 `AuditLogsService` 를 조립한다는 점에서 동일 역할인데 이름·시그니처 스타일이 다르고(`build(true/false)` 는 플래그 인자라 호출부만 봐서는 의미가 안 드러남), `entry` 객체 리터럴도 필드·값이 완전히 동일한 채 두 번 선언돼 있다. 이전 라운드(`review/code/2026/09/01/14_31_12/maintainability.md`)가 이미 INFO 로 지적했고 이번 라운드(RESOLUTION 대상 W1~W4)에는 포함되지 않아 그대로 남았다.
  - 제안: 새 describe 블록이 `makeService` 를 재사용(반환값에 metrics mock 만 추가)하거나 헬퍼 이름을 통일하고, `entry` 를 파일 상단 공용 상수로 승격한다. 급하지 않다 — 두 사본이 서로 어긋나 있지 않음을 확인했다.

- **[INFO]** (이전 라운드에서 이미 지적, 여전히 미반영) 가드의 바인딩 판정이 타입 텍스트 접두 문자열 비교(`startsWith`)에 의존
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:121-125` (`findUnboundHelpers`)
  - 상세: `!s.actionType?.startsWith(`${BOUND_TYPE_NAME}<`)` 는 소스 텍스트 그대로(`member.type.getText()`)를 접두 비교한다. `AuditActionFor <T>`(공백) 또는 괄호로 감싼 형태처럼 서식이 달라지면 오탐 가능성이 있다. fixture 가 커버하는 5가지 형태에는 정확히 동작하므로 즉시 조치 대상은 아니다.
  - 제안: `ts.isTypeReferenceNode(member.type) && member.type.typeName.getText() === BOUND_TYPE_NAME` 처럼 AST 노드 종류로 판정하면 서식에 독립적인 검사가 된다.

- **[INFO]** rationale 주석 비중이 실제 로직 대비 여전히 크다 — 같은 plan 이 이미 등재해 둔 패턴의 확장
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:97-108`(catch 블록: 주석 12줄 vs 코드 6줄), `codebase/backend/src/modules/metrics/business-metrics.service.ts:159-179`(`recordAuditWriteFailed` JSDoc 21줄 vs 함수 본문 3줄)
  - 상세: `plan/in-progress/spec-sync-auth-gaps.md` 는 이미 다른 파일(`audit-action.const.ts`)에 대해 "서술형 논거는 spec 이 SoT 이므로 코드에는 짧은 포인터만" 이라는 결론을 INFO 로 남겨 뒀다. 이번 diff 도 같은 성격(설계 근거를 코드 안에 장문으로 남기고, 거의 같은 내용을 `plan/in-progress/spec-sync-auth-gaps.md` 본문·`spec-draft-audit-write-failed-metric.md`에도 다시 적음)이라 SoT 가 세 곳으로 갈린다.
  - 제안: 즉시 조치 불필요(팀 관례상 유예됨). 다음에 이 두 파일을 확장할 계기가 있으면 위 plan 항목의 범위를 넓혀 함께 정리 대상에 포함하는 것을 권한다.

## 요약

핵심 코드(`audit-logs.service.ts`, `auth-configs.service.ts`, `business-metrics.service.ts`, 신규 `audit-action-binding-*` 가드 3종)는 네이밍이 목적을 명확히 드러내고, 함수 길이·중첩 깊이·순환 복잡도 모두 양호하며, 매직 넘버(`64`)는 이번 라운드에 `PROMETHEUS_LABEL_MAX_LEN`+`clampLabel()` 로 정확히 공유 상수화됐다(이전 라운드 WARNING 반영 확인). 다만 그 리팩터와 `recordAuditWriteFailed` 테스트 추가 과정에서 **주석/JSDoc 을 원래 붙어 있던 선언·테스트에서 물리적으로 분리시키는 실수가 두 곳에서 재발**했다 — `business-metrics.service.ts` 의 클래스 설명 JSDoc 이 완전히 붕 떴고, `business-metrics.service.spec.ts` 의 `recordRedisFailOpen` 설명 주석이 `recordAuditWriteFailed` 테스트 위로 밀려나며 정작 원래 대상은 설명을 잃었다. 둘 다 런타임·테스트 결과에는 영향이 없는 순수 가독성 결함이지만, 같은 PR 이 스스로 "새 코드를 주석/데코레이터와 그 대상 사이에 끼워 넣는" 동일 실수를 이미 한 번(RESOLUTION.md 기록) 겪었던 만큼 재발 패턴으로 볼 가치가 있다. 그 외에는 이전 라운드에서 이미 INFO 로 지적된 채 미반영 상태인 항목들(`makeService`/`build` 헬퍼 중복, 가드의 문자열 접두 비교, rationale 주석 비대화)이 그대로 남아 있으나 심각도는 낮다.

## 위험도
LOW
