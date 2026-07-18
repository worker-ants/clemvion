# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `internal-package-registration-guard.ts` 가 서로 다른 3개 파싱 도메인(bash 배열/함수
  본문 파싱, YAML 서브셋 파싱, 두 목록 간 diff 비교 로직)을 한 파일(304줄)에 담고 있다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts` 전체
    (특히 `// ─── test-stages.sh 파싱 ───` 섹션과 `// ─── packages-checks.yml 파싱 ───` 섹션)
  - 상세: 파일 헤더 주석 자체가 "단일 파일이 다중 책임을 지지 않도록 분리(리뷰 WARNING)" 라고
    적어 두었는데, 이는 테스트 파일(assertion)과의 분리만 가리키고, 정작 이 파일 내부에는
    "bash 파서(`internalPackages`/`fnBody`/`explicitFilterCalls`)"·"YAML-lite 파서
    (`blockRange`/`findKeyLine`/`listAtPath`/`packageDirsInPaths`)"·"패키지 집합 비교
    (`collectPackages`/`workflowDepsOf`/`expectedBackendSharedDirs`/`staleEntries`/`missingFromStage`)"
    세 도메인이 섞여 있다. 각 도메인은 서로 독립적으로 재사용/테스트될 수 있는 응집 단위다.
  - 제안: 도메인별 파일 분리(예: `bash-stage-parser.ts` / `yaml-lite.ts` / `package-drift.ts`)를
    고려. 다만 현재도 섹션 구분 주석과 함수 단위 JSDoc 이 충분히 명확해 즉시 강제할 정도는 아님 —
    다음에 이 가드를 확장할 때(예: 5번째 등록 목록 추가) 리팩터링을 검토할 것.

- **[INFO]** `fnBody` 의 정규식 생성이 함수명을 이스케이프 없이 보간한다.
  - 위치: `internal-package-registration-guard.ts:468` — `new RegExp(\`^${fn}\\(\\)\\s*\\{\\s*$\`, "m")`
  - 상세: `fn` 이 정규식 특수문자를 포함하면 오동작하지만, 현재 호출부는 `cmd_lint`/`cmd_unit`/
    `cmd_build` 리터럴로 고정돼 있어 실질 위험은 없다. 순수하게 향후 확장(다른 이름의 stage 함수
    추가) 시 재발 방지 관점의 낮은 우선순위 코멘트.
  - 제안: 필요시 `fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` 로 이스케이프. 현재는 조치 불필요.

- **[INFO]** `MAX_DEPTH = 12` (repoRoot 탐색 상한)는 매직 넘버지만 바로 옆에 근거 주석
  ("현재 실제 깊이의 약 1.7배 여유, 못 찾으면 throw")이 있어 임의성이 낮다. 감점 요인 아님 —
  이런 패턴(상수+근거 주석)을 팀 컨벤션으로 유지할 것을 권장.

- **[INFO]** 테스트 파일(`internal-package-registration.test.ts`, 404줄)이 단일 파일치고는
  길지만, `describe`/`it.each` 로 구조화돼 있고 "실측 대조" 섹션과 "합성 fixture 회귀" 섹션이
  주석으로 명확히 분리돼 있어 탐색성은 양호하다. 향후 항목이 더 늘면(5번째 등록 목록 등)
  분할을 고려.

- **[INFO]** 두 워크플로/스크립트 파일(`test-stages.sh`, `packages-checks.yml`)의 변경은
  헤더 주석 추가뿐이며 실행 로직 변경이 없다. 가독성·네이밍·복잡도 관점에서 지적사항 없음.
  다만 "가드 파일 경로를 주석에 하드코딩"(두 곳 모두 동일 상대 경로 문자열을 반복 기재)하는
  점은 파일 이동 시 두 곳 다 갱신해야 하는 손 유지 지점이지만, 코멘트 성격상 drift 시 즉시
  실패하는 코드가 아니라 문서 갱신 누락에 그치므로 위험도는 낮다.

## 요약

신규 가드(`internal-package-registration-guard.ts` + `.test.ts`)는 이 저장소의 기존 컨벤션
(근거 주석 우선, fs-분리 순수 코어, vacuity 방지 단언, 합성 fixture 회귀 고정)을 충실히 따르고
있고 네이밍도 목적이 명확하다(`repoRoot`, `discoverPackages`, `missingFromStage`,
`expectedBackendSharedDirs` 등). 각 함수는 단일 관심사를 가지며 길이·중첩도 과도하지 않다.
다만 guard 모듈 하나에 bash 파싱·YAML-lite 파싱·diff 비교 세 도메인이 공존해 파일 단위로 보면
책임이 여럿이라는 점, 그리고 정규식 기반 파서 특성상 정규식 하나하나의 의도를 주석으로 설명해야
가독성이 유지되는 구조(주석 없이는 이해하기 어려운 복잡도)라는 점이 향후 유지보수 부담으로
남는다. 다만 이는 저자가 이미 인지하고(휴리스틱 한계·경계 조건을 throw 로 명시) 문서화했기 때문에
당장 차단할 사안은 아니다. 나머지 두 설정 파일 변경은 주석 추가뿐으로 지적사항이 없다.

## 위험도

LOW
