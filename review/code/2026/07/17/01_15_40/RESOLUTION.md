# RESOLUTION — ai-review 2026-07-17 01_15_40

> 대상: `origin/main..HEAD` (⑥⑦⑧ + ⑨ 일부 = `f0f46c329`·`1dafe557f`·`9adb5c241`)
> 결과: **RISK LOW / Critical 0 / Warning 2 / INFO 7** → Warning 2건 전부 fix.
> router: 6명 실행(전원 `router_safety` 강제) / 8명 제외. **본 세션은 `plan-frontmatter.test.ts` 가드 완화를 리뷰 대상에 포함시키기 위해 `testing`·`scope`·`maintainability`·`side_effect` 를 명시 강제**했다 — orchestrator 의 자동 forced 목록이 이번엔 `documentation`·`requirement` 만 잡았으나, 실질 코드 변경(테스트 가드 임계 완화)은 정확히 testing/scope 관점의 검토가 필요한 종류였기 때문.

## 처리 결과

| # | 카테고리 | 발견 | 처분 | 근거 |
|---|---|---|---|---|
| W1 | requirement | `review/consistency/2026/07/17/00_35_59/SUMMARY.md` 가 커밋된 상태에서 `rationale_continuity` 를 "재시도 필요·내용 미확보" 로 표기 — **같은 커밋 안의 복구된 `rationale_continuity.md`(WARNING 1+INFO 2, Critical 0) 와 모순**. SUMMARY 만 읽는 감사자가 "권장 조치 미이행" 으로 오판 | **fix** | 정확한 지적. `00_17_40` 에는 최종 판정 주석을 달았으면서 `00_35_59` 에는 누락한 **내 불일치**였다. SUMMARY 상단에 "✅ 최종 확정 — 5개 전수 확보 · Critical 0 · BLOCK: NO" 주석 추가(원 본문은 시점 기록으로 보존, `_retry_state.json` `_final_state_note` 와 동일 취지) |
| W2 | maintainability | 매직넘버 485/128/161 이 SoT 링크 없이 6곳 이상 중복 하드코딩 — **이번 diff 가 정정한 "~180 화석 drift" 와 동일한 재발 패턴** | **fix** | 뼈아프지만 정확한 지적 — 화석을 고치면서 같은 구조의 화석을 새로 심을 뻔했다. 인용처 전수 감사 후 **SoT 각주 누락 3곳** 보강: `1-ai-agent.md:49`(내가 이번에 추가한 인용), `0-overview.md:80`(기존 161), `2-navigation/4-integration.md:684`(기존 161). 이제 485/161 인용 **8곳 전부** 가 SoT 링크(`4-cafe24.md §지원 범위` / `5-makeshop.md`) 또는 "2026-07-17 실측" 각주를 보유 |

## INFO (조치 불요 — 판단 기록)

| # | 카테고리 | 발견 | 판단 |
|---|---|---|---|
| I1 | scope | 8~9개 plan-closure 주제가 5개 커밋에 담겨 원자적 개별 롤백이 어려움 | **의도된 것**. 사용자가 "1~5는 하나의 PR로" 를 명시 지시했고 plan-lifecycle §3 이 "plan 이동만 담은 별 PR 분리 금지" 로 이 형태를 요구한다. 각 주제가 ①~⑨ 번호·근거·consistency 세션 인용으로 분리돼 reviewer 도 "통상 의미의 숨겨진 스코프 확장은 아님" 으로 판정 |
| I2 | scope (W1 in 세션) | 커밋 `9adb5c241` 제목이 ⑦⑧만 표방하나 ⑨ 일부(plan-only)가 섞임 | **타당한 지적이나 소급 수정 불가**(이미 커밋). 커밋 **본문에는 "⑨ 일부 (plan-only)" 로 명시 disclose** 돼 있어 은닉은 아니다. 향후 유사 grooming 에서는 커밋 제목에 포함 주제를 전부 표기하도록 유의 — 본 RESOLUTION 에 교훈으로 기록 |
| I3 | side_effect | `_retry_state.json`/`meta.json` 에 로컬 워크트리 절대경로 하드코딩 | reviewer 판정대로 **기존 관례와 동일·신규 리스크 아님**. orchestrator 산출물 형식이라 본 PR 이 바꿀 대상 아님 |
| I4 | side_effect | `11-mcp-client` status 승격 / `pending_plans` 재배선 / 링크 정정이 build 가드 방어용으로 **실측 검증됨** | 확인 완료 (조치 불요) |
| I5 | maintainability | Rationale 앵커 명명 규약 부재 — `R-N`/`R-<도메인>-N`/`R-wontdo-<slug>` 3계열 공존 | **이월**. 이번에 신설한 `R-wontdo-async-fanin` 은 reviewer 도 "기존 선례를 정확히 따름" 으로 판정(consistency `00_55_57` W4 반영 결과). 규약 문서화 자체는 본 PR 범위 밖의 별건 |
| I6 | maintainability | `0-overview.md` 표 셀의 긴 인라인 경고로 스캔 가독성 저하 | **의식적 trade-off**. consistency `00_35_59` plan_coherence WARNING#2 가 "규모만 병기하면 §6.1 만 읽고 제약을 알 수 없다" 며 **각주 추가를 요구**했고, 그 요구와 셀 간결성은 상충한다. 안전(제약 인지) 쪽을 택했다 — 두 checker 의 상반된 선호 중 "잘못된 설정으로 런타임 실패" 를 막는 편을 우선 |
| I7 | maintainability | 리뷰 산출물 "상세" 가 초장문 단일 문단 | checker 산출물 템플릿 문제로 본 PR 범위 밖(비차단) |
| I8 | requirement | 본 세션 스코프(35파일)가 `review/**`+`spec/**` 라 같은 커밋의 `plan/**` 변경분이 리뷰 대상에서 제외됨 | reviewer 가 **`git show` 로 직접 대조해 "주장과 정확히 일치" 확인**(spec-drift 처분 (1)(2)(3) `[x]`·383 vs 485 레이어 구분·merge.md P1→P3 갱신·`(product-decision)` 승계). 기능적 결함 아님 |
| I9 | testing | `codebase/**` 변경 0건이라 "신규 코드 테스트" 관점 해당 없음 | **주의**: 이 판정은 본 세션 스코프 기준이다. 실제로는 `plan-frontmatter.test.ts` 가드 완화가 `9adb5c241` 에 포함돼 있다(아래 §가드 완화 참조) |

