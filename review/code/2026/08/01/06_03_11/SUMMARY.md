# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — requirement 리뷰어가 실제 pnpm registry 재현으로 §1(P1, 이 PR 의 헤드라인 기능)의
두 핵심 경로 모두에서 CRITICAL 결함을 발견했다: (1) 스키마 드리프트 가드가 pnpm 의 정상 응답
형태를 오판해 실제 5대 동기 사례 중 하나(liquidjs)의 분류가 무력화되고, (2) "수용 범위 밖 재유입"
탐지 메커니즘(`widened`/`EXPECTED_SUPPRESSED_PATHS`)이 pnpm 의 실제 `ignoreCves` 동작과 어긋나
있어 **항상 발동 불가능한 죽은 코드**다 — 이 메커니즘이 막으려던 "조용한 통과"(`#1038` 사고 유형)를
메커니즘 자신이 재현한다. 두 결함 모두 8차까지의 정적 분석·mutation 기반 검증으로는 드러나지
않았고, 이번 라운드가 스크립트 자신의 재현법을 CI 와 동일 pnpm 버전으로 실 registry 에 대해
실행해 처음 확인했다. forced 리뷰어 7명 전원 결과 확보됨(누락 없음) — 아래 CRITICAL 은 "결과
미확보"가 아니라 **확보된 결과 안의 실제 결함**이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `classify_vulnerable()`의 스키마 드리프트 가드가 pnpm 의 정상 `"action":"update"` 응답(최상위 `module`/`target` 이 `null`)을 스키마 드리프트로 오판 — §1 핵심 기능("분류")이 실제 5대 동기 사례 중 하나(liquidjs)에서 무력화됨. 실 registry 재현으로 확인(CI 는 exit 2 로 여전히 막지만 진단 메시지가 오도성이며, 여러 advisory 가 섞인 상황에서는 이미 계산 가능한 분류 정보가 버려짐) | `scripts/check-override-floors.py:267`, `:288-293` | `actions_with_module` 판정을 `action.get("module")` 우선, 없으면 `resolves[].id` 로 이미 파싱된 `advisories` 딕셔너리를 역참조하는 헬퍼로 교체. `SchemaDriftTest` 에 실측 payload(`"action":"update","module":null,"target":null`) 고정 fixture 추가 |
| 2 | 요구사항 | `widened`/`EXPECTED_SUPPRESSED_PATHS`("수용 범위 밖 재유입" 탐지)가 pnpm 의 실제 `ignoreCves` 동작과 어긋나 있어 항상 발동 불가능한 죽은 코드 — `classify_vulnerable()` docstring 의 전제("억제된 항목도 actions[] 에는 남는다")와 달리, 실측(현재 상태·되돌린 상태 양쪽)에서 억제된 CVE 는 `actions`/`advisories`/`metadata` 전부에서 완전히 사라짐 | `scripts/check-override-floors.py:250-254`(전제), `:63-69`(`EXPECTED_SUPPRESSED_PATHS`), `:313-321`(`main()` widened 계산) | 재설계 필요 — (a) `ignoreCves` 제외한 별도 `pnpm audit --json` 호출로 억제 전 원본 상태 직접 대조, 또는 (b) per-invocation `--ignore <cve>` 로 auditConfig 영구 억제를 우회. 손으로 쓴 JSON 대신 실제 `pnpm audit --json` 캡처본을 fixture 로 고정한 통합 테스트가 없는 한 이 클래스의 드리프트는 향후에도 mutation 으로 못 잡음 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `run_audit()`/`classify_vulnerable()`가 `actions`/`advisories` 최상위 컨테이너의 존재만 검증하고 타입은 미검증 — 리스트/딕셔너리가 아닌 값이 오면 `AttributeError` 로 크래시해 exit 1(이 스크립트 어휘로 "침식 발견")로 죽음. 뮤턴트 주입으로 재현 확인 | `scripts/check-override-floors.py:224`, `:260`, `:267` | 존재 검사를 `isinstance(data.get("actions"), list)` / `isinstance(advisories, dict)` 등으로 대체 후 아니면 `_undecidable()`. `FailClosedTest` 에 `raw_stdout=` 이용한 타입 불일치 케이스 2건 추가 |
| 2 | 테스트 | `FailClosedSiteCountTest` 가 `.claude/tests/README.md` 의 수치 서술("Eleven sites exit 2")을 실제로는 검증하지 않음에도 assertion 메시지는 검증한다고 주장 — 6차 문서화 리뷰·7차 테스트 리뷰의 "자동 검증된다"/"자동 차단하는 설계" 결론을 뮤턴트로 반증(README 값을 다른 문자열로 바꿔도 45건+카탈로그 가드 5건 전부 GREEN 유지). 지금까지 수치가 맞았던 것은 테스트 강제가 아니라 매 라운드 사람이 손으로 함께 고친 결과 | `.claude/tests/test_override_floors.py:638-659`, `.claude/tests/README.md:39` | `test_docstring_count_matches_source`(또는 인접 신규 테스트)에 `README.md` 를 직접 읽어 대조하는 assertion 추가 — `test_tests_readme_catalog.py` 의 `_harness.CLAUDE_DIR` 패턴 재사용(제안 코드를 직접 실행해 현재 상태에서 통과함을 확인함) |
| 3 | 유지보수성 | `main()` 이 오케스트레이션과 두 개의 비트리비얼 도메인 로직(widened 경로 diff 계산, eroded 상관분석)을 겸함 — 같은 파일의 동급 로직(`chain_segments`/`override_target`/`load_override_targets`/`run_audit`/`classify_vulnerable`)은 전부 이름 있는 함수+docstring 으로 분리돼 단위 테스트가 직접 호출하는 반면, widened/eroded 는 이름 없이 인라인돼 있어 관련 테스트가 훨씬 무거운 전체 서브프로세스 실행 경로로만 도달 가능 | `scripts/check-override-floors.py:297-342`(`main()`), `:313-321`, `:323-326` | `_diff_widened_paths(suppressed, targets)`, `_correlate_eroded(reported, targets, patched_by_module)` 로 추출해 `main()` 을 순수 오케스트레이션+출력으로 축소, 두 계산은 `override_target`/`run_audit` 처럼 직접 단위 테스트 가능하게 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `pnpm audit` 하위 프로세스의 raw stdout/stderr 를 잘라 CI 로그(stderr)에 echo — 레지스트리 인증 오류 시 자격증명 편린 노출 이론적 가능성. 인접 스크립트(`check-pnpm-security-config.py`)와 동일한 기존 관례라 신규 위험 아님 | `scripts/check-override-floors.py:207-212`, `:214-219`, `:222-223` (관련 상수 `:72-74`) | 급하지 않음. 필요 시 알려진 시크릿 패턴 redaction 추가 또는 CI 로그 접근범위가 저장소 접근 권한과 동일 경계인지 별도 확인 |
| 2 | 부작용 | 모듈 최상위 `import yaml` 실패 시 `sys.exit(2)` — 임포트 자체가 프로세스 종료라는 부작용을 가질 수 있음. `check-pnpm-security-config.py` 와 동일 기존 관례이며 CI 는 항상 PyYAML 을 사전 설치해 실제 도달 경로 없음 | `scripts/check-override-floors.py:48-52` | 조치 불요. 향후 이 모듈을 라이브러리로 재사용할 계획이 생기면 lazy import 고려 |
| 3 | 부작용 | 반환 타입이 명시된 함수들(`load_override_targets` 등)이 `_undecidable()` 을 통해 실제로는 `SystemExit` 로 조기 종료 가능한 숨은 `NoReturn` 이탈 경로를 가짐 — 현재는 CLI 단독 실행 + `SystemExit` 을 인지한 테스트만 호출해 안전 | `scripts/check-override-floors.py:168-178` 및 각 호출부(`:124,148,156,203,208,215,223,226,279,289`) | 조치 불요. 향후 라이브러리로 확장 시 호출자가 이 이탈 경로를 놓치기 쉬우므로 유의 |
| 4 | 유지보수성 | `pnpm audit --audit-level=moderate` 임계값이 다른 튜닝 상수(`_STDERR_PREVIEW`/`_AUDIT_TIMEOUT_SEC` 등)와 달리 근거 주석 없는 인라인 문자열 리터럴. 값 자체는 `deps-security-checks.yml` 의 기존 audit 잡과 동일함을 대조 확인해 안전 | `scripts/check-override-floors.py:196` | 근거 주석 한 줄 추가(예: 기존 audit 잡과 동일 임계값) 또는 `_AUDIT_LEVEL` 명명 상수로 승격 |
| 5 | 범위 | 이번 라운드 페이로드(2개 파일)가 브랜치 전체 누적 diff(12개 파일)의 부분집합 — `.github/workflows/*.yml`, `.github/dependabot.yml`, `pnpm-workspace.yaml`, `PROJECT.md`, `.claude/tests/test_override_floors.py` 는 이번 스코프 판정 대상 밖 | 프롬프트 "리뷰 대상 파일" 목록 자체 | 최종 push 전 위 파일들을 포함한 스코프 확인을 한 번은 수행할 것을 권장 |
| 6 | 테스트 | `StubNotUsed` flaky 가드 메커니즘 자체를 지키는 메타 테스트가 여전히 없음(9차부터 carried, 조치되지 않았고 우선순위도 낮게 유지) | `.claude/tests/test_override_floors.py:86-165` | 여유가 있으면 마커 미기록 스텁을 주입해 `StubNotUsed` 발생을 확인하는 메타 테스트 추가 |
| 7 | 테스트 | advisory 에 `patched_versions` 가 없을 때의 `"?"` 폴백 출력 경로가 어떤 fixture 로도 커버되지 않음(exit code·침식 감지 자체는 영향 없는 minor, cosmetic 이슈) | `scripts/check-override-floors.py:305-309`, `:375` | 여유가 있으면 `patched_versions` 를 생략한 advisory fixture 1건 추가해 `"?"` 출력 단언 |
| 8 | 문서화 | `main()`/`_report_widened()`/`_report_eroded()` 3개 함수에 독립 docstring 이 없음 — 5차 문서화 리뷰가 "형제 스크립트 `check-pnpm-security-config.py` 의 `main()` 도 동일, 기존 관례와 일치, 선택 사항"으로 정리한 뒤 4라운드(6~9차) 연속 재상정되지 않은 항목 | `scripts/check-override-floors.py:297`, `:345`, `:366` | 조치 불요(carried 판단 유지, 새 근거·위험 없음) |
| 9 | 부작용 | `EXPECTED_SUPPRESSED_PATHS`(mutable `dict[str, set[str]]`) 신규 모듈 전역 — 현재 코드 경로는 읽기 전용(`.get()`)으로만 사용해 실제 mutation 위험 없음을 직접 대조 확인 | `scripts/check-override-floors.py:63-69` | 조치 불요(현재 안전). 선호에 따라 `Mapping`/`frozenset` 타입힌트로 방어적 명시 가능 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 인젝션·하드코딩 시크릿·안전하지 않은 역직렬화 없음(`yaml.safe_load`, `shell=True` 미사용). INFO 3건(raw 출력 CI echo 이론적 위험 1건 + 긍정 관측 2건) |
| requirement | **CRITICAL** | 실 pnpm registry 재현으로 §1 핵심 두 경로 모두에서 CRITICAL 확인: 스키마 드리프트 오판(liquidjs) + widened 억제탐지 메커니즘 사문화(dead code). WARNING 1건(컨테이너 타입 미검증 크래시) |
| scope | NONE | 페이로드 실질 변경이 plan §1 및 직전 라운드 요구 조치 범위에 정확히 국한. INFO 3건(페이로드가 브랜치 diff 부분집합 등 커버리지 기록) |
| side_effect | LOW | 신규 상태변경·파일시스템 쓰기·네트워크 표면 확대 없음. INFO 4건(import-time sys.exit, 숨은 SystemExit 이탈경로 등 — 전부 기존 관례와 일치하거나 현재 안전) |
| maintainability | LOW | 네이밍·구조·docstring 전반 모범적. WARNING 1건(`main()` 책임 과다, widened/eroded 미추출), INFO 1건(audit-level 근거 주석 부재) |
| testing | MEDIUM | WARNING 1건(신규): `FailClosedSiteCountTest` 가 README 수치를 실제로 검증하지 않음 — 이전 두 라운드의 "자동 검증" 결론을 뮤턴트로 반증. 9차 WARNING(예외 확장 회귀 테스트 부재)은 완전 해소 확인 |
| documentation | LOW | 신규 결함 없음. 사실관계(버전 표·fail-closed 지점 수 등) 외부 문서 3곳과 교차 검증 일치, 직전 라운드 INFO 2건 해소 확인 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 어느 것에도 매칭 안 됨(CI 전용 스크립트, 제품 코드 미접촉). 발견사항 없음 |

