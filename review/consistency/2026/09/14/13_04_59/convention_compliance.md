# 정식 규약 준수 검토 — convention_compliance

## 검토 범위와 방법

target 은 `spec/conventions/` (scope 델타 0 — 이 PR 은 그 영역을 바꾸지 않았다). 실제 구현
diff 는 `codebase/` 6개 파일(트리거 비밀 컬럼 3중 사본 정합 가드 + 캐너리 표기 정리 +
schedule/e2e teardown 보강)이며, HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-canary-hardening-a71e04`)를 절대경로로 직접 열어 다음을 대조했다:

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` (신규)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (표기 정정)
- `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` / `schedule-trigger.e2e-spec.ts` / `trigger-workflow-ref.e2e-spec.ts` (주석·양성 케이스 보강)

대조 대상 규약: `spec/conventions/secret-store.md`, `spec/conventions/review-citations.md`,
`spec/conventions/swagger.md`, `plan/in-progress/trigger-canary-hardening.md`(spec_impact 선언).

## 발견사항

### INFO — `secret-store.md §R4` 의 메서드명이 실제/자기 문서 §6 과 다르다 (PR 이전부터 존재)

- target 위치: `spec/conventions/secret-store.md` `### R4. Trigger FK 미설정` (약 428행)
- 위반 규약: 같은 문서 `## 6. Trigger 삭제 시 cascade` (약 390행) — 자기 정합성
- 상세: §R4 는 "trigger 삭제 시의 명시적 cleanup 책임은 **`TriggersService.delete()`** 가
  진다" 라고 적었는데, 같은 문서 §6 은 "`TriggersService.remove()` 가 개별 `delete()` 가
  아닌 `deleteByPrefix(...)` 로 일괄 삭제" 라고 적어 **메서드명이 서로 다르다.** 실제 코드
  (`codebase/backend/src/modules/triggers/triggers.service.ts:842`)도 `remove()` 이므로
  §6 이 맞고 §R4 가 낡았다. 이번 PR 의 `trigger-workflow-ref.e2e-spec.ts` 신규 주석이
  정확히 이 §R4 를 인용하며 "`remove()` → `deleteByPrefix`" 라고 **올바르게** 서술하므로,
  이 PR 이 이 드리프트를 만든 것은 아니고 오히려 정확한 쪽(§6/코드)을 인용했다. 다만 같은
  절을 다루는 PR 이 지나가는 자리이므로 지금 정정하면 다음 사람이 §R4 를 그대로 믿고 잘못된
  메서드명을 인용할 위험을 없앨 수 있다.
- 제안: `spec/conventions/secret-store.md` §R4 의 `TriggersService.delete()` 를
  `TriggersService.remove()` 로 정정 (본 PR 의 diff-base 는 `spec/conventions` 델타 0 이라
  범위 밖일 수 있음 — 이번 PR 에서 필수로 요구하지는 않는다. `project-planner` 턴에서 처리
  권장).

### 관찰 (위반 아님) — 신규 가드가 `secret-store.md` 자신이 예고한 드리프트 위험을 정확히 메운다

- target 위치: `spec/conventions/secret-store.md` 69~77행 (`#1291`/`#1308` 정정 각주)
- 상세: 이 문서는 이미 "`TriggersService` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS`" 와
  `shared/testing/schedule-trigger-ref.ts` · `shared/testing/trigger-workflow-ref.ts` 두
  단언 자리를 "**한쪽만 보강하면 다른 쪽이 낡는다 — 함께 갱신한다**" 라고 스스로 경고해
  두었다. 신규 `trigger-secret-columns-guard.ts`/`trigger-secret-columns.spec.ts` 는 정확히
  이 세 자리(정본 1 + 사본 2)의 리터럴 동일성을 AST 로 고정해, 문서가 예고만 하고 강제하지
  않던 위험을 실제로 강제한다. 명명(`<name>-guard.ts` + `<name>.spec.ts`)도
  `redis-fail-open-catalog-guard.ts`/`masked-reject-callers-guard.ts` 선례와 정확히
  일치한다 — 명명 규약 위반 없음.
- 제안 (선택): `secret-store.md` 70~77행에 이 신규 가드 경로를 각주로 추가하면 문서의
  "함께 갱신한다" 라는 수기 경고가 이제 자동 강제됨을 다음 독자가 알 수 있다. 필수는 아님
  (plan 의 `spec_impact: none` 은 이 범위의 판단으로 합리적 — 새 공개 convention 을 만드는
  것이 아니라 기존 규약이 이미 서술한 위험의 시행 코드를 추가하는 성격).

### 검토했지만 위반 없음

- **리뷰 인용 형식** (`spec/conventions/review-citations.md` §2/§3): 신규·수정 diff 의 모든
  리뷰 인용이 전체 경로 형식(`review/code/2026/09/14/11_27_40 maintainability WARNING#2` 등)
  을 쓴다 — bare `hh_mm_ss` 없음. §3 적용 대상(`codebase/**` 의 `//`/JSDoc 주석)과 일치하고
  응답 DTO JSDoc 도 아니므로 적용 예외 문제도 없다.
- **DTO/Swagger 규약** (`spec/conventions/swagger.md`): 이번 diff 는 신규 DTO·엔드포인트를
  도입하지 않는다(`TriggerDto`/`ScheduleDto` 는 기존). 데코레이터·명명 위반 없음.
  `assertMatchesContract(row, await contractForDto(TriggerDto))` 사용도 기존 패턴 그대로다.
- **§5.4 부재 표현 규약** (`5-system/2-api-convention.md#54`, spec/conventions 밖이지만
  코드 주석이 인용): `schedule-trigger.e2e-spec.ts` 신규 주석이 "`TriggerDto.workflow` 는
  §5.4 키 생략형이라 계약 대조가 부재를 위반으로 보지 않는다" 고 서술 — `spec/2-navigation/2-trigger-list.md:182`·`3-schedule.md:153` 의 기존 판정과 일치한다(직접 대조 완료). 오기재
  없음.
- **명명 규약**: `repo-guards/__tests__/` 디렉터리의 기존 20여 개 가드 파일과 대조한 결과
  `trigger-secret-columns-guard.ts`/`trigger-secret-columns.spec.ts` 파일명·구조가 그대로
  선례를 따른다.
- **spec_impact 선언**: `plan/in-progress/trigger-canary-hardening.md` frontmatter 의
  `spec_impact: none` 은 본 PR 이 순수 test/guard 하드닝이고 신규 공개 규약을 도입하지
  않는다는 점과 일치한다(Gate C 형식도 준수 — bare `none`).

## 요약

이 PR 은 `spec/conventions/` 자체를 바꾸지 않으며(정상), 실제 코드 diff 는 기존
`spec/conventions/secret-store.md` 가 스스로 예고했던 "정본-사본 드리프트" 위험을 AST 가드로
메우는 성격이다. 신규 파일 명명·구조는 `repo-guards/__tests__/` 기존 선례와 정확히 일치하고,
리뷰 인용 형식·§5.4 부재 표현 인용·DTO/Swagger 규약 모두 대조 결과 위반이 없었다. 유일한
발견은 `secret-store.md §R4` 의 메서드명(`delete()`)이 같은 문서 §6·실제 코드(`remove()`)와
어긋나는 **PR 이전부터 존재하던** 드리프트이며, 이번 PR 이 만든 것도 아니고 이번 PR 의
새 주석은 오히려 정확한 이름(`remove()`)을 인용했다.

## 위험도

LOW
