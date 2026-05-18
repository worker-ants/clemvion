# 요구사항(Requirement) 리뷰

## 발견사항

### nodes-coverage.test.ts

- **[WARNING]** `collectNodeSchemaFiles` 는 `*.schema.ts` 파일의 존재만 확인하며 해당 노드 디렉토리에 schema 파일이 없는 경우(예: index.ts 만 있는 노드)는 조용히 누락됨
  - 위치: `nodes-coverage.test.ts` 라인 307–319 (`collectNodeSchemaFiles` 내부 `schemas` 필터)
  - 상세: 노드 디렉토리가 존재하더라도 `.schema.ts` 확장자 파일이 하나도 없으면 `out` 에 아무것도 추가되지 않아 해당 노드가 검사 대상에서 제외됨. 신규 노드를 `.schema.ts` 컨벤션 없이 추가하면 가드가 침묵함.
  - 제안: `schemas` 배열이 비어있는 노드 디렉토리를 별도 sanity 테스트("모든 노드 디렉토리에 schema 파일이 1개 이상 존재한다")로 검증하거나, `walkSchemaFiles` 와 동일하게 재귀 탐색으로 전환.

- **[WARNING]** `referencedAbsPaths` 를 `path.resolve(repoRoot, ref)` 로 구성하는데, frontmatter `code:` 값이 상대경로가 아닌 `codebase/backend/...` 형태의 레포 루트 기준 상대경로라고 가정함
  - 위치: `nodes-coverage.test.ts` 라인 333
  - 상세: `code:` 값 포맷이 절대경로로 시작하거나 `./` prefix 가 있는 경우 `path.resolve(repoRoot, ref)` 결과가 `schemaPath` 와 달라져 false-positive 가 발생할 수 있음. frontmatter 규약이 `codebase/...` 형태라는 것을 코드 어디에도 검증하지 않음.
  - 제안: 경로 정규화 전 `ref.startsWith("/")` 혹은 `ref.startsWith("./")` 케이스를 처리하는 guard 추가. 또는 test 상단 주석에 "frontmatter code: 는 레포 루트 기준 상대경로여야 한다"는 계약을 명시.

- **[INFO]** `describe.runIf(hasBackend && hasDocs)` 로 조건부 실행되는데, CI 환경에서 두 디렉토리 모두 없으면 테스트 suite 자체가 skip 되어 실패를 알 수 없음
  - 위치: 라인 322
  - 상세: 코드 변경 없이 directory 가 missing 인 경우 suite 가 pass(skipped) 로 보고됨. PROJECT.md 의 "자동 가드 (build-time 차단)" 의도와 충돌할 수 있음.
  - 제안: CI 환경(`process.env.CI`) 에서는 `hasBackend && hasDocs` 가 false 면 테스트를 skip 하는 대신 `expect(hasBackend).toBe(true)` 형태의 별도 명시적 에러 발행을 검토.

---

### backend-labels.test.ts

- **[WARNING]** `extractWarningMessages` 와 `extractNodeMetadataTopFields` 는 정적 텍스트 파싱(정규식 + depth 카운터)이므로, 문자열 값이 변수나 template literal로 선언된 경우 추출 불가
  - 위치: `backend-labels.test.ts` 라인 563–585 (`extractWarningMessages`), 라인 592–616 (`extractNodeMetadataTopFields`)
  - 상세: 예를 들어 `message: someConstant` 또는 `` message: `${prefix} must be set.` `` 형태면 정규식이 매칭하지 못함. 코드 주석(`validateConfig 의 imperative 반환은 정적 추출이 어려워 별도 가드로 분리`)에서 이 한계를 인지하고 있으나, 가드가 완전한 커버리지를 보장한다는 오해를 낳을 수 있음.
  - 제안: test 파일 상단에 "이 테스트는 정적 리터럴만 검출하며, 동적 문자열은 커버하지 않는다"는 제약을 명시. 또는 sanity 테스트에서 추출된 warning/label/description 개수에 하한 기댓값을 추가로 명시하여 파서 침묵(0건) 을 조기 탐지.

- **[WARNING]** `walkSchemaFiles` 는 `nodes/core/` 같은 공통 인프라 디렉토리를 포함하여 모든 `.schema.ts` 를 수집함. `nodes-coverage.test.ts` 의 `collectNodeSchemaFiles` 는 `core` 를 명시 제외하는데 두 함수의 수집 범위가 일치하지 않음
  - 위치: `backend-labels.test.ts` 라인 548–556 (`walkSchemaFiles`); `nodes-coverage.test.ts` 라인 299–319 (`collectNodeSchemaFiles`)
  - 상세: `nodes/core/` 에 `.schema.ts` 파일이 있다면 `backend-labels.test.ts` 는 그것도 검사 대상에 포함하고, `nodes-coverage.test.ts` 는 제외함. 두 테스트가 서로 다른 노드 집합에 대해 서로 다른 강제를 하게 됨.
  - 제안: 두 파일이 동일한 컬렉션 로직(또는 공유 헬퍼)을 사용하도록 통일. 최소한 `walkSchemaFiles` 에도 `core` 제외 조건을 추가.

