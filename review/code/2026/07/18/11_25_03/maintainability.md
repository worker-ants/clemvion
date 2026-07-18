# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 테스트 파일에 "운영 로직"급 파서/비교 함수 10여 개가 모두 내장 — 파일 하나가 다중 책임
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 전체 (557줄)
  - 상세: `repoRoot`/`discoverPackages`/`collectPackages`/`workflowDepsOf`/`backendWorkflowDeps`/`internalPackages`/`fnBody`/`explicitFilterCalls`/`indentOf`/`isSkippable`/`blockRange`/`findKeyLine`/`listAtPath`/`packageDirsInPaths`/`missingFromStage` — bash 파싱, 커스텀 YAML 서브셋 파서, 패키지 발견, 비교 로직까지 서로 다른 관심사가 `__tests__/*.test.ts` 한 파일에 물려 있다. 여기에 "실제 저장소 상태" 검증 describe 블록과 "합성 fixture 회귀" describe 블록까지 더해져 파일이 매우 길고 훑어보기 어렵다.
  - 제안: 파일 주석이 밝힌 "스크립트로 분리하면 호출부가 또 하나의 손 유지 목록이 된다"는 우려는 **vitest 가 `.test.ts` 를 glob 자동 발견**한다는 점에서 오는 것이지, 파싱 로직 자체를 별도 모듈로 뽑는 것과는 무관하다. `repo-guards/internal-package-registration-guard.ts` 같은 순수 로직 모듈로 함수들을 옮기고, 이 `.test.ts` 는 그 모듈을 import 해 "실측 대조" + "합성 fixture 회귀"만 담당하게 하면 vitest 자동 발견 특성은 그대로 유지하면서 파일당 책임을 분리할 수 있다.

- **[INFO]** `fnBody` 의 정규식 동적 생성이 메타문자 이스케이프 없이 함수명을 보간
  - 위치: `internal-package-registration.test.ts:463` — `new RegExp(\`^${fn}\\(\\)\\s*\\{\\s*$\`, "m")`, `missingFromStage` 내부의 `` new RegExp(`_run_internal\\s+${script}\\b`) `` 도 동일 패턴
  - 상세: 현재 호출부는 전부 리터럴(`cmd_lint`/`cmd_unit`/`cmd_build`/`cmd_missing`, `"lint"`/`"test"`/`"build"`)이라 안전하지만, 정규식 메타문자를 포함한 값이 들어오면 조용히 오동작할 수 있는 일반적 패턴을 방어 없이 사용. 이 파일이 스스로 표방하는 "조용히 틀리느니 깨지게 만든다" 원칙과 다소 어긋나는 지점.
  - 제안: 우선순위 낮음(현재 입력이 전부 고정 리터럴). 재사용 확장 시 `escapeRegExp` 헬퍼 추가 권장.

- **[INFO]** 커스텀 YAML 서브셋 파서의 암묵적 스코프 한계
  - 위치: `indentOf`/`isSkippable`/`blockRange`/`findKeyLine`/`listAtPath` (`internal-package-registration.test.ts:513-556`)
  - 상세: flow-style 배열(`paths: [a, b]`)이나 block scalar(`>`, `|`) 등으로 `packages-checks.yml` 형식이 바뀌면 이 파서는 조용히 다른 결과(빈 리스트가 아니라 부분/오match 리스트)를 낼 수 있다. vacuity 단언은 "완전히 못 찾음(null/빈 배열)"만 잡고 "형식이 바뀌어 일부만 잘못 파싱"되는 경우는 방어하지 못한다.
  - 제안: 현재 스코프(3개 알려진 리스트 경로)에서는 실질 위험 낮음 — 파일 주석에 이미 "필요한 3개 목록이 전부 알려진 위치라 충분" 이라 스코프를 명시했으므로 문서화된 트레이드오프로 인정 가능. 향후 yml 구조가 복잡해지면 재검토 권장.

- **[INFO]** non-null assertion(`!`)이 vacuity 테스트에 의존
  - 위치: `listAtPath(yml, keys)!` (`:688`, `:698`), `list!.length` (`:1201`)
  - 상세: `vitest run` 은 타입을 strip 하므로 `!` 는 런타임에 아무 검사도 하지 않는다(파일 자신의 주석에도 명시). "vacuity 방지" describe 가 항상 먼저 통과한다는 전제 하에서만 이후 블록의 `!` 가 안전하다. `-t` 필터로 vacuity 블록만 스킵하고 다른 테스트를 실행하면 raw `TypeError`가 발생해 진단 메시지 없이 실패한다.
  - 제안: 영향 적음(스위트 전체 실행이 기본 경로). 필요 시 `listAtPath(...) ?? []` + 별도 명시적 `expect(...).not.toBeNull()` 인라인으로 대체 가능하나 현재 구조도 실용적으로 허용 가능한 수준.

## 요약

세 파일 중 `.claude/test-stages.sh`·`.github/workflows/packages-checks.yml` 변경은 주석 추가에 불과해 유지보수성 이슈가 없다. 핵심 검토 대상인 신규 `internal-package-registration.test.ts`(557줄)는 실제 drift 사고(#968)에 대응한 정교한 가드로, 함수 단위 분해(순수 함수 추출, 각 함수에 목적·전제·실패 모드를 밝히는 docstring, 합성 fixture 로 파서 자체의 회귀까지 고정)가 잘 되어 있고 이전 리뷰 라운드(WARNING/WARNING#2 반영 흔적)를 거친 성숙도가 보인다. 다만 파일 하나에 bash 파싱·커스텀 YAML 파싱·패키지 발견·비교 로직·실측 테스트·합성 fixture 테스트까지 전부 담겨 단일 파일 책임 범위가 넓고 길이가 상당하다는 점은 향후 탐색성·리뷰 부담 관점에서 개선 여지가 있다. 정규식 동적 생성의 이스케이프 부재나 non-null assertion 의존은 현재 입력 범위에서 실질 위험이 낮은 경미한 사항이다.

## 위험도

LOW
