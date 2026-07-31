# 요구사항(Requirement) Review

## 리뷰 범위 확인

`git diff origin/main...HEAD`로 실제 변경분을 직접 대조했다 (프롬프트는 5개 파일 전체를 "Review"
타입 — diff 없이 전체 컨텍스트만 — 로 제공했으므로, 실제 diff 는 별도로 `git diff` 로 확인).
변경은 5개 커밋(296d3a232·1c8f16e6f·ad9701b3e·0b99b3757·e7bb8fb28)의 누적분이며 테마는 "harness
번들 정확성"(natural sort 완성, sentinel 기반 파일 경계, `_charge_notice` 예산 통합, 2단계
truncation 총줄수 오보고 수정). 두 orchestrator 스크립트의 전체 파일(1544줄/1032줄)을 직접 Read 로
확인했고, 신규 로직 다수는 Python 서브프로세스로 직접 실행해 실측했다.

`.claude/skills/**`/`.claude/tests/**` 는 프로젝트 컨벤션상 `spec/`(제품 요구사항) 영역이 아니라
harness/tooling 영역이다. 대응하는 `spec/` 문서가 없으므로 이 변경에는 항목 9(spec 본문 일치)의
"CRITICAL 판정 대상 spec 문서"가 원천적으로 없다 — 가장 가까운 "요구사항 문서"는
`plan/in-progress/harness-consistency-summary-downgrade-rule.md` 이며, 아래 CRITICAL 은 그 문서
자신이 선언한 핵심 불변식과의 괴리로 프레이밍했다.

## 발견사항

- **[CRITICAL]** `--impl-done`의 git diff(`구현 변경 사항`)가 어떤 sentinel 경계도 갖지 못해, 예산
  초과 시 마지막 spec 파일과 통째로 묶여 "이름 없이" 삭제된다 — 이번 PR 이 세우려는 "모든 파일은
  온전히 포함되거나 이름으로 생략된다"는 불변식이 diff 자체에는 애초에 적용되지 않는다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:598`
    (`target_doc = _head_basis_notice(root, diff_base) + spec_bundle + diff_section` —
    `diff_section` 이 `spec_bundle` 뒤에 sentinel 없이 그대로 이어붙여짐) 및 `:584-594`
    (`diff_section` 조립부) 와 `:718-759`(`truncate_file_bundle`, 특히 `:741` `rel_of()` 와
    `:754` `dropped.insert(0, kept.pop())` — 리스트 끝(=마지막 파일+diff 가 붙은 청크)부터 버림).
    `budget_substitutions`(`:770-793`)가 모든 checker(cross_spec/rationale_continuity/
    convention_compliance/plan_coherence/naming_collision 5명 전원)에게 동일한 `target_doc` 을
    넘기므로, 영향은 checker 1명이 아니라 세션 전체다.
  - 상세: `format_file_bundle` 은 파일마다 `_BUNDLE_FILE_SENTINEL` 을 앞세워 청크를 만들지만,
    `diff_section` 은 그 뒤에 문자열로만 이어붙는다. 그래서 `rest.split(_BUNDLE_FILE_SENTINEL)`
    이 만드는 청크 리스트의 **마지막 원소는 "마지막 spec 파일 본문 + git diff 전체"의 결합체**가
    된다. `truncate_file_bundle` 은 예산 초과 시 `kept.pop()`으로 리스트 **끝**부터 하나씩 통째로
    버리므로, 파일 하나만 못 들어갈 만큼의 아주 작은 초과에도 이 결합 청크 전체(diff 포함)가
    한 번에 사라진다. 직접 재현(격리된 Python 서브프로세스로 실제 `format_file_bundle`+
    `truncate_file_bundle` 호출):
    ```
    diff 마커 텍스트가 출력에 있는가: False
    생략 목록: spec/5-system/1-auth.md, spec/5-system/4-execution-engine.md
    ```
    생략 안내문(`_omitted_notice`)은 정확히 spec 파일 2개만 이름으로 나열했고, git diff 가 함께
    사라졌다는 언급은 어디에도 없다 — `--impl-done`은 "spec 영역 + 코드 diff 를 함께 묶어 checker
    가 사후 검증"(파일 상단 docstring)하는 모드인데, 그 diff 가 통째로 없어지면 5개 checker 전원이
    코드 없이 spec 만 보고 판정하게 된다. `spec/5-system/`(18개 파일, 과거 실측 376~858KB)처럼
    이 PR 이 이미 여러 차례 다룬 대형 영역에서는 `target_doc` 예산(기본 `max_context_size`
    262144 의 60% ≈ 157KB)을 넘기는 것이 예외가 아니라 상례이므로 재현 가능성이 낮지 않다.
    `--impl-prep` 는 `diff_section` 을 붙이지 않으므로(consistency_orchestrator.py:572) 이 결함의
    영향을 받지 않는다 — `--impl-done` 에만 해당.
    이 결함은 이번 diff 의 변경 줄 자체가 만든 신규 회귀는 아니다(구 `_BUNDLE_FILE_MARKER` 방식도
    동일한 뒤쪽-결합 구조였음) — 그러나 이번 PR 이 정확히 "truncation 이 무엇을 버렸는지 반드시
    알려야 한다"는 원칙을 세우는 작업이고, `truncate_file_bundle`(신규 sentinel 메커니즘)이
    `--impl-done`의 실제 소비 지점이므로 이번 검토 범위에 정확히 든다. 겸사겸사 확인: plan 문서의
    완료 배너(`plan/in-progress/harness-consistency-summary-downgrade-rule.md:9`)와 "누락을
    관측 가능하게" 체크리스트 항목(`:117`, "양쪽 orchestrator 모두 구현 완료")은 diff 콘텐츠에
    대해서는 이 주장이 성립하지 않는다 — diff 는 애초에 "파일"로 취급되지 않아 이름으로 생략될
    자격조차 없다.
  - 제안: `diff_section` 에도 `_BUNDLE_FILE_SENTINEL` + 의사 파일명(예: "#### `(git diff)`")을
    붙여 독립된 청크로 취급되게 하고(생략 시 이름으로 남게), 가능하면 `target_doc` 조립 순서에서
    `_head_basis_notice` 바로 뒤(=`spec_bundle` 이전)로 옮겨 tail-drop 대상에서 최우선 보호되도록
    할 것. `RealAreaTargetSurvivalTest` 와 대칭으로 `--impl-done` 전용 회귀 테스트를 추가해 예산
    압박 상황에서도 diff 텍스트(또는 그 생략 안내)가 살아남는지 단언할 것.

