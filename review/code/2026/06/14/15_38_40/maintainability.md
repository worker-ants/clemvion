# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `safeUsageCount` 함수 위치 — 모듈 레벨 유틸리티로서 적절
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L361–364
- 상세: `safeUsageCount`는 순수 변환 함수로, 모듈 최상위에 분리된 것은 클래스 책임과 잘 분리된다. 이름도 목적을 명확히 드러낸다.
- 제안: 없음 (패턴 양호).

### [WARNING] `getUsage` 함수 내 인라인 QB 체인 3개 — 함수 길이와 다중 책임
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L431–481
- 상세: `getUsage`가 Promise.all 블록 안에 3개의 QueryBuilder 체인을 직접 작성한다. 체인 하나하나는 읽기 쉬우나, 함수 전체가 (1) 트리거 조회, (2) 병렬 DB 쿼리 조립, (3) 결과 매핑 세 책임을 동시에 수행한다. 현재는 약 60줄로 허용 범위지만, 향후 쿼리 조건이 추가될 경우 함수가 빠르게 비대해질 수 있다.
- 제안: 각 QB 조립을 `buildCountQuery`, `buildPeriodQuery`, `buildRecentQuery` 같은 private 메서드로 추출하면 테스트·재사용·변경 격리가 용이해진다. 현 규모에서 강제 조치는 아니나 중기 유지보수성 향상 고려.

### [WARNING] `USAGE_PERIOD_WINDOWS_MS` 상수의 계산식 — 리터럴 산술 반복
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L351–355
- 상세: `24 * 60 * 60 * 1000`, `7 * 24 * 60 * 60 * 1000`, `30 * 24 * 60 * 60 * 1000`처럼 동일한 곱셈 패턴이 반복된다. `HOUR_MS = 60 * 60 * 1000`, `DAY_MS = 24 * HOUR_MS` 같은 기본 단위 상수가 없어 "하루를 밀리초로" 변환하는 의도를 읽으려면 직접 계산해야 한다.
- 제안: `const DAY_MS = 24 * 60 * 60 * 1000;` 하나를 정의하고 `last24h: DAY_MS`, `last7d: 7 * DAY_MS`, `last30d: 30 * DAY_MS`로 표기하면 가독성이 높아진다.

### [INFO] `WEBHOOK_ACCEPTED_RESPONSE_CODE = String(HttpStatus.ACCEPTED)` — 상수 네이밍
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L1031
- 상세: 이름이 목적(webhook 성공 응답 코드)을 명확히 서술한다. `String(HttpStatus.ACCEPTED)` 변환 방식도 매직 넘버 `'202'`를 피하면서 NestJS 표준 열거형을 재사용해 일관성이 높다. JSDoc 설명도 충분하다.
- 제안: 없음.

### [INFO] `clientIp ?? undefined` 패턴 — 미묘한 타입 변환
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L1063, L1088
- 상세: `extractClientIp`가 `string | undefined` 또는 `string | null`을 반환할 때 `?? undefined`는 `null`을 `undefined`로 변환한다. 이 변환 의도가 주석 없이 나타나면 향후 유지보수 시 "왜 굳이 `?? undefined`를 쓰나" 의문이 생길 수 있다. `ExecuteOptions`의 `sourceIp?: string`이 `undefined`를 수용하고 `null`은 수용하지 않기 때문임을 알려면 타입 선언까지 역추적해야 한다.
- 제안: 인라인 주석 한 줄 추가: `// extractClientIp returns null when header absent; ExecuteOptions.sourceIp is string|undefined`

### [WARNING] `makeExecutionRepo`의 `mockReturnValueOnce` 순서 의존성 — 테스트 깨지기 쉬운 구조
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` L181–185
- 상세: `createQueryBuilder`가 `mockReturnValueOnce`를 세 번 순서대로 설정한다. `getUsage` 구현 내부에서 Promise.all의 쿼리 순서가 바뀌거나 새 쿼리가 추가되면 테스트가 조용히 잘못된 QB를 반환할 위험이 있다. 주석("순서 비의존")이 있지만, 실제로는 `mockReturnValueOnce` 호출 순서에 의존한다 — 모순이 있다.
- 제안: `createQueryBuilder`가 인자나 alias 등으로 QB를 구분하거나, 각 QB의 terminal(`getCount`/`getRawOne`/`getMany`)이 호출됐는지 검증하는 방식을 유지하되, 주석을 "Promise.all 내 발행 순서(count→period→recent)와 mockReturnValueOnce 순서가 일치해야 함"으로 수정해 사실을 명확히 기술.

### [INFO] `makeQbBase()` 팩토리 함수 — 스프레드 병합 한계
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` L157–165, L167–178
- 상세: `{ ...makeQbBase(), getCount: ... }` 방식은 `makeQbBase()`가 반환한 mock 객체와 spread한 terminal을 합친다. 동작상 문제는 없으나, `makeQbBase`가 내부적으로 `jest.fn().mockReturnThis()`를 생성하는데 이 참조가 외부에서 단언되지 않는다. 테스트에서 `countQb.where`가 호출됐는지 등은 검증하지 않아, 체이너블 메서드의 호출 여부는 black-box다.
- 제안: 현재 테스트 목적(terminal만 검증)에서는 허용 범위다. 향후 "where 파라미터 검증"이 필요해지면 `makeQbBase()`를 팩토리가 아닌 명시적 변수로 선언하는 리팩토링이 필요함을 주석으로 남길 것.

