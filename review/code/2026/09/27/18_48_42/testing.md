# 테스트(Testing) 리뷰 — patch-null-validation (3R)

이 diff 는 직전 두 라운드(`17_47_49`, `18_13_53`)와 동일한 코드 변경 + 그 라운드들의 조치 커밋(`e5de5226c`)
+ 이후 문서 전용 커밋(`634297632` JSDoc 3줄, `27191021c` plan-only) + 리뷰/컨시스턴시 산출물 자체를
포함한다. `git diff --stat 15a094c6a...HEAD -- codebase/` 로 확인한 결과 2R 판정 이후
`codebase/backend/src/common/utils/optional-non-null.ts` 에 JSDoc 3줄이 추가된 것 외에 프로덕션 코드
변경은 없다 — 테스트 관점의 실질 표면은 2R 과 동일하다.

## 실행 확인

`codebase/backend/package.json` 의 `test` 스크립트(`node --experimental-vm-modules
./node_modules/jest/bin/jest.js`)로 관련 3개 스펙을 직접 실행해 통과를 재확인했다(`npx jest` 로 바로
돌리면 `uuid`/TypeORM ESM 로딩 문제로 실패하는데, 이는 `--experimental-vm-modules` 플래그 누락 때문인
로컬 호출 실수였고 프로젝트 결함이 아니다 — 정식 스크립트로는 문제 없음):

```
node --experimental-vm-modules ./node_modules/jest/bin/jest.js \
  src/common/utils/optional-non-null.spec.ts \
  src/repo-guards/__tests__/patch-null-rejection.spec.ts \
  src/modules/users/dto/update-me.dto.spec.ts
→ Test Suites: 3 passed, 3 total / Tests: 98 passed, 98 total
```

## 발견사항

- **[INFO — 2R 에서 이미 지적, 미해소이나 비차단, 이월]** 다중 필드가 동시에 `null` 인 PATCH 요청에서
  `details[]` 에 전부 담기는지는 여전히 unit·e2e 어디서도 검증되지 않는다 — 모든 케이스가
  `{ [field]: null }` 단일 키다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts` `constraintsFor`
    함수, `codebase/backend/test/patch-null-rejection.e2e-spec.ts` `it.each(cases)` 블록
  - 상세: class-validator 는 프로퍼티별 독립 검증이라 위험은 낮고, `details[]` 매핑 계층
    (`CustomValidationPipe`)은 이 PR 이 건드리지 않는다. 2R 이후 코드 변경이 없어 판단도 그대로 유효하다.
  - 제안: 우선순위 낮음. 이 PR 을 막을 사안 아님.

- **[INFO — 2R 에서 이미 지적, 미해소이나 비차단, 이월]** `IsOptionalNonNull()` 이
  `validationOptions` 를 `IsDefined` 의 고정 `message` 뒤에 스프레드해, 호출자가 `message` 를 넘기면
  조용히 덮어쓰는 경로가 테스트되지 않는다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts` — `IsDefined({ message: ..., ...validationOptions })` 부분 (`export function IsOptionalNonNull` 본문)
  - 상세: 현재 14개 DTO · 43필드 전 호출부가 인자 없이 쓰므로 미현실화. 이번 라운드의 JSDoc 추가도 이
    동작 자체를 바꾸지 않았다.
  - 제안: 우선순위 낮음. 변경 불필요.

