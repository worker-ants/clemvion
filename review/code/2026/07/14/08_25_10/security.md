# 보안(Security) 코드 리뷰

## 리뷰 대상

- `PROJECT.md` — 버전 핀 정책 문서 갱신 (overrides/onlyBuiltDependencies 의 정규 위치를 `pnpm-workspace.yaml` 로 명시)
- `package.json` — `pnpm.overrides` / `pnpm.onlyBuiltDependencies` (pnpm 10.23 이 더 이상 읽지 않는 필드) 제거
- `plan/in-progress/pnpm-migration-followups.md` — 이전 작업(§1 부수 발견) 완료 기록
- `pnpm-workspace.yaml` — 위 두 설정을 pnpm 10 정규 위치로 신설

이 변경의 본질은 **설정 값의 신규 도입이 아니라, 이미 존재하던 공급망 보안 통제(CVE 핀 20건 + native build-script 허용목록 5건)를 pnpm 이 실제로 읽는 위치로 옮기는 기계적 이전**이다.

## 발견사항

### 1:1 보존 검증 (수동 대조)

diff 를 라인 단위로 대조한 결과:

- **`overrides` 20건** (`lodash`, `picomatch`, `liquidjs`, `ip-address`, `express-rate-limit`, `protobufjs`, `fast-uri`, `hono`, `uuid`, `ws`, `@grpc/grpc-js`, `multer`, `form-data`, `nodemailer`, `next>postcss`, `eslint-plugin-react-hooks`, `undici@>=7.0.0 <7.28.0`, `vite`, `@babel/core`, `@nestjs/swagger`) — 키·값 문자열이 JSON(`package.json`) → YAML(`pnpm-workspace.yaml`) 이전 전후로 **완전히 동일**. 추가·누락·버전 변경 없음.
- **`onlyBuiltDependencies` 5건** (`isolated-vm`, `bcrypt`, `esbuild`, `@swc/core`, `@tailwindcss/oxide`) — 동일하게 완전 보존. 새로운 패키지가 허용목록에 **추가되지 않았고**(임의 build-script 실행 위험 없음), 기존 항목이 **누락되지도 않았다**(native 모듈 빌드 차단 위험 없음).
- YAML 이관 시 특수문자(`@`, `>`, `<`, 공백) 포함 키(`@grpc/grpc-js`, `@babel/core`, `@swc/core`, `@tailwindcss/oxide`, `@nestjs/swagger`, `undici@>=7.0.0 <7.28.0`)는 모두 올바르게 quote 처리되어 YAML 파싱 모호성이 없다. 나머지(`next>postcss`, `eslint-plugin-react-hooks` 등)는 quote 불필요 케이스로 정상.
- 작업 기록(plan 문서)이 주장하는 검증(`--lockfile-only` 재해소 시 lockfile byte-identical → 오버라이드가 실제로 재적용됨 증명, native 모듈 fresh install 정상, e2e 253건 통과)은 이 diff 만으로 재현할 순 없으나, 대조 결과와 정합적이다.

### 발견 항목

- **[INFO]** 공급망 거버넌스 공백 해소 — 올바른 방향의 수정
  - 위치: `package.json` → `pnpm-workspace.yaml`
  - 상세: pnpm 10.23 이 `package.json` 의 `pnpm.*` 필드를 무시하는 상태에서, non-frozen `pnpm install`(예: 로컬 개발자가 신규 의존성 추가 후 lockfile 재생성)을 돌리면 CVE 핀·native build 허용목록이 **조용히 사라져 취약 버전으로 회귀**할 수 있었다(OWASP A06 Vulnerable and Outdated Components / A08 Software and Data Integrity Failures 성격). 이번 변경은 이 통제를 pnpm 이 실제로 읽는 정규 위치로 옮겨 **fail-open → fail-closed** 로 전환한다. CI 경로(`--frozen-lockfile`)는 애초에 이 버그의 영향을 받지 않았으므로(lockfile 스냅샷을 그대로 설치) 실제 리스크는 로컬/향후 lockfile 재생성 시나리오에 국한됐던 것으로 판단되며, 그 시나리오를 정확히 닫는다.
  - 제안: 없음 — 방향·구현 모두 적절.

