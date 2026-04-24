코드를 충분히 파악했습니다. 동시성 리뷰를 작성합니다.

---

## Concurrency Code Review

### 발견사항

---

**[MEDIUM]** `create()` / `update()`의 `isDefault` 플래그 변경이 트랜잭션 밖에서 수행됨
- **위치**: `llm-config.service.ts:93–108` (`create`), `135–142` (`update`)
- **상세**: `setDefault()`는 `manager.transaction()`으로 "전체 unset → 대상 set"을 원자적으로 처리한다. 반면 `create()`와 `update()`는 `clearDefault()`(별도 UPDATE 쿼리)를 실행한 뒤 트랜잭션 없이 `save()`를 호출한다. 두 요청이 동시에 `isDefault: true`로 생성/수정되면 아래 인터리빙이 가능하다:
  ```
  Req A: clearDefault()  →  기존 default 해제
  Req B: clearDefault()  →  no-op
  Req A: save(isDefault=true)  →  A가 default
  Req B: save(isDefault=true)  →  B도 default  ← 2개 동시 default 발생
  ```
  `setDefault()`만 트랜잭션을 사용하는 불일치가 근본 원인이다.
- **제안**: `create()` 및 `update()`의 `clearDefault` + `save` 블록을 `llmConfigRepository.manager.transaction()`으로 감싼다. 또는 `clearDefault()`를 `manager.update()` 호출로 리팩터링해 기존 `setDefault()`와 동일한 패턴을 공유한다.

---

**[WARNING]** `useMutation` stale 클로저: `onSuccess`가 현재 props를 검증하지 않음
- **위치**: `model-combobox.tsx:55–75`
- **상세**: `mutationFn`은 클릭 시점의 `provider`, `apiKey`, `baseUrl`을 클로저로 캡처한다. 요청 중 부모 컴포넌트가 `provider`를 `openai → anthropic`으로 변경해도 `onSuccess: (fetched) => setModels(fetched)`는 반드시 실행되어 openai 모델 목록이 anthropic 컨텍스트에 적용된다. `isPending` 가드(`disabled={... || loadMutation.isPending}`)가 사용자 재클릭을 막지만, 요청이 진행 중인 동안 **부모의 props 변경**은 막지 못한다. `useMutation`은 `useQuery`와 달리 AbortSignal을 자동으로 전달하지 않는다.
- **제안**:
  ```tsx
  // mutationFn에서 변수를 반환값과 함께 전달
  mutationFn: async () => {
    const snapshot = { provider, apiKey: apiKey.trim(), baseUrl: baseUrl?.trim() };
    const fetched = await llmConfigsApi.previewModels(...);
    return { fetched, snapshot };
  },
  onSuccess: ({ fetched, snapshot }) => {
    if (snapshot.provider !== provider) return; // stale 결과 무시
    setModels(fetched);
  },
  ```
  또는 `mutationFn` 내부에서 `AbortController`를 생성하고 요청에 `signal`을 전달한 뒤, `onMutate`에서 이전 컨트롤러를 abort한다.

---

**[WARNING]** `remove()`에서 캐시 무효화가 DB 삭제보다 선행됨
- **위치**: `llm-config.controller.ts:224–229`
- **상세**:
  ```ts
  this.llmService.clearClientCache(id);   // 캐시 먼저 제거
  await this.llmConfigService.remove(id, workspaceId);  // DB 삭제
  ```
  `remove()`가 실패(DB 오류 등)하면 캐시는 이미 지워졌고 엔티티는 DB에 남는다. 다음 요청이 캐시 미스로 DB를 재조회하므로 결과적으로 동작은 복구되지만, 삭제 실패 시 짧은 윈도우 동안 "캐시 없음 + DB 있음" 불일치가 발생한다. 대비: `update()`는 서비스 반환 후 캐시를 지워 순서가 반대다.
- **제안**: DB 삭제 완료 후 캐시 무효화 순서로 변경한다. 삭제 성공을 확인한 뒤 캐시를 지우는 것이 안전한 순서다:
  ```ts
  await this.llmConfigService.remove(id, workspaceId);
  this.llmService.clearClientCache(id);
  ```

---

**[INFO]** `update()`의 read-modify-write 패턴 — 낙관적 잠금 없음
- **위치**: `llm-config.service.ts:112–143`
- **상세**: `findEntity()`로 읽은 엔티티를 메모리에서 수정 후 `save()`로 저장하는 전형적인 lost-update 패턴이다. 동일 설정에 두 요청이 동시 도달하면 후착 요청이 선착 요청의 변경을 덮어쓴다. TypeORM의 `@VersionColumn()`(낙관적 잠금)이나 비관적 잠금(`lockMode: 'pessimistic_write'`)이 없어 last-write-wins가 묵시적으로 적용된다. 관리 UI에서 발생 빈도가 낮아 현재는 허용 가능 수준이나, 동시 편집이 빈번해지면 데이터 손실 가능성이 있다.
- **제안**: 필요 시 `@VersionColumn()` 추가 또는 `findEntity()`에 `lockMode: 'pessimistic_write'` 적용 검토.

---

**[INFO]** `previewModels` 스로틀링은 적용되어 있으나 `listModels`(`GET :id/models`)는 미적용
- **위치**: `llm-config.controller.ts:154` vs `192–208`
- **상세**: `POST preview-models`는 `@Throttle({ default: { limit: 10, ttl: 60_000 } })`으로 분당 10회 제한이 있다. `GET :id/models`(저장된 자격증명으로 Provider 호출)는 동일하게 외부 API를 호출하지만 스로틀이 없다. 둘 다 외부 LLM Provider에 실시간 HTTP 요청을 발생시키므로 동일한 제한 정책이 일관되게 필요하다.
- **제안**: `listModels`에도 `@Throttle` 데코레이터 추가.

---

### 요약

동시성 관점의 핵심 위험은 백엔드 서비스에 집중된다. `setDefault()`는 트랜잭션을 사용해 `isDefault` 플래그를 원자적으로 교체하지만, `create()`와 `update()`는 동일 작업을 트랜잭션 없이 수행해 동시 요청 시 워크스페이스 내에 `isDefault=true` 레코드가 2개 생성되는 경쟁 조건이 존재한다. 프론트엔드에서는 `useMutation`의 stale 클로저 문제가 있어 요청 중 `provider` props가 변경되면 엉뚱한 제공자의 모델 목록이 적용될 수 있으나, `isPending` 가드가 사용자 재클릭을 막아 실제 발생 빈도는 낮다. `remove()` 엔드포인트의 캐시-DB 삭제 순서 역전과 `listModels` 스로틀 미적용은 부가적 개선 사항이다. 전반적으로 데드락·이벤트 루프 블로킹·스레드 안전성 문제는 없으며, 위험은 DB 상태 일관성과 stale 응답 적용에 국한된다.

### 위험도
**MEDIUM**