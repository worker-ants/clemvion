# Plan 정합성 검토 — spec/2-navigation/ (impl-done, diff-base origin/main)

## 발견사항

없음.

검토 근거:

- **target 델타 실측**: `spec/2-navigation/` scope 안에서 실제로 바뀐 파일은 `spec/2-navigation/2-trigger-list.md` 단 하나이며, 변경 내용은 §2.3.1 `endpointPath` 행과 §3 PATCH 註 두 곳에 "또는 다른 워크스페이스가 예약한 경로(지웠거나 바꾼 경로 — 데이터 모델 §2.8.1) 시 409" 문구를 추가한 2줄짜리 편집이다(`git diff origin/main...HEAD -- spec/2-navigation/2-trigger-list.md` 로 재확인).
- **구동 plan과의 대조**: 이 변경은 `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` §변경-C 가 정확히 지시한 문구와 위치(§2 편집 표 `endpointPath` 행 · §3 PATCH 본문 주석 두 곳)를 한 글자 단위로 일치시켜 반영한 것이다. 같은 plan 의 "사용자 결정 (2026-09-19)" 절이 트래커의 미해결 결정(영구 vs 기간 묘비 · 저장 위치 · 경로 변경 시 동일 규칙 여부)을 전부 명시적으로 확정했고, 이번 diff 는 그 확정된 설계를 따른다 — 미해결 결정을 우회하거나 일방적으로 새 결정을 내리는 지점이 없다.
- **선행 plan 미해소 여부**: 이 작업이 닫으려는 트래커 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md:4644` ("지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다 — 묘비 부재")다. 해당 항목의 체크박스는 아직 `[ ]`이지만, 이는 결정 미해소가 아니라 `spec-draft-webhook-endpoint-reservation.md` 자체의 체크리스트("트래커 체크박스는 이 draft 를 `plan/complete/` 로 옮기는 커밋에서 함께 갱신한다")가 그 갱신을 최종 커밋으로 명시적으로 유예한 것이다 — 지금 라운드(`/ai-review` → `--impl-done` → 트래커 해소·이동)의 정상적인 중간 상태이므로 정합성 결함이 아니다.
- **후속 항목 누락 여부**: `spec-draft-nullable-notation-followups.md` 안에서 `2-trigger-list.md` 를 가리키는 다른 열린 항목(예: `:4606` `trigger-resource-releaser.service.spec.ts` 를 `code:` 에 등재하는 건, `:4611` 노드 삭제 시 실행 이력 보존 정책)은 이번 diff 의 대상(webhook endpoint 예약)과 무관한 별개 후속 과제이며, 이번 diff 가 그 항목들의 전제를 바꾸거나 무효화하지 않는다.
- 그 외 `plan/in-progress/**` 전체를 `endpoint_path`/`TRIGGER_ENDPOINT_PATH_CONFLICT`/`webhook_endpoint_reservation` 키워드로 훑었을 때, 이 두 plan 외에 관련 언급을 가진 in-progress plan 은 없다 — 다른 plan 의 가정과 충돌하거나 갱신이 필요한 지점이 없다.

## 요약

이번 PR 의 `spec/2-navigation/` 스코프 델타는 `2-trigger-list.md` 2줄뿐이며, 그 내용은 같은 워크트리의 `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 가 사전에 합의·설계한 변경 C 를 정확히 반영한 것이다. 이 plan 은 트래커(`spec-draft-nullable-notation-followups.md:4644`)가 남겨 둔 미해결 결정(영구 예약 여부·저장 위치·경로 변경 시 동일 규칙 여부)을 이미 "사용자 결정 (2026-09-19)" 로 명시적으로 확정했고, `--spec`/`--impl-prep` 라운드도 Critical/Warning 0 으로 통과한 이력이 있다. 트래커 체크박스 미갱신은 plan 자신이 "draft 를 `plan/complete/` 로 옮기는 커밋에서 함께 갱신" 하기로 예고한 정상적인 중간 상태이지, 결정 우회나 후속 누락이 아니다. Plan 정합성 관점에서 이 target 변경을 막을 근거가 없다.

## 위험도

NONE
