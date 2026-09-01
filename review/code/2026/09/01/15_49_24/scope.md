# 변경 범위(Scope) 리뷰 — audit-record-factory (2026-09-01 15:49:24, 4라운드)

## 검토 방법

`origin/main...HEAD`(`0e0bfebf1` 기준) 누적 diff — 58 파일, +4723/-17 — 를 실제 커밋 5개 단위로
분해해 각 커밋이 자신의 커밋 메시지가 주장하는 범위와 일치하는지 대조했다.

```
9a2e860dc fix(audit): 감사 액션 바인딩 구멍 + 삼킨 적재 실패를 보이게 (팩토리는 가드로 대체)
4a65b12c6 fix(audit): 리뷰 1R — 신설 메트릭 구현이 어느 테스트도 실행하지 않았다
04b68d352 docs(spec): `clemvion.audit.write_failed` NF-OB-07 등재 + "로그로만 남는다" 정정
1b7334098 fix(audit): 리뷰 2R — 내 삽입이 기존 설명을 원래 대상에서 떼어놨다
86bd4bd90 fix(audit): 리뷰 3R — 나는 존재하지 않는 문서를 근거로 댔고, 그게 실재하는 구멍을 덮었다
```

이전 세 라운드(`14_31_12`, `15_10_38`, `15_25_56`)의 scope 리뷰 산출물을 전부 읽어 이미 도달한
결론을 확인하고, 이번 라운드에서 **새로** 추가된 코드 변경(`86bd4bd90`, 3R fix)만 별도로 재검증
했다 — 이 커밋은 아직 어떤 scope 리뷰어도 보지 않은 diff다.

## 발견사항

- **[INFO]** (3R 신규 확인) `86bd4bd90` 의 코드 변경(`audit-action-binding-{guard,fixture}.ts`
  화살표 함수 필드 분기 추가, `audit-logs.spec.ts` 의 `@Optional` DI 테스트를
  `Test.createTestingModule` 로 교체)은 전부 원 changeset 이 신설한 "감사 액션 바인딩 가드" 와
  "swallow 계약 회귀 방지" 라는 동일 표면 위의 결함 수정이며, 새 파일·새 관심사를 추가하지
  않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
    (`auditHelperParams()` 신설 — 게이트 105-126, `ts.isPropertyDeclaration` 분기),
    `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts`
    (`ARROW_FIELD_BARE_SOURCE`/`ARROW_FIELD_BOUND_SOURCE` 게이트 70-88),
    `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts`
    (`'metrics provider 없이 DI 조립이 성공한다 (@Optional)'` 테스트, 마지막 `describe` 블록)
  - 상세: 커밋 본문이 "가드가 화살표 함수 클래스 필드를 존재하지 않는 것처럼 통과시켰다"는
    실측(탐지 0건)과 "`@Optional` 테스트가 생성자를 직접 호출해 DI 를 안 태워 이름과 계약이
    안 맞았다"는 실측(뮤테이션 시 무관한 `findAll` 스위트가 대신 RED)을 근거로 든다. 두 변경
    모두 원 changeset(`9a2e860dc`)이 만든 산출물(가드·fixture·DI 회귀 테스트) **자신의 결함**을
    닫는 것이라 새로운 기능 확장이나 무관한 영역 수정이 아니다.
  - 제안: 없음 — 정상 범위.

- **[INFO]** (기존 라운드 재확인, 변화 없음) 두 독립된 plan 항목(`recordAudit` 타입 바인딩
  가드 W4 + `audit_log` 적재 실패 관측성)이 여전히 첫 커밋(`9a2e860dc`) 한 곳에 번들되어 있다
  - 위치: `plan/in-progress/spec-sync-auth-gaps.md:52`(W4 항목),
    `plan/in-progress/spec-sync-auth-gaps.md:99`(관측 항목)
  - 상세: `14_31_12`·`15_10_38`·`15_25_56` 세 라운드가 동일 지적을 이미 INFO 로 남겼다. 두
    관심사 모두 같은 audit 트래커에 속하고 판별 프로브·뮤테이션 축·완료 근거가 plan 문서에
    투명하게 기록돼 있어 은폐된 확장은 아니다. 병합이 3라운드째 진행된 시점이라 지금 분리를
    요구할 실익도 없다.
  - 제안: 조치 불필요 — 기록으로만 유지.

