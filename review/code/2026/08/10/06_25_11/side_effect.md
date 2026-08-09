### 발견사항

- **[INFO]** 모듈 최상위(import-time)에서 실행되는 유일성 단언 — 로드 시 throw 가 이 모듈을 import 하는 모든 테스트 스위트를 동시에 실패시킨다
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:88` (`assertAllUnique(ALL_WS);`), 함수 정의는 `:78-86`
  - 상세: 이 호출은 모듈을 `import`/`require` 하는 시점에 즉시 실행되며, `ALL_WS` 값이 중복되면 예외를 던진다. 이 모듈을 소비하는 3개 스위트(`common/decorators/workspace.decorator.spec.ts`, `common/utils/workspace-context.util.spec.ts`, `common/guards/roles.guard.spec.ts`)가 전부 "Test suite failed to run" 으로 동시 실패하게 된다. 문서(모듈 docstring, `:54-62`)에 의도가 명시돼 있고 이는 테스트 전용 fail-fast 캐너리로서 합리적인 설계이나, "함수 호출"이 아니라 "import 부작용"이라는 점에서 일반적인 부작용 체크리스트 상 주목할 항목이다. `tsconfig.build.json` 의 `exclude` 가 `**/*spec.ts` 만 걸러 `.spec.ts` 가 아닌 이 파일(`workspace-id-fixtures.ts`) 자체는 `tsc` build 대상에 포함돼 `dist/` 로 컴파일된다(문서에도 명시). 다만 실측(`grep -rln "workspace-id-fixtures"`) 결과 프로덕션 코드 어디서도 이 모듈을 import 하지 않으므로, 현재는 앱 부팅 경로에서 이 부작용이 트리거될 위험이 없다.
  - 제안: 현 상태로 문제 없음(테스트 전용, 프로덕션 import 없음 확인됨). 추가 조치 불요하나, 향후 이 디렉터리에서 프로덕션 코드가 `__test-utils__` 를 import 하는 일이 없도록 lint/경계 규칙(이미 존재한다면 유지)을 계속 지킬 것.

- **[INFO]** 신규 spec 파일이 테스트 실행 시점에 이웃 소스 파일을 파일시스템에서 직접 읽는다
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:46-49` (`readFileSync(join(__dirname, 'workspace-id-fixtures.ts'), 'utf8')`)
  - 상세: 쓰기가 아닌 읽기 전용 fs 접근이라 위험도는 낮다. 다만 `__dirname` 기준 상대경로로 "배선 검증"(호출부 존재 여부)을 하는 방식이라, 향후 `workspace-id-fixtures.ts` 가 이동/rename 되면 이 테스트가 파일을 못 찾아 조용히 다른 실패 메시지로 깨진다(의도된 소스-존재 의존이며 주석에도 "값 검증이 아니라 배선 검증"이라 명시돼 있어 설계상 트레이드오프로 보임). CI/jest 는 ts 소스를 직접 실행하므로(`ts-jest`/`swc` 등) `dist/` 미컴파일 문제는 없을 것으로 보이나, 이 파일이 build 대상(`__test-utils__`)에 포함돼 있어 `dist/` 에도 나란히 복제될 수 있는데 `.spec.ts` 는 build exclude 대상이라 실제로는 dist 에 없다(확인됨: `tsconfig.build.json` exclude `**/*spec.ts`).
  - 제안: 정보성. 현재로선 부작용 문제 없음.

- **[INFO]** 신규 export(`ALL_WS`, `assertAllUnique`)는 순수 추가이며 기존 export(`HEADER_WS`~`NIL_WS`)의 이름·값을 변경하지 않음 — 기존 3개 소비 스위트에 대한 하위호환 영향 없음
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:63-86`
  - 상세: `grep` 으로 확인한 3개 소비처(`workspace.decorator.spec.ts`, `workspace-context.util.spec.ts`, `roles.guard.spec.ts`)는 기존 named export 만 사용하며 신규 심볼(`ALL_WS`, `assertAllUnique`)을 참조하지 않는다. 시그니처·인터페이스 파괴적 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** `uuid.spec.ts`, `plan/in-progress/auth-guard-reflection-hardening.md` 변경은 주석/문서 텍스트 축약(SoT 포인터화)일 뿐 실행 코드·동작 변경 없음
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts:49-58`, `plan/in-progress/auth-guard-reflection-hardening.md` (체크리스트 항목)
  - 상세: 두 파일 모두 부작용 관점에서 영향 없음(전역 상태·시그니처·인터페이스·env·네트워크·이벤트 어느 것도 건드리지 않음).
  - 제안: 조치 불요.

### 요약

이번 changeset 은 테스트 픽스처 모듈에 로드 시점(import-time) 유일성 단언(`assertAllUnique(ALL_WS)`)을 추가하는 것이 핵심 변경이다. 이는 함수 호출이 아니라 모듈 최상위에서 실행되는 부작용이라 import 하는 모든 소비 스위트를 동시에 실패시킬 수 있다는 점에서 일반적인 "부작용" 체크리스트에 걸리지만, 문서화된 의도(테스트 전용 fail-fast 캐너리)이고 실측 결과 프로덕션 코드 경로에서는 이 모듈을 import 하지 않아 앱 런타임에는 영향이 없다. 기존 export 는 이름·값 모두 그대로 유지돼 기존 3개 소비 스위트에 대한 시그니처·인터페이스 파괴적 변경이 없고, 신규 spec 파일의 `readFileSync` 는 읽기 전용으로 위험이 낮다. 전역 변수 오염, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경은 없다. 전반적으로 부작용 관점에서 위험은 낮다.

### 위험도

LOW
