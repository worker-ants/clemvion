# 요구사항(Requirement) 리뷰 — mermaid-lint undici/dompurify 취약점 fix + Dependabot 편입

## 대상 요구사항

`plan/in-progress/harness-guard-followups.md` §F("mermaid-lint npm 트리 취약점 + 보안 스캔 갭"):
1. `cd .claude/tools/mermaid-lint && npm audit fix` (lockfile 갱신)
2. `deps-security-checks.yml` 에 mermaid-lint 전용 audit 스텝 추가 **또는** Dependabot npm ecosystem 등록

## 검증 방법 (실 worktree 재현, diff 텍스트만 읽지 않음)

`/Volumes/project/private/clemvion/.claude/worktrees/mermaid-lint-undici-vuln-2956f1` (커밋
`02d69e324`, `git diff origin/main --stat` = 정확히 3 파일 24+/9-)에서:

- `node -e`로 lockfile 파싱 → `undici`/`dompurify`가 각각 `jsdom`(`^7.25.0`)·`mermaid`(`^3.3.1`)의
  transitive dep 이고 새 버전이 그 range 를 만족함을 확인
- `npm audit --audit-level=low` 실행 → `found 0 vulnerabilities` 재현
- 실제 설치된 `node_modules/{dompurify,undici}/package.json` 버전이 lockfile 과 일치(스텁이 아니라
  실제 설치 확인)
- `lint-mermaid.mjs`를 정상/malformed mermaid 픽스처로 직접 실행 → exit 0 / exit 1 (파싱 에러 검출)
  보존 확인 — 커밋 메시지의 "기능 무회귀" 주장을 독립 재현
- `.github/workflows/deps-security-checks.yml`·`e2e.yml`·`harness-checks.yml`의 `paths`/`paths-ignore`
  필터 직접 확인
- `spec/` 전체에 `mermaid-lint`·`.claude/tools` grep → 0건 (관련 spec 문서 부재 확인)
- `plan/in-progress/harness-guard-followups.md` frontmatter·본문·`.claude/docs/plan-lifecycle.md`
  §3(push-gate 연결 판정 규칙) 대조

## 발견사항

- **[INFO]** 관련 spec 문서 없음 (점검 관점 9)
  - 위치: 변경 3 파일 전체
  - 상세: `spec/`는 product 정의(backend/frontend/channel-web-chat) 전용이고 `.claude/` 하네스
    내부 도구는 스코프 밖이다. `spec/` 전체에서 `mermaid-lint`·`.claude/tools` 문자열 매치 0건.
    CLAUDE.md 정보 저장 위치 표에도 이 종류 변경에 대응하는 spec 슬롯이 없다.
  - 제안: 정상 — spec 갱신 불요, `project-planner` 위임 불요.

