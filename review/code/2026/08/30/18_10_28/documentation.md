# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** 저장된 리뷰 산출물 `plan_coherence.md` 에 sub-agent 반환 프로토콜 헤더(`STATUS=...` 줄과 `===REPORT_MARKDOWN_BELOW===` 구분자)가 보고서 본문 안에 그대로 섞여 커밋됐다.
  - 위치: `review/consistency/2026/08/30/17_49_59/plan_coherence.md:1-2` (파일 맨 앞 두 줄)
  - 상세: `.claude/docs/subagent-call-contract.md` §2·§7 규약상 `output_file` 에는 "결과 markdown" 만 쓰고, `STATUS=...` 는 호출자에게 반환하는 **마지막 응답 한 줄**(또는 Workflow 경로에서는 "STATUS 헤더 + delimiter + 보고서 전문"을 반환값으로만 쓰는 것)이다. 그런데 이 파일은 1행에 `STATUS=success plan_coherence review complete — 2 WARNING findings`, 2행에 `===REPORT_MARKDOWN_BELOW===` 를 그대로 담은 채 저장돼, 실제 보고서 제목(`# Plan 정합성 검토 — ...`)이 3번째 줄부터 시작한다. 같은 세션(`17_49_59`)의 형제 checker 산출물 4개(`cross_spec.md`, `rationale_continuity.md`, `convention_compliance.md`, `naming_collision.md`)와 `SUMMARY.md` 는 전부 `#` 제목으로 정상 시작해, 이 파일 하나만 벗어난 것으로 확인했다(직접 `head` 로 5개 파일 모두 대조). 기능적으로는 `SUMMARY.md` 가 두 WARNING 을 정확히 집계·반영했으므로 이번 라운드의 판정 자체를 흐리지는 않았지만, 이 문서를 나중에 직접 열어보는 사람이나 마크다운 렌더러 입장에서는 첫 줄이 제목이 아닌 프로토콜 문자열이라 어색하고, 향후 이 파일을 파싱하는 다른 도구가 있다면 오염원이 된다.
  - 제안: `plan_coherence.md` 1-2행의 `STATUS=...` / `===REPORT_MARKDOWN_BELOW===` 두 줄을 제거하고 `# Plan 정합성 검토 — ...` 로 시작하도록 정정. 재발 방지 차원에서는 `consistency-summary`/orchestrator 가 각 checker 의 `output_file` 을 집계하기 전에 이 패턴(파일 선두의 `STATUS=`/`===REPORT_MARKDOWN_BELOW===`)이 남아있는지 가볍게 검사하는 것도 고려할 만하다.

## 그 외 확인한 것 (문제 없음)

이번 diff 는 대부분 `17_36_15` 코드 리뷰 라운드(이 documentation reviewer 자신의 이전 라운드 포함)와 `17_49_59` consistency check 라운드가 지적한 항목들의 **해소(resolution)** 로 구성돼 있다. 실제로 반영됐는지 소스를 직접 열어 대조했다:

