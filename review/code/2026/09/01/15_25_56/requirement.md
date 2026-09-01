# 요구사항(Requirement) 리뷰 — audit-record-factory (2026-09-01 15:25:56)

## 검증 방법

저장소를 뮤테이션하지 않고 `Read`/`Grep`으로 대상 파일을 직접 열어 diff 와 대조했고, 아래
테스트/타입체크를 그대로 실행해 실측했다(전부 GREEN, 저장소 쓰기 없음 — 원복 불요):

```
npx jest src/modules/audit-logs/audit-logs.spec.ts src/modules/metrics/business-metrics.service.spec.ts
→ Test Suites: 2 passed / Tests: 21 passed

npx jest src/repo-guards/__tests__/audit-action-binding.spec.ts
→ Test Suites: 1 passed / Tests: 10 passed

npx jest src/modules/auth-configs/auth-configs.service.spec.ts src/modules/executions/executions-rerun.service.spec.ts
→ Test Suites: 2 passed / Tests: 66 passed
```

`recordAudit(...)` 호출부를 `grep`으로 전수 확인해 정확히 5개(triggers/workflows/schedules/
model-config/auth-configs)임을 검증했고(fixture·spec 의 `sites.length >= 5` 전제와 일치),
`AuditLogsService.record()`를 호출하는 `resourceType` 값을 전수 추출해 코드 주석·spec 이
반복 주장하는 **"실측 12종"**(workflow/user/trigger/schedule/member/workspace_invitation/
workspace/alert_rule/integration/model_config/auth_config/execution)이 정확함을 독립적으로
재확인했다. `login-history.service.ts`의 `record()`가 실제로 카운터 없이 `Logger.error`만
호출한다는 `1-audit.md`의 비대칭 서술도 소스와 대조해 확인했다.

`tsc --noEmit -p tsconfig.json` 은 일부 에러를 냈으나 전부 `carousel.handler.spec.ts`·
`chart/buttons.spec.ts`·`table/buttons.spec.ts`·`auth-configs.service.spec.ts` 등 **이번 diff
가 건드리지 않은 파일**(`git diff --stat origin/main...HEAD -- <path>` 로 무변경 확인)의
기존 무관 에러이며, `auth-configs.service.ts`/`audit-logs.service.ts`/
`business-metrics.service.ts` 자체에 대해서는 신규 타입 에러가 없다.

## 발견사항

- **[INFO]** `recordAuditWriteFailed`의 `resourceType` 파라미터에 빈 문자열이 들어오면
  `resource_type: ''` 라벨로 카운터가 올라간다 — 방어 코드 없음
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` (`recordAuditWriteFailed`, `clampLabel`)
  - 상세: `clampLabel('')`은 `''`를 그대로 반환한다. `AuditLogsService.record()`의 `entry.resourceType`은
    타입상 필수(`resourceType: string`, optional 아님)이고 실측 12개 호출부 전부 비어 있지 않은
    리터럴/상수를 넘기므로 현재 발동 경로는 없다. 이는 이번 diff 가 새로 만든 리스크가 아니라
    `record()`의 기존 시그니처(§ "왜 클램핑인가" JSDoc이 스스로 "증명되지 않은 닫힘"이라 인정)에서
    이어지는 오픈-스트링 특성의 연장이다.
  - 제안: 조치 불필요 — 발동 경로가 없고, 설계 근거(클램핑 vs 닫힌 유니온)가 이미 spec/코드
    양쪽에 명시돼 있다. 참고로만 기재.

- **[INFO]** 가드(`findUnboundHelpers`)는 `action`이 리소스에 **묶여 있는지**만 검사하고
  제네릭 인자(어느 리소스인지)가 그 서비스의 실제 `resourceType`과 일치하는지는 검사하지 않는다
  (보안 리뷰 라운드가 이미 INFO 로 지적) — 이번 라운드에서 재확인만 했다, 신규 발견 아님.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` (`findUnboundHelpers`)
  - 상세/제안: 기존 지적과 동일, 트레이드오프가 가드 헤더·plan 문서에 이미 명시돼 있어 재조치
    불요. 이번 PR이 고치려던 "맨 union" 결함 클래스는 정확히 잡는다(실측: `auth-configs`에
    `action: 'trigger.created'`를 임시로 넣으면 가드/`tsc` 양쪽에서 걸림 — 이전 라운드가 이미
    확인).

## 요구사항 대조 결과 (요약)

1. **기능 완전성**: plan 이 명시한 두 갭 — (a) `recordAudit`의 `auth_config` action 타입이
   다른 helper 와 달리 리소스에 묶이지 않았던 구멍, (b) 감사 적재 실패가 관측 불가능했던 문제 —
   둘 다 코드·테스트·spec·plan 네 층에서 정합되게 닫혔다. (a)는 팩토리 추출 대신 AST 가드로
   처방을 바꿨는데, 그 전환 근거(판별 프로브: `auth-configs`에서 tsc 0 에러 vs `schedules`
   대조군 TS2322)가 plan/`CHANGELOG.md`/가드 헤더 세 곳에 일관되게 기록돼 있고 실측 가능하다.
2. **엣지 케이스**: 성공 경로에서 카운터 미증가(`정상 경로에서는 카운터를 올리지 않는다`),
   65자 입력의 64자 클램핑(분기를 가르는 fixture), metrics 주입 부재(`@Optional`), 관측 호출
   자체의 예외(`meter exploded`) 모두 전용 테스트로 커버된다.
