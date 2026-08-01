# 부작용(Side Effect) 리뷰 결과

## 대상 변경 개요

dependabot PR #1047 이 `typescript` 를 `5.9.3` → `7.0.2` 로 올려 Jenkins main 빌드가 깨진 사고를
복구하는 변경. (1) 10개 워크스페이스 `package.json` 의 `typescript` 를 `^7.0.2`/`^7` → `^5.7.3`/`^5`
로 복원, (2) `pnpm-lock.yaml` 재생성(전량 typescript 7 관련 optionalDependencies·transitive 해석
제거), (3) `.github/dependabot.yml` 에 typescript major 무시 규칙 추가, (4) 회귀 방지용 순수 로직
가드(`typescript-toolchain-guard.ts`) + 실측·합성 테스트(`typescript-toolchain.test.ts`) 신설,
(5) `plan/in-progress/typescript-7-rollback.md` 작업 기록. `origin/main...HEAD` diff stat 으로
프롬프트에 제시된 15개 파일이 실제 변경분 전체와 일치함을 확인했다(빠진 파일 없음).

## 발견사항

- **[INFO]** `loadTypescriptFrom()` 이 테스트 실행 중 실제 `typescript` 패키지를 동적으로 `require()` 하여 서드파티 코드를 프로세스에 로드·실행시킨다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:169-176` (`loadTypescriptFrom`)
  - 상세: `createRequire(...).resolve("typescript")` 후 `require()` 로 각 워크스페이스가 실제로 해소하는 `typescript` 모듈을 로드한다. `@nestjs/cli` 의 `TypeScriptBinaryLoader` 와 동일한 방식으로 실제 소비자 행태를 재현하려는 의도된 설계이며(주석에 명시), `typescript` 는 툴체인 전반이 이미 신뢰하고 로드하는 패키지라 실질 위험은 낮다. 다만 `try { … } catch { return null; }` 가 "모듈 not-found"뿐 아니라 로드 중 임의 런타임 예외까지 전부 삼켜 `null`(=미설치와 동일 취급)로 눙긴다 — `typescript` 자체가 로드 시점에 예외를 던지는 손상 상태가 되면 이 가드는 그 워크스페이스를 조용히 "설치 스코프 밖"으로 건너뛴다(라인 954의 vacuity 가드가 `loaded.length > 0` 을 요구하므로 **전부** 그런 상태가 아닌 한 완전 무력화는 아님).
  - 제안: 별도 조치 불필요. fail-closed 정도를 더 높이려면 `catch (e)` 에서 `MODULE_NOT_FOUND` 코드만 `null` 로 취급하고 그 외는 재throw 하는 선택지가 있으나, 이는 이번 롤백 PR 의 스코프(빌드 복구) 밖 개선 항목이다.

- **[INFO]** 워크스페이스 실측 파일시스템 I/O 가 `it()` 이 아닌 `describe()` 본문에서 즉시(테스트 수집 시점) 실행된다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts:45-47` (`describe("typescript 툴체인 계약 가드 (실측)", () => { const dirs = discoverWorkspaceDirs(); const decls = typescriptDecls(dirs, readManifestAt); ...`)
  - 상세: `discoverWorkspaceDirs()`(`pnpm-workspace.yaml` 읽기 + 각 글롭 디렉터리 `readdirSync`)와 `typescriptDecls()`(각 워크스페이스 `package.json` 읽기)가 개별 `it()` 안이 아니라 `describe()` 콜백 본문에서 동기 실행된다. Vitest 는 이를 "수집" 단계에서 즉시 평가하므로 이 테스트 파일이 로드되는 순간 무조건 실제 파일시스템 읽기가 발생한다(러너가 이후 개별 테스트를 필터링해도 이미 실행된 뒤). 전부 read-only 이고, 형제 가드 `internal-package-registration.test.ts` 와 동일한 기존 패턴이므로 위험은 낮다.
  - 제안: 별도 조치 불필요 — 저장소의 기존 가드 관례와 일관됨.

