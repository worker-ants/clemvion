# 요구사항(Requirement) 리뷰 — TypeScript 7.0.2 → 5.x 롤백 + 재발 방지 가드

## 검증 방법

diff 검토 외에 실제 저장소 상태를 직접 대조·실행해 확인했다:
- `grep -rn '"typescript"' --include=package.json` 로 10개 워크스페이스 전부 `^5.7.3`/`^5` 로 일관 복원됐는지 실측
- `pnpm-lock.yaml` 전수에서 `typescript@7.0.2` 잔존 0건, `typescript@5.9.3` 179건 확인
- `codebase/frontend/node_modules/typescript` 실제 로드 → `getParsedCommandLineOfConfigFile` 이 `function` 임을 런타임으로 확인(원 사고 원인 해소 실증)
- `.github/dependabot.yml` 을 `python3 yaml.safe_load` 로 파싱해 `ignore` 블록이 의도한 `updates[2]`(루트 pnpm 워크스페이스) 항목 아래 정확히 중첩됐는지 확인
- `vitest run typescript-toolchain.test.ts` 실행 → 20/20 PASS
- plan 체크리스트의 mutation 4종 결과(1/1/4/1 failed)를 실제 함수 로직으로 수동 트레이스해 수치 일치 확인
- `pnpm-workspace.yaml` 실물과 `expandWorkspaceGlobs`/`discoverWorkspaceDirs` 가 실제로 지원하는 glob 형태(고정 경로 + 말미 단일 `*`) 대조
- `spec/conventions/`, `PROJECT.md §버전 핀 정책` 대조로 spec 연계 여부 확인

## 발견사항

- **[INFO]** 관련 `spec/` 문서 없음(spec 누락, 정상)
  - 위치: 변경 전체(`.github/dependabot.yml`, `codebase/*/package.json`, `pnpm-lock.yaml`, 신규 가드 2파일)
  - 상세: 이번 변경은 의존성 버전 복원·CI 설정·저장소 회귀 가드로, `spec/` 는 제품 정의·기술명세 영역이라 대상이 아니다. 대신 `PROJECT.md §버전 핀 정책`(caret 기본, exact/tilde 는 `//pin` 사유 주석 필수)이 적용 대상인데, 이번 롤백은 `^7.0.2`/`^7` → `^5.7.3`/`^5` 로 **caret 유지**이므로 `//pin` 주석 신설이 불요하다는 정책과 정확히 부합한다(`codebase/frontend/package.json`·`codebase/channel-web-chat/package.json` 의 기존 `//pin` 필드에 typescript 가 없는 것도 이와 일치). `plan/in-progress/typescript-7-rollback.md` 의 `spec_impact: none` + `/consistency-check --impl-prep` 생략 근거도 이 판단과 일치하며, `.claude/docs/plan-lifecycle.md` 상 `in-progress` 단계에선 Gate C 의무가 아니므로 절차 위반도 아니다.
  - 제안: 없음(spec drift 아님, spec 신설 불요).

