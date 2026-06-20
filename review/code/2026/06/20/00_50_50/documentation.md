# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `.claude/docs/test-wrapper.md` 예제 코드 업데이트 적절
  - 위치: `.claude/docs/test-wrapper.md` 전체 diff
  - 상세: `npm run lint/test/build` → `pnpm --filter backend lint/test/build` 로 예제가 정확하게 갱신되었다. 문서의 예제 코드가 실제 `test-stages.sh` 와 일치한다.
  - 제안: 없음

- **[INFO]** `.claude/test-stages.sh` 인라인 주석이 변경 동기를 충분히 설명
  - 위치: `.claude/test-stages.sh` 헤더 및 `_ensure_deps` 주석
  - 상세: `_ensure_web_chat_deps` 특수처리 폐기 이유와 pnpm workspace 수렴에 대한 근거가 주석에 명시되어 있다. 이전 `followup #7` 항목에 대한 잔류 참조가 삭제되었는지 확인이 필요하나 diff 상 해당 주석은 삭제된 것으로 보인다.
  - 제안: 없음

- **[INFO]** `PROJECT.md` 패키지 매니저 정책 인라인 설명이 과도하게 길다
  - 위치: `PROJECT.md` 라인: `패키지 매니저: 모두 **pnpm** ...`
  - 상세: 전환 배경(file:../packages/* 수동 링크 문제 등)을 단일 문장에 압축한 결과 가독성이 떨어진다. 기술적 근거는 별도 Rationale 섹션이나 commit 메시지로 분리하는 것이 표준이나, PROJECT.md는 운영 참조 문서이므로 1-2 줄 이내로 정리하는 것을 권장한다. 단, 이것은 스타일 문제이며 정보 누락은 없다.
  - 제안: `패키지 매니저: 모두 **pnpm** (workspace 모노레포 — 루트 \`pnpm-workspace.yaml\` + 단일 \`pnpm-lock.yaml\`). 내부 패키지는 \`workspace:*\` 프로토콜로 참조한다. npm / yarn 직접 사용 금지.` 로 간결화하고 나머지 배경은 commit 참조 또는 PRO.md Rationale로 이동.

- **[INFO]** `codebase/frontend/next.config.ts` 주석의 `// Local symlinked package` 문구가 부분 부정확
  - 위치: `codebase/frontend/next.config.ts` 라인: `// Local symlinked package — transpile required for bundler resolution.` 및 `// Build uses --webpack flag because Turbopack cannot follow symlinked local packages.`
  - 상세: pnpm workspace + node-linker=hoisted 전환 이후에도 이 두 주석은 여전히 "symlinked local packages"를 언급한다. hoisted 모드에서 `@workflow/expression-engine`이 실제로 심링크인지, 또는 직접 복사된 파일인지에 따라 주석이 부정확할 수 있다. node-linker=hoisted 는 flat node_modules 를 생성하므로 전통적인 심링크(isolated 모드) 와는 다르다. transpilePackages 필요 이유는 여전히 유효할 수 있으나 주석 근거가 변경된 레이아웃을 반영하지 않는다.
  - 제안: 주석을 `// Internal workspace package — transpile required for bundler resolution. (hoisted node-linker does not create true symlinks but bundler still requires explicit transpilation.)` 또는 유사하게 갱신.

- **[INFO]** `codebase/backend/Dockerfile` runner 스테이지 주석에서 devDeps 포함 이미지 크기 관련 내용이 명시됨
  - 위치: `codebase/backend/Dockerfile` runner 스테이지 주석: `(devDeps 까지 포함 — 이미지 크기 최적화는 후속 과제.)`
  - 상세: 이 주석은 현재 이미지가 devDependencies 를 포함한다는 known issue 를 명시하고 있다. 이는 보안/운영 관점의 주목할 만한 트레이드오프이나, 문서화 자체는 적절히 이루어져 있다. 후속 PR 트래킹을 위한 plan 항목이 있는지 확인이 필요하다.
  - 제안: 없음 (이미 주석으로 표시됨). 후속 plan 항목이 없다면 생성 권장.

- **[INFO]** `docker-compose.e2e.yml` playwright-runner 커맨드가 단일 라인에 압축되어 있어 이해 난이도 높음
  - 위치: `docker-compose.e2e.yml` command 섹션: `"corepack enable && pnpm install ... && pnpm --filter frontend exec playwright install ... && pnpm --filter frontend e2e"`
  - 상세: 4개의 명령을 `&&` 로 연결한 단일 셸 커맨드는 YAML 가독성을 낮춘다. 단계별 의미를 설명하는 인라인 주석이 없어 처음 보는 사람이 각 단계의 목적을 파악하기 어렵다. 바로 위의 블록 주석이 전반적인 맥락을 설명하고 있으나, 커맨드 자체에는 설명이 없다.
  - 제안: 멀티 라인 YAML 리스트 형태로 분리하거나, 각 `&&` 앞에 무엇을 하는지 주석을 추가하는 것을 고려.

- **[INFO]** `package.json` (루트) description 필드에 문서 기능이 포함되어 있음
  - 위치: 루트 `package.json` `description` 필드
  - 상세: `"description": "clemvion monorepo workspace root (pnpm). 실제 애플리케이션은 codebase/{backend,frontend,channel-web-chat} 및 codebase/packages/*."` 는 workspace 구조를 문서화하는 역할을 수행하고 있으며 적절하다.
  - 제안: 없음

- **[INFO]** `pnpm-workspace.yaml` 주석에서 `.claude/tools/mermaid-lint` 제외 이유 명시
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/pnpm-workspace.yaml` (신규 파일)
  - 상세: 하니스 전용 독립 도구가 workspace에 포함되지 않는 이유가 명확히 주석으로 설명되어 있다. 좋은 인라인 문서화 예시이다.
  - 제안: 없음

- **[INFO]** `spec/conventions/` 내 여러 파일의 명령 스니펫이 일관되게 갱신됨
  - 위치: `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/conventions/cafe24-restricted-scopes.md`, `spec/conventions/makeshop-api-catalog/_overview.md`
  - 상세: `npm test --workspace backend` → `pnpm --filter backend test` 로 일관되게 갱신되었다. `--workspace` 는 npm 워크스페이스 옵션이었고 `--filter` 는 pnpm 옵션으로 의미상으로도 정확히 대응된다.
  - 제안: 없음

- **[WARNING]** `README.md` 개발 환경 설정 섹션에 pnpm 설치 전제조건이 누락됨
  - 위치: `README.md` 로컬 개발 섹션 (diff: `pnpm install` 앞)
  - 상세: diff에서 `pnpm install`을 실행하도록 변경되었으나, pnpm 자체의 설치 방법(`npm install -g pnpm` 또는 corepack 활성화)이 README 에 명시되지 않았다. npm은 Node.js에 번들되어 있어 별도 설치 안내가 불필요했으나, pnpm은 별도 설치가 필요하다. 기존 기여자가 pnpm 없이 레포를 클론하면 `pnpm install` 명령이 실패한다. 특히 corepack 을 통한 pnpm 활성화(`corepack enable`) 가 선행되어야 하는데, 이 정보가 개발 환경 setup 가이드에 없다.
  - 제안: README.md 의 로컬 개발 전제조건 또는 `## 시작하기` 섹션에 다음을 추가: `Node.js 24+ 와 corepack 활성화(\`corepack enable\`)가 필요합니다. pnpm 버전은 루트 \`package.json\`의 \`packageManager\` 필드로 자동 고정됩니다.`

- **[INFO]** `.npmrc` 신규 파일에 각 설정 값의 영향이 충분히 문서화됨
  - 위치: 루트 `.npmrc` (신규 파일)
  - 상세: `node-linker=hoisted` 선택 근거(NestJS/Next/native dep 호환성)와 향후 strict 화 가능성, `engine-strict=false` 의 advisory 의미가 주석으로 명시되어 있다. 새 기여자가 이 파일을 보고 왜 이런 설정이 되어 있는지 이해할 수 있다.
  - 제안: 없음

- **[INFO]** `web-chat-checks.yml` 에 `codebase/packages/sdk/**` 경로 트리거가 추가되었으나 주석 없음
  - 위치: `.github/workflows/web-chat-checks.yml` paths 섹션
  - 상세: `codebase/packages/sdk/**` 경로가 새로 트리거 목록에 추가되었다. 이것이 기존 `codebase/packages/web-chat-sdk/**`와 별개로 존재하는 이유(다른 sdk 패키지가 있는지, 경로 별칭인지)가 불명확하다. 주석이 없어 의도가 파악되지 않는다.
  - 제안: 해당 paths 항목 옆에 `# packages/sdk: @workflow/sdk (web-chat-sdk의 의존성)` 등 한 줄 주석 추가.

- **[INFO]** `plan/in-progress/cafe24-backlog-residual.md` 명령 스니펫 갱신
  - 위치: `plan/in-progress/cafe24-backlog-residual.md`
  - 상세: plan 문서 내 검증 명령도 pnpm 형식으로 일관되게 갱신되었다. plan 문서의 일관성 유지 측면에서 적절하다.
  - 제안: 없음

## 요약

이번 npm → pnpm workspace 전환은 문서화 측면에서 전반적으로 잘 처리되었다. `PROJECT.md`, `README.md`, `.claude/docs/test-wrapper.md`, `spec/conventions/` 내 다수 파일, `plan/` 문서까지 명령 스니펫이 일관되게 갱신되었고, 새로 추가된 `.npmrc`와 `pnpm-workspace.yaml`에는 설계 결정 근거가 인라인 주석으로 잘 문서화되어 있다. 주목할 발견사항은 두 가지다: (1) `README.md` 에 pnpm 전제조건(`corepack enable`) 설치 안내가 누락되어 신규 기여자 경험에 마찰이 생길 수 있으며, (2) `next.config.ts` 의 "symlinked local package" 주석이 hoisted 레이아웃 전환 후 부분적으로 부정확해졌다. 두 사항 모두 낮은 위험도이나 개발자 경험 개선을 위해 정정을 권장한다.

## 위험도

LOW

STATUS: SUCCESS
