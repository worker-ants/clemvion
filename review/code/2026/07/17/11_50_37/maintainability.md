# Maintainability Review

## 발견사항

### [WARNING] 하네스 write-차단 서사가 신설 SoT 문서를 두고도 두 워크플로 스크립트에 거의 그대로 중복

- **위치**: `.claude/workflows/ai-review.js` (`DELIM`/`parseAgentReturn` 정의부 및 그 위 "The harness refuses sub-agent Writes..." 설명 코멘트, 약 20줄), `.claude/workflows/consistency-check.js` (동일 블록)
- **상세**: 두 파일의 `parseAgentReturn` 함수는 코드 로직이 100% 동일함을 `diff` 로 직접 대조 확인했다(주석 어휘만 "reviewer"/"checker" 로 다름). 그 위에 붙은 "하네스가 `SUMMARY.md` 등 특정 basename Write 를 차단한다"는 ~20줄 설명 코멘트 역시 거의 그대로 복제되어 있다. 이번 diff 는 바로 이 사실을 `.claude/docs/subagent-call-contract.md` §7 에 실측표로 SoT 화했고, 두 SKILL.md(`code-review-agents/SKILL.md`, `consistency-checker/SKILL.md`)는 전문을 재서술하지 않고 그 문서를 링크만 거는 방식으로 잘 고쳐졌다. 그런데 정작 이 사실의 근원인 두 `.js` 파일 자체는 `subagent-call-contract.md` 를 전혀 참조하지 않는다(`grep -n "subagent-call-contract" .claude/workflows/*.js` 결과 0건). 이 코드베이스는 바로 이런 인라인 중복 서술이 실제로 drift 를 일으킨 전례를 이미 자체 기록해 두었다 — `plan/in-progress/harness-workflow-contract-fix.md` P0 체크리스트: "76행 주석의 **정반대로 틀린** 전제 정정 — ... 이 오해가 ... `parseStatus` 기본값 `success` 를 정당화했다." 즉 지금 새로 작성된 이 장문 코멘트도 향후 하네스 동작이 바뀌거나 재실측될 때 SoT 문서만 갱신되고 코드 코멘트는 안 갱신되는 동일한 drift 위험을 그대로 재현한다.
- **제안**: 두 파일의 설명 코멘트를 1~2줄 요약 + `subagent-call-contract.md §7` 링크로 축약. `parseAgentReturn`/`DELIM` 자체의 코드 중복은 Workflow 스크립트가 모듈을 import 하지 못하는 하네스 제약(`.claude/workflows/*.js` 어디에도 `require`/`import` 없음 확인 — 물리적으로 공유 모듈 추출이 불가능해 보임) 때문에 불가피할 수 있으나, "왜 이런 모양인지"에 대한 서사만큼은 SoT 링크로 대체할 수 있다.

### [WARNING] `merge-coordinate.js` 가 이번에 고친 것과 동일한 결함 패턴을 그대로 보유

- **위치**: `.claude/workflows/merge-coordinate.js:54-56, 66`
- **상세**: `function parseStatus(text) { const m = /STATUS=([a-z_]+)/.exec(text || ''); return m ? m[1] : 'success' }` 그대로 남아 있고, 반환값도 `{name, status}` 만 보존해 findings 본문을 버린다. 이번 diff 가 `ai-review.js`/`consistency-check.js` 에서 정확히 이 패턴("STATUS 줄이 없으면 success 로 간주 → 가짜 성공, 본문 데이터 유실")을 P0 근본원인으로 지목하고 고쳤는데, 구조·목적이 거의 동일한 세 번째 형제 워크플로(`merge-coordinate.js`, 통합 조율자의 BLOCK 판정 경로)는 손대지 않았다. `plan/in-progress/harness-workflow-contract-fix.md` 의 P0 스코프가 `.claude/workflows/{consistency-check,ai-review}.js` 로 명시적으로 한정되어 있어 의도된 축소로 보이지만, diff·plan 어디에도 "merge-coordinate.js 는 후속 작업" 이라는 명시적 추적 항목이 없다. 다음에 이 세 파일 중 하나를 만지는 사람이 "이미 다 고쳐졌겠지" 라고 오인하기 쉬운 상태다.
- **제안**: plan 문서에 "merge-coordinate.js 동일 fix 필요"를 명시적 후속 항목으로 남기거나, 이번 스코프에서 제외한 이유를 `## 검토에서 제외한 것` 섹션에 한 줄 추가.

