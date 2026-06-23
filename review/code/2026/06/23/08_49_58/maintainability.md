# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] getHistory 제네릭 타입 파라미터 — 호출자 부담 vs. 내부 타입 정의 간 긴장
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/api/triggers.ts` L1024–1032, `/Volumes/project/private/clemvion/codebase/frontend/src/components/triggers/trigger-history-dialog.tsx` L394
- 상세: `getHistory<T>` 가 제네릭으로 선언되어 호출자가 `triggersApi.getHistory<TriggerHistoryEntry>(...)` 처럼 타입을 직접 지정해야 한다. `TriggerHistoryEntry` 는 dialog 내부 타입이며 `triggers.ts` 에는 대응하는 공유 타입이 없다. 반면 `getById` 는 `TriggerDetail` 을 명시적으로 반환한다. 일관성 측면에서 API 레이어가 반환 타입을 스스로 알아야 하는데, `getHistory` 만 예외적으로 "타입을 모른다" 는 시그니처를 가진다. 이는 향후 다른 호출처가 생길 때 타입 불일치 위험이 있다.
- 제안: `TriggerHistoryEntry` 에 해당하는 공유 인터페이스(`TriggerHistoryItem` 등)를 `triggers.ts` 에 export 하거나, 적어도 `getHistory` 의 기본 타입 파라미터 (`<T = TriggerHistoryItem>`)를 정의해 호출자의 명시적 지정 의무를 제거하는 것을 검토한다. 현재 codebase에서 호출처가 하나(dialog)뿐이라 당장 문제가 없으나, 두 번째 호출처가 생기는 즉시 타입 정의 위치 합의가 필요해진다.

### [INFO] envelope 언래핑 로직 중복 — getById vs. getHistory
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/api/triggers.ts` L991–993, L1029–1031
- 상세: `getById` 와 `getHistory` 모두 `res.data as { data?: unknown }` → `body?.data ?? body` 패턴으로 응답을 언래핑한다. 두 블록이 거의 동일하다. 현재 두 곳뿐이므로 복잡도는 낮지만, 같은 패턴이 `rotate`/`revoke` 함수들까지 합치면 총 4개 이상의 위치에서 수동 타입 캐스팅이 반복된다.
- 제안: `unwrapEnvelope<T>(data: unknown): T` 같은 내부 헬퍼를 파일 상단에 정의하면 각 함수에서 타입 캐스팅이 사라지고, 향후 envelope 형식이 바뀌더라도 한 곳만 수정하면 된다. 단, 현재 파일 규모(1,060줄 미만)와 사용 패턴이 소수이므로 즉시 리팩터보다는 세 번째 반복 시 추출을 권장하는 수준의 INFO다.

### [INFO] trigger-history-dialog.tsx — `triggerId as string` 타입 단언
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/triggers/trigger-history-dialog.tsx` L394
- 상세: `queryFn` 안에서 `triggerId as string` 단언이 필요하다. `enabled: !!triggerId && open` 가드로 `null` 케이스를 런타임에 막지만, 타입 시스템으로 `queryFn` 내부에서 `triggerId: string | null` 임을 이미 알기 때문에 단언이 필요해진다. 이는 작은 코드 냄새로, 나중에 `enabled` 조건이 분리되면 단언이 잘못된 `null` 호출을 감추는 구멍이 될 수 있다.
- 제안: `queryFn` 앞에 `if (!triggerId) return []` early return 을 넣거나, props 타입을 오버로드로 분리("open===true 이면 triggerId: string")하면 단언 없이 타입 안전해진다. 단, 기존 패턴(enabled 가드)이 이 파일에서 합리적이므로 WARNING 수준은 아니다.

### [INFO] trigger-history-dialog.tsx — 인라인 복합 className 문자열 길이
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/triggers/trigger-history-dialog.tsx` L461
- 상세: Link 의 `className` 이 인라인 문자열 보간 (`${rowClass} hover:bg-... focus-visible:...`)으로 길어져 가독성이 저하된다. `rowClass` 변수가 base 스타일을 담고 있지만 link 전용 확장 스타일은 그 옆에 직접 붙어 있다. 동일 파일에서 `div` 버전은 `className={rowClass}` 만 사용해 두 분기의 className 로직이 비대칭이다.
- 제안: `rowLinkClass = cn(rowClass, "hover:bg-[hsl(var(--muted))] ...")` 같은 별도 변수로 추출하면 두 분기 모두 단순 변수 참조가 된다.

### [INFO] 테스트 파일 — `fakeAxios` 헬퍼의 `config: {}` 타입 강제
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/api/__tests__/triggers.test.ts` L611–617
- 상세: `fakeAxios` 에서 `config: {} as unknown as AxiosResponse<T>` 를 통해 불완전한 객체를 강제 캐스팅한다. 이는 현재 테스트에서 실용적이나, 테스트 픽스처 함수가 타입 안전성을 희생하는 공통 패턴이다. 16 테스트 전체가 이 단일 헬퍼에 의존하므로 Axios 가 `config` 에 접근하는 코드 경로가 생기면 테스트가 조용히 잘못된 값을 반환할 수 있다.
- 제안: `as unknown as AxiosResponse<T>` 보다 `{ data, status: 200, statusText: "OK", headers: {}, config: { headers: {} } } satisfies Partial<AxiosResponse<T>>` 형태로 최소 충족 구조를 명시하면 향후 타입 변경을 컴파일러가 잡아준다. 단 현재 영향 범위가 테스트 파일 내부에 한정되므로 INFO다.

### [INFO] plan 문서 — 단일 불릿의 길이 과도
- 위치: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` L1105
- 상세: M-8 1단계 완료 불릿이 한 줄에 600자 이상의 산문으로 기술되어 있다. plan 문서이므로 코드 유지보수성과는 간접 관계이나, 이후 기여자가 변경 경계·잔여 항목을 파악하기 어렵다. 기존 항목들도 유사하게 길어 파일 전반의 패턴이다.
- 제안: 서술형 불릿을 하위 목록으로 분해하는 것은 plan 패턴 변경 수준이므로 현 리뷰 범위를 벗어난다. 단, 향후 plan 작성 시 핵심 사실만 두고 나머지는 PR 본문·consistency 보고서 링크로 위임하면 가독성이 높아진다.

---

## 요약

이번 변경은 `apiClient` 직접 호출을 `triggersApi` 로 통합하는 구조적으로 올바른 리팩터링이다. 두 다이얼로그의 변경 범위가 최소화되어 있고(import 교체 + 한 줄 호출 변경), `triggers.ts` 의 신규 메서드(`delete`, `getHistory`)는 기존 메서드(`getById`, `rotateNotificationSecret` 등)와 네이밍·주석·반환 타입 패턴이 일관된다. 테스트는 배열/envelope/빈값 세 케이스를 명시적으로 커버하며 describe 분리도 적절하다. 주요 개선 여지는 `getHistory` 의 제네릭 타입 책임 위치(API 레이어 vs. 호출자), 반복되는 envelope 언래핑 로직의 헬퍼 추출, `triggerId as string` 단언 제거 세 가지이나 모두 INFO 수준이며 현재 코드베이스의 단일 호출처 규모에서는 즉각적인 수정보다 다음 확장 시점에 처리가 적절하다.

## 위험도

NONE
