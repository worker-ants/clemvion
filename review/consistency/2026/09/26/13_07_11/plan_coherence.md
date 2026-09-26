# Plan 정합성 검토 — `spec-draft-swagger-success-advert.md`

## 발견사항

- **[WARNING]** Rationale 변경(4)이 아직 완료되지 않은 구현 plan 을 "완료된 경로"로 인용
  - target 위치: `plan/in-progress/spec-draft-swagger-success-advert.md` — 변경 (4), 새 Rationale 불릿 "뒤이은 PR(`plan/complete/success-advert.md`)이 11곳을 채웠고(…)"
  - 관련 plan: `plan/in-progress/success-advert.md` (frontmatter `status: in-progress`, 체크리스트 9항목 전부 `[ ]` — 래퍼·DTO·광고 11곳, 가드 강화, e2e, 뮤턴트, `/ai-review`, `--impl-done`, 트래커 닫기 모두 미완)
  - 상세: 이 draft(`--spec`)는 `요구` 순서상 구현(2~7단계) **이전**에 반영(planner 커밋)되는데, 그 시점에 `success-advert.md` 는 `plan/complete/` 가 아니라 `plan/in-progress/` 에 있다. `.claude/docs/plan-lifecycle.md §3` 은 "spec 등 살아있는 문서의 plan 링크는 이동과 **동시에** 갱신"하라고 명시한다 — 즉 살아있는 spec 문서가 아직 일어나지 않은 이동을 미리 서술하는 흐름과 반대 방향이다. 동일 저장소의 직전 사례(`post-status-openapi`)의 §2-4 Rationale 은 이 문제를 피하려는 듯 plan 파일 **경로를 전혀 인용하지 않고** 측정 사실만 직접 서술한다 — 이번 draft 가 그 관례에서 벗어나 특정 파일 경로(`plan/complete/success-advert.md`)를 못박은 것이 새로운 패턴이다. `success-advert.md` 자체가 구현 도중 범위가 바뀌면(예: 11곳이라는 수, e2e 라운드에서 드러날 수 있는 추가 처방, `/ai-review` 후 조치) 이 문장은 조용히 stale 해진다 — `feedback_stale_plan_claims_and_checklist_sync` 가 이미 지적한 실패 형태와 같다.
  - 제안: (a) 이 불릿에서 특정 plan 파일 경로 인용을 빼고 측정 사실만 서술하거나(직전 PR 의 관례를 따름), (b) 굳이 경로를 남긴다면 지금은 `plan/in-progress/success-advert.md` 로 적고 `--impl-done` 시점(플랜이 실제로 `complete/` 로 이동하는 커밋)에 함께 `plan/complete/` 로 정정 — 두 경우 모두 "11곳" 등 구체 수치가 구현 종료 시점까지 변하지 않았는지 `--impl-done` 리뷰에서 재확인.

- **[INFO]** "정하지 않는 것" 카브아웃 2건이 트래커 후속 항목으로 등재되지 않음
  - target 위치: `plan/in-progress/spec-draft-swagger-success-advert.md` — 상단 "**정하지 않는 것**" 문단(리다이렉트 라우트의 광고 형식 · SSE 이벤트 본문의 스키마화)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커) — 이 두 카브아웃에 대응하는 항목 없음. `plan/in-progress/success-advert.md` 의 "요구" 7단계도 "트래커 항목 닫기"만 있고 신규 등재 지시가 없음
  - 상세: 직전 완료 plan(`post-status-openapi.md`)은 자신이 명시적으로 미룬 모든 판단(W4 "자원을 만들지 않는 POST 칸", W5 등)을 트래커에 등재해 다음 사람이 잃지 않게 했다. 이번 draft 의 두 카브아웃도 같은 성격이지만, (a) 리다이렉트 광고 형식은 3xx 데코레이터 종류를 정하는 것이라 향후 실제로 판단이 필요할 수 있고, (b) SSE 이벤트 본문 스키마화는 §1-4 "열린/동적 map"·EIA "봉투만 스키마화" 선례로 이미 답이 나와 있는 문제라 실제로는 새 결정이 필요 없을 가능성이 높다 — 그래서 CRITICAL/WARNING 은 아니고 추적 메모 권장 수준이다.
  - 제안: (b)는 등재 불요로 판단해도 되지만, (a)는 실제로 다음에 `@ApiFoundResponse` 외 다른 3xx(`@ApiPermanentRedirectResponse` 등)를 쓰는 라우트가 생길 때를 대비해 트래커에 한 줄만 남기는 편이 안전.

## 요약
target spec draft 는 `success-advert.md`(구현 plan)와 트래커 `spec-draft-nullable-notation-followups.md` 의 "성공 응답을 광고하지 않는 라우트 핸들러가 15곳" 항목이 이미 제안해 둔 처방("광고를 채운 뒤 가드를 조인다")을 그대로 집행하는 것으로, 미해결 결정을 우회하거나 다른 plan 의 전제를 깨는 지점은 찾지 못했다. §5-2 신규 래퍼(`ApiOkWrappedNullableResponse`)는 `api-convention §5.4`의 null 선언 규칙 및 `frontend/src/lib/api/assistant.ts` 의 기존 소비 형태와 일치하고, 3xx 를 성공 광고로 인정하는 결정은 `auth.controller.ts` 의 기존 `@ApiFoundResponse` 실측과 부합한다. 유일한 실질적 흠은 아직 완료되지 않은 짝 plan(`success-advert.md`)을 이미 `plan/complete/` 로 이동한 것처럼 인용하는 Rationale 문장 하나로, 이는 plan lifecycle 의 "인입 참조는 이동과 동시에" 원칙과 어긋나는 시점 문제이며 구현이 예정대로 끝나면 자연히 해소되지만 스코프가 조금이라도 바뀌면 stale 서술이 된다.

## 위험도
LOW
