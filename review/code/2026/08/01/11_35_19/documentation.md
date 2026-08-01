STATUS=success 문서화 리뷰 완료 — WARNING 2건, INFO 1건 (CRITICAL 없음)
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — `review/consistency/2026/08/01/09_11_58/*`

## 검토 범위 및 방법

리뷰 대상 8개 파일은 모두 `spec/data-flow/` impl-prep consistency-check 세션(`09_11_58`)의 신규 산출물(`SUMMARY.md`, `_retry_state.json`, `meta.json`, 5개 checker `.md`)이다. 코드가 아니라 그 자체가 "문서"이므로, 독스트링/README/CHANGELOG 류 체크리스트 항목 대부분은 해당 없음(새 공개 함수·API·env var 가 이 diff 에 없음) — 대신 이 산출물들을 향후 사람·에이전트가 읽을 영구 문서로 보고 (a) 포맷 일관성, (b) 인용된 사실(줄번호·앵커·경로)의 정확성, (c) 산출물 자체 내부 상태(`_retry_state.json`)와 내용물(`SUMMARY.md`)의 정합성을 실제 저장소 파일·git 이력과 대조 검증했다. 표본 검증 결과: `main.ts:186` 의 `setGlobalPrefix('api')`, `spec/5-system/1-auth.md` 의 `### 4.1 기록 대상 액션`/`### 권한 요약 섹션(§3.6)...` 헤딩과 그로부터 도출된 두 마크다운 앵커(`convention_compliance.md`·`cross_spec.md` 의 "제안" 문구 안), `SUMMARY.md`/각 checker 파일의 WARNING·INFO 개수 합산(3/8), 모든 표의 컬럼 수 정합성은 전부 실제와 일치했다 — 인용 정확도 자체는 높다.

## 발견사항

- **[WARNING]** 산출물 5개 중 2개에 내부 프로토콜 헤더(`STATUS=...` + `===REPORT_MARKDOWN_BELOW===`)가 영구 리포트 본문 맨 앞에 그대로 유출됨
  - 위치: `review/consistency/2026/08/01/09_11_58/naming_collision.md:1-2`, `review/consistency/2026/08/01/09_11_58/rationale_continuity.md:1,3`
  - 상세: 같은 세션의 5개 checker 산출물 중 `cross_spec.md:1`·`convention_compliance.md:1`·`plan_coherence.md:1` 은 파일이 곧바로 `# <제목>` 로 시작하는 깨끗한 보고서다. 반면 `naming_collision.md` 는 L1 `STATUS=success 신규 식별자 충돌 검토 완료 — WARNING 2건, INFO 1건 (CRITICAL 없음)`, L2 `===REPORT_MARKDOWN_BELOW===` 다음에야 L3 에서 실제 제목(`# 신규 식별자 충돌 검토 — spec/data-flow/ (--impl-prep)`)이 시작하고, `rationale_continuity.md` 도 L1 STATUS 줄, L3 구분자 다음에야 L5 에서 제목이 시작한다. `.claude/skills/consistency-checker/SKILL.md`(§2 "Workflow 실행")와 `.claude/docs/subagent-call-contract.md`(§7)에 따르면 이 STATUS+구분자 봉투는 checker 가 **호출자에게 반환**할 문자열의 포맷이지 `output_file` 자체의 내용 포맷이 아니다 — 정상 경로는 checker 가 `output_file` 에는 깨끗한 보고서만 Write 하고, 봉투는 반환값에만 실어 orchestrator 가 인라인으로 소비한다. 이 두 파일만 봉투가 파일에 박혀 있고 나머지 3개는 정상인 비대칭은, 이 두 checker 가 자기 `output_file` Write 를 건너뛰고 "전문 반환"으로 대체한 `recovered[]` 케이스였고 이후 파일 영속화(폴백 Write) 단계가 반환 원문을 봉투까지 포함해 그대로 옮겨 적었다는 해석과 정확히 들어맞는다(같은 문서가 "checker 가 Write 를 건너뛰는 일이 잦다(실측: 한 런에서 5개 중 4개가 Write 호출 0회)"·"recovered[] — 계약을 어기고 파일 대신 텍스트로 전문을 반환한 checker... 파일 영속화도 지시했다" 라고 명시). 게다가 유출된 두 파일끼리도 포맷이 다르다(`naming_collision.md` 는 STATUS 다음 줄에 바로 구분자, `rationale_continuity.md` 는 STATUS·구분자 사이에 빈 줄이 하나씩 더 있다). `review/consistency/**` 는 CLAUDE.md 상 "일관성 검토 산출물"로 영구 보관되는 문서 카테고리이므로, 이 봉투 잔재는 향후 이 세션을 단독으로 열어보는 사람이나 자동화 도구(예: `report_paths.py` 류 파서)에게 불필요한 하네스 내부 프로토콜을 노출하고 같은 배치 내 5개 파일의 포맷 일관성을 깨뜨린다. 기능적으로는 `SUMMARY.md` 가 두 파일의 WARNING/INFO 를 정확히 집계했으므로 이번 세션의 판정 자체에는 영향이 없다.
  - 제안: 두 파일에서 봉투 줄(`STATUS=...`/`===REPORT_MARKDOWN_BELOW===` 및 그 사이 빈 줄)을 제거해 나머지 3개 파일과 동일하게 `#` 제목으로 바로 시작하도록 정정. 재발 방지로 파일 영속화 폴백 단계가 반환 전문을 `output_file` 에 쓰기 전 `STATUS=...\n(===REPORT_MARKDOWN_BELOW===\n)?` 접두를 스트립하도록 보정하면 향후 세션에서 같은 오염이 재발하지 않는다.

