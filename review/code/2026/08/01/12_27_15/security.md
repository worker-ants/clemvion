# 보안(Security) 리뷰 결과

## 변경 개요

본 변경셋은 `eslint-plugin-unicorn` 을 dependabot(#1049)이 잘못 올린 `^72.0.0`(eslint peer
`>=10.4` 요구, 설치본 eslint 9.39.4 와 unmet peer) 에서 의도된 `^56.0.1`(eslint peer
`>=8.56.0`) 로 되돌리는 작업이다. 대상 5개 파일:

1. `.github/dependabot.yml` — `eslint-plugin-unicorn` major 버전 자동 bump 를 ignore 목록에 추가(주석만 대폭 보강)
2. `codebase/backend/eslint.config.mjs` — pin 근거 주석 갱신(코드 로직 변경 없음, `plugins: { unicorn: ... }` 및 룰 설정 불변)
3. `codebase/backend/package.json` — devDependency 버전 문자열 `^72.0.0` → `^56.0.1`
4. `plan/in-progress/eslint-unicorn-peer-restore.md` — 신규 작업 기록 문서
5. `pnpm-lock.yaml` — 위 devDependency 다운그레이드에 따른 기계적 lockfile 재생성(전이 의존성 다수 교체: `builtin-modules`, `globals`, `regjsparser`, `is-builtin-module`, `semver` 등 — 전부 `eslint-plugin-unicorn` 자체의 devDependency 트리)

애플리케이션 런타임 코드(컨트롤러·서비스·인증·DB 쿼리 등)는 전혀 포함되지 않았다. 순수 빌드/린트
툴체인 설정과 CI 자동화 정책, 문서 변경이다.

### 발견사항

- **[INFO]** devDependency 대규모 다운그레이드(16 major) — 공급망 관점 참고
  - 위치: `codebase/backend/package.json:119` (`"eslint-plugin-unicorn": "^56.0.1"`)
  - 상세: `eslint-plugin-unicorn` 은 `eslint-config-prettier`/`eslint` 와 함께 devDependencies 에만
    위치하며 프로덕션 런타임 번들에 포함되지 않는다(빌드/린트 시점에만 실행). 따라서 이 패키지
    자체의 취약점이 있더라도 배포된 애플리케이션의 공격 표면에 직접 영향을 주지 않는다. 다운그레이드
    사유는 `eslint.config.mjs`(17~26행)·`dependabot.yml`(75~89행)·`plan/in-progress/eslint-unicorn-peer-restore.md`
    에 registry 실측 근거와 함께 상세히 기록되어 있어 임의 변경이 아님을 확인했다.
  - 제안: 없음(권장 조치 아님, 정보성). 참고로 `eslint-plugin-unicorn` 자체는 알려진 CVE 이력이
    없는 순수 lint-rule 패키지다. 필요 시 향후 `pnpm audit --prod` 로 프로덕션 dependency 만
    주기적으로 별도 점검하는 것으로 충분하다.

- **[INFO]** dependabot major-bump ignore 가 보안 패치 자동화 범위를 축소
  - 위치: `.github/dependabot.yml:90-91` (`eslint-plugin-unicorn` ignore 항목), `.github/dependabot.yml:72-73`(`typescript` 기존 ignore 항목)
  - 상세: `update-types: ["version-update:semver-major"]` ignore 는 dependabot 의 일반 버전 업데이트
    PR 생성만 억제하며, GitHub 의 별도 "Dependabot security updates" 토글(스키마 밖, repo 설정)로
    발행되는 보안 패치 PR 에는 영향을 주지 않는 것이 GitHub 문서상 동작이다. 다만 해당 취약점 수정이
    major 버전에서만 제공되는 경우에는 이 ignore 로 인해 자동 PR 이 생성되지 않을 수 있다. 이 트레이드오프는
    `dependabot.yml` 주석과 plan 문서(`후속 검토` 섹션)에서 이미 명시적으로 인지·기록되어 있다.
  - 제안: 이미 문서화된 리스크이므로 추가 조치 불필요. 향후 `eslint-plugin-unicorn` 관련 CVE 공지가
    있을 경우 이 ignore 항목을 임시로 해제하는 수동 절차만 팀 내 인지해 두면 충분.

- **[INFO]** lockfile 변경은 devDependency 재해결의 기계적 결과
  - 위치: `pnpm-lock.yaml` (importers/`eslint-plugin-unicorn` specifier·resolution 블록 및 그에 딸린 전이 devDependency 목록)
  - 상세: 대조한 신규/제거 패키지(`builtin-modules@3.3.0`, `is-builtin-module@3.2.1`, `globals@15.15.0`,
    `regjsparser@0.10.0`, `semver@5.7.2`, `escape-string-regexp@1.0.5`, `hosted-git-info@2.8.9`,
    `normalize-package-data@2.5.0` 등)는 모두 `eslint-plugin-unicorn@56.0.1` 자체의 (전이) devDependency
    이며, integrity(sha512) 해시가 모두 채워져 있어 lockfile 무결성 검증 메커니즘이 정상 동작함을
    확인했다. 하드코딩된 크리덴셜·비정상 registry URL·평문 토큰 등은 발견되지 않았다.
  - 제안: 없음.

- **[INFO]** `eslint.config.mjs` 주석 변경은 코드 로직 무영향
  - 위치: `codebase/backend/eslint.config.mjs:17-26`
  - 상세: diff 는 주석 텍스트만 교체하며 `plugins: { unicorn: eslintPluginUnicorn }` 이하 실제 룰
    설정(`unicorn/catch-error-name` 등, 79-84행)은 변경되지 않았다. lint 룰 자체가 인증/인가/입력
    검증에 관여하는 로직이 아니므로 보안 영향 없음.
  - 제안: 없음.

### 요약

이번 변경셋은 `eslint-plugin-unicorn` devDependency 버전을 dependabot 이 잘못 올린 `^72.0.0`(eslint
9 와 peer 불일치)에서 원래 의도한 `^56.0.1`로 되돌리고, 재발을 막기 위해 dependabot ignore 규칙과
근거 주석을 보강한 순수 빌드 툴체인/CI 설정 변경이다. 애플리케이션 런타임 코드, 인증/인가, 입력 처리,
암호화, 에러 메시지 노출 등 어느 것도 건드리지 않았다. 다운그레이드 대상은 devDependency(린트 전용)라
프로덕션 공격 표면에 영향이 없고, lockfile 무결성 해시도 정상이며, ignore 로 인한 보안 패치 자동화
범위 축소 트레이드오프도 문서에 이미 인지·기록되어 있다. 인젝션·시크릿·인증·OWASP Top 10 관련 실질적
위험 신호는 없다.

### 위험도
NONE
