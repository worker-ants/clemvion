## 발견사항

### [INFO] `RotateCw` 아이콘 추가 — lucide-react 기존 의존성 재사용
- **위치:** `frontend/src/components/editor/assistant-panel/assistant-message.tsx` L4
- **상세:** `RotateCw`는 이미 프로젝트에서 사용 중인 `lucide-react`에서 import. 신규 패키지 설치 없음. lucide-react는 named export 기반 tree-shaking을 지원하므로 번들 크기 증가는 아이콘 1개 분량(SVG path 수 kB 미만)에 그침.
- **제안:** 이슈 없음.

---

### [WARNING] `STALL_MAX_ATTEMPTS` 상수가 백엔드 `MAX_STALL_ROUNDS`와 수동 동기화 필요
- **위치:** `frontend/src/lib/stores/assistant-store.ts` L67
- **상세:** 프론트엔드가 `const STALL_MAX_ATTEMPTS = 2`를 별도로 선언하고, 코드 주석("백엔드에서 변경되면 같이 업데이트")으로 동기화 의무를 문서화하고 있음. `MAX_STALL_ROUNDS` 값이 백엔드에서 변경될 경우 rehydrate 시 divider의 "N/M" 표기가 잘못 렌더됨. SSE `auto_resume.data.max` 필드를 통해 실시간 스트림 경로는 정확한 값을 전달받지만, persist된 row를 복원하는 `hydrateMessage` 경로는 이 상수에 의존.
- **제안:** 단기적으로는 현 구조가 수용 가능. 중기적으로는 `auto_resume_attempt`와 함께 `auto_resume_max`를 DB 컬럼으로 persist하거나, `hydrateMessage`가 서버 응답의 다른 필드에서 `max`를 파생하도록 변경하면 하드코딩 의존성 제거 가능.

---

### [WARNING] SSE 이벤트 스키마가 백·프론트 양쪽에 중복 선언
- **위치:** `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` (AssistantStreamEvent union) ↔ `frontend/src/lib/api/assistant.ts` (AssistantSseEvent union)
- **상세:** `auto_resume` 이벤트의 페이로드 형태(`reason`, `attempt`, `max` 필드)가 두 곳에 독립적으로 정의되어 있고, i18n 포맷 문자열(`{{attempt}}/{{max}}`)도 페이로드 key 이름에 직접 묶여 있음. 런타임 타입 검증이 없어 백엔드에서 필드명을 변경하면 프론트가 조용히 `undefined`를 소비함.
- **제안:** 이미 메모리 문서(`§10` 체크리스트)에 동기화 의무가 기록되어 있어 인식은 되어있음. 신규 의존성이 아닌 기존 패턴의 연장이므로 현 프로젝트 구조상 허용 가능. 다만 공유 타입 패키지(예: `shared/`)가 생긴다면 이전 우선 대상.

---

### [INFO] `crypto.randomUUID()` — 외부 패키지 불필요, 플랫폼 내장 API 사용
- **위치:** `frontend/src/lib/stores/assistant-store.ts` (`applyAutoResumeEvent`, `sendMessage`)
- **상세:** 임시 클라이언트 row ID 생성에 Web Crypto API의 `crypto.randomUUID()`를 사용. Node.js 14.17+ 및 현대 브라우저에 내장되어 있어 별도 패키지 의존 없음. 적절한 선택.

---

### [INFO] `applyAutoResumeEvent` export — 테스트 인프라와의 결합
- **위치:** `frontend/src/lib/stores/assistant-store.ts` L443
- **상세:** 스토어 내부 함수를 테스트 편의를 위해 named export로 노출. 이는 기존 `handleSseEvent`, `summarizePlanState`와 동일한 패턴으로, 프로젝트 내에서 일관성 있게 사용 중인 관행. 신규 외부 의존성을 생성하지 않음.

---

## 요약

이번 변경에서 **신규 외부 패키지는 추가되지 않았다.** 프론트엔드는 기존 `lucide-react`에서 아이콘 하나를 더 사용하고, 백엔드는 기존 TypeORM 컬럼 데코레이터를 그대로 확장했다. 주요 의존성 리스크는 외부 라이브러리가 아닌 **내부 결합** 두 가지다: (1) `STALL_MAX_ATTEMPTS` 상수가 백엔드 `MAX_STALL_ROUNDS`와 수동 동기화에 의존하며, (2) SSE 페이로드 스키마가 백·프론트에 이중으로 선언되어 있다. 두 이슈 모두 이미 메모리 유지보수 체크리스트에 기록되어 있고 기존 프로젝트 패턴의 연장선이므로, 현 시점에서 구조적 변경은 불필요하나 `MAX_STALL_ROUNDS` 변경 시 반드시 프론트 상수와 DB 컬럼 추가를 함께 검토해야 한다.

## 위험도

**LOW**