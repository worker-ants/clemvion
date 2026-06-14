# 테스트(Testing) 리뷰 결과

리뷰 대상: §A.3 호출 이력 (config-call-history) — execution source_ip/response_code 영속 + getUsage periodCounts + frontend 드로어 컬럼

---

## 발견사항

### 발견사항 1
- **[INFO]** `safeCount` 헬퍼의 음수 방어 경로에 대한 단위 테스트 부재
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `safeCount` 함수 (diff 내 `I-2` 주석 참조)
  - 상세: `safeCount`는 `NaN` 방어 외에 `n < 0` 음수 방어 분기를 포함한다. `auth-configs.service.spec.ts` 신규 테스트에는 `getRawOne`이 `null`을 반환하는 케이스(periodCounts 전부 0 폴백)와 정상 문자열 케이스만 있다. DB 드라이버가 음수 문자열(`'-1'`)이나 `'NaN'`을 반환하는 이상 케이스는 커버되지 않는다.
  - 제안: `period: { last24h: '-1', last7d: 'NaN', last30d: '0' }` 픽스처를 추가해 `safeCount` 방어 분기를 직접 단언하는 테스트 케이스 1개 추가. `safeCount`가 인라인 함수이므로 서비스 메서드 레벨에서 통합 단언으로도 가능.

### 발견사항 2
- **[INFO]** `hooks.service.spec.ts` — 기존 webhook 성공 경로 테스트의 기대값이 변경된 시그니처(`sourceIp: undefined, responseCode: '202'`)로 갱신됐으나 `clientIp null → undefined` 변환 경계가 명시적으로 검증되지 않음
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` diff 행 907 (`sourceIp: undefined`)
  - 상세: `hooks.service.ts`는 `extractClientIp` 결과가 `null`이면 `clientIp ?? undefined` 변환을 거쳐 `sourceIp: undefined`로 전달한다. 기존 테스트의 assertion 업데이트는 이 동작을 검증하지만, 'IP 헤더 없음 → `undefined` 전달'과 'IP 헤더 있음 → 실제 IP 전달'의 대비가 한 describe 블록 안에서 대칭적으로 배치되어 있어 가독성은 양호하다. 다만 `extractClientIp`가 `null`을 반환했을 때 `sourceIp` 필드 자체가 `undefined`(키 없음)인지 `null`인지는 TypeScript 타입(`sourceIp?: string`)상 모호하다 — `ExecuteOptions` 타입에서 `sourceIp?`는 `undefined | string`이므로 현행은 정확하나, 실수로 `null`을 넘기면 타입 에러가 아닌 런타임 오탐이 발생할 수 있다.
  - 제안: INFO 수준. 필요 시 `sourceIp: null`이 컴파일 에러를 유발하는 타입 레벨 테스트(`@ts-expect-error`)를 추가할 수 있으나, 현재 단언 방식으로도 충분히 기능적 커버리지는 확보됨.

### 발견사항 3
- **[WARNING]** 프론트엔드 `usage-drawer.test.tsx` — `responseCode: 'failed'` (비-HTTP 트리거 status 폴백) 케이스가 화면에 렌더됐는지 단언 누락
  - 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx` lines 1224-1240
  - 상세: `USAGE.recentCalls`에는 두 번째 항목(`e-schedule`)의 `responseCode: 'failed'`가 포함되어 있다. 테스트는 `"202"` 텍스트와 `"—"` 플레이스홀더 렌더만 단언한다. `'failed'` 폴백값이 Response Code 컬럼에 실제로 노출되는지는 단언하지 않는다. 이 경로는 §A.3 및 WH-MG-05 요건(비-HTTP 트리거는 status enum 폴백)의 핵심 동작이다.
  - 제안: `expect(screen.getByText("failed")).toBeInTheDocument()` 단언 추가. 단, `"failed"` 문자열이 Status 배지에도 사용된다면 `getAllByText("failed")` + 인덱스 또는 `within` 스코핑이 필요하다.