- **[INFO]** `typescriptRangeOf` 는 `devDependencies`/`dependencies` 중 우선순위(dev 우선)로 **하나만** 반환 — 이론상 두 필드가 다른 typescript 값을 선언하면 lockstep/능력 검사가 `dependencies` 쪽 값을 못 본다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts` 의 `typescriptRangeOf` (66~68행)
  - 상세: 현재 10개 워크스페이스 매니페스트 전부 `typescript` 를 `devDependencies` 에만 선언하므로(실측: `dependencies.typescript` 0건) 라이브 리스크는 없다. 함수 docstring "dev/prod 어느 쪽이든" 도 "두 값을 병합"이 아니라 "우선순위로 하나를 고른다"는 뜻으로 일관되게 구현돼 있어 주석-구현 괴리는 아니다.
  - 제안: 조치 불요(현재 데이터셋에서 도달 불가능한 분기). 향후 어떤 워크스페이스가 `dependencies.typescript` 를 추가로 선언하면 재검토.

## 항목별 확인 결과 (요약)

1. **기능 완전성**: 완전. 10개 매니페스트 전부 원복, lockfile 재생성으로 `typescript@7.0.2` 전 참조(패키지 엔트리 15+개, optionalDependencies 네이티브 바이너리 20개 포함) 소거, `nest build` 의 실제 실패 원인(`getParsedCommandLineOfConfigFile`)이 함수로 되돌아온 것을 런타임 실측으로 확인.
2. **엣지 케이스**: 신규 가드(`typescript-toolchain-guard.ts`)가 null/비-객체(`missingCompilerApi`), 파싱 불가 range(`parseMajor` → null, `>=5 <6`·`workspace:*`·빈 문자열 등 명시 커버), 미지원 glob(`expandWorkspaceGlobs` → throw), 발견 0건(`discoverWorkspaceDirs` → throw), 미설치 모듈(`loadTypescriptFrom` → null)을 각각 다른 실패 모드(fail-closed 목록/throw/null)로 명확히 구분해 처리 — 전부 테스트로 고정.
3. **TODO/FIXME**: 신규 파일 4종(`dependabot.yml` 추가분, 가드 2파일, plan 문서)에 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 없음. 가드 함수명·docstring·테스트 설명이 실제 로직과 1:1 대응(예: "능력 검사(primary)"·"lockstep(secondary)" 설계가 실제 두 축의 테스트로 정확히 구현됨).
5. **에러 시나리오**: `expandWorkspaceGlobs`/`discoverWorkspaceDirs` 는 "조용한 무력화" 대신 명시적 throw(저장소의 기존 가드 실패 클래스 #968 재발 방지 규약과 일관), `loadTypescriptFrom` 은 try/catch 로 미설치를 정상 분기(null)로 처리 — 의도적 구분이 합리적.
6. **데이터 유효성**: `parseMajor` 정규식이 이 저장소가 실제 쓰는 형태(`^5.7.3`·`^5`·`~7.0.2`·`5.9.3`·`5.x`)만 파싱하고 나머지는 `null`(호출부 fail-closed) — 과설계 회피와 안전성의 균형이 적절.
7. **비즈니스 로직**: "TS major 업그레이드는 사람 판단 전까지 차단, minor/patch·security 는 계속 수신"이라는 정책이 `dependabot.yml` 의 `ignore: [{dependency-name: typescript, update-types: [version-update:semver-major]}]` 로 정확히 인코딩됨을 YAML 파싱으로 직접 검증.
8. **반환값**: 신규 가드의 모든 exported 함수가 모든 분기에서 정의된 값을 반환하거나(never 암묵적 undefined) 명시적으로 throw — 누락 경로 없음.
9. **spec fidelity**: 위 INFO 참고 — 대상 spec 없음(정상), PROJECT.md 정책과는 line-level 로 부합.

## 요약

Jenkins 빌드 차단(TS7 major 오상향)의 근본 원인을 10개 워크스페이스 매니페스트 + lockfile 롤백으로 정확히 해소했고(런타임 실측으로 `getParsedCommandLineOfConfigFile` 함수 복귀 확인), 재발 방지책(dependabot major ignore + 능력/lockstep 이중 회귀 가드)이 실제 서술된 사고 시나리오와 1:1 대응하도록 구현·테스트(20/20 PASS, mutation 4종 수치까지 수동 검증 일치)됐다. lockfile diff 는 typescript 및 그 전이 의존 재해석 범위로 정확히 스코프돼 있고 무관한 의존성 변경은 없다. spec/ 대상 영역이 없는 순수 인프라·툴체인 변경이며 PROJECT.md 버전 핀 정책과도 정합한다. CRITICAL/WARNING 은 발견되지 않았고, INFO 2건은 조치 불요(둘 다 "현재 상태에서 도달 불가능"하거나 "정책상 정상")로 판단된다.

## 위험도

NONE
