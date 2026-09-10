# 요구사항(Requirement) 리뷰 — deps-audit-floor-refresh-2026-09

## 검증 방법

원본 파일(`Read`)과 실행 검증(`Bash`, 저장소 뮤테이션 없이 read-only 명령만)을 병행했다. 주요 실측:

- `pnpm audit --audit-level=moderate` → `No known vulnerabilities found` (exit 0, plan/CHANGELOG 주장과 일치)
- `python3 scripts/check-override-floors.py` → `override 대상 30개 패키지 중 취약 재유입 0건` (exit 0, 일치)
- `python3 scripts/check-pnpm-security-config.py` → `overrides 33건(값 포함) · onlyBuiltDependencies 5건 · ignoreCves 0건 baseline 일치` (exit 0, 일치)
- `python3 scripts/check-unmet-peers.py` → 미충족 peer 2건(`nunjucks→chokidar`, `typeorm→ioredis`) 전부 기존 등재 수용 항목 (exit 0, 일치)
- `pnpm-workspace.yaml` `overrides` ↔ `scripts/check-pnpm-security-config.py` `EXPECTED_OVERRIDES` — Python `yaml.safe_load` 로 33개 키·값 전수 대조, 완전 일치
- `npm view express@5.2.1 dependencies.qs` → `^6.14.0`, `npm view superagent@10.3.0 dependencies.qs` → `^6.14.1` — CHANGELOG/plan 이 명시한 부모 선언 범위와 정확히 일치, `qs: ^6.16.0` override 가 두 범위를 모두 만족
- `pnpm-lock.yaml` diff 전수 대조: `@radix-ui/*` 11개 + `postcss@8.5.25` 흡수, `@radix-ui/react-use-escape-keydown@1.1.2` 완전 소실(grep 0건) — CHANGELOG 서술과 정확히 일치
- `_test_logs/*.log` 4개 파일 존재 확인 + e2e 로그의 `Tests: 305 passed, 305 total`, `51 passed (1.0m)` 라인 확인 — plan 체크리스트 주장과 일치
- 커밋 3개(`99c61f714`/`74e02bd5f`/`7411318bf`)가 review payload 8개 파일과 정확히 대응

이 정도로 서술-실측 간 1:1 대응이 촘촘한 PR은 드물다. 발견된 결함은 없고, 완전성 관점의 사소한 관찰 2건만 있다.

## 발견사항

- **[INFO]** `@next/mdx` 는 `next` 상향(`^16.2.12`→`^16.3.3`)과 별개로 `^16.2.12` 에 그대로 남아있다
  - 위치: `codebase/frontend/package.json:23`
  - 상세: 이 PR 은 `next` 자체의 critical CVE(GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4)를 해소하려고 frontend·channel-web-chat 양쪽의 `next` 선언을 올렸다(§"같은 lockfile 엔트리를 공유하므로 한쪽만 올리면 재해소 때 되돌아온다"는 근거 서술까지 정확함, 실측 확인). 그런데 `@next/mdx` 는 같은 `16.x` 넘버링을 쓰는 별도 npm 패키지임에도 상향 대상에서 빠졌다. `npm view @next/mdx@16.2.12 peerDependencies` 로 확인한 결과 `next` 에 대한 peer 선언이 없어 설치 충돌은 없고, `pnpm audit`/`check-unmet-peers.py` 도 통과하므로 **기능적 결함은 아니다**. 다만 CHANGELOG/plan 이 "next ^16.2.12 → ^16.3.3(frontend·channel-web-chat 양쪽)" 이라고 "완전성"을 주장하는 문구 바로 옆에 같은 리포지토리 안의 `@next/mdx` 잔존 구버전 핀이 있어, 다음 사람이 "next 계열 전부 정리됐다"로 오독할 여지가 있다.
  - 제안: 조치 불필요(이번 PR 스코프는 CVE 해소이고 `@next/mdx` 에는 해당 CVE가 없음). 단, CHANGELOG 문구를 "next(코어)" 로 한정하거나 `@next/mdx` 동반 상향 여부를 별도 후속 항목으로 남기면 다음 세션의 오독을 예방할 수 있다.

