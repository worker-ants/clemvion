# 변경 범위(Scope) 리뷰 — audit-record-factory (2026-09-01 16:29:11, 5라운드)

## 검토 방법

`origin/main...HEAD` 누적 diff(`codebase/` 8파일 + `spec/`·`plan/` 7파일, `review/**` 다수)
전체를 대상으로 하되, 1~4라운드 scope 리뷰(`14_31_12`·`15_10_38`·`15_25_56`·`15_49_24`)가 이미
`codebase/` 8파일과 초기 spec 3파일 반영 경로를 LOW 로 수렴시켰으므로, 이번 라운드는 (a) 그
수렴이 현재 워킹트리에서도 유지되는지 재확인하고 (b) 4라운드 이후 새로 추가된 유일한 커밋
(`a09b4aee6`, "실측 12종" → "10종" 정정)이 자신이 주장하는 범위를 벗어나지 않는지 집중 검토했다.

```
git diff --stat origin/main...HEAD -- codebase/   →  8 파일, 4라운드와 동일(신규 코드 diff 없음)
git diff --stat origin/main...HEAD -- spec/ plan/  →  7 파일(신규 3: expression-engine 발견 문서 ·
                                                        spec-draft-audit-resource-type-count.md ·
                                                        (plan/complete 정정 노트는 기존 파일 수정))
git status --short                                 →  이 세션 산출물(review/code/.../16_29_11/) 외 없음
```

## 발견사항

