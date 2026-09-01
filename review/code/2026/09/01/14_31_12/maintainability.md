# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** Prometheus 라벨 클램핑 상한 `64` 가 두 카운터 메서드에 리터럴로 중복돼 있다 (공유 상수 없음)
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:170` (`recordAuditWriteFailed`, 이번 diff 로 신설) 및 같은 파일 `:120` (기존 `recordExecutionError`)
  - 상세: 두 메서드 모두 `xxx.substring(0, 64)` 로 동일한 clamping 로직을 반복한다. `64` 라는 값의 의미(Prometheus 라벨 cardinality 방어 상한)는 각 메서드의 JSDoc 에 서술로만 남아 있고, 코드 레벨에서는 두 곳에 독립된 매직 넘버로 박혀 있다. 세 번째 카운터가 추가되면 세 번째 리터럴이 또 생길 가능성이 높다.
  - 제안: `const PROMETHEUS_LABEL_MAX_LEN = 64;` 같은 이름 있는 상수(또는 `clampLabel(value: string, max = 64)` 헬퍼)로 추출해 두 호출부가 이를 공유하게 한다. 값의 의미가 이름에 드러나면 세 번째 카운터를 추가하는 사람이 각 JSDoc 을 다시 읽지 않아도 같은 방어를 재사용할 수 있다.

- **[INFO]** 같은 파일 안에서 "서비스+repo 조립" 헬퍼의 이름과 형태가 두 가지로 갈린다 (`makeService` vs `build`)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` — 기존 `function makeService(repo: {...}): AuditLogsService` (약 `:89`) 와 이번 diff 로 신설된 `function build(saveRejects: boolean)` (약 `:154`)
  - 상세: 두 헬퍼는 목적이 같다(`AuditLogsService` 를 mock repo/metrics 로 조립). 이름이 다르고(`makeService` vs `build`) 시그니처 스타일도 다르다(객체 인자로 미리 만든 repo를 받는 것 vs boolean 플래그로 내부에서 repo를 분기 생성). 또한 `build(true)` / `build(false)` 호출부는 boolean 인자만 봐서는 "save 가 reject 하는지" 를 바로 알 수 없어(flag argument), 호출부를 읽을 때 정의로 되짚어가야 한다.
  - 제안: 새 describe 블록도 기존 `makeService` 헬퍼를 재사용하거나(반환값에 metrics mock 만 추가), 이름을 `makeServiceWithMetrics` 등으로 통일한다. boolean 플래그가 꼭 필요하다면 `build({ saveRejects: true })` 형태의 named 옵션으로 바꾸면 호출부 가독성이 개선된다.

- **[INFO]** `entry` 테스트 픽스처 객체가 같은 파일 안에서 두 번 리터럴로 중복 정의된다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` — 기존 `describe('AuditLogsService.record — best-effort (swallow)', ...)` 내부의 `entry` (약 `:96-102`) 와 이번 diff 로 신설된 `describe('AuditLogsService.record — 삼킨 실패의 관측', ...)` 내부의 `entry` (약 `:146-152`)
  - 상세: 두 객체는 필드·값이 완전히 동일하다(`workspaceId: 'ws-1', userId: 'user-1', action: AUDIT_ACTIONS.AUTH_CONFIG_CREATE, resourceType: 'auth_config', resourceId: 'ac-1'`). 테스트 파일 상단으로 끌어올려 모듈 레벨 상수로 공유해도 각 describe 블록의 격리성은 훼손되지 않는다.
  - 제안: 파일 최상단에 공용 `const SAMPLE_ENTRY = {...}` 를 두고 두 describe 블록이 이를 참조하도록 통합한다(각 describe 내부에서 필요한 필드만 override). 다만 심각도는 낮다 — 두 describe 가 서로 다른 세션에서 독립적으로 읽힐 수 있어 완전한 중복 제거가 항상 이득은 아니다.

- **[INFO]** `findUnboundHelpers` 의 바인딩 판정이 타입 텍스트의 접두 문자열 비교(`startsWith`)에 의존해 서식 변형에 취약할 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:121-125` (`findUnboundHelpers`)
  - 상세: `!s.actionType?.startsWith(`${BOUND_TYPE_NAME}<`)` 는 `AuditActionFor<...>` 를 문자열로 매칭한다. TS 소스에 `AuditActionFor <T>` 처럼 제네릭 괄호 앞에 공백이 들어가거나, 타입이 괄호로 감싸인 형태(`(AuditActionFor<T>)`)로 선언되면 이 접두 매칭이 실패해 "묶이지 않음(unbound)" 오탐(false positive)을 낼 수 있다. `extractActionType` 이 `member.type.getText()` 로 원본 텍스트를 그대로 가져오는데, 이는 TS 포매터/개발자 스타일에 따라 달라질 수 있는 표면이다.
  - 제안: 실무 영향은 작다(prettier 가 강제하는 스타일이면 공백 변형이 거의 발생하지 않는다). 다만 AST 노드 종류(`ts.isTypeReferenceNode(member.type) && member.type.typeName.getText() === BOUND_TYPE_NAME`)로 판정하면 문자열 서식에 독립적인 더 견고한 검사가 된다. 현재 상태로도 fixture 테스트가 커버하는 5가지 형태에 대해서는 정확히 동작하므로 즉시 수정을 요구할 정도는 아니다.

