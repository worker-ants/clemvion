# 변경 범위(Scope) 리뷰 — audit-record-factory (2026-09-01 16:53:16, 6라운드)

## 검토 방법

`origin/main...HEAD` 누적 8개 커밋을 전수 확인했다. 이전 5라운드(`14_31_12`~`16_29_11`)가
이미 scope 관점에서 LOW 로 수렴한 이력이 있어, 이번 라운드는 (a) 그 수렴이 유효한지 재확인하고
(b) **5라운드 이후 새로 추가된 유일한 커밋**(`4b15f0393`, "리뷰 5R")이 5라운드 SUMMARY 의
WARNING 2건(W1 `findUnboundHelpers` 좁은 술어, W2 완료 draft 잔류) 범위에 정확히 대응하는지를
`git show`/`git diff` 로 직접 대조했다. 저장소를 뮤테이션하지 않았다 — `git status --short`
결과 이번 세션 산출물(`review/code/2026/09/01/16_53_16/`) 외 변경 없음.

```
git log --oneline origin/main..HEAD   →  8 커밋
9a2e860dc 감사 액션 바인딩 구멍 + 삼킨 적재 실패를 보이게 (팩토리는 가드로 대체)
4a65b12c6 리뷰 1R — 신설 메트릭 구현이 어느 테스트도 실행하지 않았다
04b68d352 docs(spec): NF-OB-07 등재 + "로그로만 남는다" 정정
1b7334098 리뷰 2R — 내 삽입이 기존 설명을 원래 대상에서 떼어놨다
86bd4bd90 리뷰 3R — 나는 존재하지 않는 문서를 근거로 댔고, 그게 실재하는 구멍을 덮었다
d3c4e7d20 docs(review): 4R 수렴 — 거짓 주장의 원출처까지 정정
a09b4aee6 "실측 12종" 정정 — 12는 라벨 값이 아니라 producer 파일 수였다
4b15f0393 리뷰 5R — 내 근거도, 리뷰어의 반증도 틀렸다. 캐너리가 아니라 호출부가 잡고 있었다
```

## 발견사항

- **[INFO]** 5라운드 fix 커밋(`4b15f0393`)은 직전 라운드 WARNING 2건에 정확히 대응하며, 범위
  이탈 없음 — 실측 재확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`(`findMisboundHelpers`
    + `boundResource`/`recordedResource` 필드 신설), 같은 디렉터리 `-fixture.ts`(`WRONG_RESOURCE_BOUND_SOURCE`
    · `MATCHED_RESOURCE_SOURCE` · `MIXED_NOTATION_SOURCE` 3종 추가), `.spec.ts`(대응 단언 4건),
    `plan/in-progress/spec-draft-audit-resource-type-count.md` → `plan/complete/`(`git show --name-status`
    로 `R095` 확인 — rename, 내용 손실 없음), `plan/in-progress/spec-sync-auth-gaps.md`(경위 등재)
  - 상세: `git show 4b15f0393`으로 diff 전체를 직접 대조했다. 신설 함수 `findMisboundHelpers`
    는 5라운드 SUMMARY 의 W1("`findUnboundHelpers`가 접두 문자열만 봐서 엉뚱한 리소스에 묶인
    helper를 통과시킨다")을 그대로 겨냥하고, fixture 3종은 위반 케이스 1 + 대조군 2(자기 리소스
    바인딩, 표기만 다른 동일 값)로 정확히 그 판정 로직의 형태 커버리지에 대응한다. 가드 파일
    크기(313줄)는 기존 자매 가드 `engine-error-code-anchor-guard.ts`(261줄)와 같은 자릿수라
    과잉 인프라로 보기 어렵다. draft 이동은 W2("완료된 draft가 in-progress에 남음")에 정확히
    대응하며 인입 링크 갱신도 같은 커밋에 포함됐다. 이 커밋에서 무관한 파일·리팩토링·포맷팅
    잡음은 발견되지 않았다.
  - 제안: 없음 — 정상 범위.

- **[INFO]** (이전 라운드부터 이월) 서로 독립된 두 plan 항목(W4 `recordAudit` 팩토리→가드 대체
  + `audit_log` 적재 실패 관측성)이 여전히 한 changeset(첫 커밋 `9a2e860dc`)에 번들됨
  - 위치: `plan/in-progress/spec-sync-auth-gaps.md`(`recordAudit` 공통 팩토리(W4) 항목,
    `audit_log` 적재 실패에 관측 수단이 없다 항목)
  - 상세: 1~5라운드 scope 리뷰가 동일 사안을 이미 세 차례 INFO 로 기록했다(`14_31_12/scope.md`,
    `15_25_56/scope.md`). 6라운드째 재확인해도 결론은 같다 — 두 항목 모두 같은 audit 트래커에
    속하고 각각의 판별 프로브·뮤테이션 축·완료 근거가 plan 문서에 투명하게 남아 있어 은폐된
    확장이 아니다. 이미 5차례 리뷰·수정 사이클을 거쳐 병합 직전 단계라 재작업을 요구할 실익도
    낮다.
  - 제안: 조치 불필요 — 기록으로만 남긴다.

- **[INFO]** (이전 라운드부터 이월) 원래 계획된 처방("공통 팩토리 추출")이 새 정적 분석 인프라로
  대체됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts`,
    `audit-action-binding.spec.ts`
  - 상세: plan 의 원래 항목은 "5개 `recordAudit` helper 공통 팩토리 추출"이었으나, 다섯을 실측한
    뒤 팩토리 추출을 won't-do 로 종결하고 대신 AST 기반 repo-guard(가드+fixture+spec 3-파일)를
    신설했다. 판별 프로브(`auth-configs`에 `trigger.created` → tsc 0 에러 vs `schedules` 대조군
    → TS2322) 근거가 plan·CHANGELOG·가드 헤더 세 곳에 일관되게 기록돼 있고, 기존 자매 가드와
    동일 아키텍처를 따르는 컨벤션 준수 확장이라 임의의 over-engineering 은 아니다.
  - 제안: 조치 불필요 — 근거가 충분히 문서화됨.