- **[INFO]** `describe.runIf(hasBackend)` 조건만 있고, `backendNodesRoot` 가 존재하더라도 `schemaFiles` 가 0건이면 모든 `it` 이 trivially pass됨. sanity 테스트(`>= 10 개`)가 이를 부분 방어하지만 0–9 건일 때 실제 누락을 탐지하지 못함
  - 위치: 라인 730–732
  - 상세: 노드 수가 급격히 줄어드는 경우(예: 리팩토링으로 노드 디렉토리 구조 변경)에도 10건 미만이 되지 않는 한 sanity 실패가 없음.
  - 제안: sanity 임계값을 프로젝트의 실제 노드 수를 반영하여 더 높게 설정하거나, 기댓값을 baseline JSON 으로 관리.

---

### hardcoded-korean-ratchet.test.ts

- **[WARNING]** `writeBaseline` 함수 내에서 `fs.writeFileSync` 를 두 번 호출하는데, 첫 번째 호출이 JSON 주석(`// total: N`)을 포함한 파일을 쓰고 두 번째 호출이 그것을 덮어씀 — 이 패턴은 중간 파일 쓰기가 의미 없는 dead code
  - 위치: 라인 1411–1417 (`writeBaseline`)
  - 상세: 첫 번째 `writeFileSync` 는 주석을 포함한 invalid JSON 을 쓰고, 즉시 두 번째 호출로 덮어씀. 실질적으로 첫 번째 write 는 불필요. `// Re-write without inline total comment (JSON safety)` 주석이 의도를 설명하지만, 첫 번째 write 자체가 없어도 동일한 결과를 얻을 수 있음.
  - 제안: 첫 번째 `fs.writeFileSync` 와 ``JSON.stringify(data, null, 2) + `\n// total: ${total}\n`.replace(...)`` 부분 전체를 제거하고 두 번째 write 만 유지.

- **[WARNING]** `isExcluded` 에서 `lib/i18n/backend-labels.ts` 는 정확한 상대경로 매칭(`p === "lib/i18n/backend-labels.ts"`)으로 제외하는 반면, `__tests__` 디렉토리는 경로 포함 여부(`p.includes("/__tests__/")`)로 제외함 — 경로 구분자 일관성 문제로 Windows 환경에서는 `\\__tests__\\` 형태가 있을 수 있음
  - 위치: 라인 1303
  - 상세: 함수 첫 줄에서 `replace(/\\/g, "/")` 로 정규화하므로 실제로는 문제 없음. 그러나 `backend-labels.ts` 의 exact-match 도 `"lib/i18n/backend-labels.ts"` 여서, 만약 파일이 이동되거나 같은 이름의 다른 경로 파일이 생기면 의도치 않게 제외되거나 포함됨.
  - 제안: `lib/i18n/backend-labels.ts` 제외 조건도 `p.includes("/i18n/backend-labels.ts")` 형태로 경로 기반 매칭으로 통일.

- **[INFO]** `BASELINE_UPDATE=1` 모드일 때 `writeBaseline(counts)` 를 호출한 후 `return` 으로 이후 describe body 실행을 종료함. 이는 `describe` callback 내 top-level `return` 으로, vitest 에서 일반적으로 허용되지만 프레임워크에 따라 undefined behavior 가 될 수 있음
  - 위치: 라인 1423–1433
  - 상세: vitest 에서는 동작하지만, `describe` 콜백 안에서 `return` 으로 조기 종료하는 패턴은 비표준. 일부 버전에서 후속 `it` 들이 예측 불가능하게 동작할 수 있음.
  - 제안: `BASELINE_UPDATE=1` 분기를 `describe` 밖으로 분리하거나, 별도의 `describe("BASELINE_UPDATE mode", ...)` 블록으로 래핑하고 `describe.runIf(...)` 로 조건 제어.

---

### backend-labels.ts

- **[INFO]** `WARNING_KO`, `NODE_LABEL_KO`, `NODE_DESCRIPTION_KO` 를 `export` 로 변경한 것은 테스트 접근을 위한 목적에 부합함. 그러나 이 세 상수는 이전에 module-private 이었으므로 외부에서 직접 변경하거나 잘못 참조되는 경우를 방지하는 타입 제약이 없음
  - 위치: `backend-labels.ts` 라인 1507, 1527, 1536
  - 상세: `Record<string, string>` 타입으로 export 되므로 외부 코드가 이 객체를 직접 수정(`WARNING_KO["new key"] = ...`)하더라도 컴파일러가 막지 않음. 현재 코드에 직접 변형하는 소비자가 없다면 실질적 문제는 없음.
  - 제안: `as const` 또는 `Readonly<Record<string, string>>` 으로 타입을 강화해 의도치 않은 변형을 컴파일 단계에서 차단.

