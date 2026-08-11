# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** 하위호환용 재export 가 이 리팩터의 목적(무관한 표면과의 결합 제거)을 완전히 닫지 않고 우회 경로로 남는다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:38-42` (`export { ROOT, blockRange, findKeyLine, listAtPath, repoRoot };` / `export type { PackageManifest };`, 및 그 직전 `_shared` import 블록 `:29-36`)
  - 상세: 이번 변경의 핵심 동기는 `typescript-toolchain-guard.ts` 가 `ROOT`/`listAtPath`/`PackageManifest` 세 심볼만 필요한데 무관한 도메인 모듈의 **전체 export 표면**(패키지 발견·bash 파서·워크플로 매트릭스 대조 등)에 얹혀 있던 결합을 끊는 것이었다. `_shared.ts` 로 소유권을 옮긴 것 자체는 옳지만, `internal-package-registration-guard.ts` 가 그 심볼들을 그대로 재export 해 "공개 창구"를 유지한다. 기존 소비처(`internal-package-registration.test.ts`)를 한 번에 갈아엎지 않으려는 의도된 절충으로 코드에 문서화돼 있어 현재는 합리적이지만, 이 창구가 남아 있는 한 향후 세 번째 소비자가 `_shared.ts` 대신 이 재export 를 통해 다시 들어올 수 있고, 그러면 이 PR 이 고치려던 "무관한 표면에 얹혀가는 결합" 패턴이 재발할 씨앗이 된다.
  - 제안: 재export 에 "새 소비자는 `_shared.ts` 에서 직접 import 할 것"이라는 명시적 deprecation 주석을 달거나, `internal-package-registration.test.ts` 의 import 를 `_shared.ts` 직접 참조로 옮겨 재export 를 완전히 걷어내는 후속 항목을 plan 에 남긴다.

- **[INFO]** `_shared.ts` 가 이미 두 이질적 책임(경로 탐색 vs. YAML 파싱)을 한 파일에 담고 있어, 자기 자신이 명문화한 "잡동사니 금지" 기준을 다음 확장 시점에 다시 검증해야 한다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:25-38`(`repoRoot`/`ROOT` — 파일시스템 루트 마커 탐색) 및 `:56-104`(`blockRange`/`findKeyLine`/`listAtPath` — YAML 서브셋 파서)
  - 상세: 파일 헤더(`:17-19`)가 "여기 두는 기준: 두 가드가 *실제로* 공유하는 것만. '언젠가 공유할지도' 로 끌어오면 이 모듈이 두 번째 잡동사니가 된다"고 스스로 경계선을 명문화한 점은 좋은 설계 규율이다. 다만 현재도 이미 성격이 다른 두 축 — 파일시스템 인프라(워크스페이스 루트 탐색)와 문자열 파싱 로직(YAML 서브셋 추출) — 이 한 모듈에 공존한다. 지금은 두 소비자(`internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`) 모두 둘 다 필요로 하기 때문에 문제가 표면화하지 않지만, 세 번째 소비처가 둘 중 하나만 필요로 하며 등장하면 이 모듈도 예전 문제(무관한 표면에 얹혀가는 결합)를 재현할 수 있다.
  - 제안: 지금 분리를 강제할 필요는 없으나, 다음에 `_shared.ts` 에 심볼을 추가할 때 "루트 탐색"과 "YAML 파싱" 두 축이 독립적으로 갈릴 조짐이 보이면 `_workspace-root.ts` / `_yaml-subset.ts` 로 물리적 분할을 검토할 것을 plan 에 남겨 둘 만하다.

- **[INFO]** 공유 파서(`listAtPath`)의 유일한 합성 fixture 회귀 테스트가 소유 모듈(`_shared.ts`)이 아니라 한 소비자의 테스트 스위트 안에만 존재한다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:338-351` (신규 "인라인 주석을 항목에서 떼어낸다" 케이스, 대상은 `_shared.ts` 소유의 `listAtPath`)
  - 상세: `_shared.ts` 헤더(`:3-7`)가 `listAtPath` 등의 소유권이 이제 그 모듈에 있다고 명시하는데, 그 동작을 겨냥하는 유일한 합성 입력 테스트는 여전히 `internal-package-registration.test.ts` 안에 있다. `_shared.ts` 는 `__tests__/**` tsc exclude + vitest `*.test.ts` include 조합 덕에 독자적 테스트 파일(`_shared.test.ts`)을 둘 수 있는 위치인데도 두지 않았다. 두 소비자 모두 같은 `listAtPath` 를 실측·fixture 로 두들기고 있어 현재 실질 위험은 낮지만, 소유 모듈과 검증 위치가 어긋나 있으면 "이 함수가 진짜 누구 책임인가"를 코드 배치만으로는 판단하기 어려워진다.
  - 제안: 필수는 아니나, `_shared.ts` 전용 `_shared.test.ts` 를 신설해 공유 파서 회귀를 독립적으로 고정하면 세 번째 소비자가 늘어날 때도 소유권과 검증 위치가 일치한다.

## 요약

이번 diff 는 `typescript-toolchain-guard.ts` 가 무관한 도메인 모듈(`internal-package-registration-guard.ts`)의 전체 export 표면에 결합돼 있던 문제를 중립 모듈 `_shared.ts` 추출로 해소한 리팩터다. "실제로 공유하는 것만" 이라는 추출 기준을 코드 헤더에 직접 명문화해 과잉 추상화(speculative sharing)를 스스로 경계했고, `validateWorkspacePatterns` 를 순수 함수로 분리하면서 `readLines` 주입까지 더해 fail-closed 분기와 그 호출부 배선을 모두 합성 입력으로 겨냥 가능하게 만든 것은 같은 파일의 기존 DI 관례(`expandWorkspaceGlobs(readDir)`, `typescriptDecls(readManifest)`)를 그대로 따른 일관된 설계다. 순환 의존성은 없고(`_shared.ts` 는 어느 쪽 가드도 import 하지 않음), 레이어 경계(파서/비교 순수 로직 vs. 실측 대조 vs. 합성 fixture 회귀)도 기존 규약대로 유지된다. SRP·DIP 개선이 뚜렷한 정상적인 "shared kernel 추출" 리팩터이며, 남은 소음은 하위호환용 재export 창구가 결합 재발 경로를 완전히 닫지 못한 점과 `_shared.ts` 자신의 응집도가 다음 확장 시점에 다시 검증돼야 한다는 점 정도로, 전부 INFO 수준이고 구조적 결함은 없다.

## 위험도

LOW
