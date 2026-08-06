# Code Review 통합 보고서

## 전체 위험도

**HIGH** — CRITICAL 1건: `_current_branch` 가 `_shared/git_probe.py` 통합(9R)에서 누락되어 `branch_guard.py`/`plan_guard.py` 에 여전히 손-복제 상태로 남아 있고, 어느 테스트도 실제 구현을 실행하지 않는다. mutation 실증 결과 한쪽 사본만 깨져도 하네스 849개 테스트 전원이 GREEN 이면서 이 프로젝트 핵심 enforcement("메인 워크트리에서 default 브랜치 편집 차단")가 조용히 무력화된다(현재는 두 사본 값이 우연히 일치해 라이브 결함은 아님). 그 외 다수의 WARNING(9건)이 정확히 같은 실패 클래스 — "판정에 쓰이는 위임/헬퍼 코드의 성공 경로가 아무 테스트에도 걸리지 않는다" — 의 반복 인스턴스이며, 9R 이 `_shared/git_probe.py` 로 통합하면서 새로 만든 `_origin_default_branch` 위임 메커니즘 자체에 그 문제가 재도입됐다. 즉시 판정을 뒤집는 활성 결함은 없으나, 이 저장소가 이미 7개 라운드에 걸쳐 겪어 온 정확히 같은 결함 클래스가 이번 라운드의 리팩터 안에서 또 재발했다는 점에서 가벼운 심각도로 보기 어렵다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `_current_branch` 가 git 프로브 5종(→ 이후 6종) 통합에서 누락되어 `branch_guard.py`/`plan_guard.py` 에 AST-동일(docstring 제외)한 손-복제 사본으로 남음. 두 테스트 모두 `mock.patch.object(..., "_current_branch", ...)` 로 실구현을 항상 우회하고, `GitProbesAreNotReDuplicatedTest` 의 재복제 가드 목록에도 없음. mutation(`return out` → `return "MUTATED-" + out`)으로 실증: 849개 테스트 전원 GREEN 이면서 "main worktree, 현재 브랜치==default" 시나리오 재현 시 `blocked: False` — 핵심 enforcement 가 조용히 무력화됨 | `.claude/hooks/_lib/branch_guard.py:57,123` / `.claude/hooks/_lib/plan_guard.py:115,192` | `_current_branch(cwd)` 를 `_shared/git_probe.py` 로 이관하고 양쪽을 위임으로 전환. `GitProbesAreNotReDuplicatedTest` 의 `_SHARED`/`_SHARED_IN_BRANCH_GUARD` 에 추가. 실제 저장소(`git checkout -b <name>`)로 성공 경로를 구동하는 회귀 테스트 추가 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture / testing / dependency / side_effect | `git_probe._origin_default_branch` 의 위임 메커니즘 — 성공 경로(실제 origin 조회가 truthy 값 반환)가 어떤 테스트에서도 실행되지 않음. 3개 팀이 독립적으로 mutation 실증: architecture(849 테스트 계측, `resolver_truthy: 0`), testing(`return None` 치환 후 100 테스트 GREEN, 실제 `trunk` origin 재현 시 값 차이 확인), dependency(파일경로 뮤턴트로 137 테스트 GREEN, `_default_branch=None`→`base=None`→커밋 변경집합 공백 가능 경로까지 추적). 또한 `_shared`(하위 계층)가 `hooks/_lib`(소비자)를 파일 경로로 되감아 로드하는 역방향 의존이라 `_shared/__init__.py` 자신의 소유권 원칙과 같은 커밋 안에서 충돌(architecture). 표준 방식으로 `bg._origin_default_branch` 를 mock 해도 `plan_guard`/`review_guard` 의 실제 해석에는 전혀 반영되지 않음이 별도 재현됨(side_effect) — 9R 이 없앤 "패치해도 무효" 함정이 다른 메커니즘으로 재도입 | `.claude/_shared/git_probe.py:35-59,113-127` | 정본 구현을 `branch_guard.py` 에서 `_shared/git_probe.py` 자신으로 옮기고 `branch_guard.py` 는 다른 5개 함수와 동일하게 참조만 하도록 전환. 실제 origin 리모트를 구성한(로컬 브랜치명과 origin 기본 브랜치명을 다르게 설정) real-repo 테스트 추가 |
| 2 | side_effect | `exec_module()` 이 도중 예외를 던지면 반쯤 초기화된 모듈 객체가 `sys.modules["_git_probe_branch_guard"]` 에 이미 등록돼 영구 캐싱됨 — 이후 파일이 정상으로 복구돼도 같은 프로세스 안에서는 재시도되지 않음(실증: 손상 상태 캐싱 후 파일 복구해도 resolver `None` 유지). 프로덕션은 프로세스당 1회 호출이라 영향 제한적이나, 반복 호출되는 하네스 스위트/장기실행 프로세스에서는 일시적 원인으로 단 1회 실패해도 그 프로세스 수명 내내 로컬 폴백에 고정 | `.claude/_shared/git_probe.py:49-59` (특히 55행 등록이 56행 `exec_module` 앞) | `except Exception` 절에서 `sys.modules.pop("_git_probe_branch_guard", None)` 으로 실패한 등록을 되돌려 재시도 가능하게 함 |
| 3 | maintainability | `git_probe._origin_default_branch` 가 쓰이지 않는 `cwd` 파라미터를 받고, `branch_guard.py` 의 동명 함수와 이름은 같지만 반환 타입이 완전히 다름(함수 객체 vs 브랜치 이름 문자열) — 호출부만 보면 이미 브랜치 이름을 받는다고 착각하기 쉬움 | `.claude/_shared/git_probe.py:35-59`, 호출부 `:113` | `cwd` 제거 또는 `_branch_guard_resolver()` 등으로 함수명을 구분되게 변경 |
| 4 | architecture / maintainability | `.claude` 루트 계산 + `sys.path` 등록 + `_shared` import 부트스트랩 블록이 세 훅 파일에 각각 손으로 복제됐고, 이번 라운드가 그중 두 곳을 새로 추가하며 이미 스타일이 갈림(`branch_guard.py` 만 `import sys as _sys`, `plan_guard.py` 는 별칭 없음, `review_guard.py` 는 dirname 체인 방식 자체가 다름) — "손-동기 쌍은 갈린다"는 이 작업의 동기 그 자체가 부트스트랩 레이어에서 재현됨 | `branch_guard.py:24-33`(신규) / `plan_guard.py:47-63`(신규) / `review_guard.py:120-121,140-141`(기존) | 내부 부트스트랩 헬퍼(`_lib/__init__.py` 등)로 통합하거나, 최소 "세 곳 동일 유지" 불변식을 주석으로 명시 |
| 5 | security | `harness-checks.yml` 이 PR 이 공급한(잠재적으로 신뢰할 수 없는) 파이썬 테스트 코드를 실행하면서 최소권한 `permissions:` 를 선언하지 않음 — 자매 워크플로 `review-gate.yml` 은 이미 동일 사유로 `permissions: {contents: read}` 명시. 이 저장소는 fork 가 아닌 브랜치 기반 PR 위주라 GitHub 의 fork-PR 자동 read-only 강등이 적용되지 않는 경로 | `.github/workflows/harness-checks.yml:90-91` | `permissions: {contents: read}` 추가 + 두 워크플로의 `actions/checkout` 에 `persist-credentials: false` 추가 |
| 6 | performance | `_shared/git_probe.py` 가 두 훅의 공용 단일 구현이 됐음에도, 같은 프로세스 안에서 두 훅(`evaluate_review`/`evaluate_plan`)이 동일 git 조회(`_repo_root`/`_default_branch`/`_merge_base`)를 캐시 없이 각각 반복 — 실측: 코드 변경 없는 가장 빠른 push 경로에서도 git subprocess 12회/0.24초, `_default_branch` 가 네트워크 폴백을 타면 최대 +2s | `.claude/_shared/git_probe.py:106-137`, 호출부 `review_guard.py:916-921`, `plan_guard.py:273-278` | `_repo_root`/`_default_branch`/`_merge_base` 에 프로세스 수명 한정 경량 메모이제이션 추가 |
| 7 | performance | `evaluate_review()` 의 리뷰/일관성 세션 전수 스캔(`_newest_resolved_review_mtime`/`_newest_resolved_impl_done_mtime`)이 상한 없이 저장소 히스토리에 비례해 계속 커지는데, 이번 라운드가 그 함수를 CI(GitHub Actions, `codebase/**` 또는 `.claude/hooks/_lib/**` 건드리는 모든 PR)라는 새 고빈도 호출자에 연결함 — 실측: 809+738개 세션에 약 0.5초. 오늘은 CI 5분 타임아웃 대비 무해하나 성장 추세가 어디에도 기록돼 있지 않음 | `review_guard.py:498-528,720-762`, CI 호출부 `check-review-gate.py:96-97` | 최신순 조기 종료(`resolved and t >= newest_code` 첫 세션에서 멈춤) 또는 경량 인덱스 캐시. 최소한 성장 추세를 plan 문서에 기록 |
| 8 | documentation / architecture | `_shared/git_probe.py` 모듈 docstring 첫 줄·마무리 문장이 실제 소비자 수(3개: review/plan/branch guard)와 복제본 총량(12개)을 축소 서술("the two push-gate guards"·"ten untested ones") — 같은 커밋 안에서 `branch_guard.py:42-45` 자신이 "세 번째 사본이었다"고 적은 서술과 정면으로 모순 | `.claude/_shared/git_probe.py:1,20-23` | 첫 줄을 "the three push-gate guards" 로, 마무리 문장을 정확한 수(12)로 수정하고 `branch_guard.py` 가 세 번째 사본이었다는 사실을 한 줄 추가 |
| 9 | documentation / requirement | `plan/in-progress/harness-review-gate-ci-backstop.md` 상단 배너("배선 가드 경화 \| 1R~6R 진행 중")와 §배선 가드 표(7R까지)가 실제 커밋 이력(8R `88ce9994d`, 9R `e834d0f4e` — CRITICAL 3건 포함)보다 뒤처짐. 9R 은 이 문서 어디에도 등장하지 않음(`grep -n "9R" ...` 0건) | `plan/in-progress/harness-review-gate-ci-backstop.md:18,24-34` | §배선 가드 표에 8R·9R 행 추가(각 라운드가 실제로 고친 결함 요약 포함), 상단 배너를 현재 라운드 수로 갱신 |
| 10 | testing | resolution-in-flight 마커 디렉터리 경로(`".claude/state/resolution_in_flight"`)가 `review_guard.py`/`mark_resolution_in_flight.py`/`clear_resolution_in_flight.py`/테스트(`ResolutionMarkerHookTest._marker()`) 4곳에 손-복제, 정합성을 지키는 테스트 없음 — mutation(디렉터리명 변경)으로 111개 테스트 전부 GREEN 실증. 실질 영향은 push 게이트 무관, Stop nudge 가 resolution 중에도 재발동하는 회귀(문서화된 메커니즘 목적 자체가 훼손) | `review_guard.py:811,817-824`; 사본 — `mark_resolution_in_flight.py::_state_dir()`, `clear_resolution_in_flight.py::_state_dir()`, `test_review_guard_hardening.py::ResolutionMarkerHookTest._marker()` | 경로 상수/함수를 세 파일이 공유하도록 통합하거나 최소 정합성 테스트 1개 추가. `mark_resolution_in_flight.main()` → 기본 `marker_dir` 로 `review_guard._resolution_in_flight()` 를 잇는 end-to-end 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | PyYAML 설치가 해시 고정(`--require-hashes`) 없이 버전 범위만 고정 — pin 일치성 자체는 `PyYamlPinsAgreeTest` 로 이미 지켜짐 | `.github/workflows/harness-checks.yml:87-88` | 여유 있으면 `--require-hashes` 또는 `pip-audit` 검토 |
| 2 | security | `actions/checkout@v7` 가 두 워크플로 모두 `persist-credentials` 기본값(true) 유지 | `review-gate.yml:55-57`, `harness-checks.yml:75` | `persist-credentials: false` 추가(방어 심층화) |
| 3 | performance | `_newest_resolved_review_mtime` 이 세션마다 `RESOLUTION.md` 존재를 두 번(내부 함수 1차 + 루프 2차) 확인 | `review_guard.py:429,521-522` | `_summary_is_resolved` 반환값을 재사용하도록 시그니처 확장 |
| 4 | performance / architecture | `_origin_default_branch` 가 `branch_guard.py` 를 별도 `sys.modules` 키로 두 번째 인스턴스로 동적 로드 — 반복 호출 비용 없음(O(1) 캐시), 절대 비용도 무시 가능 수준. 향후 상태 추가 시 두 인스턴스가 갈릴 수 있음만 기록 | `.claude/_shared/git_probe.py:35-59` | 조치 불요, 향후 재검토 대상으로만 기록 |
| 5 | architecture | `_shared/__init__.py` 가 명시한 "hooks/skills 는 소비자일 뿐" 원칙과 별개로, `git_probe.py` 가 `hooks/_lib` 를 하드코딩된 상대경로로 로드 — 오늘은 skills 쪽 소비자가 없어 무해하나, 장래 skills 오케스트레이터가 `git_probe` 를 가져다 쓰면 hooks 전용 모듈을 뒷문으로 끌고 들어올 수 있음 | `.claude/_shared/git_probe.py` (`_HOOKS_LIB` 경로) | 향후 skills 소비자 발생 시 재검토 |
| 6 | maintainability | `git_probe.py` 안 매직 문자열 `"_git_probe_branch_guard"` 가 상수화 없이 3회 반복 — 한 곳만 오타나면 캐시가 매번 무효화(정확성은 유지, 성능만 저하) | `.claude/_shared/git_probe.py:49,53,55` | 모듈 상단 상수(`_BRANCH_GUARD_MODULE_KEY`)로 통합 |
| 7 | maintainability | `_summary_is_resolved` 의 위험도 스캔이 중첩 루프 + 사후 플래그 검사로 바깥 루프를 종료하는 구조라 순환복잡도가 높음(로직 자체는 이번 수정으로 정확하고 `RiskHeadingDecoyTest` 로 회귀 고정됨) | `review_guard.py:440-469` | `_find_risk_level(lines, start)` 헬퍼로 추출해 `return` 으로 단순화 |
| 8 | maintainability | `plan_guard.py` 의 `THIS_DIR` 모듈 변수가 여전히 참조 없는 죽은 코드 — 이번 라운드가 부트스트랩 블록 아래로 그 줄을 재배치하면서도 정리하지 않음 | `plan_guard.py:63` | 삭제 또는 용도 주석 추가 |
| 9 | documentation | `.claude/tests/README.md` 의 `test_review_guard_hardening.py` 행이 이번 라운드 신규 회귀 테스트 클래스 2개(`UnstagedModificationKeepsItsPathTest`, `RiskHeadingDecoyTest`)를 반영하지 않음 — 같은 diff 의 자매 행(`test_plan_guard.py`, `test_workflow_yaml_structure.py`)은 "Rounds N-M added…" 로 갱신됨 | `.claude/tests/README.md:57` | 두 클래스의 추가 사유를 서술 추가 |
| 10 | testing | SPEC-CONSISTENCY 게이트(Gate 2)의 조합 함수(`_spec_code_patterns`/`_spec_linked_changes`)가 `test_review_guard.py` 에서 항상 mock 으로 대체돼 실물 통합 테스트가 없음 — mutation 미검증(시간 예산상 생략), 정보성 | `review_guard.py:644,666` 부근 | 실제 `spec/` 서브트리를 흉내 낸 real-repo 테스트 추가 검토(다음 라운드 후보) |
| 11 | concurrency | `_origin_default_branch` 의 `sys.modules` 캐시가 check-then-act 라 이론상 스레드 불안전하나, 저장소 전체(`.claude`, `scripts`)에 스레드/멀티프로세스 사용이 전무함을 grep 으로 실측 확인 — 도달 불가 | `git_probe.py:49-59` | 조치 불요. 향후 스레드/파이프라인 병렬화 도입 시 재검토 |
| 12 | concurrency | fail-open 스트릭 카운터의 read-increment-write 에 파일 잠금 없음 — 코드 스스로 "허용된 잔여 위험"으로 이미 문서화, 실제 판정(`ReviewDecision.blocked`)에는 영향 없음 | `failopen_state.py:61-88`, 근거 `:115-119` | 조치 불요, 기존 결정 유지 |
| 13 | concurrency | `evaluate_review()` 내 두 번의 독립적 `git status --porcelain` 스냅샷이 원자적이지 않음 — resolution-applier 백그라운드 편집과 Stop 훅이 겹치는 좁은 창에서 dirty/clean 판정이 흔들릴 수 있으나 재현 가능한 활성 결함은 아님 | `review_guard.py:923-925,941-946` | 급하지 않음, 필요시 `_dirty_set` 결과를 앞단 `changed` 계산에도 재사용 |
| 14 | concurrency | `resolution-applier` 마커 파일명이 `tool_use_id` 부재 시 상수(`"nouseid"`)로 겹칠 수 있음 — fail-open 계약상 안전한 방향(억제가 TTL 까지 조금 더 유지)으로만 영향 | `mark_resolution_in_flight.py:69` | 조치 불요 |
| 15 | dependency | `harness-checks.yml` 의 주석("actions major policy consistent … v5/v6 line")이 현재 사실(저장소 전체 `@v7`)과 어긋남 — 이번 PR 의 diff 범위 밖(사전 존재 라인) | `.github/workflows/harness-checks.yml` (setup-python 스텝 위 주석) | 별도 하우스키핑 커밋에서 "v7 line" 으로 정정 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | `_current_branch` 손-복제 미통합 — CRITICAL 1건(핵심 enforcement 무력화 mutation 실증) |
| architecture | MEDIUM | `_origin_default_branch` 역방향 의존 + 미검증 성공경로(WARNING), 부트스트랩 손-복제(WARNING) |
| dependency | MEDIUM | 신규 외부 의존성 없음. 내부 역방향 의존(git_probe→branch_guard)의 미검증 성공경로를 mutation 으로 실증(WARNING) |
| testing | MEDIUM | `_origin_default_branch` 미검증 성공경로 + resolution 마커 디렉터리 손-복제 미검증(WARNING 2건, 각각 mutation 실증). 라이브 결함은 없음 |
| security | LOW | `harness-checks.yml` 최소권한 미선언(WARNING 1건). 인젝션·시크릿 노출 등 활성 취약점 없음 |
| performance | LOW | git 조회 미캐시(WARNING) + 세션 전수 스캔 상한 없음, CI 새 호출자 추가(WARNING) |
| side_effect | LOW | `_origin_default_branch` mock 무력화(WARNING) + exec 실패 영구캐싱(WARNING). 9R 의 두 기존 WARNING 은 해소 확인 |
| maintainability | LOW | 이름 충돌/미사용 파라미터, 부트스트랩 중복(WARNING 2건) + INFO 3건. CRITICAL 없음 |
| documentation | LOW | 모듈 docstring 축소 서술 + plan 문서 라운드 이력 drift(WARNING 2건). 핵심 판정 코드 docstring 은 전반적으로 양호 |
| concurrency | LOW | 활성 race condition 없음. INFO 4건(전부 잠복/도달불가/이미문서화) |
| scope | NONE | 이번 라운드·브랜치 전체 모두 의도된 범위 밖 변경 없음 |
| database | NONE | 대상 코드(DB 클라이언트/ORM/SQL/스키마/마이그레이션) 없음 |
| api_contract | NONE | 대상 코드(HTTP/REST/DTO) 없음 — 내부 harness 도구 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 모두 무매치 — `codebase/**`/`spec/**` 변경 0건 |

