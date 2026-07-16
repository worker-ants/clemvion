# 의존성 리뷰 — node-linker=isolated 전환 + backend phantom 의존 4개 선언

- 커밋: `19252b21e` (`origin/main..HEAD`)
- 범위: `.npmrc`, `codebase/backend/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`(주석만),
  `codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile`, `docker-compose.e2e.yml`,
  `plan/in-progress/pnpm-migration-followups.md`

## 발견사항

### [INFO] 4개 신규 direct 의존 — 선언 레벨·버전 범위·사용처 정합 확인, 이상 없음

- 위치: `codebase/backend/package.json:66-67,69,95`
- 상세: 실제 import grep 으로 사용처를 직접 검증했다.
  - `express@^5.2.1` (dependencies) — `src/bootstrap/hooks-body-parser.ts`,
    `src/modules/auth/*`, 다수 컨트롤러에서 prod 코드 경로로 사용. `@types/express@^5.0.0`
    (기존 선언)과 major 정렬. `@nestjs/platform-express@11.1.27` 이 자기 `package.json` 에
    `express: 5.2.1` (exact) 을 pin 하고 있어, 신규 caret `^5.2.1` 과 결과적으로 단일 버전으로
    수렴 — 버전 충돌 없음.
  - `ip-address@^10.2.0` (dependencies) — `src/modules/auth-configs/auth-configs.service.ts`,
    `dto/is-ip-or-cidr.validator.ts` 에서 prod 코드로 사용. `pnpm-workspace.yaml` 의 보안
    override `ip-address: ^10.2.0` 과 **정확히 동일한 range** — override 목적(취약 버전
    강제 승격)과 direct 선언 목적(phantom 해소) 이 같은 값으로 만나 충돌 없음. 이번 override
    는 원래 목적(CVE 상향 핀)대로 유지되고, direct 선언은 단지 phantom→explicit 전환이라
    override 의미가 약화되지 않는다.
  - `dotenv@^17.4.1` (dependencies) — `src/scripts/encrypt-auth-config.ts`,
    `cleanup-invalid-queue-jobs.ts` 등에서 `dotenv.config()` 직접 호출. 이 스크립트들은
    `package.json` scripts 의 `encrypt-auth-config`/`cleanup:queue-jobs` 가
    `node dist/scripts/*.js` 로 **프로덕션 운영 경로**에서 실행 — devDependencies 가 아닌
    dependencies 배치가 맞다.
  - `@jest/globals@^30.0.0` (devDependencies) — grep 결과 `*.spec.ts`/`*.e2e-spec.ts` 에서만
    사용, prod `src/` 런타임 경로 없음 — devDependencies 배치가 맞다.
- 결론: 4건 모두 배치 레벨(dependencies vs devDependencies), 버전 range(caret, PROJECT.md
  §버전 핀 정책 (a) 기본 caret 정합), 실제 사용처가 정확히 일치. 재선언 오류 없음.

### [INFO] `pnpm-lock.yaml` 변경분 — 신규 버전 도입 없음, 순수 direct edge 4개 + peer 재전개

- 위치: `pnpm-lock.yaml` (importers 섹션 4곳 + `eslint-plugin-import` peer-descriptor 3곳 +
  `jest-watcher` 의 `picomatch: 4.0.4→4.0.5`)
- 상세: `express@5.2.1`/`ip-address@10.2.0`/`dotenv@17.4.1`/`@jest/globals@30.4.1` 모두 이미
  트리에 존재하던 전이 의존 버전과 동일 — 새 버전 도입 없음(트리 확장 없이 explicit edge 만
  추가). `eslint-plugin-import` peer-descriptor 재전개는 버전 불변, dev 툴링 전용, 런타임
  영향 없음. `picomatch: 4.0.4→4.0.5` 는 `jest-watcher` 내부 전이 patch — `pnpm-workspace.yaml`
  의 `overrides.picomatch: ^4.0.4` range 내부라 override 정책 위반 없음(CVE override 는
  `^4.0.4` 이지 exact pin 이 아님).
- 결론: 공급망 관점에서 "새 코드가 트리에 들어왔다"기보다 "이미 있던 전이 코드를 명시
  edge 로 승격"한 변경 — 순수 신규 노출면 확대는 없음.

### [INFO] license — 4개 신규 direct 의존 모두 permissive, `UNLICENSED`(proprietary) 백엔드와 호환

- 위치: `node_modules/.pnpm/{express@5.2.1,ip-address@10.2.0,dotenv@17.4.1,@jest+globals@30.4.1}`
- 상세: 설치된 패키지 메타데이터 직접 확인 — `express` MIT, `ip-address` MIT, `dotenv`
  BSD-2-Clause, `@jest/globals` MIT. 모두 permissive, copyleft 없음. `codebase/backend/package.json`
  의 `"license": "UNLICENSED"` (proprietary) 와 라이선스 충돌 없음.

