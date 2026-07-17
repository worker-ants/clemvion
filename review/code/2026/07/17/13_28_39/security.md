# Security Review — forced-coverage-gate

## 대상
- `.claude/docs/subagent-call-contract.md` (prose)
- `.claude/hooks/_lib/review_guard.py` (`_forced_coverage_missing` 신규, `_summary_is_resolved` 수정)
- `.claude/skills/code-review-agents/SKILL.md` (prose)
- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` (`_reconcile_state_with_disk`/`_report_paths` 신규, `_emit_summary_state`/`_sync_from_disk`/`_verify_coverage`/`main` 수정)
- `.claude/skills/consistency-checker/SKILL.md` (prose)
- `.claude/tests/test_orchestrator_state.py`, `.claude/tests/test_review_guard.py` (신규 테스트)
- `plan/in-progress/forced-coverage-gate.md` (plan 문서)

## 발견사항

- **[WARNING]** 강제 리뷰어 커버리지 게이트가 매니페스트 부재/손상 시 fail-open — 우회 경로 존재
  - 위치: `.claude/hooks/_lib/review_guard.py` `_forced_coverage_missing()` (state_path 로드 try/except 블록, 약 648-656행)
  - 상세: `_retry_state.json` 이 없거나(`OSError`) JSON 파싱에 실패하면(`ValueError`) 함수는 즉시 `[]` 를 반환해 "누락된 강제 리뷰어 없음" 으로 판정한다. 즉 세션 디렉토리에서 `_retry_state.json` 을 삭제하거나 애초에 만들지 않으면 `agents_forced`(예: `security`) 화이트리스트 검증 자체가 통째로 스킵되고, 기존의 더 약한 기준(RESOLUTION.md 존재 또는 위험도 NONE/LOW)만으로 "해소" 판정을 받는다. 이 기능이 만들어진 계기 자체가 "security 리뷰어가 open-redirect 방어 경계 수정 diff 에서 스킵됐다" 는 사고이므로, 동일한 유형의 회피(의도적 삭제든 손상이든)에 여전히 열려 있다.
  - 제안: 로컬 개발 하네스라는 위협 모델상 완전한 fail-closed 는 정당한 수기 세션까지 막을 위험이 있어 부적합할 수 있으나, 최소한 "매니페스트 없음으로 강제 커버리지 미검증" 사실을 로그로 남기거나, 되돌리기 어려운 지점(push 가드)에서는 이 fail-open 범위를 좁히는 것을 고려할 것. 현재는 코드 주석·테스트(`test_a_corrupt_manifest_fails_open`, `test_a_session_without_a_manifest_is_unaffected`)로 명시된 의도된 트레이드오프이므로 "버그"라기보다 "인지·문서화가 필요한 잔여 리스크".

- **[WARNING]** 커버리지 판정이 파일 존재 여부만 확인 — 내용 미검증으로 손쉬운 우회 가능
  - 위치: `.claude/hooks/_lib/review_guard.py` `_forced_coverage_missing()` 의 `os.path.isfile(...)` 체크(약 671행); 동일 패턴이 `code_review_orchestrator.py`의 `_reconcile_state_with_disk`/`_verify_coverage`/`_report_paths` 에도 적용
  - 상세: "강제 리뷰어가 리포트를 남겼는가" 의 유일한 판정 기준이 `os.path.isfile()` 이다. 내용이 비어있거나 의미 없는 placeholder 파일(`touch security.md`) 도 커버리지를 만족시킨다. 이 게이트의 존재 목적이 "실제로 security 리뷰가 수행됐는가" 를 보장하는 것인데, 최소한의 콘텐츠 검증 없이는 "박스만 체크"하는 우회가 가능하다.
  - 제안: `_summary_is_resolved` 가 SUMMARY.md 파싱에 이미 사용하는 `_RISK_LINE`/`_RISK_LEVEL`/`_TABLE_DATA_ROW` 류의 최소 구조 검증(비어있지 않음, 특정 섹션 헤더 포함 등)을 강제 리포트 파일에도 적용하는 것을 검토. 다만 git 히스토리에 diff 로 남는 특성상 사후 감사(auditability)로 일부 완화된다.

- **[INFO]** Path traversal 방어 확인 — `os.path.basename()` 적용 양호
  - 위치: `.claude/hooks/_lib/review_guard.py` `_forced_coverage_missing()`; `code_review_orchestrator.py` `_report_paths()` (신규 함수, diff `@@ -171,6 +210,28 @@`)
  - 상세: `_retry_state.json` 의 `output_file` 값(신뢰 경계가 느슨한, 과거 워크트리 절대경로가 기록되어 있음)을 그대로 이어붙이지 않고 `os.path.basename()` 으로 디렉토리 성분을 제거한 뒤 항상 `session_dir` 기준으로 재조립한다. 따라서 `output_file` 이 `../../` 류의 값으로 조작돼 있어도 `session_dir` 바깥 경로의 존재 여부를 확인하는 데 쓰일 수 없다 — 두 파일(review_guard.py, code_review_orchestrator.py) 모두 동일 패턴을 일관되게 적용해 path traversal 을 사전 차단한다.
  - 제안: 없음(양호). 유사한 "기록된 절대경로를 다른 신뢰 경계에서 재해석" 코드를 작성할 때 동일 패턴(신뢰 못 할 세그먼트는 `basename` 후 화이트리스트 디렉토리에 재고정) 유지 권장.

- **[INFO]** basename 기반 경로 재해석의 파일명 충돌 가능성 (이론적, 낮은 실질 위험)
  - 위치: `code_review_orchestrator.py` `_report_paths()`
  - 상세: 파일 존재 판정이 "정확히 기록된 경로" 대신 "세션 디렉토리 + basename" 로 바뀌면서, 만약 서로 다른 두 forced 에이전트의 `output_file` basename 이 우연히 같다면 한쪽의 산출물 존재가 다른 쪽의 커버리지까지 충족시켜버릴 수 있다. 현재 명명 규칙(`<agent-name>.md`)과 에이전트명 유일성 하에서는 실질적 위험은 낮음.
  - 제안: 필수는 아니나, 세션 내 basename 중복을 감지해 로그를 남기는 방어적 체크를 고려할 수 있음.

- **[INFO]** `_retry_state.json` 필드 타입에 대한 방어적 검증 부재
  - 위치: `.claude/hooks/_lib/review_guard.py` `_forced_coverage_missing()` — `state.get("agents_forced") or []`, `state.get("subagent_invocations", [])`
  - 상세: JSON 파싱 실패는 예외 처리되지만 파싱된 값의 "형태"(예: `agents_forced` 가 리스트가 아니라 문자열인 경우)는 검증하지 않는다. malformed-but-valid JSON 이 주어지면 `for inv_name in forced:` 가 문자열의 개별 문자를 순회하는 등 예기치 않은(크래시는 아닌) 동작을 해 정상 세션을 잘못 "미해소" 로 오판할 잠재력이 있다. 공격 표면이라기보다 가용성/견고성 이슈.
  - 제안: `isinstance(forced, list)` 등 최소 방어적 타입 체크 추가 권장(필수는 아님).

인젝션(SQL/XSS/커맨드/LDAP), 하드코딩 시크릿, 안전하지 않은 암호화, 에러 메시지를 통한 민감정보 노출, 신규 취약 의존성 — 이번 diff 범위에서는 해당 사항 없음(N/A). `subprocess` 호출은 모두 리스트 인자 + `shell=True` 미사용(기존 코드, 이번 diff 로 신규 추가되지 않음)이며, `json.load` 만 사용해 `pickle`/`eval` 류의 역직렬화 위험도 없다.

## 요약
이번 변경은 애플리케이션 코드가 아니라 AI 코드리뷰 하네스 내부에서 "강제(forced) 리뷰어가 실제로 산출물을 남겼는가" 를 기계적으로 검증하는 거버넌스 게이트(`_forced_coverage_missing`, `_reconcile_state_with_disk`, `_report_paths`)를 추가하는 내부 툴링 diff다. 인젝션·하드코딩 시크릿·안전하지 않은 암호화·민감정보 노출 등 전형적 취약점은 발견되지 않았고, 신뢰하기 어려운 `output_file` 값을 다룰 때 `os.path.basename()` 으로 경로 이탈을 사전 차단하는 등 방어적 코딩이 확인된다. 다만 이 기능 자체가 과거 "security 리뷰어 스킵" 사고에 대응해 만든 보안 프로세스 통제이므로 그 실효성 관점에서 두 가지를 명확히 인지할 필요가 있다 — (1) `_retry_state.json` 이 없거나 손상되면 강제 커버리지 검증이 통째로 fail-open 되고, (2) 커버리지 판정이 파일 "존재" 만 보고 "내용" 은 보지 않아 빈 placeholder 파일로도 게이트를 통과할 수 있다. 둘 다 코드 주석·테스트에 이미 의도된 트레이드오프로 문서화돼 있고, 적대적 외부 공격자가 아니라 시간 압박에 쫓기는 협업 에이전트/개발자를 겨냥한 "넛지"라는 위협모델에서는 수용 가능한 수준이지만, 이 게이트를 "강력한 보증" 으로 오인하지 않도록 문서화하거나 최소 콘텐츠 검증을 추가하는 후속 보강을 권장한다.

## 위험도
LOW
