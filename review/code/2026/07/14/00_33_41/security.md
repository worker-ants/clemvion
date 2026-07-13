# 보안(Security) 코드 리뷰

## 리뷰 대상

- `codebase/backend/Dockerfile` — runner 스테이지를 `prod-deps`(hoisted flat node_modules 통째 COPY) → `pnpm deploy`(injected, self-contained) 로 교체
- `plan/in-progress/pnpm-migration-followups.md` — 위 변경의 배경·검증 기록 (문서, 실행 코드 아님)
- `pnpm-lock.yaml` — `settings.injectWorkspacePackages: true` 1줄 추가 (버전 변경 없음, diff 로 확인)
- `pnpm-workspace.yaml` — `injectWorkspacePackages: true` 1줄 추가

## 발견사항

- **[WARNING] pnpm 10.23 이 `package.json` 의 보안 오버라이드/빌드스크립트 allow-list 를 이미 무시 — 정규 위치로 미이전 상태가 이번 diff 이후에도 지속**
  - 위치: 루트 `package.json` `pnpm.overrides`(23개 CVE·호환성 핀, `@nestjs/swagger: 11.2.7` 포함) · `pnpm.onlyBuiltDependencies`(native build-script allow-list: `isolated-vm`, `bcrypt`, `esbuild`, `@swc/core`, `@tailwindcss/oxide`). 이번 diff 의 `pnpm-workspace.yaml`/`pnpm-lock.yaml` 은 `injectWorkspacePackages: true` 만 추가했고 위 두 설정은 여전히 pnpm 10 이 읽지 않는 `package.json`'s `pnpm` 필드에 남아 있다.
  - 상세: 이 리뷰 중 로컬에서 직접 재현 확인함 — 저장소 루트에서 `pnpm -v` 를 실행하는 것만으로도(설치 명령 없이) 다음 경고가 즉시 출력된다.
    ```
    [WARN] The "pnpm" field in package.json is no longer read by pnpm.
    The following keys were ignored: "pnpm.overrides", "pnpm.onlyBuiltDependencies".
    See https://pnpm.io/settings for the new home of each setting.
    ```
    즉 pnpm 이 package.json 을 파싱하는 시점마다 이 필드는 이미 죽어 있다. 현재 다음 두 안전장치가 **lockfile 관성**만으로 유지된다.
    1. **CVE/호환성 오버라이드 23개** (`ws`, `nodemailer`, `multer`, `express-rate-limit`, `form-data`, `@grpc/grpc-js`, `protobufjs`, `fast-uri`, `hono`, `undici`, `uuid`, `vite`, `@babel/core`, `next>postcss`, `@nestjs/swagger` 등) — 이미 생성된 `pnpm-lock.yaml` 의 최상위 `overrides:` 블록(파일 그 자체, package.json 필드와 별개)이 남아 있는 한 유효.
    2. **native 빌드 스크립트 allow-list** — 임의 의존성의 install/postinstall(빌드) 스크립트 실행을 막는 supply-chain 방어. 이 필드가 무효화된 상태에서 실제 유효 allow-list 가 무엇으로 대체되는지(내장 기본값? 완전 차단? 완전 허용?) diff·plan 문서 어디에도 명시적으로 검증되어 있지 않다.
    현재는 CI 워크플로 6개(`spec-link-checks`, `frontend-checks`, `web-chat-checks`(×3), `packages-checks`) 와 양쪽 Dockerfile(`backend`, `frontend`) 모두 일관되게 `pnpm install --frozen-lockfile` 을 사용함을 확인했으므로, **당장 자동화 경로에서 오버라이드가 소실될 실행 경로는 없다.** 하지만 (a) 신규 기여자가 로컬에서 의존성 추가 등으로 `--frozen-lockfile` 없이 `pnpm install`/`pnpm update` 를 돌리면 lockfile 이 재생성되며 위 오버라이드가 **조용히 사라지고** 과거 취약 버전으로 회귀할 수 있다(예: `ws`, `multer`, `nodemailer`, `express-rate-limit` 등은 CVE 대응 목적 핀). (b) 이를 감지할 CI 가드(예: lockfile 의 `overrides:`/`onlyBuiltDependencies` 등가 블록이 기대값과 일치하는지 검증하는 스모크 스텝)가 없어 회귀가 나더라도 조용히 통과할 수 있다. OWASP 관점으로는 A08:2021(Software and Data Integrity Failures) · A06:2021(Vulnerable and Outdated Components) 에 해당.
  - 제안: `overrides`·`onlyBuiltDependencies` 를 pnpm 10 정규 위치인 `pnpm-workspace.yaml` 로 즉시 이전하고 lockfile 을 재생성할 것(이미 `plan/in-progress/pnpm-migration-followups.md` §1-(a) 말미에 "부수 발견"으로 기록되어 후속 작업으로 예정돼 있음 — 그 자체는 투명성 있는 처리이나, 이번 리뷰에서 실측 재현되었으므로 §2(swagger 핀 제거)와 별개로 **우선순위를 당길 것**을 권고한다). 이전 전까지는 최소한 CI 에 "onlyBuiltDependencies 무효화 상태에서 실제 실행되는 빌드 스크립트 목록"을 1회 캡처해 예상과 다르면 실패하는 스모크 체크 추가를 검토.

