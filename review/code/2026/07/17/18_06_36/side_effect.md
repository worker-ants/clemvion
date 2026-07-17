# 부작용(Side Effect) 리뷰 — eslint.config.mjs 정규식 중복 제거 + 테스트 강화

## 발견사항

- **[INFO]** `eslint.config.mjs` 정규식 리팩터는 순수 동등 치환 — 실측으로 동일성 확인
  - 위치: `codebase/frontend/eslint.config.mjs:6, 48, 56`
  - 상세: 신규 `const COMPONENTS_PATH_RE = String.raw\`...\`;` 는 module-scope `const` 로,
    `globalThis`/`global` 오염이 아니다. 두 `no-restricted-syntax` selector 에 문자열 템플릿으로
    보간되는데, 이전 코드는 동일 정규식 원문을 두 곳에 **개별 하드코딩**(일반 문자열 리터럴,
    `\\` 이중 이스케이프)한 것이었고 신규 코드는 `String.raw` (단일 백슬래시 원문) 를 일반
    템플릿 리터럴에 보간한다. 두 표현이 JS 파싱 후 만들어내는 런타임 문자열을 직접 비교했다 —
    바이트 단위로 동일함을 확인했다 (`^(@\/components(\/.*)?|(\.\.\/)+components(\/.*)?)$`).
    추가로 `npx eslint .` 를 변경 후 상태에서 재실행해 `0 errors / 12 warnings` 를 재확인해
    (프롬프트에 명시된 baseline 과 일치) 회귀가 없음을 실측 검증했다. `eslint.config.mjs` 는
    전체 프론트엔드 lint 게이트이므로 이 파일의 변경은 원리적으로 "전역 side effect" 범주지만,
    본 변경은 **행동 보존적 리팩터**(중복 제거로 향후 drift 위험을 줄이는 방향)임을 확인했다.
  - 제안: 없음 (조치 불요, 참고용 검증 기록).

