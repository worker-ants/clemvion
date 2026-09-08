# 신규 식별자 충돌 검토 — naming_collision

## 검토 조건 요약

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- **`spec/5-system/` 델타: 0개 파일** — `git diff origin/main...HEAD -- spec/` 실측으로도 0.
  plan(`plan/in-progress/spec-followups-batch-b.md`)의 `spec_impact: none` 과 일치하며, 그
  문서 자체가 "처음엔 `2-trigger-list.md` 로 오기했다가 실측 후 `none` 으로 정정했다" 는 이력을
  적어 두고 있다 — 신뢰할 만한 근거.
- 구현 diff 는 워킹트리에서 직접 `git diff origin/main...HEAD` 로 재구성해 확인함 (프롬프트
  번들의 diff 섹션은 예산 절단으로 비어 있었음). 실제 diff: `codebase/`, `.claude/`, `scripts/`,
  `PROJECT.md`, `CHANGELOG.md`, `plan/in-progress/**` 28개 파일 (review/ 산출물 제외).

target 문서가 `spec/5-system/` 을 바꾸지 않았으므로, "target 이 새로 도입하는 요구사항 ID·
엔티티명·API endpoint·이벤트명·ENV var·spec 파일 경로" 자체가 존재하지 않는다. 따라서 본 체커의
1차 관점(spec 신규 식별자 vs 기존 spec)은 대상이 없다. 대신 구현 diff 가 실제로 새로 도입한
식별자(함수명·상수명·타입명·에러 코드)를 전수 확인해 기존 spec/코드 사용처와 충돌 여부를 점검함.

## 발견사항

새로 도입되거나 개명된 식별자를 모두 확인했으며, 충돌 소견 없음.

- **`enclosingScopeName`** (신규 export, `common/__test-utils__/source-scan.ts`) — 기존
  `user-entity-exposure-guard.ts` 의 사설 `enclosingName` 을 승격·치환한 것. `spec/`·타 코드
  영역 어디에도 동명 식별자 없음. 순수 리팩터(중복 제거), 충돌 없음.
- **`WorkflowVersionDetail` → `WorkflowVersionDetailProjection`** (백엔드
  `workflow-versions.service.ts`) — 이것은 신규 충돌이 아니라 **기존 충돌의 해소**다. 프런트엔드
  `lib/api/workflows.ts` 에 형태가 다른 동명 인터페이스가 있어 과거 3라운드 연속 "유일 정의"
  오판을 냈던 것(review/consistency 2026-09-06 W3·W5)을 이번에 백엔드 쪽을 개명해 이름 축을
  닫았다. `spec/5-system/**` grep 결과 `WorkflowVersionDetail(Projection)?` 참조 0건 — spec
  쪽 재충돌 가능성 없음.
- **`CONFLICT_WRAPPER`/`TRIGGER_REPOSITORY`/`findTriggerRepositorySaves`/
  `findUnwrappedTriggerSaves`** (신규 파일 `repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
  등) — repo-guard 테스트 전용 내부 식별자. 참조하는 `rethrowEndpointPathConflict` 는
  `triggers.service.ts` 에 이미 존재하던 private 메서드(이번 diff 로 신규 도입된 것이 아님,
  `git diff` 상 무변경 확인)이며 spec 표면 식별자가 아니다.
- **`pgErrorConstraint`** — `common/db/pg-error.ts` 에 이미 존재하던 함수(이번 diff 무변경).
  `integration-oauth.service.ts` 가 인라인 추출 로직 대신 이 기존 헬퍼를 쓰도록 바뀐 것뿐.
- **`TRIGGER_ENDPOINT_PATH_CONFLICT`** (신규 e2e 케이스 `webhook-trigger.e2e-spec.ts` B4) —
  이미 `spec/2-navigation/2-trigger-list.md`(§Webhook Configuration 표·L166)와
  `triggers.controller.ts`/`triggers.service.ts` 에 기존 정의된 세부 에러 코드다. 이번 PR 은
  실 DB 대상 e2e 검증을 추가했을 뿐 신규 코드가 아니다. 충돌 없음.
- **`_cmd_typecheck_ratchets`** (`.claude/test-stages.sh` 신규 셸 함수) — harness 스크립트 내부
  식별자, spec/제품 표면과 무관.
- 신규 API endpoint·webhook/queue/SSE 이벤트명·ENV var·config key·spec 파일 경로는 diff 전체에
  걸쳐 **하나도 도입되지 않았다** (`tsconfig.build.json` exclude 패턴 추가, `select` 투영 추가는
  모두 기존 표면의 내부 구현 방식 변경).

## 요약

이번 diff 는 spec/5-system 을 전혀 건드리지 않았고(실측 0파일, plan 의 `spec_impact: none` 과
합치), 구현 코드가 도입한 식별자도 (1) 순수 내부 리팩터/중복 제거, (2) 기존 코드 헬퍼 재사용,
(3) 이미 spec 에 정의된 에러 코드에 대한 e2e 검증 추가, (4) 과거 실제 충돌(`WorkflowVersionDetail`
동명 타입)을 해소하는 개명 뿐이다. 신규 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수·
spec 파일 경로 중 기존 사용처와 부딪히는 사례를 찾지 못했다.

## 위험도

NONE
