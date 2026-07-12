# 테스트(Testing) 리뷰 — pnpm-migration-followups (backend Dockerfile prod-deps 스테이지)

## 발견사항

- **[WARNING]** devDeps 제거(이 변경의 핵심 목적)를 검증하는 자동 회귀 테스트/가드 부재
  - 위치: `codebase/backend/Dockerfile` (신규 `prod-deps` 스테이지), `plan/in-progress/pnpm-migration-followups.md` L158 "완료" 기록
  - 상세: 이 변경의 목적은 runner 이미지에서 devDependencies 를 제거해 이미지 크기·공격 표면을 줄이는 것이다. 검증은 "docker build 성공 + e2e(253) 무회귀 + 이미지 1.4GB → 1.23GB" 로 **1회성 수기 확인**이며 plan.md 본문에 prose 로만 기록됐다. CI/e2e 파이프라인에는 (a) 최종 이미지의 `node_modules` 에 known devDep(예: `typescript`, `jest`, `eslint`, `ts-node`)이 실제로 없는지 확인하는 스모크 체크, (b) 이미지 크기 임계값 회귀 가드 중 어느 것도 없다. 향후 누군가 `prod-deps` 스테이지를 제거/우회하거나 `--filter` 표현식을 잘못 바꿔도(예: `--prod` 플래그 누락, 스테이지 순서 변경으로 `COPY --from=builder` 로 되돌림) 어떤 자동 테스트도 실패하지 않는다 — e2e 는 애플리케이션이 "동작"하는지만 보고 "devDeps 가 없는지"는 보지 않는다.
  - 제안: `docker-compose.e2e.yml`/CI 에 가벼운 스모크 스텝 추가를 검토. 예: `docker run --rm --entrypoint sh clemvion-e2e/backend:latest -c "test ! -d node_modules/typescript && test ! -d node_modules/jest"` 또는 `docker image inspect`/`docker history` 기반 크기 임계값 assert(예: `< 1.35GB`). CI 실패로 실제 회귀를 조기 포착할 수 있다.

- **[INFO]** native 모듈(bcrypt/isolated-vm) 재빌드 검증이 이 변경 전용 테스트가 아닌 기존 e2e 스위트에 우연히(incidental) 의존
  - 위치: `codebase/backend/Dockerfile` L41-43 (`prod-deps` 스테이지 주석 — "native(bcrypt/isolated-vm) 와 내부 패키지 prepare(tsc)를 재실행해야 한다")
  - 상세: `pnpm install --prod` 가 `node_modules` 를 지웠다 재구성하며 native addon 재컴파일이 필요하다는 리스크를 스스로 인지하고 있다. 이 재컴파일 성공 여부는 `test/app.e2e-spec.ts`(register/login → bcrypt 경로) 와 `code.handler`(isolated-vm) 를 건드리는 workflow 실행 e2e 가 통과함으로써 간접 확인된다. 다만 이 매핑은 이 PR 에서 명시적으로 의도된 것이 아니라 우연한 커버리지다 — 향후 두 native 모듈을 실제로 실행하는 e2e 스펙이 스킵되거나 제거되면 native 재빌드 실패가 조용히 놓칠 수 있다.
  - 제안: 필수는 아니나, Dockerfile 주석 혹은 plan.md 검증 절에 "bcrypt/isolated-vm 재빌드는 app.e2e-spec.ts(register/login) 및 code node 실행 e2e 로 간접 검증됨" 을 명시해 두면 향후 해당 스펙 삭제 시 이 의존성을 의식하게 할 수 있다.

- **[INFO]** e2e 회귀 비교가 "신선한(fresh) 이미지" 기준으로 이뤄졌는지는 구성상 확인됨 — 별도 조치 불요
  - 위치: `docker-compose.e2e.yml` L117-123 (`backend-e2e` `target: runner`), `Makefile` L49,59-60,73-74 (`--build` 플래그), `.github/workflows/e2e.yml` (`docker compose ... build backend-e2e backend-e2e-runner`)
  - 상세: 로컬 `make e2e-test`/`e2e-test-full` 과 CI 워크플로 모두 `backend-e2e` 서비스를 `--build`(강제 rebuild) 로 기동하고 `target: runner` 를 사용하므로, 이번 변경(런타임 이미지가 `builder` 대신 `prod-deps` 에서 COPY)이 실제로 e2e 검증 대상에 반영된다. Docker layer 캐시는 재사용될 수 있으나 스테이지 자체는 항상 재평가되므로 "stale 이미지로 인한 거짓 PASS" 리스크는 낮다. 이 점은 문제가 아니라 검증 신뢰도를 뒷받침하는 근거로 기록.

- **[INFO]** plan.md 완료 기록은 재현 가능한 근거(예: CI run URL, 실제 `docker images` 출력)에 대한 링크 없이 수치(1.4GB → 1.23GB, e2e 253)만 prose 로 기재
  - 위치: `plan/in-progress/pnpm-migration-followups.md` L158
  - 상세: 테스트 관점에서 "회귀 테스트가 유효한가"를 판단하려면 그 근거가 재현 가능해야 하는데, 현재는 텍스트 서술뿐이라 제3자가 사후에 검증하기 어렵다. 크리티컬한 문제는 아니며(다른 plan 완료 기록들도 동일 패턴), 관례상 허용되는 수준으로 판단.

## 요약

이번 변경은 애플리케이션 코드가 아닌 Docker 멀티스테이지 빌드 인프라(`prod-deps` 스테이지 신설)와 그 완료를 기록하는 plan 문서 갱신이라, 전통적 unit/integration 테스트 추가 대상은 아니다. 기존 e2e 스위트(`target: runner` + CI/Makefile 의 `--build` 강제 rebuild)가 이번 변경된 스테이지를 실제로 통과시켜 애플리케이션 기동·핵심 native 모듈(bcrypt/isolated-vm) 재빌드를 간접적으로 검증하고 있어 기능 회귀 위험은 낮다. 다만 이 변경의 본래 목적인 "devDependencies 실제 제거"를 보장하는 자동 회귀 가드(이미지 내 devDep 부재 스모크 체크 또는 크기 임계값 assert)가 전혀 없어, 향후 스테이지 구성이 실수로 되돌려져도 어떤 테스트도 이를 잡아내지 못한다는 점이 유일한 실질적 갭이다.

## 위험도
LOW