## 발견 없는 에이전트

- **user_guide_sync** — 매칭되는 doc-sync trigger 없음, 발견사항 없음.

## 권장 조치사항

1. `classify_vulnerable()` 의 스키마 드리프트 오판 수정 — `actions_with_module` 판정에 `action.get("module")` 우선 + `resolves[].id` → `advisories` 역참조 폴백을 추가하고, 실측 payload(`"action":"update","module":null`)를 `SchemaDriftTest` 고정 fixture 로 추가 (CRITICAL #1)
2. `widened`/`EXPECTED_SUPPRESSED_PATHS` 억제-재유입 탐지 메커니즘 재설계 — 현재 실제 pnpm `ignoreCves` 동작에서 항상 발동 불가능. `ignoreCves` 제외한 별도 audit 호출 또는 per-invocation `--ignore` 로 억제 전 원본을 직접 확보하고, 손으로 쓴 JSON 대신 실제 `pnpm audit --json` 캡처본을 fixture 로 고정한 통합 테스트 추가 (CRITICAL #2)
3. `run_audit()`/`classify_vulnerable()` 에 `actions`/`advisories` 컨테이너 타입 검증(`isinstance`) 추가 — 현재 존재 여부만 검사해 타입 불일치 시 크래시 (WARNING #1)
4. `FailClosedSiteCountTest` 에 `README.md` 를 직접 읽어 대조하는 assertion 추가 — 제안 코드 이미 검증 완료, 적용 비용 낮음 (WARNING #2)
5. `main()` 의 widened/eroded 계산을 `_diff_widened_paths()`/`_correlate_eroded()` 로 추출 — 테스트 용이성·파일 내 일관성 개선 (WARNING #3)
6. 여유가 되면 INFO 항목(audit-level 근거 주석, `StubNotUsed` 메타 테스트, `patched_versions` "?" fallback fixture, `Mapping`/`frozenset` 타입힌트) 순차 반영

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (8명)
  - **제외**: 아래 표 (6명, 개별 사유는 prompt 에 미포함)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **forced 전원 결과 확보됨** (누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(개별 사유 미제공) — 이번 diff(CI 전용 로컬 감사 스크립트)의 성격상 부합 |
  | architecture | 라우터 판단(개별 사유 미제공) |
  | dependency | 라우터 판단(개별 사유 미제공) — 스크립트 자체는 의존성 가드 도구이나 스크립트 자신의 의존성 구조 변경은 아님 |
  | database | 라우터 판단(개별 사유 미제공) — DB 접촉 없음 |
  | concurrency | 라우터 판단(개별 사유 미제공) — 동시성 로직 없음 |
  | api_contract | 라우터 판단(개별 사유 미제공) — API 계약 변경 없음 |

- `routing_status=skipped`: 해당 없음.