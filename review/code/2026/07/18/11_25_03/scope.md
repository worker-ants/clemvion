# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 신규 디렉터리 `codebase/frontend/src/lib/repo-guards/__tests__/` 는 이번 작업이 처음 만든 위치(사전 관례 없음)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`
  - 상세: 기존 유사 가드(레이어 가드·interaction-type 레지스트리 가드 등)는 ESLint 룰이나 `src/lib/conversation/__tests__/` 등 도메인 폴더에 있는 반면, 이번 파일은 리포 메타(`.claude/test-stages.sh`, `.github/workflows/*.yml`) 를 검사하는 테스트를 frontend 도메인 `src/lib` 트리 밑에 새 `repo-guards` 폴더로 신설했다. 다만 이는 파일 헤더·커밋 메시지에 "실제로 도는 유일한 로컬 게이트가 `pnpm --filter frontend test` 이기 때문" 이라는 근거가 명시돼 있어 임의 확장이 아니라 이번 작업 자체의 핵심 설계 결정이다. 스코프 위반이라기보다 향후 유사 "리포 메타 가드"가 늘어날 경우 이 폴더가 그 관례의 첫 사례가 된다는 점만 기록.
  - 제안: 조치 불요(설계 근거가 충분). 향후 두 번째 리포 메타 가드가 추가되면 이 위치를 관례로 굳힐지 재검토 권장.

- **[INFO]** 3개 커밋에 걸쳐 테스트 파일이 71→310→446→557줄로 누적 성장
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` (commit `7a4c69959` → `86de33a32` → `e210032c8`)
  - 상세: 각 증분은 자체 확장이 아니라 직전 `/ai-review` 라운드의 명시적 WARNING(파서 self-check 비대칭, true-positive 미고정, fs 코어 분리 미비)에 대한 대응으로, 커밋 메시지가 W#1/W#2 등으로 대응 관계를 명확히 밝히고 있다. 합성 fixture(`describe("파서·비교 로직 회귀 가드 (합성 fixture)")`)가 "가드 자신의 파서·비교 로직 회귀"를 고정하는 메타-테스트라 일반적인 "이 정도 규모의 drift 가드에 필요한 테스트량"보다는 무겁지만, 반복된 review-fix 사이클의 산물이지 요청 밖 기능 추가가 아니다.
  - 제안: 조치 불요. 스코프 크리프가 아니라 프로젝트 규약(§구현 완료 후 자동 review/fix 상시 의무)에 따른 반복 수렴.

## 점검 결과 요약

- **의도 이상의 변경**: 없음. `git diff origin/main...HEAD --stat` 기준 3개 파일만 변경(`test-stages.sh` +5줄, `packages-checks.yml` +6줄, 신규 테스트 파일 +557줄) — 커밋 메시지·PR 제목("내부 패키지 등록 목록 4곳 ↔ 실제 패키지 집합 drift 가드")과 정확히 일치.
- **불필요한 리팩토링**: 없음. 기존 로직(`_run_internal`, `INTERNAL_PACKAGES`, workflow matrix 등)은 전혀 건드리지 않았고 주석만 추가.
- **기능 확장(over-engineering)**: 테스트 파일 내 합성 fixture 확장은 위 INFO 참고 — 모두 선행 리뷰 WARNING 대응이며 자발적 확장 아님.
- **무관한 수정**: 없음. 3개 파일 모두 "등록 목록 4곳 drift 가드"라는 단일 주제로 수렴.
- **포맷팅 변경**: 없음. `test-stages.sh`·`packages-checks.yml` diff 는 순수 주석 추가(+5/+6줄)이고 기존 라인은 무변경.
- **주석 변경**: `test-stages.sh`·`packages-checks.yml` 에 추가된 주석은 신규 가드 파일 경로를 교차 참조하는 목적성 주석이며, 기존 주석 삭제/수정 없음.
- **임포트 변경**: 신규 파일의 `vitest`/`node:fs`/`node:path` import 전부 실사용. 기존 파일에 임포트 변경 없음.
- **설정 변경**: `packages-checks.yml` 은 `on.pull_request.paths`/`on.push.paths`/`strategy.matrix.pkg` 등 실질 CI 동작을 바꾸지 않고 주석만 추가 — 의도치 않은 CI 트리거·매트릭스 변경 없음.

## 요약

세 커밋(`7a4c69959`→`86de33a32`→`e210032c8`) 모두 "내부 공유 패키지 등록 목록 4곳 ↔ 실제 패키지 집합 drift 가드"라는 단일 스코프 안에 있으며, `git diff origin/main...HEAD` 기준 변경 파일도 3개(가드 신설 테스트 + 그 존재를 알리는 주석 2곳)로 PR 의도와 정확히 일치한다. 후속 두 커밋은 자발적 확장이 아니라 직전 `/ai-review` WARNING 에 대한 대응이며 커밋 메시지가 그 대응관계를 명시한다. 포맷팅·임포트·설정의 의미 없는 변경, 무관한 파일 수정은 발견되지 않았다. 유일한 관찰 포인트는 신규 `repo-guards` 디렉터리 위치와 메타-테스트 규모인데 둘 다 파일 내 근거가 충분해 스코프 위반으로 보지 않는다.

## 위험도
NONE
