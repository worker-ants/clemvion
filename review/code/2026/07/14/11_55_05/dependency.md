# 의존성(Dependency) 리뷰 — codebase/backend/Dockerfile

## 검증 방법
- `codebase/backend/package.json` 의 `dependencies` 확인 → 내부 워크스페이스 의존은 `@workflow/chat-channel-validation`, `@workflow/expression-engine`, `@workflow/graph-warning-rules`, `@workflow/node-summary` 4개뿐(`sdk`, `web-chat-sdk` 없음).
- `pnpm --filter "backend..." list --depth -1` 실행 결과, backend + 위 4개 패키지만 나열됨 — closure 주장과 정확히 일치.
- 4개 패키지 각각의 `package.json` `dependencies`(외부 포함) 확인 → `expression-engine`→`dayjs`(외부) 외 나머지 3개는 무의존. 4개 중 어느 것도 `sdk`/`web-chat-sdk` 를 참조하지 않음 → 2-hop 이상의 전이 경유로 sdk/web-chat-sdk 가 필요해질 경로 없음.
- `sdk`, `web-chat-sdk` 의 `dependencies` 는 둘 다 비어 있고(`web-chat-sdk`→`sdk` 관계는 프런트 전용 소비처(`codebase/frontend`, `codebase/channel-web-chat`)의 `package.json` 에서만 확인됨), backend·backend 의 4개 closure 패키지와는 어떤 방향으로도 연결되지 않음. 그래프 상 완전히 분리된 컴포넌트.
- 4개 패키지의 `prepare` 스크립트는 모두 `[ -d dist ] || tsc` — `dist` 없으면 `tsc` 실행. COPY 가 소스 없이 manifest 만 있는 상태로 `--frozen-lockfile --filter "backend..."` 를 돌리면 해당 패키지 디렉터리에 `tsconfig.json`/`src` 가 없어 `tsc` 가 즉시 실패(no inputs found / tsconfig 없음) → install 단계에서 하드 실패. 설령 prepare 가 무해하게 통과하는 경우에도 이어지는 `builder` 스테이지의 `pnpm --filter backend build`(tsc 타입 체크)가 `@workflow/<pkg>` 모듈 해석 실패로 하드 실패. 즉 어느 경로로든 "조용히 깨지는" 시나리오는 없음.
- `.github/workflows/e2e.yml` 확인 — `paths-ignore` 가 `.claude/**, spec/**, plan/**, review/**, *.md` 뿐이라 `codebase/**` 변경 시 PR 마다 트리거되고, `docker compose -f docker-compose.e2e.yml build backend-e2e backend-e2e-runner` 로 실제 `codebase/backend/Dockerfile` 빌드를 수행 — "누락 COPY 는 build 스테이지 docker 검증이 포착" 주장이 실측 CI 게이트로 뒷받침됨.
- `pnpm-workspace.yaml` 의 `injectWorkspacePackages: true` 확인 — deploy(런타임 산출물) 단계의 injected copy 방식에는 영향 없음(이 diff 는 `deps` 스테이지의 COPY 목록만 변경, `deploy`/`runner` 스테이지는 무변경).

## 발견사항

- **[INFO]** Closure 분석은 정확함 (실측 재검증 완료)
  - 위치: `codebase/backend/Dockerfile` L34-45
  - 상세: PR 설명의 주장대로 backend 의 workspace 의존 closure 는 `expression-engine`, `node-summary`, `chat-channel-validation`, `graph-warning-rules` 4개가 전부이며, `sdk`/`web-chat-sdk` 는 이 4개 중 어느 것에서도 참조되지 않는 완전히 분리된 그래프 컴포넌트다(`pnpm --filter "backend..." list --depth -1` 로 직접 재확인). install/prepare 시점에 sdk/web-chat-sdk 소스가 전이적으로 필요해질 경로는 없다.
  - 제안: 없음(현행 유지).

- **[INFO]** `--frozen-lockfile` 검증 무영향 확인
  - 위치: L68-77 (manifest COPY 전체 유지)
  - 상세: 6개 패키지 전부의 `package.json` 을 COPY 하는 기존 로직은 그대로 유지되므로, lockfile 해시 검증에 필요한 전체 workspace manifest 그래프는 온전하다. 소스 COPY 범위만 backend closure 로 좁힌 것은 `--frozen-lockfile` 자체의 정합성과 무관하다.
  - 제안: 없음.

