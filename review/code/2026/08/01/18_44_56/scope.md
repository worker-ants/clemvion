# 변경 범위(Scope) 리뷰

## 조사 방법 메모

리뷰 payload 는 6개 파일을 "전체 파일 컨텍스트"로만 제공하고 `unified diff` 섹션이 없다.
Scope 판단을 정확히 하려면 "이번 라운드에서 실제로 바뀐 부분"을 알아야 하므로, git 이력을
대조해 payload 의 파일 6종과 정확히 일치하는 커밋을 특정했다:

- `c4eddd918` "fix(backend): 7차 리뷰 조치 — action 타입 도메인 한정 + 감사 순서 테스트 대칭"
  (`git show --stat`): `audit-action.const.ts`(+15) / `model-config.service.ts`(+7/-1) /
  `schedules.service.ts`(+7/-1) / `triggers.service.ts`(+7/-1) /
  `workflows.service.spec.ts`(+71) / `workflows.service.ts`(+7/-1) — payload 의 파일 1~6 과
  1:1 일치.

이하 발견사항의 "위치"는 payload 문서의 게이트 숫자(=소스 파일 실제 줄 번호)를 인용한다.

## 발견사항

없음 — 이번 커밋의 diff 는 커밋 메시지가 서술한 범위(`recordAudit.action` 타입을 도메인별로
한정 + duplicate/importWorkflow 감사 순서·롤백 테스트 대칭)와 정확히 일치하며, 범위 이탈·과잉
리팩토링·무관한 수정을 발견하지 못했다.

### 확인한 근거 (범위 내로 판정한 이유)

- **파일 1** `codebase/backend/src/modules/audit-logs/audit-action.const.ts:93-106` —
  신규 `AuditActionFor<P>` 제네릭 타입 + 그 이유를 설명하는 JSDoc 추가. 커밋이 명시한 "resourceType
  고정인데 action 이 전체 합집합이라 교차 도메인 오기록이 컴파일을 통과하는 결함"을 정확히
  겨냥한 타입 레벨 수정이다. (파일 1~52줄의 거대한 헤더 주석은 이번 커밋 diff 에 포함되지
  않은 이전 라운드 산출물이며, 이번 diff 로 오인해 채점하지 않도록 `git show` 로 사전 확인함.)
- **파일 2** `model-config.service.ts:1-4, 245` — `AuditActionFor` import 추가(멀티라인 포맷은
  기존 파일 1 의 동일 import 스타일과 일치, prettier 산출) + `recordAudit.action` 타입을
  `AuditActionFor<'model_config'>` 로 교체. 호출부(`MODEL_CONFIG_CREATE/UPDATE/DELETE/
  SET_DEFAULT`, 전부 `model_config.*`)와 정합 확인.
- **파일 3** `schedules.service.ts:1-4, 147` — 동일 패턴, `AuditActionFor<'schedule'>`.
  호출부(`SCHEDULE_CREATED/UPDATED/DELETED`)와 정합.
- **파일 4** `triggers.service.ts:1-4, 215` — 동일 패턴, `AuditActionFor<'trigger'>`.
  호출부(`TRIGGER_CREATED/UPDATED/DELETED`)와 정합.
- **파일 6** `workflows.service.ts` — 동일 패턴, `AuditActionFor<'workflow'>`. 호출부
  (`WORKFLOW_CREATED/UPDATED/DELETED`, 4곳)와 정합.
- **파일 5** `workflows.service.spec.ts` — 커밋 메시지가 밝힌 3개 테스트만 추가됨: (1) duplicate
  롤백(감사 미기록) 테스트, (2) importWorkflow 커밋-후 순서 테스트, (3) importWorkflow 롤백 테스트.
  각 테스트에 추가 사유를 설명하는 주석이 붙어 있고, 기존 `create()` 테스트와 동일한 형태를
  재사용해 스타일 일탈이 없다. 무관한 테스트 수정·기존 테스트 리팩토링은 없음.

### 점검 관점별 결론

1. 의도 이상의 변경 — 없음. diff 전체가 "action 타입 도메인 한정" + "duplicate/importWorkflow
   감사 순서·롤백 테스트 대칭" 2개 목적에만 대응.
2. 불필요한 리팩토링 — 없음. `AUDIT_ACTIONS` 인라인 union 재정의를 `AuditActionFor<P>` 로
   교체한 것은 리팩토링이지만 커밋이 명시한 결함(교차 도메인 action 오기록이 컴파일 통과)을
   직접 수정하는 것이라 "관련 없는 정리"가 아니다.
3. 기능 확장(over-engineering) — 없음. 제네릭 타입 하나 추가는 4개 서비스의 동일 결함을
   한 번에 막기 위한 최소 단위이며, 서비스별로 필요한 것 이상의 표면을 넓히지 않았다.
4. 무관한 파일·영역 수정 — 없음. `git show --stat` 기준 6개 파일 전부 위 목적과 직접 연관.
5. 포맷팅 변경 — import 문이 1줄 → 4줄로 바뀐 것은 새 심볼(`AuditActionFor`) 추가에 따른
   불가피한 재포맷(파일 1 의 동일 import 문과 스타일 일치, 별도 커밋 이력에도 prettier
   적용 관례 확인됨)이며 실질 변경과 섞인 노이즈가 아니다.
6. 주석 변경 — 신규 타입/테스트에 대한 설명 주석만 추가됐고, 기존 무관 주석의 추가/삭제/수정은
   없음.
7. 임포트 변경 — 4개 파일 모두 실제로 사용되는 `AuditActionFor` 심볼만 추가. 미사용 임포트나
   불필요한 정리 없음.
8. 설정 변경 — 대상 파일 6개 모두 소스/테스트 코드이며 설정 파일 변경 없음.

## 요약

Payload 는 diff 가 아닌 전체 파일 컨텍스트만 제공했으나, `git show --stat`/`git show` 로
payload 의 파일 6종과 정확히 일치하는 단일 커밋(`c4eddd918`)을 특정해 실제 변경분만 골라
검토했다. 그 결과 이번 변경은 7차 리뷰가 지적한 "recordAudit action 타입이 도메인을
한정하지 못해 교차 리소스 오기록이 컴파일을 통과한다"는 architecture 결함과 "duplicate/
importWorkflow 감사 순서·롤백 테스트 비대칭"이라는 testing 갭, 정확히 두 가지만을 다루며
그 외 리팩토링·기능 확장·무관한 파일 수정·포맷팅 노이즈·불필요한 주석/임포트/설정 변경은
발견되지 않았다. 범위 관점에서 매우 타이트한 변경이다.

## 위험도

NONE
