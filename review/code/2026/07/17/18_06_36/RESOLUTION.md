# RESOLUTION — review/code/2026/07/17/18_06_36

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING #1 | 코드 | `a1e2ec8af` | `layeringErrors()` 위반 케이스 전건에서 실제 Linter 메시지 `severity===2` 검증 추가 + `mergedRules["no-restricted-imports"]`/`["no-restricted-syntax"]` 의 severity 가 `"error"` 인지 별도 assertion 추가. `"error"`→`"warn"` mutation 을 실측 재현해 신설 assertion 이 실패함을 확인(7건 fail) 후 원복. |
| INFO #4 | 코드 (저비용, 함께 처리 권장) | `a1e2ec8af` | negative fixture 에 근접 오탐 경계값 2건 추가 — `@/components-legacy/x` (정적 import), `../componentsShared/x` (require). 정규식이 매칭하지 않는 것이 정상 동작임을 "no error" 케이스로 고정. |
| INFO #5 | 코드 (선택, 저비용) | `a1e2ec8af` | `files: ["src/lib/**"]` 리터럴 문자열이 `eslint.config.mjs` 의 `files:` 표기와 정확히 일치해야 탐색됨을 명시하는 주석 1줄 추가. |
| INFO #6 | 코드 (선택, 저비용) | `a1e2ec8af` | fail-open 가드 throw 메시지를 "블록을 찾지 못했거나 병합된 규칙이 비어 있습니다"로 확장해 두 실패 조건을 모두 반영. |

## TEST 결과

- lint  : 통과 (`0 errors / 12 warnings`, baseline 유지)
- unit  : 통과 (backend 412 suites / 8226 tests, frontend 279 files / 5531 tests, packages 전건 — `eslint-layering-guard.test.ts` 23/23 포함). 최초 1회 backend `discord-signing.spec.ts` 가 jest-worker SIGSEGV 로 실패했으나 본 diff(frontend 전용)와 무관한 인프라 flake 로 확인 — 재실행 시 412/412 전건 통과.
- build : (unit 단계 tsc/vitest 통과 범위 내 확인, 별도 build 스테이지 미실행 — frontend-only 테스트 변경이라 `.claude/tools/run-test.sh unit` 통과로 충분)
- e2e   : 통과 (256 tests, Playwright chromium 포함 `e2e-test-full` 확인 — 로그에서 `playwright test` 실행 및 개별 `✓ [chromium] ...` 항목 실측). 로그: `_test_logs/e2e-20260717-182939.log`

## mutation 재검증 (증명)

- 신규 mutation (severity `"error"`→`"warn"`, `no-restricted-imports` 대상): 신설 assertion 2종(직접 severity 비교 + `layeringErrors()` 실제 메시지 severity) 이 각각 실패 확인 (`두 규칙 모두 severity...` 1건 + `위반으로 잡혀야 하는 형태` 6건, 총 7건 fail). mutation 원복 후 `git diff` 로 `eslint.config.mjs` 가 세션 시작 시점과 바이트 단위로 동일함을 `diff` 명령으로 확인.
- 기존 mutation 재확인 (선행 리뷰 WARNING #1·#2 해소분):
  - override 블록으로 두 규칙 `"off"` 화 (나중 블록 우선 미검증 시 fail-open): 15건 fail 재현.
  - `no-restricted-imports` 의 bare 엔트리(`"@/components"`, `"**/../components"`) 제거: 2건(bare import case) fail 재현.
  - `COMPONENTS_PATH_RE` 상수를 `NEVERMATCH_MUTATION_TEST` 로 약화(동적 import/require 경로 무력화): 8건 fail 재현.
- 매 mutation 실험 후 원본 파일로 복원, 최종 `git status --short` / `git diff --stat` 로 의도한 변경(2 files, 53 insertions, 14 deletions)만 남았음을 확인 후 커밋.

## 보류·후속 항목

- INFO #3(maintainability, glob/regex 이중 표현 크로스레퍼런스 주석), #7(selector 보간 예시 주석) — 저우선순위 선택 항목, 이번 diff 범위에서 defer (SUMMARY 권장 "필수 아님").
- INFO #8(`spec/conventions/frontend-layering.md` 신설) — 선행 리뷰(`review/code/2026/07/17/17_29_21/SUMMARY.md`) WARNING#4 로 이미 별도 트래킹 중, `project-planner` 위임 유효. 이번 diff 범위 밖.
- INFO #9(flat config `files`/`ignores` 매처 정밀도 미재현) — 현재 config 구조(단일 `files:["src/lib/**"]` 블록)에서는 문제 없음, 향후 override 블록 세분화 시 재검토.
- INFO #10(vite 캐시/공유 워크트리 동시 편집 기인 측정 아티팩트) — 환경 아티팩트, 코드 결함 아님, 조치 불요.