### [INFO] engines 호환성 — 프로젝트 Node 하한(≥24)이 4개 신규 의존 요구치를 모두 상회

- 위치: 각 패키지 `package.json` engines — `express` `>=18`, `ip-address` `>=12`, `dotenv`
  `>=12`, `codebase/backend/package.json:engines.node` `>=24`.
- 상세: 4개 모두 Node 최소 요구가 프로젝트 floor(≥24)보다 낮아 runtime 호환성 이슈 없음.

### [INFO] `scripts/check-pnpm-security-config.py` EXPECTED_* baseline — 갱신 불요, 확인됨

- 위치: `scripts/check-pnpm-security-config.py:37-57` (`EXPECTED_OVERRIDES`)
- 상세: 이 가드는 `pnpm-workspace.yaml` 의 `overrides`/`onlyBuiltDependencies`/
  `auditConfig.ignoreCves` 만 대조하며, `package.json` 의 direct dependencies 는 검사
  범위 밖이다. 이번 diff 에서 `pnpm-workspace.yaml` 의 `overrides: ip-address: ^10.2.0`
  값은 **변경되지 않음**(주석만 갱신) — `EXPECTED_OVERRIDES["ip-address"] = "^10.2.0"` 과
  실제 파일이 여전히 일치하므로 baseline 갱신 불필요. `.github/workflows/deps-security-checks.yml`
  의 트리거 경로(`codebase/**/package.json` 포함)에 이번 diff 의 `codebase/backend/package.json`
  변경이 걸려 config-guard·audit job 이 정상 재실행된다.

### [INFO] (참고, 이번 diff 원인 아님) 로컬 `pnpm audit` 엔드포인트 410 응답 — 사전 존재 인프라 이슈

- 위치: 로컬 재현 — `pnpm audit --audit-level=moderate` 실행 시
  `ERR_PNPM_AUDIT_BAD_RESPONSE ... 410 ... "This endpoint is being retired. Use the bulk
  advisory endpoint instead."`
- 상세: registry.npmjs.org 의 legacy audit 엔드포인트가 retire 공지와 함께 410 을 반환.
  `.github/workflows/deps-security-checks.yml` 의 `audit` job 은 동일 커맨드(`pnpm audit
  --audit-level=moderate`)를 사용하므로, 이 CI 환경/네트워크 조건이 동일하게 재현된다면
  향후 PR·주간 스케줄에서 audit job 자체가 fail 또는 무의미한 에러로 막힐 수 있다.
  다만 이는 **이번 diff 가 만든 문제가 아니다** — `pnpm audit` 커맨드나 workflow 파일은
  이번 커밋에서 변경되지 않았고, npm 레지스트리 측 엔드포인트 retirement 는 별개
  인프라 이벤트다. 이번 4개 신규 direct 의존의 CVE 여부를 로컬에서 `pnpm audit` 으로 재검증하지
  못했다는 제약만 남긴다(다만 4개 모두 이미 트리에 존재하던 버전이라 신규 노출면이 아님).
- 제안: 이번 diff 범위 밖이므로 즉시 조치 불요하나, 별도 plan 항목으로 `pnpm audit` 의
  bulk advisory 엔드포인트 마이그레이션(pnpm 버전 업 또는 커맨드 옵션 변경) 여부를
  추적할 것을 권장.

## 요약

`node-linker=hoisted → isolated` 전환으로 드러난 backend phantom 의존 4개(`express`,
`ip-address`, `dotenv`, `@jest/globals`)는 모두 실제 import 위치와 배치 레벨
(dependencies vs devDependencies)이 정확히 일치하며, 버전 range 는 PROJECT.md §버전 핀
정책의 기본 caret 원칙을 따르고 이미 트리에 있던 전이 버전과 동일해 신규 버전 도입·트리
확장이 없다. `ip-address` 는 보안 override(`^10.2.0`)와 정확히 같은 range 로 direct
선언돼 override 의도를 약화시키지 않으며, `check-pnpm-security-config.py` 의 EXPECTED
baseline 도 `pnpm-workspace.yaml` 값 불변으로 갱신이 불필요하다. 4개 패키지 모두 permissive
라이선스(MIT/BSD-2-Clause)로 `UNLICENSED` 백엔드와 충돌 없고, engines 요구치도 프로젝트
Node floor(≥24)에 여유롭게 부합한다. lockfile diff 는 4개 direct edge 와 dev 툴링
peer-descriptor 재전개(버전 불변)뿐이라 공급망 노출면 확대가 없다. 발견된 유일한 부수
이슈(`pnpm audit` legacy 엔드포인트 410)는 이번 diff 가 원인이 아닌 사전 존재 인프라
이벤트로, 별도 후속 추적을 권장하되 이번 PR 을 막을 사유는 아니다.

## 위험도

NONE
