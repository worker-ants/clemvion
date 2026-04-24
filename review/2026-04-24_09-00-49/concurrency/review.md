### 발견사항

- **[WARNING]** `isDefault` 플래그 설정 시 트랜잭션만으로는 경쟁 조건 미해소
  - 위치: `backend/src/modules/llm-config/llm-config.service.ts` — `create()`, `update()` 내 트랜잭션 블록
  - 상세: 두 요청이 동시에 `isDefault=true`로 생성/수정 요청을 보낼 경우, 기본 READ COMMITTED 격리 수준에서 T1·T2가 각각 `UPDATE SET isDefault=false`(0건 업데이트)를 완료한 뒤 둘 다 `INSERT/SAVE with isDefault=true`를 실행하면 레코드가 2건 생길 수 있다. 트랜잭션이 원자 순서를 강제하지 않기 때문이다.
  - 제안: DB에 `(workspaceId, isDefault) WHERE isDefault = true` 형태의 **partial unique index**를 추가하거나, SERIALIZABLE 격리 수준을 사용하거나, `setDefault` 전용 row-level lock(`SELECT ... FOR UPDATE`)을 적용한다.

- **[INFO]** `withTimeout` 내 `inner.catch(() => undefined)`가 모든 에러를 삼킴
  - 위치: `backend/src/modules/llm/llm.service.ts` — `withTimeout` 메서드
  - 상세: 타임아웃 경쟁에서 진 쪽 promise가 이후 reject 될 때 unhandled rejection 경고를 막기 위해 `.catch(() => undefined)`를 붙인 것은 올바른 패턴이다. 다만, SDK가 `AbortSignal`을 무시하는 경우 내부 promise가 GC 없이 메모리에 남을 수 있다(코드 주석에서 인지하고 있음).
  - 제안: 현재 구현은 의도와 일치하므로 즉각 수정 불필요. 장기적으로 SDK abort 지원 여부를 프로바이더별로 확인해두면 좋다.

- **[INFO]** 캐시 무효화 순서 수정 — 올바른 방향
  - 위치: `backend/src/modules/llm-config/llm-config.controller.ts` — `remove()` 핸들러
  - 상세: DB 삭제 성공 후 캐시를 제거하도록 순서를 바꾼 것은 정확하다. 이전 코드는 캐시를 먼저 비운 뒤 DB 삭제가 실패하면 캐시만 빈 채로 레코드가 남는 불일치 상태를 만들었다. 수정 후에는 DB 삭제~캐시 제거 사이의 짧은 window에 캐시된 클라이언트가 사용될 수 있으나, 실무상 허용 범위이다.
  - 제안: 현재 수준으로 충분. 더 엄격하게 하려면 캐시 없이 매번 DB를 참조하거나, 삭제된 config ID로의 요청을 DB 조회로 guard하면 된다.

- **[INFO]** `for await` 루프에서 `break` 시 iterator cleanup
  - 위치: `backend/src/modules/llm/clients/anthropic.client.ts` — `listModels()`
  - 상세: `MAX_MODELS(100)` 초과 시 `break`로 루프를 탈출하면 async iterator의 `return()` 메서드가 호출되어 하위 HTTP 스트림이 정리된다. Anthropic SDK의 paginator가 이를 올바르게 구현하고 있다면 소켓 누수는 없다.
  - 제안: SDK 업데이트 시 paginator의 `return()` 구현 여부를 확인한다.

---

### 요약

대부분의 변경은 `as unknown as T` 타입 캐스팅 제거 및 테스트 코드 정리로, 동시성과 직접 관련이 없다. 핵심 동시성 변경은 두 가지다: (1) `isDefault` 설정 시 트랜잭션 도입 — 의도는 옳으나 DB unique partial index 없이는 READ COMMITTED에서 여전히 2건 생성 race가 가능하다. (2) `withTimeout`/`previewModels` 구현 — `Promise.race + AbortController` 패턴이 올바르게 구현되어 소켓 누수 위험을 최소화한다. 전반적으로 동시성 설계의 방향성은 개선됐으며, `isDefault` unique index 추가가 남은 유일한 실질적 위험이다.

### 위험도

**MEDIUM** — `isDefault` 중복 레코드 생성 race는 트래픽이 적은 관리 화면에서 발생 빈도는 낮지만, 발생 시 AI 노드가 의도하지 않은 프로바이더를 참조할 수 있어 DB 제약으로 반드시 보완 필요.