- **[WARNING]** `_retry_state.json` 이 `--prepare` 스냅샷 상태(5개 전부 pending, 성공 0건) 그대로 커밋되어 같은 세션의 `SUMMARY.md`·5개 checker 파일이 보여주는 "5/5 완료" 사실과 모순
  - 위치: `review/consistency/2026/08/01/09_11_58/_retry_state.json:37-45` (`"agents_pending": ["cross_spec","rationale_continuity","convention_compliance","plan_coherence","naming_collision"]`, `"agents_success": []`, `"agents_fatal": []`)
  - 상세: 같은 세션의 `review/consistency/2026/08/01/09_11_58/SUMMARY.md` 와 5개 checker 파일은 전부 완료되어 실질적 발견사항(WARNING 3건, INFO 8건)을 담고 있음을 보여주지만, `_retry_state.json` 은 "전부 pending, 성공 0건" 인 최초 `--prepare` 스냅샷 그대로 남아 있다. 이는 `.claude/skills/consistency-checker/SKILL.md`(§"(fallback) 수동 Agent 경로" 각주)가 "종전에는 `--update` 미호출로 `_retry_state.json` 이 prepare 스냅샷에 멈춘 채 커밋돼, 같은 세션 SUMMARY 의 '5/5 성공' 과 모순되는 증거가 남았다 — 2026-07-17 실측 한 브랜치 7개 세션" 이라고 명시적으로 기록해 둔 바로 그 재발 패턴이다. 같은 문서는 "이 파일은 `/loop --resume` 검증의 SoT 라 stale 이면 전 checker 재실행을 유발한다"고 경고한다 — 즉 이 상태 그대로 향후 `--resume` 되면 이미 끝난 5개 checker 를 불필요하게 전부 재실행시킬 실질적 비용이 있다. (다만 `--summary-state`/`--resume` 자체는 읽는 시점에 디스크 기준으로 자가 reconcile 하므로 — `code_review_orchestrator.py:275` `_sync_from_disk` docstring 의 "Mostly redundant now" — 당장 판정을 왜곡하지는 않는다.)
  - 제안: `python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --sync-from-disk review/consistency/2026/08/01/09_11_58` 실행(SKILL.md 가 명시한, consistency-checker 세션에도 적용되는 공용 재조정 함수 — 해당 함수 docstring 이 "for the SKILLs that already document it" 로 교차 사용을 명시)으로 `agents_success`/`agents_pending` 을 디스크 실측(5/5 성공)에 맞게 재조정한 뒤 커밋해, 이력에 모순 증거를 남기지 않는다.

- **[INFO]** `origin/main` 기준 diff 에 이 세션과 무관해 보이는 다른 타임스탬프의 리뷰 세션 삭제가 섞여 있어, push 전 병합 베이스 재확인 권장
  - 위치: (리뷰 대상 diff 밖의 관측 — `git diff origin/main --stat` 결과, gate 번호 없음)
  - 상세: 이번에 리뷰하는 `review/consistency/2026/08/01/09_11_58/**` 8개 파일은 순수 신규 추가(`--- /dev/null`)이지만, 같은 브랜치를 `origin/main` 과 비교하면 이와 무관해 보이는 다른 세션 폴더 전체가 "삭제"로 잡힌다: `review/consistency/2026/08/01/11_18_16/**`(SUMMARY.md 등 6개 파일, `_retry_state.json` 은 `09_11_58` 쪽으로 rename 되어 diff 상 24줄 변경으로 표시) 와 `review/code/2026/08/01/10_55_44/**`(scope.md·security.md·side_effect.md·testing.md). 병렬 세션이 먼저 `origin/main` 에 그 산출물들을 병합했거나, 이 브랜치의 로컬 `main` 추적이 stale 할 가능성 둘 다 배제할 수 없어 이 리뷰만으로는 원인을 확정할 수 없다.
  - 제안: push 전 `git fetch origin && git log origin/main -- review/consistency/2026/08/01/11_18_16 review/code/2026/08/01/10_55_44` 로 그 세션들이 병렬 작업에서 이미 `origin/main` 에 병합된 것인지 확인. 이미 병합된 별개 세션이면 로컬 사본과 충돌 없이 rebase, 의도된 교체라면 그대로 진행.

