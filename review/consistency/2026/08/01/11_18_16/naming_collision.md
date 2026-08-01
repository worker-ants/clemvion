# 신규 식별자 충돌 검토 — spec/7-channel-web-chat (--impl-done)

## 검토 범위 확인

`git diff origin/main...HEAD` 실측 결과, 이번 PR 은 **`spec/` 전체를 전혀 건드리지 않는다**
(`git diff origin/main...HEAD --stat -- spec/` → 0 hits). 변경은:

- 10개 워크스페이스 `package.json` 의 `typescript` devDependency 를 `^7.0.2` → `^5.7.3`/`^5` 로 되돌림
  (Jenkins 빌드 전면 실패 복구, `plan/in-progress/typescript-7-rollback.md`).
- 신규 파일 2개: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts`,
  `.../typescript-toolchain.test.ts` (회귀 방지 가드 — 순수 로직 + vitest).
- `plan/in-progress/` 에 계획 문서 2건 추가(`typescript-7-rollback.md`, `typescript-toolchain-followups.md`).

`spec/7-channel-web-chat/*` 6개 문서는 이번 diff 로 **한 글자도 변경되지 않았다** — orchestrator 가 이
영역을 scope 로 잡은 것은 `codebase/channel-web-chat/package.json` 이 diff 파일 목록에 포함(단, 내용은
`typescript` 버전 한 줄 devDependency 변경뿐)되어 `code:` frontmatter glob 매칭이 걸렸기 때문으로 보인다.
즉 이번 검토는 "target 문서가 새 식별자를 도입"하는 상황이 아니라, **target 문서(스펙 전문)는 불변, 실제
신규 식별자는 스펙 도메인과 무관한 내부 테스트 가드 모듈에서만 발생**한 케이스다. 아래는 그 신규 식별자들을
6개 관점으로 전수 대조한 결과다.

## 발견사항

없음 — CRITICAL/WARNING 대상 충돌 미발견.

| # | 등급 | 제목 | 위치 | 상세 |
|---|------|------|------|------|

### 관점별 확인 내역 (참고용 — 전부 충돌 없음 확정)

1. **요구사항 ID 충돌** — 대상 없음. 이번 diff 는 `spec/` 를 건드리지 않아 신규 요구사항 ID(`NAV-WC-*`,
   `EIA-*`, `WH-*` 류) 자체가 없다. `plan/in-progress/typescript-7-rollback.md` frontmatter 는
   `spec_impact: none` 으로 스스로 명시.
2. **엔티티/타입명 충돌** — 신규 export 타입은 `TypescriptDecl`(`{dir, range}`) 1개뿐. 코드베이스
   전체(`git grep -n "\bTypescriptDecl\b"`)·`spec/`·`plan/` 어디에도 동명 기존 사용처 없음. `web-chat`
   영역의 `BootConfig`/`ChatInstance`/`WidgetEvent`/`PresentationPayload` 등 기존 타입과도 이름이 겹치지
   않는다.
3. **API endpoint 충돌** — 신규/변경 endpoint 없음(diff 는 devDependency 버전 + 순수 로컬 함수뿐, HTTP
   표면 변경 없음).
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트 없음. `wc:boot`/`wc:command`/`wc:ready`/
   `wc:resize`/`wc:event`(2-sdk.md) 등 기존 이벤트 namespace 는 이번 diff 의 영향 범위 밖.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음. `WEB_CHAT_WIDGET_ORIGINS`·
   `NEXT_PUBLIC_WIDGET_CDN_BASE` 등 기존 키도 diff 대상이 아니다. 신규 상수
   `WORKSPACE_YAML`(`typescript-toolchain-guard.ts:1`, `path.join(ROOT, "pnpm-workspace.yaml")` 값)은
   대문자 스네이크케이스 **파일시스템 상수**이며, 제품 핵심 엔티티 `Workspace`/`WorkspaceMember`/
   `interactionAllowedOrigins`(스펙 전역에서 자주 등장하는 이름)와 표기·문맥이 명확히 분리돼 있어(가드
   전용 모듈 최상단, "pnpm-workspace.yaml 경로" 라는 자명한 의미) 실질적 혼동 사례로 보지 않는다.
   `REQUIRED_COMPILER_API` 등 나머지 신규 상수(`missingCompilerApi`/`parseMajor`/`typescriptRangeOf`/
   `expandWorkspaceGlobs`/`discoverWorkspaceDirs`/`typescriptDecls`/`readManifestAt`/`majorSpread`/
   `loadTypescriptFrom`)도 `codebase/**`·`spec/**`·`plan/**` 전수 grep 상 신규 파일 2개 밖에서 재사용되는
   동명 심볼이 전혀 없음을 확인했다.
6. **파일 경로 충돌** — `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts` /
   `typescript-toolchain.test.ts` 는 신규 파일이며(origin/main 이력 없음), 형제 가드
   `internal-package-registration-guard.ts` / `internal-package-registration.test.ts` 의 기존 명명
   컨벤션(`<주제>-guard.ts` + `<주제>.test.ts`, `-guard` 접미사를 test 파일명에서 드롭)을 그대로 따른다
   — 컨벤션 위반·기존 파일과의 경로 중복 없음.

## 참고 — 실측 근거

- `git -C <worktree> grep -n "<식별자>" -- 'codebase/**/*.ts' 'codebase/**/*.tsx'` 로 diff 가 도입한
  12개 신규 심볼(`WORKSPACE_YAML`/`REQUIRED_COMPILER_API`/`missingCompilerApi`/`parseMajor`/
  `typescriptRangeOf`/`expandWorkspaceGlobs`/`discoverWorkspaceDirs`/`TypescriptDecl`/`typescriptDecls`/
  `readManifestAt`/`majorSpread`/`loadTypescriptFrom`) 전수를 조회 — 신규 파일 2개 밖 매치 0건.
