# Rationale 연속성 검토 결과

검토 범위: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
검토 대상 변경: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` 리팩터링 (도메인 타입 파생 + `STATE_CONFIG` 중앙화)

---

## 발견사항

발견된 Rationale 연속성 위반이 없습니다.

아래는 주요 Rationale 항목과 target 변경의 정합성을 확인한 결과입니다.

### 확인된 Rationale 정합 사항

| Rationale 항목 | 원칙 | target 준수 여부 |
|---------------|------|----------------|
| `spec/2-navigation/5-knowledge-base.md` R-3: 배너에 수동 닫기(X) 없음 — 상태 기반 auto-dismiss | 상태가 변하면(dimension 복구) 호출부 게이트로 자연 소멸 | 준수. 리팩터 전/후 모두 X 버튼 없음. 테스트 `"renders no manual dismiss (X) control"` 로 회귀 방지됨 |
| `spec/2-navigation/5-knowledge-base.md` R-3: CTA 는 RoleGate(editor), 텍스트는 전체 노출 | viewer 포함 모든 사용자가 배너 텍스트를 볼 수 있어야 함 | 준수. `STATE_CONFIG` 도입 후에도 `RoleGate(minRole="editor")` 가 CTA 만 감쌈. 텍스트·설명은 게이트 밖 |
| `spec/2-navigation/5-knowledge-base.md` R-3: `in_progress` 에서 CTA 숨김 | `POST /re-embed` 가 진행 중 409 반환하므로 UI 에서도 차단 | 준수. `STATE_CONFIG.in_progress.showCta = false` |
| `spec/2-navigation/5-knowledge-base.md` R-3: CTA 는 신규 API 없이 기존 `POST /re-embed` 재사용 | 자동화·신규 상태 전이 도입 안 함 | 준수. `onReembed` 콜백은 호출부의 ConfirmModal → `POST /re-embed` 를 그대로 위임 |
| `spec/0-overview.md §3.4` Inline Alert 생존 주기 | 인라인 alert 는 상태 복구 시 자동 소멸 | 준수. 게이트 (`kb.embeddingDimension == null`) 를 호출부(`page.tsx`)가 관리하는 구조 불변 |

### 변경 성격 요약

이번 리팩터는 순수 내부 구조 변경이다:

- **변경**: 인라인 ternary 분기 (`inProgress ? ... : ...`) → `STATE_CONFIG` lookup table
- **변경**: prop 타입 인라인 리터럴(`"idle" | "in_progress"`) → 도메인 타입 파생(`KnowledgeBaseData["reembedStatus"]`)
- **불변**: 외부 컴포넌트 시그니처(`reembedStatus`, `onReembed`, `pending`), 렌더 결과, 역할 게이트, 상태별 동작

이 변경은 Spec 이 규정한 어떠한 결정도 번복하지 않으며, 새로운 Rationale 작성 의무도 발생하지 않는다. Spec 파일 자체는 이 워크트리에서 변경되지 않았다.

---

## 요약

`spec/2-navigation/` 의 모든 Rationale 항목(특히 `5-knowledge-base.md` R-2·R-3, `0-overview.md §3.4 Inline Alert 생존 주기`)에 대해 target 변경이 기존 합의를 위반하거나, 기각된 대안을 재도입하거나, 무근거로 결정을 번복하는 사례가 없다. 이번 변경은 `UnsearchableBanner` 컴포넌트의 내부 구현 패턴만 개선한 리팩터로, 기능적 계약·역할 게이트·auto-dismiss 정책 모두 이전 구현과 동일하게 유지된다.

---

## 위험도

NONE
