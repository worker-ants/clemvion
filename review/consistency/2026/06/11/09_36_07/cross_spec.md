# Cross-Spec 일관성 검토 결과

## 검토 대상

- **scope**: V-02 최종 — `13-user-guide` 예시 YAML 의 삭제된 `ai-configs.tsx` 경로를 `schema-form.tsx` 로 정리 (consistency W-1 해소)
- **diff-base**: `origin/main`
- **mode**: `--impl-done`

## 변경 요약

본 커밋은 다음 두 영역의 변경을 담고 있다.

1. `codebase/frontend/…/node-configs/ai-configs.tsx` 삭제 — `text_classifier`·`information_extractor` 의 bespoke override 폼 제거
2. `codebase/frontend/…/node-configs/override-registry.ts` 수정 — `text_classifier`·`information_extractor` 를 `OVERRIDE_REGISTRY` 에서 제거
3. `codebase/frontend/…/__tests__/override-registry.test.ts` 신규 — 위 두 노드가 미등록(undefined)임을 고정하는 회귀 테스트
4. `spec/2-navigation/13-user-guide.md` 수정 — 예시 YAML 의 `code:` 경로를 `node-configs/ai-configs.tsx` → `auto-form/schema-form.tsx` 로 교체 (W-1)
5. `spec/3-workflow-editor/1-node-common.md` 수정 — §2.6.3 트랙 배정 갱신 + R-3 Rationale 추가

---

## 발견사항

발견된 CRITICAL·WARNING·INFO 급 cross-spec 충돌 없음.

### [INFO] `1-node-common.md` R-3 Rationale 의 과거형 `ai-configs.tsx` 언급

- **target 위치**: `spec/3-workflow-editor/1-node-common.md` R-3 Rationale (마지막 단락)
- **충돌 대상**: 해당 없음 (충돌 아님)
- **상세**: R-3 Rationale 에 "`ai-configs.tsx`은 … 폐기됐다"는 과거형 서술이 있다. 이는 삭제된 파일의 역사를 기록하는 의도된 Rationale 서술이며, 파일 부재를 기정사실로 설명하는 것이므로 spec 모순이 아니다.
- **제안**: 변경 불필요. 현행 서술이 정확하다.

### 점검 통과 항목

| 점검 관점 | 결과 |
|-----------|------|
| 데이터 모델 충돌 | 없음 — 코드 변경은 frontend 렌더 트랙에만 국한. `Node.type`, `Node.config` JSONB 스키마(`spec/1-data-model.md §2.6`) 변경 없음 |
| API 계약 충돌 | 없음 — `GET /api/nodes/definitions` 및 노드 실행 관련 endpoint 변경 없음 |
| 요구사항 ID 충돌 | 없음 — 새로 부여된 요구사항 ID 없음 |
| 상태 전이 충돌 | 없음 — `text_classifier`·`information_extractor` 실행 상태 머신 변경 없음 |
| 권한·RBAC 모델 충돌 | 없음 — 권한 관련 변경 없음 |
| 계층 책임 충돌 | 없음 — `spec/3-workflow-editor/1-node-common.md §2.6.3` 가 SoT 로 트랙 배정을 정의하고, 코드(`override-registry.ts`)와 spec(§2.6.3) 이 일치함을 확인 |

**spec ↔ 코드 정합 확인**:

- `spec/3-workflow-editor/1-node-common.md §2.6.3` — `ai_agent`·`text_classifier`·`information_extractor` 를 "auto-form 이행 완료" 목록에 포함. 코드의 `OVERRIDE_REGISTRY` 에서 세 항목이 모두 미등록(undefined)임을 회귀 테스트가 고정.
- `spec/2-navigation/13-user-guide.md` 예시 YAML `code:` 경로 → `auto-form/schema-form.tsx` 로 교체 완료. 삭제된 `ai-configs.tsx` 경로 잔존 없음.
- `spec/4-nodes/3-ai/2-text-classifier.md`·`spec/4-nodes/3-ai/3-information-extractor.md` — frontend 렌더 트랙 관련 내용을 직접 기술하지 않으므로 추가 수정 불필요.

---

## 요약

V-02 최종 커밋은 `text_classifier`·`information_extractor` 의 bespoke override 폼(`ai-configs.tsx`) 삭제와 `spec/2-navigation/13-user-guide.md` 예시 YAML 경로 정정을 담고 있다. `spec/3-workflow-editor/1-node-common.md §2.6.3` 의 트랙 배정 기술, `spec/1-data-model.md` 의 `Node.type` 정의, 기타 AI 노드 spec(`spec/4-nodes/3-ai/`)과의 충돌은 없다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 관점에서도 기존 spec 과 모순되는 변경이 없으며, 이전 BLOCK:NO 상태가 유지된다.

---

## 위험도

NONE

---

STATUS: OK
