# Plan 정합성 검토 — spec/2-navigation/ (--impl-prep)

## 발견사항

- **[WARNING] 트래커(`spec-draft-nullable-notation-followups.md`)가 이미 결정·구현된 항목을 여전히 "결정 필요"로 서술**
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 `endpointPath` 행 · §3 PATCH 註 (`(endpoint_path) UNIQUE(전역 …)`) — 이미 `eb5332b57` 커밋으로 전역 UNIQUE 결정이 반영됨
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4632-4637` — `- [ ] **웹훅 트리거 조회가 endpoint_path 인덱스 전체를 훑는다**` 항목이 여전히 미체크 상태이며, 본문이 "결정할 것: `endpoint_path` 는 UUID v4(CHECK)라 전역 유일로 좁혀도 되는가 … 아니면 비유일 보조 인덱스로 조회만 고치는가" 라는 **폐기된 두 선택지 프레이밍**을 그대로 담고 있다
  - 상세: `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` §"트래커 반영"(179~182행 / 프롬프트 1204~1207행)은 "«웹훅 트리거 조회가 endpoint_path 인덱스 전체를 훑는다» → `[x]` 해소" 와 "새 항목: «지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다(묘비 부재)» 추가"를 명시적으로 커밋하지만, 실제 트래커 파일에는 둘 다 반영되지 않았다(`grep -n "묘비\|tombstone"` 0건, 4632행 여전히 `- [ ]`). target spec 은 이미 전역 유일 결정을 기정사실로 서술하는데, 이 트래커만 별도로 열람하면 "아직 결정 안 된 두 옵션 중 하나"로 잘못 읽혀 재논의를 유발할 수 있다.
  - 제안: plan 갱신 — 4632행 체크박스를 `[x]`로, 결정·근거 링크(`plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`, `spec/1-data-model.md` Rationale)를 추가하고, "지운 웹훅 경로 재등록(묘비 부재)" 신규 항목을 같은 트래커에 등재한다. draft plan 자신이 예고한 "트래커 반영" 스텝이므로 developer 턴 착수(V131/V132 구현) 전에 마무리하는 것이 자연스럽다.

- **[INFO] draft plan 자체 체크리스트가 이미 끝난 작업을 미체크로 남김**
  - target 위치: `spec/1-data-model.md` / `spec/2-navigation/2-trigger-list.md` 등 S1~S10 대상 7개 파일 — `eb5332b57` diff 로 전부 반영 확인됨(S1·S2·S3·S5·S6·S7·S8·S9·S10 문구가 실제 파일에 존재)
  - 관련 plan: `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 체크리스트 — `- [ ] S1~S10 반영` 이 미체크
  - 상세: 커밋 메시지("S1~S10: 1-data-model … 7-channel-web-chat/5-admin-console")와 실제 diff 는 S1~S10 이 이번 커밋에 전부 반영됐음을 보여주는데 plan 파일의 체크박스는 갱신되지 않았다. "plan 체크박스 = 실제 상태" 원칙에 어긋나는 경미한 staleness다(--impl-prep 직전 커밋이라 아직 다음 커밋 기회가 있음).
  - 제안: 같은 plan 파일에서 `- [x] S1~S10 반영`으로 갱신 — 다음 커밋(V131/V132 구현) 때 함께 반영해도 무방하나, 방치 기간이 길어지면 "무엇이 끝났는지" 판단이 diff 재확인에 의존하게 된다.

- **[INFO] `2-trigger-list.md` §2.3.1 의 "별 plan `eia-trigger-edit-ui`" 참조가 dangling** (금번 변경과 무관, 사전 존재 결함)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스, `External Interaction (Notification)` 행 — "별 plan `eia-trigger-edit-ui` 가 구현"
  - 관련 plan: `plan/in-progress/**`, `plan/complete/**` 어디에도 `eia-trigger-edit-ui` 라는 이름의 plan 이 존재하지 않는다(2026-05-22 PR #265 에서 처음 언급된 이후 이름이 남아 있으나 실제 plan 파일은 찾을 수 없음)
  - 상세: 이번 세션의 diff 범위 밖이며 webhook endpoint-path 변경과 무관하지만, `--impl-prep` 스코프가 `spec/2-navigation/` 전체라 언급한다. 해당 필드는 현재 spec 상 `edit` 로 표시돼 있어 이미 구현된 것으로 보이므로 실질적 차단 요소는 아닐 가능성이 높다(추가 조사는 이번 리뷰 범위 밖).
  - 제안: 우선순위 낮음 — 후속 spec 정리 시 dangling plan 참조를 실제 완료 이력(plan/complete/ 항목)으로 교체하거나 제거를

## 요약

이번 커밋(`eb5332b57`, 웹훅 `endpoint_path` 전역 유일)은 사용자가 명시적으로 결정한 내용을 3차 `--spec` consistency 검토(BLOCK: NO)까지 거쳐 반영했고, target(`spec/2-navigation/2-trigger-list.md` 포함 7개 파일)이 다른 in-progress plan의 미해결 결정을 우회하거나 일방적으로 뒤집은 정황은 없다(CRITICAL 없음). 다만 이 결정의 출처인 트래커 `spec-draft-nullable-notation-followups.md`(2-trigger-list.md 의 `pending_plans` 가 직접 가리키는 문서)가 아직 해당 항목을 미해결로 표시하고 있고, draft plan 이 스스로 예고한 "트래커 반영"(항목 종결 + 신규 묘비 항목 등재)과 자체 체크리스트("S1~S10 반영") 갱신이 누락돼 있다 — 둘 다 실제 작업 상태와 plan 문서의 괴리이며, V131/V132 구현 착수(`--impl-prep` 통과 후 developer 턴) 전에 정리하면 다음 세션의 혼란을 막을 수 있다.

## 위험도

LOW