- **[WARNING]** 잔여 거버넌스 공백 — `pnpm-workspace.yaml` 의 overrides/onlyBuiltDependencies 내용을 검증하는 CI 가드 부재
  - 위치: `pnpm-workspace.yaml` (신규 블록), CI 전반
  - 상세: 이번 수정으로 "설정이 읽히는가" 는 해결됐지만, "설정의 **내용**이 의도한 보안 기준선과 계속 일치하는가" 를 검증하는 자동 가드는 여전히 없다. 예:
    - 누군가 향후 `pnpm-workspace.yaml` 의 `overrides` 항목을 실수로 삭제하고 lockfile 을 재생성하면, `--frozen-lockfile` CI 는 (manifest 와 lockfile 이 일치하므로) **통과**한다 — CVE 핀이 사라졌다는 사실 자체를 잡아내는 테스트가 없다.
    - `onlyBuiltDependencies` 에 향후 패키지가 추가돼도(정당한 필요이든 실수·공급망 공격이든) 이를 리뷰 없이 자동 승인/차단하는 정책적 가드가 없다 — 순수 코드 리뷰(사람)에 의존한다.
    - repo 전체에서 `pnpm audit` / Dependabot(npm 생태계) / Snyk / OSV-Scanner 류의 **의존성 취약점 스캔이 CI 에 없음**을 확인했다(`.github/dependabot.yml` 은 `github-actions` ecosystem 만 감시, `.github/workflows/*.yml` 에 audit 단계 없음). 즉 이번 핀 20건은 **수동으로 발견된 CVE 에 대한 사후 대응**이며, 신규 CVE 발생을 자동으로 탐지해 오버라이드 필요성을 알려주는 상시 메커니즘이 없다.
  - 제안: (a) `pnpm-workspace.yaml` 의 `overrides`/`onlyBuiltDependencies` 키 목록에 대한 스냅샷 테스트(예상 패키지 집합과의 diff 를 리뷰 시 명시적으로 보여주는 가드) 추가 검토, (b) 정기 `pnpm audit --audit-level=high` (또는 OSV-Scanner) CI job 추가로 신규 CVE 자동 탐지 — 현재는 사람이 개별 CVE 를 발견해야만 오버라이드가 추가되는 반응적(reactive) 프로세스. 이 항목은 본 PR 의 스코프(위치 이전)를 넘어서므로 별도 후속 항목으로 기록 권장.

- **[INFO]** `package.json` 의 `pnpm` 필드 완전 제거로 이중 진실(split source) 위험 없음
  - 위치: `package.json`
  - 상세: 필드를 주석 처리하거나 남겨두지 않고 완전히 삭제했다. 이는 향후 누군가 무시되는 `package.json` 쪽을 편집하고 "이미 설정했다"고 착각하는 혼선을 방지한다. 긍정적.

- **[INFO]** 이 diff 자체에는 시크릿·인젝션·인증/인가·암호화·에러 처리 관련 코드 변경이 없음
  - 위치: 전체
  - 상세: 변경 대상이 순수 의존성 관리 설정(YAML/JSON/문서)이라 본 리뷰 관점의 1~7번 항목(인젝션, 하드코딩 시크릿, 인증/인가, 입력 검증, OWASP Top10 애플리케이션 계층, 암호화, 에러 처리 노출)은 해당 사항 없음. 8번(의존성 보안)만 실질적으로 관련.

## 요약

이번 변경은 이전 ai-review 에서 지적된 "pnpm 10.23 이 `package.json` 의 `pnpm.overrides`/`pnpm.onlyBuiltDependencies` 를 더 이상 읽지 않아 CVE 핀·native build 허용목록이 lockfile 관성으로만 유지되던" 공급망 거버넌스 공백을, 값의 변경 없이 pnpm 10 정규 위치(`pnpm-workspace.yaml`)로 옮기는 기계적 이전으로 해소한다. diff 대조 결과 `overrides` 20건·`onlyBuiltDependencies` 5건 모두 **누락·추가·버전 변경 없이 완전 보존**되어 있어, 신규 패키지가 임의로 build script 를 실행할 수 있게 되거나 필요한 native 모듈이 새로 차단되는 회귀는 없다. 다만 이 수정은 "설정이 읽히는가" 만 고치는 것이지 "설정 내용이 계속 올바른가" 를 상시 검증하는 CI 가드(오버라이드 내용 스냅샷·정기 취약점 스캔)는 여전히 부재하다 — 이는 본 PR 의 스코프를 벗어나는 잔여 항목으로 별도 후속 조치를 권장한다.

## 위험도

LOW
