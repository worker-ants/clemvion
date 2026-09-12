# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새 테스트 1건이 파일 내 유일하게 `.then()` promise 체이닝을 쓴다 — 나머지 11개는 전부 `async/await`
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts:165` (`it('[대조군] nil UUID 처럼 느슨한 형태도 통과시킨다 …', () => { return service.findForUser({...}).then(() => {...}); });`)
  - 상세: 같은 파일의 다른 모든 `it(...)`(예: 124, 133, 147, 184, 189, 194)는 `async () => { await service.findForUser(...); ... }` 패턴을 쓴다. 이 테스트만 `() => { return promise.then(...) }` 형태로 작성돼 있다. 동작은 동일하지만(반환된 Promise 를 jest 가 기다림), 같은 파일 안에서 두 가지 비동기 패턴이 섞이면 다음 사람이 복사-붙여넣기할 때 `return` 을 빠뜨려 조용히 vacuous 테스트를 만들 위험이 생긴다(이 코드베이스가 과거에도 겪은 vacuous-test 클래스). 왜 이 테스트만 다른 패턴을 썼는지 설명하는 주석도 없다.
  - 제안: `async () => { await service.findForUser({...}); expect(...); }` 형태로 통일한다.

- **[WARNING]** 22P02→500 마스킹 근거를 설명하는 ~12줄짜리 주석 블록이 두 프로덕션 파일에 거의 그대로 복제됐다
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-65` (`decodeCursor` 내부) 및 `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-180` (`decodeCursor` 내부)
  - 상세: `isUuidShaped` 를 고른 이유, 22P02→500 마스킹 메커니즘, `spec/data-flow/12-workspace.md §Rationale "UUID 검증 강도 비대칭"` 인용까지 거의 동일한 산문이 두 곳에 실려 있다. 검증 로직 자체(`isUuidShaped` 재사용)는 중복이 아니지만, 그 근거를 설명하는 주석이 복제되어 있어 근거가 바뀌면(예: spec 섹션 제목 변경, 술어 교체) 두 곳을 동기화해야 한다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (developer 등재 `/ai-review review/code/2026/09/12/23_19_03` maintainability INFO#1)에 "주석-only 라 이번 배치 스코프 밖" 으로 처분이 기록돼 있어 새로운 지적은 아니지만, 이 diff 시점까지 미해소 상태이므로 재확인 차원에서 기재한다.
  - 제안: 이미 plan 에 제안된 대로 상세 근거를 `common/utils/uuid.ts` 의 `isUuidShaped` JSDoc 한 곳으로 모으고 호출부는 1~2줄 참조로 압축하는 후속 작업을 진행 시 반영.

- **[INFO]** `login-history.service.spec.ts` 에 처음으로 한국어 테스트 타이틀이 등장해 파일 내 로컬 컨벤션이 깨짐
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts:165`, `:194`
  - 상세: 이 파일의 기존 12개 테스트는 전부 영어 타이틀(`'returns one page with no cursor when rows ≤ limit'` 등)이었는데, 이번에 추가된 2건만 한국어 타이틀이다. 저장소 전체로 보면 한국어 테스트 타이틀은 이미 선례가 있다(예: `background-runs.service.spec.ts` 는 기존부터 영어·한국어가 섞여 있음)이므로 저장소 전체 컨벤션 위반은 아니지만, **이 파일 자체의 기존 일관성**은 이번 diff 로 처음 깨진다. 기능에는 영향 없음.
  - 제안: 낮은 우선순위. 굳이 되돌릴 필요는 없으나, 이 파일을 계속 영어로 유지할지 한국어로 전환할지 스타일을 정하면 향후 추가되는 테스트의 일관성에 도움이 된다.

- **[INFO]** 두 keyset 커서 디코더의 실패 계약 비대칭(무시 vs 400 `INVALID_CURSOR`)과 손으로 각각 구현된 중복은 이미 developer 자신이 백로그에 등재해 둔 상태
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` `decodeCursor` vs `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `decodeCursor` (§C, `plan/in-progress/keyset-cursor-uuid-validation.md`)
  - 상세: 같은 구조적 결함(uuid 컬럼에 미검증 id 바인딩)을 고치면서 두 디코더가 서로 다른 실패 계약을 유지하도록 의도적으로 선택했고, 통합 헬퍼로 묶지 않은 이유(인코딩이 파이프-구분 vs base64 JSON 으로 다름)도 plan 에 명시돼 있다. 코드 양쪽 주석에도 "형제는 다르게 동작한다" 는 상호 참조가 남아 있어, 신규 유지보수자가 한쪽만 보고 오해할 위험은 어느 정도 완화돼 있다. 새로운 지적이 아니라 확인 차원의 기록.
  - 제안: 없음(이미 트래커에 planner 결정 대기 항목으로 등재됨).

## 요약

이번 변경은 기존에 이미 존재하던 `isUuidShaped` 유틸을 재사용해 두 커서 디코더에 한 줄짜리 검증 가드를 추가하는 좁은 범위의 수정이며, 각 가드에는 "왜 `isValidUuid` 가 아니라 `isUuidShaped` 인가", "왜 필터가 아니라 입구를 고쳤는가" 를 설명하는 상세한 근거 주석과 대조군(counter-example) 테스트가 함께 따라와 코드베이스의 기존 문서화 관행과 잘 맞는다. 다만 그 근거 주석이 두 파일에 거의 그대로 복제되어 있고(이미 백로그에 등재된 채 미해소), 새 테스트 중 하나가 파일 내 유일하게 `.then()` 체이닝을 써 비동기 패턴이 섞였으며, 한 스펙 파일에 처음으로 한국어 테스트 타이틀이 섞여 로컬 일관성이 소폭 깨졌다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 측면에서는 문제가 없고, CHANGELOG.md 추가분도 기존 문서 스타일(표·인용·⚠️ 배포 확인 블록)을 그대로 따른다. 전반적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
