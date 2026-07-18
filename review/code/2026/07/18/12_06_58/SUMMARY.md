# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. WARNING 2건: (1) 부트스트랩 설치완료 마커가 `package-lock.json` 내용과 무관해 이미 install 을 마친 checkout 에는 이번 보안 패치가 전파되지 않을 수 있고, 같은 diff 가 추가한 Dependabot 자동 보안 PR 경로에서 이 활성화 갭이 구조적으로 재발할 소지가 있음(side_effect, MEDIUM). (2) `PROJECT.md` 의존성 거버넌스 절이 신설된 Dependabot npm 경로를 언급하지 않아 canonical 문서가 부분적으로 불완전(documentation, LOW). 취약점 패치 자체(undici HIGH 7건·dompurify moderate 3건 → 0)는 6개 reviewer 전원이 독립 실측 재현으로 정확함을 확인했고 병합을 막을 사유는 없음 — 위 WARNING 2건은 후속 조치 권장 수준. forced whitelist(dependency, documentation) 는 둘 다 전문 확보됨, 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side-effect | 부트스트랩 설치완료 마커(`node_modules/.bootstrap-install-complete`)가 존재 여부만 검사하고 `package-lock.json` 내용/체크섬과 연동되지 않음. 이미 이 마커가 찍힌 main checkout·개발자 로컬 클론은 이번 보안 픽스(undici/dompurify)가 merge 돼도 재설치가 트리거되지 않아 취약 버전이 잔존할 수 있음. 같은 diff 가 Dependabot npm ecosystem 을 신설해 향후 모든 자동 보안 PR 이 이 경로(lockfile-only)로 유입되므로, 이 활성화 갭은 이번 1회가 아니라 매 후속 보안 PR 마다 구조적으로 재발함 | `.claude/tools/bootstrap-session.sh:75-108`(diff 밖) ↔ `.claude/tools/mermaid-lint/package-lock.json` | 마커를 lockfile 체크섬에 결속(불일치 시 재설치 트리거)하거나, 최소한 plan/PR 설명에 "이미 bootstrap 한 checkout 은 `rm -rf .claude/tools/mermaid-lint/node_modules` 수동 필요"를 명시. `harness-guard-followups.md` 후속 항목으로 등록 검토 |
| 2 | Documentation | `PROJECT.md` 의 "의존성 취약점 audit·핀 거버넌스" 절이 pnpm 워크스페이스 경로(`deps-security-checks.yml`)만 서술하고, 이번에 신설된 Dependabot npm ecosystem 보조 경로(`.claude/tools/mermaid-lint`, pnpm 밖 독립 npm 트리 커버)를 언급하지 않아 canonical 인프라 문서로서 불완전. 새로 저장소를 접하는 개발자가 이 문서만 읽으면 "pnpm audit 이 전체 의존성을 커버한다"고 오해 가능 | `PROJECT.md:48` | 1~2문장 추가: "pnpm 워크스페이스 밖 독립 npm 트리(`.claude/tools/mermaid-lint` 등)는 `.github/dependabot.yml` 의 `npm` ecosystem 항목으로 별도 커버(주간 스케줄·리액티브, PR 시점 신규 의존성 추가를 능동 차단하진 않음)" |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency | CVE 해소를 독립 실측 재현 — undici HIGH 7건(SOCKS5 TLS 인증서 검증 우회·HTTP 헤더 인젝션·WebSocket DoS·프록시 풀 재사용을 통한 cross-origin 라우팅 등)·dompurify moderate 3건(`ALLOWED_ATTR` pollution 등)이 구 lockfile `npm audit` 재현과 정확히 일치, fix 후 0 vulnerabilities, 레지스트리 공식 integrity 해시와 바이트 단위 일치(수동 변조·타이포스쿼팅 없음), 부모 패키지 semver range 내 patch/minor 업그레이드로 breaking 없음 | `package-lock.json` (undici 7.27.0→7.28.0, dompurify 3.4.7→3.4.12) | 없음 — 이미 올바르게 조치됨 |
| 2 | Dependency | Dependabot 신규 엔트리는 실제로는 GitHub "version updates" 스키마(스케줄 기반, weekly)이며, 주석이 암시하는 "보안 전용(security update)"과는 별개 메커니즘. Repo 레벨 "security updates" 토글 활성 여부는 로컬에서 확인 불가. 주간 cadence 라 신규 CVE 공시 후 최대 ~1주 반응 지연 가능, direct dep(`jsdom`/`mermaid`)가 `"*"`라 정기 비-보안 PR 노이즈 발생 여지도 있음 | `.github/dependabot.yml` (신규 엔트리) | 의도가 보안 전용이면 `open-pull-requests-limit: 0` 검토, 또는 주석을 "스케줄 버전 업데이트(확정) + repo security updates 토글 시 즉시 PR(조건부)"로 정밀화 — 비차단, 경미 |
| 3 | Requirement | `.github/workflows/e2e.yml` 의 `paths-ignore` 가 `PROJECT.md` 화이트리스트가 명시하는 `.github/**` e2e 면제를 실제로는 반영하지 않음(직접 대조 확인) — 이 PR 이 만든 결함이 아니라 선재하는 정책-구현 drift, `e2e.yml` 자체는 diff 밖 | `.github/workflows/e2e.yml:9-22` | 이 PR 의 fix 대상 아님. 후속으로 `e2e.yml` paths-ignore 에 `.github/**` 추가해 PROJECT.md 화이트리스트와 동기화 고려(`harness-guard-followups.md` 류 후속 추적 문서에 등록 권장) |
| 4 | Requirement | plan §F 두 체크박스(lockfile 취약점 패치, 보안 스캔 커버리지 등록) 모두 실제 diff(3파일, 24+/9-)와 정확히 일치 — 과대서술 없음. 관련 `spec/` 문서 부재는 정상(harness 내부 도구, product spec 스코프 밖, grep 0건 확인) | `plan/in-progress/harness-guard-followups.md` §F | 없음 |
| 5 | Dependency / Security | `package.json` 의 `jsdom`/`mermaid` 의존성 range 가 `"*"` 로 미고정 — pre-existing, 이 diff 범위 밖. lockfile 이 유일한 실질 버전 고정 수단(현재는 정상 보존됨) | `.claude/tools/mermaid-lint/package.json:11-12` | 별건 후속으로 `^` range 명시 고려. 이번 PR 요구사항 아님 |
| 6 | Security | 하드코딩 시크릿·자격증명 없음. 새 top-level 의존성 추가 없음(undici/dompurify 모두 기존 transitive dep). 라이선스 변경 없음(MIT/dompurify dual-permissive, 배포 코드 아니라 전이 이슈 자체 없음). 신규 서브 의존성 없어 빌드/번들 영향 사실상 0 | 변경 3파일 전체 | 없음 |
| 7 | Documentation | `CHANGELOG.md` 미갱신은 저장소 관례상 정당 — 기존 "Unreleased" 항목 전수가 배포되는 제품 코드(backend/frontend/channel-web-chat) 전용이고 `.claude/tools/mermaid-lint` 는 미배포 harness 로컬 도구라 스코프 밖. `plan/in-progress/harness-guard-followups.md` §F 가 실질 변경 이력 기록 위치이며 이미 충실히 갱신됨 | `CHANGELOG.md`(미변경) | 없음 — 현행 유지가 맞음 |
| 8 | Scope | payload(3파일)가 실제 워크트리 `git diff origin/main...HEAD`(24+/9-)와 정확히 일치, 누락·과잉 없음. 두 관심사(취약점 fix + Dependabot 등록)가 한 커밋에 묶인 것은 plan §F 에 사전 정의된 단일 단위(Rationale 명시)라 스코프 확장이 아님 | 전체 diff | 없음 |
| 9 | Requirement | plan frontmatter `worktree:` 값(`harness-guard-followups-f7140c`)이 실제 작업 worktree(`mermaid-lint-undici-vuln-2956f1`)와 다르나, plan 본문이 "독립 항목은 개별 PR 로 처리 가능"을 명시해 설계상 의도된 다중-PR 패턴. `codebase/**` 미변경이라 push-gate 연결 판정 영향 없음 | `plan/in-progress/harness-guard-followups.md` frontmatter | 없음(정보성) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | undici/dompurify CVE 해소 라이브 재현 확인, 하드코딩 시크릿 없음 |
| requirement | LOW | plan §F 요구사항 완전 충족; e2e.yml paths-ignore 정책-구현 drift(별건, 비차단) |
| scope | NONE | payload 가 실제 diff(3파일)와 정확히 일치, 스코프 이탈 없음 |
| side_effect | MEDIUM | 부트스트랩 마커가 lockfile 미추적 → 보안 픽스 미전파 가능(WARNING #1) |
| documentation | LOW | PROJECT.md 거버넌스 절 갱신 누락(WARNING #2); CHANGELOG 미갱신은 정당 |
| dependency | NONE | 새 의존성 없음, integrity/라이선스/semver 전부 정상, Dependabot 커버리지 갭 실재 확인 |

## 발견 없는 에이전트

없음 — 6개 reviewer 전원이 최소 INFO 수준 이상의 관찰을 기록했다(Critical/Warning 이 없는 security·scope·dependency 도 검증 근거를 남긴 INFO 항목 보유).

## 권장 조치사항

1. (WARNING #1 대응, 최우선) `bootstrap-session.sh` 의 설치완료 마커를 `package-lock.json` 체크섬에 결속하거나, 최소한 이미 bootstrap 을 마친 checkout 에 대해 수동 재설치 필요성을 plan 문서/PR 설명에 명시 — 이번 보안 패치가 실제로 전파되도록 보장.
2. (WARNING #2 대응) `PROJECT.md:48` 의존성 거버넌스 절에 신설된 Dependabot npm ecosystem 경로(pnpm 밖 독립 트리 커버) 1~2문장 추가.
3. (INFO #3, 낮은 우선순위 후속) `.github/workflows/e2e.yml` 의 `paths-ignore` 에 `.github/**` 를 추가해 `PROJECT.md` 화이트리스트와 동기화 — 선재 drift, 별건 추적 문서에 등록.
4. (INFO #2, 선택) `dependabot.yml` 주석을 실제 메커니즘(스케줄 버전 업데이트 vs repo 설정 security updates)에 맞게 정밀화하거나 `open-pull-requests-limit` 재검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `documentation`, `dependency` (6명)
  - **제외**: 8명 (아래 표)
  - **강제 포함(router_safety)**: `dependency`, `documentation` — 둘 다 전문 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 변경(lockfile/CI 설정/plan 문서, 코드 로직 무변경)에 무관 판단. 개별 사유는 prompt 에 미상세 |
  | architecture | 상동 |
  | maintainability | 상동 |
  | testing | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |