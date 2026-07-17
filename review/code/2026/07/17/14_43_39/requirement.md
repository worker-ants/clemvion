# 요구사항(Requirement) 리뷰 — summary agent "terminal" 오귀속 정정 + 계약 동기화

## 검증 방법 (요약)

- diff 10개 파일을 코드/문서 대조. `.claude/docs/subagent-call-contract.md §7`(이 변경 영역의 사실상 SoT — `spec/` 는 이 하네스 메타 도구 영역을 다루지 않음, `grep -rl ".claude/agents\|.claude/workflows" spec/` 결과 무관계 1건뿐)과 line-level 대조.
- `.claude/workflows/{ai-review,consistency-check,merge-coordinate}.js` 의 실제 summary-agent 호출 prompt 문자열을 직접 Read 해 3개 agent 정의(`수행 절차 B`)의 각 단계 서술과 1:1 대조.
- `python3 -m unittest discover -s .claude/tests -p 'test_summary_agent_contract.py'` 실행 → 4/4 PASS.
- `plan/complete/forced-coverage-gate.md` 프론트매터 Gate C 검증: `npx vitest run spec-plan-completion.test.ts plan-frontmatter.test.ts` (frontend) → 736 PASS.
- `.github/workflows/harness-checks.yml` 확인 — `unittest discover -p 'test_*.py'` 글롭이므로 신규 테스트 파일이 CI 에 자동 편입됨(별도 등록 불요).
- `git show 78ffd9983` 로 실제 커밋 diff 재확인(plan 파일이 `new file`로 보인 것은 `plan/in-progress/` → `plan/complete/` git-mv 렌네임의 대상측 — 소스는 PR #962(d89169460)에서 이미 존재, 정상적 lifecycle 이동).

## 발견사항

- **[WARNING]** `review-router.md` 가 동일 부류의 부정확한 write-차단 귀속을 여전히 보유 — 이번 정정의 스윕에서 누락
  - 위치: `.claude/agents/review-router.md:14`
  - 상세: 본 PR 은 "`mode=workflow` 에서 report-file Write 를 안 하는 이유"에 대한 잘못된 서술을 3개 summary agent + 4개 문서(commands 3·SKILL 1) 에서 정정했다고 커밋 메시지·테스트 docstring 이 명시("복제된 4곳도 일괄 정정", "7 files"). 그런데 `mode=workflow` 패턴을 쓰는 4번째 agent 인 `review-router.md` 는 스윕 대상에서 빠졌다: 14행이 "Workflow sub-agent 의 report-file Write 는 차단됨"이라고 여전히 단정한다. 그러나 §7 실측표에 따르면 차단은 `SUMMARY.md`/`summary.md`/`REPORT.md`/`findings.md` 4개 basename 한정이고, router 의 `output_file` 은 JSON(`_routing_decision.json` 류)이라 애초에 그 차단 대상이 아니다. 실제로 `.claude/workflows/ai-review.js` 의 router 호출부(라인 137-140)를 보면 router 가 Write 를 안 하는 진짜 이유는 하네스 차단이 아니라 **workflow 가 매 호출마다 명시 지시**하기 때문이다: `` prompt_file=...\nmode=workflow — 파일을 Write 하지 말고 결정을 structured output 으로 반환하세요. `` (+ `schema: ROUTING_SCHEMA` 옵션). 즉 "차단돼서 안 쓴다"가 아니라 "구조화 출력을 받으려고 애초에 안 시킨다"— 이번 PR 이 정확히 이 종류의 원인 오귀속을 제거하려는 것이었는데, 4번째 사례가 남았다. 기능적 버그는 아니다(router 는 실제로도 매번 프롬프트 override 로 Write 를 안 하므로 동작에 영향 없음) — 순수 문서 정확도 문제이며, `test_summary_agent_contract.py` 의 `PAIRS` 도 이 3개 summary agent만 커버해 회귀 가드에 걸리지 않는다.
  - 제안: 14행의 괄호 설명을 "하네스가 막아서"가 아니라 "workflow 가 structured output(schema) 방식을 명시 지시해서 Write 자체를 시도하지 않음"으로 정정. 필요하면 `test_summary_agent_contract.py` 의 스코프를 review-router 까지 넓히거나 별도 케이스로 추가해 재발 방지.

- **[INFO]** 신규 테스트 파일의 미사용 import
  - 위치: `.claude/tests/test_summary_agent_contract.py:21` (`from pathlib import Path`)
  - 상세: `Path` 를 타입 힌트·직접 호출 어디에도 쓰지 않는다(`AGENTS`/`WORKFLOWS` 는 `_harness.REPO_ROOT` 의 `Path` 연산 결과를 재사용할 뿐). `.claude/` 하네스 Python 에는 lint(ruff/flake8 등)가 연결돼 있지 않아(`grep` 결과 무) CI 에서 걸리지 않는다 — 기능 영향 없음.
  - 제안: 다음 편집 때 제거(급하지 않음).

- **[INFO]** 실측 예시 파일명이 §7 표에 문자 그대로는 없음 (사실관계 오류는 아님)
  - 위치: `.claude/agents/code-review-summary.md:19` (`security.md`), `.claude/agents/integration-risk-summary.md:19` (`terminal agent 의 일반 파일 Write 는 성공`)
  - 상세: `subagent-call-contract.md §7` 의 실측표는 `cross_spec.md` 를 성공 예시로 명시하고, 그 외는 "`<checker>.md`(`cross_spec.md` 등)" 로 일반화한다. `code-review-summary.md` 가 예시로 든 `security.md` 는 §7 표에 문자 그대로 등재된 probe 대상은 아니고, 규칙(“basename 정확 일치, position 무관”)로부터의 타당한 추론이다(실제 ai-review 의 reviewer 목록에 `security-reviewer` 존재 확인). 규칙 자체는 정확히 인용됐으므로 오류는 아니며, 각 문서가 자신의 도메인에 맞는 예시를 든 것으로 보인다.
  - 제안: 별도 조치 불요 — 참고용으로만 기록.

## 항목별 확인 결과 (문제 없음 — 근거 포함)

- **기능 완전성**: 3개 summary agent 모두 "인라인 전문 authoritative + 누락 파일 영속화" 절차가 실제 workflow 프롬프트(`inlineReports`/`needPersistList`/`needReadList`)와 문구·논리 순서까지 일치. `forced 인데 결과 없음`(ai-review) / `전문을 확보 못 한 checker/analyzer`(consistency-check, merge-coordinate) 케이스도 각 workflow 의 `forcedMissing`/`unfinished` 처리와 대응해 문서화됨.
- **엣지 케이스**: 인라인 없음(`(없음)`), 영속화 대상 없음(`(해당 없음)`), forced 전원 확보(`forced 전원 결과 확보됨`) 등 빈 컬렉션 경로가 workflow JS 쪽에서 이미 방어돼 있고, 정정된 문서가 그 분기들을 정확히 서술.
- **TODO/FIXME/HACK/XXX**: diff 전체에 없음(`git show 78ffd9983 | grep` 결과 0건).
- **의도와 구현 간 괴리**: 각 파일의 절차 번호(예: "5번 Write 성공이면 written")가 신규 2번 스텝 삽입으로 인한 renumbering(4번→5번)까지 3개 파일 모두 정확히 반영됨 — off-by-one 없음.
- **에러 시나리오**: Write 차단(정상 경로로 취급) / reviewer·checker·analyzer 결과 완전 소실(unfinished) / forced 미이행 세 갈래 모두 "정상 진행" vs "SUMMARY 상단 명시 필수"로 구분해 서술.
- **데이터 유효성**: 해당 없음(문서·프롬프트 계약 변경, 사용자 입력 검증 대상 아님).
- **비즈니스 로직**: "SUMMARY.md 는 어떤 sub-agent 도 못 쓴다 → 호출자(main)가 유일한 신뢰 경로로 멱등 Write" 원칙이 4개 커맨드 문서 + 1개 SKILL.md 에 걸쳐 문구까지 일관되게 갱신됨(`grep -rn terminal` 로 잔존 오기 0건 확인).
- **반환값**: 3개 agent 정의의 반환 3-파트 형식(STATUS 헤더/delimiter/전문)이 실제 workflow 의 파싱 로직(`parseAgentReturn`, `SUMMARY_DELIM` 처리)과 정확히 매칭.
- **spec 본문 일치(spec fidelity)**: 이 변경 영역은 `spec/`이 아니라 `.claude/docs/subagent-call-contract.md §7`이 SoT(하네스 메타 도구 — `plan/complete/forced-coverage-gate.md` 프론트매터의 `spec_impact: none` 판단도 동일 근거로 타당, Gate C 테스트로 확인). §7 실측표(basename 정확 일치 4종 차단, position 무관)와 3개 agent 정의·4개 문서가 라인 단위로 일치. 정정 대상이던 "틀린 이유"는 §7 자체에는 없었고(§7 은 애초에 정확한 SoT), agent 정의들이 §7 신설 이전 버전을 유지하고 있던 것 — 즉 이번 PR 은 문서 간 drift 를 SoT 방향으로 되돌린 정상적 fix.

## 요약

`code-review-summary.md`/`consistency-summary.md`/`integration-risk-summary.md` 3개와 이를 인용하는 4개 문서가 갖고 있던 "terminal sub-agent 라 Write 가 막힌다"는 반증된 설명을, 실측 SoT(`subagent-call-contract.md §7`: basename 정확 일치, position 무관)와 실제 workflow 구현(`inlineReports`/누락 파일 영속화 지시)에 맞춰 정확히 재작성했다. 7개 파일 전수 정정 확인, 신규 회귀 테스트 4건 통과, 관련 Gate C/frontmatter 가드 통과까지 모두 검증했다 — 코드(문서)와 실제 하네스 동작 사이의 line-level 불일치는 발견되지 않았다. 유일한 실질 발견은 동일 부류의 오귀속이 4번째 `mode=workflow` agent 인 `review-router.md` 에 남아있다는 것으로, 기능적 버그는 아니지만(router 는 매 호출 명시 지시로 실제로도 Write 를 안 함) 이번 스윕의 취지상 놓친 사례라 WARNING 으로 표기했다. 나머지는 미사용 import 등 코스메틱 INFO 뿐이다.

## 위험도

LOW
