# 의존성(Dependency) 리뷰

리뷰 대상 커밋: `2a2d0375` — `fix(web-chat): Dockerfile 동봉 위젯 자급 빌드`

변경 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/Dockerfile`
- `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/k8s/README.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/0-architecture.md`

---

## 발견사항

### 발견 1

- **[INFO]** 새 외부 패키지 없음 — 기존 workspace 내부 패키지(channel-web-chat, @workflow/web-chat)를 deps 설치 스코프에만 추가
  - 위치: `Dockerfile` 37–40행 `pnpm install --frozen-lockfile --filter` 확장
  - 상세: 이번 변경은 `npm install` / 새 registry 패키지 추가가 없다. `channel-web-chat`·`@workflow/web-chat`(= `codebase/packages/web-chat-sdk`) 은 이미 `pnpm-workspace.yaml` 에 등록된 workspace 내부 패키지다. `pnpm install --frozen-lockfile` 이므로 `pnpm-lock.yaml` 변경 없이 기존 lockfile 그대로 재사용한다.
  - 제안: 현 상태 유지. 외부 의존 0 추가 방침이 명시적으로 지켜짐.

### 발견 2

- **[INFO]** lockfile 고정 — `--frozen-lockfile` 지속 유지
  - 위치: `Dockerfile` 37행
  - 상세: `--frozen-lockfile` 플래그가 기존 필터와 신규 필터 모두에 유지된다. lockfile drift 없이 재현 가능한 빌드다.
  - 제안: 현 상태 유지.

### 발견 3

- **[INFO]** channel-web-chat 의 Next.js 버전 범위가 frontend 와 미세하게 다름
  - 위치: `codebase/channel-web-chat/package.json` `"next": "^16.2.6"` vs `codebase/frontend/package.json` `"next": "^16.2.3"`
  - 상세: pnpm workspace 단일 lockfile 환경에서 두 범위는 같은 resolve 결과(^16.2.x 최신)로 수렴한다. `--frozen-lockfile` 이 단일 잠긴 버전을 재사용하므로 실제 충돌은 없다. 그러나 두 범위가 다르면 lockfile 갱신 시 의도치 않게 channel-web-chat 만 별도 버전이 잠길 수 있다.
  - 제안: 두 패키지의 `"next"` 범위를 동일하게(`"^16.2.6"` 또는 공통 값으로) 정렬. 이번 커밋 범위 외 작업이라 즉각 차단 사항은 아니다.

### 발견 4

- **[INFO]** 빌드 시간 증가 예상 — channel-web-chat 17개 + @workflow/web-chat 11개 패키지 추가 설치
  - 위치: `Dockerfile` deps 스테이지 `pnpm install` 확장
  - 상세: channel-web-chat(5 prod + 12 dev)·@workflow/web-chat(0 prod + 11 dev) deps 가 새로 설치 대상에 포함된다. 대부분이 Next.js·React·TypeScript·esbuild·vitest 등 frontend 스코프에도 이미 존재하는 패키지라 pnpm hoist 환경에서는 실제 다운로드는 최소화된다. Docker layer 캐시(`COPY package.json` + `RUN pnpm install` 패턴)가 유지되므로 재빌드 오버헤드도 크지 않다.
  - 제안: 현 구조 유지. 최초 cold-build 시 빌드 시간이 다소 증가할 수 있으나 허용 범위 내.

### 발견 5

- **[INFO]** copy-widget.mjs 가 builder 스테이지 내에서 `pnpm` 호출 — pnpm 가용성 전제 충족 확인
  - 위치: `codebase/frontend/scripts/copy-widget.mjs` 42·45행 `execSync("pnpm --filter ...")`
  - 상세: builder 스테이지는 `FROM deps AS builder` 로, deps 스테이지에서 `corepack enable` + `pnpm install` 이 실행되어 pnpm 이 PATH 에 등록된다. 따라서 builder 에서 `pnpm` 재호출은 의존 경로 충족. runner 스테이지에는 전파되지 않으며 최종 이미지에 devDependencies 포함 없음.
  - 제안: 현 상태 유지.

### 발견 6

- **[INFO]** .dockerignore 의 `**/dist` 규칙 — @workflow/web-chat(packages/web-chat-sdk) dist 제외 여부
  - 위치: `.dockerignore` 3행 `**/dist`
  - 상세: packages/web-chat-sdk 의 `prepare` 스크립트(`"prepare": "[ -d dist ] || tsc"`)가 pnpm install 중 dist 를 빌드하며, .dockerignore 가 호스트의 dist 를 COPY 대상에서 제외한다. 이는 의도된 설계(컨테이너 내부에서 tsc 재빌드)이며 `codebase/packages` COPY 이후 install 시 dist 가 생성되는 흐름이 올바르다.
  - 제안: 현 상태 유지.

---

## 요약

이번 변경은 새 외부 npm 패키지를 전혀 추가하지 않는다. `channel-web-chat`·`@workflow/web-chat` 은 기존 pnpm workspace 내부 패키지이며, Dockerfile 에서 `--filter` 범위만 확장해 이미 lockfile 에 존재하는 의존성을 같은 빌드 컨텍스트 안에서 설치·빌드한다. `--frozen-lockfile` 이 유지되어 재현성이 보장되며, 라이선스·보안 취약점·버전 충돌 위험이 새로 발생하지 않는다. 경미한 주의사항으로 channel-web-chat 의 Next.js 범위(`^16.2.6`)가 frontend(`^16.2.3`)와 미세하게 다르지만 단일 lockfile 환경에서 실질적 충돌은 없다. 전반적으로 의존성 관점 위험이 없는 변경이다.

## 위험도

NONE