## 참고 — 확인했으나 문제 없음

- `convention_compliance.md`(L71)와 `cross_spec.md`(L17)가 각각 제안 문구에 포함한 마크다운 앵커(`0-overview.md#권한-요약-섹션3-6-신설--왜-34-아래가-아닌가-2026-07-31`, `1-auth.md#41-기록-대상-액션`)는 실제 `spec/data-flow/0-overview.md:238`·`spec/5-system/1-auth.md:410` 헤딩과 대조한 결과 정확히 일치한다(후자는 GitHub-slug 규칙과 글자 단위로 정합, 전자도 em-dash 이중 하이픈 패턴까지 일치). 두 문서 모두 실제 코드로 재검증한 인용(예: `main.ts:186`)도 정확했다 — 이 세션의 사실관계 신뢰도는 높다.
- `SUMMARY.md` 의 WARNING 3건/INFO 8건 집계, `Checker별 위험도` 표의 건수 서술은 5개 하위 리포트를 직접 재집계한 결과와 정확히 일치한다. 마크다운 표(WARNING/INFO/Checker별 위험도 3개 테이블) 의 셀 개수도 이스케이프된 `\|` 를 감안해 전부 헤더와 일치해 깨진 표가 없다.
- SUMMARY.md 의 "권장 조치사항 #4"(구현 완료 시 4개 SoT 동시 갱신)는 이 diff 이후 커밋(`646a0bad4`, 13개 액션 구현)에서는 아직 이행되지 않았지만(`spec/5-system/1-auth.md §4.1`·`spec/conventions/audit-actions.md §3` 는 현재도 workflow/trigger/schedule/model_config 를 "미구현"으로 표기), `plan/in-progress/spec-sync-auth-gaps.md` 가 이를 "spec SoT 4곳 동기화 — planner 턴 필요" 항목으로 이미 정확히 추적하고 있어(이 세션을 근거로 명시 인용) 유실된 팔로우업은 아니다.

## 요약

리뷰 대상은 코드가 아니라 impl-prep consistency-check 세션 하나의 전체 산출물(SUMMARY + 5개 checker 리포트 + 상태 파일 2종)이며, "문서" 관점에서 본 내용 품질(줄번호·앵커·수치 인용의 정확성)은 표본 검증 전부 일치할 정도로 높다. 다만 산출물 자체의 아카이빙 품질에서 두 가지 실질적 결함을 발견했다: (1) 5개 checker 리포트 중 2개(`naming_collision.md`, `rationale_continuity.md`)에 orchestrator-checker 간 반환 프로토콜용 `STATUS=.../===REPORT_MARKDOWN_BELOW===` 봉투가 최종 파일에 그대로 박제되어 나머지 3개와 포맷이 어긋나고, (2) `_retry_state.json` 이 실행 전 `--prepare` 스냅샷 그대로 커밋되어 같은 세션 SUMMARY 의 "5/5 성공"과 정면으로 모순되는 상태로 저장소 이력에 남았다 — 둘 다 이 프로젝트의 `consistency-checker/SKILL.md` 가 스스로 "관측된 재발 패턴"으로 기록해 둔 것과 동일한 유형이며, 각각 구체적인 정정 방법(봉투 라인 삭제, `--sync-from-disk`)이 이미 존재한다. 기능적 판정(BLOCK: NO, WARNING 3/INFO 8 집계)은 두 결함의 영향을 받지 않아 시스템 동작을 깨뜨리지는 않지만, `review/consistency/**` 가 영구 보관 문서 카테고리인 만큼 정정을 권장한다. 부가로 `origin/main` 대비 diff 에 무관해 보이는 병렬 세션 삭제가 섞여 있어 push 전 재확인을 권한다(INFO). README/CHANGELOG/API 문서/env 문서 갱신은 이 diff 범위(새 기능·엔드포인트·설정 없음)에서 해당 사항 없음.

## 위험도

MEDIUM
