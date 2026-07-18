# 부작용(Side Effect) 리뷰

## 리뷰 대상
- `.claude/tools/mermaid-lint/package-lock.json` (dompurify 3.4.7→3.4.12, undici 7.27.0→7.28.0)
- `.github/dependabot.yml` (npm ecosystem 엔트리 신설, `/.claude/tools/mermaid-lint`)
- `plan/in-progress/harness-guard-followups.md` (§F 체크리스트 완료 표기)

### 발견사항

- **[WARNING]** 부트스트랩 설치 완료 마커가 lockfile 내용과 무관해 보안 픽스가 이미 설치된 트리에 전파되지 않을 수 있음
  - 위치: `.claude/tools/bootstrap-session.sh:75-108` (마커 게이트, 이 diff 밖 파일) ↔ `.claude/tools/mermaid-lint/package-lock.json` (이 diff)
  - 상세: `bootstrap-session.sh` 는 `node_modules/.bootstrap-install-complete` 마커의 **존재 여부만** 검사해 `npm install` 을 skip 한다(`tool_dir="$main_root/.claude/tools/mermaid-lint"` — 모든 worktree 가 공유하는 **main checkout** 이 대상). 마커는 lockfile 내용·해시와 전혀 연동돼 있지 않다. 즉 이미 마커가 찍힌 환경(마커 도입 커밋 `ceee1fa5b` 이후 정상 install 을 한 번이라도 완주한 main checkout·개발자 로컬 클론)은 이 PR 이 패치한 `package-lock.json`(undici 7.27.0→7.28.0 HIGH, dompurify 3.4.7→3.4.12 moderate)이 main 에 merge 돼도 **재설치를 트리거하지 않는다** — `rm -rf node_modules` 없이는 구버전(취약) 패키지가 그대로 남는다.
    실측(본 샌드박스): main checkout(`/Volumes/project/private/clemvion`)의 `.claude/tools/mermaid-lint/node_modules` 에는 현재 `undici@7.27.0` / `dompurify@3.4.7`(구버전)가 설치돼 있고 완료 마커는 부재다. 이 특정 스냅샷은 마커가 없어 다음 SessionStart 에 자연 재설치로 self-heal 되지만, 이는 정확히 "마커가 lockfile 을 추적하지 않는다"는 설계를 확인해 주는 관측이며 — 마커가 **존재하는** 상태에서 이 lockfile 변경이 merge 되는 케이스에서는 그대로 재현된다.
    더 중요하게는, 같은 diff 의 `.github/dependabot.yml` 신규 엔트리로 인해 **향후 모든 CVE 픽스가 이 경로(lockfile-only PR)로 자동 유입**된다. 즉 이 활성화 갭은 이번 한 번이 아니라 매 후속 Dependabot 보안 PR 마다 구조적으로 재발한다 — "보안 스캔 사각지대 해소" 라는 이 diff 의 목적을 부분적으로 무력화하는 잠재 위험.
  - 제안: 마커를 lockfile 내용에 결속(예: 마커 파일명/내용에 `package-lock.json` 체크섬 포함, 불일치 시 재설치를 트리거)하거나, 최소한 PR 설명·plan 문서에 "이미 bootstrap 을 마친 checkout 은 `rm -rf .claude/tools/mermaid-lint/node_modules` 수동 필요" 를 명시. `plan/in-progress/harness-guard-followups.md` §A 후속(현재 `[ ] W1/W3/W4` 목록) 또는 §G 에 후속 항목으로 등록하는 것을 검토.

