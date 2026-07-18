# 문서화(Documentation) 리뷰: mermaid-lint undici/dompurify 취약점 해소 + Dependabot npm 편입

리뷰 대상: `.claude/tools/mermaid-lint/package-lock.json`, `.github/dependabot.yml`,
`plan/in-progress/harness-guard-followups.md` (커밋 `02d69e324`, worktree `mermaid-lint-undici-vuln-2956f1`)

## 검증 방법

`git diff --stat origin/main...HEAD` 로 payload(3파일)가 실제 diff 와 정확히 일치함을 먼저 확인했다.
이후 각 파일을 아래 8개 관점으로 점검하되, 특히 "주석 정확성"·"설정 문서" 두 항목은 실제 저장소
파일(`deps-security-checks.yml`, `PROJECT.md`, `CHANGELOG.md`)과 직접 대조해 검증했다(주장을 그대로
믿지 않음).

## 발견사항

- **[WARNING]** `PROJECT.md` 의 의존성 취약점 거버넌스 절이 새로 추가된 Dependabot 경로를 언급하지
  않아 canonical 인프라 문서로서 부분적으로 불완전해짐
  - 위치: `PROJECT.md:48` ("버전·도구 정책" > "의존성 취약점 audit·핀 거버넌스" 불릿)
  - 상세: 이 절은 "CI(`deps-security-checks.yml`)가 (1) `pnpm audit` ... (2)
    `check-pnpm-security-config.py` ..." 로 시작해 **pnpm 워크스페이스 기반 audit·핀 가드만** 서술한다.
    `deps-security-checks.yml` 의 `on.pull_request.paths`/`on.push.paths` 를 직접 대조한 결과
    `pnpm-workspace.yaml`·`pnpm-lock.yaml`·루트 `package.json`·`codebase/**/package.json` 만
    트리거하며, `.claude/tools/mermaid-lint/**` 는 대상 밖이다 — 이번 diff 의 `dependabot.yml` 신규
    주석이 정확히 같은 사실을 진단한다("deps-security-checks.yml(pnpm audit)·config-guard 어디에도
    안 걸려"). 이번 PR 은 그 사각지대를 메우는 **두 번째 거버넌스 경로**(Dependabot `npm` ecosystem,
    `directory: /.claude/tools/mermaid-lint`, 주간·리액티브)를 신설했지만, "이 저장소가 의존성
    취약점을 어떻게 거버넌스하는가"를 서술하는 단일 canonical 문서(`CLAUDE.md` 자신이 "실제
    명령·인프라·면제 화이트리스트: PROJECT.md" 라 지정)는 여전히 pnpm 경로만 이야기해 이제
    불완전하다. 새로 이 저장소를 접하는 개발자가 PROJECT.md 만 읽으면 "pnpm audit 가 전체
    의존성을 커버한다"고 오해하기 쉽다.
  - 제안: `PROJECT.md:48` 불릿 끝(또는 별도 문장)에 1~2문장 추가. 예: "pnpm 워크스페이스 밖의 독립
    npm 트리(`.claude/tools/mermaid-lint` 등 하네스 툴링)는 위 pnpm 경로 감사 대상이 아니므로
    `.github/dependabot.yml` 의 `npm` ecosystem 항목으로 별도 커버한다(주간 스케줄·리액티브, PR
    시점에 신규 의존성 추가를 능동 차단하진 않음)." `dependabot.yml` 의 기존 인라인 주석을 요약해
    옮기면 충분하다.

- **[INFO]** `CHANGELOG.md` 미갱신은 이 저장소 관례상 정당 — 조치 불요
  - 위치: `CHANGELOG.md` (본 diff 는 미변경, 검증 목적으로 확인)
  - 상세: 라우팅 휴리스틱(`code-review-agents/README.md`: "dependency 변경은 보통 README/CHANGELOG
    갱신 동반")에 따라 확인했다. `CHANGELOG.md` 의 기존 "Unreleased" 항목 76개 전수가
    `codebase/`(backend·frontend·channel-web-chat) **제품 코드**·spec 연결 변경만 다룬다. 정확히
    같은 클래스(`npm audit` 취약점 상향)를 다룬 기존 항목도 존재한다("Unreleased — npm audit
    취약점 해소 의존성 상향", `CHANGELOG.md:376`) — 하지만 이 항목조차 backend/frontend/
    channel-web-chat 세 트리(실제 배포되는 런타임 의존성)에 한정하며, `.claude/` 하네스 툴링은
    언급하지 않는다. 이번 변경은 `.claude/tools/mermaid-lint`(개발자 로컬 도구, 미배포, pre-commit·
    PostToolUse 훅 전용)만 건드리므로 이 저장소 CHANGELOG 관례의 스코프 밖이다. `plan/in-progress/
    harness-guard-followups.md` §F 가 이 변경의 실질 "변경 이력" 기록 위치이며, 이미 충실히
    갱신되었다.
  - 제안: 없음(현행 유지가 맞음 — CHANGELOG 추가를 권고하지 않음).

- **[INFO]** 변경된 주석·plan 서술이 실제 diff·CI 설정과 일치함을 대조 검증 — 오래된/부정확한 주석
  없음
  - 위치: `.github/dependabot.yml` 신규 주석(추가된 6줄), `plan/in-progress/harness-guard-followups.md`
    §F 본문
  - 상세: (1) dependabot.yml 주석의 "deps-security-checks.yml(pnpm audit)·config-guard 어디에도
    안 걸려" 주장을 `deps-security-checks.yml` 의 `paths:` 트리거 목록과 직접 대조해 정확함을
    확인했다. (2) plan 문서 §F 의 버전 서술("undici 7.27.0→7.28.0", "dompurify 3.4.7→3.4.12")이
    `package-lock.json` diff 의 실제 `version`/`resolved` 값과 정확히 일치한다. (3) 신규
    Dependabot 블록은 기존 `github-actions` 엔트리와 같은 2~5줄 배경-설명 주석 스타일을 유지해
    문서 톤이 일관적이다. 코드 로직이 없는 config/data 파일 diff 라 독스트링·JSDoc·API 문서·예제
    코드 항목은 해당 사항 없음.
  - 제안: 없음(문제 아님, 검증 결과 기록).

## 요약

이번 변경(lockfile 취약점 fix 2건, Dependabot ecosystem 신규 등록 1건, plan 체크리스트 갱신)은
코드 로직을 포함하지 않아 독스트링·API 문서·예제 코드는 해당 사항이 없고, 새로 추가된
`dependabot.yml` 인라인 주석과 `plan/in-progress/harness-guard-followups.md` §F 서술은 실제
diff·CI 트리거 설정과 대조 검증한 결과 정확하며 "왜 지금 이 조치가 필요한가"(보안 스캔 사각지대의
근본 원인)를 잘 설명한다. `CHANGELOG.md` 미갱신도 저장소 관례(제품/배포 코드 전용, 하네스 툴링은
plan 문서가 담당) 확인 결과 정당해 추가를 권고하지 않는다. 유일한 실질 개선점은 `PROJECT.md` 의
"의존성 취약점 audit·핀 거버넌스" 절이 이번에 신설된 Dependabot 기반 보조 경로(pnpm 워크스페이스
밖 트리 커버)를 언급하지 않아 canonical 인프라 문서로서 부분적으로 불완전해졌다는 것 — 1~2문장
추가로 해소 가능한 낮은 비용의 개선이며 이번 PR 을 막을 사유는 아니다.

## 위험도
LOW
