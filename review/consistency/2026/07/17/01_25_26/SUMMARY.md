# Consistency Check 통합 보고서 — `--impl-done spec/2-navigation/`

**모드**: 구현 후 사후 검토 (`--impl-done spec/2-navigation/ --diff-base origin/main`)
**대상 diff**: `origin/main..HEAD` — 사용자 가이드(`/docs`) 무한 중첩 라우팅 fix
**관련 plan**: `plan/in-progress/user-guide-routing-loop-fix.md`, `plan/in-progress/spec-update-catch-all-terminal-contract.md`

**BLOCK: NO** — 5/5 checker 전수 확보, **Critical 0건**.

> **커버리지**: 1차 workflow 반환은 5개 전원 `status=success` 였으나 `naming_collision` 을 뺀
> **4개의 output_file 이 디스크에 미생성**(알려진 비결정적 FS-write flakiness). `ls` 대조로 부재를
> 확인하고 4개를 `Agent` tool 로 직접 재호출해 전수 확보했다. 1차 workflow 의 `BLOCK: YES` 는
> 실제 위배가 아니라 **이 커버리지 갭 자체를 차단 사유로 표기한 것**이었고, 전수 확보 결과
> Critical 0 으로 확정되어 **BLOCK: NO** 로 하향한다.

## 전체 위험도
**LOW** — Critical 0건. WARNING 1건은 `spec/` 문서 수정이 필요한 항목(developer 권한 밖)이라
project-planner 위임 draft 에 반영표로 추가 완료. 구현 자체의 spec 위배는 없다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 조치 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `_layout.md`·`9-user-profile.md`·`10-auth-flow.md` 의 frontmatter `code:` 가 본문에서 **명시적으로 약속하는** catch-all(`(main)/[...rest]/page.tsx`)·href 헬퍼(`lib/workspace/href.ts`)를 가리키지 않음. **build gate 는 green** — 각 글로브가 다른 파일로 ≥1 매치해 `spec-code-paths.test.ts` 가 통과하므로 **가드가 못 잡는 완결성 갭**이다 | `spec/2-navigation/_layout.md` §2.2(line 85·126), `9-user-profile.md` §3(line 155), `10-auth-flow.md` §7.2 | `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = "본 spec 이 약속한 surface 의 구현 경로") | **위임** — developer 는 `spec/` 쓰기 불가. `plan/in-progress/spec-update-catch-all-terminal-contract.md` **제안 4** 로 문서별 추가 경로 반영표 작성 완료. 본 PR 차단 사유 아님(가드 green, 기존 문서의 누적 갭) |

## 참고 (INFO) — 발췌

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | plan_coherence | catch-all terminal 계약의 spec 반영이 project-planner 위임 대기 중 — "정상 추적 중이며 본 PR 차단 사유 아님" | draft 로 추적 중 |
| 2 | naming_collision | "terminal" 용어가 두 도메인에서 교차 사용(라우팅 종결 vs `4-execution-engine.md` 등의 실행 상태 terminal, 100회+). 파일·문맥 분리 + 자연어 의미 일치로 실질 혼동 낮음 | project-planner 가 spec 반영 시 disambiguation 각주 검토(선택) |
| 3 | convention_compliance | CHANGELOG 제목의 spec 참조 병기 스타일 | 선택 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Critical/Warning 0. 구현이 다른 영역 spec 과 충돌 없음 (INFO 4) |
| rationale_continuity | LOW | Critical/Warning 0 — 기각된 대안의 재도입·합의 원칙 위반 없음. catch-all 계약 확장은 인지·문서화·위임 완료 상태 (INFO 4) |
| convention_compliance | LOW | `code:` 글로브 완결성 갭 1건(WARNING, 위임 처리). 그 외 규약 준수 (INFO 1) |
| plan_coherence | LOW | Critical/Warning 0 — plan 이 spec 근거·코드 상태와 일치, 후속 항목 정상 추적 (INFO 1) |
| naming_collision | NONE | 신규 식별자 `workspaceScoped`·`WORKSPACE_ROUTE_SEGMENT` 전수 검증, 충돌 없음 (INFO 1) |

## 권장 조치사항

1. **(위임, 본 PR 밖)** project-planner 가 `spec-update-catch-all-terminal-contract.md` 의
   제안 1·2(terminal 계약 명문화)·**제안 4**(`code:` 글로브 보강)를 spec 본문에 반영.
2. (선택) 반영 시 "terminal" 용어의 도메인 구분 각주 추가 검토 (naming_collision INFO).

> 본 PR 은 **BLOCK: NO** — 구현의 spec 위배 0건. 위 항목은 전부 `spec/` 문서 갱신으로
> developer 권한 밖이며, 정식 위임 경로(draft → project-planner)로 추적 중이다.
