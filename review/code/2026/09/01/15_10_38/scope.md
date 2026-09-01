# 변경 범위(Scope) 코드 리뷰 — audit-record-factory (2026-09-01 15:10:38)

## 검토 방법

`origin/main...HEAD` 전수 diff(36 파일, +2120/-17)를 실제 커밋 3개 단위로 분해해 각 커밋이
자신의 커밋 메시지가 주장하는 범위와 일치하는지 대조했다:

```
9a2e860dc fix(audit): 감사 액션 바인딩 구멍 + 삼킨 적재 실패를 보이게 (팩토리는 가드로 대체)
4a65b12c6 fix(audit): 리뷰 1R — 신설 메트릭 구현이 어느 테스트도 실행하지 않았다
04b68d352 docs(spec): `clemvion.audit.write_failed` NF-OB-07 등재 + "로그로만 남는다" 정정
```

`git diff --stat origin/main...HEAD`(작업 트리 stat)와 프롬프트에 실린 36개 파일 목록을 1:1
대조해, 프롬프트 크기 제한으로 diff 가 생략된 파일(`SUMMARY.md`, `_retry_state.json` 일부,
`requirement.md`)을 포함해도 **숨겨진/추가 변경 파일이 없음**을 확인했다.

## 발견사항

- **[INFO]** 독립된 두 plan 항목(타입 바인딩 가드 W4 + 감사 적재 실패 관측)이 여전히 한
  changeset(첫 커밋 `9a2e860dc`)에 번들되어 있다
  - 위치: `plan/in-progress/spec-sync-auth-gaps.md:52`(`recordAudit` 공통 팩토리 W4 항목),
    `plan/in-progress/spec-sync-auth-gaps.md:99`(`audit_log` 적재 실패 관측 항목)
  - 상세: 이전 리뷰 라운드(`review/code/2026/09/01/14_31_12/scope.md:5-8`)가 이미 같은 지적을
    INFO 로 남겼고, 이번 라운드까지도 두 관심사(정적 타입 바인딩 가드 vs 런타임 카운터/로그
    관측성)가 분리 커밋 없이 한 커밋에 남아 있다. 두 항목이 같은 audit 트래커
    (`spec-sync-auth-gaps.md`)에 속하고 각각의 판별 근거·뮤테이션 축이 plan 문서에 투명하게
    기록돼 있어 은폐된 확장은 아니다.
  - 제안: 이미 병합 진행된 상태라 재작업을 요구할 정도는 아님. 유사 패턴이 반복되면 다음
    번에는 두 항목을 별도 커밋으로 분리할 것을 권한다(이전 라운드와 동일 권고 유지).

