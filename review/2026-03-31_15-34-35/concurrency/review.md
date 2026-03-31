## 동시성 코드 리뷰 결과

### 발견사항

---

- **[WARNING]** `SlideDrawer` — 공유 DOM 상태에 대한 경쟁 조건
  - 위치: `frontend/src/components/ui/slide-drawer.tsx` — `document.body.style.overflow` Effect
  - 상세: 여러 `SlideDrawer` 인스턴스가 동시에 마운트될 경우 (예: `authentication/page.tsx`와 `triggers/page.tsx`에서 각각 사용), 한 Drawer가 닫히며 `overflow = ""`로 복원할 때 다른 Drawer가 여전히 열려 있다면 스크롤 잠금이 해제되어버립니다. cleanup 함수가 조건 없이 항상 `""`로 초기화하기 때문입니다.
  - 제안: 전역 카운터 또는 ref-count 방식으로 관리하거나, 오직 마지막 Drawer가 닫힐 때만 `overflow`를 복원하도록 처리:
    ```typescript
    // 공유 카운터 방식 예시
    let openCount = 0;
    React.useEffect(() => {
      if (!open) return;
      openCount++;
      document.body.style.overflow = "hidden";
      return () => {
        openCount--;
        if (openCount === 0) document.body.style.overflow = "";
      };
    }, [open]);
    ```

---

- **[WARNING]** `reauthorize` — CSRF state 토큰 미저장으로 인한 동시 인증 플로우 충돌
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `reauthorize()` 메서드
  - 상세: `state` 토큰을 생성해 클라이언트에 반환하지만 서버에는 저장하지 않습니다. 동시에 여러 사용자/세션이 인증을 시도할 경우 OAuth 콜백 수신 시 어느 요청의 state인지 검증할 수 없고 CSRF 방어가 무력화됩니다.
  - 제안: `state`를 Redis 등 임시 저장소에 TTL(5분 등)을 두어 저장하고, OAuth 콜백 핸들러에서 검증 후 삭제:
    ```typescript
    // 예: redis.setex(`oauth:state:${state}`, 300, integrationId)
    ```

---

- **[INFO]** `getUsage` — 병렬화 가능한 순차 쿼리
  - 위치: `backend/src/modules/auth-configs/auth-configs.service.ts` — `getUsage()` 메서드
  - 상세: `totalCalls` 쿼리와 `recentExecutions` 쿼리가 독립적임에도 순차 실행됩니다. 데이터 정합성 문제는 없으나 응답 지연이 발생합니다.
  - 제안:
    ```typescript
    const [totalCalls, recentExecutions] = await Promise.all([
      this.executionRepository.createQueryBuilder('e')
        .where('e.trigger_id IN (:...triggerIds)', { triggerIds })
        .getCount(),
      this.executionRepository.createQueryBuilder('e')
        .innerJoinAndSelect('e.trigger', 't')
        .where('e.trigger_id IN (:...triggerIds)', { triggerIds })
        .orderBy('e.started_at', 'DESC')
        .limit(20)
        .getMany(),
    ]);
    ```

---

- **[INFO]** `getSummary` — 다중 독립 쿼리의 순차 실행
  - 위치: `backend/src/modules/dashboard/dashboard.service.ts` — `getSummary()` 메서드
  - 상세: `runs7dResult`, `runs7dPrevious`, `successCount`, `avgResult` 등의 쿼리가 모두 순차 실행됩니다. 각각 독립적이므로 `Promise.all()`로 묶으면 지연 시간을 줄일 수 있습니다.
  - 제안: 상호 의존성이 없는 쿼리들을 `Promise.all()`로 병렬화.

---

### 요약

전체적으로 `async/await` 사용은 올바르며 TypeORM 트랜잭션 처리(`importWorkflow`)와 Zustand store의 함수형 업데이트(`addNodeResult`)도 동시성 안전성을 고려한 올바른 패턴을 사용하고 있습니다. 주요 문제는 두 가지입니다: (1) 복수의 `SlideDrawer`가 공유 DOM 상태(`document.body.style.overflow`)를 서로 덮어쓸 수 있는 경쟁 조건, (2) OAuth `reauthorize` 플로우에서 CSRF state 토큰이 서버에 저장되지 않아 동시 인증 요청 간 검증이 불가능한 구조적 결함입니다. 나머지는 순차 쿼리를 병렬화하는 성능 개선 사항입니다.

### 위험도

**MEDIUM**