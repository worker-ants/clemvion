# RESOLUTION — summary agent 정의 "terminal" 메커니즘 정정

대상 SUMMARY: `./SUMMARY.md` (**LOW**, Critical 0, Warning 6, INFO 10)

> `routing=done: 7 reviewers run, 7 skipped` · `7/7 usable` · **`forced_missing=[]`** —
> #962 의 forced 커버리지 게이트가 이번 리뷰에서 실제로 작동했다.

## 조치 항목

| # | 카테고리 | 판정 | 조치 | commit |
| --- | --- | --- | --- | --- |
| W1 | 요구사항 | **fix** | **4번째 agent 를 놓쳤다** — `review-router.md` 가 아직 "Workflow sub-agent 의 report-file Write 는 차단됨" 이라 오귀속. 실제로는 workflow 가 `schema` 로 structured output 을 **명시 지시**해 Write 를 시도하지 않는 것이고, router 의 `output_file` 은 JSON 이라 basename 4종 규칙의 대상이 애초에 아니다. 정정 + 계약 테스트 범위에 편입 | `29874bb0d` |
| W2 | 범위 | **fix** | plan lifecycle 이동이 fix 커밋에 뭉쳐 있었다(`plan-lifecycle §3` 는 별 commit 요구). push 전이라 `reset --soft` 로 (1) agent fix (2) `chore(plan): mark … complete` 로 분리 | `92b080aca` |
| W3 | 부작용 | **fix** | **실제 구멍이었다.** git rename 탐지(기본 90% 유사도)가 삭제+생성을 하나로 접어 **old path 를 리뷰 payload 에서 통째로 없앤다** — 리뷰어가 그 삭제를 못 본다. 즉 "이름을 바꾸며 내용도 몰래 지우는" 변경이 side-effect 리뷰를 그대로 통과한다(리뷰어가 `--no-renames` 로 재현, 나도 재현 확인). diff discovery 6곳(code-review 5 · merge-coordinator 1)에 `--no-renames` 적용 | `29874bb0d` |
| W4 | 테스트 | **fix** | 내 테스트가 오기 복제 7개 중 **3개만** 덮었다 — 나머지는 재유입에 무방비. 게다가 `harness-checks.yml` paths 에 `.claude/commands/**` 가 없어 그 4개 파일만 고친 PR 은 **스위트가 아예 안 돈다**(이중 무방비). `NO_TERMINAL_MISATTRIBUTION` 8개 파일로 확장 + paths 추가 | `29874bb0d` |
| W5 | 테스트 | **fix** | 새로 넣은 "거짓 음성" 안전 문구가 테스트로 고정되지 않았다 — 정확히 forced-coverage 게이트가 막는 부류를 summary 레이어에서 막는 문구인데. `test_every_definition_flags_unobtained_findings_as_a_false_negative` 추가. **테스트가 즉시 갭을 잡았다**: `code-review-summary.md` 에만 그 문구가 없었다 → 내용 보강 | `29874bb0d` |
| W6 | 문서화 | **fix** | `tests/README.md` 카탈로그에 신규 3개(`test_summary_agent_contract`·`test_consistency_orchestrator_state`·`test_workflow_scripts`) 등재 + 기존 2행 갱신. **Conventions 의 "prose 는 검사하지 않는다" 와 내 테스트가 상충**한다는 지적이 맞아, 예외 근거를 명시 — sub-agent 정의는 렌더링이 아니라 **실행되는 system prompt** 라 문구가 곧 동작이다 | `29874bb0d` |
| INFO#2·3 | 유지보수성 | **fix** | 미사용 `from pathlib import Path` 제거, 루프 변수 `kind` → `_kind` 통일 | `29874bb0d` |
| INFO#1·4·5·6·7 | 문서·범위 | **후속** | 7개 파일 설명 중복 → hub 통합(§3 범위 명확화), followups 문서의 표제-내용 불일치(항목5), §7 인용 링크 형식 통일, 실측 예시 파일명 통일, 테스트 근거 주석 — 전부 `harness-report-contract-followups.md` 대상이거나 낮은 우선순위 | — |
| INFO#8·9·10 | 보안·부작용 | **조치 불요** | 리뷰어가 "이번 diff 가 만든 것 아님 / 위험 낮음 / 의도된 개선" 으로 명시. #10(`resolution-applier` 호출 빈도 증가)은 의도된 거짓음성 축소의 하류 효과 | — |

## TEST 결과

- **lint / build**: 해당 없음 (`codebase/**` 무변경)
- **unit**: 통과 — 하네스 **248 OK** (신규 5건 + 기존 243)
- **e2e**: **면제** — PROJECT.md §e2e 면제 화이트리스트 인용: "`.claude/**` (skills, hooks, agents 정의)"(97행), "`.github/**` (CI 정의는 e2e 가 검증 대상 아님)"(101행), "`spec/**` · `plan/**` · `review/**` …"(96행). 변경 set 은 그 **부분집합**이며 `codebase/**` 는 한 줄도 없다.

mutation 검증: 틀린 "terminal" 문구를 복원하면 2건 red, 원복하면 green.

## 보류·후속 항목

`plan/in-progress/harness-report-contract-followups.md` 로 durable 이관 (§1~5).
본 리뷰의 INFO#1(7개 파일 설명 중복 → hub 통합)은 그 문서 §3 의 대상 파일 집합을
명확히 하는 형태로 편입되어야 한다 — 리뷰어 지적대로 현재 §3 이 "유사 중복" 이라고만
써서 이번 7개와 일치하는지 불명확하다.