### 발견사항 4
- **[WARNING]** `auth-configs.service.spec.ts` QB mock 순서 의존성 잠재 위험 — `mockReturnValueOnce` 체인이 Promise.all 내부 호출 순서에 결합됨
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` lines 181-186 (`createQueryBuilder` mock)
  - 상세: `createQueryBuilder`는 `mockReturnValueOnce(countQb).mockReturnValueOnce(periodQb).mockReturnValueOnce(recentQb)` 순서로 설정된다. 현재 구현(`auth-configs.service.ts`)에서 `Promise.all`에 전달되는 QB 생성 순서는 count→period→recent이므로 일치하지만, 이 순서는 서비스 코드에 강하게 결합된다. 서비스가 Promise.all 내 순서를 변경하면 테스트가 잘못된 QB 객체를 반환받아 _잘못된 terminal 을 호출하면서도 통과_하는 false-positive 위험이 있다. 테스트 코드 주석에서도 "순서 비의존"이라고 설명하지만 실제로는 순서에 의존한다.
  - 제안: 각 QB를 terminal 메서드 시그니처로 식별하는 방식(예: `getCount`를 가진 QB만 count 쿼리에 응답)으로 mock을 구성하거나, 또는 주석을 "현재 구현 순서에 대응(count→period→recent)"으로 수정해 의도를 정확히 전달. 엄격히 분리하려면 QB별로 mock factory를 분리하고 `createQueryBuilder`가 QB의 보유 메서드를 검사해 dispatch하는 방식을 검토할 수 있다. 현재 구현과 테스트 순서가 일치하는 한 기능상 문제는 없으므로 WARNING 수준으로 분류.

### 발견사항 5
- **[INFO]** `execution-engine.service.spec.ts` — `sourceIp`/`responseCode` 가 `null`로 영속되는 케이스에서 `executionRepository.save`까지 검증하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` diff lines 713-722
  - 상세: 두 새 테스트는 `mockExecutionRepo.create`의 인수만 단언하고 `save`의 반환 결과가 실제로 null 컬럼을 포함하는지는 검증하지 않는다. `create`와 `save`가 별도로 mock될 경우 `create`에서 null을 받아도 `save` 전에 값이 덮어써질 수 있다. 현재 아키텍처상 `create → save` 패턴이 명확하므로 `create` 단언만으로 사실상 충분하지만, 더 완전한 검증을 원한다면 `save` 호출 인수도 단언하거나 `create`가 반환한 객체가 그대로 `save`에 전달됨을 확인하는 단언을 추가할 수 있다.
  - 제안: 필수는 아님. 현재 커버리지 수준은 기능 동작 보증으로 충분.

### 발견사항 6
- **[INFO]** 프론트엔드 테스트 — 기간별 호출 수 섹션 테스트가 `"Calls by Period"` 텍스트 존재만 단언하며 실제 숫자 값(2, 5, 7) 렌더는 검증하지 않음
  - 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx` lines 1242-1249
  - 상세: recharts를 passthrough stub으로 대체하므로 Bar 컴포넌트의 `data` prop 값 등을 DOM에서 직접 확인하기 어렵다. 현재 테스트는 섹션 헤더(`"Calls by Period"`)가 렌더되는지만 검증하며 숫자 데이터 바인딩은 확인하지 않는다. 이는 recharts stub의 고유한 한계이며 악의적인 회귀가 있어도 이 테스트만으로는 감지되지 않는다.
  - 제안: `BarChart`에 전달되는 `data` prop을 스파이하거나(`vi.spyOn`), stub의 `BarChart`가 `data` prop을 JSON으로 렌더하도록 변경해 숫자 값을 단언하는 방안 검토. 현재 수준은 렌더 연기(crash 없음)만 보장하며 데이터 바인딩 검증이 없다는 점을 인지하고 유지해도 무방.

### 발견사항 7
- **[INFO]** e2e 테스트 커버리지: 소스 IP·응답 코드 컬럼이 실제 브라우저 환경에서 렌더되는지 e2e 테스트가 존재하지 않음
  - 위치: plan/in-progress/spec-sync-config-gaps.md — `[ ] TEST WORKFLOW (lint·unit·build·e2e)` 미완
  - 상세: 현재 unit/component 테스트는 충분하나 e2e 레벨(실제 DB + API + 브라우저)에서 새 컬럼 데이터가 드로어에 노출되는 시나리오는 별도 e2e 시나리오 없이 기존 authentication e2e 커버에 포함되지 않을 수 있다. plan에 `TEST WORKFLOW` 체크박스가 열려 있어 e2e 실행 자체는 예정됨.
  - 제안: 기존 authentication e2e 시나리오에서 usage drawer를 열고 Source IP/Response Code 컬럼 헤더 존재를 확인하는 단언을 추가 검토. 현재 기능 정도의 중요도에서는 unit 레벨로도 충분하다고 볼 수 있으나, 회귀 감지 목적으로 e2e 1건 추가를 권장.

---

## 요약

전반적으로 테스트 커버리지는 양호하다. 핵심 경로(webhook sourceIp/responseCode 영속, schedule/manual null 영속, periodCounts 문자열→숫자 변환, getRawOne null 폴백, orphan execution triggerName Unknown 폴백, 프론트엔드 컬럼 렌더)가 모두 테스트로 커버되어 있으며 각 레이어(DB migration 제외 service·engine·hooks·frontend)에 대응하는 테스트 파일이 존재한다. Mock 설계는 독립 QB 객체 분리(W-11 대응)로 개선되었으나 `createQueryBuilder` 호출 순서 결합이 잠재적 false-positive 위험으로 남는다(WARNING). 프론트엔드 테스트에서 비-HTTP 트리거의 `responseCode: 'failed'` 폴백값 렌더 단언이 누락된 점도 WARNING 수준으로 주목할 필요가 있다. 나머지 발견사항은 모두 INFO 수준으로, 현재 테스트 세트가 §A.3 요건에 대한 기능적 회귀 방어로는 충분하다.

---

## 위험도

LOW