- **[INFO]** 테스트 파일의 `.find()` → `.filter()`+병합 전환은 프로덕션 코드에 영향 없음, 원본 `eslintConfig` 배열/객체를 mutate 하지 않음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:19-25`
  - 상세: `Object.assign({}, ...layeringBlocks.map((c) => c.rules ?? {}))` 는 **새 객체**를
    생성해 반환하며, import 된 `eslintConfig` 모듈의 라이브 바인딩이나 그 안의 `rules` 객체를
    직접 수정하지 않는다. 따라서 동일 프로세스 내에서 이 config 를 재사용하는 다른 코드(실제
    ESLint 실행 등)에 대한 오염 위험은 없다. `.find()` → `.filter()` 전환 자체는 테스트 내부
    검증 로직 변경으로, `src/lib/**` 를 매칭하는 블록이 현재 config 파일에 1개뿐임을 확인했다
    (`grep`) — 즉 현재는 동작 차이가 없고, 향후 동일 `files` 패턴의 override 블록이 추가될
    때의 fail-open 을 막기 위한 방어적 강화다.
  - 제안: 없음.

- **[INFO]** 모듈 최상위 `throw` 가드의 조건식이 더 엄격해짐 — 부작용 성격은 기존과 동일(모듈 로드 시 throw)이나 커버리지가 넓어짐
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:25`
  - 상세: 기존 `if (!layeringBlock?.rules)` 는 `rules` 가 `{}` (빈 객체) 여도 truthy 라 통과했을
    잠재적 허점이 있었다(이 diff 이전부터 존재하던 성질이며 이번 diff 가 만든 회귀는 아니다).
    신규 `if (Object.keys(mergedRules).length === 0)` 는 그 케이스도 정확히 잡는다. import 시점에
    throw 하는 부작용 자체(모듈 로드 실패 시 테스트 스위트 전체가 즉시 죽는 성질)는 변경 전과
    동일하다 — 트리거 조건만 더 정확해졌다.
  - 제안: 없음.

- **[INFO]** 로컬 실측 중 `eslint-layering-guard.test.ts` 단독 실행에서 1회 4건 플레이키 실패 관찰 — 재현 불가, diff 내용과 무관한 것으로 판단
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (bare-path 4개 케이스)
  - 상세: 첫 단독 실행(`npx vitest run .../eslint-layering-guard.test.ts`)에서 신규 추가된 bare
    경로(`import "@/components";` 등) 4개 케이스가 `expected 0 to be greater than 0` 로 실패했다.
    동일 assertion 을 순수 Node 스크립트로 재현하면 통과했고, `-t "bare"` 로 해당 4개만 필터링해
    실행해도 통과했으며, 이후 전체 파일을 11회 연속 재실행(단독 8회 + 반복 3회)해도 20/20 통과
    — 재현되지 않았다. Vitest/Vite 의 module transform 캐시가 편집 직후 첫 로드에서 구버전을
    잠깐 물고 있었을 가능성이 높은 **측정 아티팩트**로 판단한다(과거 유사 사례: 공유 worktree
    동시 편집 시 간헐 실패 — 이번엔 단일 세션·연속 실행이라 그 패턴과는 다르지만 동일하게
    diff 코드 자체의 결함이 아니라 로컬 환경/캐시 기인일 가능성이 크다). Side-effect 관점의
    코드 결함은 아니나, CI 최초 실행에서 유사 플레이크가 재발하면 misleading 할 수 있어
    참고로 남긴다. 재발 시 vitest 캐시 클리어 후 재현 여부부터 확인 권장.
  - 제안: 이번 diff 를 이유로 한 조치는 불요. 향후 CI 에서 이 테스트 파일이 최초 1회만
    실패하고 재실행 시 통과하는 패턴이 관측되면 vite transform 캐시 문제로 우선 의심할 것.

## 검토했으나 해당 없음

- **전역 변수 도입**: `COMPONENTS_PATH_RE` 는 ESM module-scope `const` (파일 스코프), `globalThis` 오염 없음.
- **함수/메서드 시그니처 변경**: 두 파일 모두 export 되는 함수 시그니처 변경 없음 (`eslint.config.mjs` 의 `export default eslintConfig` 형태 동일, 배열 element shape 동일).
- **공개 API 변경**: `eslint.config.mjs` 의 소비자(ESLint CLI, 테스트의 직접 import)에게 노출되는 구조(배열 of flat-config object)는 변경 없음. 규칙 옵션 값도 실측상 동일.
- **파일시스템 부작용**: 두 파일 모두 런타임에 파일을 생성·삭제하지 않음. `Linter#verify` 는 순수 in-memory 검사.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 없음.
- **이벤트/콜백**: 없음 (ESLint `no-restricted-syntax`/`no-restricted-imports` 의 selector·메시지는 정적 데이터일 뿐, 콜백 발동 방식 자체는 변경 없음).

## 요약

이번 diff 는 `eslint.config.mjs` 에서 중복된 정규식 리터럴 두 곳을 `String.raw` 기반 공유 상수로 통합하고, 대응 테스트를 "첫 매칭 블록만 검증"에서 "매칭되는 모든 블록을 flat-config 병합 순서대로 합쳐 검증"하도록 강화하며 bare-path fixture 를 추가한 변경이다. 정규식 리팩터는 JS 파싱 후 런타임 문자열이 이전과 바이트 단위로 동일함을 직접 검증했고, `npx eslint .` 재실행으로 `0 errors / 12 warnings` 를 재확인해 프론트엔드 전역 lint 게이트에 회귀가 없음을 실측 확인했다. 테스트 파일 변경은 import 된 `eslintConfig` 를 mutate 하지 않고 새 객체만 파생시키며, 모듈 로드 시 throw 하는 fail-open 가드의 트리거 조건만 더 정확해졌다 — 둘 다 프로덕션 코드나 외부 인터페이스에 미치는 부작용은 없다. 전역 변수 도입·시그니처/인터페이스 변경·파일시스템/네트워크/환경변수 부작용은 발견되지 않았다. 다만 로컬 실측 중 신규 테스트 케이스가 최초 1회 플레이키하게 실패했다가 11회 연속 재실행에서 재현되지 않은 현상을 관찰했는데, diff 코드 자체의 결함이라기보다 로컬 vite transform 캐시 아티팩트로 판단되며 side-effect 등급을 좌우하지 않는다.

## 위험도

NONE
