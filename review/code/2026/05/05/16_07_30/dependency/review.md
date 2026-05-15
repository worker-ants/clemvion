## 의존성 리뷰: F-2 buttons[*].id 자동 부여

### 발견사항

- **[INFO]** `PORT_ID_SLUG_REGEX` 중복 정의
  - 위치: `backend/scripts/migrate-button-ids.ts:57`
  - 상세: 마이그레이션 스크립트가 `PORT_ID_SLUG_REGEX = /^[a-zA-Z0-9_-]{1,64}$/`를 직접 정의하고 있으나, `button-slug.util.ts`는 동일 상수를 `./port-id.util`에서 import. 향후 regex 정책이 변경될 경우 스크립트만 누락될 수 있음.
  - 제안: 일회성 마이그레이션 스크립트이므로 허용 가능하나, 스크립트 주석에 "port-id.util과 동일 regex를 의도적으로 복사" 임을 명시하면 혼란 방지.

- **[INFO]** `shadow-workflow.ts` → `nodes/core` 신규 크로스 모듈 의존성
  - 위치: `shadow-workflow.ts:6-9`
  - 상세: `workflow-assistant/tools/shadow-workflow.ts`가 `nodes/core/button-slug.util`을 import. `workflow-assistant` 모듈이 `nodes/core` 모듈에 단방향으로 의존하는 구조로, 의존 방향(nodes/core → workflow-assistant가 아닌 반대)은 아키텍처상 자연스러움.
  - 제안: 이상 없음. 단, 향후 `button-slug.util`의 공개 계약(`normalizeNodeButtonIds`, `isButtonNodeType`)이 변경될 경우 shadow-workflow도 영향을 받으므로 해당 유틸의 인터페이스 안정성을 관리할 것.

- **[INFO]** `migrate-button-ids.spec.ts`의 cross-directory import
  - 위치: `backend/src/scripts/migrate-button-ids.spec.ts:9`
  - 상세: 테스트 파일이 `src/` 내부에 있으나 실제 스크립트는 `backend/scripts/`(src 밖)에 위치. `../../scripts/migrate-button-ids` 상대 경로는 올바르게 해석되지만, Jest `rootDir`/`moduleFilePatterns` 설정에 따라 빌드 제외 경로 문제가 생길 수 있음.
  - 제안: `tsconfig.json`의 `include`/`exclude`와 Jest `testPathPattern`에 `backend/scripts/**`가 포함되어 있는지 확인 필요.

---

### 요약

이번 변경에서 **새로운 외부 패키지는 전혀 추가되지 않았다.** `dotenv`·`typeorm`은 기존 backend 의존성이며, `path`는 Node.js 내장 모듈이다. 신규 내부 모듈 `button-slug.util.ts`가 `port-id.util`에서 `PORT_ID_SLUG_REGEX`를 재사용하는 설계는 단일 출처(Single Source of Truth) 원칙에 부합한다. 마이그레이션 스크립트가 동일 상수를 인라인으로 복사한 부분은 일회성 스크립트 특성상 허용 범위이며, `shadow-workflow → nodes/core` 단방향 의존성은 모듈 계층 구조상 자연스럽다. 취약점·라이선스·번들 크기 관련 우려 사항은 없다.

### 위험도

**LOW**