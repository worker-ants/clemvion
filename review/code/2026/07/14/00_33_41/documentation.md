# 문서화(Documentation) 리뷰

대상: `codebase/backend/Dockerfile`(deploy/runner 스테이지 재작성), `pnpm-workspace.yaml`(`injectWorkspacePackages: true` 추가), `pnpm-lock.yaml`(lockfile 반영), `plan/in-progress/pnpm-migration-followups.md`(추적 문서 갱신).

## 발견사항

- **[WARNING] PROJECT.md 의 `pnpm.overrides` 안내가 이번 변경으로 새로 드러난 사실과 불일치**
  - 위치: `PROJECT.md` §버전·도구 정책 "버전 핀 정책" 항목 (약 43번째 줄) — "보안 취약점 등으로 전이 의존성을 강제할 때는 루트 `package.json` 의 `pnpm.overrides` 를 쓴다"
  - 상세: 이번 diff 와 같은 작업 세션에서 갱신된 `plan/in-progress/pnpm-migration-followups.md` 의 "부수 발견" 절이 **pnpm 10.23 은 `package.json` 의 `pnpm.overrides`/`pnpm.onlyBuiltDependencies` 를 더 이상 읽지 않는다**(`The "pnpm" field ... is no longer read` 경고 실측)고 명시한다. 실제로 root `package.json` 은 여전히 `pnpm.overrides`(`@nestjs/swagger` 11.2.7 포함)를 그 위치에 선언하고 있어(직접 확인), 현재 핀은 "lockfile 관성"으로만 유지되는 상태다. 그런데 `PROJECT.md` 는 여전히 "핀이 필요하면 `package.json` 의 `pnpm.overrides` 를 쓰라"고 안내해 — 이 안내를 따라 non-frozen `pnpm install` 로 새 오버라이드를 추가하면 **조용히 무시되어 의도한 보안 패치가 적용되지 않을 위험**이 있다. 정식 수정(오버라이드를 `pnpm-workspace.yaml` 로 이전)은 plan 문서에서 "§2(swagger 핀)와 함께 다룰 것"으로 이미 별도 후속으로 명시적으로 미뤄졌으나, 그 사이 기간 동안 `PROJECT.md` 를 보고 작업하는 다른 개발자는 이 사실을 모른 채 안내를 따를 수 있다.
  - 제안: 후속 PR 이 실제로 이전하기 전까지, `PROJECT.md` "버전 핀 정책" 항목에 한 줄 경고 각주를 추가 — 예: "(주의: pnpm 10.23 부터 `package.json` 의 `pnpm.overrides` 는 install 시 무시된다는 보고 있음 — 신규 오버라이드 추가 전 `plan/in-progress/pnpm-migration-followups.md` §1 부수 발견 확인)". 혹은 후속 PR 을 이번 스프린트 내로 앞당겨 근본 해결.

- **[INFO] README.md Docker 빌드 컨텍스트 주석의 용어가 pnpm workspace 실제 프로토콜과 불일치 (pre-existing, 이번 diff 범위 밖)**
  - 위치: `README.md` "## Docker / Kubernetes 배포" → "### 빌드" 절, "세 이미지 모두 **repo 루트가 빌드 컨텍스트**입니다 (`codebase/packages/*` 의 `file:` 의존성을 트래킹하기 위함)."
  - 상세: 현재 내부 패키지는 `workspace:*` 프로토콜로 참조된다(`pnpm-lock.yaml`, `codebase/backend/package.json` 등에서 확인 — 예: `@workflow/expression-engine: specifier: workspace:*`). `file:` 표기는 npm 시절 문구가 pnpm 전환 후 갱신되지 않고 남은 것으로 보인다. 이번 diff 가 직접 건드리는 영역은 아니지만, 같은 PR 이 Dockerfile 의 workspace 참조 방식(§`deploy`/injected copy)을 다루는 만큼 함께 정정할 좋은 기회다.
  - 제안: `file:` → `workspace:*` 로 문구만 교정 (별도 PR 이어도 무방, 리스크 없는 opportunistic fix).

