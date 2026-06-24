# Cross-Spec 일관성 검토 결과

검토 대상: `system-prompt.ts` Self-review skip 안내 코드 정합 (커밋 86cd2a97)
검토 범위: `spec/**` 전 영역 대비 교차 충돌 분석
검토 기준: diff-base=origin/main

---

## 발견사항

### [WARNING] spec/3-workflow-editor/4-ai-assistant.md line 958 — finishBlockCount skip 조건 stale

- **target 위치**: `system-prompt.ts` L59 — `PLAN_NOT_COMPLETE this turn does NOT skip review — plan completeness and workflow-quality review are independent layers` 로 교체됨
- **충돌 대상**: `spec/3-workflow-editor/4-ai-assistant.md` §"review skip 조건 (`shouldSkipReview`)" (line 958)
  - 현재 spec 본문: `` `state.finishBlockCount > 0` — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복 ``
- **상세**: 구현(`system-prompt.ts`)은 이미 "PLAN_NOT_COMPLETE does NOT skip review" 로 교정됐고, 코드(`AssistantFinishGuard.shouldSkipReview`)도 `finishBlockCount` 체크를 제거했다. 그러나 spec 의 review skip 조건 목록에는 해당 조건이 그대로 남아 있어 spec ↔ 구현 간 직접 모순이다.
- **참고**: 페이로드 주석에서 "spec §10 line 958 stale finishBlockCount 는 sibling PR #685(planner)가 처리" 임을 명시. 본 PR 스코프 밖이며 이미 추적 중.
- **제안**: sibling PR #685 에서 `spec/3-workflow-editor/4-ai-assistant.md` §"review skip 조건" 목록의 `finishBlockCount > 0` 항목을 삭제하고, 대신 "PLAN_NOT_COMPLETE 는 독립 레이어 — plan guard 통과 후에도 review 가 발동할 수 있음" 설명을 추가.

---

### [INFO] 유지보수 체크리스트 — system-prompt.ts 동기화 경고 문구와 일치

- **target 위치**: `spec/3-workflow-editor/4-ai-assistant.md` §"유지보수 체크리스트" (line 992): "Review skip 조건 변경 시: `prompts/system-prompt.ts` Self-review 섹션 문구 동기화 (테스트 `system-prompt.spec.ts` ... 가 고정)"
- **충돌 대상**: 없음 — 이번 변경이 정확히 해당 체크리스트 절차를 이행함.
- **상세**: 본 PR 은 system-prompt.ts 의 review skip 문구를 갱신하고 regression 단언 2건을 추가해 체크리스트 요건을 충족했다. spec 과 구현이 일치하는 방향의 변경.
- **제안**: 없음. 정상.

---

## 범위 확인

아래 6개 관점 전수 점검 결과:

1. **데이터 모델 충돌**: 변경 대상이 `system-prompt.ts` / `system-prompt.spec.ts` 에 한정 — 엔티티·필드 정의 변경 없음. 충돌 없음.
2. **API 계약 충돌**: endpoint·HTTP method·request/response shape 변경 없음. 충돌 없음.
3. **요구사항 ID 충돌**: 새 요구사항 ID 부여 없음. `PLAN_NOT_COMPLETE`·`WORKFLOW_REVIEW_REQUIRED` 코드는 `spec/3-workflow-editor/4-ai-assistant.md` 외 다른 spec 에서 미사용 확인. 충돌 없음.
4. **상태 전이 충돌**: review/finish 상태 머신 정의는 `spec/3-workflow-editor/4-ai-assistant.md` 단독 SoT. 타 영역 spec 에 동일 상태 머신 정의 없음. 충돌 없음 (내부 stale 는 WARNING 으로 이미 기재).
5. **권한·RBAC 모델 충돌**: 권한 구조 변경 없음. 충돌 없음.
6. **계층 책임 충돌**: `system-prompt.ts` 는 `workflow-assistant/prompts/` 계층 — 기존 모듈 경계 내 변경. 충돌 없음.

---

## 요약

본 PR 의 변경(system-prompt.ts 의 review skip 안내 문구 교정 + regression 단언 2건 추가)은 `spec/3-workflow-editor/4-ai-assistant.md` 외의 다른 spec 영역과 충돌하지 않는다. 유일한 교차 우려 사항은 `spec/3-workflow-editor/4-ai-assistant.md` line 958 의 `finishBlockCount > 0` 조건이 구현과 모순되는 stale spec 인데, 이는 sibling PR #685(planner)가 추적 중인 이미 알려진 항목이며 본 PR 스코프 밖이다. Cross-spec 관점의 신규 위험 요소는 없다.

---

## 위험도

LOW
