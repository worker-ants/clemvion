# 요구사항(Requirement) 리뷰 — internal-package-registration drift guard

## 검증 방법
- 3개 대상 파일(`test-stages.sh`, `packages-checks.yml`, `internal-package-registration.test.ts`)의
  diff base 는 `origin/main`(463aee139) 대비 현재 브랜치 HEAD — 3파일 500줄 순증분과 정확히 일치 확인.
- 실제 `pnpm vitest run src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 실행 →
  **30/30 PASS** (frontend workspace, 현재 저장소 상태 기준).
- `.claude/test-stages.sh`: `bash -n` 문법 검증 통과. 2개 diff hunk 모두 주석 추가뿐(동작 변경 없음).
- `.github/workflows/packages-checks.yml`: `yaml.safe_load` 파싱 통과. diff hunk 도 주석 추가뿐.
- `codebase/packages/*` 실측(ai-end-reason, chat-channel-validation, expression-engine,
  graph-warning-rules, node-summary, sdk, web-chat-sdk 7개) ↔ `INTERNAL_PACKAGES`(6개, sdk 포함)
  ↔ `codebase/backend/package.json` 의 `@workflow/*` 의존(5개, sdk·web-chat-sdk 제외) 를 Node 로
  직접 재계산해 테스트 기대값과 대조 — 전부 일치.
- `spec/`, `plan/` 전수 grep: `INTERNAL_PACKAGES` · `test-stages.sh` · `packages-checks.yml` ·
  `repo-guards` 를 언급하는 spec 문서 없음. 관련 plan 은 `plan/in-progress/eia-context-schema-followups.md:36`
  (선행 배선 작업, 본 PR 의 drift 가드 자체를 추적하는 항목은 아님).

## 발견사항

- **[INFO]** 관련 spec 문서 부재 (spec fidelity 항목 9 — 판정 불가가 아니라 스코프 밖)
  - 위치: `spec/` 전체
  - 상세: 이 3파일은 `.claude/` 하빙/CI 도구 체인과 그 회귀 가드 테스트로, `CLAUDE.md` 의 폴더 구조
    정의상 `spec/`(제품 정의)이 아니라 개발 하네스 영역이다. `spec/` 에 이 영역을 다루는 문서가
    존재하지 않는 것이 정상이며 "spec 갱신 누락"(SPEC-DRIFT) 도 아니다.
  - 제안: 조치 불필요.

- **[INFO]** heredoc 오탐 휴리스틱의 알려진 사각지대 — 의도된 fail-loud 설계, 결함 아님
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:940-945` (`fnBody` 의 early-close 검출 정규식 `/(?<!<)<<-?(?!<)/`)
  - 상세: 이 정규식은 heredoc(`<<`)과 here-string(`<<<`)만 구분한다. bash 산술 컨텍스트의
    left-shift(`$(( x << 2 ))`)가 `cmd_lint/cmd_unit/cmd_build` 본문에 들어오면 실제로는
    heredoc 이 아님에도 동일 패턴에 매칭돼 오탐(throw)할 수 있다. 다만 이는 파일 자체 주석
    (L442-445, L918-919)이 "조용히 틀리느니 깨지게 만든다"는 설계 원칙으로 명시한 트레이드오프이고,
    현재 `test-stages.sh` 세 함수 어디에도 산술 컨텍스트가 없어 오탐이 실제로 발생하지 않는다
    (30/30 PASS 로 확인). 결함이 아니라 알려진 보수적 한계.
  - 제안: 조치 불필요. 추후 `test-stages.sh` 에 산술 `<<` 가 실제로 추가될 때만 재검토.

- **[INFO]** `packages-checks.yml` 대상 2~4 목록 검증은 현재 "inert"(Actions 비활성) — 파일 헤더·테스트 주석에 이미 정확히 명시됨
  - 위치: `.github/workflows/packages-checks.yml:220-221`, 테스트 `describe(".github/workflows/packages-checks.yml (현재 inert — Actions off)")`
  - 상세: 이 워크플로 자체는 repo 레벨 Actions 비활성으로 실행되지 않지만, 그 정합성 가드(테스트
    2~4)는 frontend vitest(로컬 `run-test.sh unit`)에서 실행되므로 drift 는 여전히 잡힌다. 정합성
    회귀 방지 목적 자체는 유효 — 자기모순이 아니라 오히려 "CI 로 넣으면 자기모순" 이라는 판단이
    코드·주석에 정확히 반영돼 있다.
  - 제안: 조치 불필요.

## 기능 완전성 / 엣지 케이스 / 비즈니스 로직 검증 상세

- 4개 손 목록(`INTERNAL_PACKAGES`, `pull_request.paths`, `push.paths`, `matrix.pkg`) 각각의
  **의도된 모집단**이 다르다는 전제(파일 헤더 주석)를 코드가 정확히 구현: `INTERNAL_PACKAGES` 는
  "3단계 커버 여부"라는 상위 불변식으로(`missingFromStage`, 전용 스텝 경로 `explicitFilterCalls` 포함),
  `packages-checks.yml` 3목록은 `backendWorkflowDeps()`(하드코딩 아닌 `codebase/backend/package.json`
  파생)와의 엄격한 집합 일치로 검증 — 실제로 `@workflow/web-chat`(전용 스텝 보유, INTERNAL_PACKAGES
  비등재)가 `explicitFilterCalls` 경로로 정확히 커버됨을 확인.
- vacuity 방지 테스트군(파싱이 빈 배열/`null` 을 조용히 반환하면 전체가 vacuous PASS 되는 것을
  선제 차단)이 실제로 존재 — 이 저장소가 겪은 반복 실패형(#960·#962·#968 텍스트에 언급)에 대한
  회귀 방어로 타당.
- 순수 함수(`missingFromStage`, `fnBody`, `explicitFilterCalls`, `listAtPath`, `packageDirsInPaths`,
  `internalPackages`)에 대한 합성 fixture 테스트가 "저장소 현재 상태만 읽어 green" 위양성을 별도로
  방지 — true-positive(#968 재현 시나리오 포함)·true-negative 양쪽 커버.
- 반환값: 모든 조사한 함수가 모든 경로에서 명시적 반환(`[]`, `null`, throw)을 갖고 있고, 암묵적
  `undefined` 반환 경로 없음.
- TODO/FIXME/HACK/XXX 주석: 3파일 전체에서 0건.

## 요약
`.claude/test-stages.sh` 와 `.github/workflows/packages-checks.yml` 의 변경은 순수 주석 추가(동작
변경 없음, bash 문법·YAML 파싱 모두 통과)이며, 신규 `internal-package-registration.test.ts` 는
PR #968 급 회귀(신규 내부 패키지가 lint/unit/build 어디서도 실행되지 않는데 wrapper 는 PASS 를
반환)를 실제로 차단하는 잘 설계된 drift 가드다. 30/30 테스트가 현재 저장소 상태에서 실제로
통과함을 직접 실행으로 확인했고, Node 로 독립 재계산한 실측값(패키지 7종·backend 의존 5종·
INTERNAL_PACKAGES 6종)도 테스트 기대값과 정확히 일치한다. 관련 `spec/` 문서는 존재하지 않으나
이는 스코프 밖(개발 하네스 영역)이라 정상이다. CRITICAL/WARNING 급 결함 없음 — 발견사항은 모두
INFO(설계상 인지된 트레이드오프이거나 스코프 확인).

## 위험도
NONE
