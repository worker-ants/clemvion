# 의존성(Dependency) Review

## 발견사항

- **[INFO]** 신규 외부 의존성 없음 — 이번 diff 는 Docker 빌드 스테이지 재구성만
  - 위치: `codebase/backend/Dockerfile`
  - 상세: `prod-deps` 스테이지가 추가되지만 `pnpm install --prod --frozen-lockfile --filter "backend..."` 는 기존 `pnpm-lock.yaml` 을 그대로 재사용(frozen)하는 재해소(re-resolve)일 뿐, `package.json`/`pnpm-lock.yaml` 자체는 이번 diff 에 포함되지 않았다(`git diff origin/main --stat` 확인 결과 변경 파일은 Dockerfile·plan 문서 2건뿐). devDependencies 제거를 통해 오히려 최종 이미지의 패키지 수·공격 표면이 줄어드는 방향이라 의존성 리스크 관점에서는 개선(positive).
  - 제안: 없음(정보성).

- **[INFO]** 버전 고정 유지 확인 — `--frozen-lockfile` 로 재설치해도 pin 정합성 손상 없음
  - 위치: `codebase/backend/Dockerfile:43` (`FROM builder AS prod-deps` 블록)
  - 상세: `prod-deps` 스테이지가 `builder`(이미 `deps` 스테이지의 `pnpm install --frozen-lockfile --filter "backend..."` 결과를 상속) 위에서 다시 `--prod --frozen-lockfile` 로 재설치한다. `--frozen-lockfile` 이 두 스테이지 모두에 유지되므로 `pnpm-lock.yaml` 에 고정된 버전 그대로 재구성되고, `pnpm.overrides`(`@nestjs/swagger` 11.2.7 핀 등, `package.json:12-20`)·`onlyBuiltDependencies`(`isolated-vm`/`bcrypt`/`esbuild`, `package.json:36-39`)도 workspace-root 설정이라 `--prod` 여부와 무관하게 동일하게 적용된다(직접 확인). 버전 드리프트·핀 우회 위험 없음.
  - 제안: 없음(정보성, 검증 확인 완료).

- **[INFO]** 빌드 시간 트레이드오프 — native 모듈(bcrypt/isolated-vm) 재컴파일이 두 번 발생
  - 위치: `codebase/backend/Dockerfile:41-43` (`prod-deps` 스테이지)
  - 상세: `pnpm install --prod` 가 `node_modules` 를 지웠다 다시 링크하므로, 코멘트에 명시된 대로 native addon(bcrypt/isolated-vm)과 내부 워크스페이스 패키지의 `prepare`(tsc) 를 스테이지당 재실행한다. 즉 `deps` 스테이지에서 1회, `prod-deps` 스테이지에서 다시 1회, 총 2회 native 컴파일이 발생 — CI 빌드 시간이 늘어나는 트레이드오프다. plan 문서(`plan/in-progress/pnpm-migration-followups.md:200`)는 이미지 크기 before/after(1.4GB→1.23GB)만 기록하고 빌드 시간 before/after 는 기록하지 않았다.
  - 제안: 빌드 시간 영향(before/after)도 plan 문서에 함께 기록하면 향후 트레이드오프 판단(이미지 크기 vs CI 시간) 근거가 명확해진다. 필수는 아님.

- **[INFO]** 신규 devDependency 후보(`openapi3-ts`)는 실제 추가 아닌 조사 기록 — 향후 검토 필요
  - 위치: `plan/in-progress/pnpm-migration-followups.md:167` (`@nestjs/swagger` 핀 제거 조사 섹션)
  - 상세: `openapi3-ts` 는 이번 diff 에서 실제로 추가되지 않았고(`package.json`/`pnpm-lock.yaml` 미변경 확인), 향후 별도 PR 에서 `@nestjs/swagger` 11.2.7 pin 제거 작업 시 신규 devDependency 로 검토될 후보로만 기록되어 있다. 참고로 `openapi3-ts` 는 MIT 라이선스로 프로젝트와 호환되며 순수 타입 정의 패키지라 런타임 번들 크기 영향은 없다(devDependency).
  - 제안: 없음(정보성 — 실행 시점에 별도 PR 로 분리 결정이 이미 문서화되어 있고 라이선스·버전 bump 리스크도 사전에 서술됨. 현재 조치 불필요).

- **[INFO]** 내부 의존성 스코프(`--filter "backend..."`) 유지 — 불필요한 워크스페이스 확산 없음
  - 위치: `codebase/backend/Dockerfile:43`
  - 상세: `prod-deps` 스테이지도 `deps` 스테이지와 동일하게 `--filter "backend..."` 로 스코프를 유지해 backend + 그 워크스페이스 상류 의존(`codebase/packages/*`)만 재해소한다. frontend·channel-web-chat 등 무관 워크스페이스 프로젝트의 devDependencies 가 hoisted layout 을 통해 최종 이미지로 새어 들어올 여지는 없다.
  - 제안: 없음.

## 요약
이번 diff 는 신규 외부 패키지를 추가하지 않고, backend 프로덕션 Docker 이미지에서 devDependencies 를 prune 하는 `prod-deps` 빌드 스테이지만 신설한다(`pnpm-lock.yaml`/`package.json` 무변경 확인). `--frozen-lockfile` 유지로 버전 고정·`pnpm.overrides`/`onlyBuiltDependencies` 워크스페이스 설정이 그대로 적용되어 정합성 훼손이 없고, 오히려 최종 이미지의 패키지 수(devDeps 제거)가 줄어 공격 표면·이미지 크기가 감소(1.4GB→1.23GB, 검증 완료)하는 개선이다. 유일한 트레이드오프는 native 모듈(bcrypt/isolated-vm) 컴파일이 스테이지당 재실행되어 CI 빌드 시간이 다소 늘어난다는 점인데, 이는 plan 문서에 정량 기록되어 있지 않다(정보성, 차단 사유 아님). plan 문서에 별도 기록된 `openapi3-ts` 는 향후 별건 PR 후보일 뿐 이번 diff 의 실제 의존성 변경이 아니다.

## 위험도
NONE
