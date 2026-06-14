# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `getUsage` 내부 `safeCount` 헬퍼 함수가 메서드 본문에 인라인 선언됨
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `getUsage` 메서드 내부 (diff line +454–458)
- 상세: `safeCount`는 순수 유틸리티 함수인데 `getUsage` 메서드 본문 안에 중첩 선언되어 있다. 함수 호출 횟수가 3회로 적어 지금은 문제가 없지만, 동일 파일에서 유사한 raw count 파싱이 필요한 다른 메서드가 생기면 중복 선언이 발생한다. 또한 함수 내 함수 선언은 메서드 길이를 늘리고 테스트 독립성을 낮춘다.
- 제안: 파일 상단 모듈 스코프 상수 영역(예: `USAGE_PERIOD_WINDOWS_MS` 근처)에 `function safeRawCount(raw: string | undefined | null): number` 형태로 끌어올린다.

### [WARNING] `authentication/page.tsx` BarChart 데이터 배열이 JSX 렌더 경로에 인라인 리터럴로 생성됨
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` — BarChart `data={[...]}` (diff line +1456–1469)
- 상세: `periodCounts`를 `{ label, count }` 배열로 변환하는 로직이 JSX 트리 한가운데에 인라인으로 박혀 있다. 컴포넌트가 재렌더될 때마다 새 배열 객체가 생성되고, 해당 데이터 형식 변환 의도가 JSX 구조 안에 묻혀 가독성을 해친다.
- 제안: 렌더 함수 상단(또는 `useMemo`)에서 `const periodChartData = useMemo(() => [ ... ], [usageData.periodCounts])` 로 추출한다. 레이블 문자열(t 호출)도 같이 배치하면 i18n 의존성이 한 곳에 모인다.

### [WARNING] `hooks.service.ts`에서 `clientIp ?? undefined` 패턴 두 곳 중복
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — handleWebhook diff line +1071, handleChatChannelWebhook diff line +1096
- 상세: `extractClientIp`의 반환 타입이 `string | null | undefined`임을 추론할 수 있는데, `execute()` options의 `sourceIp?: string` 타입과 맞추기 위해 `clientIp ?? undefined` 변환을 두 메서드 모두에서 독립적으로 작성하고 있다. 변환 패턴이 동일하므로 나중에 반환 타입이나 변환 규칙이 바뀌면 양쪽을 따로 수정해야 한다.
- 제안: `extractClientIp` 반환값을 `sourceIp?: string` 타입에 직접 할당 가능하도록 `extractClientIp`의 반환 타입을 `string | undefined`로 통일하거나, `toSourceIp(ip: string | null | undefined): string | undefined` 소형 변환 함수를 추출한다.

### [INFO] `WEBHOOK_ACCEPTED_RESPONSE_CODE` 상수의 도출 과정이 다소 간접적
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — diff line +1039
- 상세: `String(HttpStatus.ACCEPTED)`로 파생하는 것은 "202라는 숫자를 하드코딩하지 않겠다"는 의도가 명확하고 올바른 접근이다. 다만 이 상수가 `WEBHOOK_ACCEPTED_RESPONSE_CODE`라는 이름에서 "webhook 전용"임을 암시하는데, chat-channel 경로에서도 동일 상수를 재사용(diff line +1097)한다. 이름이 실제 사용 범위보다 좁게 느껴질 수 있다.
- 제안: 이름을 `HTTP_ACCEPTED_CODE` 또는 `ACCEPTED_RESPONSE_CODE`로 변경하거나, JSDoc에 "webhook과 chat-channel 양쪽 성공 경로에서 공용"임을 명시한다.

### [INFO] `makeExecutionRepo` 팩토리의 `createQueryBuilder` mock이 순서 의존적
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` — diff line +181–185
- 상세: `mockReturnValueOnce` 체인은 호출 순서에 의존한다. 주석에서 "순서 비의존"이라고 설명하지만, 이는 각 QB 객체가 자신의 terminal 메서드만 노출하기 때문에 의도적으로 순서가 달라도 오류가 나지 않는다는 의미다. 그러나 `createQueryBuilder` 자체의 호출 순서가 구현 내부 변경(예: Promise.all 내 쿼리 재정렬)에 취약하다. 현 테스트 자체가 이 순서를 단언하지는 않지만, 미래에 순서를 단언하는 테스트가 추가되거나 구현 순서가 바뀌면 혼란을 줄 수 있다.
- 제안: 현재 패턴을 유지하되, 주석을 "createQueryBuilder 호출 순서는 단언 대상이 아님 — 각 QB 가 자신의 terminal 만 제공하므로 순서가 달라도 결과는 동일" 으로 보완한다. (현재 주석이 일부 설명하고 있으나 오해 소지가 있는 "순서 비의존" 표현을 더 명확히.)

### [INFO] `page.tsx` BarChart 스타일 값에 Tailwind 외부 하드코딩 혼재
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` — diff line +1453, +1471–1503
- 상세: 차트 컴포넌트(`recharts`)에 전달하는 스타일 속성(`margin`, `tick.fontSize`, `borderRadius`, `contentStyle` 등)은 Tailwind 클래스로 표현할 수 없어 불가피하게 인라인 객체로 작성된다. 그런데 `"0.375rem"`, `12`, `{ top: 4, right: 4, left: -20, bottom: 0 }` 등 숫자·문자열이 맥락 없이 나열된다. 다른 차트가 생기면 이 값들이 복사·붙여넣기 되어 중복될 위험이 있다.
- 제안: 이번 변경 범위가 단일 차트이므로 현재 수준은 허용 가능하다. 다만 프로젝트에 recharts 사용이 추가될 경우 `const CHART_STYLE = { ... }` 공통 상수 파일 또는 래퍼 컴포넌트로 추출하는 것을 후속 TODO로 기록한다.

### [INFO] `ExecuteOptions` union 타입 확장 방식이 `in` 내로잉에 의존
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — diff line +765–770
- 상세: `sourceIp`와 `responseCode`를 추출할 때 `'sourceIp' in options` 방식의 타입 내로잉을 사용한다. 이는 TypeScript에서 안전하고 정석적인 접근이며 주석도 의도를 설명한다. 그러나 향후 `triggerId` variant에 필드가 더 추가되면 동일 패턴을 반복해야 하고, 관련 코드가 분산된다. 현재 범위에서는 문제가 없다.
- 제안: 현행 유지. 만약 triggerId variant에 세 번째 선택적 필드가 추가된다면 헬퍼 `extractTriggerMeta(options)` 함수로 추출을 고려한다.

## 요약

이번 변경은 §A.3 호출 이력(소스 IP·응답 코드·기간별 호출 수) 기능을 마이그레이션·서비스·엔티티·DTO·프론트엔드·i18n 전 계층에 걸쳐 일관되게 구현했다. 네이밍은 전반적으로 명확하고 spec 참조 주석이 충실하다. 주요 유지보수성 우려는 세 가지다. 첫째, `safeCount` 헬퍼가 메서드 내부에 중첩 선언되어 재사용성이 낮다. 둘째, `clientIp ?? undefined` 변환이 두 메서드에 중복된다. 셋째, BarChart 데이터 변환 로직이 JSX 트리에 인라인으로 위치해 가독성을 해친다. 이 세 항목은 WARNING 수준이며 수정이 권장된다. 나머지 발견사항은 INFO 수준으로 현재 기능 동작에 영향을 주지 않는다.

## 위험도

LOW
