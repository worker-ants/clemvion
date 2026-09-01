# 문서화(Documentation) 리뷰 — audit-record-factory (2026-09-01 15:25:56, 3라운드)

이 changeset 은 직전 두 코드 리뷰 라운드(`14_31_12`, `15_10_38`)와 한 번의 consistency-check
라운드(`15_00_54`)를 거치며 문서화 관점 WARNING 이 이미 여러 건 지적·수정된 상태다. 이번
라운드에서는 그 수정들이 **실제로 저장소에 반영됐는지 직접 `Read`/`grep` 으로 재검증**했고,
그 위에서 새로 남은 문서화 결함이 있는지를 점검했다.

## 재검증 결과 (직전 라운드 WARNING → 반영 확인)

아래 항목은 모두 실제 파일을 열어 대조했다 — RESOLUTION.md 의 자기 서술이 아니라 독립 확인이다.

| # | 직전 지적 | 확인 방법 | 결과 |
|---|---|---|---|
| 1 | NF-OB-07 카탈로그에 `clemvion.audit.write_failed` 미등재 (`14_31_12` WARNING) | `spec/5-system/_product-overview.md` diff 대조 | 게이트 75(요약행)·91(카탈로그 표)·81(라벨 원칙 서술) 반영 확인 |
| 2 | CHANGELOG 에 이번 변경 서술 없음 (`14_31_12` WARNING) | `CHANGELOG.md` 실제 파일 head 읽음 | `## Unreleased — 감사 액션 바인딩 구멍 + 삼킨 적재 실패를 알람 걸 수 있게` 절 존재, 핵심 서사(대조군 tsc 프로브·처방 전환 이유·클래스 동질성) 포함 확인 |
| 3 | `BusinessMetricsService` 클래스 JSDoc 이 신규 `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel` 삽입으로 어떤 선언에도 안 붙음 (`15_10_38` WARNING) | `business-metrics.service.ts` 전체 Read | 게이트 48-72 순서로 `clampLabel` 유틸 블록 → 클래스 JSDoc → `@Injectable() export class` 가 바로 이어짐. 붕 뜬 주석 없음 |
| 4 | `recordRedisFailOpen` 설명 주석이 신규 `recordAuditWriteFailed` 테스트 위로 밀려 원래 대상을 잃음 (`15_10_38` WARNING) | `business-metrics.service.spec.ts` 게이트 54-96 Read | 새 주석(62-67행)이 "**아래** `recordRedisFailOpen` 주석" 으로 정확히 순방향 참조하고, 원 주석(85-89행)은 `recordRedisFailOpen` 테스트 바로 위로 복귀 |
| 5 | `spec-draft-audit-write-failed-metric.md` 가 3섹션 전부 적용됐는데도 `plan/in-progress/`에 `status: in-progress` 로 잔류 (`15_10_38` WARNING) | `find plan -iname` 로 실제 경로 확인 + frontmatter 대조 | `plan/complete/spec-draft-audit-write-failed-metric.md` 로 이동, `status: applied` + `completed: 2026-09-01`. `plan/in-progress/` 쪽 사본 없음(중복 잔류 없음). `plan-lifecycle.md §4` 가 정의한 종료값(`applied`) 사용도 정확 |
| 6 | `spec-sync-auth-gaps.md:128` 의 draft 인입 상대링크가 옛 경로(`./spec-draft-...`)를 가리킴 | `grep -n "spec-draft-audit-write-failed-metric.md" spec/data-flow/1-audit.md`, `find` | 링크가 `../complete/spec-draft-audit-write-failed-metric.md` 로 정정됨. 저장소 전체에 `in-progress/spec-draft-audit-write-failed-metric` 문자열 잔존 0건 (`grep -rn` 확인) |
| 7 | consistency-check `rationale_continuity` WARNING — `resource_type` open-string+클램핑 정당화가 원칙의 출처 문서(`9-observability.md` Rationale)가 아니라 파생 카탈로그에만 기록됨 | `spec/data-flow/9-observability.md` 게이트 270-279 Read | "닫힌 집합 유지" Rationale 문단 바로 뒤에 "이 원칙은 코드 유니온이 있는 라벨에 적용된다…" 블록쿼트 신설, `error_code`/`resource_type` 을 명시적 예외로 교차 참조 |
| 8 | consistency-check `plan_coherence` WARNING — `login_history` 후속 항목이 기존 plan 체크박스와 연결되지 않음 | `plan/in-progress/spec-sync-auth-gaps.md` diff 대조 | 기존 미체크 항목을 `[x] audit_log 축 — 완료` 로 좁히고, `- [ ] login_history 축 — 미결` 하위 체크박스를 신설해 재개 신호까지 명시 |

8건 전부 실제 반영을 확인했다. 새로 반영 과정에서 재발한 부수 결함(예: 링크가 다른 곳으로
잘못 옮겨짐, 이동 후에도 옛 경로가 dangling 으로 남음)도 없음을 확인했다.

