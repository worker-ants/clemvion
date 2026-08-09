STATUS=success ISSUES=1 PATH=/Volumes/project/private/clemvion/.claude/worktrees/auth-guard-reflection-hardening-9c31f2/review/code/2026/08/09/15_46_17/requirement.md RESET_HINT=

===REPORT_MARKDOWN_BELOW===

# 요구사항(Requirement) 리뷰 — review/consistency/2026/08/09/15_09_04/*

## 검토 범위 확인

이번 diff 는 애플리케이션 코드가 아니라 `/consistency-check --impl-done spec/5-system/`
세션이 새로 생성한 5개 checker 리포트 + `meta.json` 이다. "의도한 기능" 은 각 checker
가 자기 정의(`.claude/agents/<name>.md`)의 "출력 형식" 대로 clean markdown 을
`output_file` 에 영속화하는 것과, 그 안의 spec 인용·코드 인용이 실제 코드베이스·spec
본문과 일치하는 것 두 가지다. 두 축을 모두 실측했다 — (a) 5개 파일의 산출 형식 자체를
직접 Read, (b) 각 파일이 인용한 코드(`workspace-context.util.ts`·`uuid.ts`·
`workspace-reflection-canary.ts`·`common/decorators/index.ts`·
`system-status.e2e-spec.ts`)와 spec(`spec/5-system/1-auth.md`·`3-error-handling.md`·
`spec/data-flow/12-workspace.md`·`spec/5-system/15-chat-channel.md`)·plan
(`plan/in-progress/auth-guard-reflection-hardening.md`)·이전 세션
(`review/consistency/2026/08/09/14_01_15/*`)을 직접 열어 대조했다.

## 발견사항

