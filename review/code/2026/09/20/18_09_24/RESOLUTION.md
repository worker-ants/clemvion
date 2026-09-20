# RESOLUTION — rotate lost-update (리뷰 2라운드, freshness)

1라운드(`review/code/2026/09/20/17_35_12`) 의 Warning 8건을 조치한 뒤, 코드가 바뀌었으므로 돌린 **fresh 라운드**다.
결과: **Critical 0 · Warning 2** — 둘 다 동작 결함이 아니고, 12명이 1라운드 조치의 유효성을 교차 확인했다.

## 조치 항목

| SUMMARY # | 발견 | 처분 | 근거 |
|---|---|---|---|
| WARNING 1 | 트랜잭션 블록 주석이 `plan/complete/rotate-lost-update.md` 를 인용하는데 plan 이 아직 `in-progress` 에 있다 | **plan 을 `plan/complete/` 로 이동**해 인용을 사실로 만든다 (이 커밋) | SUMMARY 의 제안 두 갈래 중 «plan 이 실제로 이동하는 시점에 맞춰» 쪽. 이 PR 은 어차피 10단계에서 plan 을 옮긴다 — 코드를 건드리지 않으므로 게이트 freshness 도 리셋되지 않는다. 인용은 `codebase/**` 의 한 곳뿐임을 grep 으로 확인했다(`integrations.service.ts:1165`; `CHANGELOG.md` 는 이미 디렉터리 없이 파일명만 쓴다) |
| WARNING 2 | 커밋 `f3ea25d02` 에 무관한 main Gate C 수정 1줄이 섞였다 | **조치 없음 — 1라운드에서 이미 처분** | 되돌리면 `spec-plan-completion.test.ts` 가 다시 실패한다(그 red 는 직전 PR #1367 이 심었고 이 PR 이 고쳤다). 2라운드 SUMMARY 도 «신규 결함 아님 · 추가 조치 불요» 로 적는다 |
| SPEC-DRIFT 1 | `spec/data-flow/5-integration.md` 의 rotate 서술이 새 잠금 메커니즘을 언급하지 않는다 | **트래커에 planner 후속으로 등재** (이 턴에) | 코드가 옳고 spec 서술만 뒤처진 형태다. `--impl-prep`(`review/consistency/2026/09/20/16_58_56`) cross_spec INFO 1 이 이미 «비차단 · `spec_impact: none` 유지 가능» 으로 처분했고, 2라운드도 «이미 유예된 선택 사항» 이라 적는다. `spec/` 는 developer 권한 밖이라 planner 턴이 필요하다 |
| INFO 6 | personal-scope 통합의 «본인 것만» 소유자 검증이 코드에 없다 | **트래커에 등재** (이 턴에) | `git show` 대조로 **이 PR 이전부터 있던 갭**임이 확인됐다(회귀 아님). 권한 모델 변경이라 별 PR |

## TEST 결과

- lint : 통과 (1라운드 조치 시점 · 이후 `codebase/**` 변경 없음)
- unit : 통과 (`integrations/` 19 suite / 567 test — 1라운드 조치 시점)
- build : 통과 (1라운드 조치 시점)
- e2e : **통과 367/367** (1라운드 조치 시점). 본 2라운드는 `codebase/**` 를 한 줄도 고치지 않았다 — plan 파일 이동뿐이라 재실행 대상이 없다.

> 판별력 실측은 1라운드 RESOLUTION 에 있다: 신규 테스트 둘은 각각의 뮤턴트에서만 RED 이고, e2e 는 `origin/main`
> 서비스로 되돌린 빌드에서 `key_name` 이 `X-Concurrent` → `X-Api-Key` 로 되돌아가며 RED 다.

## 보류·후속 항목

`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이 턴에 등재했다:

- (planner) `spec/data-flow/5-integration.md` rotate 서술에 `pessimistic_write` 재읽기 한 줄 — SPEC-DRIFT 1.
- (planner/developer) personal-scope 통합의 소유자 검증 부재 — INFO 6.

## 종결 판정

`codebase/**` 수정이 **0 인 라운드**에 도달했다 — 착수 전 선언한 정지 규칙 그대로다. 남은 둘은 (a) 동작 결함이 아니고
(b) 하나는 plan 이동으로 이미 닫혔으며 (c) 다른 하나는 권한 밖(spec)이라 planner 턴이 필요해 (d) 그 턴에 등재했다
(developer SKILL §수렴 예외 (a)–(d)).
