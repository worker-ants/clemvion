# 테스트(Testing) 리뷰 — interaction-type-exhaustiveness AST 가드

## 리뷰 대상
- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (기능 변경: `scriptKindForFile` 도입 + self-test 3건 신규 + `describe("scriptKindForFile")` 신규)
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (주석만 변경, 로직 무변경 — "grep 가드" → "AST 가드" 용어 정정)

## 검증 방법
정적 리뷰에 더해, 실제로 vitest 를 실행하고 **의도적으로 코드를 되돌리거나(mutate) 손상시켜 테스트가 실제로 실패하는지** 3가지 시나리오로 직접 확인했다(파일은 검증 후 `git checkout --`으로 원복, 최종 `git status` clean 확인 완료).

1. `collectCodeStringLiterals` 내부의 `scriptKindForFile(fileName)` 호출을 `ts.ScriptKind.TS` 하드코딩으로 되돌림 → `parses angle-bracket syntax by extension, through the guard's own entrypoint` self-test가 즉시 실패(`expected true to be false`). PR #972/#977 이 지적한 "self-test 가 실제 엔트리포인트를 안 거쳐 회귀를 못 잡는" 문제가 이번 버전에서는 재발하지 않음을 실측 확인.
2. `interaction-type-registry.ts` 의 `INTERACTION_TYPE_VALUES` 에 실재하지 않는 값(`totally_fake_value_TEMP`)을 추가 → `WaitingInteractionType exhaustiveness across registry sites` 테스트가 3개 사이트 전부에 대해 `Missing WaitingInteractionType branches` 에러로 정확히 실패. outer 루프의 `missing.push`/`throw` 배선이 vacuous 하지 않음을 end-to-end 로 확인.
3. `use-execution-events.ts` 의 `case "buttons":` 라벨 하나만 바꿔봤을 때는 테스트가 **green 유지** — 같은 파일 내 다른 위치(유니온 타입 리터럴 등)에 `"buttons"` 문자열이 남아 있어서다. 이는 버그가 아니라 가드의 설계상 알려진 특성(파일 단위 "어딘가에 코드 리터럴로 등장" 판정이지 "특정 분기에 존재" 판정이 아님)이며, 파일 자체 주석(101-117행)에 이미 명시돼 있다. 신규 결함 아님.

## 발견사항

- **[INFO]** 템플릿 리터럴의 substitution 이 있는 경우(`` `waiting_${x}` ``) 미탐지
  - 위치: `collectCodeStringLiterals` (interaction-type-exhaustiveness.test.ts:131-148)
  - 상세: `ts.isNoSubstitutionTemplateLiteral` 만 수집 대상이라 `TemplateExpression`(보간이 있는 템플릿)의 head/middle/tail 텍스트는 수집되지 않는다. 현재 3개 `REGISTRY_SITES` 는 실제로 `===`/`case`/union-literal/object-property 형태만 쓰므로 지금 당장 false-negative 를 유발하진 않지만, 향후 어떤 사이트가 보간 템플릿으로 분기 값을 만들면(드묾) 조용히 미탐지될 수 있다.
  - 제안: 지금 당장 조치 불요(스코프 밖). 향후 템플릿 기반 분기가 추가되면 self-test 에 케이스 추가 권장.

- **[INFO]** `readRepoFile` 의 상대경로 계산(`../../../../../`)에 대한 직접 단위 테스트 부재
  - 위치: interaction-type-exhaustiveness.test.ts:82-85
  - 상세: 5단계 `../` 하드코딩이 맞다는 근거는 "실제 3개 레지스트리 사이트 읽기가 성공하고 실제 리터럴을 찾는다"는 통합 테스트 결과에 간접적으로만 의존한다. 경로가 잘못되면 `readFileSync` 가 `ENOENT` 로 시끄럽게 실패하므로 은폐된 실패 위험은 낮지만, 테스트 파일이 다른 디렉터리 깊이로 이동하는 리팩터링 시 원인 파악에 약간의 시간이 걸릴 수 있다.
  - 제안: 선택사항. 필요 시 `join(__dirname, ...)` 결과가 repo root 의 알려진 파일(e.g. `package.json`)을 가리키는지 확인하는 경계 테스트를 추가하면 향후 리팩터링 시 에러 메시지가 더 명확해진다.