## 발견 없는 에이전트

- **scope** — 이번 라운드(및 브랜치 전체) diff 가 커밋 메시지 선언 범위와 정확히 일치, 초과분 없음
- **database** — 리뷰 대상 15개 파일 전부 harness/CI 코드로 DB 관련 코드 부재
- **api_contract** — HTTP/REST/DTO 등 API 계약 대상 코드 부재(내부 harness 도구)
- **user_guide_sync** — 변경 파일 15개 전부 doc-sync-matrix 21개 trigger 어디에도 매칭되지 않음

## 권장 조치사항

1. **[CRITICAL 대응]** `_current_branch` 를 `_shared/git_probe.py` 로 이관하고 `branch_guard.py`/`plan_guard.py` 를 위임으로 전환, `GitProbesAreNotReDuplicatedTest` 재복제 가드 목록에 추가 — 핵심 enforcement 무력화 가능 경로를 닫는다.
2. `_origin_default_branch` 위임 메커니즘을 재설계: 정본 구현을 `branch_guard.py` 에서 `_shared/git_probe.py` 자신으로 옮겨 역방향 의존·이중 로딩·mock-무력화·exec 실패 영구캐싱을 한 번에 해소하고, 실제 origin 리모트를 구성한 성공 경로 회귀 테스트를 추가한다(WARNING #1, #2, #3).
3. resolution-in-flight 마커 디렉터리 경로를 세 파일이 공유하는 상수로 통합하고 정합성/end-to-end 테스트를 추가한다(WARNING #10).
4. `harness-checks.yml` 에 `permissions: {contents: read}` 를 추가하고 두 워크플로 checkout 에 `persist-credentials: false` 를 추가한다(WARNING #5).
5. `plan/in-progress/harness-review-gate-ci-backstop.md` 의 라운드 이력 표·배너를 8R·9R 까지 갱신하고, `git_probe.py` 모듈 docstring 의 소비자 수·복제본 총량 서술을 정정한다(WARNING #8, #9).
6. 세 훅의 `sys.path` 부트스트랩 블록을 통합하거나 최소 "동일 유지" 불변식을 문서화한다(WARNING #4).
7. 여유가 되면 `git_probe.py` 의 반복 git 조회에 프로세스 수명 한정 캐시를 추가하고, `evaluate_review()` 의 세션 전수 스캔에 조기 종료/인덱스를 도입한다(WARNING #6, #7) — 당장 게이트를 막는 사안은 아니므로 백로그로 등재해도 무방.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 사유: `--route=all`. 전체 14개 reviewer(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync) 실행됨.
- 참고: `meta.json` 에 router-safety 강제 대상으로 계산된 `agents_forced`(documentation, maintainability, requirement, scope, security, side_effect, testing) 목록이 있으나, `--route=all` 로 이미 전원 실행되어 이 목록은 실질적으로 아무 reviewer 도 배제하지 않는다(moot).

---

**참고(집계 근거 보정)**: `_retry_state.json` 은 `agents_pending` 에 14명 전원을, `agents_success`/`agents_fatal` 은 빈 배열로 기록하고 있어 겉보기엔 미완료 상태로 보인다. 그러나 세션 디렉터리에는 14개 reviewer 전원의 `.md` 리포트가 위험도·발견사항을 갖춘 완결된 형태로 존재하며(각 파일의 타임스탬프가 `_retry_state.json` 갱신 이후), 본 SUMMARY 는 그 실제 파일 내용을 근거로 집계했다. `_retry_state.json` 이 각 reviewer 완료 시점에 갱신되지 않은 것으로 판단되며(오케스트레이터 상태 파일 stale), 재시도가 실제로 필요한 reviewer 는 없다.