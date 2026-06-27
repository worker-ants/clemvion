# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] listModels 관련 테스트 추가 — 직접 요청 범위 밖이나 인가 계약 보완
- 위치: `llm-model-config.controller.spec.ts` 54–60행 (unit), `workspace-rbac.e2e-spec.ts` 412–420행 (e2e)
- 상세: 이번 변경의 핵심 의도는 `testConnection`에 `@Roles('editor')` 가드를 추가하는 것이다. 그런데 unit test에 `listModels has NO role metadata — Viewer+ 유지`, e2e에 `GET :id/models` viewer 통과 검증이 함께 추가됐다. `listModels`에 대한 새로운 구현 변경은 없으므로 이 테스트들은 기존 동작을 확인하는 성격이다.
- 평가: `testConnection`(Editor+)과 `listModels`(Viewer+)는 동일 엔드포인트 쌍에서 대비되는 인가 정책을 형성한다. 보안 관련 변경에서 "새로 게이트를 추가했지만 인접 GET은 게이트 없음"을 명시적으로 확인하는 것은 계약 완전성 측면에서 정당하다. 단독 리팩토링이나 불필요한 scope 확장으로 보기 어렵다.
- 제안: 현행 유지 가능. 다만 커밋 메시지에 "listModels Viewer+ 유지 확인 포함"을 명시하면 리뷰 추적에 도움이 된다.

### [INFO] `@ApiForbiddenResponse` Swagger 데코레이터 추가
- 위치: `llm-model-config.controller.ts` 207행 (diff 기준)
- 상세: `@Roles('editor')` 추가의 직접 파생으로, 새로운 403 응답을 Swagger 문서에 선언하는 것이다. 기능 확장이 아니라 추가된 guard의 계약 문서화다.
- 평가: 범위 내. `previewModels`에는 이미 동일 패턴이 있으므로 일관성 측면에서도 적합하다.

### [INFO] 주석 갱신 (describe 블록 라벨 + 스펙 SoT 참조)
- 위치: `llm-model-config.controller.spec.ts` 36–37행 (diff 기준)
- 상세: 기존 `// ── @Roles guard — preview-models stays editor-gated ──` 주석이 `preview-models·testConnection editor-gated; listModels Viewer+` 로 갱신됐고 `spec/2-navigation/6-config.md §3 + R-7` 참조가 추가됐다.
- 평가: 새로 추가된 테스트 케이스를 반영한 주석 갱신으로 적절하다. 불필요한 주석 변경이 아니다.

## 요약

이번 변경은 `testConnection` 엔드포인트에 `@Roles('editor')` 가드를 추가하고, 그에 대응하는 unit(메타데이터 검사) 및 e2e(HTTP 레벨 RBAC) 테스트를 추가하는 것으로 일관되게 구성되어 있다. `listModels` 관련 테스트가 함께 포함된 것은 직접 구현 변경이 없는 기존 동작의 확인이지만, `testConnection`(Editor+) vs `listModels`(Viewer+)의 인가 계약 쌍을 명시적으로 확정하는 보안 완전성 관점에서 정당화된다. 무관한 파일 수정, 불필요한 리팩토링, 포맷팅 혼입, 불필요한 임포트 변경은 발견되지 않았다.

## 위험도

NONE
