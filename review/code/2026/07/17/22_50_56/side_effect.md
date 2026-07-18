### 발견사항

- **[INFO]** 신규 `typescript` compiler API 사용은 test-only 범위에 격리되어 있어 production 부작용 없음
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (`import ts from "typescript"`, `collectCodeStringLiterals`)
  - 상세: 대상 파일은 `src/**/__tests__/**` 경로로 `tsconfig` build 대상에서 제외되고(파일 자체 주석이 명시), vitest 설정(`vitest.config.ts` `include: ["src/**/*.{test,spec}.{ts,tsx}"]`)에서만 실행된다. `typescript` 는 frontend 의 기존 devDependency(`package.json:89`, `^5`)이므로 신규 의존성 추가·프로덕션 번들 영향·CI 신규 외부 다운로드가 없다. `ts.createSourceFile` 은 순수 파싱(메모리 내 AST 생성)만 수행하고 디스크 쓰기·네트워크 호출·전역 상태 변경이 없다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** `collectCodeStringLiterals` 는 부작용 없는 순수 함수
  - 위치: `interaction-type-exhaustiveness.test.ts:97-114` (`collectCodeStringLiterals`)
  - 상세: 입력(`source`, `fileName`)만으로 `Set<string>` 을 새로 생성해 반환한다. 모듈 스코프 변수·전역 객체·환경 변수 어느 것도 읽거나 쓰지 않는다. 재귀 방문자(`visit`)는 지역 클로저 변수(`literals`)만 채운다.
  - 제안: 조치 불요.

- **[INFO]** 기존 `readRepoFile`(파일시스템 read) 호출 패턴은 변경 없이 유지
  - 위치: `interaction-type-exhaustiveness.test.ts:244-247` (`readRepoFile`), 호출부 L328·L368 (변경 전과 동일하게 `readFileSync` 로 각 registry site 를 읽음)
  - 상세: 이번 diff 는 `readRepoFile` 의 반환값을 정규식 매칭 대신 `collectCodeStringLiterals` 로 넘기는 소비 측만 바꿨다. 파일 read 횟수·대상 경로·해석 방식(`readFileSync(..., "utf-8")`)은 그대로다. 새로운 파일 쓰기·삭제는 어디에도 도입되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 시그니처/인터페이스 변경 없음 — 변경이 test 파일 내부로 완전히 격리됨
  - 위치: 전체 diff
  - 상세: `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES`/`ENUM_VALUES`/`SOURCE_ENUM_VALUES`/`readRepoFile` 등 기존 식별자의 시그니처는 unchanged. `collectCodeStringLiterals` 는 신규 함수지만 이 파일 내부(같은 스코프)에서만 호출되는 test-local 헬퍼이므로 외부 호출자에게 영향을 주는 "기존 시그니처 변경"에 해당하지 않는다. production 코드(`execution-store.ts`, `use-execution-events.ts` 등 3개 registry site 자체)는 이번 diff 에 전혀 포함되지 않았다 — 즉 이 변경은 검증 로직만 교체할 뿐 검증 대상 프로덕션 코드의 동작에는 관여하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 환경 변수·네트워크 호출·이벤트/콜백 변경 없음
  - 위치: 전체 diff
  - 상세: `process.env` 읽기/쓰기, `fetch`/HTTP 클라이언트 호출, EventEmitter/콜백 등록·해제 어느 것도 diff 에 나타나지 않는다. `plan/in-progress/*.md` 및 `review/consistency/**` 신규 파일들은 이번 개발자 세션이 아니라 선행 `/consistency-check` 세션(19:54:00)의 산출물이며 이미 프로젝트 규약(`review/` 는 gitignore 대상 아님, 커밋 대상)에 부합하는 문서 파일이다 — 코드 실행 부작용이 아니라 기록물이다.
  - 제안: 조치 불요.

### 요약
이번 변경은 `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 라는 test-only 파일 안에서 검증 알고리즘(정규식 grep → TypeScript 컴파일러 API 기반 AST string-literal 수집)만 교체하며, 프로덕션 코드·공개 API·환경 변수·네트워크·이벤트/콜백 어느 것도 건드리지 않는다. 신규 함수 `collectCodeStringLiterals` 는 순수 함수이고, 파일시스템 접근은 기존 `readRepoFile` 패턴 그대로이며, 새로 도입된 `typescript` import 도 이미 존재하던 devDependency 를 test 스코프 안에서만 사용하는 것이라 빌드·번들에 영향이 없다. `plan/`·`review/` 하위 신규 markdown 파일들은 프로젝트 규약에 따른 문서 산출물로, 코드 실행 부작용과 무관하다. 부작용 관점에서 지적할 CRITICAL/WARNING 은 없다.

### 위험도
NONE