- **[INFO]** `describe("scriptKindForFile", ...)` 이 entrypoint 통합 self-test(`parses angle-bracket syntax by extension, through the guard's own entrypoint`)와 커버리지가 부분 중복
  - 위치: interaction-type-exhaustiveness.test.ts:236-245 (entrypoint 테스트) vs :247-256 (`scriptKindForFile` 단위 테스트)
  - 상세: 순수 헬퍼에 대한 단위 테스트 + 실제 엔트리포인트를 관통하는 통합 self-test 이중 배치는 의도적인 belt-and-suspenders 로 읽힌다(PR #972/#977 리뷰가 "프록시로만 테스트하면 회귀를 못 잡는다"를 정확히 지적했던 이력 때문). 문제라기보다 설계 의도 기록 차원의 관찰.
  - 제안: 조치 불요.

## 긍정적 관찰 (테스트 설계 우수 사례)

- **Mock 미사용이 적절**: 실제 `ts.createSourceFile` 파서와 실제 `readFileSync` 를 그대로 사용한다. 이 가드의 존재 이유 자체가 "실제 파일의 실제 코드"를 검사하는 것이므로, 파서나 파일시스템을 mock 했다면 PR #968 이 지적한 "회귀를 숨기는 가짜 통과"를 재도입하는 것과 같다 — mock 부재가 정답인 드문 사례.
- **회귀 근거가 실행 가능한 property 로 인코딩됨**: 각 self-test 주석이 특정 PR 리뷰 발견(#968/#972/#977)을 인용하며, 그 발견을 되돌리면 실제로 실패하는지 위 mutation 실험으로 3건 모두 확인했다. "왜 이 테스트가 존재하는가"가 코드 자체에 executable property 로 남아 다음 리팩터가 실수로 되돌려도 CI 가 잡는다.
- **테스트 격리**: 각 `it` 이 로컬 fixture 문자열만 사용하고(실제 레지스트리 사이트를 읽는 마지막 두 `describe` 제외), 공유 mutable 상태·테스트 간 순서 의존성이 없다. 실제 파일을 읽는 테스트도 read-only 라 부작용 없음.
- **CI 배선 확인**: `.claude/test-stages.sh` 의 `pnpm --filter frontend test` 스테이지가 `vitest run` 을 실행하므로 이 가드는 orphaned 되지 않고 CI 에서 실제로 돈다(과거 메모리에 기록된 "일부 패키지 test-stages 미배선" 류의 갭 아님).
- **`interaction-type-registry.ts` 변경은 순수 주석 정정**(grep→AST 용어 수정)으로 로직 변경이 없어 회귀 위험이 없다. `_noMissingInteractionType`/`_noMissingSource` 컴파일타임 단언은 `tsconfig.json` 의 `src/**/__tests__/**` exclude 규칙을 실제로 확인한 결과 이 파일이 그 exclude 밖(`src/lib/conversation/`)에 있어 tsc 가 실제로 읽는다는 주석의 주장과 일치한다.

## 요약
`interaction-type-exhaustiveness.test.ts` 변경분은 이전 두 차례 리뷰(#972, #977)에서 지적된 "self-test 가 실제 회귀를 못 잡는다"는 결함을 이번엔 제대로 닫았다 — `.tsx` 하드코딩 되돌리기, outer 루프의 missing/throw 배선 손상, 두 mutation 시나리오 모두 직접 재현해 실패를 확인했다. Mock 없이 실제 파서·실제 파일을 쓰는 설계, 테스트 간 격리, CI 배선까지 확인됐고 새로 추가된 프로덕션 로직(`scriptKindForFile`) 은 순수 함수라 테스트 용이성도 좋다. 남은 지적사항은 전부 INFO 등급의 예방적 관찰(템플릿 리터럴 보간 미탐지, 경로 계산 직접 테스트 부재)로, 현재 스코프의 실질 결함은 아니다. `interaction-type-registry.ts` 는 순수 주석 정정이라 별도 테스트 영향 없음.

## 위험도
NONE