- **[정보 확인 — 이상 없음]** `dependabot.yml` 의 신규 `ignore` 규칙 스코프
  - 위치: `.github/dependabot.yml:47-73` (세 번째 `package-ecosystem: "npm"`, `directory: "/"` 블록 내부)
  - 상세: 신규 `ignore:` 블록의 인덴테이션을 직접 대조한 결과, 루트 pnpm 워크스페이스 `npm` 항목에만 중첩되어 있고 같은 파일의 `github-actions` 항목(1-8행)이나 `.claude/tools/mermaid-lint` 전용 `npm` 항목(19-22행)에는 영향이 없다. 즉 "typescript major 자동 PR 생성 이벤트를 막는다"는 이번 변경의 의도된 부작용이 스코프 밖으로 새지 않았다.

## 그 외 점검 결과 (문제 없음)

- **의도치 않은 상태 변경 / 전역 변수**: 신규 파일(`typescript-toolchain-guard.ts`)의 module-scope export(`WORKSPACE_YAML`, `REQUIRED_COMPILER_API`)는 상수이며 다른 모듈에서 재할당하지 않는다. 기존 공유 모듈 `internal-package-registration-guard.ts`(`ROOT`/`listAtPath`/`PackageManifest` 재사용처)는 이번 diff 에 포함되어 있지 않음을 `git diff --stat` 로 확인 — 재사용은 순수 import 이며 그 모듈 자체를 수정하지 않는다.
- **파일시스템 부작용**: 신규 가드·테스트 코드에 `writeFile`/`unlink`/`mkdir`/`rmdir`/`appendFile` 계열 호출이 전혀 없음을 grep 으로 확인 — 전부 read-only(`readFileSync`/`readdirSync`/`existsSync`). `pnpm-lock.yaml` 갱신은 `pnpm install` 산출물(빌드 도구 자체의 의도된 동작)이지 리뷰 대상 코드가 유발하는 부작용이 아니다.
- **시그니처 변경**: 기존 함수/메서드 시그니처 변경 없음 — 전부 신규 함수(가드 모듈) 또는 버전 문자열 치환(`package.json`)이다.
- **인터페이스 변경**: 런타임 애플리케이션 공개 API 변경 없음. `dependabot.yml` 은 GitHub Dependabot 서비스가 읽는 설정 인터페이스이나 스코프가 의도대로 국한됨을 위에서 확인.
- **환경 변수**: 신규 가드·테스트 파일에 `process.env` 참조 없음(grep 확인).
- **네트워크 호출**: 리뷰 대상 코드(가드·테스트) 어디에도 네트워크 호출 없음.
- **이벤트/콜백**: 유일한 "이벤트" 성격 변경은 dependabot 의 향후 PR 생성 억제(위 스코프 확인 항목)뿐이며, 런타임 콜백/이벤트 발행 로직 변경은 없음.
- **롤백 완전성**: `grep -rn '"typescript": *"\^\?7' --include=package.json .` 및 `grep -n 'typescript@7' pnpm-lock.yaml` 결과 0건 — 모노레포 전체에 typescript 7.x 잔존 선언이 없다(루트 `package.json` 은 애초에 typescript 를 선언하지 않음). 부분 롤백으로 인한 워크스페이스 간 major 드리프트(그 자체가 새 "의도치 않은 상태") 위험은 없다.

## 요약

이번 변경은 의존성 버전 롤백(10개 매니페스트 + lockfile 재생성) + CI 자동화 설정(dependabot ignore) +
신규 회귀 가드(순수 함수 + 테스트) + 작업 기록 문서로 구성되며, 런타임 애플리케이션 로직은 전혀 건드리지
않는다. 신규 가드 코드는 전부 read-only 파일시스템 접근과 `typescript` 패키지의 정상적인 동적
`require()`(테스트 목적의 의도된 재현)로 한정되어 있고, `env`/네트워크/전역 변수/기존 시그니처에 대한
부작용은 발견되지 않았다. dependabot ignore 규칙은 향후 자동 PR 생성이라는 "이벤트"를 의도적으로
억제하지만 스코프가 루트 워크스페이스로 정확히 제한됨을 직접 확인했고, 롤백이 저장소 전체에 걸쳐
빠짐없이 적용되어 워크스페이스 간 typescript major 드리프트라는 새로운 부작용을 남기지 않았음도
실측으로 확인했다. 두 건의 INFO 는 모두 의도된 설계이자 기존 저장소 패턴과 일관되어 조치가 필요하지
않다.

## 위험도

LOW
