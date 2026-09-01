# 문서화(Documentation) 리뷰 — audit-record-factory (2026-09-01 16:29:11)

## 검토 방법

이 changeset 은 이미 4라운드의 코드 리뷰(`14_31_12`→`15_10_38`→`15_25_56`→`15_49_24`)와
3라운드의 consistency-check(`15_00_54`→`16_02_03`→`16_16_39`)를 거쳤다. 이전 라운드들이
반복 재검증한 항목(NF-OB-07 카탈로그 등재, CHANGELOG, JSDoc 귀속, `record()` 관측 테스트,
`spec-draft-audit-write-failed-metric.md` 이동)은 이번에도 `Read`/`grep` 으로 직접 재확인했고
전부 여전히 정확했다 — 상세는 아래 "재확인" 절.

이번 라운드가 처음 보는 자료는 (a) 4라운드 자신의 리뷰 산출물, (b) `16_16_39` consistency
라운드와 그 target `plan/in-progress/spec-draft-audit-resource-type-count.md`, (c) 그 draft 가
제안한 `spec/5-system/_product-overview.md`·`spec/data-flow/1-audit.md` 의 실제 반영 diff다.
이 (b)+(c) 조합에서 새 결함을 하나 찾았다 — 아래 WARNING.

## 발견사항

- **[WARNING]** `spec-draft-audit-resource-type-count.md` — 체크리스트 전항목 완료·spec 실제
  반영 확인됨에도 `plan/in-progress/` 에 `status: in-progress` 로 방치, `plan/complete/` 로
  이동되지 않음
  - 위치: `plan/in-progress/spec-draft-audit-resource-type-count.md` (frontmatter `status:
    in-progress`, `completed:` 필드 없음, "동반 정정" 섹션의 5개 체크박스 전부 `[x]`)
  - 상세: 이 draft 의 "변경 제안"(`_product-overview.md` NF-OB-07 카탈로그 "실측 12종" →
    "실측 10종")과 "게이트가 하나를 더 찾았다" 절(`data-flow/1-audit.md` "8개 위치" →
    "12개 위치")을 직접 대조했다 — **둘 다 실제로 적용돼 있다**(`spec/5-system/_product-overview.md:91`
    "실측 **distinct 10종**", `spec/data-flow/1-audit.md:55` "**12개 위치**(9개 service
    모듈 + 3개 auth/user controller)", 둘 다 `grep` 재확인). "동반 정정" 5개 체크박스(business-metrics
    JSDoc·`spec-sync-auth-gaps.md`·`spec-draft-audit-write-failed-metric.md`·spec 2파일)도
    전부 `[x]`이고 실제 반영과 일치한다. 즉 **이 draft 가 하기로 한 작업은 전부 끝났다.**
    그런데도 frontmatter 는 `status: in-progress` 이고 `completed:` 날짜가 없으며,
    `plan/complete/` 에는 이 파일이 없다(`Read` 로 부재 확인). `.claude/docs/plan-lifecycle.md`
    §3 은 "모든 항목이 완료된 순간 `complete/` 로 이동", §4 는 "`status` 를 선언했다면 이동
    시 함께 `complete`/`implemented`/`applied`/`superseded` 로 갱신"을 명시한다.
    **같은 PR 안에서 자매 파일(`plan/complete/spec-draft-audit-write-failed-metric.md`)이
    정확히 이 절차(`status: applied` + `completed: 2026-09-01` + "✅ 적용 완료" 배너 +
    `plan/complete/` 이동 + 인입 링크 `../complete/` 정정)를 밟은 것과 대조된다** — 그리고
    그 절차 자체가 **이 PR 2라운드 RESOLUTION 의 W1** 에서 "이 저장소에서 두 번 재발한 패턴"
    이라고 명시적으로 지적·수정됐던 항목이다. 이번 draft 는 그 세 번째 재발이다. 부수 효과로,
    `plan/complete/spec-draft-audit-write-failed-metric.md:161` 의 정정 노트가
    `../in-progress/spec-draft-audit-resource-type-count.md` 를 가리키는데, 이 draft 를
    옮기면 이 링크도 `../complete/`로 함께 정정해야 한다(현재는 "아직 안 옮겼으니" 정확하지만,
    옮기지 않은 채 방치되면 다음에 옮길 때 이 인입 링크 정정을 잊기 쉽다 — 정확히 W1 이 지적한
    실패 모드).
  - 제안: `spec-draft-audit-resource-type-count.md` 를 `plan/complete/` 로 이동하고
    frontmatter 를 `status: applied` + `completed: 2026-09-01` 로 갱신, 파일 상단에 자매
    문서와 같은 "✅ 적용 완료" 배너 추가. `plan/complete/spec-draft-audit-write-failed-metric.md:161`
    의 인입 링크를 `../complete/spec-draft-audit-resource-type-count.md` 로 동시 정정.
    `plan/in-progress/spec-sync-auth-gaps.md:134` 의 링크도 `../complete/`로 갱신.