- **[INFO] 새 runner 이미지에는 root `package.json`/`packageManager` 핀이 더 이상 존재하지 않음 — 운영 스크립트 호출 관례가 문서화되어 있지 않음**
  - 위치: `codebase/backend/Dockerfile` `runner` 스테이지 (`WORKDIR /app/codebase/backend`, `COPY --from=deploy .../package.json`)
  - 상세: 종전 runner 는 `/app` 전체(= root `package.json` 의 `packageManager` 핀 포함)를 옮겼으나, 신규 runner 는 `deploy` 산출물인 backend 자신의 `package.json`(=`packageManager` 필드 없음, 직접 확인)만 갖는다. `corepack enable` 은 있지만 인접 root manifest 의 pnpm 버전 핀이 없다. `PROJECT.md` 의 운영 스크립트 안내(`docker compose exec backend pnpm run cleanup:queue-jobs` 등)는 로컬 `docker-compose.yml` 의 `backend` 서비스(= `target: deps`, root `package.json` 포함)를 대상으로 하므로 현재는 영향이 없다. 다만 k8s/production 의 `runner` 이미지에 대해 향후 동일한 유지보수 스크립트를 `pnpm run` 으로 실행하려 시도하면(현재 어떤 문서에도 이런 절차가 명시돼 있지 않음) 예상과 다르게 동작할 수 있다.
  - 제안: 당장 문서를 바꿀 필요는 없으나(현재 어떤 문서도 이 경로를 약속하지 않음), 향후 k8s 운영 런북을 작성할 때는 "`runner` 이미지 안에서는 `node dist/scripts/<name>.js` 로 직접 호출 — `pnpm run` 은 root manifest 부재로 비대상" 이라는 점을 명시하도록 백로그에 짧게 남겨두면 좋다.

## 잘 된 점 (참고용, 감점 아님)

- `codebase/backend/Dockerfile` 의 `deploy`/`runner` 스테이지 주석은 이례적으로 충실하다 — *왜* legacy(flat) deploy 를 버렸는지(cron-parser 버전 collapse → schedule 400 버그, 재현 e2e 명시), `injectWorkspacePackages` 가 무엇을 바꾸는지, `node-linker` 는 왜 hoisted 로 유지하는지, target 디렉터리가 워크스페이스 밖이어야 하는 이유까지 diff 자체에서 자기완결적으로 설명한다. 코드와 주석 간 불일치 없음(라인별 대조 완료).
- `pnpm-workspace.yaml` 에 추가된 `injectWorkspacePackages: true` 옆 주석도 근거(`ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`)와 `node-linker` 불변 사실을 정확히 남겼다.
- `plan/in-progress/pnpm-migration-followups.md` 의 "1-(a) 완료" 절은 대안 비교(legacy vs injected), 검증 결과(lint/unit/build/e2e 253, 이미지 크기 1.23GB→551MB), 잔여 항목, 그리고 부수 발견(pnpm 필드 무시)까지 투명하게 기록 — 이 프로젝트의 plan 라이프사이클 관례(작업 추적 단일 진실)에 정확히 부합한다.
- `CHANGELOG.md` 는 이 저장소 관례상 spec-linked 제품/동작 변경만 기록하며 순수 빌드/인프라 최적화는 대상이 아님을 기존 항목들로 재확인했다 — 이번 변경에 CHANGELOG 항목이 없는 것은 결함이 아니라 관례 일치.
- `docker-compose.e2e.yml`/`docker-compose.yml` 은 Dockerfile 의 `deps`/`builder`/`runner` 스테이지명만 참조하고(`prod-deps`→`deploy` 개명은 내부 중간 스테이지라 외부에서 이름으로 참조되지 않음), README/PROJECT.md 도 내부 스테이지 구성을 서술하지 않으므로 이번 스테이지 재구성 자체는 그 문서들을 stale 하게 만들지 않는다.
- 신규 환경변수·설정 옵션은 도입되지 않았다(`injectWorkspacePackages` 는 pnpm workspace 설정이지 런타임 env 아님) — "설정 문서" 관점에서 별도 `.env`/README 환경변수 표 갱신 불필요.

## 요약

이번 변경은 Dockerfile 내부 주석과 plan 추적 문서 자체의 문서화 품질이 매우 높고(대안 비교·수치 근거·회귀 재현까지 기록), 스테이지 개명(`prod-deps`→`deploy`)이 README/PROJECT.md/docker-compose 등 외부 문서가 참조하지 않는 내부 세부사항이라 그 문서들에 즉각적인 stale 화를 유발하지 않는다. 다만 같은 작업에서 발견된 "pnpm 10.23 이 `package.json` 의 `pnpm.overrides` 를 더 이상 읽지 않는다"는 사실이 `PROJECT.md` 의 기존 버전 핀 정책 안내와 이미 어긋나 있음에도 그 문서 쪽에는 아직 아무 경고도 남지 않았다는 점이 가장 눈에 띄는 갭이며, 그 외에는 README 의 오래된 `file:` 표기(pre-existing)와 신규 runner 이미지의 pnpm 해상도 root 부재에 대한 향후 운영 문서화 필요성 정도의 경미한 opportunistic 항목뿐이다.

## 위험도

LOW