- **[INFO]** 기능 완전성: plan §F 두 체크박스 모두 실제로 충족됨
  - 위치: `.claude/tools/mermaid-lint/package-lock.json`, `.github/dependabot.yml`
  - 상세: (1) `npm audit fix` 산출물은 `dompurify`/`undici` 2개 패키지의 `version`/`resolved`/
    `integrity` 3필드만 변경한 최소 diff이고 `npm audit` 재실행으로 0 vulnerabilities 실측 확인,
    `package.json` range 불변(diff 밖) 확인. (2) 원 체크박스가 "audit 스텝 추가 **또는**
    Dependabot 등록"으로 OR 조건이었는데, Dependabot npm ecosystem 등록을 선택 — `directory:
    "/.claude/tools/mermaid-lint"`가 실제 package.json 위치와 정확히 일치하고 YAML 문법 유효.
    두 체크박스 모두 완결.
  - 제안: 없음.

- **[INFO]** 비즈니스 로직 근거("영구 무신호") 재검증 — 사실
  - 위치: `.github/workflows/deps-security-checks.yml` L19-32, `.github/dependabot.yml` 신규 주석
  - 상세: `deps-security-checks.yml`의 `paths` 필터는 `pnpm-workspace.yaml`·`pnpm-lock.yaml`·
    루트/`codebase/**` `package.json`만 감시하고 `.claude/tools/mermaid-lint/**`는 대상 밖임을
    직접 확인했다. 커밋/plan 이 주장하는 "이 npm 트리는 등록 전까지 영구 무신호였다"는 근거가
    실측과 일치한다(허구적 rationale 아님).
  - 제안: 없음.

- **[INFO]** Dependabot "security update" 서술이 GitHub 의 두 별개 기능을 정밀 구분하지 않음
  - 위치: `plan/in-progress/harness-guard-followups.md` §F 두 번째 항목, 커밋 메시지
    ("Dependabot 에 npm ecosystem 엔트리 추가 — security update 로 신규 CVE 를 자동 PR 화한다")
  - 상세: `dependabot.yml`의 `updates:` 항목은 GitHub의 **"version updates"**(스케줄 기반, 이번엔
    주 1회)를 구성한다. **"security updates"**(취약점 공시 즉시 자동 PR)는 리포지토리 레벨
    토글(Settings → Code security and analysis)로 별도 활성화되며 dependency graph 만으로 이미
    작동 가능해 이 `dependabot.yml` 엔트리 등록 여부와 무관할 수 있다 — 로컬 checkout 에서는 그
    repo 설정을 확인할 수 없다. 다만 최소한 스케줄 버전 업데이트(주간)는 이 엔트리로 확실히
    얻어지므로 "이 트리가 CVE 스캔에서 완전히 빠져 있었다"는 핵심 문제는 실질적으로 해소된다 —
    서술 정밀도 이슈일 뿐 기능적 결손은 아니다.
  - 제안: (경미, 코드 fix 불요) 향후 서술 시 "스케줄 버전 업데이트 PR(확정) + repo security
    updates 토글이 켜져 있으면 즉시 PR(조건부)"로 두 메커니즘을 분리 서술하면 더 정확.

- **[INFO]** `.github/dependabot.yml` 변경 자체는 실제 `e2e.yml`의 `paths-ignore`엔 안 걸림
    (PROJECT.md 화이트리스트는 `.github/**` 포함) — pre-existing, 이 PR 범위 밖
  - 위치: `.github/workflows/e2e.yml` L9-22 (이 diff 가 건드리지 않은 파일)
  - 상세: `PROJECT.md` §e2e 면제 화이트리스트는 `.github/**`를 "CI 정의는 e2e 가 검증 대상
    아님"으로 명시 면제한다(정책 SoT). 그런데 실제 `e2e.yml`의 `paths-ignore`는 `.claude/**`·
    `spec/**`·`plan/**`·`review/**`·`*.md`만 나열하고 `.github/**`가 없다(직접 확인). 이번 PR이
    바꾼 3 파일 중 `.github/dependabot.yml`은 그 목록의 어떤 패턴에도 안 걸려, 문서화된 정책과
    달리 GitHub Actions 상에서는 e2e 워크플로가 실제로 트리거될 수 있다. `.claude/tools/**` 변경
    (package-lock.json)이 같은 PR 에 있어 `harness-checks.yml`은 어차피 트리거되므로 "harness
    301 통과" 주장 자체는 검증 가능하지만, "e2e 면제(.github/**...)" 서술은 정책 문서(PROJECT.md)
    기준으로는 맞고 실제 워크플로 트리거 여부 기준으로는 어긋난다. **이 diff 가 만든 결함이
    아니라 선재하는 정책-구현 drift**이며 `e2e.yml` 자체는 이번 변경셋 밖.
  - 제안: 이번 PR 의 fix 대상 아님(scope 오염 방지). 별도 후속으로 `e2e.yml`의 `paths-ignore`에
    `.github/**`를 추가해 `PROJECT.md` 화이트리스트와 동기화하는 것을 고려할 만하다 — 방식은
    `harness-guard-followups.md` 류 후속 추적 문서에 등록 권장(직접 spec 변경 아님, 본 리뷰어는
    구현/문서 수정 안 함).

- **[INFO]** plan frontmatter `worktree:` 와 실제 작업 worktree 불일치 — 의도된 다중-PR 패턴
  - 위치: `plan/in-progress/harness-guard-followups.md` frontmatter (`worktree:
    harness-guard-followups-f7140c`, 이 diff 는 미변경)
  - 상세: 이 diff 를 실제로 만든 worktree 는 `mermaid-lint-undici-vuln-2956f1`(브랜치
    `claude/mermaid-lint-undici-vuln-2956f1`)로 frontmatter 값과 다르다. 그러나 plan 본문
    최상단이 "각 항목은... 서로 독립이라 개별 PR 로 처리 가능"이라 명시하므로 A(원 worktree)·
    F(이 worktree)가 다른 worktree 에서 순차 처리되는 것은 설계상 의도된 패턴이다.
    `.claude/docs/plan-lifecycle.md` §3의 push-gate "연결" 판정은 `codebase/**` 변경이 있을 때만
    발화하는데 이 diff 는 `codebase/**`를 건드리지 않으므로 게이트 영향이 없고,
    `harness-guard-followups-f7140c` worktree 는 현재도 살아있어(`ls .claude/worktrees/` 확인)
    `plan-stale-audit.sh` 오탐 우려도 당장은 없다.
  - 제안: 없음(정보성 기록). 그 worktree 가 나중에 reap 되면 stale-audit 이 "등록된 worktree
    소멸"로 플래그할 수 있다는 점만 참고.

- **TODO/FIXME/HACK/XXX**: diff 전체에서 0건 (grep 확인) — 미완성 흔적 없음.
- **엣지 케이스/에러 시나리오/반환값**: 이 diff 는 데이터(JSON lockfile)·설정(YAML)·문서(Markdown)
  변경만이고 신규 함수·분기·에러 경로를 도입하지 않으므로 해당 관점은 원칙적으로 적용 대상이
  아니다(N/A). 유일한 "동작"인 `npm audit fix`의 산출물이 기존 도구(`lint-mermaid.mjs`)의 성공/
  실패 두 경로 모두에서 실제로 정상 동작함을 직접 스모크테스트로 확인했다(위 검증 방법 참고).

## 요약

`plan/in-progress/harness-guard-followups.md` §F가 정의한 두 요구사항(lockfile 취약점 패치,
보안 스캔 커버리지 등록)을 실제 worktree 에서 직접 재현·검증한 결과 빠짐없이, 정확하게 충족한다.
`npm audit fix` 는 `dompurify`(mermaid의 transitive dep)와 `undici`(jsdom의 transitive dep) 두
패키지만 최소 변경으로 패치해 `npm audit` 0 vulnerabilities 를 실측 확인했고, `package.json` range·
설치된 `node_modules` 버전·`lint-mermaid.mjs` 의 성공/실패 두 경로 모두 회귀 없음을 직접 검증했다.
`.github/dependabot.yml`의 신규 npm ecosystem 엔트리는 `deps-security-checks.yml`(pnpm 전용)이
이 트리를 커버하지 않는다는 plan 의 근거를 실측으로 뒷받침하며 문법·경로 모두 정확하다. plan 문서
체크박스 갱신도 실제 diff 범위(3 파일)와 정확히 일치해 과대서술이 없다. 관련 `spec/` 문서는
존재하지 않으며(harness 내부 도구로 스코프 밖) 이는 정상이다. CRITICAL/WARNING 급 결함은
발견되지 않았고, 발견된 사항은 모두 (a) 이 PR 자체와 무관한 선재 정책-구현 drift(e2e.yml
paths-ignore 가 PROJECT.md 화이트리스트의 `.github/**`를 아직 반영 안 함) 또는 (b) 서술 정밀도
경미 노트(Dependabot version update vs security update 메커니즘 구분)로, 모두 별건/정보성이며
이 diff 의 요구사항 충족 여부 자체를 흔들지 않는다.

## 위험도

LOW
