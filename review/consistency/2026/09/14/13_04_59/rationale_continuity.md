# Rationale 연속성 검토 — trigger-canary-hardening (impl-done, 2026-09-14 13:04)

## 검토 범위와 방법

target scope(`spec/conventions/`) 델타는 **0개** — 이 브랜치는 spec 을 편집하지 않는 순수 코드
하드닝이다 (`plan/in-progress/trigger-canary-hardening.md`, `spec_impact: none`). 번들의 diff
섹션은 예산으로 절단돼 있으므로, 실제 코드 diff 는 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-canary-hardening-a71e04`)에서
`git diff origin/main -- codebase/` 로 직접 확인했다 — `codebase/` 변경 6개 파일 (누적, 라운드
1~4 전체):

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` (신규 — AST 리더)
- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` (신규 — 3중 사본
  정합 가드 + 분기별 대조군, 라운드 1~4에 걸쳐 누적 보강)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (헤더 주석 번호 표기 정리)
- `codebase/backend/test/{chat-channel-trigger-create,trigger-workflow-ref}.e2e-spec.ts`
  (teardown 註 재작성 — `secret-store.md §R4` 명시 인용)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`expectTriggerWorkflowRef` 3건 신규 배선)

동일 세션에서 이미 네 차례 rationale_continuity 검토가 돌았다 (`review/consistency/2026/09/14/
{10_44_37,11_27_47,11_52_23,12_17_21,12_37_09}` — impl-prep LOW → impl-done NONE ×4). 직전
회차(`12_37_09`)는 라운드 3 커밋(`1a99f07a4`)까지 포함해 NONE 으로 결론지었다. 본 검토는 그
**이후 추가된 라운드 4 커밋**(`026fbb610`, "같은 형태 다섯 번째라 산문을 «분기↔대조군 대응표»
로 바꿨다")까지 포함한 최종 상태(`git log` HEAD)를 대상으로 델타 위주로 재대조했다.

라운드 4 의 `codebase/` 변경은 `trigger-secret-columns.spec.ts` 에 32줄 추가뿐이다 — `null`/`[]`
경계의 미대조 진입로("이름은 맞는데 초기값이 배열 아님")에 대조군 테스트를 추가하고, 그 위에
"분기 ↔ 대조군 대응표"(7행 마크다운 테이블)를 얹었다. 가드의 파싱 로직·정본/사본 설계는
불변이다. 나머지는 `plan/in-progress/{trigger-canary-hardening,spec-draft-nullable-notation-
followups}.md` 갱신(수치 정정·체크박스 동기화·stale `delete()` 오기 3곳 등재)으로 `plan/**`
범위이며 spec Rationale 대상이 아니다.

직접 대조한 spec: `spec/conventions/secret-store.md`(§R4·§2.1), `spec/2-navigation/
2-trigger-list.md §R-17`(캐너리가 고정하는 것은 구현이지 계약이 아니다), `spec/2-navigation/
3-schedule.md §4`, `spec/1-data-model.md`(응답 경계 secret-strip 원칙), `spec/conventions/
review-citations.md §1·§2·§4`, `spec/conventions/audit-actions.md`(트리거 시크릿 회전 액션
레지스트리 — 비대상 확인). `CREATOR_PROJECTION` 인용은 `codebase/backend/src/modules/
workflow-versions/workflow-versions.service.ts` 에 실재함을 grep 으로 확인했다(지어낸 선례 아님).

## 발견사항

없음 — CRITICAL·WARNING 수준의 발견 없음.

## 확인된 정합 사항 (참고용, 비대상 확인)

- **`secret-store.md §R4`(Trigger FK 미설정 — explicit application 경로 정리, implicit
  cascade 기각)와 충돌하지 않는다.** `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 註는 raw
  `DELETE FROM trigger` 로 `secret_store` 고아 row 를 남기는 기존 e2e teardown 관례를
  유지하면서, R4 가 요구하는 대상은 **프로덕션 삭제 경로**(`TriggersService.remove()` →
  `deleteByPrefix`)이고 그 경로는 R4 대로 동작한다고 명시적으로 범위를 좁혔다(테스트 인프라
  한정 예외를 문장으로 못박음). 종전 "미검증"이었던 자리를 두 실측(세션 간 `e2e-down`=`docker
  compose down -v` 볼륨 삭제 · 세션 내 유일한 소비 e2e 가 `ref LIKE <접두>` 로 스코프됨)으로
  "검증됨"으로 정정했다 — **결정을 뒤집은 것이 아니라 같은 결정에 근거를 보강한 사례**이며 새
  근거를 함께 실었으므로 등급 기준 3("결정의 무근거 번복")에 해당하지 않는다. 이 사고 과정에서
  드러난 `TriggersService.delete()`(실제는 `remove()`) 라는 spec 오기 3곳은 developer 가 직접
  고치지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 턴
  항목으로 이관했다 — 권한 경계를 지켰다. 그중 `migrations/V063__secret_store.sql:20` 은 Flyway
  체크섬 검증 때문에 "고치면 안 된다"는 판단까지 근거와 함께 트래커에 남겼다.
- **라운드 4 신규 대조군은 기존 설계 원칙을 그대로 유지한다.** 추가된 "선언은 있는데 배열이
  아니면 `null`" 케이스는 가드 JSDoc 이 이미 명시한 "`[]`(비었다)와 `null`(못 읽었다)을
  가른다"는 약속의 누락된 진입로를 메우는 것으로, 새 파싱 규칙이나 정본/사본 구분 원칙을
  도입하지 않는다 — "문서한 보장이 구현보다 넓으면 안 된다"는 이 저장소의 기록된 원칙을 테스트
  스위트 안에서 스스로 지킨 사례다. "분기 ↔ 대조군 대응표" 신설도 형제 캐너리
  (`trigger-workflow-ref.spec.ts`)의 "가드 실행 순서 목록"과 같은 장치로, 새 관례를 만드는 게
  아니라 이미 있는 관례를 이 파일에 옮겨 적용한 것이다.
- **AST vs 정규식 경계 판단이 저장소 선례와 계속 일치.** `readStringArrayConst` 는
  `ts.createSourceFile` 기반 AST 파싱을 쓰며 "정규식이면 JSDoc 예시 문자열이 값으로 잡혀
  가드가 자기 오판을 사실로 굳힌다"는 `redis-fail-open-catalog-guard.ts` 와 동일한 근거를
  명시한다.
- **"런타임 공유 대신 정적 가드" 설계 선택은 무근거 번복이 아니다.** diff 가 "정본이 export 가
  아니고 `shared/testing/` → `modules/` 역방향 의존을 피한다"는 이유를 명시하며,
  `CREATOR_PROJECTION` 선례(동일 리터럴 4중 복사가 Critical 로 터진 뒤 단일 상수로 통합)와의
  차이를 스스로 설명한다 — 이 선례는 실재 코드로 확인됨(위 참조).
- **`review-citations.md` 와 충돌 없음.** 라운드 3~4 에 걸쳐 추가된 리뷰 인용은 전체경로 +
  WARNING 번호를 포함하는 §2 권장 형식을 따른다. §1(`review/**` 산출물이 커밋되어 이력으로
  해소된다)·§4(bare 인용 일괄 치환 금지)와도 무관하다.
- **응답 경계 secret-strip 원칙과 정합.** `trigger-secret-columns-guard.ts`/`.spec.ts` 는
  정본(`TRIGGER_RESPONSE_STRIP_COLUMNS`, 비-export) + 사본 둘의 값·순서 동일성을 정적으로
  강제할 뿐, 컬럼 수준 `select: false` 로 되돌리거나 원칙을 우회하지 않는다. `audit-actions.md`
  의 트리거 시크릿 회전 액션 레지스트리(§3)는 본 diff 가 건드리지 않는다.
- **`2-trigger-list.md §R-17`("캐너리가 고정하는 것은 구현이지 계약이 아니다")과 정합.**
  `schedule-trigger.e2e-spec.ts` 에 추가된 `expectTriggerWorkflowRef(…, {present: true})` 3건
  (C-2 목록·G·H PATCH)은 R-17 이 다루는 "생성 응답에만 부재" 축(`trigger-workflow-ref.e2e-spec
  .ts`)을 건드리지 않고 **다른 표면**(schedule 타입 트리거)에 양성 커버리지를 추가한 것이다.
  음성 대조가 이 표면에 없는 이유(schedule 트리거는 `POST /api/triggers` 로 생성되지 않아 생성
  응답 자체가 없다)도 plan 에 명시돼 R-17 이 요구하는 "고칠 대상은 캐너리가 아니라 spec 서술"
  원칙과 배치되지 않는다.

## 참고 (Rationale 연속성 범위 밖 — 이미 planner 턴 항목으로 등재됨)

- `secret-store.md §R4` / `1-data-model.md` 의 `TriggersService.delete()` → 실제 `remove()`
  오기, 신규 repo-guard 의 spec `code:` 미등재(및 그 판정에 쓰인 표본 대 전수 수치 정정 이력)는
  모두 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 턴 대상으로 이미
  기록돼 있다 — spec-impl-evidence 커버리지·오탈자 성격이며 Rationale 위반이 아니다.

## 요약

라운드 4 커밋(`026fbb610`)까지 포함한 최종 diff(`trigger-canary-hardening`)는 `spec/
conventions/` 를 전혀 편집하지 않는 순수 코드 하드닝이며, `secret-store.md §R4`·응답 경계
secret-strip 원칙·`review-citations.md`·`2-trigger-list.md §R-17`·repo-guard AST 경계 등 기존
`## Rationale`/합의 원칙과 대조한 결과 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복,
invariant 우회 어느 것도 발견되지 않았다. 라운드 4 의 유일한 코드 변경(대조군 테스트 1건 + 대응표
신설)은 기존 가드 설계·JSDoc 이 이미 약속한 범위를 실제로 잠그는 순수 견고화이고, teardown 근거를
`secret-store.md §R4` 에 명시적으로 정렬시킨 처리는 "결정 번복 시 새 Rationale 동반" 원칙의
모범 사례에 가깝다. 앞선 다섯 라운드의 결론(LOW→NONE→NONE→NONE→NONE)과 일치하며, 이번 재검토도
독립적으로 같은 결론에 도달했다.

## 위험도

NONE
