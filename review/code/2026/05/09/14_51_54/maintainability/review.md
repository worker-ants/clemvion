## 유지보수성 코드 리뷰

### 발견사항

---

**[INFO]** 테스트 내 setup/teardown 패턴 3중 반복
- **위치**: `continuation-bus.service.spec.ts` — `publisher 미초기화 가드 — race 방어` describe 내 3개 테스트
- **상세**: 아래 패턴이 `acquireLock`, `releaseLock`, `publish` 세 케이스에 동일하게 반복됩니다.
  ```ts
  const ref = bus as unknown as { publisher?: unknown };
  const original = ref.publisher;
  ref.publisher = undefined;
  try { ... } finally { ref.publisher = original; }
  ```
- **제안**: `beforeEach/afterEach`로 상태 격리를 추출하거나, 단일 헬퍼 `withUninitializedPublisher(fn)` 으로 묶으면 변경 지점이 하나로 줄어 테스트 추가 시 실수를 방지할 수 있습니다.
  ```ts
  // describe 내부에 배치
  beforeEach(() => { (bus as any).publisher = undefined; });
  afterEach(() => { /* onModuleInit 재호출 또는 원본 복원 */ });
  ```

---

**[INFO]** `private publisher!: Redis` 선언과 런타임 가드의 형 불일치
- **위치**: `continuation-bus.service.ts:56` (전체 컨텍스트 기준)
- **상세**: `!` (definite assignment assertion)는 TypeScript에게 "항상 할당됨"을 보장한다고 선언하는 반면, 세 곳에 추가된 `if (!this.publisher)` 가드는 그 반대(undefined 가능)를 런타임에서 가정합니다. 이 긴장감은 타입 시그니처만 보는 독자에게 가드가 왜 존재하는지 혼란을 줍니다.
- **제안**: `private publisher?: Redis` 또는 `private publisher: Redis | undefined`로 변경해 "초기화 전 undefined 가능" 의도를 타입 수준에서도 명시하는 것이 더 정직합니다. 이미 `onModuleDestroy`에서 `this.publisher?.quit()` 패턴(optional chaining)이 있어 일관성도 맞습니다.

---

**[WARNING]** Plan 문서의 체크박스가 구현 완료 후에도 모두 미체크 상태
- **위치**: `plan/in-progress/fix-continuation-bus-bootstrap-race.md`
- **상세**: 동일 diff에 구현 코드(항목 1·2)와 테스트가 함께 존재함에도, 작업 항목의 체크박스는 전부 `[ ]`입니다. CLAUDE.md 공통 규약("작업이 끝나면 결과에 맞춰 갱신")에 위배되며, 이 문서를 나중에 참조하는 독자가 미완 작업으로 오해할 수 있습니다.
- **제안**: 구현·테스트 완료 항목은 `[x]`로 표시하고, TEST/REVIEW WORKFLOW가 완료되면 `plan/complete/`로 `git mv`해야 합니다.

---

**[INFO]** Plan 내 머신-로컬 경로 참조
- **위치**: `plan/in-progress/fix-continuation-bus-bootstrap-race.md` 1행
- **상세**: `[/Users/gehrig/.claude/plans/sorted-shimmying-wirth.md](../../sorted-shimmying-wirth.md)` 는 특정 개발자 머신에만 존재하는 경로입니다. 링크가 깨진 상태로 레포에 남아 다른 팀원이 참조 불가합니다.
- **제안**: 해당 분석 문서가 프로젝트 외부에 있다면 링크를 제거하거나, `memory/` 경로로 이동해 프로젝트 내에서 참조 가능하게 만드세요.

---

### 요약

이번 변경은 NestJS 라이프사이클 race를 `OnApplicationBootstrap`으로 해결하는 최소 범위의 패치로, 핵심 접근(방어적 가드 + 초기화 시점 이동)과 JSDoc 설명 모두 유지보수성 관점에서 적절합니다. 다만 테스트 내 publisher 비활성화 패턴이 세 케이스에 동일하게 반복되어 미래 케이스 추가 시 실수 가능성이 있으며, `publisher!` 타입 선언이 런타임 가드의 의도와 충돌합니다. Plan 문서는 CLAUDE.md 규약에 따라 완료 항목 체크·이동이 필요합니다.

### 위험도

**LOW**