- **[INFO — 신규, 커버리지 갭 관점]** `patch-null-rejection.spec.ts` 의 `TABLE`(43필드 골든 리스트)이
  실제 DTO 소스의 `@IsOptionalNonNull()` 사용처와 별도로 손으로 유지된다 — 다음 사람이 NOT NULL
  컬럼에 대응하는 새 PATCH 필드에 데코레이터만 붙이고 `TABLE` 갱신을 잊으면 테스트는 계속 GREEN 이고
  회귀 보호는 조용히 빠진다(리플렉션으로 소스를 스캔해 `TABLE` 과 대조하는 장치가 없다).
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts` — `const TABLE`
    선언부, 전제 단언 `it('[전제] 표가 전수 결과(43필드)와 같다', ...)`
  - 상세: docblock(`TABLE` 선언 바로 위 주석)이 이미 "새 필드는 자동으로 들어오지 않는다"를 명시해
    은폐된 한계는 아니다. 같은 세션의 architecture 리뷰(`review/code/2026/09/27/17_47_49/architecture.md`)
    가 SoT 중복 구조 자체를 이미 지적했는데, 이는 그 지적을 **커버리지 갭**(테스트 관점 체크리스트 2번)
    각도에서 재확인한 것 — 새 조치를 추가로 요구하지 않는다.
  - 제안: 즉시 조치 불요. 후속으로 `@IsOptionalNonNull()` 사용처를 AST/리플렉션으로 전수 스캔해
    `TABLE` 과 대조하는 카나리아를 고려할 만하다(PR 스코프 밖).

- **[INFO — 신규, 엣지 케이스 관점]** falsy-but-defined 값(숫자 `0`, 빈 배열 `[]`)이 각 프로덕션 DTO
  필드에서 여전히 "값 있음"으로 통과하는지는 개별 필드 단위로 테스트되지 않는다 — `boolean false` 만
  범용 `Probe` 클래스(`optional-non-null.spec.ts`)로 검증됐고, `positionX: 0`·`threshold: 0`·
  `tags: []` 같은 숫자/배열 0-값 케이스는 어디에도 없다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.spec.ts` — `it('값이 오면 그 값의
    검증기만 본다', ...)` (boolean 만 커버), `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts`
    는 `null`/`{}` 두 상태만 검증하고 "유효 값" 상태는 다루지 않음
  - 상세: `ValidateIf((_, value) => value !== undefined, ...)` 는 엄격한 `undefined` 비교라 falsy
    값과 무관하게 정상 동작할 것으로 보이며, `@IsOptional()` 의 기존 동작(undefined·null 스킵)과 비교해도
    이 부분은 로직이 바뀐 지점이 아니다 — 실제 결함 가능성은 낮다. 다만 이 저장소 메모리(falsy-value 회귀가
    반복 발생한 이력)를 고려하면 최소 한 개의 숫자형 필드(`positionX: 0` 등)에 대해 "0 은 값 있음으로 통과한다"
    캐너리를 두면 향후 `ValidateIf` 조건이 실수로 `!value` 류로 완화되는 회귀를 조기에 잡을 수 있다.
  - 제안: 선택적. 이 PR 을 막을 사안 아님 — 후속 보강 후보로만 기록.

- **[관찰 — 회귀 검증 재확인]** 이 PR 이 건드리지 않은 nullable 필드(`description`·`parentId`·
  `ipWhitelist`·`settings` 등)의 기존 null 테스트(`folder-crud.e2e-spec.ts`·`patch-partial-body.e2e-spec.ts`
  등)를 grep 으로 재대조했다 — 전부 "null 이 값을 지운다"를 검증하는 것이고 이번에
  `@IsOptionalNonNull()` 로 바뀐 43필드와 겹치지 않는다. stale 회귀 없음, 2R 판정과 동일하다.
- **[관찰 — 테스트 격리]** `test/jest-e2e.json` 의 `maxWorkers: 1` 을 재확인했다 — `patch-null-rejection.e2e-spec.ts`
  의 null-거부 케이스들은 상태를 바꾸지 않는 400 응답이고, 상태를 바꾸는 "유효 값" 테스트는 파일 끝에
  한 번만 위치해 순서 의존 리스크가 실질적으로 없다.

## 요약

2R 이후 프로덕션 코드 변경이 JSDoc 3줄뿐이라 테스트 표면은 사실상 동일하며, 관련 스펙 3개(98 테스트)를
정식 스크립트로 재실행해 전부 통과를 직접 확인했다. 43필드 unit 표(전수) · 33케이스 e2e(대표 라우트,
null 거부 + 모델 설정 유효 값/키 생략 경로) · `update-me.dto.spec.ts` 회귀 갱신이 mock 없이 실 DB/실
HTTP 로 구성돼 있고, 이 PR 이 건드리지 않은 nullable 필드의 기존 테스트도 충돌 없이 유효하다. 남은
항목은 전부 INFO 수준이다 — 이월된 두 건(다중 null 시 `details[]` 완전성, `message` 옵션 오버라이드
미검증)은 2R 과 동일하게 저위험·범위 밖이고, 이번에 새로 짚은 두 건(43필드 골든 리스트의 SoT 드리프트
위험, falsy 값 개별 필드 캐너리 부재)도 즉시 조치가 필요한 결함이 아니라 후속 보강 후보다. 새로운
Critical/Warning 은 발견하지 못했다.

## 위험도

LOW