- **[INFO] `pnpm deploy` 자체는 이번 diff 상 버전 회귀를 유발하지 않음 — 다만 명시적 lockfile 고정 플래그 부재는 방어심층 관점에서 개선 여지**
  - 위치: `codebase/backend/Dockerfile` — `FROM builder AS deploy` / `RUN CI=true pnpm --filter=backend deploy --prod /prod/backend`
  - 상세: `deploy` 스테이지는 `builder`(→`deps` 에서 `pnpm install --frozen-lockfile --filter "backend..."` 로 이미 해소된 그래프) 위에서 동작하므로, 이미 고정된 lockfile 그래프를 그대로 추출·격리(isolated) 링크할 뿐 레지스트리 재해석을 하지 않는다. plan 문서 기록상 injected deploy 전환 후 e2e(253, `schedule-trigger` 포함) 전부 통과했고, backend 직접 의존 `cron-parser@^5.5.0` 과 `bullmq` 전이 의존 `cron-parser@4.9.0` 이 각각 올바르게 분리 해소됨을 검증했다(legacy flat deploy 가 겪던 오해소는 injected 전환으로 해소). 즉 이번 diff 자체가 핀·패치 버전을 회귀시키는 벡터는 아니다. 다만 `deploy` 커맨드에 `--frozen-lockfile` 상당의 명시적 가드가 없어 안전성이 "스테이지 순서에 대한 암묵적 가정"에 의존한다.
  - 제안: 필수는 아니나, (b) devDeps 부재 CI 스모크 가드 작업과 함께 "deploy 산출물의 패키지 버전이 lockfile 과 일치"를 확인하는 체크 추가를 고려.

- **[INFO] 공격표면 축소 — devDeps·프런트 스택·원본 TS 소스 제거는 보안상 순이익**
  - 위치: `codebase/backend/Dockerfile` runner 스테이지 전체
  - 상세: 최종 런타임 이미지에서 `next`/`@next`/`three`/`lucide-react`/`playwright` 등 프런트엔드·테스트 스택(600MB+)과 backend 원본 TypeScript 소스가 제거되고, `node_modules`(prod 의존 + `@workflow/*` 주입만)·`dist`(컴파일 산출물)·`package.json` 만 선별 COPY 된다(이미지 1.23GB→551MB, −55%). 컴프로마이즈 시 공격자가 활용 가능한 코드실행 보조 도구(eslint/jest/ts-node/webpack 등)와 소스 노출 표면이 줄고, 백엔드 런타임 프로세스 네임스페이스에 프런트엔드 전이 의존성이 존재하지 않게 되는 효과가 있다. `--chown=node:node` COPY + `USER node` 전환 순서(런타임 non-root 권한 모델)도 변경 전과 동일하게 유지됨을 확인했다.
  - 제안: 없음(양호). 유지 권장.

