# Code Review 통합 보고서

세션: `review/code/2026/08/01/01_17_35` — 대상: harness-block-backstop (하향 금지 backstop `block_integrity.py` 신설 + `retry_state.py` 공유화), 15개 파일, 전부 `.claude/**` + `plan/in-progress/**` (하네스 자체, `codebase/`·`spec/` 무변경). 14개 reviewer 전원 실행 완료(`--route=all`).

**발견 건수**: CRITICAL 1 · WARNING 13 · INFO 13

## 전체 위험도

**HIGH** — 신규 backstop 이 스스로 존재 이유로 삼는 "하향이 조용히 통과하는 것을 막는다"를 정확히 재현하는 결함(Stop 훅 note 스로틀이 텍스트가 아니라 위치 인덱스로 키잉됨)을 **7개 reviewer 가 각자 독립적으로 서브프로세스 재현**했고, 회귀 테스트가 전무하다. 여기에 더해 Gate 2 의 실제 차단/허용 판정 자체에 관여하는 판정 파서(`summary_block_verdict`)에서도 "가장 나중"이 아니라 "가장 먼저 나온" 판정을 채택할 수 있는 결함을 security 리뷰어가 실행으로 재현했다. 다만 push 하드 게이트(`_report_notes`)는 스로틀이 없어 매 push 마다 notes 를 재출력하므로 **실제 차단 로직 자체는 첫 번째 결함의 영향을 받지 않으며**, 두 결함 모두 좁은 범위의 잘 정의된 수정(해시 기반 키·배너 판별 하드닝)으로 해소 가능하다 — 그래서 CRITICAL 이 아니라 HIGH.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 관측성(Stop 훅 advisory) | Stop 훅의 note 중복억제 마커가 "note 텍스트"가 아니라 `enumerate()` **위치 인덱스**로 키가 잡힌다. 바로 위 코드 주석은 "마커는 텍스트를 키로 삼으므로 다른 모순은 통과한다"고 명시하지만 실제 동작은 정반대 — 같은 (session_id, branch) 에서 게이트가 채택하는 세션이 바뀌어 **완전히 다른** 하향 경고가 발생해도 이전 인덱스 마커가 남아있으면 영구 침묵한다. `documentation`(CRITICAL)·`testing`(CRITICAL, 회귀 테스트 부재 지적)·`api_contract`·`maintainability`·`requirement`·`security`·`side_effect`(전부 WARNING) 총 **7개 reviewer** 가 각자 서브프로세스로 직접 재현(1차 note 출력 후 2차에 다른 텍스트로 재호출 → stderr 완전 공백). 이 backstop 이 막으려는 "하향이 조용히 통과" 실패 모드를 알림 채널 자신이 재현하는 셈이며, `test_block_integrity.py` 어디에도 "동일 인덱스·다른 텍스트" 시나리오가 없다. | `.claude/hooks/guard_review_before_stop.py:366-377`(주석 369-370, 키 생성 373: `marker = _marker_path(session_id, token, f"note{idx}")`) | 마커 키를 `idx` 대신 note 텍스트 해시로 전환(예: `hashlib.sha1(note.encode()).hexdigest()[:10]`). "동일 위치·다른 텍스트" 2회 연속호출 회귀 테스트 추가. 참고: push 하드 게이트(`guard_review_before_push.py:_report_notes`)는 스로틀이 없어 실제 차단 판정 자체에는 영향 없음 — 영향은 Stop 훅 소프트 넛지에 국한. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/API계약(파서 정확성) | `summary_block_verdict()` 의 override 배너 우선순위 판별이 "문서 내 실제 위치 비교"가 아니라 "줄 끝(후행 텍스트 없음) 매치 유무"의 대리 신호다. END-anchored 매치가 문서 안에 **둘 이상**이면 `.search()` 가 가장 나중이 아니라 **가장 먼저** 나오는 것을 채택 — `security` 가 직접 실행으로 재현(`"**BLOCK: YES**\n...\n**BLOCK: NO**\n"` → `'YES'` 반환, 의도된 최종 판정과 반대). 이 함수는 advisory 뿐 아니라 Gate 2 의 실제 차단/허용 계산(`_summary_block_is_no`)에 쓰인다. `api_contract` 도 같은 근본 원인을 WARNING 으로 독립 재현, `testing` 은 이 두-매치 시나리오를 겨냥하는 픽스처가 스위트에 없음을 확인. 732개 실측 세션에는 이 형태가 없었으나 회귀 하드닝 가치가 있다. | `.claude/_shared/block_integrity.py:60-65,96-107`; 소비처 `.claude/hooks/_lib/review_guard.py:699-715,961-992` | override 배너 판별을 실제 문서 마커(예: `>` 인용부호)로 좁히거나 END 매치 중 **마지막** 것을 채택(`list(pattern.finditer(text))[-1]`). "두 개의 bare `**BLOCK: X**` 줄" 회귀 테스트 추가. |
| 2 | 아키텍처 | 신규 `notes` 필드가 canonical `Outcome` 클래스 + 손으로 짠 두 fallback shim(`_Outcome`/`_Fallback`)에 개별 동기화돼야 하는 구조가 됐다 — 이 PR 이 `retry_state.py` 추출로 없앤 바로 그 "Mirrors X. Change both." 중복 패턴을 fallback 계층에서 재생산. `guard_review_before_stop.py:108-111` 주석이 "이미 한 번 두 shim 간 필드가 어긋났었다"고 스스로 인정. | `.claude/hooks/_lib/failopen_state.py:46-54`, `.claude/hooks/guard_review_before_push.py:793-799`, `.claude/hooks/guard_review_before_stop.py:99-114` | `_shared/`(단방향 계층)에 최소 stand-in 클래스 1개로 통합해 두 hook 의 fallback 분기가 import 하도록 정리. |
| 3 | 아키텍처 | push 훅은 REVIEW/PLAN 게이트 결과 어디서든 `.notes` 를 획일적으로 전달하도록 일반화됐지만(`_evaluate_over_targets`), Stop 훅은 REVIEW 게이트 분기에만 note 출력 루프가 하드코딩돼 있다. 현재 `PlanDecision` 에 `notes` 필드가 없어 latent 하지만, 향후 PLAN 게이트에 advisory 가 추가되면 Stop 쪽에서만 조용히 유실될 위험. | `.claude/hooks/guard_review_before_push.py:847-859` vs `.claude/hooks/guard_review_before_stop.py:356-383,394-423` | Stop 훅도 REVIEW/PLAN 결과를 균일 순회하도록 일반화하거나, 두 훅이 공유하는 `_forward_notes()` 헬퍼 도입. |
| 4 | 문서화 | 이번 diff 로 필드/책임이 늘어난 세 곳의 docstring 이 갱신되지 않음: (a) `Outcome` 클래스 docstring 이 신규 `notes` 필드를 필드 열거에서 누락, (b) `_evaluate_over_targets` docstring("Bridges two invariants")이 신규 3번째 책임(advisory 병합, 847-859행)을 반영 못함, (c) `review_guard.py` 모듈 최상단 "Policy" docstring 이 신규 하향-모순 backstop 자체를 전혀 언급하지 않음(`evaluate_review` 함수 docstring 도 마찬가지 — `requirement` 별도 확인). | `.claude/hooks/_lib/failopen_state.py:37-44,54`; `.claude/hooks/guard_review_before_push.py:809-827,847-859`; `.claude/hooks/_lib/review_guard.py:1-89` | 각 docstring 에 신규 필드/책임/backstop 존재를 한 줄씩 추가. |
| 5 | 문서화 | `test_consistency_orchestrator_state.py` 모듈 docstring 과 `.claude/tests/README.md:33` 가 이 PR 이 **없앤** "두 orchestrator 가 손 복제(mirror duplication)로 상태를 맞춘다"는 관행을 여전히 현재형으로 서술 — 그 근거인 "Mirrors X. Change both." 주석도 이번 diff 에서 함께 삭제됨. | `.claude/tests/test_consistency_orchestrator_state.py:3`, `.claude/tests/README.md:33` | "과거엔 손 복제, 지금은 `_shared/retry_state.py` 로 통합됐지만 이 테스트는 그 시절 CLI 출력 계약을 계속 지킨다" 식으로 갱신. |
| 6 | 의존성/아키텍처 | `merge_coordinator_orchestrator.py` 만 `_shared/retry_state.py` 의 `reconcile_state_with_disk` self-heal 을 위임받지 못해 세 소비자 간 계약 범위가 비대칭 — Agent tool 직접 fan-out 세션이 `--update` 를 안 부르면 `_retry_state.json` 이 prepare 시점 스냅샷에 멈춘 채 SUMMARY 는 성공을 보고할 수 있음. **이미 코드 주석(107-112행)과 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9(→10)에 후속 과제로 명시 등록된 기지 사항 — 신규/은폐된 결함 아님.** | `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-123` | 후속 PR 에서 `reconcile_state_with_disk` 위임 마저 적용. 우선순위 낮음(이미 추적됨). |
| 7 | 유지보수성 | `merge_coordinator_orchestrator.py` 에서 `_emit_summary_state` 가 자신이 호출하는 `_load_state` 보다 **먼저** 정의됨(forward-reference). 자매 orchestrator 두 곳(`code_review_orchestrator.py`/`consistency_orchestrator.py`)은 의존 대상이 항상 먼저 오는 순서(`_load_state → _save_state → _apply_status_update → _emit_summary_state`)를 유지하는데, 이 파일만 이번 diff 로 위치가 뒤바뀌어 "세 orchestrator 가 구조를 거울처럼 맞춘다"는 diff 자체의 관례가 유일하게 어긋남. | `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85`(정의, 86행 호출) vs `:113`(`_load_state` 정의) | `_load_state`/`_save_state`/`_apply_status_update` 를 `_emit_summary_state` 앞으로 재배치해 다른 두 orchestrator 와 순서 통일. |
| 8 | 동시성 | `retry_state.py` docstring 의 "convergence"(자가치유) 서술이 실제 보장 범위보다 넓게 읽힌다 — `agents_success` 는 `has_report()` 로 디스크에서 독립적으로 재도출돼 self-heal 되지만, `agents_fatal` 은 `reconcile_state_with_disk` 가 **이미 로드된 state 의 기존 리스트를 그대로 필터링**할 뿐 디스크 증거로 재도출하지 않는다(비대칭). 서로 다른 두 checker 에 대한 동시 `--update` 호출이 겹치면 한쪽의 `status=fatal` 커밋이 다른 프로세스의 stale 스냅샷 전체 덮어쓰기로 조용히 `pending` 복귀할 수 있고, 이후 어떤 reconcile 도 복구 못함 → `/loop` 가 영구 실패 checker 를 잘못 재시도. 데이터 손상·차단 오동작은 아니고 낭비성 재시도·감사기록 유실 수준. | `.claude/_shared/retry_state.py:59-71`(docstring), `:101-114`(`reconcile_state_with_disk`), `:166-190`(`apply_status_update`) | docstring 정정(디스크 재도출은 `agents_success` 뿐임을 명시). 필요시 `agents_fatal` 도 별도 sentinel 마커 파일로 디스크 재도출하도록 확장은 별도 후속으로 분리. |
| 9 | 테스트 | `test_block_integrity.py::NotesReachBothHooksTest` 의 `_CLEAN_PLAN` 스텁이 실제 `PlanDecision.push_blocks`(`@property`) 를 빠뜨려, 테스트 실행 시 PLAN 게이트가 `AttributeError` 로 크래시 → `main()` 최상위 except 가 이를 잡아 fail-open(exit 0) 되고, 이미 REVIEW 게이트에서 쌓인 `outcome.notes` 가 이 크래시-then-fail-open 경로에서도 출력되어 테스트가 **의도한 "정상 ALLOW" 경로가 아니라 우연히** green 이 된다(직접 subprocess 재현, stderr 에 traceback 확인). | `.claude/tests/test_block_integrity.py:328-331`(`_CLEAN_PLAN`), `:347-359`; 원인 `.claude/hooks/guard_review_before_push.py:860` | `_CLEAN_PLAN` 스텁에 `push_blocks = False`(또는 `@property` 미러링) 추가. |
| 10 | 테스트 | `contradiction_note()` 의 메시지 포맷팅(체커명 `.md` 접미사 제거·`sorted()` 정렬·`=`/`, ` 결합)을 검증하는 단언이 없음 — 관련 테스트(`DowngradedCriticalsTest.test_flags_the_real_downgrade_shape`)는 dict 결과만 확인하고 `contradiction_note()` 반환 문자열은 고정 템플릿 문구(`assertIn("§planner 인계", …)`)만 확인해 `parts` 조합 로직 뮤테이션을 못 잡음. | `.claude/_shared/block_integrity.py:137-139`; 테스트 `.claude/tests/test_block_integrity.py:173-184` | `assertIn("convention_compliance=2", note)` / `assertIn("plan_coherence=1", note)` 류 단언 추가. |
| 11 | 테스트 | 신규 `MergeCoordinatorUsesTheSharedStateTest` 가 `--update` 경로만 검증하고, 같은 리팩터로 함께 바뀐 `--summary-state`(`_emit_summary_state`→`_load_state` 위임) 경로는 리팩터 전후 모두 완전 무테스트로 남음 — 이 PR 의 동기 자체가 "merge-coordinator 는 테스트가 전혀 없었다"는 것이었는데 정확히 그 위임 변경 지점은 손대지 않음. | `.claude/tests/test_retry_state_shared.py:142-172`; `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85-98,113-114` | `SummaryStateCliTest` 와 동일 패턴으로 merge-coordinator 의 `--summary-state`(branch/base 필드 포함) 테스트 추가. |
| 12 | 성능 | `_newest_resolved_impl_done_mtime`/`_iter_consistency_summaries` 가 의존하는 `review/consistency/` 전체 이력 `os.walk` 스캔이 세션 수에 비례해 무한 성장하는 O(n)이고, 모든 `git push` 시도 + 모든 turn 종료(Stop)마다 실행된다(이번 PR 이 새로 만든 스캔은 아니고 이번엔 그 위에 최소 비용만 얹었을 뿐). 현재 저장소(732 세션) 실측 호출당 61-98ms — 당장 문제는 아니나 `review/**` 는 gitignore 안 되고 영구 보존되므로 세션 수가 단조 증가하면 push/turn-종료마다 누적 지연이 커질 수 있고, 멀티타겟 push 는 타겟 수만큼 곱해진다. | `.claude/hooks/_lib/review_guard.py:678-686,718-743` | 지금 당장 불요. 후속: 최신 `--impl-done` 세션 식별자 캐싱 + 무효화 신호, 또는 연도/월 단위 우선 스캔. |
| 13 | 부작용 | `save_state()` 의 원자적 쓰기(`<state_file>.tmp.<pid>` + `os.replace`)가 세션 디렉토리(git 비-ignore 대상, `_retry_state.json` 은 추적됨)에 **새로운 임시파일 표면**을 추가한다. `open(tmp,...)` 이후 ~ `os.unlink(tmp)` 이전에 프로세스가 강제종료(SIGKILL/OOM)되면 `.tmp.<pid>` 잔여 파일이 남고(`except OSError: pass` 로 조용히 무시), 이후 `git add -A` 류 워크플로와 겹치면 커밋에 혼입될 수 있다(프로젝트가 이미 `git add -A` 지양을 명시해 완화되긴 함). | `.claude/_shared/retry_state.py:50-83`(특히 73행, 79-83행 cleanup) | 심각도 낮음 — 세션 정리 스크립트(있다면)에 `*.tmp.*` 청소 추가 고려 또는 백로그 등록. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 | push 훅(`_report_notes`, 매 push 마다 무조건 재출력)과 Stop 훅(1회 스로틀, 위 CRITICAL #1 결함 있음)의 notes 재발화 정책이 서로 다른데 의도적 선택인지 우연인지 근거 주석이 없음. | `.claude/hooks/guard_review_before_push.py:733-750` vs `.claude/hooks/guard_review_before_stop.py:366-383` | push 쪽도 스로틀할지, "저빈도라 매번 보여줘도 무방"이라는 근거를 주석으로 남길지 결정. |
| 2 | 아키텍처 | 체커 이름 목록 3번째 사본(`role_instructions.CHECKER_INSTRUCTIONS`)이 파생이 아니라 테스트 동등성 검증(`test_role_instructions_registers_the_same_checkers`)으로만 묶여 있음 — `_shared → skill` 역참조를 피하기 위한 의도적 설계, 이번 diff 범위 밖. | `.claude/tests/test_block_integrity.py` (해당 테스트) | 없음(범위 밖 참고). |
| 3 | 의존성 | 새 외부 의존성 0(표준 라이브러리만 사용, harness 컨벤션 준수) / Python 버전 호환성 보존(`str.removesuffix()` 의도적 회피 + 근거 주석, `from __future__ import annotations` 일관 적용) / `_shared` 신설이 기존 `_lib` 네임스페이스 충돌을 의도적으로 회피하고 단방향 의존 유지 — 모두 긍정 확인. | `.claude/_shared/block_integrity.py`, `.claude/_shared/retry_state.py` 전체 | 없음(현행 유지 권장). |
| 4 | 유지보수성 | `_shared/retry_state.py` 의 5개 함수 전부 타입힌트가 없음 — 같은 커밋의 `block_integrity.py`/기존 `report_paths.py` 는 전부 타입힌트를 갖춰 스타일이 다르다. AST 비교로 동일성을 검증하는 추출 특성상 원본을 의도적으로 verbatim 이동시킨 결과로 보여 결함이라기보다 후속 여지. | `.claude/_shared/retry_state.py:41,50,86,127,166` | 별도 후속 커밋으로 타입힌트 추가(동작 변경 없는 순수 어노테이션). |
| 5 | 유지보수성 | `consistency-summary.md` 에 추가된 괄호 삽입문이 원 문장 중간에 4줄짜리 중첩 설명을 끼워 넣어 가독성 저하 — sub-agent 시스템 프롬프트 본문이라 사람뿐 아니라 모델의 핵심 규약("1차 방어는 여전히 하향 금지 조항") 파악에도 영향 가능. | `.claude/agents/consistency-summary.md:50-55` | 괄호 내용을 별도 문장/하위 bullet 으로 분리. |
| 6 | 성능 | 신규 하향 감지 검사를 "게이트가 채택하는 세션 1건"으로 스코프 제한한 설계가 실제로 회귀 없음을 실측으로 확인(모범 사례) — PR 자체 주석의 "전체 이력 검사 시 +0.39초" 회귀를 실제로 피함(732세션 저장소에서 notes 활성/비활성 간 차이가 잡음 수준). | `.claude/hooks/_lib/review_guard.py:744-759` | 없음 — `test_only_the_session_the_gate_adopts_is_checked` 를 회귀 가드로 유지. |
| 7 | 성능 | 채택 세션의 `SUMMARY.md` 가 게이트 1회 평가당 2번 읽힘(중복 I/O, 세션당 상수 비용이라 영향 미미) + `reconcile_state_with_disk`×`has_report()` 조합이 참가자 수 k 에 대해 O(k²)이나 k 가 작아(체커 5개/reviewer <10개) 무해. | `.claude/hooks/_lib/review_guard.py:715,735`; `.claude/_shared/block_integrity.py:117`; `.claude/_shared/retry_state.py:93,101` | 급하지 않음 — 여유 있을 때 읽은 텍스트 재사용/딕셔너리화 고려. |
| 8 | 보안 | `_newest_resolved_impl_done_mtime()` 의 `contradiction_note()` 호출에 로컬 `try/except` 가 없어, 향후 `block_integrity.py` 변경이 예외를 던지면 advisory 계산 실패가 그 target 의 Gate 2 전체를 fail-open 시킬 결합점이 새로 생겼다(현재는 `block_integrity.py` 내부 방어적 구현으로 실제 발생 안 함, 테스트로 확인됨). | `.claude/hooks/_lib/review_guard.py:756-759` | `contradiction_note()` 호출을 자체 `try/except Exception` 으로 감싸 국소화. |
| 9 | 보안 | 커맨드/SQL 인젝션, 하드코딩 시크릿, ReDoS, 안전하지 않은 역직렬화 등 OWASP 전형 벡터 전수 확인 결과 해당 없음(list-form subprocess, 화이트리스트 sanitize, 원자적 쓰기 등 기존 신중한 관례 유지) — 이 diff 자체가 리뷰 게이트의 보안 통제를 강화하는 방향. | 전체 diff | 없음(긍정 확인). |
| 10 | 부작용 | `ReviewDecision.notes`/`Outcome.notes`/`_newest_resolved_impl_done_mtime` 신규 파라미터가 모두 끝에 기본값 있는 하위호환 확장임을 전체 호출부(8곳 생성 호출 + 테스트) 감사로 확인 — 깨지는 곳 없음. | `.claude/hooks/_lib/review_guard.py:173`, 각 `ReviewDecision(` 호출부 | 없음(감사 완료). |
| 11 | 범위 | 표제 기능(하향 금지 backstop)과 무관한 DRY 리팩토링(`retry_state.py` 추출, `merge_coordinator_orchestrator.py` 포함)이 같은 브랜치에 번들 — 사전측정 근거(AST 비교)·기존 추출 선례(`report_paths.py`)·전용 회귀 테스트·명시적 defer(merge-coordinator self-heal)가 모두 갖춰져 조치 불요로 판정(직전 라운드와 동일 결론). | `.claude/_shared/retry_state.py` 전체 등 | 조치 불요 — 근거를 PR 설명/SUMMARY 에 한 줄 요약해 다음 reviewer 의 재조사 방지 권장. |
| 12 | 요구사항 | spec fidelity 확인 — 이 변경은 전부 `.claude/**`+`plan/**` 범위이며 `spec/` 은 애초에 하네스 워크플로 규약의 관할이 아니다. 실질적 "spec" 문서 3곳(`consistency-summary.md`/`SKILL.md`/plan 문서)의 새 문구가 구현의 실제 스코프(spec-linked 변경 시에만 Gate 2 진입, `best_dir` 단일 세션만 검사)와 line-level 로 정확히 일치 — drift 없음. | `spec/**` grep 결과, `.claude/agents/consistency-summary.md`, `.claude/skills/consistency-checker/SKILL.md`, `plan/in-progress/harness-review-gate-ci-backstop.md` | 없음. |
| 13 | 테스트 | `summary_block_verdict` 의 "두 배너 동시 존재 시 우선순위" 동작을 직접 겨냥하는 픽스처 부재 — 위 WARNING #1(override 배너)의 테스트 커버리지 갭으로 동일 사안. | `.claude/tests/test_block_integrity.py:114-155`(`VerdictIsAnchoredTest`) | WARNING #1 제안과 동일(두 줄 모두 END 앵커, 값이 다른 픽스처 추가). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| api_contract | MEDIUM | Stop 훅 index-키잉 마커(WARNING 재현) + override 배너 우선순위 결함(WARNING 재현) |
| architecture | LOW | `Outcome` 3-copy shim 중복(WARNING), push/Stop notes 전달 일반화 비대칭(WARNING) |
| concurrency | LOW | `agents_fatal` self-heal 비대칭 — docstring 서술이 실제 범위보다 넓음(WARNING) |
| database | NONE | 해당 도메인 코드(DB 접근/ORM/마이그레이션) 없음 |
| dependency | LOW | merge-coordinator `reconcile_state_with_disk` 위임 비대칭(WARNING, 이미 추적됨), 신규 외부 의존성 0 |
| documentation | MEDIUM | Stop 훅 마커 "주석-코드 정반대"(CRITICAL) + docstring 갱신 누락 3건 + stale 테스트 서술 |
| maintainability | LOW | Stop 훅 마커 index 결함(WARNING) + merge-coordinator 함수 정의순서 역전(WARNING) |
| performance | LOW | `review/consistency/` 전체스캔 O(n) 무한성장(WARNING) — 신규 검사 자체는 스코핑으로 회귀 없음 실측 확인 |
| requirement | LOW | Stop 훅 마커 index 결함(WARNING, 재현) — 743 테스트 전수 통과, spec fidelity 확인(drift 없음) |
| scope | LOW | retry_state 리팩터 번들링은 근거·선례·테스트로 정당화됨(조치 불요), 무관 스코프 이탈 없음 |
| security | MEDIUM | Stop 훅 마커 index 결함(WARNING, 재현) + override 배너 우선순위 결함(WARNING, 재현) |
| side_effect | MEDIUM | Stop 훅 마커 index 결함(WARNING, 재현) + `save_state` tmp 파일 신규 표면(INFO) |
| testing | HIGH | Stop 훅 마커 index 결함 + 회귀 테스트 전무(CRITICAL) + PLAN 스텁 크래시-우연통과(WARNING) + 커버리지 갭 2건(WARNING) |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전수 대조, 매칭 0건(전부 `.claude/`+`plan/` 범위, 제품 코드 무변경) |

## 발견 없는 에이전트

- **database** — 이번 diff 15개 파일 전부 하네스 툴링/문서이며 관계형·NoSQL 접근, ORM, 마이그레이션, 트랜잭션, 커넥션 풀 등 DB 관점 대상이 전혀 없음(해당 없음, NONE).
- **user_guide_sync** — `doc-sync-matrix.json` 21개 trigger(glob 8건 + semantic 13건) 전수 대조 결과 매칭 0건. 변경 파일 15건 전부 `.claude/**` 또는 `plan/in-progress/**`이며 매트릭스는 `codebase/`+`spec/`만 커버(해당 없음, NONE).

## 권장 조치사항

1. **(최우선, CRITICAL)** Stop 훅 note 스로틀 마커 키를 위치 인덱스에서 note 텍스트 해시 기반으로 전환(`.claude/hooks/guard_review_before_stop.py:373`) + "동일 위치·다른 텍스트" 2회 연속호출 회귀 테스트 추가. 7개 reviewer 합의, 이 backstop 의 존재 이유를 정면으로 훼손하는 결함.
2. `summary_block_verdict()` 의 override 배너 판별을 실제 문서 마커로 좁히거나 END 매치 중 마지막 것을 채택하도록 하드닝 + "두 개의 bare BLOCK 줄" 회귀 테스트 추가 — Gate 2 실제 차단판정에 관여하는 파서이므로 CRITICAL #1 다음으로 우선.
3. `test_block_integrity.py::NotesReachBothHooksTest` 의 `_CLEAN_PLAN` 스텁에 `push_blocks = False` 추가 — 현재 이 테스트가 의도한 "정상 ALLOW" 경로가 아니라 우연한 크래시-fail-open 경로로 green 임.
4. `Outcome`/`_Outcome`/`_Fallback` 3-copy 필드 동기화 구조를 `_shared/` 의 단일 stand-in 클래스로 통합해 "Change both" 재발 위험 제거.
5. docstring 갱신 일괄 처리: `Outcome` 클래스, `_evaluate_over_targets`, `review_guard.py` 모듈 최상단, 그리고 stale 해진 `test_consistency_orchestrator_state.py`/`README.md:33` 서술.
6. 테스트 커버리지 보강: `contradiction_note()` 메시지 포맷 단언, merge-coordinator `--summary-state` 경로 테스트.
7. **(낮은 우선순위, 대부분 이미 추적됨)** merge-coordinator `reconcile_state_with_disk` 위임 완결(plan 항목 #9/#10 참조), `agents_fatal` self-heal 독스트링 정정, `merge_coordinator_orchestrator.py` 함수 정의 순서/`retry_state.py` 타입힌트 통일, `review/consistency/` 전체 스캔 캐싱 후속 검토, `save_state` tmp 파일 정리 스크립트 등록.

## 라우터 결정

`routing_status=skipped` — 사유: `--route=all`. 라우터 미사용, 전체 14개 reviewer 실행(`agents_skipped` 없음). 참고로 `_retry_state.json` 은 소스 코드 변경(8건 파일 언급) 및 문서 파일 변경을 근거로 `documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing` 7개를 `agents_forced`(router_safety 강제 포함 사유)로도 별도 표시했으나, `--route=all` 자체가 이미 전원 실행을 강제하므로 이 목록은 참고 정보일 뿐 실제 실행 범위에 영향 없음.