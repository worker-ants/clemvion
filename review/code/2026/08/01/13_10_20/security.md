# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** devDependency major 다운그레이드는 런타임 공격 표면과 무관
  - 위치: `codebase/backend/package.json:119` (`"eslint-plugin-unicorn": "^56.0.1"`)
  - 상세: `eslint-plugin-unicorn` 을 dependabot 이 잘못 올린 `^72.0.0`(eslint peer 불일치, `eslint@>=10.4` 요구인데 설치본은 9.39.4)에서 원래 pin `^56.0.1` 로 되돌리는 변경이다. 이 패키지는 lint-rule 전용 devDependency 로 빌드 산출물/런타임 번들에 포함되지 않으므로 프로덕션 공격 표면에 영향이 없다. registry 실측(56.x peer `>=8.56.0`)과 근거 주석이 `codebase/backend/eslint.config.mjs:19-27` 에 정합하게 남아 있어 임의 변경이 아님을 확인했다.
  - 제안: 조치 불요.

- **[INFO]** 다운그레이드로 오래된 transitive devDependency ~15개 재유입, 알려진 CVE 없음
  - 위치: `pnpm-lock.yaml` — `eslint-plugin-unicorn@56.0.1(eslint@9.39.4(jiti@2.7.0))` snapshot 블록(예: 게이트 16160-16178) 및 딸린 신규 패키지(`hosted-git-info@2.8.9`, `semver@5.7.2`, `normalize-package-data@2.5.0`, `read-pkg@5.2.0`/`read-pkg-up@7.0.1`, `regjsparser@0.10.0`, `jsesc@0.5.0`, `is-builtin-module@3.2.1`/`builtin-modules@3.3.0`, `globals@15.15.0`, `clean-regexp@1.0.0`, `escape-string-regexp@1.0.5`, `spdx-*`, `type-fest@0.6.0`/`0.8.1`, `validate-npm-package-license@3.0.4`)
  - 상세: 이 패키지들은 `eslint-plugin-unicorn@56.0.1` 서브트리에만 존재하는 lint-time devDependency 이며 프로덕션 코드에 포함되지 않는다. `hosted-git-info@2.8.9` 는 ReDoS(CVE-2021-23362) 패치 버전이라 해당 취약점은 없다. 나머지도 공개 CVE 데이터베이스상 알려진 활성 취약점이 확인되지 않는다(버전 자체가 오래됐다는 점은 유지보수성 관점이지 즉각적 보안 위험은 아니다). lockfile 의 integrity(sha512) 해시가 전부 채워져 있어 무결성 검증 메커니즘이 정상 동작한다.
  - 제안: 조치 불요. 향후 `pnpm audit`/SCA 스캔에서 이 서브트리 관련 신규 패키지가 잡히면 본 변경(dependabot #1049 되돌리기) 기인임을 인지하면 된다.

- **[INFO]** dependabot major-bump ignore 확장이 보안 패치 자동화 범위를 일부 축소
  - 위치: `.github/dependabot.yml:75-93` (`eslint-plugin-unicorn` 신규 ignore 항목, `update-types: ["version-update:semver-major"]`)
  - 상세: 이 ignore 는 dependabot 의 일반 major 버전 업데이트 PR 생성만 억제하며, GitHub 저장소 설정의 별도 "Dependabot security updates" 토글로 발행되는 보안 패치 PR 에는 영향을 주지 않는 것이 정상 동작이다(단, 취약점 수정이 major 버전에서만 제공되는 경우엔 이 ignore 로 자동 PR 이 나오지 않을 수 있음). 이 트레이드오프는 `.github/dependabot.yml` 주석과 `plan/in-progress/eslint-unicorn-peer-restore.md` "후속 검토" 절에 이미 명시적으로 기록되어 있다.
  - 제안: 이미 문서화된 트레이드오프이므로 추가 조치 불필요. `eslint-plugin-unicorn` 관련 CVE 공지가 나오면 이 ignore 를 수동으로 임시 해제해야 한다는 점만 팀 내 인지해 둘 것.

- **[INFO]** 신규 테스트(`eslint-unicorn-peer.spec.ts`)의 서브프로세스 호출은 인젝션 벡터 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts:73-97` (`lintFixtureText` 함수, `execFileSync` 호출부)
  - 상세: `execFileSync(ESLINT_BIN, [...], { cwd, input: text, encoding: 'utf8' })` 형태로 인자 배열을 넘겨 셸을 경유하지 않는다(`shell: true` 미지정) — 커맨드 인젝션 벡터가 없다. `ESLINT_BIN`(`node_modules/.bin/eslint`)과 `FIXTURE_RELATIVE_PATH`는 `path.join` 으로 조합된 상수 문자열이며 외부/사용자 입력이 관여하지 않는다. `text`(린트 대상 소스)는 테스트 파일 내부에 하드코딩된 리터럴 배열(`bad`/`good`/`ignored`)뿐이고, stdin 으로 전달되어 셸 인자로 해석되지 않는다. 경로 탐색·인젝션 소지 없음.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 변경분 전체(`.github/dependabot.yml`, `PROJECT.md`, `codebase/backend/eslint.config.mjs`, `codebase/backend/package.json`, 신규 테스트 3개 파일, `plan/in-progress/eslint-unicorn-peer-restore.md`, `pnpm-lock.yaml`)
  - 상세: API 키·비밀번호·토큰·인증서·비정상 registry URL 등 하드코딩된 시크릿 패턴은 발견되지 않았다. `pnpm-lock.yaml` 의 신규/변경 라인은 전부 공개 npm registry 의 integrity 해시(sha512)뿐이다.
  - 제안: 조치 불요.

- **[INFO]** `eslint.config.mjs` 변경은 주석뿐 — 인증/인가/입력 검증 로직 무영향
  - 위치: `codebase/backend/eslint.config.mjs:17-34`
  - 상세: diff 는 pin 근거 주석(registry 실측 표, 갱신 경로 등)만 확장하며, 실제 룰 등록부 `plugins: { unicorn: eslintPluginUnicorn }`(게이트 35)와 그 아래 `unicorn/catch-error-name` 규칙 설정은 변경되지 않았다. lint 설정은 인증/인가/입력검증/암호화/에러 처리 등 OWASP Top 10 관련 런타임 로직에 관여하지 않는다.
  - 제안: 조치 불요.

## 요약

이번 변경셋은 dependabot(`#1049`)이 backend 전용 devDependency `eslint-plugin-unicorn` 을 `^56.0.1` → `^72.0.0`(16 major)으로 잘못 올려 발생한 unmet peer(`eslint@>=10.4` vs 설치본 9.39.4)를 원래 의도한 `^56.0.1` 로 되돌리고, 재발 방지를 위해 `.github/dependabot.yml` 에 major-bump ignore 를 추가하며, `eslint.config.mjs` 근거 주석을 최신화하고, 상시 회귀 가드(`eslint-unicorn-peer.spec.ts` 등)를 신설한 순수 빌드 툴체인/CI 설정 revert 다. 애플리케이션 런타임 코드·인증/인가·입력 처리·암호화·에러 메시지 노출 어느 것도 건드리지 않았고, 다운그레이드 대상은 devDependency(lint 전용)라 프로덕션 공격 표면에 영향이 없다. 신규 테스트의 서브프로세스 호출은 배열 인자 방식으로 셸을 경유하지 않아 인젝션 벡터가 없으며, 재유입되는 구식 transitive 패키지들도 알려진 활성 CVE가 확인되지 않는다. 하드코딩된 시크릿, 인증/인가 우회, 인젝션, 안전하지 않은 암호화 등 OWASP Top 10 관련 실질적 위험 신호는 발견되지 않았다.

## 위험도
NONE