- **[INFO]** 신규 카운터가 필요로 하는 클램핑 상수 추출이, 감사(audit)와 무관한 기존
  `recordExecutionError`(execution errors 카운터)의 리팩터까지 같은 커밋에 포함시킨다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` 게이트 59-71
    (`PROMETHEUS_LABEL_MAX_LEN`, `clampLabel()` 신설), 게이트 132-134
    (`recordExecutionError` 가 인라인 `.substring(0, 64)` 대신 `clampLabel()` 사용으로 변경)
  - 상세: "감사 적재 실패를 관측 가능하게" 라는 진술된 목적을 문자 그대로 보면
    `recordExecutionError` 는 범위 밖 코드다. 다만 이 리팩터는 새 `recordAuditWriteFailed` 가
    필요로 하는 `64` 클램핑 상수를 기존 `recordExecutionError` 의 동일 리터럴과 공유하기 위한
    것으로, `review/code/2026/09/01/14_31_12/RESOLUTION.md` W3 항목("클램핑 상한 64 가 두 곳에
    매직넘버로 중복 → 공유 상수로")에 근거가 명시돼 있고 그 리뷰 라운드에서 이미 승인·반영된
    변경이다. 즉 drive-by 리팩터가 아니라 이 PR 자신이 만든 중복(새 카운터 + 기존 카운터가
    같은 상수를 따로 들고 있는 상태)을 이 PR 안에서 바로 해소한 것이다.
  - 제안: 조치 불필요 — 근거가 문서화돼 있고 변경 폭도 3줄 수준으로 작다.

- **[INFO]** changeset 의 순수 코드/spec diff(약 400줄) 대비 리뷰·정합성 검토 파이프라인
  산출물(`review/**`, 약 900줄+)이 파일 수·라인 수 기준 과반을 차지한다
  - 위치: `review/code/2026/09/01/14_31_12/*.md`(8개 파일, RESOLUTION.md 포함), `_retry_state.json`,
    `meta.json` / `review/consistency/2026/09/01/15_00_54/*.md`(SUMMARY 포함 7개), `_retry_state.json`,
    `meta.json`, `_target/spec-draft-audit-write-failed-metric.md`
  - 상세: 이 저장소 관례상 `review/code/**`·`review/consistency/**` 산출물은 gitignore 대상이
    아니고 커밋되는 것이 정상이며(`.claude/docs/plan-lifecycle.md` 정보 저장 위치 표), 실제로
    두 번째 커밋(`4a65b12c6`)·세 번째 커밋(`04b68d352`)에 코드/spec 변경과 각각 짝지어 커밋돼
    있어 "코드 변경 + 그 변경을 검증한 리뷰 기록"이 분리 없이 같은 논리적 단계에 묶인 정상적인
    프로세스 산출물이다. Scope 위반은 아니나, PR 리뷰어가 diff 크기만으로 변경 규모를 가늠하면
    실제 코드 변경량을 과대평가하기 쉽다는 점을 기록해 둔다.
  - 제안: 조치 불필요.

- **[INFO]** `spec/` 3개 파일(`_product-overview.md`, `data-flow/1-audit.md`,
  `data-flow/9-observability.md`) 변경이 이번 changeset 에 포함되지만, 이는 developer 권한 밖
  spec 쓰기가 아니라 `plan/in-progress/spec-draft-audit-write-failed-metric.md` draft →
  `/consistency-check --spec`(`review/consistency/2026/09/01/15_00_54`, BLOCK:NO) → 별도 커밋
  으로 이어지는 project-planner 정규 경로를 그대로 밟았다
  - 위치: 세 번째 커밋 `04b68d352` 전체(`spec/5-system/_product-overview.md`,
    `spec/data-flow/1-audit.md`, `spec/data-flow/9-observability.md`,
    `plan/in-progress/spec-draft-audit-write-failed-metric.md`)
  - 상세: 코드(첫 커밋)가 새 메트릭을 신설하며 spec 카탈로그를 갱신하지 않은 갭을 리뷰
    documentation 에이전트가 WARNING 으로 지적했고(`review/code/2026/09/01/14_31_12/documentation.md`
    첫 항목), 그 지적에 따라 draft 작성 → consistency-check → 별도 커밋으로 처리한 흐름이
    커밋 메시지·RESOLUTION.md·plan 파일에 일관되게 남아 있다. `spec_impact` 도 정확히 이 3개
    파일을 명시한다. 정상적인 SD1 처리 경로이며 scope 이탈이 아니다.
  - 제안: 없음.

## 요약

`origin/main...HEAD` 전체 diff(36 파일)를 커밋 단위로 분해해 대조한 결과, 세 커밋 모두 각자의
커밋 메시지가 주장하는 범위와 일치했다 — (1) 감사 액션 타입 바인딩 구멍 수정 + 적재 실패
관측성 신설, (2) 그 리뷰 1라운드 WARNING(신설 메트릭 구현 무검증) fix + 리뷰 산출물 보존,
(3) 그 리뷰가 지적한 spec 카탈로그 갭을 planner 턴(consistency-check 통과)으로 해소. 무관한
파일·포맷팅 잡음·불필요한 임포트·의도치 않은 설정 변경은 발견되지 않았다. 유일하게 주목할
지점은 두 개의 독립적 plan 항목이 첫 커밋에 계속 번들돼 있다는 점(이전 라운드에서 이미 INFO
로 지적된 사안의 지속)과, 신규 클램핑 상수 공유를 위해 기존 `recordExecutionError` 코드가
같은 커밋에서 함께 리팩터된 점인데 — 후자는 이 PR 자신이 만든 중복을 이 PR 안에서 바로
닫은 것이라 정당하다. `review/**` 산출물과 `spec/` 변경은 모두 이 저장소의 정규 워크플로
(리뷰 → resolution → consistency-check → spec 커밋)를 그대로 밟은 것으로 확인돼 scope
이탈이 아니다.

## 위험도

LOW