- **[INFO]** (4회 이월, 5회째 재확인) `AuditLogsService.record()` 의 JSDoc 이 여전히 이번
  changeset 이 추가한 관측 동작(카운터 증가·로그 4필드 확장)을 언급하지 않는다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `record()` 바로
    위 JSDoc(`/** Record an audit event. Failures are swallowed — audit logging must never
    break the primary action. */`)
  - 상세: 1~4라운드가 동일 지점을 매번 INFO 로 지적·유예했고(`spec-sync-auth-gaps.md:141-146`
    에도 "미조치이며 우선순위 판단" 으로 명시 등재돼 있음을 확인), 이번에도 손대지 않은
    상태다. `AuthConfigsService.recordAudit` 등 여러 helper 의 주석이 이 JSDoc 에 계약을
    암묵적으로 위임하는데, 링크를 따라가는 다음 사람은 "삼킨다" 절반만 보고 "삼킨 것이 이제
    카운터+상세 로그로 관측된다" 는 나머지 절반을 여전히 못 본다. 기능 결함은 아니며, plan 에
    이미 명시 등재돼 우선순위 판단으로 반복 확정된 사안이라 이번에도 차단 사유로 올리지 않는다.
  - 제안: 변경 없음(이미 plan 에 추적됨). 다음에 이 메서드를 건드릴 계기가 있으면 JSDoc 한 줄
    추가.

## 재확인 (이전 라운드 항목, 이번에도 실제 파일로 재검증)

| 항목 | 재확인 방법 | 결과 |
|---|---|---|
| NF-OB-07 카탈로그 `clemvion.audit.write_failed` 등재 + "라벨을 닫는 방법은 둘이다" 서술 | `spec/5-system/_product-overview.md` Read | 존재, 구현(클램핑 64자)과 일치 |
| CHANGELOG Unreleased 절 | `CHANGELOG.md` head Read | 대조군 tsc 프로브·처방 전환·카운터 신설 서사 모두 포함 |
| `BusinessMetricsService` 클래스 JSDoc·`PROMETHEUS_LABEL_MAX_LEN`/`clampLabel` 블록 위치 | `business-metrics.service.ts:48-74` Read | 유틸 블록 → 클래스 JSDoc → `@Injectable() export class` 순, 붕 뜬 주석 없음 |
| `@Optional() metrics` DI 계약을 실제로 무는 테스트 | `audit-logs.spec.ts` 전체 Read | `Test.createTestingModule` 로 provider 없이 조립하는 테스트 존재(생성자 직접 호출 vacuous 결함 해소 유지) |
| `spec-draft-audit-write-failed-metric.md` 이동·상태 | `plan/complete/` Read | `status: applied`, `completed: 2026-09-01`, 배너·인입 링크 정정 유지 |
| repo-guard 3파일(`audit-action-binding-{guard,fixture}.ts`, `.spec.ts`) 설계 근거 문서화 | 전체 Read | 화살표 함수 필드 처리 이유·형태 vs 값 판정 근거·fixture 존재 이유가 코드 안에서 완결 |

## 요약

이전 4라운드가 반복 검증한 문서화 항목은 이번에도 전부 정확히 반영된 상태로 유지되고 있음을
직접 재확인했다. 이번 라운드가 새로 포함한 자료(`spec-draft-audit-resource-type-count.md` +
그 적용 diff)에서 실질적인 새 결함을 하나 찾았다 — draft 의 작업 내용은 전부 실제로 적용됐지만
plan 문서 자신의 라이프사이클 상태(위치·frontmatter `status`)가 그 사실을 반영하지 않는다.
이는 이 PR 2라운드가 이미 한 번 지적·수정한 것과 동일한 패턴의 세 번째 재발이며, 코드 동작에는
영향이 없으나 plan 트래커의 신뢰성(다음 세션이 "아직 진행 중" 으로 오판할 위험)에 직접 영향을
준다. 그 외에는 CHANGELOG·JSDoc·spec 카탈로그·테스트 docstring 모두 이 저장소 평균 이상의
문서화 품질을 유지하고 있다.

## 위험도

LOW
