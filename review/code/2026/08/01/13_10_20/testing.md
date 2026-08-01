### 발견사항

- **[INFO]** 직전 리뷰 라운드(12:27:15)의 Testing WARNING #2("unicorn peer 재발을 막을 자동 회귀 가드 부재")가 이번 diff 에서 정확히 그 형태로 해소됐다. 독립적으로 재검증함: `npx jest eslint-unicorn-peer.spec.ts` 실행 결과 **28/28 통과**(12.3s, 실제 `eslint` CLI 서브프로세스 3회 포함) — 문서상 주장이 아니라 직접 실행으로 확인. 구조도 견고하다: 순수 로직(`parseGteFloor`/`parseCaretFloor`/`parseVersion`/`compareTriple`/`satisfiesFloor`)을 `eslint-unicorn-peer-guard.ts` 로 분리하고 소비 spec 과 나눈 설계는 frontend 형제 가드(`codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts` + `.test.ts`)와 실제로 동일 패턴임을 확인했다(허위 주장 아님). mock 대신 실제 `eslint` CLI 서브프로세스 + 실제 설치된 `node_modules`/`package.json` 실측을 쓰는 선택도 근거가 명확하다(flat config ESM 을 Jest VM 이 동적 import 못 하는 제약을 헤더 주석에서 실측 근거로 설명) — 이 사고 클래스(선언 floor vs 실제 peer 불일치)는 mock 으로는 애초에 재현 불가능한 종류라 mock 회피가 올바른 판단이다. `toHaveLength(1)`/`not.toBeNull()` 형태의 vacuity 방지 단언이 곳곳에 명시적으로 배치되어 있고, 직전 라운드 RESOLUTION.md 가 독립된 3종 뮤턴트(룰 off, backend eslint floor 하향, 원복)로 RED→GREEN 을 실측 문서화해 non-vacuous 임을 뒷받침한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` (전체), `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts` (전체)
  - 상세: 조치 불요 — 참고용 긍정 관찰.
  - 제안: 없음.

- **[INFO]** `satisfiesFloor` 의 경계값(설치 버전이 floor 와 **정확히 같을 때** `true`)이 직접 단위 테스트로 단언되지 않는다. `compareTriple([9,18,0],[9,18,0])` 이 `0` 을 반환하는 테스트(`toBe(0)`)는 있지만, 그 값을 `satisfiesFloor` 에 넣어 `true` 를 확인하는 케이스는 없다 — `satisfiesFloor` 는 `compareTriple(...) >= 0` 한 줄짜리 위임이라 실질 위험은 낮지만, "이상(>=)" 의미론의 경계는 별도 함수 계약이므로 그 함수 자체에 대한 직접 커버리지가 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts:39-45` (`satisfiesFloor` 정의), `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts:264-271` (`compareTriple / satisfiesFloor (합성)` describe 블록)
  - 상세: 낮은 위험도 — 함수가 자명한 1-line 위임이고, 위임 대상(`compareTriple`)의 등가 케이스는 이미 커버됨.
  - 제안: `expect(satisfiesFloor([9,18,0], [9,18,0])).toBe(true)` 한 줄을 같은 describe 블록에 추가하면 함수 자체의 경계 계약이 문서화된다(선택적 개선).

- **[INFO]** `parseGteFloor`/`parseCaretFloor`/`parseVersion` 의 `it.each` 거부 케이스 표에 registry 가 실제로 낼 수 없는 형태(leading zero, 음수, 과대 숫자 등)는 포함되지 않는다. 다만 이 파서들의 실제 입력원은 npm registry 의 semver 준수 `package.json` 필드(`peerDependencies.eslint`, `devDependencies.eslint`, `eslint/package.json`.`version`)뿐이라 malformed 입력이 실제로 발생할 표면이 거의 없어 실질 위험은 낮다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts:217-262` (`parseGteFloor`/`parseCaretFloor`/`parseVersion` describe 블록들)
  - 상세: 낮은 위험도 — 입력원이 신뢰 가능한 registry 메타데이터로 한정됨.
  - 제안: 조치 불요(선택 시 `it.each` 표에 `-1.2.3`, `09.5.0` 등 1~2개 케이스 추가 가능).

