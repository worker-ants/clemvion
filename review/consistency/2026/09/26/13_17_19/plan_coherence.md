# Plan 정합성 검토 — success-advert (--impl-prep)

## 검토 범위

- Target: `spec/conventions/swagger.md`(§2-4·§5-2·§5-4 갱신본) + `--impl-prep` scope 에 함께 실린 관련 spec 6종
  (`spec/2-navigation/2-trigger-list.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `spec/5-system/1-auth.md`,
  `spec/5-system/2-api-convention.md`, `spec/5-system/14-external-interaction-api.md`).
- 대응 plan: `plan/in-progress/spec-draft-swagger-success-advert.md`(planner, 완료 — spec 반영됨) ·
  `plan/in-progress/success-advert.md`(developer, 이번에 착수 예정) · 트래커
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(6206줄, 관련 항목만 직접 열람).
- 예산 초과로 프롬프트에서 생략된 4개 spec 파일(`4-ai-assistant.md`·`1-auth.md`·`2-api-convention.md`·
  `14-external-interaction-api.md`)과 트래커 본문은 스크래치패드/저장소 원본을 직접 Read 로 열어 확인했다.

## 발견사항

- **[WARNING] `sessions/latest` 엔드포인트가 ai-assistant.md §6 REST API 표에 아예 없다**
  - target 위치: `spec/conventions/swagger.md` §5-2 (신설 `ApiOkWrappedNullableResponse`) — 이 헬퍼의 최초 적용
    대상이 바로 `workflow-assistant` `GET /api/workflow-assistant/sessions/latest` (nullable 세션 응답)이다.
  - 관련 plan: `plan/in-progress/success-advert.md` "실측" 표의 workflow-assistant 세션 CRUD 6곳(`list`·`latest`·
    `findOne`·`create`·`update`·`remove`) 중 `latest`.
  - 상세: `spec/3-workflow-editor/4-ai-assistant.md` §6 "REST API (세션/메시지 관리)" 표는 `GET /sessions?workflowId`·
    `POST /sessions`·`GET /sessions/{id}`·`PATCH /sessions/{id}`·`DELETE /sessions/{id}`·
    `POST /sessions/{id}/messages` 6행뿐이고, 실제 컨트롤러(`workflow-assistant.controller.ts:73`)에 있는
    `GET /sessions/latest`(§6.1 "세션 자동 선택 규칙"의 구현체)는 표에 없다 — grep 0건으로 확인. 지금까지는 이
    엔드포인트가 OpenAPI 에도 성공 응답이 광고되지 않아 눈에 덜 띄었지만, `success-advert.md` 가 여기에
    `ApiOkWrappedNullableResponse` 를 달아 정식으로 문서화하면 **생성된 OpenAPI 는 이 라우트를 정확히 광고하는데
    손으로 쓴 제품 spec(§6 표)은 여전히 그 존재조차 언급하지 않는** 격차가 지금보다 뚜렷해진다. 두 plan
    (`spec-draft-swagger-success-advert.md`·`success-advert.md`) 어느 쪽도 `spec_impact` 에
    `spec/3-workflow-editor/4-ai-assistant.md` 를 넣지 않았고, 트래커에도 이 표 갱신 항목이 없다(grep 0건) — 이
    변경의 후속으로 누구도 소유하지 않는 gap 이다.
  - 제안: `success-advert.md` 요구 목록에 "ai-assistant.md §6 표에 `GET /sessions/latest` 행 추가"를 한 줄
    더하거나(구현 PR 범위), 별도 낮은 우선순위 트래커 항목으로 등재한다. 응답 wire shape 자체는 바뀌지 않으므로
    (엔티티 그대로 반환 → 같은 모양의 DTO) 계약 변경은 아니지만, 표의 완전성 문제로 남는다.

- **[INFO] `success-advert.md` 체크리스트가 이미 끝난 단계를 미체크로 남기고 있다**
  - target 위치: 해당 없음(plan 자체의 상태 서술).
  - 관련 plan: `plan/in-progress/success-advert.md` "체크리스트" — `[ ] spec draft `--spec` · 반영`.
  - 상세: `git log --oneline -- plan/in-progress/success-advert.md` 는 이 plan 파일이 `0ae33add6`
    (spec draft 와 함께 생성) 한 커밋뿐이고, 그 뒤 `24084fd0e`(`docs(spec): swagger §2-4 ... §5-2
    ApiOkWrappedNullableResponse`)가 실제로 spec 을 반영했다 — 즉 "spec draft `--spec` · 반영" 단계는 이미
    완료됐는데 plan 파일의 체크박스는 갱신되지 않았다. 지금 수행 중인 `--impl-prep` 자체도 다음 단계라
    당장 실행에 지장은 없지만, 이 상태로 두면 다음에 이 plan 을 여는 사람이 "spec 반영이 아직 안 됐다"고
    오독할 수 있다.
  - 제안: developer 가 이번 `--impl-prep` 통과 후 커밋할 때 두 체크박스(`spec draft --spec·반영`, `--impl-prep`)를
    함께 체크한다.

- **[정보성 — 문제 아님] 미해결 결정("자원을 만들지 않는 POST" 상태 코드 분류)은 target 이 우회하지 않았다**
  - target 위치: `spec/conventions/swagger.md` §2-4 Rationale 마지막 문단
    ("§2-4 · api-convention §6 표에는 «자원을 만들지 않는 POST» 칸이 없다 — 그 명문화는 별 결정이다(트래커 등재)").
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4881` — planner 소관, 낮은 우선순위,
    착수 조건 없음.
  - 상세: 실제로 `spec/5-system/2-api-convention.md` §6 상태 코드 표에는 아직 그 칸이 없음을 직접 확인했다 —
    target 은 이 미해결 결정을 일방적으로 내리지 않고 정확히 트래커 문구와 일치하게 "별 결정"으로 유보하고
    있다. 충돌 없음. (교차검증 목적으로 기록만 남긴다.)

## 요약

`success-advert.md`(developer 구현 plan)와 이를 뒷받침하는 `spec-draft-swagger-success-advert.md`(planner
spec draft, 이미 `swagger.md` §2-4/§5-2/§5-4 에 반영됨)는 트래커
`spec-draft-nullable-notation-followups.md:5107` 항목의 실측 수치(15곳 중 11곳 채움 · 4곳 처방 없음)와 한 글자도
어긋나지 않게 일치하고, 함께 걸린 "별 결정"(자원을 안 만드는 POST 분류)도 우회하지 않고 정확히 유보 상태로
남겨 뒀다. `swagger.md` 를 참조하는 다른 in-progress plan(`eia-context-schema-followups.md`·
`harness-review-gate-followups.md`·`spec-sync-user-profile-gaps.md`·`spec-sync-external-interaction-api-gaps.md`·
`webchat-spec-rationale-followup.md`)은 모두 §1-4·§3·§5-1 등 이번 변경과 무관한 절을 인용하고 있어 충돌이
없다. 유일한 실질적 갭은 `workflow-assistant` `GET /sessions/latest` 가 제품 spec(`4-ai-assistant.md` §6 REST API
표)에 애초에 등재돼 있지 않다는 기존 결함으로, 이번 PR이 그 라우트를 OpenAPI 상 정식으로 광고하면서 두 문서
사이 격차를 더 눈에 띄게 만드는데 어느 plan 도 이를 후속 항목으로 잡아두지 않았다. 이 외에는 구현 착수를
막을 미해결 결정 충돌이나 선행 plan 미해소가 없다.

## 위험도

LOW