- `typescript-toolchain-guard.ts` 가 import 하는 `ROOT`/`listAtPath`/`PackageManifest` 는 형제 모듈
  `internal-package-registration-guard.ts` 에 실제로 export 돼 있음을 확인(신규 도입 아닌 기존 재사용 —
  결합도 이슈는 이미 `plan/in-progress/typescript-toolchain-followups.md` §1 (INFO 3) 로 트래킹 중, 본
  검토 범위인 "충돌"과는 다른 축).
- 동일 diff 에 대한 `/ai-review`(`review/code/2026/08/01/10_55_44/SUMMARY.md`, 9개 reviewer, Critical
  0·Warning 0)도 naming 관련 Critical/Warning 을 내지 않았고, 유일하게 인접한 지적(ARCHITECTURE #3, 형제
  모듈 전체 export 표면 의존)은 "이름이 겹친다"가 아니라 "결합도" 문제로, 본 신규 식별자 충돌 검토의
  범위 밖이다.

## 요약

target 으로 지정된 `spec/7-channel-web-chat` 은 이번 PR 에서 내용이 전혀 변경되지 않았고(diff 는 오직
TypeScript 버전 롤백 + 신규 회귀 가드 2파일), scope 매칭은 `codebase/channel-web-chat/package.json` 의
devDependency 한 줄 변경 때문으로 판단된다. 실제로 새로 도입된 식별자는 전부
`codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-{guard,test}.ts` 안에 격리된
내부 빌드 가드 심볼(함수·상수·타입 12종)과 그 파일 경로 2개뿐이며, 요구사항 ID·엔티티/타입명·API
endpoint·이벤트/메시지명·환경변수/설정키·파일 경로 6개 관점 전부에서 코드베이스·spec·plan 전수 검색으로
기존 사용처와의 충돌이 발견되지 않았다. 새 파일 2개는 기존 형제 가드의 명명 컨벤션을 정확히 따르고 있어
컨벤션 위반도 없다.

## 위험도

NONE
