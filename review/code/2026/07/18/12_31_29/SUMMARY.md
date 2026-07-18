# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음, 병합을 막을 결함 없음. 다만 `testing` 리뷰어가 실측(PATH-shadow 스텁·lockfile-재작성 스텁)으로 재현한 "install-전/후 lockfile 캡처 순서" 설계 갭(W2)과 "해싱 도구 부재 폴백 무테스트" 갭(W3)이 이 PR 자신이 고치려던 실패 모드(W1 재발)를 다른 조건에서 되살릴 수 있음을 보였고, 5개 리뷰어가 독립 수렴한 "NO LOCK/one-time 설계주석이 이 diff가 만든 새 재발 표면(정기 lockfile 변경)을 더는 정확히 서술하지 못함"(W1)까지 더해 전체 위험도를 LOW 대신 MEDIUM 으로 판정한다. 단, `side_effect` 는 실제 npm 10.9.2 로 install 전후 lockfile 해시 불변을 확인해 W2 의 worst-case 는 재현하지 못했다 — 실사용 노출도는 낮되 설계상 미방어 지점이라는 평가.

**강제 화이트리스트(router_safety) 관련 특이사항 없음**: prompt 가 "forced 전원 결과 확보됨"을 명시했고, 8개 forced reviewer(dependency, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원의 전문을 실제로 확보·반영했다. 누락된 forced reviewer 없음.

## Critical 발견사항

없음 — 14개 reviewer 전원에서 `[CRITICAL]` 태그 발견사항 0건.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 문서-코드 정합성 (설계주석 drift) | "NO LOCK, deliberately" 동시-설치 경합 설계 노트(L63-87)가 경합을 "여러 세션이 *최초* cold install 에 동시 도달할 때뿐"·"rare first-install-only window"로 스코프 제한하는데, 이번 diff의 `_lock_hash`/`need_install`(L96-123)은 **lockfile 해시가 바뀔 때마다** 동일한 무락 경합 창을 재개방한다 — 이미 install을 마친 checkout도 예외가 아니다. 같은 diff가 신설한 `.github/dependabot.yml`의 주간 npm 스케줄이 바로 그 "lockfile이 바뀌는" 사건을 정기적으로 발생시킨다. 파일 헤더(L13)·섹션2 헤더(L34)·런타임 echo 메시지(L126, 세션에 실제 노출)의 "once"/"one-time" 표현도 같은 이유로 부정확해졌다. `test_bootstrap_mermaid_install.py` 모듈 docstring 자신이 "여러 워크트리 세션 동시 기동이 문서화된 워크플로"라 명시하므로 가상 시나리오가 아니다. **5개 리뷰어 독립 수렴**(performance/architecture/requirement/concurrency가 설계노트를, documentation이 3곳 wording을 지적) | `.claude/tools/bootstrap-session.sh:63-87`(설계노트), `:13`(파일헤더), `:34`(섹션2 헤더), `:126`(런타임 메시지) | L63-87을 "최초 설치뿐 아니라 lockfile 변경(정기 Dependabot 머지 포함)마다 재발"로 정정. L13/L34/L126의 "once"/"one-time" 삭제 또는 "installing/updating"류로 교체. `test_concurrent_cold_start_...`와 대칭으로 "마커 존재+lockfile 변경+N세션 동시기동" 케이스 테스트 추가 검토. `plan/in-progress/harness-guard-followups.md` §G(fcntl.flock) 우선순위 재평가(경합 빈도가 1회성→정기 반복으로 바뀜) |
| W2 | 부작용 (설치 순서 엣지케이스) | `want_hash`가 `npm install` 실행 **전** lockfile 스냅샷인데, install 성공 후 **같은** 값을 마커에 기록한다(`--no-save`/`npm ci` 아님). npm이 install 도중 lockfile을 재작성하면(lockfileVersion 정규화 등) 마커 해시가 install 후 실제 파일과 어긋난다. `testing`이 "설치 후 lockfile에 개행 1바이트 추가" 스텁으로 강제 재현한 worst-case: 연속 3회 세션 모두 재설치가 트리거되며 **결코 수렴하지 않음**(npm 호출 1→2→3) — 이는 `test_unchanged_lockfile_does_not_reinstall`이 보장한다고 주장하는 핵심 불변식이 스텁 충실도 부족으로 실 npm 환경에서는 증명되지 않은 채 green 처리되고 있음을 뜻한다. 반면 `side_effect`는 **실제 npm 10.9.2**로 최초설치·재설치 양쪽에서 lockfile 해시가 install 전후 불변임을 확인해 이 worst-case를 재현하지 못했다(자기교정 1회 사이클로 수렴한다는 낙관적 특성만 트레이스로 확인) — 즉 이론적 설계 갭이되 현재 검증된 npm 버전에서는 저확률. `requirement`도 같은 지점을 독립적으로 엣지케이스 WARNING으로 지적(self-correcting 가정) | `.claude/tools/bootstrap-session.sh:115`(`want_hash` 계산, install 이전) ↔ `:127-128`(install 후 같은 값 기록) | install 성공 직후 `want_hash`를 재계산해 마커에 기록(자기 교정)하거나, `npm install`을 `npm ci`/`--no-save`로 교체해 npm이 lockfile을 재작성할 가능성 자체를 차단. 최악의 경우 "설치 1회"가 "매 세션 재설치"로 퇴행하는 성능/UX 리스크이므로(보안 노출 아님) 우선순위 높게 권장 |
| W3 | 테스트 커버리지 (폴백 분기 무테스트) | `_lock_hash()`의 "해싱 도구(`shasum`·`sha256sum`) 둘 다 부재" 폴백 분기가 어떤 테스트로도 실행되지 않는다. `testing`이 기존 `npm` 스텁과 동일한 PATH-shadow 패턴으로 두 바이너리를 `exit 127` 스텁 처리해 직접 재현: 최초 설치는 되지만 이후 lockfile이 실제로 바뀌어도(보안 범프와 동일 시나리오) 재설치가 트리거되지 않음(3회 연속 실행에도 npm 호출 1회 고정) — 이 PR이 없애려는 W1 실패 모드(마커 존재=안심하지만 실제로는 최신 아님)가 "해싱 도구 부재"라는 다른 전제조건 아래 정확히 재현된다. `security`/`requirement`/`dependency`는 동일 갭을 인지하되 macOS(`shasum`)·GNU/Linux(`sha256sum`) 등 실제 개발·CI 호스트에서 두 도구 모두 부재한 경우가 희귀하다는 이유로 INFO로 낮게 평가(코드 주석에 이미 투명하게 문서화된 트레이드오프) | `.claude/tools/bootstrap-session.sh:96-103`(`_lock_hash`), `:112-123`(`want_hash`/`need_install`) | 기존 `npm` 스텁과 동일한 PATH-shadow 패턴으로 `shasum`/`sha256sum` exit-127 스텁 테스트를 추가해 "해싱 도구 부재 시 최초 설치는 되나 이후 lockfile 변경 감지는 비활성화됨(의도된 열화)"을 명시적으로 pin. 저우선(실사용 노출도 낮음)이나 회귀 방지 가치는 있음 |
| W4 | 문서화 (커버리지 표 갱신 누락) | `.claude/tests/README.md`의 "What's covered" 커버리지 표(34행, 직전 커밋 `ceee1fa5b`에서 마지막 갱신)와 `test_bootstrap_mermaid_install.py` 모듈 docstring(3개 기존 불릿)이 이번 diff의 핵심 헤드라인 동작(마커를 lockfile 해시에 결속) 및 전용 신규 테스트 2건(`test_lockfile_change_retriggers_install`, `test_unchanged_lockfile_does_not_reinstall`)을 요약하지 않는다. 이는 이 PR이 코드 레벨에서 고치려는 실패 유형("마커 존재만 보고 안심하지만 최신 아님")과 같은 모양의 문서 버전 — README 표만 읽는 독자는 이 guard가 여전히 순수 존재-기반이라 오해할 수 있다. 코드 자체는 정확하고 개별 테스트 docstring도 충분히 상세해 갭은 "요약 레이어"에 한정. `documentation`·`requirement` 2개 리뷰어 수렴 | `.claude/tests/README.md:34`, `.claude/tests/test_bootstrap_mermaid_install.py:1-23`(모듈 docstring) | README.md:34에 기존 문체(다른 행의 "Also exercises…"/"cf. …" 패턴)로 한 문장 추가. 모듈 docstring에도 기존 3개 불릿과 같은 형식으로 4번째 불릿 추가 |
| W5 | 아키텍처 (거버넌스 자동화 갭) | 이 PR이 고치는 근본 문제("pnpm 워크스페이스 밖 npm 트리라서 `deps-security-checks.yml`/Dependabot 어디에도 안 걸려 CVE가 영구 무신호")의 해법이 `dependabot.yml`에 이 트리 1개를 **손으로** 등록하는 것뿐이고, "workspace 밖에 새 `package.json` 트리가 생기면 반드시 등록한다"는 불변식을 강제하는 코드 가드(빌드타임 테스트)는 함께 도입되지 않았다. 이 저장소는 유사 커버리지 매트릭스(`MONITORED_QUEUES`, doc-sync-matrix, interaction-type-registry 등)마다 "매트릭스 참조 무결성 가드" 테스트를 두는 것을 원칙으로 삼는데, 이 커버리지 표면만 예외적으로 순수 컨벤션(사람이 기억)에 의존한다. 오늘은 대상이 1개뿐이라 실제 drift 없지만, 미래 두 번째 out-of-workspace npm 트리가 생기고 등록을 잊으면 이번과 정확히 같은 "영구 무신호" 패턴이 재현된다 | `.github/dependabot.yml:19-22`, `PROJECT.md` | `.claude/tests/`에 `pnpm-workspace.yaml`이 커버 못하는 `package.json` 트리를 열거(예: `find . -name package.json -not -path '*/node_modules/*'`)해 각각이 `dependabot.yml`의 `directory:` 항목과 대응하는지 assert하는 가드 테스트 추가 검토 — 기존 `test_doc_sync_matrix.py`류 패턴 재사용 가능 |
| W6 | 의존성 (semver 정책 예외) | 신규 Dependabot npm 스케줄이 `package.json`의 무제한(`*`) semver range(`jsdom`, `mermaid`, PR #410 이래 기존 상태)와 결합. 이전엔 이 트리를 건드리는 자동화가 전무해 무해했지만, 이번 diff로 Dependabot version-update(주간)가 처음 활성화되면서 향후 major bump PR도 이번 undici/dompurify 수정처럼 **package.json 변경 없는 lockfile-only diff**로 나타나, 리뷰어가 diff만 보고 patch/major를 구분할 신호가 없어진다. `^`로 고정돼 있었다면 major bump 시 range 자체도 바뀌어 diff에서 즉시 드러났을 것. `PROJECT.md` 자체의 "기본 caret" 버전 핀 정책과도 어긋나는 이 트리만의 예외 상태 | `.github/dependabot.yml`(신규 항목) ↔ `.claude/tools/mermaid-lint/package.json`(`"jsdom":"*"`, `"mermaid":"*"`) | 후속(비긴급)으로 `jsdom`/`mermaid`를 현재 lockfile-resolved major에 맞춰 caret로 좁히기 권장(예: `^29.x`, `^11.x`). 최소한 향후 Dependabot PR 리뷰 시 "resolved 버전의 major 변경 여부"를 별도 확인하는 습관을 문서화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 보안/의존성 | undici(개별 HIGH 3건·moderate 2·low 2, 패키지 롤업 표시상 "HIGH 7건")·dompurify(moderate 1·low 2) CVE가 정확히 해소됨 — 수정 전/후 lockfile 양쪽에서 `npm audit` 라이브 재현(전 7건/3건 → 0), 두 버전 모두 각 advisory 최소 fix 요구치이자 requiring 패키지(jsdom `^7.25.0`/mermaid `^3.3.1`) 선언 range 내에서 breaking 없이 만족, byte-identical lockfile 확인(변조 없음), 라이선스 필드 불변(MIT/`(MPL-2.0 OR Apache-2.0)`), node_modules 트리 shape 불변(신규 패키지 추가 0건) | `.claude/tools/mermaid-lint/package-lock.json` | 조치 불요. 커밋 메시지의 "HIGH 7건"은 패키지 단위 최고심각도 롤업 표현(개별 HIGH는 3건)이라 향후 보안수정 커밋에 GHSA ID(`GHSA-vmh5-mc38-953g` 등) 인용 권장(dependency) |
| I2 | 보안/아키텍처/부작용/의존성 | 마커 콘텐츠 포맷 변경(존재-only touch → lockfile SHA-256 해시 문자열)이 마커를 소비하는 3개 리더(`.githooks/pre-commit`, PostToolUse 훅, 공유 SoT `.claude/hooks/_lib/mermaid_lint_ready.py::is_ready()`)를 깨지 않음 — 전부 `os.path.isfile`/`[ -f ]`로 존재 여부만 판정하고 내용은 전혀 파싱하지 않음을 코드 추적·`test_mermaid_lint_ready.py` 재확인으로 검증. **4개 리뷰어 수렴**(security/architecture/side_effect/dependency) | `bootstrap-session.sh:128` ↔ `.claude/hooks/_lib/mermaid_lint_ready.py:41-46` | 조치 불요. 향후 마커에 또 다른 의미를 얹을 때도 "존재=ready" 계약을 오버로드하지 않는 현재 관례 유지 권장 |
| I3 | 성능 | lockfile 해시 계산(`_lock_hash`)이 설치가 불필요한 정상/반복 경로에도 `$tool_dir/package.json` 존재 확인 이전에 무조건 먼저 실행돼 매 SessionStart마다 subprocess 2개(해셔+`cut`)가 추가됨 — 파일 크기 61KB 기준 체감 지연은 없으나 "필요할 때만 계산"이라는 지연 로딩 원칙에서 다소 벗어남. `package.json`이 아예 없는 harness 채택 저장소에서는 실패 subprocess만 남기는 부수 효과도 있음 | `bootstrap-session.sh:100-103, 115` | 비차단. 여력 있으면 `want_hash=$(_lock_hash)` 호출을 `if [ -f "$tool_dir/package.json" ]` 블록 내부로 이동해 지연 계산으로 전환 |
| I4 | 부작용/테스트 | 구-포맷(빈 콘텐츠, `ceee1fa5b` 이전) 마커를 가진 기존 checkout이 이 diff 반영 다음 SessionStart에서 정확히 1회 자기치유 재설치를 트리거하는 의도된 동작(코드 추적으로 정확성 확인)이, 신규 테스트 2건 모두 "신-포맷→신-포맷" 전이만 다뤄 "구-포맷→신-포맷" 전이 자체는 회귀 테스트로 pin되지 않음 | `bootstrap-session.sh:118-122`, `test_bootstrap_mermaid_install.py` | 선택적. 구-포맷 마커를 미리 만들어두고 1회 재설치 후 신-포맷 갱신을 확인하는 테스트 케이스 추가 검토 |
| I5 | 동시성 | 동시 세션 × 해시-트리거 재설치 조합("마커 이미 존재 + lockfile 변경 + N개 세션 동시 기동")을 직접 pin하는 테스트가 없음 — 기존 `test_concurrent_cold_start_converges_and_then_stops_reinstalling`은 완전 콜드스타트(마커 자체 없음)만 5-프로세스로 경쟁시키고, 신규 해시-불일치 테스트 2건은 순차 실행만 검증. `need_install=1`이 되는 두 분기(마커 부재·해시불일치)가 이후 동일한 install 블록으로 수렴하므로 기능적 위험은 낮게 추정 | `test_bootstrap_mermaid_install.py`(`test_concurrent_cold_start_...` vs 신규 2건) | `test_concurrent_cold_start_...`를 변형해 "先설치(마커=구 해시 기록)→lockfile 갱신→N개 프로세스 동시 기동" 케이스 추가해 W1이 서술하는 반복-레이스 시나리오를 실제로 경쟁시켜 볼 것 |
| I6 | 동시성 | 마커 파일 쓰기(`printf '%s\n' "$want_hash" > "$marker"`, L128)가 truncate+write이며 원자적 치환(temp+rename)이 아님 — 오늘은 경쟁하는 모든 writer가 동일 불변 lockfile로부터 계산한 같은 해시 문자열을 쓰므로 겹쳐 써도 최종 바이트가 항상 같아 무해. 다만 이번 diff로 "빈 파일 터치"→"내용 있는 쓰기"로 막 바뀐 지점이라, 향후 마커에 프로세스별 메타데이터(타임스탬프·PID 등)를 추가하면 이 전제가 조용히 깨지고 torn write가 실손상으로 이어질 수 있음 | `bootstrap-session.sh:128` | 당장 수정 불요. 향후 마커 내용 확장 계획이 있다면 `tmp=$(mktemp) && printf ... > "$tmp" && mv "$tmp" "$marker"` 원자적 치환으로 전환하라는 주석 한 줄 예방책만 남겨두는 정도 |
| I7 | 요구사항/스코프/의존성 | 관련 spec 문서 부재는 정상 — harness 개발도구는 product spec 스코프 밖(`spec/**` grep 0건, "mermaid" 매치는 무관한 다이어그램 블록뿐), 대체 SoT는 `plan/in-progress/harness-guard-followups.md` §F이며 체크리스트 3항목(audit fix·Dependabot 등록·마커-해시 결속) 전부 코드와 line-level 일치 확인. 마커-lockfile 해시 결속 확장은 원 태스크명("mermaid-lint-undici-vuln")보다 넓지만, 이 확장이 없으면 같은 diff가 추가한 Dependabot 등록 자체가 기존 checkout에 대해 무의미해지는 인과적 전제조건이라 정당(plan §F 자신이 "무관하면 scope 오염"이라 명시해 경계를 의식 관리한 정황도 확인). `dependency`도 `deps-security-checks.yml`의 `paths:` 트리거를 직접 열람해 이 npm 트리가 기존에 실제로 커버되지 않았음(등록의 필요성)을 재확인 | `plan/in-progress/harness-guard-followups.md:189-219`, `.github/workflows/deps-security-checks.yml` | 조치 불요 |
| I8 | 유지보수성 | 기존 4중 AND 단일 조건(`if [ pkg.json ] && [ !marker ] && !throttled && npm`)을 `want_hash`/`need_install`이라는 이름 붙은 중간 변수로 분해해 "설치가 필요한가"와 "지금 실행해도 되는가"를 분리 — 가독성 개선(긍정 관찰). 신규 헬퍼 네이밍(`_lock_hash`)·인용 스타일(`"$var"`)·방어적 에러처리 관용구(`... 2>/dev/null || true`) 모두 파일 기존 컨벤션과 일관. 매직넘버·과도한 중첩·유해 중복 없음 | `bootstrap-session.sh`(설치 판정 블록) | 없음 |
| I9 | 의존성 (W6과 연결) | `package.json`의 `jsdom`/`mermaid` `"*"` 무제한 range는 이번 diff가 새로 만든 파일이 아니며 선행 라운드(2026/07/18 12_06_58)에서 이미 3회 별개로 "diff 범위 밖·조치 불요"로 triage됨(`security` 재확인). 다만 `dependency` 리뷰어는 이번에 Dependabot npm 스케줄이 처음 활성화되며 실 리스크가 새로 발생했다고 보아 별도 WARNING(W6)으로 상향 평가 — 관점 차이를 그대로 병기 | `.claude/tools/mermaid-lint/package.json` | 조치 불요(이번 PR 스코프 아님) — 후속 조치는 W6 참고 |
| I10 | 문서화 | `CHANGELOG.md` 미갱신 타당(61개 기존 "Unreleased" 섹션 전수가 배포 제품 코드(backend/frontend/channel-web-chat) 전용이고 하네스 로컬 도구 관련 항목 0건, grep 재확인) — 실제 변경 이력은 `plan/in-progress/harness-guard-followups.md` §F가 담당하며 체크박스 3건 완료 갱신·잔여 I3 항목 명시적 defer로 충실. `mermaid_lint_ready.py`의 "존재만 검사" docstring도 이번 diff로 여전히 정확 — "설치 완료"(is_ready)와 "최신인가"(bootstrap-session.sh)의 계층 분리가 유지됨 | `CHANGELOG.md`, `.claude/hooks/_lib/mermaid_lint_ready.py` | 조치 불요 |
| I11 | Dependabot/부작용 | 신규 `.github/dependabot.yml` npm 엔트리에 auto-merge 결합 없음(`.github/workflows/` 전수 검색으로 확인) — 실제 의존성 반영은 여전히 사람 리뷰·머지 경유. 시그니처/공개 인터페이스/환경변수/이벤트-콜백 변경 없음(`bootstrap-session.sh`는 인자 없이 호출·항상 `exit 0` 계약 유지, 읽는 환경변수는 기존 `MERMAID_INSTALL_RETRY_SEC` 뿐) | `.github/dependabot.yml:14-18` | 없음 |
| I12 | 문서화 정밀도 (직전 라운드 carryover) | "이 npm 트리의 CVE는 등록 전까지 영구 무신호였다"는 서술이, GitHub Dependabot **alerts**(탐지 자체, dependency graph 기반으로 등록과 무관하게 발생 가능)와 **scheduled version-update PR**(등록에 의존)의 구분을 정확히 반영하는지는 repo Settings 접근 없이 로컬에서 확정 불가. 코드 변경(스케줄 npm 등록) 자체는 정확·유효하므로 순수 서술 정밀도 이슈. 동일 항목이 직전 라운드(12_06_58 INFO#2)로 이미 한 차례 지적됐고, 이번 diff는 "security update"를 "스케줄 version-update"로 이미 한 단계 정밀화함 | `.github/dependabot.yml:12-14`, `plan/in-progress/harness-guard-followups.md:198-201` | 확신 없으면 그대로 두어도 무방(비차단). 정밀화하려면 repo Settings의 Dependabot alerts 토글 상태 실측 확인 후 문구 조정 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CVE 해소 실측 재검증(I1)·마커 로직 설계대로 정확 동작 확인. 잔여는 저노출 트레이드오프(해싱도구 부재 폴백=W3 저평가, package.json "*"=I9) |
| performance | LOW | NO LOCK 설계노트가 새 재발빈도(정기 lockfile 변경) 미반영(W1); 해시계산이 정상경로에도 무조건 실행(I3, 체감영향 없음) |
| architecture | LOW | NO LOCK 주석 drift(W1); Dependabot 수동등록·구조적 가드 부재(W5, 유일 지적); writer/reader 모듈 경계 유지는 긍정 관찰(I2) |
| requirement | LOW | plan §F 3항목 코드와 line-level 일치(실측: 테스트 9/9, 전체 303/303, 뮤턴트 재현으로 비-vacuity 확인). "one-time" drift(W1)·install-전 스냅샷 엣지케이스(W2)·README 갭(W4) 3개 WARNING 독립 수렴 |
| scope | NONE | 마커-lockfile 해시 결속 확장은 인과적으로 정당한 스코프(I7); 무관 리팩터·포맷팅 잡음·drive-by 변경 없음 |
| side_effect | LOW | install-전 스냅샷 vs install-후 lockfile 재작성 미방어(W2) — 단 실측: 실 npm 10.9.2 에서는 재현 안 됨; 마커 포맷 변경이 3개 소비처 무영향 확인(I2) |
| maintainability | LOW | 실질 결함 없음, 전부 INFO — 4중 AND 분해로 가독성 개선 등 긍정 관찰(I8). 매직넘버·과도한 중첩·유해 중복 없음 |
| testing | **MEDIUM** (최고위험도) | 해싱도구 부재 폴백 무테스트(W3, PATH-shadow 스텁으로 실측 재현: W1과 동일 실패모드 재발) + npm 스텁이 lockfile 재작성 미모델링(W2, 스텁으로 발산 시나리오 실측 재현: npm 호출 1→2→3 비수렴) — 둘 다 empirical reproduction 근거 보유. 기존 9/9 신규 포함 통과, 비-vacuity 확인(레드 실패 재현 후 원복)도 별도 확인 |
| documentation | LOW | "once/one-time" 표현 3곳 모순(W1); README 커버리지 표·모듈 docstring 갱신 누락(W4). PROJECT.md/dependabot.yml 정밀화는 정확히 확인(직전 라운드 W2/I2 해소) |
| dependency | LOW | audit 실측 재검증 정확(I1, 수정전 7건/3건→수정후 0건 라이브 재현); Dependabot+`"*"` range 결합으로 향후 major bump 무징후 가능(W6, 유일 지적) |
| database | NONE | 리뷰 대상 5개 파일에 DB 관련 코드 없음(해당 없음) |
| concurrency | LOW | NO LOCK 경합 재발빈도 확장 지적(W1 계열, 실손상 경로는 파일 주석이 이미 예견); 조합 테스트 부재(I5); 마커쓰기 비원자적이나 현재 무해(I6) |
| api_contract | NONE | 리뷰 대상 5개 파일에 API 계약 코드 없음(해당 없음) |
| user_guide_sync | NONE | 매트릭스 20 row 전수 대조, 매칭 0건(product 표면 무변경) |

## 발견 없는 에이전트

`database`, `api_contract`, `user_guide_sync` 3개 리뷰어는 검토 대상 5개 파일(`bootstrap-session.sh`, `test_bootstrap_mermaid_install.py`, `dependabot.yml`, `package-lock.json`, `PROJECT.md`)에 자신의 도메인에 해당하는 코드/표면이 전혀 존재하지 않음을 확인하고 명시적으로 "해당 없음"을 보고했다(위험도 전원 NONE) — 실질 발견 누락이 아니라 도메인 자체가 이번 diff 범위 밖이다. 상세 근거는 위 에이전트별 위험도 요약 표 참고.

## 권장 조치사항

1. **(최우선)** `want_hash`를 `npm install` 성공 **직후** 재계산해 마커에 기록하도록 변경하거나(자기 교정), `npm install`을 `npm ci`/`--no-save`로 교체해 install이 lockfile을 재작성할 가능성 자체를 차단 — testing이 실측 재현한 "매 세션 재설치로 발산" worst-case를 원천 제거 (W2)
2. `bootstrap-session.sh`의 "NO LOCK" 설계노트(L63-87) 및 "once"/"one-time" 표현 3곳(L13, L34, L126)을 이번 diff가 만든 새 재발 경로(정기 lockfile 변경, 특히 신설된 주간 Dependabot 스케줄)에 맞게 정정 — 5개 리뷰어 수렴, 코드 변경 없이 텍스트만 고치면 되는 저비용·즉시 반영 가능 항목 (W1)
3. `shasum`/`sha256sum` 둘 다 부재인 호스트에서 해시-불일치 감지가 조용히 비활성화되는 분기를 PATH-shadow 스텁 테스트로 pin — 이 PR이 고치려는 실패모드가 다른 조건에서 재현됨을 회귀 방지 (W3)
4. `.claude/tests/README.md` 커버리지 표 + `test_bootstrap_mermaid_install.py` 모듈 docstring에 신규 lockfile-해시 결속 테스트 2건을 요약 추가 (W4)
5. **(후속, 비긴급)** pnpm 워크스페이스 밖 `package.json` 트리 ↔ `dependabot.yml` 등록 여부를 대조하는 구조적 가드 테스트를 `.claude/tests/`에 추가해 향후 동일 클래스의 "CVE 영구 무신호" 재발을 방지 (W5)
6. **(후속, 비긴급)** `.claude/tools/mermaid-lint/package.json`의 `jsdom`/`mermaid` range를 `"*"`에서 현재 lockfile-resolved major에 맞춘 caret으로 좁혀, 향후 Dependabot major bump가 diff 상 무징후로 지나가지 않도록 함 (W6)
7. **(선택)** "마커 존재+lockfile 변경+N세션 동시기동" 조합을 pin하는 동시성 테스트, "구-포맷→신-포맷" 마커 전이를 pin하는 테스트 추가 검토 (I4, I5)

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(prompt 에 `routing_skip_reason` 명시적 값 없음). **전체 reviewer 14명 실행**, 제외된 reviewer 없음.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 `status=success`)
- **제외**: 없음
- **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — prompt가 "forced 전원 결과 확보됨"을 명시했고, 본 통합에서도 8명 전원의 전문을 실제로 확보·반영함을 재확인. 누락된 forced reviewer 없음.

| 제외된 reviewer | 이유 |
|------------------|------|
| (해당 없음) | routing_status=skipped 로 전원 실행됨 |