# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-prep`
- 대상 문서: `spec/2-navigation/6-config.md`
- 검토 기준일: 2026-06-27

---

## 발견사항

### [INFO] `PATCH set-default` 와 `DELETE` 행에 권한 어노테이션 누락

- target 위치: `spec/2-navigation/6-config.md §3 Model Config API` 표
- 충돌 대상: `spec/5-system/1-auth.md §3.2` RBAC 매트릭스 (Model Config: Editor=CRUD)
- 상세: §3 도입부에서 "mutation (POST / PATCH / DELETE) 은 Editor+" 라고 명시하지만, 개별 표 행 중 `PATCH /api/model-configs/:id/set-default` 와 `DELETE /api/model-configs/:id` 에는 `(Editor+)` 어노테이션이 없다. action-POST 행들(`POST :id/test`, `POST preview-models`)은 각각 `**(Editor+ — 과금 action-POST)**` 를 명기한 것과 달리 두 행은 설명문만 있다.
- 모순 여부: 모순은 아님. 도입부 서술이 포괄 규정이므로 의미적으로는 일관된다. 그러나 구현자가 표만 보고 판단할 때 이 두 행의 가드 누락을 인지 못할 수 있다.
- 제안: 두 행에 `**(Editor+)**` 를 명기하거나, 도입부 문단을 표 상단 캡션 형태로 옮겨 표 자체가 권한 정보를 완결성 있게 전달하도록 개선.

---

### [INFO] `POST :id/test` 권한이 두 문서에 분산 기술 (중복이지만 정합)

- target 위치: `spec/2-navigation/6-config.md §3` 표 + `§R-7`
- 충돌 대상: `spec/5-system/7-llm-client.md §8.3` (LlmService.testConnection 권한 설명)
- 상세: `7-llm-client.md §8.3` 가 "권한: `editor` 이상. ... [설정 화면 §3 Model Config API](../2-navigation/6-config.md#model-config-api) R-7 근거" 라고 6-config.md 를 SoT 로 참조한다. 6-config.md §3 표 + R-7 이 SoT, 7-llm-client.md §8.3 이 포인터—이므로 단방향 참조로 중복 아님. 정합 이상 없음.
- 제안: 현 구조(6-config.md SoT → 7-llm-client.md 포인터) 유지. 구현 시 `@Roles('editor')` 는 `LlmModelConfigController.testConnection` 에 추가하면 되며, 양쪽 spec 이 동일하게 Editor+ 를 가리키고 있음을 확인함.

---

## 요약

`spec/2-navigation/6-config.md` 와 인접 spec 사이에 **데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, RBAC 충돌, 계층 책임 충돌 중 어떤 것도 발견되지 않았다.** RBAC 권한 매트릭스(`1-auth.md §3.2`): Auth Config(Admin+ CRUD / Editor·Viewer R)·Model Config(Editor+ CRUD / Viewer R) 가 6-config.md §3 API 표 및 §A.4 권한 설명과 완전히 정합한다. R-7(action-POST `:id/test`·`preview-models` Editor+ 게이트)은 `7-llm-client.md §5.5`·`§8.3` 의 "`editor` 이상" 표기와 양방향으로 일치하며, `1-auth.md §3.2` "Model Config Viewer=R(읽기 전용)" 해석과도 논리적으로 정합한다. 데이터 모델(ModelConfig §2.16, AuthConfig §2.17) 참조, Execution.source_ip·response_code 기반 AuthConfig 사용량 집계(§2.13), audit 액션(`auth_config.*` 구현 완료·`model_config.*` Planned) 기술 모두 각 SoT 문서와 일치한다. INFO 수준의 표 어노테이션 불완전이 2건 있으나 의미 충돌은 아니며 구현 직전 명확화 권고 수준이다.

## 위험도

LOW

---

STATUS: SUCCESS