- **[INFO]** (이전 라운드부터 이월) `recordExecutionError`의 클램핑 리팩터가 문자 그대로는
  "감사(audit)" 범위 밖인 execution-error 카운터를 같은 changeset 에서 건드림
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts`(`clampLabel` 신설,
    `recordExecutionError` 호출부 교체)
  - 상세: 1라운드 RESOLUTION W3("클램핑 상한 64가 두 곳에 매직넘버로 중복 → 공유 상수로")에
    근거가 명시돼 있고, 이 PR 자신이 새 카운터를 추가하며 만든 중복(신·구 카운터가 같은 리터럴을
    따로 든 상태)을 같은 PR 안에서 바로 닫은 것이라 drive-by 리팩터가 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/**`·`review/consistency/**` 프로세스 산출물이 순수 코드/spec diff
  대비 파일 수·라인 수 기준 압도적 과반을 차지 (102 파일 중 코드 8 + spec 3 + plan 4, 나머지
  87개는 리뷰/일관성검사 산출물)
  - 위치: `review/code/2026/09/01/{14_31_12,15_10_38,15_25_56,15_49_24,16_29_11}/*`,
    `review/consistency/2026/09/01/{15_00_54,16_02_03,16_16_39}/*`
  - 상세: 이 저장소 관례상 `review/code/**`·`review/consistency/**`는 커밋 대상이고, 실제로
    각 산출물이 그것을 낳은 코드/spec 커밋과 짝지어 커밋돼 있어(리뷰→fix 라운드별 대응) 정상적인
    워크플로 부산물이다. scope 위반은 아니나, 6라운드에 걸친 리뷰 자체가 changeset 크기의
    대부분을 차지하는 상황이라 diff 크기만으로 변경 규모를 가늠하면 실제 코드 변경량(핵심
    코드+테스트+spec 합쳐 약 500줄)을 과대평가하기 쉽다.
  - 제안: 조치 불필요. 병합 직전이라면 리뷰 산출물이 향후 참조 가치를 갖는지(이 changeset 은
    "합의는 검증이 아니다", "존재하지 않는 문서를 근거로 댔다" 같은 재사용 가능한 교훈을
    남겼다) 정도만 참고.

## 요약

6라운드 누적 검토 결과, 이 changeset 은 시종일관 두 갭(감사 기록 실패 관측 불가, `auth_config`
`recordAudit` 액션 타입 미바인딩)에 수렴한 작업이었다. 5라운드 이후 유일하게 추가된 커밋
(`4b15f0393`)을 직접 diff 대조한 결과, 그 변경분은 직전 라운드가 지적한 WARNING 2건에 정확히
대응하는 범위 안의 수정(가드 판정 로직 보강 + 완료 draft 이동)이었고 무관한 파일·리팩토링·
포맷팅·주석·임포트 잡음은 없었다. 이전 라운드부터 이월된 INFO 4건(두 plan 항목 번들, 처방
전환, execution-error 클램핑 동반 수정, 리뷰 산출물 비중)은 전부 근거가 문서화돼 있고 반복
검토에도 결론이 바뀌지 않아 그대로 기록만 유지한다. 신규 차단 사유는 없다.

## 위험도

LOW
