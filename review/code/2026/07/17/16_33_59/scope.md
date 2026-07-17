# 변경 범위(Scope) 리뷰

## 대상
- `codebase/frontend/eslint.config.mjs` (+26 -0, 단일 파일, 단일 hunk)
- 워크트리 전체 diff(`git status` / `git diff --stat`) 기준으로도 이 파일 1개만 변경됨 — 리뷰 대상 diff 가 곧 변경분 전체.

## 배경 확인
- 신설 규칙 주석이 근거로 든 두 파일(`src/lib/conversation/rag-types.ts`, `src/components/editor/run-results/conversation-utils.ts`)은 `git log` 확인 결과 이전 커밋 `7847535fc`(#961, KB 자동검색 행 신설)에서 이미 `lib/` 로 이동·re-export 형태로 정리된 상태이며, 본 diff 에는 포함되어 있지 않다.
- 즉 이번 변경은 과거 리팩토링 결과(레이어 역전 방지)를 **재작업(regression)** 하지 않고, 그 아키텍처 결정을 **린트 규칙으로 고정(guardrail)** 하는 단일 목적의 후속 커밋으로 읽힌다. 원 리팩토링과 가드레일 추가가 서로 다른 커밋으로 분리되어 있어 커플링이 없다.

## 점검 관점별 평가

1. **의도 이상의 변경** — 없음. diff 전체가 `defineConfig([...])` 배열에 새 override 블록 1개를 추가하는 것뿐이며, 기존 라인(`nextVitals`, `nextTs`, `globalIgnores(...)`)은 손대지 않았다.
2. **불필요한 리팩토링** — 없음. 기존 코드 재배치·정리 없음.
3. **기능 확장(over-engineering)** — `no-restricted-imports` patterns 에 4개 glob(`@/components`, `@/components/**`, `**/../components`, `**/../components/**`)을 넣어 alias 경로와 상대경로 우회를 모두 커버한다. 이는 "레이어 역전 금지"라는 단일 의도를 실질적으로 강제하기 위한 최소한의 커버리지로 보이며, 별도 기능(예: 다른 디렉터리 규칙, autofix, 다른 rule set 확장)을 끼워 넣지는 않았다. over-engineering 으로 보기는 어렵다.
4. **무관한 수정** — 없음. `files: ["src/lib/**"]` 로 적용 범위를 정확히 한정했고, 다른 디렉터리·다른 규칙에는 영향 없음.
5. **포맷팅 변경** — 없음. 순수 추가(insertion)만 있고 기존 라인 재포맷·개행 변경 없음.
6. **주석 변경** — 신규 블록에 딸린 설명 주석만 추가됐고, 기존 주석(`Default ignores of eslint-config-next:` 등)은 그대로. 주석 내용도 규칙 자체의 배경(레이어 역전 금지 사유, 근거 파일)을 설명하는 데 국한되어 있어 규칙과 분리된 잡음이 아니다.
7. **임포트 변경** — 없음. 파일 상단 `import` 3줄은 변경되지 않았다.
8. **설정 변경** — 이 diff 자체가 ESLint 설정 변경이라는 점은 명백하지만, 변경 범위 리뷰 관점에서 문제 삼을 지점은 "의도치 않은" 설정 변경 여부다. 신설 규칙은 주석에 명시된 구체적 배경(사전에 이미 일어난 레이어 역전 이슈와 그 해결책)과 직접 연결되어 있어 우발적 설정 변경으로 보이지 않는다.

## 발견사항

- **[INFO]** 원 작업 요청문(사용자 프롬프트/plan 문서)을 이 worktree 범위에서 직접 확인하지 못함
  - 위치: 워크트리 전체
  - 상세: `plan/in-progress/` 하위에서 이 worktree(`wonderful-kirch-fddd7d`)와 연결된 plan frontmatter 를 찾지 못했다. 다만 코드 자체의 background 주석과 `git log -- <두 파일>` 이력이 "레이어 역전 방지를 린트로 고정한다"는 의도를 강하게 뒷받침하므로, 관측 가능한 범위에서는 diff 가 그 의도를 벗어나지 않는다고 판단했다. 참고 정보 수준의 기록이며 CRITICAL/WARNING 판단에는 영향 없음.
  - 제안: 별도 조치 불필요(정보 제공 목적).

## 요약
이번 변경은 `codebase/frontend/eslint.config.mjs` 단일 파일에 `src/lib/**` → `@/components/**` import 를 금지하는 ESLint override 블록 하나만 추가한 원자적(atomic) diff다. 신설 규칙이 참조하는 배경 파일 2개는 이미 이전 커밋(#961)에서 별도로 정리되어 이번 diff 에 포함되지 않으며, 이번 변경은 그 아키텍처 결정을 재발 방지용 가드레일로 고정하는 데만 집중되어 있다. 포맷팅 노이즈, 무관한 리팩토링, 기능 확장, 불필요한 주석/임포트 변경 등 범위 이탈 징후는 발견되지 않았다.

## 위험도
NONE