- **[WARNING]** `naming_collision.md` 가 checker 반환-채널용 프로토콜 스캐폴딩(STATUS 헤더 +
  구분자)을 영속 파일 내용에 그대로 포함 — 자신의 agent 정의 "출력 형식" 위반 + 세션 내
  형식 불일치
  - 위치: `review/consistency/2026/08/09/15_09_04/naming_collision.md:1-3`
  - 상세: 이 파일은 `STATUS=success naming_collision review complete — 0 critical, 0
    warning, 2 info`(1행) → 빈 줄 → `===REPORT_MARKDOWN_BELOW===`(3행) 로 시작한 뒤에야
    실제 리포트 본문(`# 신규 식별자 충돌 검토 — naming_collision`)이 나온다. 같은 세션의
    나머지 4개 checker 파일(`convention_compliance.md`·`cross_spec.md`·
    `plan_coherence.md`·`rationale_continuity.md`)은 전부 `# ...검토` 제목으로 즉시
    시작하며 이런 헤더가 없다. `.claude/agents/naming-collision-checker.md` §출력 형식은
    `### 발견사항`/`### 요약`/`### 위험도` 로 구성된 순수 markdown 만 규정하고 STATUS 줄을
    요구하지 않는다. `.claude/workflows/consistency-check.js` 의 `REPORT_RETURN_CONTRACT`
    (STATUS 헤더 + `===REPORT_MARKDOWN_BELOW===` + 마크다운 전문)는 **checker 가 호출자에게
    반환하는 텍스트**의 형식이지 `output_file` 에 쓸 내용의 형식이 아니다 — 워크플로
    스크립트 자체도 `parseAgentReturn()` 으로 그 헤더를 잘라내고 `body`(마크다운 전문)만
    분리해서 다루며, summary agent 가 "누락 파일 영속화" 폴백을 수행할 때도 그 분리된
    `markdown` 만 파일에 쓰도록 지시한다(BEGIN/END 래퍼는 있어도 STATUS 줄은 없음). 즉 이
    5행짜리 헤더는 `naming-collision-checker` sub-agent 가 자신의 최종 응답 텍스트를
    그대로 `Write` 로 옮겨 적으면서 생긴 실행 실수로 보인다. 다운스트림 게이트
    (`block_integrity.py` 의 `[CRITICAL]` 정규식 카운트, `## 위험도` 파싱)는 정규식
    기반이라 이 헤더가 있어도 오작동하진 않는 것으로 확인했으나(1행의 "0 critical, 0
    warning" 은 프로즈이고 `\[CRITICAL\]` 패턴과 무관), 향후 checker 리포트를 구조적으로
    파싱하는 도구(예: 첫 줄을 제목으로 가정)나 사람이 단독으로 이 파일을 열람할 때
    형식이 깨져 보인다. 5개 파일 중 1개만 이런 이유로, 세션 산출물의 형식 일관성이
    깨진 것 자체가 "의도한 기능(clean report persist)을 완전히 충족하지 못함" 이다.
  - 제안: `naming_collision.md` 1~3행(STATUS 헤더 + 빈 줄 + `===REPORT_MARKDOWN_BELOW===`)을
    제거하고 5행("# 신규 식별자 충돌 검토 — naming_collision")부터 시작하도록 정정 — 다른
    4개 checker 파일과 동일한 형식으로 맞춘다. 재발 방지는 harness 쪽(checker 가
    `output_file` 에 쓸 내용과 최종 반환 텍스트를 분리하도록 프롬프트 재확인) 검토 대상.

## 실측으로 확인한 항목 (허구 인용 없음 — 긍정 소견)

아래는 5개 리포트가 자신의 발견사항 근거로 인용한 코드·spec·plan·과거 리뷰 원문을
직접 열어 대조한 결과다. 전부 일치 — 지어낸 인용이나 spec 오독은 발견되지 않았다.

- `convention_compliance.md` WARNING — `spec/5-system/1-auth.md`·`3-error-handling.md`
  frontmatter `code:` 글로브가 `common/decorators/*.ts`·`common/utils/*.ts`·
  `app.module.ts`·`main.ts` 를 포함하지 않는다는 주장을 두 파일 frontmatter 직접 열람으로
  확인 — 정확히 `common/guards/*.ts`(1-auth.md), `common/filters`·`common/pipes`·
  `nodes/core/error-codes.ts`·`execution-engine/error`·`health`(3-error-handling.md) 만
  등재돼 있다.
- `convention_compliance.md` 긍정 소견 — `resolveRequestWorkspaceContext` 의
  `BadRequestException({code:'VALIDATION_ERROR', message:'X-Workspace-Id must be a
  UUID'})` 를 `codebase/backend/src/common/utils/workspace-context.util.ts` 원문으로 확인,
  `spec/5-system/3-error-handling.md` §1.3 의 `VALIDATION_ERROR | 요청 데이터 유효성 실패 |
  400` 행과 정확히 일치.
- `cross_spec.md` WARNING — `3-error-handling.md §1.3` 이 "부재"(`WORKSPACE_ID_REQUIRED`)
  케이스만 정의하고 "형식 오류" 케이스가 카탈로그에 없다는 주장을 §1.3 원문(76·78행)으로
  확인, 실제로 3번째 케이스 행이 없다. `spec/5-system/15-chat-channel.md` §5.4(358행)·
  R-CC-18(705~707행)의 "`3-error-handling.md §1.3` canonical" 인용도 원문과 정확히 일치.
- `rationale_continuity.md` — `spec/data-flow/12-workspace.md` 의 "기각된 대안 — 73개
  라우트에 `@Roles('viewer')` 부착"(333행)과 "멤버십 검증은 가드 1곳에서"(313행) 절 원문을
  확인, canary 코드 주석의 인용과 일치. `codebase/backend/src/common/decorators/
  workspace-reflection-canary.ts` JSDoc 이 실제로 `SetMetadata`+`Reflector` 대안을 명시적
  으로 기각 근거로 인용하고 있음도 확인.
- `rationale_continuity.md` — "코드가 인용한 WARNING #2/INFO #2 는 개별
  `14_01_15/rationale_continuity.md` 파일 순번으로는 WARNING #1/INFO #1, 같은 세션
  `SUMMARY.md` 통합 순번으로는 WARNING #2/INFO #2" 라는 주장을 두 파일 원문(개별 파일의
  발견사항 순서, `SUMMARY.md` 26~55행의 번호 표)으로 직접 대조 — 정확히 일치.
