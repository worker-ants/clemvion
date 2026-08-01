# 유지보수성(Maintainability) Review

대상: TypeScript 7.0.2 → 5.x 롤백 + dependabot major-ignore + 회귀 가드 신설 (15 files, PR 미생성 / `5b7d60b97`, `39c8a9875`).

## 발견사항

- **[INFO]** 매니페스트 판독(`existsSync` 가드 + `readFileSync(utf8)` + `JSON.parse`) 3줄 패턴이 형제 가드 모듈 간 소폭 중복
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:137-141` (`readManifestAt`) 과 `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:82-86` (`discoverPackages` 내부 클로저)
  - 상세: 신규 파일의 모듈 헤더 주석(`typescript-toolchain-guard.ts:7-9`)은 "같은 저장소에서 같은 일을 하는 파서를 두 벌 두면 드리프트가 생긴다"는 근거로 `ROOT`·`listAtPath` 를 형제 모듈에서 명시적으로 재사용했다. 그런데 정확히 같은 문제 유형인 "package.json 존재 확인 후 파싱" 3줄은 두 파일에 각각 인라인으로 남아 있다. 반환 형태(`readManifestAt`은 전체 manifest, `discoverPackages`의 클로저는 `.name` 필드만)와 base 디렉터리(`ROOT` vs `PACKAGES_DIR`)가 달라 지금 당장 통합해야 할 만큼 심각하지는 않다.
  - 제안: 시급하지 않음. 세 번째 소비처가 생기면 `readJsonIfExists<T>(file: string): T | null` 같은 공용 헬퍼로 추출 검토.

- **[INFO]** `loadTypescriptFrom` 반환 타입의 `unknown | null` 유니온이 TypeScript 상 `unknown` 과 동치
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:169` (`export function loadTypescriptFrom(dir: string): unknown | null`)
  - 상세: `null` 은 이미 `unknown` 의 부분집합이므로 `unknown | null` 은 컴파일러 입장에서 `unknown` 과 완전히 동일하다. 실질적 타입 안전성 손실은 없으나, 같은 파일의 다른 함수들(`parseMajor(): number | null`, `readManifestAt(): PackageManifest | null` 등)이 "구체 타입 | null" 형태로 null 분기를 실질적으로 좁혀주는 것과 나란히 보면 이 함수만 형식은 같지만 의미가 없는 유니온이라 약간의 혼동 여지가 있다.
  - 제안: `: unknown` 으로 단순화하거나 현행 유지(무해하므로 선택 사항).

- **[INFO]** 동일 인시던트 서사(TS7 compiler API 소실 → nest build·sdk prepare 실패)가 3개 문서에 각각 전체 서술로 중복
  - 위치: `.github/dependabot.yml:48-71` (ignore 주석), `plan/in-progress/typescript-7-rollback.md:13-74` (`## Overview` + `## 실측한 원인`), `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts:15-43` (파일 헤더 주석)
  - 상세: 세 곳 모두 "TS7 이 Go 네이티브 재작성판이라 JS compiler API 를 `typescript/unstable/*` 로 옮겼다 → backend `nest build` 실패 / frontend `sdk prepare` 실패" 를 각자 완결된 문단으로 반복 서술한다. 이 저장소의 기존 관행(사용 지점마다 자기완결적 "왜" 주석을 남기는 것, 형제 가드 `internal-package-registration.test.ts` 도 동일 패턴)과 일치하고 각 문서의 독자·목적이 달라(설정 파일 경고 / 작업 이력 / 테스트 배경) 의도적인 트레이드오프로 보인다. 다만 세 곳 모두 사람이 손으로 유지하는 텍스트라, 추후 원인 분석이 정정되면(예: 특정 소비자 목록이 바뀌면) 세 곳을 동시에 고쳐야 하는 drift 위험이 있다.
  - 제안: 즉각 조치 불필요. 원인 서술이 바뀔 경우 세 위치를 동시 갱신할 것만 유념.

## 요약

이번 변경은 긴급 빌드 복구(의존성 버전 10건 되돌리기 + lockfile 재생성)와 재발 방지 장치(dependabot major ignore, 신규 회귀 가드 2파일)로 구성되며, 유지보수성 관점에서 전반적으로 우수하다. 신규 가드 모듈(`typescript-toolchain-guard.ts`/`.test.ts`)은 기존 형제 가드(`internal-package-registration-guard.ts`/`.test.ts`)의 구조(순수 로직 모듈 + 실측 대조·합성 fixture 분리 테스트), 네이밍 컨벤션(SCREAMING_SNAKE_CASE 상수, 서술적 camelCase 함수명), fail-closed 에러 처리 스타일을 정확히 따르며 실제로 `ROOT`·`listAtPath` 파서를 재사용해 코드 중복을 피했다. 모든 함수가 짧고(최대 20줄 내외) 중첩이 얕으며(1~2단계) 순환 복잡도가 낮고, 매직 넘버 없이 각 함수에 "왜" 를 설명하는 JSDoc 이 붙어 있다. `dependabot.yml` 의 긴 주석 블록도 파일 내 기존 항목들과 동일한 길이·스타일이라 일관적이다. 발견된 문제는 전부 INFO 수준의 사소한 중복/문서 drift 가능성뿐이며 즉시 조치가 필요한 사항은 없다.

## 위험도

LOW