- **[INFO]** `dependabot.yml` 신규 엔트리는 주석이 서술한 "보안 전용" 보다 넓게 동작할 수 있음
  - 위치: `.github/dependabot.yml:14-18` (신규 엔트리)
  - 상세: 추가된 주석은 목적을 "Dependabot security update 로 신규 CVE 를 자동 PR 화한다" 로 좁게 서술하지만, 실제로 작성된 블록은 Dependabot **version-updates** 스키마(`schedule.interval: "weekly"`)다. GitHub 의 "Dependabot security updates" 는 취약점 알림 발생 시 별도로 동작하는 기능(이 config 없이도 상당 부분 가능)인 반면, `dependabot.yml` 의 이 엔트리는 **취약점 유무와 무관하게** 주 단위로 해당 디렉터리의 outdated 패키지를 스캔해 PR 을 연다. `package.json` 의 direct dependency(`jsdom`, `mermaid`)가 이미 `"*"` 로 범위 제한이 없어 신버전이 나올 때마다 정기(비-보안) PR 노이즈가 발생할 여지가 있다 — 주석이 암시하는 "CVE 전용" 신호보다 실제 이벤트 발생 범위가 넓다.
  - 제안: 의도가 정말 보안 전용이면 `open-pull-requests-limit: 0` 추가를 검토(정기 버전 PR 억제, 보안 PR 경로는 별도로 유지되는지 확인). 아니면 주석을 "보안 + 정기 최신화 겸용" 으로 정정. 어느 쪽이든 병합을 막을 사유는 아님.

- **[INFO]** lockfile 변경 자체의 인터페이스/시그니처 리스크는 낮음 — 확인된 근거
  - 위치: `.claude/tools/mermaid-lint/package-lock.json`, `.claude/tools/mermaid-lint/lint-mermaid.mjs`, `.claude/tools/mermaid-lint/package.json`
  - 상세: diff 는 `npm audit fix`(non-force) 산출물로 `dompurify`/`undici` 두 transitive 엔트리의 `version`/`resolved`/`integrity` 만 바뀌고, `package.json` 의 direct dependency range(`jsdom: "*"`, `mermaid: "*"`)와 두 패키지의 `engines` 제약(`node >=20.18.1` 등)은 diff 에 나타나지 않아 불변임을 확인했다. `lint-mermaid.mjs` 는 `dompurify`/`undici` 를 직접 import/호출하지 않는다(grep 확인, 매치 0건) — 두 패키지는 `jsdom` 내부에서만 소비되므로 이 diff 로 인한 공개 인터페이스·함수 시그니처 변화는 없다. `.gitignore` 에 `node_modules/` 가 이미 등록돼 있어 이 변경이 새로운 파일시스템 부작용(실수로 커밋되는 산출물)을 만들지도 않는다.

- **[INFO]** `plan/in-progress/harness-guard-followups.md` 변경은 순수 문서(체크리스트/rationale) 갱신
  - 위치: 전체 diff
  - 상세: 실행 코드가 아니므로 런타임 부작용 없음. `[x]` 로 표기된 §F 항목(undici/dompurify 픽스, Dependabot 등록)은 실제로 file 1·2 의 변경과 일치해 "체크박스=실제 상태" 원칙에 부합함을 확인했다(fabricated 완료 표기 아님).

### 요약

세 파일의 diff 자체는 범위가 좁고 correctness 리스크가 낮다 — lockfile 변경은 `npm audit fix` 산출물로 `package.json` range·`engines` 가 불변이고 두 패키지 모두 lint 스크립트에서 직접 호출되지 않아 인터페이스/시그니처 부작용이 사실상 없으며, plan 문서 변경은 실제 코드 변경과 정합한다. 다만 이 PR 의 **목적**(보안 취약점 해소)이 실제로 전달되는지는 diff 밖의 기존 부트스트랩 마커 설계에 의존하는데, 그 마커가 lockfile 내용과 무관하게 "존재 여부"만 검사하는 탓에 이미 install 을 마친 환경에서는 이 픽스가 무신호로 무력화될 수 있다(본 샌드박스에서 직접 관측: main checkout 에 구버전 undici/dompurify 가 잔존, 마커는 우연히 부재라 다음 세션에 self-heal 되는 상태였음). 같은 diff 가 동시에 Dependabot npm 등록을 추가하므로, 이 활성화 갭은 향후 모든 자동 보안 PR 마다 재발하는 구조적 문제로 이어질 수 있다. Dependabot 신규 엔트리도 주석이 말하는 "보안 전용" 보다 넓게(정기 버전 갱신 포함) 동작할 수 있다는 점을 참고 사항으로 남긴다. 두 항목 모두 이번 diff 를 차단할 사유는 아니며 후속 조치 권장 수준이다.

### 위험도
MEDIUM
