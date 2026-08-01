# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — Critical 0건. 이번 라운드(커밋 `f71be98d8` "축 3 철회")는 직전 10차 라운드가 낸
CRITICAL 2건(스키마 드리프트 오판·`widened` 사문화 코드)을 재설계가 아닌 **메커니즘 제거**로
완전히 해소했음이 7개 reviewer 전원 교차 검증으로 확인됐다 — 이 자체는 순수 개선. 다만 같은
10차 라운드가 낸 WARNING(`advisories` 컨테이너 타입 미검증 → `AttributeError` 크래시)은
**이번 커밋에서도 미조치로 이월**됐고, `requirement`·`testing` 두 reviewer 가 각각 독립적으로
in-process 호출/mutation 으로 직접 재현(`AttributeError: 'list' object has no attribute
'items'`)해 살아있는 결함임을 재확인했다 — `testing` reviewer 의 개별 위험도(MEDIUM)를 전체
위험도에 반영한다. forced 화이트리스트 7명(`documentation, maintainability, requirement, scope,
security, side_effect, testing`) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

Critical 발견사항 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 견고성/에러처리 | `classify_vulnerable()`가 `audit.get("advisories") or {}` 결과를 `isinstance` 검사 없이 바로 `.items()`로 순회한다. `advisories`가 dict 가 아닌 형태(예: list)로 오면 `AttributeError`로 크래시해 exit 1이 되는데, 이 스크립트 자신의 어휘로 exit 1 은 "침식(취약점) 발견"과 같은 코드다 — 실행 실패와 정상 발견 신호가 구분되지 않는다. `requirement`·`testing` 두 reviewer 가 각각 독립적으로 실제 함수 호출/mutation 으로 직접 재현했다(`mod.classify_vulnerable({"actions": [], "advisories": [{"module_name": "liquidjs"}], "metadata": {}})` → `AttributeError`). 10차 라운드(`06_03_11`)의 requirement WARNING #1 로 이미 지적·구체 수정안까지 제시됐으나, 이번 축-3 철회 커밋이 `classify_vulnerable()` 내부를 직접 손댔음에도 이 부분은 재검토 없이 그대로 이월됐다. `.claude/tests/test_override_floors.py` 전체에 이 시나리오(컨테이너 타입 불일치)를 겨냥한 테스트가 0건이다. (참고: 같은 함수의 `actions[]` 관련 노출면은 축-3 철회로 이미 사라졌다 — `actions[]`를 더 이상 전혀 읽지 않으므로 `actions` 타입 문제는 부수적으로 해소됨. 남은 노출면은 `advisories`뿐이다.) | `scripts/check-override-floors.py:230`(`advisories = audit.get("advisories") or {}`), `:233`(`for name, adv in advisories.items():`) | `classify_vulnerable()` 진입부에 `if not isinstance(advisories, dict): _undecidable(...)` 가드 추가(10차 리뷰 제안과 동일). `FailClosedTest`류에 `raw_stdout=`으로 `{"advisories": [...]}(list 형태)` 케이스 1건 추가해 회귀 방지. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/명확성 | `run_audit()`가 여전히 `actions` 키의 **존재**만 응답 형태 정상성 판정 기준으로 요구하는데, 바로 아래 `classify_vulnerable()`의 docstring 은 "`actions[]`는 읽지 않는다"를 명시한다 — 두 함수를 따로 읽으면 왜 안 쓰는 키의 존재를 아직 검사하는지 의문이 생길 수 있다(실제로는 모순 아님: 전자는 스키마 판별자, 후자는 값 미소비 선언). fail-closed 방향은 유지돼 안전성 저하는 아니다. `side_effect`·`maintainability`·`documentation` 3개 reviewer 가 동일 지점을 독립적으로 지적. | `scripts/check-override-floors.py:210-216`(`run_audit()`), `:223`(`classify_vulnerable()` docstring) | `run_audit()`의 `actions` 존재검사 주석에 "내용은 더 이상 소비하지 않는다(근거: plan §축 3 철회)" 한 줄 추가 — `actions[]`가 이 파일에서 CRITICAL 을 두 차례 낸 이력이 있어 향후 재도입 오인 방지에 저비용 고가치. |
| 2 | 검증(긍정) | 직전 10차 라운드가 낸 CRITICAL 2건 — (a) `actions[].module` 이 정상 `"action":"update"` 응답에서 `null`인 것을 스키마 드리프트로 오판하던 결함, (b) `widened`/`EXPECTED_SUPPRESSED_PATHS`(ignoreCves 억제분 추적)가 실 registry 동작과 어긋나 항상 발동 불가능하던 죽은 코드 — 가 **재설계가 아니라 메커니즘 자체 삭제**로 완전히 해소됐다. `security`·`requirement`·`scope`·`side_effect`·`maintainability`·`testing`·`documentation` 7개 reviewer 전원이 `git show f71be98d8` diff 대조·grep 전수 확인(댕글링 참조 0건)·in-process/mutation 실측 payload 재현으로 각자 독립 검증했다. 개발자가 리뷰 제안(모듈 필드 폴백)을 그대로 따르지 않고 독자적 2×2 실측(`brace-expansion@2.1.4` lockfile 고정 포함, 4칸 전부 0건)으로 "발동할 재료 자체가 없다"는 더 강한 근거에 도달한 뒤 축 자체를 철회했으며, 근거가 커밋 메시지·plan `§축 3 철회`·코드 docstring 3곳에 일관되게 기록돼 있다. | `scripts/check-override-floors.py:220-249`(`classify_vulnerable()`), `:252-280`(`main()`), `plan/in-progress/deps-guard-hardening.md:294`(`## 축 3 철회`) | 조치 불요(검증 기록). |
| 3 | 완전성/회귀검증 | fail-closed 지점 축소(11→10)가 정확하고 남은 10곳 전부 전담 테스트로 커버되며, 테스트 총계 45→38(-7 감소)이 제거된 서브테스트 개수와 정확히 일치한다. 10차가 뮤턴트로 반증했던 `FailClosedSiteCountTest`("README 검증한다고 주장만 하고 실제로 안 읽음") 결함도 신규 `test_readme_count_matches_source`로 실제 해소됐음을 `testing` reviewer 가 README 문구 직접 뮤턴트(원복 확인)로 재검증했다. `requirement`·`testing`·`documentation` 3개 reviewer 가 각자 독립 확인. | `scripts/check-override-floors.py`의 `_undecidable(` 호출 10곳, `.claude/tests/test_override_floors.py:537`(`EXPECTED_SITES = 10`), `:551-572`(`test_readme_count_matches_source`) | 조치 불요. |
| 4 | 2-place 편집 규약 | `pnpm-workspace.yaml`의 `auditConfig.ignoreCves` 공백화와 `check-pnpm-security-config.py`의 `EXPECTED_IGNORED_CVES` 공백화가 같은 커밋에 함께 반영돼 2-place 편집 규약(설정 변경 시 baseline 동반 갱신)이 정확히 지켜졌다. 근거(js-yaml 은 override 로 해소, brace-expansion 은 advisory 매칭 범위 변경으로 무관해짐)가 코드 주석·workspace 주석·plan 문서 3곳에 일관 기록. `requirement`·`scope`·`side_effect`·`documentation` 4개 reviewer 가 교차 확인. | `scripts/check-pnpm-security-config.py:75-78`(`EXPECTED_IGNORED_CVES: set[str] = set()`), `pnpm-workspace.yaml:86-100` | 조치 불요. |
| 5 | 테스트커버리지 | `classify_vulnerable()`가 이번 라운드 시그니처(`tuple[dict,dict]`→`dict[str,str]`)와 내부 로직이 바뀌었는데도 여전히 직접 단위 테스트가 없다 — subprocess 통합 테스트(`run_with_stub_audit()`)로만 도달 가능. 함수는 순수 함수라 `_load_module()` 패턴으로 직접 단위 테스트 가능함(같은 파일의 `override_target()`류는 이미 이 패턴 사용). 10차 maintainability 리뷰가 이미 관찰한 carried 사항. | `scripts/check-override-floors.py:220`(`def classify_vulnerable`) | 급하지 않음. `AuditTimeoutTest`가 이미 쓰는 in-process 패턴 재사용 권장. |
| 6 | 테스트커버리지 | `scripts/check-pnpm-security-config.py`(149줄)가 이번 라운드 처음으로 router 스코프에 진입했는데 전용 unit test 가 없다(`.claude/tests` 에 대응 파일 0건). 다만 `testing` reviewer 가 `pnpm-workspace.yaml`에 CVE 무단 부활 뮤턴트를 직접 주입(원복 확인)해, CI 가 매 실행마다 라이브 리포와 대조하는 자기검증 메커니즘이 "무단 부활" 시나리오를 실제로 정확히 잡음(`returncode=1` + 정확한 진단 메시지)을 확인했다 — 이번 델타(2줄, 집합 비우기) 자체는 이 자기검증으로 이미 방어됨. | `scripts/check-pnpm-security-config.py`(전체) | 급하지 않음. 여유 시 핀 삭제·값 약화·무단 추가 3분기를 네트워크 없이 로컬 검증하는 소규모 `test_pnpm_security_config.py` 신설 고려. |
| 7 | 회귀안전망(forward-looking) | 이번에 실측된 CRITICAL #1 촉발 payload 형태(`"action":"update"`, `module:null`, `target:null`)가 회귀 fixture 로 남지 않았다 — 코드 삭제로 현재는 안전하지만 `actions[]` 소비 로직이 향후 재도입되면 같은 실수가 무방비로 재발할 수 있다. plan 문서 자신이 "정적 분석·mutation 9라운드 끝에 실제 도구 실행이 10라운드째에야 나왔다"는 교훈을 남겼는데 그 교훈이 구체 fixture 로는 아직 옮겨지지 않았다. | `.claude/tests/test_override_floors.py`(해당 fixture 부재), 참고 `plan/in-progress/deps-guard-hardening.md:328` | 급하지 않음. `classify_vulnerable()` docstring 또는 테스트 파일 상단에 실측 payload 형태를 주석으로 고정. |
| 8 | 완전성(pre-existing, 신규 변경분 아님) | `classify_vulnerable()`의 `reported[module] = ...`가 dict 컴프리헨션이 아닌 for-루프 덮어쓰기라, 같은 모듈에 advisory 가 2건 이상 동시 존재하면 마지막 것만 보고에 남는다. 1차부터 존재한 로직이며 10라운드 동안 지적된 적 없음. exit code 는 항상 정확(조용한 통과 아님) — 표시 완전성 문제에 그친다. | `scripts/check-override-floors.py:232-237` | 급하지 않음. 필요 시 `reported`를 `dict[str, list[str]]`로 확장. |
| 9 | 유지보수성 | `pnpm audit` 심각도 임계값(`--audit-level=moderate`)이 다른 튜닝 상수와 달리 이름 붙은 상수가 아니고 근거 주석도 없다. 10차부터 이월, 이번 diff 는 이 줄을 건드리지 않아 새 위험 없음. | `scripts/check-override-floors.py:182` | 급하지 않음. `_AUDIT_LEVEL` 명명 상수 승격 또는 근거 주석 1줄. |
| 10 | 보안(carried) | `run_audit()`이 `pnpm audit` 하위 프로세스의 raw stdout/stderr 를 최대 2000/500자까지 그대로 잘라 CI 로그(stderr)에 echo — 레지스트리 인증 오류 시 자격증명 편린이 로그에 남을 이론적 가능성. 10차와 동일 패턴·동일 위험도, 이번 델타가 새로 만들거나 악화시키지 않음. | `scripts/check-override-floors.py:193-209` | 급하지 않음(carried). 필요 시 알려진 시크릿 패턴 redaction 고려. |
| 11 | 스코프(긍정) | 이번 제거는 §1 원 승인 스코프의 이탈이 아니라, 구현 중 파생됐다가 실측으로 반증된 부가 축(`widened`/`EXPECTED_SUPPRESSED_PATHS`)을 원 스코프("오버라이드 하한 < 알려진 패치 하한" 단일 축 검출)로 되돌리는 정정이다. `main()`의 최종 형태도 §1 원문의 단일 관심사와 정확히 일치. | `plan/in-progress/deps-guard-hardening.md:16`(§1 원문), `:222`("개발 중 실측으로 드러난 것"), `:294`("축 3 철회") | 조치 불요. |
| 12 | 스코프(긍정) | 함께 커밋된 리뷰 산출물 11개(`review/code/2026/08/01/06_03_11/*`)는 10차 세션 파일만 정확히 번들됐다 — 과거(8→9차) "엉뚱한 커밋에 타 세션 산출물 혼입" 패턴의 재발 없음. `_retry_state.json`/`meta.json` 동반 커밋도 1~10차와 동일한 기존 관례. | `review/code/2026/08/01/06_03_11/` 전체(11개 파일) | 조치 불요. |
| 13 | 문서화(긍정, 미해결 질문 해소) | 10차 `user_guide_sync` 리뷰가 판단 유보한 질문("`PROJECT.md` §보조 스크립트 절에 `check-override-floors.py` 카탈로그화 필요한가")을 확인한 결과, 형제 스크립트 `check-pnpm-security-config.py` 도 동일하게 그 절에 없고 대신 `PROJECT.md:48`의 정책 서사에 함께 포함돼 있어 — 신규 갭이 아니라 기존 관례의 연장. | `PROJECT.md:48`, `:323-350`(§보조 스크립트) | 조치 불요. |
| 14 | 스코프(carried) | 이번 라운드 페이로드(14개 파일)는 브랜치 `origin/main` 대비 누적 diff 의 부분집합이다 — `.github/workflows/*.yml`·`.github/dependabot.yml`·`PROJECT.md`·`.claude/tests/test_override_floors.py`(실제로 이번 커밋에서 변경됐음에도)가 라우터 정책상 빠져 있다. `security` reviewer 가 스팟체크한 결과 특기할 결함은 없었으나 이번 라운드의 공식 판정 대상은 아니다. | 프롬프트 "리뷰 대상 파일" 목록 자체 | push 전 위 파일들을 포함한 최종 스코프 확인 권장(10차부터 반복 권고). |
| 15 | 견고성(긍정) | `classify_vulnerable()` 반환 시그니처 축소(`tuple[dict,dict]`→`dict[str,str]`)가 이 함수의 유일한 프로덕션 호출부(`main()`)와 같은 커밋에서 함께 갱신됐고, 이 함수를 이름으로 직접 호출하는 테스트가 없어(통합 테스트만 존재) 깨지는 외부 호출자가 없음을 grep 전수 확인으로 검증. `EXPECTED_SUPPRESSED_PATHS`(mutable 전역, 10차가 "향후 유의" INFO 로 이미 표시)도 함께 완전히 삭제돼 더 이상 이월 대상이 아니다. | `scripts/check-override-floors.py:220`, `:259` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CI 로그 raw stdout/stderr echo 이론적 위험(carried, INFO) + 10차 CRITICAL 2건 해소 재확인 |
| requirement | LOW | WARNING 1건(`advisories` 컨테이너 타입 미검증, carried·미조치) + 10차 CRITICAL 2건 해소 검증 |
| scope | NONE | 스코프 이탈 없음 — 이번 제거는 §1 원 승인 범위로의 정정, 리뷰 산출물 번들링도 정확 |
| side_effect | LOW | `EXPECTED_SUPPRESSED_PATHS` mutable 전역 완전 삭제 확인, 시그니처 축소 안전성 검증, `run_audit`/`classify_vulnerable` 내적 불일치 INFO |
| maintainability | LOW | `main()` 책임과다 WARNING 이 삭제로 해소, `actions` 검사 관련 저비용 주석 제안 |
| testing | MEDIUM | WARNING 1건(컨테이너 타입 미검증, `AttributeError` 직접 재현) — 이월·미조치가 위험도를 견인 |
| documentation | LOW | 대규모 삭제 후 매달린 참조 0건, `PROJECT.md` 카탈로그 미해결 질문 해소 |

