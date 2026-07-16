# RESOLUTION — rebase 후 재검토 (08_17_35)

대상 SUMMARY: `./SUMMARY.md` (LOW, Critical 0, Warning 2)
선행: `../01_07_43/`(LOW, W6) → `../01_27_10/`(fix 커버) → rebase(`origin/main` = `f8c334947` #957)

## 조치 항목

| SUMMARY # | 카테고리 | 판정 | 조치 | commit |
| --- | --- | --- | --- | --- |
| W#1 | Documentation | **fix** | CI job 이름 오기 정정 — `e2e-backend` → 실제 `e2e`(backend supertest). `PROJECT.md:36` · `.claude/test-stages.sh:122` 양쪽. 문서가 실존하지 않는 잡을 가리키면 근거를 확인하려는 독자가 헛수고한다 | `c1a4e5f` |
| W#2 | Side Effect | **fix** | `_retry_state.json` 을 **실측 기준으로 동기화** — 본 브랜치의 consistency 4 · code 3 세션 전부. 근인은 main 이 reviewer 를 `Agent` 로 직접 fan-out 하면서 orchestrator 의 `--update`/`--apply-routing` 을 호출하지 않은 것. 상태를 손으로 조작하지 않고 orchestrator CLI 로만 갱신했고, router 미호출 세션엔 **실제 선별 근거**를 `_routing_decision.json` 으로 기록해 `--apply-routing` 반영 | `c1a4e5f` |
| (W#2 파생) | Process | **fix** | W#2 조치 중 발견한 **`agents_forced` 화이트리스트 위반**(`../01_27_10/` 이 강제 7명 중 4명만 실행) → 누락 `security` **사후 실행 = risk NONE**(open-redirect 방어 경계 불변 확인). `requirement`·`scope` 는 본 세션이 `origin/main..HEAD` 전체 범위로 실행해 실질 커버. 경위·교훈을 `../01_27_10/NOTE-forced-whitelist-violation.md` 에 기록(은폐하지 않음) | `c1a4e5f` |

INFO 3건은 전부 "의도된 트레이드오프 / 확인 목적"으로 리뷰어가 명시 — 미조치.

## rebase 검증 결과

| 항목 | 결과 |
| --- | --- |
| 충돌 | **1건** — `plan/complete/ai-agent-tool-payload-budget-followups.md`. #957 이 **동일한 Gate C `spec_impact` 보정을 독립 수행**(4개 항목이 본 PR 의 git-diff 도출값과 완전 일치) → 본 PR 의 중복 커밋 `89c4b1f6b` 을 `--skip` 으로 drop(9→8 커밋) |
| 부수 효과 | 직전 리뷰의 scope WARNING("무관 plan 수정이 섞임")이 **자연 해소** — scope 리뷰어가 git 실측으로 확인 |
| 의미 충돌 | **없음** — #957 의 `9-user-profile.md` 수정은 264행(알림 각주), 본 PR 은 155행(§3 catch-all). 영역 분리 |
| 신규 가드 | #957 이 `spec-link-integrity` 를 강화(spec 본문의 `plan/**` 링크도 검사 → plan 이동 시 build 파괴). 본 PR 의 spec 은 `plan/**` 을 마크다운 링크로 걸지 않아 **무관** — 실측 통과 |
| SPEC-DRIFT | **해소** — 직전 W#1(SPEC-DRIFT)이 spec 반영(`aa01cf4f0`)으로 사라져 requirement 가 **Critical 0 / Warning 0 (NONE)** 판정 |

## TEST 결과

rebase 후 TEST WORKFLOW **전 단계 재수행** (1단계부터):

- **lint**: 통과
- **unit**: 통과 (#957 이 강화한 `spec-link-integrity`·완화한 `plan-frontmatter` 가드 포함)
- **build**: 통과
- **e2e**: 통과 — backend **256/256** + playwright **51/51**

> e2e 는 본 PR 이 고친 `run-test.sh e2e`(= `make e2e-test-full`) 로 수행 — 이제 wrapper 가 playwright 를 포함한다.

W#1·W#2 조치는 **문서·상태 파일 전용**(코드 변경 0)이라 재수행 불요이나, 커밋 후 `run-test.sh unit` 으로 가드를 재확인했다.

## 보류·후속 항목

| 항목 | 이관처 |
| --- | --- |
| sidebar 테스트 mock 보일러플레이트 공유 헬퍼 추출 (원 `../01_07_43/` W#4) | 후속 task — 기존 무관 파일(`sidebar.test.tsx`) 수정이 필요해 같은 리뷰의 W#2(범위 오염)와 상충 |
| `_retry_state.json` stale 재발 방지 | **구조적 갭** — main 이 Workflow 를 우회해 Agent 직접 fan-out 할 때마다 상태 기록 책임이 main 으로 넘어오는데 SKILL 문서가 이를 명시하지 않는다. 본 PR 은 산출물만 교정. 규약 보강은 harness 소유라 사용자 판단 필요 |
