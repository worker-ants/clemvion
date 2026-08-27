# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** CI 트리거 스코프 확대 — `spec-link-integrity` job 이 더 많은 PR 에서 실행됨
  - 위치: `.github/workflows/spec-link-checks.yml:57` (게이트 57~61, `pathspecs` 블록에 `:(glob)*.md`·`.claude/**` 추가)
  - 상세: `on.pull_request`/`push` 자체에는 `paths:` 필터가 없지만(의도적 — required status check 데드락 회피, 파일 상단 주석), 실질 게이팅은 `_changed-paths.yml` 이 계산하는 `changes.outputs.relevant` 로 이뤄진다. 이번 PR 이 그 `pathspecs` 목록에 `.claude/**`(확장자 무관, 전 파일)와 `:(glob)*.md`(루트 md)를 추가해, 종전에는 이 job 을 트리거하지 않던 `.claude/**` 하위 비-md 변경(hooks·scripts·tests 등)에도 `spec-link-integrity` vitest 가 이제 부수적으로 함께 돈다. 코드 자체 버그는 아니며 워크플로 헤더 주석·`RESOLUTION.md`(INFO 1)에 "이 저장소가 겪은 트리거 갭 재발 방지가 의도"라고 명시돼 있고, job 은 vitest 단일 파일이라 가볍다 — 다만 트리거 대상이 넓어지는 것은 다른 팀원의 무관한 PR CI 실행 빈도에 영향을 주는 실질적인 이벤트/트리거 부작용이므로 기록해 둔다.
  - 제안: 조치 불필요(의도적, 이미 리뷰·수용됨). 향후 CI 비용이 문제되면 `.claude/**/*.md` 로 좁히는 선택지가 있음.

- **[INFO]** `scripts/check-doc-links.py` 삭제 — 잔존 참조 확인
  - 위치: `scripts/check-doc-links.py` (파일 삭제, `PROJECT.md` §문서 링크 검증에서 대체 서술)
  - 상세: 저장소 전체를 grep 한 결과 이 스크립트를 실제로 호출하는 CI workflow·hook·Makefile 타깃은 없음(삭제 전에도 미배선 상태였다는 PR 주장과 일치). 남은 참조는 전부 `plan/`·`review/` 아래의 과거 기록(히스토리 문서)뿐이라 죽은 참조로 인한 실행 경로 breakage 없음.
  - 제안: 조치 불필요.

- **[INFO]** 신규 vitest 스위트가 OS 임시 디렉터리에 fixture 를 쓰고 지운다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` — `describe("governance scope — 제외 규칙", ...)` 블록의 `beforeAll`/`afterAll` (`fs.mkdtempSync(path.join(os.tmpdir(), "gov-scope-"))` 생성, `fs.rmSync(fixture, { recursive: true, force: true })` 정리), 그리고 "[양성] 스코프 안의 깨진 링크는 DEAD 로 검출된다" 테스트 내부의 `try/finally` 로 감싼 `BROKEN.md` 생성/삭제.
  - 상세: 저장소 트리 밖(`os.tmpdir()`) 에서만 쓰고 `mkdtempSync` 로 유일한 디렉터리명을 받으므로 다른 프로세스·병렬 테스트와 충돌하지 않고, `afterAll`/`finally` 로 정리되어 리포에 잔존 파일을 남기지 않는다. 프로세스가 `beforeAll` 이후 `afterAll` 전에 강제 종료되면(SIGKILL 등) 임시 디렉터리가 남을 수 있으나 CI 러너는 매번 폐기되는 환경이라 실질 누적 위험은 낮다.
  - 제안: 조치 불필요(표준 테스트 격리 패턴, 위험 낮음).

- **[INFO]** 공유 함수 `filter_covers_file` 의 동작 변경 — 시그니처는 동일, 새 입력(`:(glob)` 접두)에 한해 동작 추가
  - 위치: `.claude/tests/test_harness_checks_paths_coverage.py` — `filter_covers_file(filt, path)` (게이트 212~224, `_GIT_GLOB_MAGIC` 스트립 로직 추가)
  - 상세: 이 함수는 `test_harness_checks_paths_coverage.py` 자신뿐 아니라 `test_required_check_skip_jobs.py` 도 import 해 재사용한다(공유 유틸리티). 파라미터/반환 타입은 그대로이고, `:(glob)` 로 시작하는 필터에 한해서만 새 동작(접두 제거 후 판정)이 추가돼 기존 호출자(비-`:(glob)` 필터)의 결과에는 영향이 없다. 로컬 실행으로 `test_harness_checks_paths_coverage`·`test_ci_paths_changed`·`test_required_check_skip_jobs` 3개 모듈 63 테스트 전부 PASS 확인 — 회귀 없음.
  - 제안: 조치 불필요.

- **[INFO]** `spec-links.ts` 공개 인터페이스 확장 (추가적, 파괴적 변경 아님)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `export function collectGovernanceMarkdown`(게이트 300), `export function findBrokenGovernanceLinks`(게이트 324) 신규 export.
  - 상세: 기존 export(`findBrokenLinks`, `collectSpecMarkdown` 등)는 시그니처·동작 변경 없이 그대로이며, 신규 함수 2개만 추가됐다. 현재 소비처는 `spec-link-integrity.test.ts` 하나뿐이라(grep 확인) 다른 모듈에 예기치 않은 파급 없음. `walkTree`(read-only fs 순회, 기존 공유 유틸)를 그대로 재사용해 새 순회 로직을 도입하지 않았다.
  - 제안: 조치 불필요.

## 요약

이 변경분은 (1) 기존 문서 링크 오타 2건 수정, (2) `:(glob)` pathspec 매직의 실행 계층 회귀 테스트 보강(Python 2개 파일), (3) `spec-link-checks.yml` CI 트리거 pathspec 확대, (4) 신규 "거버넌스 문서" 링크 검증 스코프(`collectGovernanceMarkdown`/`findBrokenGovernanceLinks`) 추가, (5) 미배선 상태였던 `scripts/check-doc-links.py` 삭제, (6) 관련 spec/plan 문서 갱신으로 구성된다. 전역 상태 변경·환경변수 조작·의도치 않은 네트워크 호출은 없고, 기존 공개 함수의 시그니처 변경도 없다. 실질적인 부작용은 CI job 트리거 스코프가 `.claude/**`(확장자 무관)까지 넓어져 다른 PR 의 CI 실행 빈도가 늘어나는 것과, 신규 vitest 스위트가 OS 임시 디렉터리에 fixture 를 쓰고 정리하는 것 두 가지인데 둘 다 의도적이고 문서화됐으며 실측(vitest 19/19, Python 63/63 전부 PASS)으로 회귀 없음을 확인했다. 삭제된 스크립트의 잔존 참조도 리포 전체 grep 으로 실행 경로에 없음을 검증했다.

## 위험도
LOW
