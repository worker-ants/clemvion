# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 기록

1. **매트릭스 적재** — `.claude/config/doc-sync-matrix.json` (`rows[]` 21건) 를 Read. 보조로
   `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L116–184) 을 Read. 두 SoT 모두 존재.
2. **변경 파일 식별** — 프롬프트가 제공한 6개 파일:
   - `.claude/tests/README.md`
   - `.claude/tests/test_review_gate_ci.py`
   - `.github/workflows/harness-checks.yml`
   - `.github/workflows/review-gate.yml`
   - `plan/in-progress/harness-review-gate-ci-backstop.md`
   - `scripts/check-review-gate.py`

   `git show --stat --format="" f2896147b` (해당 변경이 실린 실제 커밋)로 대조한 결과 프롬프트가
   제공한 6개 파일과 **정확히 일치**(6 files changed, 493 insertions(+), 8 deletions(-)) — 리뷰
   payload 에 파일 누락 없음을 확인. `git status --short` / `git diff --name-only HEAD` /
   `git diff --cached --name-only` 로 추가 미포함 변경도 없음을 확인(모두 clean, 유일한 untracked
   항목은 이 리뷰 세션 자체의 출력 디렉터리).
3. **trigger 매칭** — `doc-sync-matrix.json` 의 21개 행 전부를 순회.
   - glob 매칭 행(새 노드/신규 UI 문자열/위젯 chrome/신규 섹션 디렉토리/신규 BullMQ 큐/신규
     errorCode/spec 대규모 변경/user-guide GUI 절)의 glob base path 는 예외 없이
     `codebase/backend/src/**`, `codebase/frontend/src/**`, `codebase/channel-web-chat/src/**`,
     `spec/{2,3,4,5}-*/**`, `spec/conventions/**` 중 하나 — 이번 6개 파일 중 어느 것도
     `codebase/**` 또는 `spec/**` 아래에 있지 않으므로 **glob 매칭 0건**.
   - semantic 매칭 행(통합/제공자 변경, 백엔드 API 변경, warningCode, cross-cutting enum,
     backend zod ui.label, handler output field, 인증·세션 흐름, AuthConfig enum, 표현식 언어,
     실행·디버깅 흐름, 환경 변수·런타임, spec 결함)도 change_type 의미가 전부 **product 코드**
     (`codebase/backend`, `codebase/frontend` 등) 또는 **product spec** (`spec/`) 변화를 전제로
     한다. 이번 변경은 GitHub Actions CI 워크플로 + 그 워크플로가 실행하는 파이썬 스크립트 +
     harness 자체 unit test + 그 배경을 적은 `plan/` 문서로만 구성된 **개발 도구/CI 인프라
     변경**이며, 사용자에게 노출되는 제품 동작·UI·API·인증 흐름·표현식·실행 엔진·신규 필드 중
     어느 것도 건드리지 않는다. **semantic 매칭 0건.**
   - "환경 변수·기동 방법·런타임 변경" 행의 target 은 최상위 `README.md` 인데, 이번에 변경된
     파일은 `.claude/tests/README.md` — 하네스 자체 테스트 스위트를 설명하는 별개 문서로,
     제품의 기동 방법·환경 변수를 다루는 최상위 `README.md` 와 다른 파일이다. 매칭 대상 아님.
4. **동반 갱신 누락 검출** — 3단계에서 매칭된 trigger 가 없으므로 검사할 middle-column 대상이
   없음.
5. **PROJECT.md 자주 누락 패턴 (§157–173) 대조** — i18n key parity, backend warning/error →
   ko 매핑, 노드 schema vs FieldTable, cross-cutting enum 분기, ui.label/hint/group, handler
   output field, 신규 노드 en.mdx, 신규 섹션 디렉터리 locale.ts, TSX 하드코딩 한국어, 인증 흐름
   vs 07-workspace-and-team, swagger jsdoc, spec frontmatter `code:` — 전부 `codebase/`
   또는 `spec/` 아래 파일 변경을 전제로 하는 패턴이며, 이번 변경 set 어디에도 해당 파일이
   없어 어느 패턴에도 걸리지 않음.

## 발견사항

없음 — 해당 없음.

이번 변경 6개 파일(`.claude/tests/README.md`, `.claude/tests/test_review_gate_ci.py`,
`.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`)은
모두 `.claude/`·`.github/`·`plan/`·`scripts/` 아래의 **harness/CI 인프라 코드**다.
`doc-sync-matrix.json` 의 모든 trigger(glob 21건, semantic 포함)는 `codebase/backend/src/**`,
`codebase/frontend/src/**`, `codebase/channel-web-chat/src/**`, `spec/**`, 또는 최상위
`README.md` 를 겨냥하며, 이번 변경은 그중 어느 base path 도 건드리지 않는다. 노드 신규/스키마
변경, 신규 UI 문자열, 통합·제공자 변경, 신규 섹션 디렉터리, 인증·세션 흐름 변경, 표현식 언어
변경, 실행·디버깅 흐름 변경, 신규 warningCode/errorCode 발행 등 어느 change_type 도 성립하지
않으므로 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신 의무가 발생하지 않는다.

## 요약

매트릭스 21개 trigger(row) 전수 대조 결과 매칭 0건, 따라서 누락도 0건 — 이번 변경 set(6개
harness/CI 인프라 파일)은 `codebase/**` 또는 `spec/**` 를 전혀 건드리지 않아 유저 가이드
동반 갱신 매트릭스의 어떤 trigger 에도 해당하지 않는다. `git show --stat` 로 실제 커밋의 파일
목록이 리뷰 payload 와 정확히 일치함을 확인했고, 추가로 스테이징/미스테이징 변경이 없음도
확인했다. 유저 가이드 동반 갱신 관점에서는 검토할 대상이 없는 "해당 없음" 케이스다.

## 위험도

NONE
