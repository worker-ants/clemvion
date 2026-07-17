# 요구사항(Requirement) 리뷰 — commit e0e2123d4

## 배경 검증
선행 리뷰 `review/code/2026/07/17/16_33_59/SUMMARY.md` 의 WARNING#1(동적 `import()`/`require()` 우회)·WARNING#2(negative-space 가드 회귀 테스트 부재)를 그대로 확인 후, 본 커밋의 두 파일이 이를 실제로 해소하는지 **정적 분석 + 실측(실제 `eslint`/`vitest` 실행 + 의도적 mutation-테스트)** 로 검증했다.

### 실측 1 — WARNING#1 해소 여부 (실제 ESLint 실행)
`src/lib/__eslint_probe__/probe.ts` 에 아래 코드를 두고 `npx eslint` 를 직접 실행:
```ts
export const load = () => import("@/components/foo");
export const req = () => require("../components/bar");
```
결과:
```
1:27  error  레이어 역전: ... 동적 import() 로도 ...   no-restricted-syntax
2:26  error  레이어 역전: ... require() 로도 ...        no-restricted-syntax
```
두 우회 경로 모두 실제로 차단됨을 확인. `npx eslint src/lib --max-warnings=0` (전체 실행)도 0 errors — 기존 코드베이스에 새 규칙으로 인한 오탐(false positive)이 없음을 확인.

### 실측 2 — WARNING#2 해소 여부 (vitest 실행 + mutation 검증)
- `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` → 16/16 통과 (rule 존재성 1 + 위반 케이스 10 + 오탐 방지 케이스 5).
- 회귀 테스트가 "실제로 규병를 잡아내는지"를 별도로 검증하기 위해, `eslint.config.mjs` 사본을 만들어 `files: ["src/lib/**"]` → `files: ["src/lib-typo/**"]` 로 mutate 한 뒤 테스트 파일의 block-lookup 로직을 재현: `layeringBlock` 이 `undefined` 로 귀결되어 실제 테스트 파일의 `if (!layeringBlock?.rules) throw ...` 가드가 정확히 발동함을 확인. 즉 `files` glob 오타처럼 `npx eslint src/lib` 는 계속 "0 errors" 로 통과하지만 이 vitest 테스트는 실제로 fail 하는 시나리오를 재현 검증했다 (mutation 파일은 검증 후 삭제, 원본 트리는 `git status` 로 clean 확인).
- `npx tsc --noEmit` 0 errors, `npx eslint` (새 테스트 파일 자체) 0 errors — 부가 회귀 없음.

## 발견사항