- **[INFO] 선별 COPY 로 인해 런타임 필수 파일이 누락되지는 않았는지 점검 — 문제 없음 확인**
  - 위치: `codebase/backend/Dockerfile` runner COPY 목록(`node_modules`, `package.json`, `dist`); `codebase/backend/nest-cli.json`(assets 설정 없음); `src/nodes/data/code/code.handler.ts`(`require.resolve('dayjs/dayjs.min.js')`); `src/modules/mail/mail.module.ts`
  - 상세: `nest-cli.json` 에 `assets` 복사 설정이 없어 `tsc` 컴파일 산출물(`dist`) 외 별도 정적 자산(템플릿·i18n 등)이 필요하지 않다. `MailerModule` 도 템플릿 어댑터 없이 `jsonTransport`/SMTP 전송만 사용해 hbs 등 파일 의존이 없다. isolated-vm 코드 노드가 `require.resolve('dayjs/dayjs.min.js')` 로 dayjs UMD 소스를 런타임에 읽어 샌드박스에 주입하는데, `dayjs` 는 backend `dependencies`(devDependencies 아님)이므로 `pnpm deploy --prod` 산출 `node_modules` 에 포함되어 문제없다. ops 스크립트(`dist/scripts/cleanup-invalid-queue-jobs.js`, `dist/scripts/encrypt-auth-config.js`)도 `dist` 전체가 COPY 되므로 보존된다. `codebase/backend/migrations/*.sql` 는 별도 Flyway 전용 `Dockerfile` 로 이 런타임 이미지와 무관.
  - 제안: 없음(검증 완료).

- **[INFO] 인젝션·시크릿·인증/인가·에러 처리 항목은 해당 없음**
  - 위치: 전체 diff
  - 상세: 이번 변경은 Docker 멀티스테이지 빌드 구성과 pnpm workspace 설정(1줄)에 국한되며, 애플리케이션 코드·API 엔드포인트·인증 로직·입력 처리 로직 변경이 없다. 하드코딩된 시크릿·자격증명도 diff 내 발견되지 않았다. `pnpm-lock.yaml` diff 는 `injectWorkspacePackages: true` 1줄 뿐이고 실제 패키지 버전 변경(dependency version churn)은 없음을 확인했다.

## 요약

이번 변경은 backend 프로덕션 이미지를 hoisted flat `node_modules` 통째 복사에서 `pnpm deploy`(injected) 기반 self-contained 번들로 교체해 이미지 크기를 55% 줄이고, 프런트엔드/테스트 스택과 backend 원본 TypeScript 소스를 런타임 이미지에서 제거함으로써 공격 표면을 실질적으로 축소했다 — 보안 관점에서 순이익이며, 선별 COPY 가 dayjs UMD 로드·ops 스크립트 등 런타임 필수 자산을 누락시키지 않았음도 직접 점검했다. `pnpm deploy` 자체도 이미 `--frozen-lockfile` 로 고정된 그래프를 그대로 추출하는 구조라 이번 diff 가 핀·패치 버전을 회귀시키지는 않는다. 다만 오케스트레이터가 지적한 대로, pnpm 10.23 이 `package.json` 의 `pnpm.overrides`(23개 CVE/호환 핀)·`pnpm.onlyBuiltDependencies`(native 빌드스크립트 allow-list)를 더 이상 읽지 않는다는 사실을 로컬에서 직접 재현·확인했다 — 현재는 CI/Dockerfile 전역의 `--frozen-lockfile` 일관 사용 덕에 lockfile 관성으로만 안전이 유지되고 있으며, 이 상태를 감지·강제하는 CI 가드가 없어 향후 비고정(non-frozen) install 한 번으로 보안 핀이 조용히 소실될 수 있는 latent 리스크가 남아 있다. 개발팀 스스로 plan 문서에 이 이슈를 후속 과제로 이미 기록해 두었다는 점은 긍정적이나, 실측 재현된 만큼 우선순위를 앞당길 것을 권고한다.

## 위험도

LOW
