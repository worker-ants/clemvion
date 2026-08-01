# 의존성(Dependency) Review

## 발견사항

- **[INFO]** 신규 외부 의존성 없음 — 순수 롤백이며 오히려 설치 풋프린트가 감소
  - 위치: 전체 diff (`.github/dependabot.yml`, 9개 `package.json`, `pnpm-lock.yaml`)
  - 상세: `typescript` 를 `^7.0.2` → `^5.7.3`/`^5` 로 되돌리는 변경 외 새 패키지 추가가 없다. `pnpm-lock.yaml` 에서 TS7 의 `optionalDependencies` 였던 `@typescript/typescript-{aix,darwin,linux,win32,...}` 플랫폼별 네이티브 바이너리 패키지 약 20개가 통째로 제거된다. 신규 파일 2개(`typescript-toolchain-guard.ts`/`.test.ts`)도 `node:fs`·`node:path`·`node:module` 표준 라이브러리와 기존 devDependency(`vitest`)만 사용한다. `grep -rn "typescript@7\|@typescript/typescript-"` 로 저장소 전체(lockfile 포함)에 TS7 잔존 참조가 0건임을 직접 확인했다.
  - 제안: 조치 불필요.

- **[INFO]** 버전 고정 정책(caret) 준수 + major 자동 상향을 dependabot 레벨에서 명시적으로 차단
  - 위치: `.github/dependabot.yml:72-73` (`- dependency-name: "typescript"` / `update-types: ["version-update:semver-major"]`)
  - 상세: 되돌린 값(`^5.7.3` 8곳, `^5` 2곳)은 모두 caret — `PROJECT.md §버전 핀 정책` 의 "사유 없는 핀은 caret 으로 완화" 원칙과 일치한다. `python3 -c "import yaml..."` 로 실제 YAML 을 파싱해 `ignore[].dependency-name` + `update-types` enum(`version-update:semver-major`) 구조가 GitHub Dependabot 공식 스키마와 정확히 일치함을 확인했다 — 들여쓰기·철자 오류 없음.
  - 제안: 조치 불필요.

- **[INFO]** dependabot `ignore` 는 scheduled version-update 만 확실히 차단 — security-update 경로는 별도 토글이라 완전한 보장은 아님
  - 위치: `.github/dependabot.yml:66-67`
  - 상세: 주석이 이미 인지하고 있듯("별개 토글인 security updates 도 patch 로 오는 한 영향 없다"), GitHub Dependabot 의 **security updates**(CVE 트리거)는 이 `ignore` 룰과 별개 경로다. typescript 는 컴파일러 도구라 major 에서만 고쳐지는 보안 이슈가 나올 가능성은 낮고 이미 저위험으로 판단된 사안이라 이번 PR 을 막을 사유는 아니지만, "major 로만 고쳐지는 security PR" 이 이 ignore 를 우회할 이론적 gap 은 문서에 명시돼 있지 않다.
  - 제안: 다음에 dependabot 거버넌스를 손댈 때 한 줄 주석으로 이 gap 을 남겨두면 향후 재조사 비용을 줄인다. 차단 사유 아님.

- **[INFO]** `typescript` range 표기가 워크스페이스 전역에서 `^5.7.3`(8곳) / `^5`(2곳) 로 갈려 있음 — 이 PR 이 만든 상태 아니고 신설 가드는 major 만 검사
  - 위치: `codebase/frontend/package.json:89`, `codebase/channel-web-chat/package.json:32` (둘 다 `"typescript": "^5"`) vs `codebase/backend/package.json:129` 등 8개 파일(`"typescript": "^5.7.3"`)
  - 상세: `#1047` 이전 값을 정확히 복원한 결과라 신규 드리프트가 아니다. 신설 `majorSpread()`(`codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:149-161`)는 **major** 숫자만 lockstep 검사하므로 이 minor/patch 폭 차이는 가드 대상 밖이며, 실제 사고 원인(major 드리프트)과는 무관하다.
  - 제안: 조치 불필요. 인지용.

- **[INFO]** 취약점 재도입 없음 — 복원한 `5.9.3` 은 `#1047` 이전까지 main 이 실제로 쓰던 버전
  - 위치: `pnpm-lock.yaml:21335` (`typescript@5.9.3: {}`; `typescript@7.0.2` 블록은 완전 삭제됨)
  - 상세: 신규 버전 도입이 아니라 이미 검증된 이전 상태로의 완전 복귀다. `deps-security-checks.yml`(`pnpm audit --audit-level=moderate`)가 이 lockfile 에도 동일하게 걸리므로 별도 조치가 필요 없다.
  - 제안: 조치 불필요.