- **[INFO]** 커밋 메시지의 "정적/동적 import·require 위반 8건" 이 실제 `it.each` 배열 원소 수(10건: 정적 4 + 동적 import 4 + require 2)와 불일치.
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:266-283` (실제 파일 기준 위반 케이스 목록)
  - 상세: 커밋 메시지 본문은 문서적 설명일 뿐 테스트 코드/동작에는 영향 없음. `it.each` 실제 항목은 10개(정적 alias·정적 alias 하위경로·정적 상대 1단계·정적 상대 2단계·동적 alias·동적 alias 하위경로·동적 상대 1단계·동적 상대 2단계·require alias·require 상대) + 오탐방지 5개 = 16 test, vitest 실행 결과와 일치. 기능적 결함 아님, 단순 커밋 메시지 카운트 오기.
  - 제안: 코드 수정 불필요. 커밋 메시지는 이미 병합되어 정정 실익이 낮음 (참고용 기록).

- **[INFO]** 동적 경로 커버리지의 알려진 한계 — 계산된 specifier(변수, 비-보간 template literal 등)는 여전히 탐지 불가.
  - 위치: `codebase/frontend/eslint.config.mjs:23-26` (주석), `:52`, `:59` (selector 의 `source.value`/`arguments.0.value` 매칭)
  - 상세: `ImportExpression[source.value=...]` 와 `CallExpression[...][arguments.0.value=...]` 는 리터럴 문자열 specifier 에만 매칭한다. `import(someVar)`, `` import(`@/components/${x}`) ``(보간 있는 template literal), 또는 보간 없는 `` import(`@/components/foo`) ``(TemplateLiteral 은 `.value` 프로퍼티가 없어 `source.value` 가 undefined) 는 모두 매칭하지 못해 우회 가능하다. 다만 이는 config 주석에 "계산된 동적 경로는 여전히 정적 분석 불가능 영역" 으로 명시적으로 문서화되어 있어 은폐된 갭이 아니라 **의도적으로 인지·문서화된 잔여 한계**다. WARNING#1 이 지적한 "정적 alias/상대경로 리터럴 우회" 범위는 완전히 해소됐다.
  - 제안: 추가 조치 불필요 (이미 명문화됨). 향후 실제 코드베이스에서 template literal 기반 dynamic import 패턴이 발견되면 그때 별도 이슈로 다룰 것.

- **[INFO]** 이 레이어 규약(`src/lib` → `@/components` import 금지)을 명문화한 spec/conventions 문서가 여전히 없음 (선행 리뷰 INFO#1 과 동일, 신규 이슈 아님).
  - 위치: `spec/conventions/*` (부재)
  - 상세: `spec/conventions/` 전체를 검색했으나 이 레이어링 규약을 다루는 문서를 찾지 못했다 (`interaction-type-registry.md` 는 무관한 문맥에서 `src/lib`/`components` 문자열이 우연히 같은 줄에 등장할 뿐). 본 커밋은 선행 리뷰의 WARNING#1/#2 fix 범위이므로 spec 신설은 이 커밋의 의무가 아니었고, 실제로 반영되지 않았다 — 이는 결함이 아니라 이미 알려진 선택적 후속 조치(INFO)다.
  - 제안: 이 가드가 프로젝트 표준으로 굳어지면 `project-planner` 에 위임해 spec 신설을 검토 (기존 SUMMARY 의 권장 조치사항 3번과 동일, 재확인만).

CRITICAL/WARNING 발견사항 없음 — 두 Warning 모두 코드 변경만으로 완전히 해소되고, 실제 ESLint 실행·mutation 테스트로 이를 실증했다.

## 점검 관점별 요약

1. **기능 완전성**: WARNING#1(동적 import/require 커버)·WARNING#2(회귀 테스트)를 정확히 겨냥한 최소 변경. 두 selector 는 실제 ESLint 실행에서 alias·상대경로(1·2단계) 우회를 모두 차단함을 실측 확인.
2. **엣지 케이스**: alias 단독(`@/components`, 하위경로 없음), alias 하위경로, 상대경로 1·2단계 우회, 무관 패키지(zod, sonner)와의 오탐 경계 — 10 positive + 5 negative 케이스로 커버. 계산된 동적 경로(변수/template literal)는 미탐지이나 명시적으로 문서화된 한계.
3. **TODO/FIXME**: 두 파일 모두 TODO/FIXME/HACK/XXX 없음 (grep 확인).
4. **의도와 구현 간 괴리**: 커밋 메시지 "위반 8건" 표현이 실제 10건과 불일치(위 INFO). 코드 자체의 함수명·주석·동작은 일치 — `layeringErrors`, throw 가드 메시지 등 의도대로 동작.
5. **에러 시나리오**: `layeringBlock` 룩업 실패 시 (`files` glob 이 더 이상 `src/lib/**` 를 포함하지 않을 때) 명시적 `throw new Error(...)` 로 fail-closed. mutation 테스트로 이 경로가 실제 발동함을 확인 — WARNING#2 가 우려한 "config 무력화가 CI green 으로 은폐되는" 시나리오가 이제 vitest 실패로 드러난다.
6. **데이터 유효성**: N/A (ESLint 설정/테스트 파일, 런타임 입력 검증 대상 아님).
7. **비즈니스 로직**: "src/lib 은 components 를 소비하지 않는다" 라는 레이어 규칙이 정적+동적 양쪽 경로에서 정확히 반영됨 (실측 확인).
8. **반환값**: `layeringErrors()` 는 항상 `Message[]` 를 반환 (빈 배열 포함), 모든 호출 경로에서 값 보장. 모든 `it.each` 케이스가 이 함수의 반환값 length 를 assert.
9. **spec fidelity**: 관련 전용 spec 문서 없음 (INFO, 선행 리뷰와 동일 — 신규 회귀 아님). 코드가 spec 을 위반하는 사례는 없음(애초에 규정한 spec 자체가 없음).

## 요약
이 커밋은 선행 ai-review 의 WARNING#1(동적 `import()`/`require()` 레이어 가드 우회)과 WARNING#2(negative-space 가드에 대한 회귀 테스트 부재)를 정확히 겨냥한 최소 변경이며, 실제 ESLint 실행(probe 파일)·vitest 실행(16/16 통과)·의도적 config mutation 재현 테스트 세 가지 방법으로 교차 검증한 결과 두 Warning 모두 실질적으로 해소됨을 확인했다. selector 정규식(`ImportExpression[source.value=...]`, `CallExpression[callee.name='require'][arguments.0.value=...]`)은 alias·상대경로(다단계) 리터럴 우회를 정확히 잡아내면서 무관한 import(zod, sonner, `../types/foo` 등)에는 오탐을 일으키지 않는 정밀한 경계를 그었다. 남은 갭(계산된 동적 경로 미탐지)은 코드 주석에 명시적으로 문서화된 의도적 잔여 한계이며, spec 문서 부재는 이 커밋 범위 밖의 선행 이슈로 신규 결함이 아니다. Critical/Warning 없음.

## 위험도
NONE
