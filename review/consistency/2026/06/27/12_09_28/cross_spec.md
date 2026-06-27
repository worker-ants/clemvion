# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/2-navigation/6-config.md` (구현 완료 후 검토, diff-base=origin/main)
**구현 변경 범위**: `llm-model-config.controller.ts` (RBAC 추가), `llm-model-config.controller.spec.ts` (단위 테스트), `workspace-rbac.e2e-spec.ts` (e2e 테스트)

---

## 발견사항

발견된 충돌 없음.

아래는 검토 과정에서 확인한 spec 간 일관성 정합 항목이다.

### [INFO] Model Config RBAC — 다중 spec 참조 교차 확인 (정합 확인)

- target 위치: `spec/2-navigation/6-config.md §3 Model Config API`, `Rationale R-7`
- 교차 spec: `spec/5-system/1-auth.md §3.2`, `spec/5-system/7-llm-client.md §8.3`
- 상세:

  세 spec 이 각각 Model Config RBAC 를 기술하며, 구현 변경과 테스트가 모두 이와 일치한다.

  | 엔드포인트 | spec/2-nav/6-config §3 | spec/5-sys/1-auth §3.2 | spec/5-sys/7-llm-client §8.3 | 구현 (`@Roles`) |
  |------------|------------------------|------------------------|-------------------------------|-----------------|
  | `POST :id/test` | Editor+ (action-POST R-7) | Editor=CRUD | Editor+ 명시 | `@Roles('editor')` 추가됨 ✅ |
  | `POST preview-models` | Editor+ (action-POST R-7) | Editor=CRUD | — | `@Roles('editor')` 기존 존재 ✅ |
  | `GET :id/models` | Viewer+ (조회 R) | Viewer=R | — | `@Roles` 없음 (Viewer+ 의도적) ✅ |

  `spec/5-system/1-auth.md §3.2` 의 Model Config `Viewer=R` 규정과 `spec/2-navigation/6-config.md R-7` 의 "action-POST 는 R(읽기)에 해당하지 않으므로 Editor+" 해석이 상보 관계로 모순 없이 성립한다. `spec/5-system/7-llm-client.md §8.3` 은 이미 `@Roles('editor')` 의 필요성을 명시적으로 기술하고 있어 본 구현 변경이 spec 선행 기술 대비 구현 갭(spec-drift)을 해소한다.

- 제안: 현 상태 유지. 세 spec 간 참조 방향이 명확하므로 추가 동기화 불필요.

---

## 요약

이번 변경(`POST :id/test` 에 `@Roles('editor')` 추가 + 단위/e2e 테스트 보강)은 기존 spec 과 충돌하지 않는다. `spec/2-navigation/6-config.md §3 및 R-7`, `spec/5-system/1-auth.md §3.2`, `spec/5-system/7-llm-client.md §8.3` 이 동일한 Editor+ 제약을 삼중으로 명시하고 있으며, 구현이 이를 그대로 반영한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 모델·계층 책임 어느 관점에서도 모순이 없다.

---

## 위험도

NONE