- **[INFO]** 신설/수정된 메서드의 rationale 주석 비중이 실제 로직 대비 매우 크다 — 같은 plan 이 이미 지적한 패턴의 재발
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:97-104` (catch 블록 주석 8줄 vs 코드 6줄), `codebase/backend/src/modules/metrics/business-metrics.service.ts:147-167` (`recordAuditWriteFailed` JSDoc 21줄 vs 함수 본문 5줄)
  - 상세: `plan/in-progress/spec-sync-auth-gaps.md` 는 이미 `audit-action.const.ts` 에 대해 "141줄 중 60%+ 가 주석" 이고 "서술형 논거는 spec 이 SoT 이므로 코드에는 짧은 포인터만 남기는 편이 스케일한다" 는 결론을 INFO 로 등재해 두었다(동일 plan 파일, "audit-action.const.ts 주석 비대화" 항목). 이번 diff 가 추가한 두 주석 블록도 같은 성격이다 — "왜 삼키는가", "왜 클램핑인가" 같은 설계 근거를 코드 안에 장문으로 남기고, 같은 내용이 `plan/in-progress/spec-sync-auth-gaps.md` 본문에도 거의 그대로 다시 적혀 있어 두 곳이 SoT 경쟁을 한다.
  - 제안: 즉시 조치를 요구하는 수준은 아니다(위 기존 plan 항목도 "다음에 이 파일을 확장할 때 함께 처리" 로 유예됨). 다만 이번 PR 로 같은 패턴이 두 파일에 더 늘었으므로, 해당 plan 항목의 범위를 `audit-action.const.ts` 외에 `audit-logs.service.ts`/`business-metrics.service.ts` 로도 넓혀 함께 정리 대상에 등재하는 것을 권한다.

## 요약

이번 변경은 감사 로그 유실 관측(카운터+로그 상세화), `auth-configs` 의 `AuditAction` 타입 바인딩 결함 수정, 그리고 그 결함의 재발을 막는 AST 기반 정적 가드 신설로 구성된다. 네이밍은 목적을 명확히 드러내고(`recordAuditWriteFailed`, `AuditActionFor`, `findUnboundHelpers`), 함수/메서드 길이와 중첩 깊이는 전반적으로 양호하며, 새로 추가된 가드 코드는 파서 로직(`audit-action-binding-guard.ts`)과 소비 스펙(`audit-action-binding.spec.ts`)·불변 fixture(`audit-action-binding-fixture.ts`)를 분리해 기존 `engine-error-code-anchor-guard.ts` 컨벤션과 일관된 구조를 취하고 있다. 발견된 사항은 모두 경미한 수준이다 — Prometheus 라벨 클램핑 상수(64)의 중복(WARNING 1건), 테스트 헬퍼 명명·픽스처의 사소한 중복(INFO), 가드의 문자열 기반 타입 판정이 갖는 이론적 취약점(INFO), 그리고 이미 plan 에 등재된 "코드 내 rationale 주석 비대화" 패턴이 이번 PR 로 다시 확장된 점(INFO)이다. 전체적으로 코드는 읽기 쉽고 의도가 잘 설명되어 있으며, 구조적 문제나 심각한 복잡도 이슈는 없다.

## 위험도
LOW
