# Plan 정합성 검토 — patch-null-validation → spec/2-navigation/

## 발견사항

- **[WARNING]** 트래커 항목 (10) 의 범위가 `2-trigger-list.md` 의 `endpointPath` 서술 갱신을 포함하지 않는다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스 `endpointPath` 행, §3 API `PATCH /api/triggers/:id` 註
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "**2026-09-27 보강** (`patch-null-validation` `--impl-prep` W1·W2)" 항목 (10)
  - 상세: 이번 구현(`e5de5226c`)은 `UpdateTriggerDto.endpointPath` 에 `null` 을 보내면 종전 "200 + 웹훅 수신 경로 조용한 삭제" 였던 것을 "400 `VALIDATION_ERROR`" 로 바꿨고, 이 사실은 DTO JSDoc/Swagger·CHANGELOG 에는 반영됐다. 그러나 이 필드의 SoT 서술을 담당하는 `spec/2-navigation/2-trigger-list.md`(frontmatter `code:` 가 `dto/**` 를 문다) 는 여전히 `endpointPath` 를 "UNIQUE 위반 → 409 / 길이·이름 검증 실패 → 400" 으로만 서술하고 null 거부는 언급하지 않는다. 같은 트래커의 선행 항목 (7)(8)(9) 는 자매 PR(`patch-omit-undefined`) 이 만든 유사한 필드별 동작 변화(tri-state·라벨 오류)를 정확히 이 방식 — 해당 도메인 spec 문서에 한 줄씩 추가 — 로 처리했다. 이번 항목 (10) 은 문구상 `spec/5-system/2-api-convention.md` §5.4 블록쿼트 한 문장 + `9-user-profile.md` §6.1 표기 수정만 명시해, planner 가 그 문구를 그대로 이행해도 `2-trigger-list.md` 자체의 서술 갭은 닫히지 않는다. (다른 42개 NOT NULL 필드는 §5.4 API convention 층위의 일반 규칙만으로 충분하다는 판단 — `## 추가 Read 블록` 의 "43필드는 전부 nullable 미선언" — 이 endpointPath 에도 그대로 적용되는지, 아니면 이미 서술이 구체적인(409/400 코드까지 나열한) 이 필드는 예외로 한 줄이 더 필요한지는 결정 사안이다.)
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10) 에 "`2-trigger-list.md` §2.3.1 `endpointPath` 행·§3 註에 null 거부(400) 한 줄 추가" 를 명시적으로 보강한다 — planner 턴에서 §5.4 문장과 함께 처리하도록 스코프를 넓히는 편집.

## 요약

`patch-null-validation` 은 이미 2 라운드의 `/ai-review`(Critical 0 · Warning 0 수렴)와 `--impl-prep`(BLOCK: NO) 을 거쳤고, 발견된 spec drift(§5.4 tri-state 범위)는 `spec-draft-nullable-notation-followups.md` 트래커 항목 (10) 으로 정식 등재돼 planner 턴으로 이연됐다 — 이는 이 저장소의 표준 처분 경로이며 그 자체로는 문제가 아니다. `spec/2-navigation/` 내에서 미해결 결정과 충돌하거나(§1 관점) target 이 가정한 선행 plan 이 안 풀린 경우(§2 관점)는 찾지 못했다 — `pending_plans`(`marketplace-and-plugin-sdk.md`, `spec-draft-nullable-notation-followups.md`) 는 이미 frontmatter 에 반영돼 있고, 이 PR 이 건드는 43필드 중 42개는 §5.4 API convention 층위 일반 규칙만으로 덮인다는 조사 결과(추가 Read 블록)와도 어긋나지 않는다. 유일하게 좁게 남는 것은 endpointPath 하나 — 도메인 spec 자체가 이미 이 필드의 세부 에러 코드(409/400)를 나열하는 자리인데, 새로 생긴 null-거부 400 이 그 나열에 반영되지 않았고 이를 닫을 트래커 항목 (10) 의 문구도 이 자리를 명시하지 않는다. 나머지는 정합적이다.

## 위험도

LOW
