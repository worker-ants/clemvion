# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(이미 병합된 별개 PR #1389 의 영구 리뷰 산출물을 이번 diff 안에서 소급 수정 — 값 자체는 안전하고 투명하게 disclosed 되었으나 plan 에 선언되지 않은 스코프 확장). 그 외에는 전부 INFO 수준으로, 실질 코드 변경(CI 워크플로 pathspec/실행범위 확장 + 신규 회귀 테스트)은 14개 reviewer 전원이 독립적으로 재검증(뮤턴트 재현, 명령 재실행)해 plan 의 처방·실측과 정확히 일치함을 확인했다. forced(router_safety) 화이트리스트 8명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope / side_effect | 이번 PR 의 diff 가 이미 병합되어 완결된 별개 PR(#1389, 커밋 `1a8ddca8b`)의 `--impl-done` 세션 산출물(`meta.json`)을 소급 수정한다. plan(`docs-guard-trigger.md`)은 이 파일을 전혀 언급하지 않아 스코프 밖 변경이다. 정정 자체(scratch 절대경로 → 저장소 상대경로, `scope_note` 로 원래 값 보존)는 안전하고 투명하게 disclosed 되었으며 `--impl-done` 게이트 토큰은 유지됨을 확인했다. | `review/consistency/2026/09/24/20_34_01/meta.json:3-4,12` | 이미 병합되어 되돌리기 어려우므로 추가 조치는 불요. 향후 재발 시 별도의 작은 커밋으로 분리하고 커밋 메시지/RESOLUTION 에 대상 PR 번호와 "스코프 밖 부수 수정"임을 명시하는 관례를 유지할 것(이번엔 RESOLUTION.md Warning 1 에 잘 기록됨). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance / architecture / side_effect / requirement / maintainability / dependency | "가벼운 대체 트리거"(단일 파일 → 디렉터리 전체 실행)라는 설계 불변식이 코드/테스트로 강제되지 않고 관례로만 유지된다. 향후 `src/lib/docs/__tests__/` 에 무거운(네트워크·긴 타임아웃) 테스트가 추가돼도 막을 방법이 없다. 현재는 실측(4.05초, 23파일/3567케이스)으로 유지됨을 다수 reviewer 가 독립 재현. | `.github/workflows/spec-link-checks.yml:115-118` | 이번 PR 스코프 밖. 후속으로 해당 디렉터리 실행시간 상한을 검증하는 하네스 테스트 검토. |
| 2 | architecture / side_effect | required-check 앵커 job id `spec-link-integrity` 가 실제로는 plan-frontmatter·spec-frontmatter·spec-pending-plan-existence 등 훨씬 넓은 책임을 대신 수행 — 이름과 실제 범위 불일치(SRP). `#1106` required-check 앵커 안정성 제약으로 즉시 개명이 어렵다는 트레이드오프가 헤더 주석에 명시됨. 1라운드 및 consistency `naming_collision` 에서 이미 포착된 사안의 재확인. | `.github/workflows/spec-link-checks.yml:93,118` | 조치 불요(설계 근거 문서화 완료). 잡 표시명("docs guards (src/lib/docs/__tests__ 전체)")으로 실제 스코프를 계속 노출. |
| 3 | architecture / maintainability | 워크플로 YAML 헤더 주석에 세 차례(도입 배경/#912, 2026-08-27, 2026-09-24) 사고 이력이 누적되어 전체 119줄 중 약 27~28%를 차지. 같은 갭이 세 번째 재발한 흔적. | `.github/workflows/spec-link-checks.yml:1-33` | 조치 불요(1라운드에서 이미 동일 처분). 장기적으로 이력을 별도 컨벤션 문서로 이관 고려. |
| 4 | architecture / maintainability / dependency / testing | 신규 회귀 테스트 `test_spec_link_checks_scope.py` 가 파서를 재구현하지 않고 sibling 모듈(`test_harness_checks_paths_coverage.parse_pathspecs_block`)을 직접 import — 의도된 재사용(재구현 시 drift 위험 회피)이나, 그 함수의 이름/반환형이 바뀌면 이 테스트도 함께 깨지는 결합이 생김. 순환 의존 없음 확인. | `.claude/tests/test_spec_link_checks_scope.py` (import 문) | 조치 불요. `parse_pathspecs_block` 리팩터링 시 이 파일이 소비자임을 함께 확인할 것. |
| 5 | maintainability / testing | `_docs_guard_run_commands` 의 스텝 선택이 `"--filter frontend test"` 부분 문자열 매칭 — 커맨드 인자 순서가 바뀌면 `runs` 가 빈 리스트가 되어 즉시(비침묵) 실패하지만 실패 메시지만으로 원인(스텝 소실 vs 패턴 낡음) 구분이 어려움. | `.claude/tests/test_spec_link_checks_scope.py:44-52` | 조치 불요(선택). 필요 시 스텝 이름으로 먼저 찾는 방식 고려. |
| 6 | architecture | 저장소 전역 문서 거버넌스 가드(`spec/**`, `plan/**` 등)가 `codebase/frontend` 패키지 테스트 트리에 물리적으로 결합돼 있고, 디렉터리째 실행으로 그 결합이 더 굳어짐. | `.github/workflows/spec-link-checks.yml:110-118` | 이번 PR 범위 밖. 후속으로 별도 workspace 추출 여부 검토. |
| 7 | testing | pathspec 테스트가 실제 git pathspec 매칭 규칙(`**` 가 `/` 를 넘는지 등)까지는 검증하지 않고 리터럴 문자열 존재만 확인 — 다만 그 세부 규칙은 `test_ci_paths_changed.py` 가 이미 커버해 중복 회피 목적의 의도된 스코프 분리. | `.claude/tests/test_spec_link_checks_scope.py:56-65` | 조치 불요. |
| 8 | documentation | plan 체크리스트의 하네스 통과 개수(1138)가 RESOLUTION 조치 이후 현재 실측치(1140)와 다름 — 조치 이전 시점의 이력 기록이라 오도 가능성은 낮고 최종 근거는 `RESOLUTION.md` 에 정확히 남아 있음. | `plan/in-progress/docs-guard-trigger.md` (하네스 가드 통과 문장) | 조치 불요(경미). 원하면 "(RESOLUTION 이후 1140)" 괄호 추가. |
| 9 | requirement | plan 체크리스트의 `[ ] /ai-review`, `[ ] 트래커 항목 체크 + complete/ 이동` 이 아직 미체크 — 이 리뷰 자체가 그 항목 수행 중이므로 정상. | `plan/in-progress/docs-guard-trigger.md` 체크리스트 | 조치 불요, plan 종결 커밋에서 체크박스+`complete/` 이동을 함께 처리. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인증/인가·암호화 등 전 카테고리 해당 없음. CI 워크플로 `permissions`/트리거 변경 없음, `run:` 은 정적 문자열뿐. |
| performance | NONE | 애플리케이션 런타임 코드 없음. CI 트리거 확대·실행시간 증가는 의도된 실측 트레이드오프(INFO). |
| architecture | LOW | job id 이름-책임 불일치, "가벼운 트리거" 불변식 미강제, 문서 거버넌스가 frontend 패키지에 결합, 헤더 이력 누적 — 전부 INFO, 신규 구조적 결함/순환 의존 없음. |
| requirement | NONE | plan 처방과 line-level 일치, 실측(pathspec 전이, 4.05초/23파일/3567케이스, pytest 1140) 독립 재현 성공. |
| scope | LOW | WARNING 1건 — 이미 병합된 별개 PR(#1389) 산출물 소급 수정이 plan 미선언 스코프. 핵심 변경은 plan 스코프 내. |
| side_effect | LOW | 전역상태·시그니처·API·환경변수·네트워크 부작용 없음. job id 범위 확대, 트리거 디렉터리 결합, #1389 소급 수정(INFO, scope 의 WARNING 과 동일 사실) 기록. |
| maintainability | NONE | 실코드 2파일 모두 짧고 단일 책임, 기존 하네스 컨벤션(공유 파서 재사용) 준수. INFO 3건(헤더 누적, 부분문자열 매칭, docstring 길이). |
| testing | NONE | 신규 회귀 테스트를 scratch 뮤턴트 2종으로 독립 재현 — RESOLUTION 주장이 공허하지 않음 확인. INFO 2건(매칭 방식, pathspec 세부규칙 스코프 분리). |
| documentation | NONE | 1라운드 Warning 2건(헤더 stale, CHANGELOG 누락) 조치 완료 재확인. INFO 1건(plan 체크리스트 테스트 개수 stale). |
| dependency | NONE | 패키지 매니페스트 변경 없음. 신규 테스트의 sibling 모듈 import(INFO)만 존재, 순환 의존 없음. |
| database | NONE | DB 관련 코드 전무. |
| concurrency | NONE | 스레드/락/공유 가변 상태 대상 코드 없음. |
| api_contract | NONE | API 엔드포인트/DTO/라우트 변경 없음. |
| user_guide_sync | NONE | doc-sync-matrix 22개 trigger 매칭 0건, 동반 갱신 누락 없음. |

## 발견 없는 에이전트

security, performance, requirement, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (전부 Critical/Warning 없음 — INFO 또는 완전 무발견)

## 권장 조치사항
1. (선택) `review/consistency/2026/09/24/20_34_01/meta.json` 소급 수정 건은 이미 병합되어 되돌릴 필요는 없으나, 향후 유사 상황에서는 별도 커밋/PR 로 분리하고 대상 PR 번호를 명시하는 관례를 계속 유지한다.
2. plan `docs-guard-trigger.md` 종결 시 체크리스트 항목(`/ai-review`, 트래커 체크+`complete/` 이동)을 이번 SUMMARY 확인 후 함께 처리한다.
3. 그 외 INFO 항목들은 즉시 조치 불요 — 대부분 이번 PR 스코프 밖의 후속 검토 사안으로 이미 근거 문서(plan §B/§C, 워크플로 헤더 주석)에 트레이드오프가 기록되어 있다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 전수 실행(skipped 없음).
- **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — 전원 결과 확보됨(forced 화이트리스트 미이행 없음).
- **실행**: 전체 14명 (security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync) — 전원 success, 인라인 전문 확보.
- **제외**: 없음.