- **[INFO]** 누락 COPY 는 두 겹으로 하드 실패 처리됨(silent breakage 없음)
  - 위치: `deps` 스테이지(prepare/tsc) 및 `builder` 스테이지(`pnpm --filter backend build`)
  - 상세: 신규 내부 패키지를 backend 의존으로 추가하면서 소스 COPY 를 빠뜨릴 경우, `prepare` 스크립트(`[ -d dist ] || tsc`)가 소스 없는 디렉터리에서 실행되어 `deps` 스테이지에서 즉시 실패하거나, 설령 통과하더라도 `builder` 스테이지의 타입 체크가 `Cannot find module '@workflow/<pkg>'` 로 실패한다. `.github/workflows/e2e.yml` 이 `codebase/**` 변경 PR 마다 실제 이 Dockerfile 로 `docker compose build` 를 수행하므로, 이 실패는 CI 에서 확실히 표면화된다.
  - 제안: 없음. 다만 이 가드는 "PR CI 통과" 시점에야 발견되므로, 로컬 개발 중 더 빠른 피드백을 원하면 `make`/`package.json` 스크립트에 `docker build --target deps -f codebase/backend/Dockerfile .` 같은 로컬 사전 점검 커맨드를 문서화하는 것도 고려할 수 있다(선택 사항, 필수 아님).

- **[INFO]** 유지보수 부담은 기존 패턴의 연장선이며 새로 도입된 리스크 아님
  - 위치: Dockerfile 주석(L37-41)에 이미 "신규 backend 의존 내부 패키지 추가 시 여기에 COPY 를 보충" 명시
  - 상세: manifest COPY 목록(L69-77)은 이 diff 이전부터 이미 패키지 추가 시 수동으로 늘려야 하는 명시적 리스트였다. 이번 diff 는 동일한 "명시적 리스트 + 수동 추가" 패턴을 소스 COPY 목록에도 하나 더 얹은 것뿐이며, 새로운 종류의 실패 모드를 추가하지 않는다. 가드(CI docker build)도 이미 존재하는 것을 그대로 재사용한다.
  - 제안: 없음.

- **[INFO]** 빌드 캐시/시간 영향은 긍정적
  - 위치: Docker layer 캐싱 관점
  - 상세: 기존에는 `codebase/packages` 전체를 한 번에 COPY 했으므로 `sdk`/`web-chat-sdk`(프런트 전용) 소스 변경만으로도 backend 이미지의 `deps` 레이어 캐시가 무효화되어 불필요한 재설치가 발생했다. 이번 변경으로 backend 이미지 빌드는 실제로 필요한 4개 패키지 소스 변경에만 캐시가 반응하므로, CI/로컬 모두에서 불필요한 재빌드가 줄어든다. 외부 의존성 추가나 라이선스/취약점/번들 크기 문제는 없음(외부 패키지 변경 없음).
  - 제안: 없음.

## 요약
이번 변경은 새 외부 의존성 추가나 버전 변경이 전혀 없는 순수 Docker 빌드 레이어링 리팩터로, 유일한 리스크는 "backend closure 산정이 정확한가"였다. `pnpm --filter "backend..." list --depth -1` 실측과 4개 대상 패키지 및 `sdk`/`web-chat-sdk` 각각의 `package.json` 의존성 직접 대조로 closure 가 정확함을 재확인했으며, `sdk`/`web-chat-sdk` 는 backend 그래프와 완전히 분리되어 install/prepare 시점에 전이적으로 필요해질 경로가 없다. manifest COPY 는 6개 전부 유지되어 `--frozen-lockfile` 검증에도 영향이 없다. 향후 COPY 누락 시에도 `prepare`(tsc) 또는 `builder` 타입체크 단계에서 하드 실패하고, 이는 `codebase/**` 변경 PR 마다 도는 `e2e.yml` 의 실제 `docker compose build` 로 포착되므로 조용히 깨질 가능성은 없다. 유지보수 부담은 기존 manifest COPY 리스트 패턴의 연장이라 새로운 리스크 카테고리가 아니며, 부수 효과로 불필요한 Docker 레이어 캐시 무효화가 줄어 빌드 시간에도 긍정적이다.

## 위험도
NONE
