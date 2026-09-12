# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 신규 가드 판정 함수의 중첩 깊이가 5단계에 달한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:146-182` (`scanUuidParams` 내부 `visit` 클로저)
  - 상세: `for(file)` → `visit` 재귀 클로저 → `if(isMethodDeclaration)` → `for(parameter)` → `for(decorator)` 로 5단계까지 들어간 뒤에야 실제 판정 로직(누락 축 계산·`out.push`)이 실행된다. 같은 디렉터리의 자매 가드들(`masked-reject-callers-guard.ts`, `nullable-type-lie-cast-guard.ts` 등)은 대체로 `for`+`if` 2~3단계에서 끝나는데, 이 가드는 "메서드 → 파라미터 → 데코레이터" 세 층위를 한 함수 안에서 순차로 뚫고 들어가 상대적으로 깊다. 로직 자체는 뮤테이션 6/6 로 잘 검증돼 있고 주석도 충실하지만, 향후 세 번째 축(예: 다른 데코레이터 조합)을 추가하려는 사람은 이 깊이에서 분기를 하나 더 얹어야 한다.
  - 제안: `visit` 내부의 "메서드 하나를 처리하는" 블록(147~180행)을 `collectMethodViolations(method, sf, rel): { violations, scanned }` 같은 별도 함수로 추출하면 `visit` 자체는 AST 순회만 담당하고, 판정 로직은 독립적으로 단위 테스트·수정할 수 있어 중첩이 2단계까지 줄어든다.

- **[INFO]** `missing` 배열의 타입을 간접 인덱스 접근으로 표현해 가독성이 떨어진다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:164` (`const missing: UuidParamViolation['missing'][number][] = [];`)
  - 상세: `UuidParamViolation.missing` 의 원소 타입(`'ParseUUIDPipe' | "@ApiParam format:'uuid'"`, 18행)을 `interface` 안에 인라인으로 선언해 두고, 정작 그 값을 만드는 자리(164행)에서는 `UuidParamViolation['missing'][number][]` 라는 인덱스드 액세스 타입으로 되짚어 참조한다. 저장소의 다른 `repo-guards/__tests__/*.ts` 어디에도 이 패턴(`[...][number][]`)은 없다 — 이 가드에서만 나타나는 표현이다.
  - 제안: `type UuidParamAxis = 'ParseUUIDPipe' | "@ApiParam format:'uuid'";` 로 이름을 붙이고 `UuidParamViolation.missing: readonly UuidParamAxis[]` 와 `const missing: UuidParamAxis[] = []` 양쪽에서 그 별칭을 직접 쓰면 정의와 사용 지점이 대칭이 되고, 인덱스 접근 타입을 몰라도 즉시 읽힌다.

- **[INFO]** 같은 사실(22P02 마스킹 사슬)이 최소 5곳에서 거의 동일한 문장으로 반복 서술된다
  - 위치: `CHANGELOG.md`(신규 Unreleased 항목) · `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken` 파라미터 위 인라인 주석) · `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`(파일 상단 및 `scanUuidParams` 독스트링) · `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`(describe 헤더 독스트링) · `plan/in-progress/trigger-uuid-and-guide-error-codes.md`
  - 상세: "`Trigger.id` 가 `uuid` 컬럼 → 비-UUID 입력이 SQLSTATE 22P02 로 거부 → `GlobalExceptionFilter` 의 세 분기 어디에도 안 걸려 500 으로 마스킹된다"는 동일한 인과 사슬이 최소 다섯 파일에 반복 서술돼 있다. 각 문서가 서로 다른 독자(코드 리더 / 가드 유지보수자 / 릴리스 노트 소비자 / 작업 이력 열람자)를 겨냥한 계층적 문서화 관례로 보이며 이 저장소가 이미 채택한 스타일과 일치하므로 결함으로 보지는 않는다. 다만 훗날 `GlobalExceptionFilter` 의 분기 조건이 바뀌면 이 다섯 곳을 전부 찾아 갱신해야 한다는 동기화 비용은 남는다.
  - 제안: 별도 조치 불요. 다만 이 사슬을 언급하는 자리가 늘어난다면 `common/utils/uuid.ts`(이미 같은 사슬을 적어 두었다고 코드가 자체 언급)처럼 코드 쪽 "정본 서술" 한 곳을 지정하고 나머지는 그곳을 가리키는 방식으로 수렴시키는 편이 장기적으로 더 안전하다.

## 요약

이번 변경은 `rotateBotToken` 의 `:id` UUID 파이프 누락을 고치고, 그 재발을 막는 AST 기반 전수 가드(`param-uuid-pipe-guard.ts`/`.spec.ts`/fixture)를 신설했으며, 유저 가이드 6곳의 `TRIGGER_NOT_FOUND` 오귀속과 환경변수명 오기를 정정했다. 네이밍(`isIdShaped`, `isExcludedFromOpenApi`, `apiParamUuidFlags` 등)은 목적을 정확히 드러내고, 파일 배치·명명 규약은 `dto-class-name-collision` 등 기존 `repo-guards` 자매 가드와 일관되며, 매직 넘버(`toBeGreaterThan(30/100)`)도 저장소 전역에 이미 확립된 vacuity-floor 관례를 그대로 따른다. 유일한 구조적 아쉬움은 신규 가드의 판정 함수가 AST 계층(메서드→파라미터→데코레이터)을 한 함수 안에서 순회하느라 중첩이 다소 깊어진 점과, 타입 별칭 하나를 인덱스드 액세스로 대신한 지점 정도이며 둘 다 기능적 결함이 아니라 다음 확장 시 가독성을 낮출 수 있는 국소적 리팩터링 여지다. 전반적으로 뮤테이션 테스트(6/6, RED 예측 일치)와 대조군 fixture 로 판정 로직의 정확성을 스스로 입증하고 있어 유지보수 위험은 낮다.

## 위험도

LOW
