## Side Effect 코드 리뷰

### 발견사항

---

**[WARNING]** `normalizeButtonsArray` fallback 경로에서 충돌 검사 누락
- **위치**: `button-slug.util.ts` — `normalizeButtonsArray` 함수 내
- **상세**: `labelSlug`가 빈 경우 `fallbackPrefix(i)`를 `uniqueSlug` 없이 직접 사용하고, `taken.has()` 확인 없이 `taken.add(candidate)`만 수행함. Pass 1에서 이미 `taken`에 `'btn_1'` 이 예약된 상태에서 index 1의 button이 빈 label을 가지면 `fallbackPrefix(1) = 'btn_1'`이 그대로 배정되어 중복 id가 발생.

  ```
  input: [{id:'btn_1', label:'Existing'}, {label:'한글만'}]
  Pass 1: taken = {'btn_1'}
  i=0 → 보존 'btn_1'
  i=1 → fallbackPrefix(1) = 'btn_1' (충돌 검사 없음) → 중복!
  ```
- **제안**: fallback 경로도 `uniqueSlug` 통과 또는 `taken.has()` 체크 후 index 증가 처리.

  ```ts
  const candidate =
    labelSlug.length > 0
      ? uniqueSlug(labelSlug, taken)
      : uniqueSlug(fallbackPrefix(i), taken); // fallback도 uniqueSlug 적용
  ```

---

**[WARNING]** `migrate-button-ids.ts` — 모듈 import 시 `dotenv.config()` side effect
- **위치**: `migrate-button-ids.ts` 상단 블록 (`const envPath = ...`)
- **상세**: 블록 스코프 안이지만 모듈 로드 시점에 실행됨. `backend/src/scripts/migrate-button-ids.spec.ts`에서 `backfillButtonIds`를 import하면 테스트 프로세스의 `process.env`가 `.env` 값으로 오염될 수 있음. `require.main === module` 가드는 `console.warn`에만 걸려있고, env 로딩 자체는 항상 실행됨.
- **제안**: `main()` 내부로 이동하거나, `if (require.main === module) { dotenv.config(...) }` 패턴으로 엔트리포인트 전용 처리로 제한.

---

**[WARNING]** `migrate-button-ids.ts` — `ds.destroy()` finally 블록 부재
- **위치**: `main()` 함수 전체 구조
- **상세**: `ds.initialize()` 이후 `ds.destroy()` 이전에 예외 발생 시 DB 커넥션 풀이 정리되지 않음. 스크립트 프로세스 종료로 OS 레벨에선 처리되나, 의존하는 DB 서버에서 커넥션 leak 경고가 발생할 수 있음.
- **제안**: `try/finally`로 감싸 `ds.destroy()` 보장.

  ```ts
  try {
    // ... query / transaction ...
  } finally {
    await ds.destroy();
  }
  ```

---

**[INFO]** 마이그레이션 스크립트 vs. `normalizeNodeButtonIds` 정책 발산 — 의도적이나 주의 필요
- **위치**: `migrate-button-ids.ts` `backfillButtonIds` vs. `button-slug.util.ts` `normalizeNodeButtonIds`
- **상세**: 마이그레이션 스크립트는 label 무관하게 순수 `btn_${i}` fallback을 사용하고, 런타임 `normalizeNodeButtonIds`는 label-slug 우선 → fallback 순서. 두 함수 모두 "기존 id 보존" 원칙을 따르기 때문에 마이그레이션 후 `update_node` 호출에서 id가 재생성되지 않아 edge 안정성은 유지됨. 단, 두 함수의 fallback 값이 다르다는 점이 코드 독자를 혼란케 할 수 있음.
- **제안**: `backfillButtonIds` docstring에 "resolver fallback 패턴(`btn_${i}`)을 의도적으로 사용 — label-slug 와 다름, edge 보존 목적" 명시 (현재 파일 헤더에 설명이 있으나 함수 JSDoc에 없음).

---

**[INFO]** `addNode`에서 button id 정규화가 타입 유효성 검사보다 앞서 실행
- **위치**: `shadow-workflow.ts` `addNode`, 약 400~418라인
- **상세**: `isButtonNodeType(type)` 분기가 `knownNodeTypes.has(type)` 검사보다 앞에 위치. BUTTON_NODE_TYPES는 하드코딩된 4개 타입으로 `knownNodeTypes`의 서브셋이어서 실질적 문제 없음. 다만 순서상 불필요하게 정규화한 뒤 reject하는 경로가 이론적으로 존재함.
- **제안**: 현재 코드로도 안전. 명시적으로 `knownNodeTypes` 체크 이후로 이동하면 의미 순서가 더 명확해짐.

---

### 요약

전체적으로 F-2 기능 구현은 immutability(input 변경 없이 복사본 반환), reference equality(변경 없으면 원본 반환), 2-pass 충돌 해소, idempotency 등 설계 원칙이 잘 지켜져 있다. 주요 부작용 리스크는 두 가지: `normalizeButtonsArray`의 fallback 경로에서 기존 예약 id와 충돌 가능성(경계 케이스), 그리고 마이그레이션 스크립트가 모듈 import 시 `process.env`를 오염시키는 점이다. DB 트랜잭션은 올바르게 구성되어 있고, shadow-workflow의 기존 검증 흐름(expr → configValidator)도 정규화 삽입 후에도 그 순서가 유지된다.

### 위험도

**LOW**