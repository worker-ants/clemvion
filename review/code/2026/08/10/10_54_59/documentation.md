# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 새로 공개(export)된 `findKeyLine` 에 시그니처/계약을 설명하는 JSDoc 이 없음 — 형제 export 와 비대칭
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:67` (`export function findKeyLine(...)`)
  - 상세: 이 함수는 원래 `internal-package-registration-guard.ts` 안에서 `function findKeyLine(...)` (모듈-비공개, non-export) 였다. 이번 리팩터로 `_shared.ts` 로 이관되며 `export function` 이 됐고, `internal-package-registration-guard.ts` 에서 `export { ROOT, blockRange, findKeyLine, listAtPath, repoRoot };` 로 재export 되어 두 모듈의 공개 표면에 동시에 올라갔다. 그런데 바로 위·아래에 나란히 있는 형제 YAML 추출기 `blockRange`(`_shared.ts:60`, "`key:` 선언 줄의 자식 블록 범위 [from, to) …")와 `listAtPath`(`_shared.ts:84`, "예: listAtPath(lines, [...]). 미발견 시 null.")는 각각 한 줄 JSDoc 으로 파라미터 의미·반환값을 설명하는데, `findKeyLine` 은 리스트 항목을 건너뛴다는 지엽적 케이스에 대한 인라인 `//` 주석(76번 줄) 하나만 있고 `from`/`to` 범위 의미나 "미발견 시 -1" 같은 반환 계약을 설명하는 상단 문서가 없다. 가시성이 넓어진 시점(모듈-비공개 → 2개 모듈에서 공개)에 문서화 수준은 그대로 남아 형제들과 비일관적이다.
  - 제안: `blockRange`/`listAtPath` 와 같은 형식으로 한 줄 JSDoc 추가. 예: `/** [from, to) 구간에서 `key:` 선언 줄의 인덱스를 찾는다. 리스트 항목(`- `)은 건너뛴다. 미발견 시 -1. */`

