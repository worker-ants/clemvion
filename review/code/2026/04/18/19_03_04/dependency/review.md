### 발견사항

---

- **[WARNING]** `"use client"` 추가로 유틸리티 파일이 서버 컴포넌트에서 사용 불가
  - 위치: `date.ts:1`, `execution-status.ts:1`
  - 상세: `useLocaleStore.getState()` 호출을 위해 `"use client"` 지시자가 추가되었습니다. 이 파일들이 서버 컴포넌트나 서버 사이드 코드에서 사용될 경우 런타임 오류가 발생하며, Next.js의 서버/클라이언트 번들 분리 원칙에도 위배됩니다.
  - 제안: Zustand 스토어 의존성을 유틸리티 함수 내부에서 제거하고, 호출 측에서 `locale`을 항상 명시적으로 전달하도록 강제하거나, `currentLocale()` fallback을 별도의 client-only wrapper에 격리하세요.

---

- **[WARNING]** `formatDuration` 함수 중복 정의
  - 위치: `date.ts`, `execution-status.ts`
  - 상세: 두 파일 모두 `formatDuration`을 독립적으로 구현하고 있으며, 테스트도 각각 별도로 존재합니다 (`date.test.ts`, `execution-status.test.ts`). 시그니처와 동작이 유사하나 완전히 동일하지 않아 동기화 부담이 생깁니다.
  - 제안: 하나의 구현으로 통합하거나, `execution-status.ts`에서 `date.ts`의 함수를 import하세요.

---

- **[INFO]** 내부 모듈 간 순환 의존성 위험
  - 위치: `date.ts`, `execution-status.ts` → `@/lib/i18n/core`, `@/lib/stores/locale-store`
  - 상세: 유틸리티 레이어가 i18n 코어와 스토어에 의존하게 되었습니다. i18n 레이어나 스토어가 날짜/상태 포맷 유틸리티를 사용한다면 순환 의존성이 발생할 수 있습니다.
  - 제안: 의존성 방향을 확인하고, `i18n` → `utils` 방향 import가 없는지 검증하세요.

---

- **[INFO]** `docs/registry.ts`의 re-export 패턴
  - 위치: `registry.ts:14-20`
  - 상세: `node:fs`/`node:path`를 사용하는 서버 전용 모듈에서 클라이언트 안전 함수를 re-export합니다. 기존 import 경로 호환성을 위한 의도적 패턴이나, 장기적으로는 `registry.ts`를 통해 서버 전용 함수와 클라이언트 안전 함수가 같은 진입점으로 혼재됩니다.
  - 제안: 현재 수준은 허용 가능하나, 주석에 명시된 의도를 유지하고 추후 import 경로를 직접 `locale.ts`를 가리키도록 점진적으로 마이그레이션하는 것을 권장합니다.

---

- **[INFO]** 새로운 외부 패키지 없음
  - 위치: 전체
  - 상세: 이번 변경은 외부 npm 패키지를 추가하지 않고 내부 i18n 인프라를 활용합니다. 번들 크기 증가나 라이선스 이슈는 없습니다.

---

### 요약

이번 i18n 적용 변경은 새로운 외부 의존성 없이 내부 i18n 시스템으로 하드코딩된 문자열을 대체하는 방식으로 진행되었으며 전반적으로 안전합니다. 다만 가장 주의해야 할 사항은 `date.ts`와 `execution-status.ts`에 `"use client"` 지시자가 추가되어 기존에 서버 컨텍스트에서도 사용 가능하던 유틸리티 파일들이 클라이언트 전용으로 변경된 점입니다. 이는 SSR/서버 컴포넌트 사용 시 예기치 않은 오류로 이어질 수 있는 구조적 회귀이므로 조속한 검토가 필요합니다. `formatDuration` 중복은 유지보수 부담을 높이므로 통합이 권장됩니다.

### 위험도

**MEDIUM**