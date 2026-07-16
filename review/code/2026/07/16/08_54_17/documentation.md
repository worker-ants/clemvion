# Documentation Review — node-linker hoisted → isolated 전환 (plan §3)

Scope: `origin/main..HEAD` (19252b21e). 대상: `.npmrc`, `pnpm-workspace.yaml`,
`codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile`,
`codebase/frontend/next.config.ts`, `docker-compose.e2e.yml`,
`plan/in-progress/pnpm-migration-followups.md` §3.

## 발견사항

없음. 아래는 확인 과정에서 검토했으나 조치 불필요로 판단한 항목이다.

- **[INFO]** `.claude/test-stages.sh:98` 에 `hoisted flat tree` 표현이 여전히 남아 있으나,
  이는 §1-(a)(2026-07-14, injected `pnpm deploy` 채택 이전의) **구 runner**(`prod-deps` 통째
  COPY 방식)를 가리키는 과거형 서술("이 클래스 회귀... 지금껏 ai-review 로만 잡혔지 CI 로 걸린
  적이 없다")이지, 현재 `.npmrc` 의 `node-linker` 값을 서술하는 문장이 아니다. 현재 트리와
  모순되지 않으므로 갱신 불필요.
  - 위치: `.claude/test-stages.sh:97-101`
  - 상세: "구 runner 가 hoisted flat tree 통째 COPY" 는 §1-(a) 이전 상태에 대한 역사적 설명이며,
    현재 코드(§1-(a) 이후: injected deploy)와도, 이번 diff(node-linker=isolated)와도 무관하다.
  - 제안: 조치 불필요.

## 검증한 항목 (문제 없음)

1. **`.npmrc` 신규 주석의 기술적 정확성**: `node-linker=isolated` 가 pnpm 기본 symlink(virtual
   store, `node_modules/.pnpm`) 레이아웃이라는 서술, 각 패키지가 자기 매니페스트 선언 의존만
   해소 가능해 phantom-dependency 가 fail-fast 로 드러난다는 서술, 전환 중 드러난 backend
   phantom 4개(express·ip-address·dotenv·@jest/globals)가 실제 `codebase/backend/package.json`
   diff 와 정확히 일치, 내부 `@workflow/*` workspace 패키지가 isolated 에서도 symlink 로 유지된다는
   서술(= `pnpm-workspace.yaml` 의 실측 주석과 정합) 모두 정확하다.

2. **`codebase/backend/Dockerfile` deploy-stage 주석**: `node-linker=isolated` 하에서
   `--filter "backend..."` 설치가 backend closure 만 격리한다는 서술은 pnpm 의 필터링 설치 의미론과
   일치하고(§3 both-stack e2e·image hygiene 스모크로 검증됨), hoisted 시절 문제를 **과거형**으로
   정확히 구분해 서술한다. `pnpm deploy` 자체의 "격리(isolated) node_modules" 표현(deploy 고유의
   버전별 격리, node-linker 설정과 별개 개념)은 이번 diff 로 손대지 않은 기존 문구이며 새 node-linker
   용어와 개념적으로 충돌하지 않는다(둘 다 "패키지별로 자기 의존만 보이는 격리"라는 동일 원리의
   서로 다른 적용 지점).

3. **`codebase/frontend/Dockerfile` standalone 트레이싱 주석**: `@vercel/nft`(Next.js standalone
   file-tracer) 가 symlink 를 따라간다는 서술은 실제 동작과 일치(pnpm symlink 기반 레이아웃 지원은
   Next.js 의 알려진 요구사항).

4. **`codebase/frontend/next.config.ts` `outputFileTracingRoot` 주석**: isolated 모드에서 실 파일이
   루트 `node_modules/.pnpm` 가상 스토어에 있고 각 패키지 `node_modules` 는 그리로의 symlink 라는
   서술, 트레이싱 루트를 `codebase/frontend` 로 좁히면 스토어·symlink 대상이 루트 밖이라 트레이서가
   누락한다는 서술 모두 정확. **`transpilePackages`/`--webpack` Turbopack-symlink 주석은 미변경**인데,
   `pnpm-workspace.yaml` 실측 주석("isolated 에서도 워크스페이스 링크는 symlink")과 대조하면 그 전제가
   isolated 에서도 그대로 유지되므로 갱신 불필요가 맞다.

5. **`docker-compose.e2e.yml` node_modules 마스킹 주석**: "isolated symlink farm"·
   "`/app/node_modules/.pnpm` 가상 스토어" 서술은 정확하고, anonymous volume 이 실제 무엇을
   보존하는지(호스트 mount 밖의 스토어 + 이미지가 만든 symlink 양쪽) 명확하게 구분해 설명한다.

6. **잔여 stale "hoisted" 참조 grep**: `node_modules/`, `_test_logs/`, `plan/complete/`,
   `review/**`, plan §1 historical 기록(§3 로 대체되지 않는 별개 항목), `vi.hoisted()`(Vitest 무관
   용어) 를 제외하고 저장소 전역(`PROJECT.md`, `.claude/test-stages.sh`, `k8s/**`,
   `codebase/backend/migrations/Dockerfile`, `codebase/frontend/Dockerfile.playwright-e2e`,
   `docker-compose.yml`, `README*`, `spec/**`, `.claude/docs/**`, `.github/**`)를 확인한 결과
   추가로 갱신이 필요한 live 참조는 없었다.

7. **plan §3 기록 품질**: diff 는 `pnpm-migration-followups.md` 의 §3 헤더·본문(라인 57~101)과
   §4 종결 요약(라인 109~113)만 건드리고, §1(라인 14~41)·§2(라인 43~55)는 **한 글자도 수정하지
   않았다**(`git diff -U0` 로 hunk 확인: `@@ -57 +57 @@`, `@@ -61,0 +62,41 @@`,
   `@@ -68 +109,5 @@` 세 개뿐). §1 안의 `node-linker` 는 hoisted 유지"·"hoisted node_modules
   layout" 같은 과거 결정 기록은 그 시점 기준으로는 정확했던 서술이라 역사 기록으로서 올바르게
   보존됐다. 신규 §3 본문은 결정·변경 요약·검증·교훈 4단 구성으로 다른 완료 섹션(§1-a, §2)과
   동일한 서술 밀도·형식을 따른다.

## 요약

이번 커밋은 `.npmrc`·`pnpm-workspace.yaml`·backend/frontend `Dockerfile`·`next.config.ts`·
`docker-compose.e2e.yml` 전반의 "hoisted" 서술을 "isolated" 로 정확하고 기술적으로 옳게 갱신했다.
virtual store 위치(`node_modules/.pnpm`)·패키지별 symlink·`@vercel/nft` 의 symlink 추적·워크스페이스
패키지 symlink 불변(따라서 Turbopack 우회 주석도 그대로 유효)·injected `pnpm deploy` 격리라는 isolated
모드의 핵심 동작을 모두 정확히 반영했고, 저장소 전역 grep 으로도 갱신이 누락된 live stale 참조를 찾지
못했다. plan §3 은 결정·변경 요약·both-stack 검증·핵심 발견을 상세히 기록했으며, §1 의 과거 hoisted
결정 기록을 rewriting 없이 역사적 사실로 올바르게 보존했다. 문서화 관점에서 지적할 결함이 없다.

## 위험도

NONE
