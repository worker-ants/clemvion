# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `getIntegrationErrorI18nKey` 에서 `Object.prototype.hasOwnProperty.call` 사용
  - 위치: `frontend/src/lib/api/integration-error-codes.ts` — `getIntegrationErrorI18nKey` 함수
  - 상세: 매핑 테이블(`INTEGRATION_ERROR_CODE_TO_I18N`)이 `Readonly<Record<...>>` 로 선언된 순수 정적 객체임에도, 키 존재 여부를 확인할 때 `Object.prototype.hasOwnProperty.call` 을 사용한다. 이 패턴은 prototype 체인을 고려할 때 안전하지만, 런타임 비용보다 더 큰 문제는 단순 in-map lookup 대비 가독성 저하다. 실제 성능 부담은 미미하나, Map 혹은 단순 `errorCode in INTEGRATION_ERROR_CODE_TO_I18N` 으로 교체해도 동일한 안전성을 유지하면서 의도를 더 명확히 드러낼 수 있다. 현재 매핑 항목이 1건이므로 실무 영향은 없다.
  - 제안: `errorCode in INTEGRATION_ERROR_CODE_TO_I18N` 으로 교체하거나, 향후 항목이 늘어날 경우 `Map<string, TranslationKey>` 로 전환해 O(1) 직접 조회를 유지한다.

- **[INFO]** `TestStep` 의 `queryKey` 가 `credentials` 를 포함하지 않아 stale 캐시 히트 위험
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `TestStep` 컴포넌트 내 `useQuery` (라인 약 2362~2377)
  - 상세: `queryKey: ["integrations", "preview-test", serviceType, authType]` 로 선언돼 있고 `credentials` 는 키에 없다. 동일 `serviceType`/`authType` 조합에서 사용자가 자격 증명을 수정 후 다시 TestStep으로 진입하면 React Query 캐시에서 이전 테스트 결과를 반환해 실제 검증 없이 "Ready to save" 상태가 될 수 있다. 현재는 `step` 전환마다 새 마운트가 일어나고 `refetchOnWindowFocus: false` 이므로 즉각적 오작동 가능성은 낮지만, 구조적으로 캐시 키가 입력 변수(credentials)를 반영하지 않는다.
  - 제안: `queryKey` 에 `credentials` 를 포함하거나, 매번 신선한 검증이 필요하면 `staleTime: 0` + `cacheTime: 0` 을 명시해 캐시를 우회한다. 또는 `useMutation` 으로 전환해 "캐시 없는 호출" 의미를 명확히 한다.

- **[INFO]** popup 닫힘 감지를 위한 500ms 폴링 인터벌
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `useEffect` (라인 약 1535~1558)
  - 상세: OAuth 팝업이 열린 동안 `setInterval(500ms)` 로 `popup.closed` 를 폴링한다. 단일 인터벌이고 팝업이 닫히면 즉시 `clearInterval` 하므로 누수는 없다. 그러나 팝업이 오래 열려 있을 경우(최대 5분) 이 인터벌이 매 500ms 마다 실행되며 메인 스레드에 미세한 부담을 준다. 브라우저의 `window.closed` 폴링은 비용이 거의 없으나, `oauthWaiting` 이 false 가 되면 effect cleanup 에서 인터벌이 해제되는지 확인 필요하다. 코드상 cleanup 함수에 `clearInterval(interval)` 이 있으므로 의존 배열(`[oauthWaiting]`)이 변경될 때 재실행·클린업이 제대로 동작한다. 현재 구현은 허용 범위 내이다.
  - 제안: 성능 개선이 필요하다면 `VisibilityChange` 이벤트 또는 BroadcastChannel 을 활용해 polling 간격을 늘릴 수 있으나, popup 닫힘 감지에는 polling 이 실질적으로 유일한 cross-origin-safe 수단이므로 현 구조를 유지해도 무방하다.

- **[INFO]** `findAll` 의 `getCount()` + `getMany()` 이중 쿼리
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `findAll` 메서드 (라인 약 432~439)
  - 상세: 페이지네이션 구현이 `getCount()` 와 `getMany()` 를 별도로 실행한다. TypeORM 의 `getManyAndCount()` 를 사용하면 동일한 쿼리를 한 번의 왕복으로 실행할 수 있어 DB 라운드트립 1회를 절약한다. 단, 이번 diff 의 변경 범위에는 포함되지 않으며 기존 패턴이다.
  - 제안: `const [rows, totalItems] = await qb.skip(...).take(...).getManyAndCount()` 로 교체해 네트워크·DB 비용을 줄인다. 이번 변경 범위 밖이므로 별도 리팩토링 태스크로 처리 권장.

## 요약

이번 변경의 핵심은 (1) `IntegrationsService.create` 에서 audit log 기록 실패를 best-effort 로 swallow 하는 try/catch 분리, (2) `useCafe24MallIdPrecheck` 훅 추출로 page.tsx 에 인라인되어 있던 debounce+AbortController 로직을 캡슐화, (3) 에러 코드-i18n 키 매핑 모듈 신설, (4) 테스트 코드의 매직 넘버 상수화이다. 성능 관점에서 심각한 문제는 없다. 이미 AbortController 로 in-flight precheck 요청을 abort 하고 350ms debounce 를 적용해 불필요한 API 호출을 억제하는 설계가 유지된다. Backend 의 audit log try/catch 분리는 직렬 await 두 개를 유지하므로 추가 성능 비용이 없고, `getCount`+`getMany` 이중 쿼리와 `TestStep` 캐시 키 불완전 포함은 이번 diff 범위 밖의 기존 패턴이다. 전반적으로 성능 위험도는 낮다.

## 위험도

LOW