- **[INFO]** `qs` override 근거 서술의 부모 경로가 "두 경로" 로 되어 있으나 실제 트리에는 세 번째 경로(`body-parser`)가 있다
  - 위치: `pnpm-workspace.yaml:85-92` (주석), `plan/in-progress/deps-audit-floor-refresh-2026-09.md:60-66`, `CHANGELOG.md:44-47`
  - 상세: 주석·plan·CHANGELOG 모두 `qs` 의 소비 경로를 `express@5.2.1>qs`(prod) · `supertest>superagent>qs`(dev) 두 곳으로 서술한다. 실측(`pnpm-lock.yaml` 의 `qs: 6.16.0` 참조 3곳 대조 + `npm view body-parser@2.3.0 dependencies.qs`)하면 `express@5.2.1` 자신이 의존하는 `body-parser@2.3.0` 도 `qs: ^6.15.2` 를 선언하는 세 번째(사실상 express 트리 내부의) 소비처다. `^6.16.0` 이 `^6.15.2` 범위도 만족하므로 override 자체는 안전하고 **결과에 오류는 없다** — `pnpm audit` exit 0 이 그것을 독립적으로 확인한다. 다만 "부모 선언 범위를 확인했다"는 근거 문장이 실제로는 열거된 두 경로만 검증했고, 트리에 존재하는 세 번째 상위 제약(body-parser)은 검증 대상에서 빠졌다.
  - 제안: 조치 불필요(결과 동일, 범위도 더 넓게 만족). 후속 override 값 변경 시(예: qs 재상향) 이번에 누락된 `body-parser` 경로도 함께 확인 대상에 포함하면 재발을 막을 수 있다.

## Spec fidelity

`spec/` 폴더에는 의존성 취약점 audit·override 거버넌스를 다루는 문서가 없다(전수 grep 결과 `spec/conventions/node-output.md` 의 우연한 단어 일치 1건뿐, 관련 없음). 이 영역의 SoT 는 `PROJECT.md §의존성 취약점 audit·핀 거버넌스`(CLAUDE.md 가 "실제 명령·인프라"의 SoT로 명시 지정)이며, 요구하는 3대 게이트(`pnpm audit`, `check-pnpm-security-config.py` 2-place baseline, `check-override-floors.py` 바닥 침식 검출)와 "핀 변경 시 pnpm-workspace.yaml + EXPECTED_* 동시 갱신" 2-place 편집 규약이 이번 커밋에 정확히 반영됐다(스크립트 실행으로 확인). spec 누락은 이 영역의 기존 상태이며 본 PR이 만든 갭이 아니다.

## 요약

Dependabot PR 7건을 막던 main 브랜치의 audit 25건(1 low·10 moderate·12 high·2 critical)을 override 바닥 8건 상향, override 신설 1건(`qs`), 직접 의존 선언 4건 상향으로 전량 해소한 PR이다. 모든 수치·경로·버전 주장을 로컬에서 직접 재현해 CHANGELOG/plan 서술과 실측이 정확히 일치함을 확인했다(`pnpm audit` exit 0, override-floors exit 0, security-config snapshot exit 0, unmet-peers exit 0, lockfile diff 상 버전 하향 0건). 2-place 편집 규약(`pnpm-workspace.yaml` ↔ `check-pnpm-security-config.py`)도 정확히 지켜졌고, TEST WORKFLOW 4단계(lint/unit/build/e2e) 로그도 실존하며 주장과 일치한다. CRITICAL/WARNING 없음 — INFO 2건은 결과에 영향 없는 서술 완전성 관찰(`@next/mdx` 미동반 상향, `qs` 부모 경로 서술 미포함 3번째 경로)이며 조치 불필요.

## 위험도

NONE
