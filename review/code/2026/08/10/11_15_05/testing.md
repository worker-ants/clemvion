# 테스트(Testing) Review — typescript-toolchain-followups (§1·§2·§4)

## 발견사항

- **[INFO]** `repoRoot()` 기본 인자 경로의 "실측 스모크" 단언이 얕다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/shared.test.ts:72-78` (`it("기본 인자로 부르면 이 저장소의 실제 루트를 찾는다", …)`)
  - 상세: 이 테스트는 `path.isAbsolute(root)`와 `root.length > 1`만 단언한다. 두 단언은 "찾은 디렉터리에 실제로 `pnpm-workspace.yaml`이 존재하는가"를 검증하지 않는다 — `repoRoot`가 marker 를 못 찾고도(혹은 엉뚱한 조기 지점에서) 어떤 절대경로 문자열을 반환하는 회귀가 들어와도 이 두 조건만으로는 못 걸러낼 여지가 있다. `ROOT` 는 두 가드 공용 기반이라 조용히 틀리면 파급이 가장 크다고 파일 헤더가 직접 명시하는 만큼, 이 마지막 실측 테스트가 가장 강한 방어선이어야 한다.
  - 제안: `expect(fs.existsSync(path.join(root, "pnpm-workspace.yaml"))).toBe(true)` 를 추가해 "marker 를 실제로 포함하는 디렉터리"임을 직접 확인. (다른 스위트들이 `TEST_STAGES`/`PACKAGES_CHECKS`/`WORKSPACE_YAML` 파일 존재로 간접적으로 이 사실을 검증하고 있어 현재도 위험은 낮지만, 이 파일 자신의 테스트로 닫아 두는 편이 `_shared.ts` 소유 원칙과 더 부합한다.)

- **[INFO]** `_shared.ts` 의 `blockRange`/`findKeyLine` 은 직접 import 해 단위 테스트하는 파일이 없다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:72-100` (`export function blockRange`, `export function findKeyLine`)
  - 상세: 두 함수는 공개(export) 되어 있지만, 어느 테스트 파일도 `./_shared` 에서 이 둘을 직접 import 하지 않는다. 현재는 `listAtPath`/`blockScalarAtPath` 조합 함수의 두터운 fixture 테스트(중첩 키, 형제 키 혼동, 없는 경로, 인라인 주석 등)를 통해 간접적으로 충분히 커버되므로 실질적 위험은 낮다. 다만 `_shared.ts` 자체가 "두 가드의 공용 기반" 으로 명명되어 있어, 향후 세 번째 소비자가 `blockRange`/`findKeyLine` 만 단독으로 쓰게 되면 그 경계 조건(예: `keyIdx` 가 `lines` 마지막 줄인 경우, 빈 `lines` 배열)은 여전히 조합 함수 뒤에 가려진 채로 남는다.
  - 제안: 필수는 아니나, 두 헬퍼에 대한 최소 직접 케이스(간단한 `blockRange`/`findKeyLine` 단위 테스트)를 `_shared.ts` 자신의 테스트 파일에 추가하면 소유권 이관 취지와 더 정합적이다.

## 확인한 강점 (참고용, 조치 불요)

- `repoRoot(startDir, exists)` 주입점 신설로 종전에 `__dirname` 하드코딩 때문에 **테스트 불가능**했던 fail-closed throw 분기를 합성 입력으로 정밀 타격한다: marker 즉시 발견·최근접 marker 우선·미발견 시 throw(메시지에 시작 경로 포함까지 확인)·파일시스템 루트 도달 시 조기 종료(`calls < MAX_ROOT_SEARCH_DEPTH`)·상한 도달 시 정확히 `MAX_ROOT_SEARCH_DEPTH` 회 호출 후 throw. 다섯 케이스 모두 `calls` 카운터로 반복 횟수까지 단언해 off-by-one 회귀까지 잡는 구조다.
- `validateWorkspacePatterns` 분리 + `discoverWorkspaceDirs 가 실제로 그 검증을 태운다` 호출부 테스트(`typescript-toolchain.test.ts`)는 이 저장소가 반복 지적해 온 "헬퍼 테스트 ≠ 호출부 테스트" 갭을 정확히 닫는다 — `readLines` 주입을 통해 `null`/`[]` 두 실패 형태 모두가 실제 `discoverWorkspaceDirs` 경로에서 throw 로 이어지는지 별도로 검증한다.
- `internal-package-registration.test.ts` 에 추가된 "인라인 주석을 항목에서 떼어낸다" 테스트는 뮤테이션 실측으로 발견한 실제 커버리지 공백(주석 제거 로직이 삭제돼도 기존 스위트가 초록이었던 축)을 닫는다 — 정규식 동작(따옴표 유/무 두 형태 모두)까지 검증해 vacuous 하지 않다.
- 새 테스트들은 전부 순수 함수 + 클로저 기반 fixture/의존성 주입만 쓰고 `vi.mock` 등 mocking 프레임워크에 기대지 않는다 — 실제 동작과의 괴리 위험이 낮고 격리도 자연히 보장된다(각 `it` 가 로컬 상수만 사용, 테스트 간 공유 mutable 상태 없음).
- `_shared.ts` 로의 리팩터는 `repoRoot`/`listAtPath`/`blockRange`/`findKeyLine` 로직을 문자 그대로 이동한 것으로 diff 상 확인되며(신규 로직 없음), 형제 가드는 재export 로 기존 소비처 계약을 유지해 회귀 위험이 낮다. `discoverWorkspaceDirs`/`repoRoot` 는 `codebase/frontend/src` 내에서 `__tests__/` 밖의 다른 소비처가 없음을 실측 확인했다(grep 0건) — 시그니처 변경(옵션 인자 추가)이 조용히 깨뜨릴 외부 호출부가 없다.

## 요약

`_shared.ts` 신설(공유 프리미티브 이관)과 `validateWorkspacePatterns`/`repoRoot` 의 의존성 주입화는 순수 리팩터+테스트 강화 성격의 변경으로, 기존 로직을 그대로 옮기고 그 위에 정밀한 합성 fixture 테스트를 새로 붙인 형태다. 특히 종전에 `__dirname` 하드코딩·실제 I/O 결합으로 인해 "테스트 불가능"했던 두 fail-closed 분기(`repoRoot`, `discoverWorkspaceDirs`)를 주입점 개방으로 실제 테스트 가능하게 만들고, 그 직후 곧바로 경계값·호출부 테스트를 채운 점이 이 변경의 핵심 가치다. 뮤테이션 실측으로 발견한 실제 커버리지 공백(listAtPath 인라인 주석 축)도 함께 닫았다. 남은 갭은 두 건 모두 INFO 수준(부재가 아니라 방어선이 한 겹 얇은 정도)이며, 기존 테스트는 재export/문자 그대로 이동 덕에 그대로 유효하다.

## 위험도

LOW
