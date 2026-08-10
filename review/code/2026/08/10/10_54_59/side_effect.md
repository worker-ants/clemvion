# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** 모듈 top-level 부작용(`repoRoot()` 동기 파일시스템 워크)의 소유권 이전
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:40` (`export const ROOT = repoRoot();`)
  - 상세: `ROOT` 는 모듈 로드 시점에 `fs.existsSync` 로 최대 12단계까지 상위 디렉터리를 동기 탐색하고, 못 찾으면 throw 하는 부작용을 가진 top-level 상수다. 리팩터 전에는 이 계산이 `internal-package-registration-guard.ts` 에 있었고 `typescript-toolchain-guard.ts` 는 그 값을 import 해서 재사용했다(diff 의 구 import `from "./internal-package-registration-guard"` 로 확인). 즉 이미 단일 모듈 인스턴스로 공유되던 계산이라 **실행 횟수·실패 조건 자체는 변하지 않는다** — 소유 모듈만 `_shared.ts` 로 옮겨졌다. 다만 지금은 두 가드가 이 모듈을 각자 정적 import 하므로, 앞으로 `_shared.ts` 를 import 하는 세 번째 소비처가 생기면 그 모듈 로드만으로 동일한 fs 탐색+throw 가능성을 조용히 상속받는다는 점은 인지해 둘 만하다.
  - 제안: 별도 조치 불필요(동작 불변). 다만 신규 소비처 추가 시 이 top-level 부작용을 인지시키는 주석은 이미 파일 헤더에 있으므로 충분.

- **[INFO]** `discoverWorkspaceDirs` 시그니처 변경 — 하위호환 유지되나 새 진입점 도입
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:140-143`
  - 상세: 기존 `discoverWorkspaceDirs(): string[]` (인자 없음) → `discoverWorkspaceDirs(readLines: () => string[] = () => fs.readFileSync(WORKSPACE_YAML, "utf8").split("\n")): string[]`. 기본값이 있어 기존 무인자 호출부(`typescript-toolchain.test.ts:47` 의 실측 호출 등)는 그대로 동작하므로 **하위호환 파괴는 없다**. 의도된 테스트 seam 추가(합성 입력으로 `validateWorkspacePatterns` 호출부 검증)로, 부작용이 새로 생긴 것은 아니고 오히려 기본 경로의 실제 fs 읽기 부작용이 명시적으로 드러났다.
  - 제안: 없음. 정상적인 dependency-injection 패턴.

- **[INFO]** `validateWorkspacePatterns` 신규 public 함수의 에러 메시지가 다른 함수명을 지시
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:121-129`
  - 상세: 새로 분리된 `export function validateWorkspacePatterns(...)` 의 throw 메시지가 여전히 `"discoverWorkspaceDirs: pnpm-workspace.yaml 의 packages: 목록을 읽지 못했다"` 로, 호출부(`discoverWorkspaceDirs`) 이름을 하드코딩하고 있다. 이 함수는 이제 `typescript-toolchain.test.ts` 에서 `discoverWorkspaceDirs` 를 거치지 않고 직접 호출되기도 한다(합성 fixture). 순수하게는 side effect 가 아니라 메시지 정확성 이슈이지만, "에러 메시지가 호출자를 안다"는 결합은 향후 `validateWorkspacePatterns` 를 제3의 호출부에서 쓸 때 오해를 유발할 여지가 있어 참고로 남긴다.
  - 제안: 필요 시 메시지를 함수 자체 관점("packages: 목록을 읽지 못했다")으로 일반화. 이번 스코프의 차단 사유는 아님.

- **[INFO]** `loadTypescriptFrom` 반환 타입 변경(`unknown | null` → `unknown`)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:207`
  - 상세: TypeScript 상 `unknown | null` 은 `unknown` 과 동치이므로 컴파일타임 소비자 영향이 없고, 런타임 반환값(미설치 시 `null`)도 그대로다. 순수 타입 표기 정리이며 실질적 인터페이스 변경이 아니다.
  - 제안: 없음.

## 요약

이번 변경은 두 repo-guard 모듈(`internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`)이 공유하던 `ROOT`/`listAtPath` 등 파서 프리미티브를 중립 모듈 `_shared.ts` 로 옮기고, `internal-package-registration-guard.ts` 는 기존 소비처(`internal-package-registration.test.ts`)의 import 계약을 깨지 않도록 동일 심볼을 재export 하는 형태다. `ROOT` 계산의 top-level fs 부작용은 이미 리팩터 전부터 두 모듈이 공유하던 단일 인스턴스였고 옮긴 후에도 실행 횟수·실패조건이 그대로이므로 새로운 부작용이 아니다. `discoverWorkspaceDirs` 의 시그니처 확장(선택적 `readLines` 주입)과 `loadTypescriptFrom` 의 반환 타입 정리는 모두 하위호환을 유지한다. 프로덕션 코드에 새로운 전역 변수·환경 변수 읽기/쓰기·네트워크 호출·이벤트/콜백 변경은 없으며, 파일시스템 접근은 기존과 동일하게 읽기 전용이다. `plan/in-progress/typescript-toolchain-followups.md` 변경은 문서 갱신으로 부작용 범주 밖이다. 전반적으로 부작용 관점에서 위험 요소는 발견되지 않았고, 남은 항목은 메시지 문구 수준의 INFO 뿐이다.

## 위험도

LOW