## §가드 완화 — `plan-frontmatter.test.ts` (본 PR 의 유일한 실질 코드 변경)

- **무엇**: `expect(plans.length).toBeGreaterThan(20)` → `toBeGreaterThan(5)`.
- **왜**: grooming 으로 top-level in-progress plan 이 정확히 **20** 이 되어 발화. 이 단언의 목적은 **자기 주석이 밝히듯** "repoRoot() misresolve → 빈 스캔 → vacuous pass 방지" 이지 "plan 이 20개 초과여야 한다" 는 불변식이 아니다. 임계가 실제 개수에 붙어 있어 **plan 을 닫을 때마다 깨지는 구조**였다(같은 파일의 다른 주석이 이미 "특정 plan 파일명 의존 → complete 이동 시 fragility" 를 경계하고 있는데, 개수 의존은 같은 함정의 변형).
- **안전성**: 하한을 5로 낮춰도 원 목적(빈/오스캔 검출)은 그대로 달성된다 — misresolve 시 0건이 되므로. discovery 가 `.md` 만·`plan/in-progress/` 경로만 반환하는지 검사하는 **다른 단언 2개는 무변경**이라 sanity 자체는 유지된다.
- **검토**: 본 세션에서 `testing`·`scope`·`maintainability`·`side_effect` 를 명시 강제해 이 변경을 리뷰 범위에 포함시켰고, **네 reviewer 모두 이 완화에 대한 Critical/Warning 을 제기하지 않았다**.

## 검증

- **TEST WORKFLOW (리뷰 前 수행 — gate 재무장 회피)**: lint **PASS** / unit **PASS**(5스택) / build **PASS** / e2e **PASS (256)**.
- **docs 가드** (W1·W2 fix 후 재확인): 18 파일 **2582 passed**.
- **consistency-check 3세션**: `--spec 00_35_59`(⑥) **BLOCK: NO**·Critical 0·WARNING 6 전부 반영 / `--impl-done 00_17_40` **BLOCK: NO**(전수 확보 후)·Critical 0 / `--spec 00_55_57`(⑦⑧) **BLOCK: NO**·Critical 0·WARNING 4 전부 반영.

## 비고 — harness 이슈 (본 PR 결함 아님)

**Workflow FS-write flakiness 3세션 연속 재현**: 본 세션도 6개 중 3개(`requirement`·`testing`·`documentation`)가 `status=success` 반환 후 `output_file` 미기록. 매번 **재실행 대신 workflow journal 에서 원문 복구**해 전수 확보했다(토큰 이중 소모 + 결과 비결정성 회피). 누적 관측: consistency `23_36_57`(2/5) · `00_17_40`(3/5) · `00_35_59`(1/5) · ai-review `00_03_00`(3/7) · `01_15_40`(3/6). **`status=success` 와 디스크 상태의 불일치가 상시적**이므로, 이 harness 를 쓰는 후속 작업은 반드시 `ls` 로 대조하고 누락 시 journal 복구를 우선할 것.
