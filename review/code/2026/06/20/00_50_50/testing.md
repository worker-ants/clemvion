# Testing Review — build(deps): npm → pnpm workspace 모노레포 전환

## 발견사항

### [INFO] 테스트 커맨드 참조 일관성 — 전환 완료, 누락 없음
- 위치: `.claude/test-stages.sh`, `PROJECT.md`, spec 문서들(cafe24/makeshop catalog), plan 파일
- 상세: `npm test`, `npm run lint`, `npm run build` 등 모든 npm 커맨드 참조가 `pnpm --filter <pkg> <script>` 로 일관되게 교체되었다. spec 문서 3개(`cafe24-api-catalog/_overview.md`, `cafe24-restricted-scopes.md`, `makeshop-api-catalog/_overview.md`)의 `npm test --workspace backend` 도 `pnpm --filter backend test` 로 정정되었다.
- 제안: 없음 — 전환 범위 내에서 누락 없이 완료되었다.

### [INFO] 테스트 하니스 `_ensure_deps()` — node_modules 체크만으로 충분한지 재확인 권고
- 위치: `.claude/test-stages.sh` `_ensure_deps()` 함수 (라인 184–186)
- 상세: `[ -d node_modules ] || pnpm install --frozen-lockfile` 은 루트 `node_modules` 디렉터리의 존재만 확인한다. CI 환경에서는 `node_modules`가 캐시 히트로 존재하지만 lockfile이 변경된 경우에도 이 조건을 통과한다. CI 워크플로에서는 별도 `pnpm install` step이 있어 문제없지만, 로컬 `.claude/tools/run-test.sh` 경로에서 lockfile 변경 후 `node_modules`가 stale 상태일 때 테스트가 오래된 의존성으로 통과할 수 있다.
- 제안: 로컬 하니스 한정 우려이므로 즉각 수정은 불필요하나, 향후 `pnpm install --frozen-lockfile` 을 조건 없이 항상 호출하도록 단순화하는 것을 고려할 수 있다. pnpm은 lockfile 변경이 없으면 no-op에 가깝게 빠르게 종료한다.

### [WARNING] CI playwright-runner — `corepack enable` 이 `sh -c` 인라인 커맨드 체인 첫 번째 단계에 위치
- 위치: `docker-compose.e2e.yml` playwright-runner `command` (라인 2251)
- 상세: `"corepack enable && pnpm install --frozen-lockfile --filter frontend... && ..."` 와 같이 corepack 활성화와 설치를 단일 `sh -c` 인라인으로 묶고 있다. `mcr.microsoft.com/playwright:v1.59.1-jammy` 이미지에 corepack이 기본 포함되어 있지 않거나 비활성화 상태일 경우 `corepack enable` 이 실패하면 이후 모든 단계가 중단된다. playwright CI는 커밋 메시지 검증 항목에 "CI 미검증: frontend playwright(cross-platform 로컬 한계)"로 명시되어 있어 아직 CI 경로에서 실행이 확인되지 않은 상태다.
- 제안: playwright-runner용 별도 `Dockerfile` 이나 `entrypoint.sh`를 두어 corepack 활성화를 이미지 레이어에서 처리하거나, jammy 이미지에서 corepack 가용 여부를 CI에서 한 번 검증한다. 단기적으로는 `corepack enable || npm i -g pnpm@10.23.0` fallback을 추가하는 것도 방어 수단이 된다.

