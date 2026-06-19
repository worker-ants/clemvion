# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] backend Dockerfile runner 에 devDependencies 포함 — 이미지 크기 미최적화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/codebase/backend/Dockerfile` runner 스테이지 (`COPY --from=builder --chown=node:node /app ./`)
- 상세: 이전에는 `npm prune --omit=dev` 단계가 있었으나 pnpm 전환 후 전체 workspace를 통째로 복사한다. devDependencies 가 프로덕션 이미지에 포함된다. 코드 주석이 이를 인정하며 "(devDeps 까지 포함 — 이미지 크기 최적화는 후속 과제)"라 명시하고 있다.
- 제안: 현재 상태로 기능 동작에는 영향 없다. 다만 이미지 크기 증가 및 불필요한 공격 표면 확장 위험이 있으므로 후속 PR 에서 `pnpm deploy --prod` 혹은 multi-stage 에서 `--prod-only` 설치로 개선 권장.

### [INFO] `_ensure_deps` 는 CWD 기준으로 `node_modules` 존재를 검사
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/.claude/test-stages.sh` L1 (`_ensure_deps()`)
- 상세: `[ -d node_modules ]` 가 CWD 기준이다. `run-test.sh` 는 `ROOT=$(git rev-parse --show-toplevel)` 를 구하지만 명시적 `cd $ROOT` 를 수행하지 않는다. 일반적으로 개발자가 워크트리 루트에서 `run-test.sh` 를 호출하므로 문제없지만, 다른 디렉터리에서 호출되면 `node_modules` 미감지로 재설치가 트리거된다. 기능에는 영향 없으나 동작이 CWD-sensitive.
- 제안: `[ -d "$ROOT/node_modules" ]` 또는 내부에서 `cd "$ROOT"` 후 나머지 명령 실행. 단 현재 동작 자체는 최악의 경우 불필요한 `pnpm install --frozen-lockfile` 재실행이라 크리티컬하지 않음.

### [INFO] `frontend-checks.yml` push 트리거에 `pnpm-workspace.yaml` 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/.github/workflows/frontend-checks.yml` `push.paths` 섹션
- 상세: `pull_request.paths` 에는 `pnpm-workspace.yaml` 이 포함되어 있으나, `push.paths` 에는 포함되지 않는다. workspace 구성 변경이 main 에 직접 push 될 때 frontend-checks 가 트리거되지 않는 간극이 있다. e2e.yml 은 `push` 에 `paths-ignore` 를 사용하여 CI 경로 필터를 통째로 역으로 처리하므로 이 패턴이 일관되지 않음.
- 제안: `push.paths` 에도 `- 'pnpm-workspace.yaml'` 추가 권장. (저위험 — main branch PR 경로는 이미 커버됨.)

### [INFO] docker-compose.e2e.yml playwright-runner 에 `packages/web-chat-sdk` 와 `packages/sdk` 패키지 node_modules 마스킹 미포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/docker-compose.e2e.yml` playwright-runner volumes 섹션
- 상세: `node-linker=hoisted` 설정이므로 실제 의존성은 `/app/node_modules` (루트)에 호이스팅된다. 루트 `/app/node_modules` 는 anonymous volume 으로 이미 마스킹되어 있다. 그러나 `packages/expression-engine`, `packages/node-summary`, `packages/chat-channel-validation`, `packages/graph-warning-rules` 의 per-package node_modules 는 마스킹하면서 `packages/web-chat-sdk` 와 `packages/sdk` 의 per-package node_modules 는 포함되지 않았다. hoisted 환경에서 per-package node_modules 는 대체로 비어있으므로 실제 영향은 없을 가능성이 높으나, 4개 패키지만 명시한 이유가 불명확해 불일관성이 있다. 로컬 검증에서 e2e 205 passed 이므로 현재 작동에는 문제없음.
- 제안: 일관성을 위해 `web-chat-sdk` 와 `sdk` 도 추가하거나, hoisted 라 per-package 마스킹이 불필요함을 주석으로 명시한다.

### [INFO] [SPEC-DRIFT] `spec/conventions/rag-evaluation.md` 와 `spec/7-channel-web-chat/2-sdk.md` 에 npm 명령 잔존
- 위치:
  - `/Volumes/project/private/clemvion/spec/conventions/rag-evaluation.md` L100, L102: `npm run eval:golden:generate`, `npm run eval:retrieval`
  - `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md` L76: `` `package.json` devDependencies 의 `file:../sdk` 만 ``
- 상세: 이 PR 이 cafe24/makeshop API 카탈로그 spec 의 `npm test --workspace` → `pnpm --filter` 갱신은 수행했으나, `rag-evaluation.md` 의 eval 스크립트 호출 명령(`npm run eval:*`)과 `2-sdk.md` 의 `file:../sdk` 참조는 갱신되지 않았다. `rag-evaluation.md` 의 `npm run eval:*` 는 backend 스크립트 호출로, npm→pnpm 전환 후에는 `pnpm --filter backend run eval:*` 또는 `pnpm run eval:*` 로 변경이 필요하다. `2-sdk.md` L76 의 `file:../sdk` 는 이미 `workspace:*` 로 전환된 실제 코드와 다른 서술이다. 코드 구현이 정확하고 spec 본문이 낡은 케이스.
- 제안: 코드 유지 + spec 갱신. 대상:
  - `spec/conventions/rag-evaluation.md` §3 테이블: `npm run eval:*` → `pnpm --filter backend run eval:*`
  - `spec/7-channel-web-chat/2-sdk.md` L76: `file:../sdk` → `workspace:*` 언급 또는 삭제

### [INFO] `spec/7-channel-web-chat/2-sdk.md` L76 구현 서술이 실제 코드와 불일치 (stale)
- 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md` L76
- 상세: "아직 import 되지 않는다(`package.json` devDependencies 의 `file:../sdk` 만)" — 코드에서는 이미 `workspace:*` 로 전환됨. 관찰적 사실 서술이므로 코드 버그는 아니나 spec 이 현재 상태를 오도함.
- 제안: SPEC-DRIFT 위에 포함 (rag-evaluation 과 동일 resolution 경로).

---

## 요약

npm → pnpm workspace 전환의 핵심 요구사항(단일 `pnpm install`, workspace:* 참조, lockfile 일원화, Dockerfile·CI·하니스·문서 일관 갱신)은 모두 구현되어 있다. 로컬 검증 결과(unit·build·e2e 전수 통과)가 기재되어 있고, 관찰된 간극들은 모두 INFO 수준이다. 가장 주의할 사항은 `spec/conventions/rag-evaluation.md` 와 `spec/7-channel-web-chat/2-sdk.md` 가 npm/file: 참조를 그대로 유지하고 있어 이 두 spec 문서 갱신이 후속으로 필요하다는 점이다(코드 되돌리기 대상이 아닌 SPEC-DRIFT). backend 프로덕션 이미지에 devDeps 가 포함되는 문제는 코드 주석으로 이미 인지되어 있으며 후속 PR 에서 해소될 예정이다.

## 위험도

LOW