- **[INFO]** 5라운드 유일 커밋(`a09b4aee6`)이 자기 own 오기산("실측 12종") 정정에 정확히 국한됨 — 확인
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:172-181`
    (`recordAuditWriteFailed` JSDoc "왜 클램핑인가" 절), `spec/5-system/_product-overview.md`
    NF-OB-07 카탈로그 표, `spec/data-flow/1-audit.md`(§1.1 "8개 위치" → "12개 위치" 동반 정정),
    `plan/in-progress/spec-sync-auth-gaps.md`, `plan/complete/spec-draft-audit-write-failed-metric.md`
    (봉인 문서에 원문 보존 + 정정 노트 추가), 신규 `plan/in-progress/spec-draft-audit-resource-type-count.md`
  - 상세: 커밋 diff 전량(24파일 중 `codebase/` 는 JSDoc 문자열 1곳뿐, 나머지는 `plan/`·`spec/`·
    `review/consistency/**` 문서)이 "12는 producer 파일 수였지 라벨 카디널리티가 아니었다" 는 단일
    사실 정정으로 수렴한다. `spec/data-flow/1-audit.md` 의 "8개 위치→12개 위치" 동반 수정도 무관한
    확장이 아니라, 커밋 메시지·`spec-draft-audit-resource-type-count.md` 양쪽이 "같은 changeset
    안의 인접 문서에서 같은 종류(세는 대상의 교체)의 오기산을 게이트가 하나 더 찾아 함께 고쳤다"고
    명시적으로 근거를 남기고 있다. `spec/` 쓰기는 CLAUDE.md 의 좁은 developer 자가정정 예외(예고·
    트리거 문장에 한정) 에 해당하지 않는 "사실 서술(카탈로그 값)"이라 스스로 판단해 `--spec` 게이트
    (`16_16_39`, BLOCK:NO)를 거쳐 정규 planner 경로로 처리했다 — 우회 없음.
  - 제안: 없음 — 정상 범위.

- **[INFO]** 같은 커밋에 감사 로깅과 무관한 "부수 발견"(expression-engine 사전 결함)이 새 plan
  문서로 번들됨
  - 위치: `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` (신규 파일, 62줄)
  - 상세: `run-test.sh unit` 의 `codebase/packages/expression-engine` 잡이 `origin/main` 에서부터
    깨져 있다는 발견을 이 커밋(`a09b4aee6`)에 함께 실었다. 이 PR 의 changeset 주제(감사 액션
    바인딩·적재 실패 관측)와 직접 관련은 없으나, ① `codebase/packages/` 는 전혀 건드리지 않고
    문서 등재만 했고, ② 이 저장소에 이미 확립된 선례(`backend-lint-gate-broken-on-main.md`,
    2026-08-08 사용자 결정: main 선재 breakage 는 별 PR 로 분리)를 명시적으로 인용해 그대로 따랐으며,
    ③ 커밋 메시지에 "부수 발견"으로 별도 소제목을 붙여 본 작업과 분리해 서술한다. 이전 라운드
    scope 리뷰들이 반복 지적한 "두 관심사를 한 커밋에 번들"과 같은 패턴이지만, 이번엔 코드를 전혀
    건드리지 않는 순수 문서 등재이고 우회 목적이 아니라 게이트 실행 중 우연히 발견된 것이라
    실질 위험은 낮다.
  - 제안: 조치 불필요. 다음에 유사한 발견이 생기면 별도 커밋으로 분리하면 리뷰 가독성이 좋아지나,
    차단 사유는 아니다.

- **[INFO]** 1~4라운드가 확정한 `codebase/` 8파일 diff 는 이번 라운드에서 추가 변경 없이 그대로 유지됨
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`,
    `audit-logs.spec.ts`, `auth-configs/auth-configs.service.ts`,
    `metrics/business-metrics.service.{ts,spec.ts}`,
    `repo-guards/__tests__/audit-action-binding-{fixture,guard,binding.spec}.ts`
  - 상세: `git diff --stat origin/main...HEAD -- codebase/` 결과가 4라운드(`15_49_24`) 시점과
    파일 목록·변경 라인 수 동일(8파일, 598 삽입/7 삭제). 5라운드가 유일하게 건드린 코드 라인은
    위 JSDoc 문자열 1곳뿐이라, 앞선 4라운드의 scope 판정(무관 리팩터·포맷팅·주석 잡음·불필요
    임포트 없음)이 그대로 유효하다.
  - 제안: 없음.

- **[INFO]** `review/code/**`·`review/consistency/**` 프로세스 산출물이 누적 diff 파일 수의
  절반 이상을 계속 차지함 — 재확인, 변화 없음
  - 위치: `review/code/2026/09/01/{14_31_12,15_10_38,15_25_56,15_49_24}/**`,
    `review/consistency/2026/09/01/{15_00_54,16_02_03,16_16_39}/**`
  - 상세: 1~4라운드 scope 리뷰가 이미 같은 지적을 INFO 로 남겼고 이번 라운드도 동일 결론이다 —
    이 저장소 관례상 `review/code/**`·`review/consistency/**` 는 커밋 대상이 정상이며(`CLAUDE.md`
    정보 저장 위치 표), 각 산출물이 자신을 낳은 코드/spec 커밋과 시간순으로 짝지어 있어 은폐된
    확장이 아니다.
  - 제안: 조치 불필요.

## 요약

4라운드에 걸쳐 이미 LOW 로 수렴한 `codebase/` 8파일 diff 는 이번 라운드에서 추가 변경 없이
그대로 유지됐다. 5라운드의 유일한 신규 커밋(`a09b4aee6`)은 자신이 이전 라운드에 spec/JSDoc/plan
세 곳에 심어 둔 "실측 12종" 오기산을 `--impl-done` 게이트가 잡은 뒤 "10종"으로 정정하는 작업에
정확히 국한됐고, 인접 문서(`1-audit.md`)의 같은 종류 오기산을 게이트가 추가로 찾아 함께 고친 것도
근거가 명시돼 있어 무관한 확장이 아니다. 유일하게 눈에 띄는 점은 감사 로깅과 무관한
expression-engine 사전 결함 발견을 같은 커밋에 문서로만 등재한 것인데, 코드를 건드리지 않고
확립된 선례를 따른 처분이라 실질 위험은 낮다. 무관한 리팩토링·포맷팅 잡음·불필요한 임포트·의도치
않은 설정 변경은 이번 라운드에서도 발견되지 않았다.

## 위험도

NONE