- `naming_collision.md` — `workspace-reflection-canary.ts` 가 `common/decorators/index.ts`
  에 barrel-export 되지 않는다는 주장을 `index.ts` 원문(4개 export 문, canary 미포함)으로
  확인. `system-status.e2e-spec.ts` 가 nil UUID(`00000000-0000-0000-0000-000000000000`)를
  `X-Workspace-Id` 헤더로 쓴다는 주장도 147행에서 직접 확인.
- `plan_coherence.md` — `plan/in-progress/auth-guard-reflection-hardening.md` 의 "후속 (이
  PR 밖)" 섹션이 정확히 3개 developer-scope 항목(README·fixture 공용화·메모이제이션
  트리거)과 별도 2개 planner-scope 항목으로 구성돼 있음을 plan 원문으로 확인 — INFO 서술과
  일치. `push + PR` 체크박스가 미완(`- [ ]`)임도 확인.

TODO/FIXME/HACK/XXX 주석은 5개 파일 어디에도 없음(grep 0건). 반환값·에러 시나리오·엣지
케이스 관점은 이 changeset 이 markdown 문서라 함수/분기가 없어 해당 없음 — 대신 "문서가
자신이 서술하는 실측 절차를 실제로 수행했는가" 를 반환값에 준하는 기준으로 삼아 위와 같이
검증했다.

## spec fidelity

이번 diff 는 `spec/**` 를 직접 변경하지 않는다(5개 checker 리포트 전부 정확히 동일하게
"spec_impact: none, 코드만 변경" 이라고 명시하며 이는 실제 git diff 와 일치). 리포트들이
spec 본문(§1.3, §5.3, §Rationale, R-CC-18 등)에서 인용한 문장·행을 위에서 line-level 로
대조했고 전부 정확했다. spec 문서 자체의 결함(예: WARNING 이 지적한 §1.3 카탈로그 공백)은
이미 `convention_compliance.md`/`cross_spec.md` 리포트가 스스로 WARNING 으로 정확히
등재했고 plan 도 "planner 턴 필요" 후속으로 넘겨 뒀다 — 이 reviewer 가 추가로 지적할 spec
드리프트는 없다(코드가 spec 을 어긴 것이 아니라 spec 이 아직 신규 케이스를 반영하지 않은
incompleteness 로, 이미 정확히 분류돼 있음).

## 요약

리뷰 대상은 `/consistency-check --impl-done spec/5-system/` 세션이 낸 5개 checker
리포트 + `meta.json` 이며, 이 문서들의 "의도한 기능" 은 (1) 자신의 agent 정의가 규정한
출력 형식으로 clean 하게 영속화되는 것과 (2) 인용한 코드·spec·plan·과거 리뷰 내용이
실제와 정확히 일치하는 것이다. (2)는 광범위한 실측 대조 결과 전부 정확했다 — 허구 인용,
spec 오독, plan 오독이 없었다. (1)에서 유일한 결함을 발견했다: `naming_collision.md`
가 checker-반환용 STATUS/구분자 스캐폴딩을 파일 본문에 그대로 남겨 같은 세션의 나머지
4개 파일과 형식이 어긋나고, 그 checker 자신의 "출력 형식" 정의를 위반한다(WARNING, 다운
스트림 정규식 기반 게이트는 영향받지 않는 것으로 확인). 그 외 반환값/에러 시나리오/엣지
케이스는 문서 changeset 특성상 실질적으로 해당 없음이며, TODO/FIXME 류 미완성 표식도
없다.

## 위험도

LOW