- **[INFO]** `budget_substitutions`의 per-checker 몫 계산이 정수 내림으로 정확히 0 이 될 수 있고,
  `truncate_file_bundle`/`session.truncate_to_budget` 양쪽 다 `budget <= 0`을 "무제한"으로 해석 —
  아주 작은 `max_context_size` 에서는 "더 빡빡하게 자르라"는 요청이 역설적으로 "전혀 안 자름"으로
  뒤집힌다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:770-793`
    (`budget_substitutions`, 특히 `share = int(max_context_size * CHECKER_BUDGET_RATIO["corpus"] /
    len(keys))`) 와 `:718-733`(`truncate_file_bundle` 의 `budget <= 0` 분기)
  - 상세: 기본값 `max_context_size=262144`(env `CONSISTENCY_MAX_CONTEXT_SIZE`)에서는 도달 불가능한
    영역이라 실사용 위험은 낮음. 다만 `max_context_size` 가 명시적으로 아주 작게(예: 1~2) 설정되면
    `int(max_context_size * 0.6)` 이 0 이 되어 `truncate_file_bundle(text, 0)` 이 원문 그대로
    반환한다 — "무제한" 시그널이 호출자의 의도(작은 양수 예산)와 충돌.
  - 제안: 계산된 몫이 0 이 되면 최소 양의 하한으로 clip 하거나, `budget_substitutions` 자체가
    "명시적 0/음수"와 "계산상 0으로 내려간 값"을 구분해서 처리.

- **[INFO]** `_neutralize_sentinel`의 "본문은 경계를 위조할 수 없다" 보장에 남은 좁은 틈: 파일의
  raw 내용이 정확히 `<!-- @bundle-file -->` 로 끝나고(직전에 개행은 있으나) **말미 개행이 없는
  경우**, neutralize 시점엔 sentinel 패턴의 뒤쪽 개행이 아직 없어 치환되지 않는다. 그런데
  `format_file_bundle` 템플릿이 `content` 바로 뒤에 고정 텍스트 `"\n```\n"`을 이어붙이므로, 그
  누락됐던 개행이 조립 이후에 채워져 결과적으로 온전한 sentinel 패턴이 재구성될 수 있다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:210-226`
    (`_neutralize_sentinel`) + `:362-370`(`format_file_bundle` 템플릿, `content` 다음에 `\n`
    을 무조건 삽입)
  - 상세: 실제로 트리거하려면 "파일의 마지막 줄이 정확히 저 주석이고 파일이 말미 개행 없이 끝남"
    이라는 상당히 좁은 조건이 필요하다 — 기존 테스트(`test_a_document_that_writes_the_sentinel_
    cannot_forge_a_boundary` 등)가 다루는 "본문 중간/독립된 줄에 이미 개행이 있는" 형태보다 실제
    발생 가능성이 낮다.
  - 제안: neutralize 를 `content` 단독이 아니라 템플릿 조립 후 전체 청크에 대해 수행하거나, 조립
    전에 `content` 의 trailing newline 을 정규화. 우선순위는 낮음(hardening 성격).