- **[INFO]** 호환성 근거를 `node_modules` 직접 대조로 실측 검증 — plan 문서의 주장이 사실과 일치
  - 위치: `codebase/backend/package.json:130` (`"typescript-eslint": "^8.20.0"`); 근거는 `plan/in-progress/typescript-7-rollback.md:36-37`
  - 상세: `typescript-eslint@8.61.1` 의 `package.json` `peerDependencies.typescript` 를 직접 읽어 `>=4.8.4 <6.1.0` 임을 확인했다 — TS7 은 이 range 밖이라 JS compiler API 소실 문제와 별개로 애초에 무효한 조합이었다는 plan 문서 주장이 지어낸 근거가 아니라 실측과 일치한다.
  - 제안: 조치 불필요 — 검증 결과 기재.

- **[INFO]** 별개 PR(#1049)이 남긴 `eslint-plugin-unicorn@72.0.0` unmet peer — 이번 PR 범위 밖으로 투명하게 분리됨
  - 위치: `plan/in-progress/typescript-7-rollback.md:149-159`
  - 상세: 이 diff 는 `eslint-plugin-unicorn` 을 건드리지 않는다. `node_modules/eslint-plugin-unicorn/package.json` 확인 결과 `peerDependencies.eslint = ">=10.4"` 인데 설치된 버전은 `9.39.4` — 미충족이 실재한다. lint 는 현재 PASS 하므로 즉시 차단 사유는 아니며, plan 문서가 "빌드 복구가 스코프" 라며 별도 PR 로 명시적으로 이연한 처리가 스코프 은폐가 아니라 투명하다.
  - 제안: 별도 후속 PR(eslint 9→10)로 트래킹 — plan 문서에 이미 그렇게 기재됨. 추가 조치 불요.

- **[INFO]** 내부 의존성(모듈 재사용)이 적절 — 파서 중복 회피
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:14` (`import { ROOT, listAtPath, type PackageManifest } from "./internal-package-registration-guard"`)
  - 상세: `pnpm-workspace.yaml` 파싱(`listAtPath`)과 워크스페이스 루트 탐색(`ROOT`)을 형제 가드 모듈에서 재사용해 동일 파서를 두 벌 두지 않는다. 실측으로 `pnpm-workspace.yaml` 의 `packages:` 값이 고정 경로 3개 + 말미 단일 `*` 글롭 1개(`codebase/packages/*`) 로 정확히 신설 `expandWorkspaceGlobs()` 의 지원 형태 가정과 일치함을 확인했다.
  - 제안: 조치 불필요.

## 요약

이 변경은 새 외부 의존성을 전혀 추가하지 않는 순수 롤백(`typescript` `^7.0.2` → `^5.7.3`/`^5`) + 재발 방지 governance(dependabot major-ignore, 능력 기반 회귀 가드)다. 되돌린 버전(`5.9.3`)은 `#1047` 직전까지 main 이 실제로 쓰던 값이라 신규 취약점 도입 위험이 없고, `pnpm-lock.yaml` 에서 TS7 전용 플랫폼별 네이티브 바이너리 optionalDependencies 약 20개가 함께 제거되어 오히려 설치 풋프린트가 줄었다. 버전 표기는 caret 유지로 프로젝트 핀 정책과 일치하며, `typescript-eslint` peer range(`>=4.8.4 <6.1.0`)가 TS7 을 원천 배제한다는 plan 문서의 주장도 `node_modules` 직접 대조로 실측 검증됐다. dependabot `ignore` 규칙은 YAML 스키마상 정확하고, 저장소 전역에 TS7 잔존 참조가 0건임을 grep 으로 확인했다. 유일하게 언급할 만한 잔여 사항은 (1) security-update 경로가 이 `ignore` 룰을 이론상 우회할 여지(가능성 낮음, 이미 인지된 트레이드오프)와 (2) 별개 PR(#1049)이 남긴 `eslint-plugin-unicorn` unmet peer — 둘 다 이 PR 을 막을 사유가 아니며 후자는 plan 문서가 이미 투명하게 스코프 아웃했다. Critical·Warning 없음.

## 위험도

NONE