- **CHANGELOG 미갱신 WARNING → 해소**: `CHANGELOG.md` 의 "`UPDATE … RETURNING` 결과를 8곳이 행 배열로 오인했다" 섹션에 "소급 정정 (2026-08-30)" 블록이 저장소의 기존 관례(같은 섹션 안에 날짜 붙은 blockquote addendum 을 반복 사용하는 패턴)와 동일한 형식으로 추가됐다. 노출 창 "약 17일"은 `git log` 로 `8332d9a20`(2026-08-13)~`1a12088f2`(2026-08-30) 실측과 일치한다.
- **spec_impact: none → 해소**: `plan/in-progress/backend-lint-gate-broken-on-main.md` frontmatter 가 `spec_impact: [spec/5-system/4-execution-engine.md, spec/data-flow/3-execution.md]` 로 정정되고, 그 근거를 설명하는 배너가 추가됐다.
- **spec-update-node-cancellation-shutdown-classification.md #12 역참조 누락 → 해소**: 해당 plan 의 완료 블록에 "후속 보강 (2026-08-30, 같은 날 뒤)" 문단이 추가돼, 자신이 완료 처리한 각주가 이후 별도 planner 턴으로 보강됐다는 사실을 역참조한다.
- **spec `data-flow/3-execution.md` §2.1 트랜잭션 표기 비대칭(cross_spec WARNING) → 해소**: `execution | 상태 전이` 행에 "**`status IN (비-terminal)` guarded UPDATE 이며 트랜잭션 안에서 실행**된다" 문구와 `4-execution-engine.md#11-execution-상태` 상호링크가 추가돼, 바로 아래 `park 진입` 행과 서술 형식이 대칭을 이룬다. 앵커(`#11-execution-상태`)는 실제 헤더 `### 1.1 Execution 상태`(spec 38행)와 정확히 일치함을 확인했다.
- **spec §1.1 "원자성 보장" 미반영(requirement SPEC-DRIFT) → 해소**: `spec/5-system/4-execution-engine.md` 에 "else 분기(직접 마감)도 트랜잭션 안에서 돈다" 문단과, 위쪽 기존 소급 각주에 대한 "후속 각주 (2026-08-30) — 위 서술이 한 칸 넓었다" 정정이 추가됐다. blockquote 연속성(`>` 접두)이 끊기지 않고 이어지는지 실제 파일을 열어 확인했다 — 정상.
- **테스트 제목 과대주장 INFO → 해소**: `execution-engine.service.spec.ts` 신규 테스트 제목이 "…UPDATE 가 롤백된다" 에서 "…트랜잭션 manager 를 경유해 밖으로 전파된다 (롤백 전제조건)" 으로 좁혀졌고, JSDoc 도 "실 DB `ROLLBACK` 자체는 TypeORM 의 트랜잭션 계약이라 mock 으로 증명할 수 없다" 는 경계를 명시한다 — mock 이 실제로 증명하는 범위와 테스트명이 이제 일치한다.
- **두 분기 epilogue 코드 중복(maintainability WARNING) → 해소**: `finishStatusTransition` private 헬퍼로 추출됐고, 그 docstring 이 "이 파일이 형제 분기 drift 를 이미 여러 번 겪었다"는 추출 사유를 정확히 설명한다.
- **`updateExecutionStatus` JSDoc** 에 추가된 "호출 제약 — 자신의 트랜잭션 콜백 안에서 부르지 말 것" 문단은 실제 코드(두 분기 모두 `dataSource.transaction` 오픈)와 일치하고, "현재 호출부 11곳은 전부 top-level" 주장은 `17_36_15` concurrency reviewer 의 INFO 2(호출부 11곳 + `dataSource.transaction`/`manager.transaction` 5곳 전수 대조)와 정확히 같은 근거를 인용한다 — 인용 라운드 식별자(`17_36_15`)도 실제 그 라운드 산출물과 맞다.
- 인라인 주석("트랜잭션으로 감싸는 이유", "여기서 `false` 는 ...") 은 실제 코드 흐름과 정확히 일치하며 낡은 사본은 남아있지 않다(구 주석 "트랜잭션 밖이라 throw 가 롤백을 부르지 못한다"는 완전히 대체됨, 다른 곳에 stale 사본 없음을 grep 으로 확인).

## 남은 선택 사항 (조치 불요, 참고)

`17_49_59` consistency check 가 남긴 INFO 항목들(EIA §9.3 상호참조, `node-cancellation.md` §6 표 점검, `spec-draft-*` 도입부 헤더 스타일 통일, 자기-반증형 소정정 조건 1 인용 보강)은 checker 스스로 "필수 아님/선택 사항"으로 판정했고 이번 diff 에도 반영되지 않았다 — 의도적 미조치로 보이며 문제 삼지 않는다.

## 요약

이번 diff 는 새 기능이 아니라 이전 코드 리뷰(`17_36_15`)와 consistency check(`17_49_59`)가 지적한 문서화 결함들의 해소 라운드다. CHANGELOG addendum, spec 소급 각주·원자성 보장 문단 보강, `data-flow/3-execution.md` 매핑 표 대칭화, plan `spec_impact` 정정, 자매 plan 역참조, 테스트명 스코프 정정, JSDoc/인라인 주석 정확성까지 — 지적된 항목이 전부 실제로, 그리고 정확하게 반영됐음을 소스를 직접 열어 확인했다. 유일하게 새로 발견한 결함은 이번 라운드가 스스로 생성한 리뷰 산출물 하나(`review/consistency/2026/08/30/17_49_59/plan_coherence.md`)에 sub-agent 반환 프로토콜 헤더가 보고서 본문에 섞여 커밋된 것 — 코드/spec 변경 자체와는 무관하고 판정에 영향도 없는 국소적 결함이라 WARNING 으로 기록한다.

## 위험도

LOW
