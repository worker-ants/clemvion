# 요구사항(Requirement) Review — Dockerfile 동봉 위젯 자급 빌드

리뷰 대상 커밋: `2a2d0375`  
변경 파일: `codebase/frontend/Dockerfile`, `k8s/README.md`, `spec/7-channel-web-chat/0-architecture.md`  
관련 spec: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/0-architecture.md §4.1`

---

## 발견사항

### [INFO] deps 스테이지 `--filter "@workflow/web-chat..."` 의 의미
- 위치: `Dockerfile` L37–40
- 상세: `--filter "@workflow/web-chat..."` 는 `@workflow/web-chat` 과 그 **workspace 의존성 전체**를 설치한다. `@workflow/web-chat`(= `codebase/packages/web-chat-sdk`)의 devDependencies에 `esbuild`가 포함돼 있어 `build:loader` 실행에 필요한 도구가 설치된다. 이 패키지는 `frontend` 의 package.json 직접 의존이 아니므로 별도 `--filter` 추가가 필수이며, 변경이 이를 정확히 처리한다.
- 제안: 변경 없이 유지. 분석상 의도·구현 일치.

### [INFO] `web-chat-sdk` 소스는 `deps` 스테이지에서 이미 COPY됨
- 위치: `Dockerfile` L33, L53
- 상세: 주석 "web-chat-sdk 소스는 deps 의 `COPY codebase/packages` 로 이미 존재" 는 정확하다. `codebase/packages/web-chat-sdk`는 `COPY codebase/packages ./codebase/packages` (L33)에 포함되므로 `builder` 스테이지에서 중복 COPY 없이 바로 사용 가능.

### [INFO] `copy-widget.mjs` 의 내부 빌드 흐름 — `build:loader` 는 `prepare` 와 별개
- 위치: `codebase/frontend/scripts/copy-widget.mjs` L45, `codebase/packages/web-chat-sdk/package.json` scripts
- 상세: `web-chat-sdk`의 `prepare` 스크립트는 `tsc`만 실행하고 `esbuild`(`build:loader`)는 실행하지 않는다. 따라서 `pnpm install` 후 `dist/loader.js`는 존재하지 않는다. `copy-widget.mjs`는 `pnpm --filter @workflow/web-chat build:loader`를 명시적으로 호출해 `loader.js`를 생성한다 — 이 흐름이 정확히 구현돼 있다.

### [INFO] `.dockerignore` — `spec/`, `review/`, `plan/` 제외 확인
- 위치: `.dockerignore` root
- 상세: `.dockerignore`는 `spec/`, `review/`, `plan/` 등 개발 전용 디렉터리를 제외하지만 `codebase/channel-web-chat`은 제외하지 않는다. 따라서 `COPY codebase/channel-web-chat ./codebase/channel-web-chat` (builder L54)이 정상 동작한다. 의도와 일치.

### [INFO] [SPEC-DRIFT] spec §4.1 이전 "빌드 파이프라인 복사" 표현이 구현보다 구체성 부족했음
- 위치: `spec/7-channel-web-chat/0-architecture.md §4.1` (변경된 부분)
- 상세: 이전 spec은 동봉 방식을 "빌드 파이프라인 복사"로만 표현해 호스트 선행 실행이 전제됐다. 이번 변경은 spec 본문을 "frontend Dockerfile builder 스테이지 내부 자급"으로 명확화했다. 코드(Dockerfile) 변경이 의도적이고 합리적이며 spec이 구현을 따라잡은 것 — 이미 이번 커밋에서 spec 갱신이 동반돼 처리 완료.
- 제안: 코드 유지. spec 갱신이 동일 커밋에서 완료됨.

---

## 기능 완전성 평가

### 핵심 기능 흐름

1. **deps 스테이지**: `corepack enable` → pnpm workspace 전체 manifest COPY → `COPY codebase/packages` (web-chat-sdk 포함) → `pnpm install --frozen-lockfile --filter "frontend..." --filter "channel-web-chat..." --filter "@workflow/web-chat..."` ✓
2. **builder 스테이지**: `COPY codebase/channel-web-chat` → `COPY codebase/frontend` → `pnpm --filter frontend build:widget` (copy-widget.mjs 실행: channel-web-chat next build + web-chat-sdk build:loader → `public/_widget/web-chat/v1/` 생성) → `pnpm --filter frontend build` ✓
3. **runner 스테이지**: `COPY --from=builder .../frontend/public ./codebase/frontend/public` → `public/_widget/web-chat/v1/` 포함된 이미지 완성 ✓

모든 단계가 논리적으로 연결되고, 커밋 메시지의 검증 절차(docker build --target builder 후 `public/_widget/web-chat/v1/{app/index.html,loader.js}` 확인)와 구현이 일치한다.

### 엣지 케이스

- `copy-widget.mjs`는 `widgetOut`, `loaderJs` 파일 존재 여부를 `existsSync`로 검증 후 throw — 빌드 실패 시 명시적 오류 발생 ✓
- `--frozen-lockfile` 사용으로 lockfile 불일치 시 빌드 실패 → CI 회귀 방지 ✓

### k8s/README.md 동기화

`§6 NEXT_PUBLIC_*` 섹션에서 구 "build:widget 선행 필수" 안내와 `pnpm --filter frontend build:widget` 명령이 제거되고 "docker build 만 하면 됨" 으로 정확히 갱신됐다. 로컬 이미지 빌드 섹션도 동일하게 갱신 ✓.

### TODO/FIXME 없음

세 파일 모두 `TODO`, `FIXME`, `HACK`, `XXX` 주석 없음 ✓.

---

## 요약

이번 변경은 `codebase/frontend/Dockerfile`의 `deps` 스테이지에 `channel-web-chat` 및 `@workflow/web-chat` 필터를 추가하고, `builder` 스테이지에서 소스 COPY 및 `build:widget` 실행을 삽입해 위젯 번들을 이미지 내부에서 자급 빌드한다. 모든 빌드 단계의 의존 순서(manifest COPY → install → source COPY → build:widget → next build → runner COPY)가 올바르고, `copy-widget.mjs`의 내부 로직(channel-web-chat next build + web-chat-sdk build:loader + existsSync 검증)과도 완전히 정합한다. `k8s/README.md`와 `spec §4.1`도 동일 커밋에서 동기화돼 문서·코드 불일치가 없다. 기능 완전성 관점에서 의도한 "외부 CI는 docker build 만으로 위젯 포함 이미지 산출" 요구사항이 완전히 충족된다.

---

## 위험도

NONE