## 발견 없는 에이전트

없음 — 7개 reviewer 전원이 최소 INFO 수준 관측을 보고했다(다수는 직전 라운드 CRITICAL 해소를
확인하는 긍정 검증 목적). 순수하게 "검토 대상 없음"으로 끝난 reviewer 는 없다.

## 권장 조치사항

1. `classify_vulnerable()` 진입부에 `isinstance(advisories, dict)` 가드 추가 — 유일한 WARNING.
   `advisories`가 dict 가 아닌 형태로 오면 현재 `AttributeError`로 크래시해 exit 1(스크립트
   어휘로 "침식 발견")과 구분 불가능하다. `_undecidable()`로 fail-closed 처리하고
   `raw_stdout=`을 이용한 회귀 테스트 1건 추가(10차 리뷰가 이미 구체 형태 제시).
2. `run_audit()`의 `actions` 존재검사 주석에 "내용은 더 이상 소비하지 않는다" 한 줄 추가 —
   `actions[]`가 이 파일에서 CRITICAL 을 두 차례 낸 이력이 있어, 향후 "죽은 검증"으로 오인해
   재도입하는 것을 저비용으로 예방.
3. push 전 이번 라운드 페이로드 밖 파일(`.github/workflows/*.yml`, `.github/dependabot.yml`,
   `PROJECT.md`, `.claude/tests/test_override_floors.py`)에 대한 최종 스코프 확인 — 10차부터
   이어지는 권고, 이번에도 미해결.
4. 여유가 있으면: `classify_vulnerable()`/`check-pnpm-security-config.py`에 대한 직접 단위
   테스트 보강, CRITICAL #1 촉발 payload 형태를 회귀 fixture 로 고정, `--audit-level=moderate`
   명명 상수 승격 — 전부 급하지 않은 개선 제안.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 실행 목록과 동일 — forced 전원 결과 확보됨, 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(이번 델타는 CI 전용 로컬 스크립트 2개, 성능 특이 표면 없음 — 개별 사유 상세는 매니페스트에 미포함) |
  | architecture | 상동 |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동(단, 10차 산출물이 `documentation` reviewer 컨텍스트로 인용돼 그 미해결 질문은 이번 라운드에 간접 해소됨) |