### [WARNING] backend Dockerfile runner 단계 — devDependencies 포함 전송
- 위치: `codebase/backend/Dockerfile` runner 단계 (라인 1202)
- 상세: `COPY --from=builder --chown=node:node /app ./` 는 workspace 전체(devDependencies 포함)를 runner 이미지에 복사한다. 주석에 "devDeps 까지 포함 — 이미지 크기 최적화는 후속 과제"로 명시되어 있어 의도된 임시 상태이다. 그러나 이는 프로덕션 이미지에 테스트 관련 패키지(jest, ts-jest, @types/*, typescript 등)가 포함됨을 의미한다. 보안 면적(attack surface) 확대 및 이미지 크기 증가의 부작용이 있다.
- 제안: 이미지 크기 최적화 후속 PR에서 `pnpm deploy --prod` 또는 `--prod` 플래그로 prune된 workspace snapshot을 runner 이미지에 배치하는 방식을 채택하도록 plan 항목으로 등록한다.

### [INFO] e2e `docker-compose.e2e.yml` playwright-runner — anonymous volume 마스킹 대상 패키지 범위
- 위치: `docker-compose.e2e.yml` playwright-runner volumes (라인 2243–2246)
- 상세: `expression-engine`, `node-summary`, `chat-channel-validation`, `graph-warning-rules` 의 `node_modules`는 anonymous volume으로 마스킹하지만, `web-chat-sdk`와 `sdk` 패키지는 포함되지 않았다. hoisted 레이아웃(`node-linker=hoisted`)에서는 이 패키지들의 `node_modules`가 루트 `/app/node_modules`에 hoist 되어 실제로 패키지별 `node_modules`가 존재하지 않을 수 있으므로 실질적 영향은 제한적이다. 그러나 hoist 되지 않는 패키지 고유 의존성이 있다면 호스트 macOS 바이너리가 컨테이너로 누출될 수 있다.
- 제안: 현 hoisted 설정에서 실질적 위험은 낮으나, 새 패키지가 workspace에 추가될 때 anonymous volume 목록도 함께 관리해야 한다는 점을 주석으로 명시한다.

### [INFO] 기존 테스트 수 유지 확인 — 커밋 메시지 로컬 검증 통과
- 위치: 커밋 메시지 검증 항목
- 상세: 커밋 메시지에 "unit(backend 7128·frontend 4486·web-chat 191·web-chat-sdk 40)" 및 "e2e 205 passed"로 기존 테스트 전수가 통과했음이 명시되어 있다. 패키지 매니저 전환 자체는 테스트 로직을 변경하지 않으므로 회귀 위험은 낮다.
- 제안: 없음.

### [INFO] `_ensure_web_chat_deps` 제거 — 격리성 향상
- 위치: `.claude/test-stages.sh`
- 상세: 이전의 `_ensure_web_chat_deps`는 `[ -d node_modules ] || npm ci` 로 상태에 의존하는 비결정적 로직이었다. pnpm workspace 전환으로 이를 제거하고 단일 `_ensure_deps`로 수렴하여 테스트 환경 초기화의 결정성이 높아졌다. 각 `cmd_*` 함수가 `_ensure_deps` 를 먼저 호출하는 구조도 함수 간 실행 순서 의존성을 제거한다.
- 제안: 없음 — 긍정적 변화.

### [WARNING] `pnpm/action-setup@v4` — pnpm 버전 명시적 지정 없음
- 위치: `.github/workflows/frontend-checks.yml`, `.github/workflows/web-chat-checks.yml` (여러 job)
- 상세: `pnpm/action-setup@v4` 호출 시 `version` 파라미터를 명시하지 않고 `package.json`의 `packageManager` 필드에서 자동으로 읽도록 설계되어 있다. 이는 의도된 패턴이나, `pnpm/action-setup@v4`이 `packageManager` 필드를 정확히 읽지 못하는 엣지 케이스(루트 `package.json`이 checkout 전에 참조되는 타이밍 등)에서 fallback 버전이 사용될 수 있다. CI에서 버전 불일치가 lockfile 재현 실패로 이어질 수 있다.
- 제안: `pnpm/action-setup@v4`의 `packageManager` 자동 감지는 문서화된 기능이므로 현 접근 방식은 정상이다. 다만 처음 CI 실행 시 로그에서 사용된 pnpm 버전을 확인하여 `pnpm@10.23.0`과 일치하는지 검증한다.

## 요약

이번 변경은 npm → pnpm workspace 전환이라는 빌드 인프라 마이그레이션으로, 애플리케이션 로직 변경을 수반하지 않는다. 테스트 관점에서 핵심 변화는 `.claude/test-stages.sh`의 커맨드 교체와 `_ensure_web_chat_deps` 특수처리 제거이다. 커밋 메시지의 로컬 검증 기록(backend 7128·frontend 4486·e2e 205)으로 기존 테스트 전수 통과가 확인되어 회귀 위험은 낮다. 주요 우려 사항은 두 가지다: (1) playwright CI 경로가 아직 CI 환경에서 검증되지 않았으며 `corepack enable`이 jammy 이미지에서 실패할 경우 e2e 전체가 중단될 수 있다. (2) backend runner 이미지에 devDependencies가 포함되어 있어 프로덕션 배포에서 테스트 도구들이 attack surface에 노출된다. 전자는 CI에서 한 번 검증이 필요하고 후자는 알려진 후속 과제다.

## 위험도

LOW