- **[INFO]** `pickKo` 함수가 매핑 미존재 시 원문 영문을 반환(`table[value] ?? value`)하는데, 이 "graceful fallback" 정책과 test 의 "모든 키가 매핑돼야 함" 정책이 의도적으로 공존함 — 문서화가 충분하여 의도와 구현이 일치함 (이슈 아님, 확인 목적)
  - 위치: `backend-labels.ts` 라인 2024–2030 (`pickKo`)
  - 상세: 런타임에는 영문 원문으로 fallback, 빌드 시 테스트로 매핑 완전성을 강제하는 이중 방어 구조. 설계 의도가 명확하고 구현이 일치함.
  - 제안: 없음.

---

### hardcoded-korean-baseline.json

- **[INFO]** baseline 파일이 `plan/complete/harness-i18n-userguide-gap.md` 에서 언급한 "baseline 초기 6 파일 32 라인"과 일치함 (6개 파일, 총 3+4+2+2+8+13=32 라인). 수치 정합성 확인됨
  - 위치: `hardcoded-korean-baseline.json` 전체
  - 상세: plan 문서와 실제 baseline 파일의 수치가 일치하여 요구사항과 구현 간 괴리 없음.
  - 제안: 없음.

---

### plan/complete/harness-i18n-userguide-gap.md

- **[INFO]** 계획 문서가 `plan/complete/` 에 위치하고 모든 후속 항목이 "DONE" 으로 표기됨. 그러나 frontmatter 의 `worktree: harness-i18n-userguide-cded87` 는 P0 worktree 이며 본 PR 의 worktree `i18n-guard-extension-a7b3c9` 와 다름 — P1+ 항목이 별도 worktree 에서 완료됐음에도 plan 문서가 원래 worktree 이름을 유지
  - 위치: `plan/complete/harness-i18n-userguide-gap.md` frontmatter
  - 상세: 기능적 문제는 아니나, `consistency-checker` 의 `plan_coherence` checker 가 plan frontmatter 의 worktree 와 실제 작업 worktree 간 연결을 검사할 때 혼란을 줄 수 있음. 완료된 plan 이므로 `plan/complete/` 로 이동된 이상 실질적 영향은 없음.
  - 제안: 완료 plan 이므로 그대로 유지 가능. 다음번 다중 worktree 에 걸쳐 완료되는 plan 작성 시에는 최종 worktree 이름을 frontmatter 에 반영하거나, 두 worktree 를 모두 명시하는 컨벤션 추가 검토.

---

### PROJECT.md

- **[INFO]** `e2e 면제 화이트리스트` 에 `codebase/frontend/src/lib/i18n/dict/**` 가 면제 항목으로 등록되어 있는데, `backend-labels.ts` 는 동일 경로(`src/lib/i18n/`) 에 있지만 면제 항목에 명시적으로 포함되지 않음. 이번 변경에서 `backend-labels.ts` 는 `export` 추가만 이루어졌으므로 현재는 e2e 대상이 됨
  - 위치: `PROJECT.md` 라인 106
  - 상세: `backend-labels.ts` 에 대한 변경(export 노출)은 런타임 동작 변경이 없는 export modifier 추가이므로 e2e 가 검증할 실질적 회귀가 없음. 그러나 화이트리스트 상으로는 면제되지 않으므로 developer 가 e2e 를 수행해야 한다는 부담이 발생.
  - 제안: `codebase/frontend/src/lib/i18n/` 의 순수 매핑 테이블 파일(`backend-labels.ts`)을 화이트리스트에 추가하는 것을 검토. 단, 이 결정은 PROJECT.md 를 PR 로 갱신 후 적용이 필요.

---

## 요약

전반적으로 이번 변경은 i18n 하네스의 요구사항(Principle 1, 3, 4)을 구체적인 자동 가드로 구현한다는 의도에 잘 부합한다. `backend-labels.test.ts` 의 정적 파싱 접근은 한계를 주석으로 인정하고 있으며 sanity 테스트로 부분 보완되어 있다. 주요 위험은 두 테스트 파일(`nodes-coverage.test.ts` 와 `backend-labels.test.ts`)에서 노드 수집 범위가 일치하지 않는 점, `writeBaseline` 내의 dead code 패턴, 그리고 schema 파일 없는 노드 디렉토리가 조용히 누락되는 엣지 케이스다. 이 중 실질적 회귀 위험은 낮으나, 수집 범위 불일치는 향후 `core/` 디렉토리에 schema 파일이 추가될 경우 두 테스트가 서로 다른 대상을 검증하는 비일관성을 낳을 수 있어 정리가 권장된다.

## 위험도

LOW