3. **TODO/FIXME**: 신규/변경 파일 전체에 TODO/FIXME/HACK/XXX 없음 (`grep` 확인).
4. **의도-구현 일치**: `record()`의 "삼킨다" 계약은 유지됐고(항상 resolve, 테스트로 고정),
   `AuditLogsService.record()`의 JSDoc이 신규 관측 동작(카운터·확장 로그)을 언급하지 않는
   절반짜리 서술은 남아 있으나, 이는 두 라운드 전부터 의도적으로 유예된 INFO(이월)로 이번
   라운드의 재조치 대상이 아니다.
5. **에러 시나리오**: DB 저장 실패 → 삼킴 + 카운터 + 상세 로그. metrics 호출 자체의 예외 →
   내부 try/catch로 재삼킴(주 계약 보호). 두 시나리오 모두 뮤테이션 테스트(catch 안 try 제거
   → RED)로 고정됨을 RESOLUTION.md가 기록하고 있고, 이번 세션에서 실행한 jest 결과도 GREEN.
6. **데이터 유효성**: `resourceType`은 코드가 정하는 값이라 사실상 닫혀 있으나 시그니처는
   `string`이라 컴파일러가 증명 못 함 — 클램핑(64자)으로 방어. spec(`_product-overview.md`
   NF-OB-07, `9-observability.md` Rationale)이 이 트레이드오프를 정확히 반영한다.
7. **비즈니스 로직**: "감사 실패가 특권 작업(회전·삭제 등)을 절대 깨뜨리면 안 된다"는 규칙이
   관측 계층 추가 이후에도 코드·테스트 양쪽에서 유지됨을 확인. `auth_config` 액션 타입 좁힘은
   "다른 리소스 액션을 auth_config로 오기록"하는 실제 발견된 구멍(실측: 대조군 tsc 프로브)을
   정확히 겨냥한다.
8. **반환값**: `record()`는 모든 경로(성공/실패/관측 실패)에서 `Promise<void>` resolve —
   reject 경로 없음을 전용 테스트로 확인.
9. **spec fidelity**: `spec/5-system/_product-overview.md`(NF-OB-07 카탈로그 신규 행 +
   요약행 + "라벨을 닫는 방법은 둘이다" 서술), `spec/data-flow/9-observability.md`(블록쿼트
   나열 갱신 + Rationale 교차참조), `spec/data-flow/1-audit.md`(두 `record`의 관측 비대칭
   서술 분리)를 실제 파일과 line-level 로 대조 — 카운터 이름(`clemvion.audit.write_failed`),
   라벨 키(`resource_type`), 클램핑 값(64), 알람 예시 문구가 코드와 정확히 일치한다.
   consistency-check(`review/consistency/2026/09/01/15_00_54`)가 지적한 WARNING 2건
   (Rationale 예외 조항이 출처 문서에 없던 문제, `login_history` 후속 항목이 기존 plan
   체크박스와 연결 안 되던 문제)도 이번 diff 안에서 실제로 해소됐음을 파일 대조로 확인했다
   (`9-observability.md` 게이트 274-278 교차참조 추가, `spec-sync-auth-gaps.md`의
   `login_history` 축 하위 체크박스 신설). SPEC-DRIFT 없음 — spec 반영이 오히려 코드보다
   나중에 planner 턴으로 정확히 따라잡은 정상 경로다.

## 참고 — 리뷰 파이프라인 산출물(파일 12~44)에 대해

`review/code/2026/09/01/{14_31_12,15_10_38}/**`, `review/consistency/2026/09/01/15_00_54/**`
는 이 changeset 이 커밋하는 **이전 리뷰 라운드의 산출물**(이 저장소 관례상 정상 커밋 대상)이다.
그 안의 발견사항(W1~W4, SD1 등)은 각 RESOLUTION.md 가 기록한 대로 이후 커밋에서 코드/스펙/plan
쪽으로 이미 반영됐음을 위 검증에서 재확인했으므로, 이번 라운드의 신규 요구사항 위반으로
간주하지 않았다. 산출물 자체의 내용 오류(예: 존재하지 않는 파일/라인 인용)도 없었다.

## 요약

`plan/in-progress/spec-sync-auth-gaps.md`가 추적하던 감사 로깅 잔여 2건 — `auth_config`
`recordAudit`의 액션 타입 바인딩 구멍과, 감사 적재 실패가 관측 불가능했던 갭 — 을 코드
(`AuditLogsService`/`BusinessMetricsService`/`AuthConfigsService`), 정적 가드(신규 AST 기반
`audit-action-binding-*`), spec(3개 문서), plan 문서 네 층에서 정합되게 닫는다. "감사 실패는
본 요청을 절대 깨뜨리지 않는다"는 기존 계약은 관측 계층 추가 이후에도 자체 try/catch 로
보호되어 유지되며, 관련 테스트(성공/실패/클램핑 경계/관측 실패/`@Optional`)가 뮤테이션까지
고려해 촘촘히 짜여 있고 전부 실행 확인상 GREEN 이다. spec 3개 문서는 실제 코드와 line-level
로 일치하고, 직전 consistency-check 가 지적한 두 WARNING 도 같은 changeset 안에서 해소됨을
확인했다. Critical/Warning 급 신규 발견사항 없음 — 남은 것은 이미 이전 라운드에서 트레이드
오프로 문서화·유예된 INFO 성격의 잔여뿐이다.

## 위험도

NONE