## 발견사항

- **[INFO]** (2회 이월, 3회째 확인) `AuditLogsService.record()` 의 JSDoc 이 이번 changeset 전체가
  추가한 관측 동작(카운터 증가·로그 필드 4종 확장)을 여전히 언급하지 않는다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75` (JSDoc — `Record
    an audit event. Failures are swallowed — audit logging must never break the primary action.`)
  - 상세: 직전 두 라운드(`14_31_12/documentation.md` INFO #3, `15_10_38/documentation.md` INFO)가
    이미 같은 지점을 지적했고, 둘 다 "우선순위 낮음 → 유예" 로 판정했다. 이번 라운드에서 실제
    파일을 다시 열어 확인한 결과 여전히 손대지 않은 상태다 — 재발이 아니라 **의도된 이월**이다.
    `AuthConfigsService.recordAudit` 의 JSDoc(`auth-configs.service.ts:76-80`)이
    `{@link AuditLogsService.record}` 로 이 독스트링에 계약을 위임하고 있어, 링크를 따라가는
    다음 사람은 여전히 "삼킨다" 절반만 보고 "삼킨 것이 이제 카운터+상세 로그로 보인다" 는
    나머지 절반을 못 본다. 기능 결함이 아니라 문서 완결성의 경미한 갭이다.
  - 제안: 이미 두 번 유예 결정된 사안이라 이번에도 즉시 조치를 요구하지는 않는다. 다음에 이
    메서드를 건드릴 기회가 있으면 JSDoc 에 한 줄 추가 — 예: `* On failure, increments
    {@link BusinessMetricsService.recordAuditWriteFailed} and logs
    action/resourceType/resourceId/workspaceId for diagnosis.`

- **[INFO]** README·API 문서·CHANGELOG 갱신 필요성 재확인 — 이번 changeset 은 내부 서비스
  계측·정적 가드 신설이며 새 HTTP 엔드포인트·요청/응답 스키마·환경변수·CLI 옵션을 추가하지
  않는다.
  - 위치: 해당 없음 (부재 확인)
  - 상세: `AuditLogsController` 의 라우트는 이번 diff 로 변경되지 않았고(`audit-logs.service.ts`
    의 신규 파라미터는 `@Optional()` DI 로 하위 호환), `recordAuditWriteFailed`/`clampLabel` 은
    내부 구현이라 Swagger·README 노출 대상이 아니다. 새 환경변수도 없다(`OTEL_ENABLED` 는
    기존 게이트를 그대로 재사용). CHANGELOG 는 위 표 #2 로 이미 반영 확인됨.
  - 제안: 없음 — 확인 목적으로만 기재.

## 우수 사례 (참고)

- `plan-lifecycle.md §5` 의 "이동 commit 자가 점검" 체크리스트(`git mv` 사용·`status` 종료값
  갱신·형제 plan 인입 링크 정정)를 이번 라운드가 항목별로 정확히 이행했다 — 이 저장소가
  두 차례(`#1108`·`#1117`) 놓쳤던 패턴의 재발을 막았다.
- `BusinessMetricsService.recordAuditWriteFailed`(게이트 159-179)과 신규 가드 3파일
  (`audit-action-binding-{guard,fixture}.ts`, `.spec.ts`)의 문서화 품질은 여전히 이 저장소
  평균 이상이다 — 설계 근거·기각한 대안·형태 vs 값 판정 이유가 코드 안에서 완결된다.
- `spec/data-flow/9-observability.md` 의 신설 블록쿼트(게이트 274-279)는 원칙의 **출처 문서
  자체**에 예외를 교차 참조해, "카탈로그만 보고 원칙 문서는 안 읽는" 다음 사람도 모순을
  느끼지 않도록 닫았다 — consistency-check WARNING 을 형식적으로가 아니라 구조적으로 해소한
  사례다.

## 요약

직전 두 코드 리뷰 라운드와 한 consistency-check 라운드가 지적한 문서화 WARNING 8건(스펙
카탈로그 미등재, CHANGELOG 누락, JSDoc/주석 물리적 분리 2건, plan draft 미이동, 인입 링크
미정정, Rationale 출처 문서 교차참조 누락, plan 체크박스 미연결)을 모두 실제 파일 대조로
재검증했고 전부 정확히 반영됐음을 확인했다 — 반영 과정에서 새로운 문서 결함(깨진 링크·중복
파일·잘못된 위치 이동)도 발견되지 않았다. 유일하게 남은 것은 이미 두 차례 유예 결정된
`AuditLogsService.record()` JSDoc 의 절반짜리 서술(INFO, 이월)뿐이며, 이는 기능에 영향이
없고 우선순위가 낮다고 이미 판정된 사안이라 이번에도 차단 사유가 아니다.

## 위험도

LOW