### [WARNING] output_file 기본경로 계산 dict-comprehension 이 같은 파일 내 두 함수에 그대로 중복

- **위치**: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:191-193` (`_sync_from_disk`) 및 `:231-233` (`_verify_coverage`)
- **상세**:
  ```python
  outputs = {
      i["name"]: i.get("output_file") or os.path.join(sd, f"{i['name']}.md")
      for i in state.get("subagent_invocations", [])
  }
  ```
  동일 표현식이 두 함수에 글자 그대로 반복된다. 같은 파일이 `_load_state`/`_save_state`(144-155행)처럼 반복 로직을 이미 헬퍼로 추출해 쓰는 관례를 갖고 있어, 이 부분만 그 관례를 벗어났다.
- **제안**: `_output_paths(state, sd)` 같은 private 헬퍼로 추출해 두 호출부에서 재사용. `<name>.md` 기본 파일명 컨벤션이 향후 바뀌면 한 곳만 고치면 되도록.

### [INFO] `_require_target` 가 클로저 캡처 없이 `collect_context` 내부에 nested 로 정의됨

- **위치**: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:290-326`(정의부), 호출부는 328/335/342/350행 4곳
- **상세**: `_require_target(value, flag, want_dir)` 은 자신의 파라미터만 사용하고 `collect_context` 의 지역 변수(`root`, `cfg` 등)를 전혀 참조하지 않는데도 함수 내부에 nested 정의돼 있다. `collect_context` 는 이미 4-분기 mode 처리로 150줄 안팎인데(278~429행) 이번 diff 로 한층 더 길어졌다.
- **제안**: 모듈 레벨로 승격하면 `collect_context` 길이가 줄고 subprocess 없이 직접 단위 테스트하기도 쉬워진다. 다만 이 파일의 테스트 관례 자체가 이미 "실제 CLI 를 subprocess 로 구동"(`test_consistency_target_validation.py` 서두 docstring, `test_orchestrator_state.py` 와 동일 패턴)이므로 필수는 아님 — 우선순위 낮은 개선 제안.

### [INFO] 3-way 상태 버킷 재계산이 인라인 코멘트 없이 한 줄로 압축됨

- **위치**: `code_review_orchestrator.py:202`
- **상세**: `state["agents_fatal"] = [n for n in state.get("agents_fatal", []) if n in missing]` 한 줄이 "이전에 fatal 이었지만 지금 디스크에 파일이 생겨 success 로 재분류된 항목은 fatal 목록에서도 제거한다"는, 함수 로직상 은근히 중요한 재조정을 담고 있다. 함수 docstring 은 success/pending 재계산 의도는 설명하지만 이 줄의 의도는 코드만 보고 바로 알기 어렵다.
- **제안**: 한 줄 인라인 코멘트 추가 (예: `# previously-fatal agent that now has a file on disk is no longer fatal`).

## 요약

이번 diff 는 실측 근거(날짜·세션 ID·구체적 피해 사례)를 각 함수·커밋에 남기는 이 코드베이스 고유의 문서화 관행을 잘 따르고, 신규 함수(`_sync_from_disk`, `_verify_coverage`, `_require_target`, `parseAgentReturn`)는 각각 단일 책임에 충실하며 네이밍이 명확하고 중첩도 얕다. 신규 Python 테스트는 `_write_invocations` 헬퍼로 반복을 억제했고 기존 파일의 서브프로세스 기반 CLI 테스트 컨벤션과 일관적이다. 다만 세 가지 WARNING 은 조치를 권장한다 — (1) 하네스 write-차단 서사가 이번에 갓 만들어진 SoT 문서(`subagent-call-contract.md §7`)를 두고도 `ai-review.js`/`consistency-check.js` 두 파일에 거의 그대로 재복제되어, 이 코드 자신이 과거에 겪은 "주석 drift"(§7 절이 스스로 정정한 그 사건) 재발 위험을 안고 있는 점, (2) 동일한 결함 클래스가 형제 파일 `merge-coordinate.js` 에는 그대로 남아 있어 이번 fix 의 커버리지가 세 워크플로 중 둘에만 적용된 점, (3) `code_review_orchestrator.py` 의 output-path 계산 로직이 파일 자체의 helper-extraction 관례를 벗어나 두 함수에 그대로 중복된 점이다. 셋 다 즉시 병합을 막을 사안은 아니지만, 향후 drift·이중 유지보수 비용으로 이어질 수 있어 후속 조치가 바람직하다.

## 위험도

MEDIUM