## 요약

이번 3커밋(natural sort tie-break 완성, sentinel 기반 파일 경계 전환, `_charge_notice` 예산 통합)이
직접 건드린 코드 자체는 의도한 동작과 정확히 일치한다 — `_natural_key`는 `re.split` 캡처링 그룹의
홀짝 인덱스가 항상 str/int 로 고정 배치됨을 실측으로 확인해 타입 비교 오류 가능성이 없고,
`prioritize_bundle_files`의 4계층(변경분 > plan 언급 > 기타 > 카탈로그 대량)은 테스트가 요구하는
모든 우선순위 조합(카탈로그 강등이 plan 언급엔 이기고 브랜치 변경엔 진다 등)과 정확히 일치한다.
code_review_orchestrator.py 쪽 `total_lines`/`source_lines` 필드 분리도 실측(트레일링 개행이 있는/
없는/빈 문자열 등 5가지 케이스)으로 `line_anchors.truncate_to_line_boundary` 의 자체 total 계산과
완전히 일치함을 확인 — 직전 라운드가 지적한 CRITICAL(2단계 truncation 총줄수 오보고)은 올바르게
수정됐다. 다만 이번 PR 의 핵심 약속인 "무엇이 잘렸는지 반드시 알 수 있어야 한다"는 원칙이, 정작
`--impl-done` 모드의 가장 중요한 아티팩트인 git diff 자체에는 적용되지 않는다는 것을 직접
재현으로 확인했다(위 CRITICAL) — diff 가 sentinel 로 보호되는 "파일" 단위가 아니어서, 마지막 spec
파일과 함께 조용히 통째로 사라지고 생략 안내문은 그 사실을 전혀 언급하지 않는다. 5개 checker 전원이
동일한 `target_doc` 을 받으므로 영향은 세션 전체이며, "BLOCK: NO 가 실제로는 검토 대상이 프롬프트에
없었음을 의미할 수 있다"는 이 plan 문서 자신이 8회 넘게 추적해 온 실패 유형이 diff 라는 새로운
경로에서 재발한다. 이 결함은 이번 diff 의 변경 줄이 새로 만든 회귀는 아니고(구 마커 방식도 동일
구조였음) 인접한 기존 조립 로직(`collect_context`)과의 상호작용에서 나오지만, 이번 PR 이 도입한
sentinel 메커니즘이 바로 그 결함이 드러나는 소비 지점이라 이번 검토 범위에 정확히 든다. 나머지는
낮은 발생 가능성의 엣지 케이스(예산 하한 내림 오차, sentinel 재구성 극단 케이스)로 INFO 수준이다.

## 위험도

HIGH
