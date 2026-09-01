# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 서로 독립된 두 plan 체크리스트 항목(관측성 보강 + 타입 바인딩 가드)이 한 changeset 에 번들됨
  - 위치: `plan/in-progress/spec-sync-auth-gaps.md:52`(`recordAudit` 공통 팩토리 W4 항목), `plan/in-progress/spec-sync-auth-gaps.md:99`(`audit_log` 적재 실패 관측 수단 항목)
  - 상세: worktree 이름(`audit-record-factory`)이 시사하는 원 과제는 W4(`recordAudit` 공통 팩토리 추출)이지만, 실제로는 그 항목을 "가드로 대체" 로 종결하면서 동시에 별개 체크리스트 항목인 "`audit_log` 적재 실패에 관측 수단이 없다" 도 같은 changeset 에서 완료 처리했다. 두 항목은 원인·해결책이 독립적이다 — 전자는 정적 타입 바인딩 가드(`repo-guards/__tests__/audit-action-binding*`), 후자는 런타임 관측성(카운터·로그 메시지 확장, `business-metrics.service.ts` / `audit-logs.service.ts`). 다만 두 항목 모두 같은 plan 트래커(`spec-sync-auth-gaps.md`)의 audit 계열 항목이고, plan 문서에 각각의 완료 근거·뮤테이션 검증이 투명하게 기록돼 있어 은폐된 확장은 아니다.
  - 제안: 두 관심사를 별도 커밋(또는 PR)으로 분리하면 리뷰어가 각 diff 를 더 명확히 판단할 수 있다. 현재도 plan 서술이 두 항목을 명확히 구분해 기록하고 있어 실질적 위험은 낮다.

- **[INFO]** 원래 계획된 처방("공통 팩토리 추출")이 새 정적 분석 인프라(신규 파일 3개, ~300줄)로 대체됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`(신규), `audit-action-binding-fixture.ts`(신규), `audit-action-binding.spec.ts`(신규)
  - 상세: plan 의 원래 항목은 "5개 `recordAudit` helper 의 공통 팩토리 추출" 이었으나, 다섯을 실측한 뒤 팩토리 추출을 won't-do 로 종결하고 대신 AST 기반 repo-guard(파서 + fixture + spec 3-파일 구조)를 신설했다. 이는 원 요청보다 큰 산출물(재사용 가능한 검증 인프라)을 도입한 것으로 볼 수 있으나, ① plan 에 판별 프로브(auth-configs 에서 `action: 'trigger.created'` → tsc 0 에러 vs schedules 대조군 → TS2322) 근거가 상세히 남아 있고, ② 기존 자매 가드(`engine-error-code-anchor-guard.ts`)와 동일한 아키텍처를 따르는 기존 컨벤션 준수 확장이라 임의의 over-engineering으로 보긴 어렵다.
  - 제안: 근거가 충분히 문서화돼 있어 차단 사유는 아니다. 다만 "처방을 바꾼다" 는 결정 자체가 원 plan 항목의 해법을 뒤집는 것이므로, 이상적으로는 별도 planner 검토를 거치거나 plan 갱신 시점에 그 사실을 더 두드러지게(제목 레벨에서) 표시하면 다음 리뷰어의 혼선을 줄일 수 있다.

- **[INFO]** `auth-configs.service.ts` 의 `import` 변경은 실질 변경에 종속된 필요 변경으로 확인됨 (drive-by 아님)
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:17-20`(신규 import), `:86`(`AuditActionFor<...>` 사용)
  - 상세: `AuditAction` bare-union import 가 제거되고 `AuditActionFor` 로 교체됐다. `grep` 으로 확인한 결과 파일 내 `AuditAction` 의 실제 타입 참조는 이제 0건(주석에서만 언급)이라, import 정리는 타입 시그니처 변경에 직접 종속된 것으로 무관한 임포트 정리가 아니다.
  - 제안: 없음 — 정상 범위.

## 요약

전체적으로 이 changeset 은 감사(audit) 로깅 파이프라인의 두 갭 — (1) 감사 기록 실패의 관측 불가, (2) `auth_config` 의 `recordAudit` 액션 타입이 다른 helper 와 달리 바인딩되지 않은 구조적 결함 — 을 다룬다. 두 갭 모두 동일 plan 트래커에 기록된 항목이고 changeset 안의 모든 파일(서비스 로직, 메트릭, 신규 가드 3종, 테스트, plan 갱신)이 이 두 갭 중 하나에 직접 대응하며, 무관한 리팩토링·포맷팅·주석 잡음·불필요한 임포트는 발견되지 않았다. 다만 "원래 계획된 팩토리 추출" 대신 새 정적 가드 인프라를 도입한 처방 전환과, 서로 독립적인 두 항목을 한 changeset 에 묶은 점은 스코프 판단 관점에서 주목할 만하나 — plan 문서에 근거·판별 프로브·뮤테이션 검증이 투명하게 남아 있어 실질적 위험은 낮다.

## 위험도

LOW
