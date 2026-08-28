# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**LOW** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 모두 CRITICAL·WARNING 0건. `plan_coherence` 가 plan 체크리스트 요약 한 줄의 사소한 미러 지연을 INFO 로 지적해 전체 위험도를 LOW 로 산정.

## 스코프 정정 (선행 확인, 5개 checker 공통)

이번 호출의 `target=spec/5-system/`(및 다수 `spec/**` 번들)로 전달됐으나, 5개 checker 전원이
독립적으로 `git diff origin/main` 을 실측해 **`spec/**` 변경이 0건**임을 확인했다. 실제 diff 는:

- `codebase/frontend/eslint.config.mjs` — 헤더 주석 갱신 (eslint 10 상향 차단자 "registry 기준 3개" → "우리 lockfile 기준 4개" 정정)
- `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts` (신규)
- `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts` (신규)
- `plan/in-progress/deps-peer-gating-and-eslint10.md` — plan 갱신 (`spec_impact: none`)
- `review/code/2026/08/28/23_20_05/**` — 직전 코드 리뷰 산출물

`spec/5-system/`(인증·에러 처리·API 컨벤션)이 규율하는 어떤 도메인 표면도 이번 diff 에 없어,
cross-spec / rationale-continuity / convention-compliance / naming-collision 4개 checker 는
모두 BYPASS 성격의 "충돌 후보 없음" 판정을 내렸다. `plan_coherence` 만 diff 와 직접 연결된
plan 문서(`deps-peer-gating-and-eslint10.md` §2)를 대상으로 실질 검토를 수행했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | `deps-peer-gating-and-eslint10.md` §2 체크리스트 상단 요약 줄이 "차단자 3개"(정정 이전 표현) 그대로 남아 4번째 차단자(`eslint-plugin-react-hooks` 7.0.1 exact 핀)를 언급하지 않음. 코드(`eslint.config.mjs` 헤더, `eslint10-unblock-guard.ts` 의 `BLOCKERS`)와 plan 본문의 `### ⚠️ 정정 (2026-08-28 후속 턴)` 절은 이미 4개로 일치 — 이 요약 한 줄만 미러가 뒤처짐 | `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 체크리스트 요약 항목("`eslint-config-next` 의 react/jsx-a11y/import 플러그인이…") | 해당 줄에 "(및 `eslint-plugin-react-hooks` — 아래 §정정 참조)" 포인터 추가로 두 체크리스트 미러 동기화. target(코드) 변경 불필요 |
| 2 | naming_collision | 이번 세션의 `_prompts/naming_collision.md`(및 다른 4개 checker 프롬프트 동일)가 `spec/5-system/` 전체를 번들해 왔으나 실제 diff 는 `codebase/frontend/src/lib/repo-guards/__tests__/` + plan 문서뿐 — orchestrator 의 target 스코프 추론이 실제 diff 와 어긋난 것으로 보임(과거 알려진 `feedback_impl_done_spec_bundle_bug` 패턴과 동형) | consistency-checker orchestrator 의 `--impl-done` 스코프 산정 로직 | 다음 라운드 재발 방지를 위해 orchestrator 가 diff-base 대비 실제 변경 파일 경로로 target 을 산정하도록 확인 권장. 본 세션은 이미 5개 checker 모두 실제 diff 기준으로 우회 처리해 기능적 영향은 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/**` diff 0건 — 비교 대상 없음, 충돌 후보 특정 불가 |
| rationale_continuity | NONE | diff 가 `spec/5-system/` 의 어떤 Rationale 도메인과도 교차하지 않음. 오히려 이전 실측 오류(#1219)를 새 실측으로 정정하는 프로젝트 지향 패턴에 부합 |
| convention_compliance | NONE | diff 가 `spec/conventions/**` 규율 대상(API/DTO/이벤트/에러코드/문서구조) 어디에도 해당 없음 |
| plan_coherence | LOW | plan §2 의 "차단자는 3개→4개" 정정을 코드가 그대로 집행 — plan 미해결 결정·타 plan 후속 항목과 충돌 없음. 유일 흠은 plan 체크리스트 요약 한 줄의 미러 지연(INFO) |
| naming_collision | NONE | 신규 식별자(`BLOCKERS`, `Blocker`, `readPeerRanges` 등) 전수 grep 결과 기존 코드베이스·spec·plan 어디와도 충돌 없음. 파일 배치도 기존 guard/test 쌍 컨벤션 준수 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical/Warning 없음) `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 체크리스트 요약 한 줄에 4번째 차단자(`eslint-plugin-react-hooks`) 포인터 추가 (선택적, target 코드 변경 불필요).
2. consistency-checker orchestrator 의 `--impl-done` target 스코프 산정 로직이 실제 diff 경로 대신 광범위한 spec 디렉터리를 번들하는 경향을 다음 라운드 전에 점검 (기능 영향 없는 프로세스 개선 항목).