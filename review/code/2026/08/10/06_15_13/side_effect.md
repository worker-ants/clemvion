# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** 이전에는 상수만 export 하던 순수 모듈에 import-time 부작용(top-level `throw`)이 새로 생김
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:73-78` (`ALL_WS` 선언은 63-71)
  - 상세: `if (new Set<string>(ALL_WS).size !== ALL_WS.length) { throw ... }` 가 모듈 최상위 스코프에 있어, 이 모듈을 `import` 하는 시점에 실행된다. 종전에는 이 파일이 상수 선언만 있는 부작용-free 모듈이었는데, 이번 변경으로 "import 하면 검사가 즉시 돈다"는 새 계약이 생겼다. 의도된 설계(로드 시점 런타임 캐너리, 뮤테이션으로 로드베어링 실증됨 — plan 상 "값 충돌 시 3 RED")이고, 실제 소비자를 전수 grep 한 결과 `workspace.decorator.spec.ts`·`roles.guard.spec.ts`·`workspace-context.util.spec.ts` 정확히 3곳뿐이라 영향 범위는 주석이 주장하는 대로 닫혀 있다(배럴/`index.ts` 재-export 없음, 확인 완료). `tsconfig.build.json` 이 `__test-utils__` 를 컴파일해 `dist/` 에는 실리지만 아무도 import 하지 않으므로 프로덕션 경로에서 실행되지는 않는다.
  - 제안: 현 상태로 문제 없음. 다만 향후 이 디렉터리에 새 소비자(특히 배럴 export 경유)가 추가될 경우, import 시점에 항상 이 검사가 함께 실행된다는 점을 인지할 것 — 이미 plan 의 후속 항목(`__test-utils__` 3곳째 → `tsconfig.build.json` exclude 검토)이 이 표면을 추적 중이다.

- **[INFO]** 동일한 `Set` 이 조건식과 에러 메시지 템플릿에서 두 번 생성됨 (부작용은 아니고 순수 중복 계산)
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:73,75`
  - 상세: `new Set<string>(ALL_WS)` 가 73줄 조건식과 75줄 템플릿 리터럴에서 각각 새로 생성된다. 상태 변경이나 외부 부작용은 아니며 순수 함수적 중복 계산이라 side-effect 관점에서는 무해하다(참고용으로만 기재).
  - 제안: 리뷰 스코프 밖(성능/가독성 관점). 조치 불요.

시그니처·공개 인터페이스 변경, 환경 변수 읽기/쓰기, 파일시스템 부작용, 네트워크 호출, 이벤트/콜백 변경은 세 파일 모두에서 발견되지 않았다.

- `codebase/backend/src/common/utils/uuid.spec.ts`: JSDoc 주석만 재작성(SoT 를 `uuid.ts` 의 `isUuidShaped` docstring 으로 축약 포인팅). 단언(`expect(...)`) 로직·테스트 케이스 값은 diff 전후 동일 — 실행 시 부작용 변화 없음.
- `plan/in-progress/auth-guard-reflection-hardening.md`: plan 체크리스트 갱신뿐이며 코드 실행 경로와 무관. 부작용 검토 대상 아님.

## 요약

이번 변경의 실질 코드 변경은 `workspace-id-fixtures.ts` 에 추가된 모듈 최상위 `throw` 한 줄(값 유일성 런타임 가드)이 유일한 side-effect 표면이며, 나머지는 주석 정리(중복 docstring → SoT 포인터)와 plan 문서 갱신이다. 새 top-level throw 는 종전에 부작용이 없던 test-utils 상수 모듈에 import-time 실행 부작용을 도입하지만, 의도된 캐너리 설계이고 뮤테이션으로 로드베어링이 실증됐으며 실제 소비자는 grep 으로 확인한 정확히 3개 spec 파일로 스코프가 닫혀 있어 배럴 export 를 통한 예기치 못한 확산 위험이 없다. 시그니처·공개 API·환경 변수·파일시스템·네트워크·이벤트 콜백 어느 축에서도 영향이 없다.

## 위험도
LOW
