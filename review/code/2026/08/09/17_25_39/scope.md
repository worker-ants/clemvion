STATUS=success scope review complete (24 files)
===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — backend typecheck gap / backend-checks CI

## 발견사항

- **[WARNING]** `deleteByPrefix()` LIKE 메타문자 거부 기능이, plan 이 스스로 "이 PR 밖" 이라 못 박은 채로 이번 PR 에 함께 실렸다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:174` (헤딩 `### deleteByPrefix() LIKE 메타문자 미이스케이프 (ai-review INFO, 이 PR 밖)`), 실제 코드는 `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:169-174`(신규 guard) + `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts:236-272`(신규 `it.each` 테스트 2블록)
  - 상세: 이 diff 의 나머지 전부(`.claude/tests/test_backend_typecheck_ratchet.py`, `scripts/check-backend-typecheck-ratchet.py`, `scripts/backend-typecheck-baseline.json`, `.github/workflows/backend-checks.yml`, 관련 가드 3곳 등록, 5개 `*.spec.ts` 의 TS2554/TS2304 drift 수정)는 "backend 테스트 코드가 어떤 게이트에서도 타입체크되지 않는다" 는 하나의 이슈로 수렴한다. 반면 `deleteByPrefix()` LIKE 메타문자(`%`/`_`/`\`) 거부는 **과다 삭제(over-deletion) 방지**라는 별개의 보안 성격 결함이고, 타입체크 gap 과 아무 인과관계가 없다 — ratchet 대상 파일 목록에도, TS2554/TS2304 stale 10건 목록에도 이 파일은 등장하지 않는다. plan 문서는 이 항목을 명시적으로 "(ai-review INFO, 이 PR 밖)" 이라 표시했고 원래 처리 항목도 "> 현재 호출부는 신뢰 가능한 내부 문자열만 쓰는 것으로 보고됐다. lint 정리 PR 범위 밖이라 등재만 한다." 였다. 그런데 이번 세션에서 체크박스가 `[x]` 로 채워지고 프로덕션 코드 변경 16줄 + 신규 테스트 41줄이 이 PR 에 실제로 포함됐다 — 즉 스코프 판단이 뒤집혔는데, 그 뒤집힌 결정이 헤딩 문구("이 PR 밖")에는 반영되지 않아 문서와 실제 diff 가 서로 모순한다. 코드 자체의 품질(가드·양방향 테스트·Rationale 주석)은 흠잡을 데 없지만, "typecheck gap 대응" 이라는 이 PR 의 단일 목적에 무관한 프로덕션 동작 변경(입력 거부로 인한 예외 발생 가능성 신설)이 별도 review 없이 같은 diff 에 묻힌 것은 리뷰 가능성·revert 단위 관점에서 scope 위반이다.
  - 제안: 별도 PR 로 분리하거나(원래 방침대로), 이번 PR 에 포함하기로 최종 결정했다면 plan 헤딩의 "(ai-review INFO, 이 PR 밖)" 문구를 "(이 PR 에 포함, 근거: …)" 로 갱신해 문서-diff 불일치를 없앨 것.

- **[INFO]** "§부수 발견 — spec 파일이 타입체크되지 않는다 (별 항목, 이 PR 밖)" 헤딩이 실제로는 이 PR 의 핵심 내용이 됐다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:138`
  - 상세: 이 헤딩도 "별 항목, 이 PR 밖" 이라 적혀 있지만, 그 아래 체크리스트(`ratchet` 승격 결정·`backend-checks.yml` 신설 등, :154-172)가 이번 diff 의 사실상 전부를 차지한다. 위 WARNING 과 달리 이건 실제로 "이 PR 의 목적"과 인과적으로 강하게 연결돼 있어(타입체크 gap을 막다 보니 ratchet 이 필요해졌고, ratchet 을 게이트로 승격하려니 CI 자체가 없었다는 연쇄 발견) scope 위반으로 보기는 어렵다 — 다만 헤딩 문구가 stale 해서 다음에 이 plan 을 읽는 사람이 "이 PR 밖" 이라는 문구만 보고 오판할 수 있다.
  - 제안: 헤딩을 "본 PR 의 핵심 작업으로 승격" 등으로 갱신.

## 요약

diff 24개 파일 중 대다수(신규 ratchet 스크립트/테스트/baseline, `backend-checks.yml` 신설과 3곳의 가드 등록, `harness-checks.yml` paths 보강, README 갱신, `consistency-check --impl-prep` 산출물, 5개 `*.spec.ts` 의 TS2554/TS2304 drift 수정)는 "backend `*.spec.ts` 가 어떤 게이트에서도 타입체크되지 않는다" 는 단일 문제와 그 해소로 정확히 수렴하며, plan 문서의 실측·근거·결정 기록과도 1:1 로 대응한다 — 포맷팅 노이즈나 무관한 리팩토링, 불필요한 import/주석 변경은 발견되지 않았다. 유일한 실질 스코프 이탈은 `secret-resolver.service.ts` 의 `deleteByPrefix()` LIKE 메타문자 거부 기능으로, plan 자신이 "이 PR 밖" 이라 명시했던 별개 보안 결함이 문서 문구는 갱신되지 않은 채 이번 diff 에 프로덕션 코드 변경 + 신규 테스트로 포함됐다. 구현 품질 자체는 문제없으나 PR 목적과 무관한 동작 변경이 섞였다는 점에서 WARNING 으로 지적한다.

## 위험도
MEDIUM