- **[INFO]** (기존 라운드 재확인) `recordExecutionError` 의 인라인 `.substring(0, 64)` 를
  `clampLabel()` 공유 헬퍼로 바꾼 3줄 변경이, 문자 그대로는 "audit" 범위 밖인 기존
  execution-error 카운터를 같은 커밋에서 건드린다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts`
    (`PROMETHEUS_LABEL_MAX_LEN`/`clampLabel` 신설, `recordExecutionError` 호출부 교체)
  - 상세: `review/code/2026/09/01/14_31_12/RESOLUTION.md` W3 항목에 근거가 명시돼 있고, 이 PR
    이 새 카운터를 추가하며 스스로 만든 중복(신·구 카운터가 같은 리터럴 `64` 를 따로 든 상태)
    을 같은 PR 안에서 바로 닫은 것이라 drive-by 리팩터가 아니다. 세 라운드 연속 같은 결론.
  - 제안: 조치 불필요.

- **[INFO]** (기존 라운드 재확인) `spec/` 3개 파일 변경은 developer 권한 밖 spec 쓰기가
  아니라 정규 SD1 경로(문서화 WARNING → draft → `--spec` consistency-check BLOCK:NO → 별도
  커밋)를 그대로 밟았다
  - 위치: 커밋 `04b68d352` 전체 (`spec/5-system/_product-overview.md`,
    `spec/data-flow/1-audit.md`, `spec/data-flow/9-observability.md`,
    `plan/complete/spec-draft-audit-write-failed-metric.md`)
  - 상세: `spec_impact` frontmatter 가 정확히 이 3개 파일을 명시하고,
    `review/consistency/2026/09/01/15_00_54/*`(BLOCK:NO) 로 검증된 뒤 별도 커밋으로 반영됐다.
    draft 는 `plan/complete/` 로 보존돼 있어(관례대로 삭제되지 않음) 경계 근거가 남아 있다.
  - 제안: 없음.

- **[INFO]** (기존 라운드 재확인) `review/code/**`·`review/consistency/**` 프로세스 산출물
  (47개 파일, ~4300줄)이 순수 코드/spec diff(~470줄) 대비 파일 수·라인 수 기준 압도적으로
  크다
  - 위치: `review/code/2026/09/01/{14_31_12,15_10_38,15_25_56}/*`,
    `review/consistency/2026/09/01/15_00_54/*`
  - 상세: 이 저장소 관례상 정상 산출물이며(`CLAUDE.md` 정보 저장 위치 표), 각 라운드가 그것을
    낳은 fix 커밋과 짝지어 커밋돼 있다. scope 위반은 아니나, diff 크기만으로 변경 규모를
    가늠하면 과대평가하기 쉽다는 점을 재확인해 둔다.
  - 제안: 조치 불필요.

- **[INFO]** (기존 라운드 재확인, 3R 에서 추가 확인) `86bd4bd90` 이 이전 두 라운드의
  `RESOLUTION.md` 두 파일을 사후 수정했다 — 이미 커밋된 리뷰 산출물의 서술을 되짚어 정정한다
  - 위치: `review/code/2026/09/01/14_31_12/RESOLUTION.md`, `review/code/2026/09/01/15_10_38/RESOLUTION.md`
  - 상세: 원문을 삭제·재작성하지 않고 `> ⚠️ 정정 (3라운드, ...)` 인용 블록을 **추가**해 거짓
    근거("가드 헤더에 트레이드오프로 이미 문서화됨")를 명시적으로 반증(grep 0건)하고 실제
    처리(코드 수정)를 덧붙였다 — 원문을 지우고 다시 쓰는 대신 정정 이력을 남기는 방식이라
    은폐가 아니다. 리뷰 산출물 자체를 사후 편집하는 것은 이례적이지만, 그 편집이 "리뷰가 만든
    잘못된 서술이 다음 판단을 오도하는 것을 막는다"는 이 changeset 의 핵심 주제(감사 로그
    유실을 보이게 한다)와 같은 축의 자기 정정이라 별도 관심사의 침투는 아니다.
  - 제안: 조치 불필요 — 확인 목적 기재.

## 요약

5개 커밋 전체를 대조한 결과 각 커밋이 자신의 메시지가 주장하는 범위와 일치했다. 이번
라운드에서 처음 리뷰되는 3R 커밋(`86bd4bd90`)의 코드 변경(가드의 화살표 함수 필드 인식 추가,
`@Optional` DI 테스트 재작성)도 원 changeset 이 신설한 가드·회귀 테스트 자신의 결함을 닫는
것으로, 새 관심사나 무관한 영역 확장이 아니다. 무관한 파일·포맷팅 잡음(`--ignore-all-space`
비교 동일)·불필요한 임포트·`console.log`/`TODO`/`debugger` 잔존·의도치 않은 설정 변경은 이번
라운드에서도 발견되지 않았다. 이전 세 라운드가 이미 INFO 로 수렴한 사안들(두 plan 항목 번들·
`recordExecutionError` clampLabel 공유·spec 변경 SD1 경로·리뷰 산출물 비중)은 상태 변화가 없어
재확인만 했고, 새로 관찰된 것은 이전 RESOLUTION.md 를 사후 정정 블록으로 고친 점인데 이 역시
원문 보존 + 명시적 반증이라는 방식이라 범위 이탈로 보지 않는다.

## 위험도

LOW
