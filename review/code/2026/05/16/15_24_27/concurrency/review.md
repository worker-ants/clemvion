# 동시성(Concurrency) 리뷰

## 발견사항

- **[WARNING]** `findAllCafe24RowsForMall` — check-then-act 경쟁 조건 (TOCTOU)
  - 위치: `integration-oauth.service.ts` — `findConnectedCafe24MallIntegration` → `begin` pre-check, 그리고 `createPrivatePendingIntegration` 내 `allSameMall` 확인 로직
  - 상세: `findConnectedCafe24MallIntegration`(또는 `findAllCafe24RowsForMall`) 로 DB를 SELECT한 뒤 "connected 없음"을 확인하고, 그 사이에 다른 요청이 동일 `(workspaceId, mall_id)`로 INSERT를 완료하면 두 요청 모두 pre-check를 통과해 중복 INSERT 시도가 발생한다. Cafe24 Public 흐름은 begin 단계에서 row를 생성하지 않으므로 특히 finalize(`POST /api/integrations`) 단계에서 두 탭/세션이 동시에 OAuth를 완료할 경우 이 race가 현실화된다. 코드는 이미 V045 partial UNIQUE constraint(`idx_integration_cafe24_workspace_mall`)와 `throwIfUniqueViolation` 핸들러를 DB-level backstop으로 갖추고 있어 실제 데이터 이상은 방지된다. 그러나 경쟁 조건 자체는 구조상 존재하며, 이를 문서화된 설계 결정으로 명시하지 않으면 향후 유지보수 시 혼란을 유발할 수 있다.
  - 제안: 현재 구조(application-level pre-check + DB UNIQUE backstop)는 충분히 안전하다. 다만 서비스 메서드 주석에 "pre-check는 UX 최적화용이며 원자성은 DB constraint가 보장한다"는 설계 의도를 명시하면 추후 유지보수 시 오해를 방지할 수 있다. 필요하다면 `SELECT ... FOR UPDATE`나 DB 트랜잭션으로 묶는 방식도 고려할 수 있으나, 현재 TypeORM 사용 패턴상 과설계에 해당한다.

- **[INFO]** `findAllCafe24RowsForMall` — 두 개의 순차 `await` DB 조회
  - 위치: `integration-oauth.service.ts` `findAllCafe24RowsForMall` 메서드 (라인 약 462~471)
  - 상세: `direct` 조회와 `legacy` 조회가 순차적으로 실행된다(`await ... await`). 두 쿼리는 서로 독립적이므로 `Promise.all`로 병렬 실행하면 지연시간을 줄일 수 있다. precheck endpoint는 mall_id 입력 debounce마다 이 메서드를 호출하므로 응답 지연이 UX에 직접 영향을 준다.
  - 제안:
    ```ts
    const [direct, legacyRaw] = await Promise.all([
      this.integrationRepository.find({ where: { workspaceId, serviceType: 'cafe24', mallId } }),
      this.integrationRepository.find({ where: { workspaceId, serviceType: 'cafe24', mallId: IsNull() } }),
    ]);
    const legacy = legacyRaw.filter((row) => row.credentials?.mall_id === mallId);
    return [...direct, ...legacy];
    ```

- **[INFO]** 프론트엔드 debounce 취소 패턴 — 올바른 구현 확인
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` `useEffect` (라인 약 1282~1299)
  - 상세: `cancelled` 플래그와 `clearTimeout`을 조합한 취소 패턴이 정확히 구현되어 있다. `useEffect` cleanup에서 `cancelled = true` 후 `clearTimeout`을 호출하므로 컴포넌트 언마운트 또는 `cafe24MallIdInput` 변경 시 이전 비동기 응답이 state를 덮어쓰지 않는다. 경쟁 조건 없음.

- **[INFO]** `precheckCafe24Mall` async 메서드 — await 누락 없음 확인
  - 위치: `integration-oauth.service.ts` `precheckCafe24Mall` 메서드 (라인 약 499~544)
  - 상세: `findAllCafe24RowsForMall`에 `await`가 올바르게 적용되어 있고, 이후 순수 동기 로직(priority 배열 순회)만 수행한다. async/await 오용 없음.

## 요약

이번 변경은 Cafe24 mall_id 중복 감지 UX를 위한 precheck endpoint 추가 및 begin 단계 사전 가드 강화를 포함한다. 동시성 관점의 핵심 위험은 `findConnectedCafe24MallIntegration`의 SELECT와 실제 INSERT 사이에 발생할 수 있는 TOCTOU 경쟁 조건이나, V045 partial UNIQUE constraint와 `throwIfUniqueViolation` DB-level backstop이 이미 갖춰져 있어 데이터 무결성은 보호된다. 프론트엔드 debounce 취소 패턴(`cancelled` 플래그 + `clearTimeout`)은 올바르게 구현되어 stale closure 문제가 없다. 개선 여지로는 `findAllCafe24RowsForMall`의 두 순차 DB 조회를 `Promise.all`로 병렬화해 precheck 응답 지연을 줄이는 것을 권장한다.

## 위험도

LOW