- **[INFO]** `unicorn/catch-error-name` 실발화 3케이스(`describe('unicorn/catch-error-name 이 실제로 발화한다...')`)는 매 `it` 마다 실제 `eslint` CLI 를 서브프로세스로 기동한다(typescript-eslint `projectService` 콜드 스타트 포함) — 로컬 실측으로 파일 전체 12.3s, 이 3케이스가 대부분을 차지할 것으로 보인다(나머지 25 케이스는 순수 함수 합성 테스트라 즉시 완료). backend jest 스위트가 400+ suites 규모(plan 문서 기준 413 suites/8389 tests)로 이미 크다는 점을 고려하면, 이런 서브프로세스 기반 테스트가 늘어날수록 unit 실행 시간에 누적 영향을 줄 수 있다. 다만 이 설계는 flat config(ESM) 를 Jest VM 이 `--experimental-vm-modules` 없이 동적 import 하지 못하는 실측된 제약을 우회하기 위한 의도적 선택으로 헤더에 근거가 명시되어 있어, mock 화보다 정확성을 택한 합리적 트레이드오프다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts:73-97` (`lintFixtureText`/`unicornMessages`), `:105-152` (발화 3케이스 describe 블록)
  - 상세: 조치 불요 — 정확성을 우선한 의도적 설계, 실측 근거 명시됨.
  - 제안: 없음(참고: 향후 이런 서브프로세스형 가드가 늘어나면 별도 jest project/태그로 분리해 실행 시간을 가시화하는 것을 고려할 수 있음).

- **[INFO]** (범위 밖, 추적됨) 이 새 jest spec 이 상시 게이트로 작동하려면 실제로 `pnpm --filter backend test` 가 실행되는 경로(로컬 harness `run-test.sh` 또는 향후 재활성화될 GH Actions)에 의존한다 — `pnpm install` 자체는 unmet peer 를 경고로만 흘리고 실패시키지 않는다(`--strict-peer-dependencies` 미도입). 이는 plan 문서의 "후속 검토" 절에 이미 명시적으로 인지·차단 사유(기존 `nunjucks→chokidar` 미충족 peer 선결 필요)와 함께 defer 되어 있어 이번 PR 이 새로 만든 갭이 아니다.
  - 위치: `plan/in-progress/eslint-unicorn-peer-restore.md` "후속 검토" 절(dependabot.yml diff 뒤 신규 파일의 111~114줄 부근)
  - 상세: 조치 불요 — 이미 추적·근거 기록됨.
  - 제안: 없음.

### 요약

이번 diff 의 테스트 관점 핵심은 직전 리뷰 라운드에서 지적된 "unicorn peer 재발 방지 자동 가드 부재"(Testing WARNING #2)가 `eslint-unicorn-peer.spec.ts`(+ 순수 로직 분리 `eslint-unicorn-peer-guard.ts`, 앵커 fixture)로 실제로 해소됐다는 점이다. 직접 실행(`npx jest eslint-unicorn-peer.spec.ts` → 28/28 통과, 실 서브프로세스 포함)으로 문서상 주장을 재검증했고, mock 을 의도적으로 배제한 채 실제 `eslint` CLI + 실제 설치된 패키지 메타데이터를 실측하는 설계는 이 사고 클래스(선언 floor vs 실제 peer 불일치)를 mock 으로는 재현 불가능하다는 점에서 타당하다. 순수 파서/비교 로직과 소비 spec 의 분리, 명시적 vacuity 방지 단언, 3종 독립 뮤턴트 검증(직전 라운드 RESOLUTION.md 기록)까지 갖춰 테스트 용이성·격리·회귀 방지 관점에서 모범적이다. 남은 항목은 전부 INFO 수준 — `satisfiesFloor` 경계값 직접 테스트 부재, 파서의 극단적 malformed 입력 미커버(입력원이 registry 로 한정돼 실위험 낮음), 서브프로세스형 테스트의 실행 시간 누적 가능성, 그리고 `pnpm install` 자체가 unmet peer 를 실패로 취급하지 않는 이미 추적된 후속 과제뿐이다. 신규 애플리케이션 코드 변경이 없는 devDependency/CI 설정 revert 라는 PR 성격을 고려하면 테스트 커버리지는 충분하다.

### 위험도
LOW