### [WARNING] `authentication/page.tsx` 인라인 차트 데이터 배열 — 렌더 함수 내 계산
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` L1456–1469 (BarChart data prop)
- 상세: `BarChart`의 `data` prop에 `usageData.periodCounts`를 매번 변환하는 배열 리터럴을 JSX 안에 인라인으로 작성한다. 렌더마다 새 배열 객체가 생성되고, 번역 키 3개와 데이터 접근이 혼합되어 시각적 복잡도가 높다.
- 제안: 컴포넌트 본문(JSX 외부)에 `const periodChartData = useMemo(() => [...], [usageData.periodCounts, t])` 또는 순수 변환 헬퍼로 추출. 현 God Component 분리 후속 작업(plan §후속) 시 함께 처리 가능하다.

### [INFO] `margin={{ top: 4, right: 4, left: -20, bottom: 0 }}` — 매직 넘버
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` L1471
- 상세: `-20`은 YAxis 레이블을 잘라내기 위한 오프셋인데, 인라인 리터럴로만 존재한다. 향후 YAxis 너비나 레이아웃 변경 시 이 값의 의도를 파악하기 어렵다.
- 제안: `const CHART_MARGIN = { top: 4, right: 4, left: -20, bottom: 0 } as const;` 등으로 명명하거나, 최소한 인라인 주석 `/* hide default YAxis gap */` 추가.

### [INFO] `execution.entity.ts` 블록 주석 — 길고 상세하나 중복 가능성
- 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` L813–821
- 상세: `@Column` 데코레이터 바로 위에 14줄 블록 주석이 있다. 내용은 마이그레이션 SQL 파일(V096)의 주석과 거의 동일하다. 동일 정보를 두 곳에 유지하면 이후 한 쪽만 갱신될 경우 불일치가 발생한다.
- 제안: 엔티티 주석은 "무엇" 수준(`source_ip: webhook 소스 IP, nullable`)만 남기고 "왜"의 설계 배경은 마이그레이션 SQL 또는 spec 참조(`@see spec/1-data-model.md §2.13`)로 위임.

### [INFO] i18n 키 순서 일관성
- 위치: `codebase/frontend/src/lib/i18n/dict/en/authentication.ts` L1563–1570, `ko/authentication.ts` L1687–1694
- 상세: 신규 키(`sourceIp`, `responseCode`, `periodCounts`, `callCount`, `period24h`, `period7d`, `period30d`)가 `startedAt` 직후, `typeApiKey` 직전에 삽입되어 있다. 기능 단위 묶음 삽입으로 논리적으로 이해 가능하나, 파일 전체적으로 알파벳 순이나 화면 출현 순 같은 명시적 정렬 기준이 없어 이후 키 삽입 위치 결정이 모호해질 수 있다.
- 제안: 현행 유지 허용. 팀 컨벤션으로 "기능 묶음 삽입" 방식을 명시하거나, lint 규칙(alphabetical key sort)을 도입하면 장기 일관성이 보장된다.

---

## 요약

전반적으로 코드 변경은 유지보수성 수준이 양호하다. 상수 정의(`USAGE_PERIOD_WINDOWS_MS`, `USAGE_RECENT_CALLS_LIMIT`, `WEBHOOK_ACCEPTED_RESPONSE_CODE`), 함수 분리(`safeUsageCount`), 명확한 JSDoc/인라인 주석, 엔티티 필드의 nullable 명시 등 긍정적인 패턴이 많다. 주요 개선 여지는 두 곳이다: (1) `getUsage`의 3개 QB 체인을 private 메서드로 분리하면 함수 단일 책임이 강화되고, (2) 테스트의 `mockReturnValueOnce` 순서 의존을 주석으로 명확히 표기하거나 구조적으로 개선하면 테스트 내성이 높아진다. 프론트엔드의 인라인 차트 데이터 배열과 매직 넘버(-20) 역시 God Component 분리 후속 작업 시 함께 정리할 수 있는 수준이다.

## 위험도
LOW
