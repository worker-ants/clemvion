# Cross-Spec 일관성 검토 — `dto-class-jsdoc-citation` (--impl-prep, scope=`spec/conventions/`)

## 검토 대상

- 이미 반영된 spec 변경(같은 PR 의 planner 턴, 커밋 `c8bf27c8e`): `spec/conventions/review-citations.md` §3·Rationale, `spec/conventions/swagger.md` §3 — "응답 DTO **클래스** `/** */` JSDoc 도 필드와 같이 인용을 쓰지 않는다"
- 착수 예정 developer plan: `plan/in-progress/dto-class-jsdoc-citation.md` (spec_impact: none)
- 영향받는 코드: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` (`TriggerWorkflowRefDto`), `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` (`ScheduleTriggerWorkflowRefDto`), 가드 `dto-jsdoc-citation-guard.ts`/`dto-jsdoc-citation.spec.ts`

## 확인한 교차 지점

1. **`review-citations.md` §3 ↔ `swagger.md` §3 (짝 규약)** — 두 문서가 서로를 링크하며 같은 결정("클래스 JSDoc 도 필드처럼 인용을 쓰지 않는다, 회피처는 바로 위 `//`")을 동일하게 반영한다. `swagger.md` L605-608 이 `review-citations.md §3` 을 가리키고, `review-citations.md` L241 이 `swagger.md §3` 을 가리켜 양방향 미러가 깨지지 않았다.
2. **`code:` 필드의 "준수 예시 vs 시행 코드" 구분 ↔ `spec-impl-evidence.md` §2.1** — `review-citations.md` 의 `code:` 가 `dto-jsdoc-citation*.ts` 를 "시행 코드"로, 나머지를 "준수 예시"로 인라인 주석으로 구분하는 관행은 `spec-impl-evidence.md` §2.1 의 "축 단위로 code: 를 섞어 담아도 된다(2026-09-06 이후 안전)" 예외 조항과 정확히 일치한다. 두 문서 사이에 모순 없음.
3. **DTO 소유권(`code:`) — `2-navigation/2-trigger-list.md`, `3-schedule.md`** — plan 이 "두 DTO 는 각 화면 spec 의 `code:` 가 소유"라고 주장한 부분을 실측: `2-trigger-list.md` 는 `codebase/backend/src/modules/triggers/dto/**` 를, `3-schedule.md` 는 `codebase/backend/src/modules/schedules/dto/**` 를 이미 `code:` 에 담고 있어 plan 의 `spec_impact: none` 판단과 부합한다. 이번 변경(클래스 JSDoc → `//` 주석 이동)이 새 spec 표면을 만들지 않으므로 이 두 nav-spec 을 함께 갱신할 필요는 없다.
4. **다른 `spec/conventions/*` 와의 스코프 중복 여부** — 저장소 전체 `spec/conventions/*.md` 를 대상으로 "리뷰 인용"·"review/consistency/"·"review/code/" 관례를 다루는 다른 문서가 있는지 grep 했으나 `review-citations.md`·`swagger.md` 외에는 없다. 인용 관례를 두 곳에서 따로 정의해 어긋날 여지는 없음.
5. **"클래스 JSDoc 이 OpenAPI 로 나간다"는 주장의 유일성** — `spec/**` 전체에서 "클래스 JSDoc"·`ApiSchema`·`introspectComments` 를 언급하는 자리를 확인했다. `spec/4-nodes/3-ai/1-ai-agent.md` L337 에 "클래스 JSDoc" 언급이 하나 더 있으나 `AiTurnExecutor` 의 return-vs-throw 계약 설명이라 OpenAPI/DTO 노출과 무관 — 이번 변경과 충돌하지 않는다.
6. **현재 코드 상태와 spec 의 시점 정합** — 두 DTO 파일은 아직 클래스 JSDoc 끝에 구식 인용(`review/consistency/2026/09/06/00_48_52 W2`)을 담은 채이고, 바로 위 `//` 블록에는 이미 "내부 서사를 `//` 에 두는 이유: swagger.md §3 · review-citations.md §3" 문구가 있다 — 즉 규약(§3 마지막 절)은 갱신됐지만 코드는 아직 그 규약을 어기는 상태다. 이는 plan 이 스스로 "동결된 두 자리"로 정확히 지목한 상태이며, 구현 착수 전 시점의 **정상적인 과도 상태**다(모순이 아니라 착수 사유).

## 발견사항

교차 영역 충돌 없음. 위 6개 지점 모두 정합적이며, target 문서(§3 개정)가 다른 `spec/**` 영역의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임과 충돌하는 지점을 찾지 못했다.

## 요약

`review-citations.md` §3 과 짝 규약 `swagger.md` §3 의 개정("응답 DTO 클래스 JSDoc 도 필드처럼 인용을 쓰지 않는다")은 두 문서가 서로를 정확히 미러링하고, `spec-impl-evidence.md` 의 `code:` 필드 정의 예외 조항과도 부합하며, 영향받는 두 DTO 는 이미 해당 nav-spec(`2-trigger-list.md`/`3-schedule.md`)의 `code:` glob 범위 안에 있어 `spec_impact: none` 판단이 타당하다. 저장소 전체에서 인용 관례나 "클래스 JSDoc → OpenAPI" 주장을 달리 서술하는 다른 spec 영역도 발견되지 않았다. Cross-Spec 관점에서 이 착수를 막을 요인은 없다.

## 위험도

NONE