- **[INFO]** `internal-package-registration-guard.ts` 최상단 모듈 헤더가 파서 이관을 반영하지 않음(다만 import 지점에는 별도 설명 있음)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:4-6` (모듈 헤더, "본 모듈은 그 가드가 쓰는 파서 (bash / YAML 서브셋)와 비교 로직만 담는다")
  - 상세: 이 서술은 여전히 기능적으로는 참이다(재export 를 통해 소비처 계약은 유지된다). 다만 `blockRange`/`findKeyLine`/`listAtPath` 세 심볼의 **실제 정의**는 이제 `_shared.ts` 에 있고, 이 파일은 그것을 재export 만 한다. 이 사실은 import 구문 바로 위(38-41번 줄, "루트 탐색·YAML 서브셋 추출기는 형제 가드도 쓰므로 `_shared.ts` 가 소유한다…")에는 정확히 설명돼 있지만, 최상단 모듈 헤더만 훑는 독자는 "이 파일 안에 파서가 산다"고 오해할 수 있다. 크리티컬하지는 않음 — 파일을 끝까지 읽으면 바로 정정된다.
  - 제안: (선택) 최상단 헤더에 한 문장 추가: "루트 탐색·YAML 서브셋 추출 프리미티브는 `_shared.ts` 소유이며 이 파일은 소비처 호환을 위해 재export 한다." 우선순위는 낮음.

## 검증한 항목 (문제 없음)

- **`typescript-toolchain-guard.ts` JSDoc 수정** (`missingCompilerApi` 의 "이 경로" 모호성 정정, 47-52번 줄): 코드·테스트와 정확히 일치하도록 정정됐고, 이번 diff 자체가 "오래된/모호한 주석" 을 고치는 변경이라 문서화 관점에서 개선.
- **`loadTypescriptFrom` 반환 타입 변경 관련 주석** (203-206번 줄, `/** */` JSDoc 블록과 함수 사이에 별도 `//` 설명 블록 삽입): tsc 로 실측(`--declaration --emitDeclarationOnly`) 한 결과 `.d.ts` 방출 시 바로 위 `/** */` 블록이 여전히 함수의 JSDoc 으로 정상 첨부됨을 확인했다 — 툴링상 실질적 손상 없음.
- **`_shared.ts` 헤더의 tsc/vitest exclude 주장** (13-15번 줄, "`src/**/__tests__/**` exclude", "vitest include 는 `*.{test,spec}.ts` 뿐"): `codebase/frontend/tsconfig.json` 의 `exclude: ["src/**/__tests__/**", ...]` 와 `vitest.config.ts` 의 `include: ["src/**/*.{test,spec}.{ts,tsx}"]` 로 실측 대조해 정확함을 확인.
- **`repoRoot()` 의 `MAX_DEPTH = 12` 주석** ("현재 실제 깊이 7단계의 약 1.7배"): 실제 파일 경로(`codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts`) 기준으로 `repoRoot` 의 탐색 루프를 손으로 추적해 7회 반복(i=0..6)에 워크스페이스 루트를 찾음을 확인 — 서술과 일치, 정밀하고 정확한 주석.
- **`plan/in-progress/typescript-toolchain-followups.md` 의 실측 표** (typescript/`@types/node` 선언 수·range 값): `grep` 으로 저장소 전체 `package.json` 을 대조해 typescript 10건(range `^5`·`^5.7.3`), `@types/node` 4건(range `^20.0.0`·`^24`) 모두 표와 일치함을 확인. 체크리스트(§1·§2·§4 완료, §3 미착수, `/ai-review` 미완)도 본문 서술·실제 diff 내용과 일관됨(체크박스-본문 동기화 이상 없음).
- **README/API 문서/환경변수 문서**: 이 변경은 내부 test-guard 리팩터(공유 프리미티브 추출, fail-closed 순수 함수 분리, 타입 정리)로 사용자 대면 기능·API·환경변수·설정 옵션이 없다 — README/API 문서/설정 문서 업데이트 불요.
- **CHANGELOG.md**: 저장소 `CHANGELOG.md` 는 제품/보안/사용자 대면 변경 이력만 다루는 것으로 보이며(현재 Unreleased 항목이 워크스페이스 권한 보안 수정), 이번 변경은 `spec_impact: none` 인 내부 테스트 인프라 리팩터라 CHANGELOG 항목 불요. plan 문서(`typescript-toolchain-followups.md`)의 "2026-08-10 실측" 절 + 체크리스트가 이 변경의 이력 기록 역할을 충분히 수행.
- **예제 코드**: 각 순수 함수(`validateWorkspacePatterns`, `blockScalarAtPath`, `explicitFilterCalls` 등)에 합성 fixture 테스트가 사용례를 겸하고 있어 별도 사용 예제 불요.

## 요약

전반적으로 문서화 품질이 높다. 새 모듈 `_shared.ts` 의 소유권 이전 근거, `validateWorkspacePatterns`/`discoverWorkspaceDirs` 의 fail-closed 분리 이유, 반환 타입 변경 근거가 모두 "왜" 를 상세히 설명하는 주석으로 뒷받침되고, 여러 수치·기술 주장(디렉터리 탐색 깊이, tsconfig/vitest exclude 패턴, 매니페스트 버전 분포)을 직접 실측 대조한 결과 전부 정확했다. 유일한 실질적 갭은 `findKeyLine` 이 모듈-비공개에서 2개 모듈의 공개 표면으로 승격됐는데도 형제 함수들과 달리 JSDoc 이 없다는 점으로, 영향은 작다(INFO). CHANGELOG·README·API 문서·설정 문서는 이 변경의 성격(내부 test-guard 리팩터, `spec_impact: none`)상 업데이트가 필요하지 않다.

## 위험도

LOW
