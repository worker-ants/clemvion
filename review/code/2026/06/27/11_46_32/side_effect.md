# 부작용(Side Effect) 리뷰

리뷰 대상: authz follow-up — `testConnection @Roles('editor')` 추가 + 테스트·스펙·플랜 갱신
리뷰 일시: 2026-06-27

---

## 발견사항

### [INFO] testConnection 엔드포인트의 인가 동작 변경 (의도된 부작용)
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `@Roles('editor')` 데코레이터 추가
- **상세**: `POST /api/model-configs/:id/test` 에 `@Roles('editor')` 가 추가됨으로써, 이전까지 워크스페이스 Viewer 가 직접 호출 가능하던 엔드포인트가 Editor+ 전용으로 제한된다. 이는 spec `6-config.md §3 R-7`·product sign-off 에 근거한 **의도된** 인가 행동 변경이다. UI 경로(모델 추가/수정 폼)는 이미 Editor+ 전용이라 일반 사용자 흐름에는 영향이 없고, 직접 API 호출 갭만 차단된다. 부작용이 의도적으로 설계·문서화돼 있으므로 `WARNING` 이 아닌 `INFO` 로 분류한다.
- **제안**: 없음 — spec R-7 과 plan C-2 cluster 4 authz follow-up 이 이미 근거를 충분히 제공하며 product sign-off 도 완료됐다.

### [INFO] `@ApiForbiddenResponse` 가져오기 중복 가능성 확인 필요
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — imports 블록
- **상세**: `@ApiForbiddenResponse` 는 이미 전체 파일 컨텍스트의 imports 목록에 포함돼 있으며, `previewModels` 핸들러에서도 동일 데코레이터가 이미 사용 중이다. 신규 추가(`testConnection` 의 `@ApiForbiddenResponse`)는 같은 import 를 재활용하는 것이므로 중복 import 문제는 없다. 런타임 영향 없음.
- **제안**: 없음.

### [INFO] e2e 테스트 케이스 H — 테스트 DB 엔티티 정리 부재
- **위치**: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 케이스 H
- **상세**: 케이스 H 에서 생성하는 owner·viewer·editor 사용자 및 워크스페이스는 `afterAll` 에서 명시적으로 삭제되지 않는다. 이는 기존 케이스 A–G 와 동일한 패턴이고, e2e 환경 특성상 격리된 테스트 DB 에서 실행되므로 운영 데이터에 영향을 주지 않는다. 단, `uniqueEmail('rbac-h-...')` 를 사용해 이메일 충돌 가능성을 회피한다.
- **제안**: 없음 — 기존 패턴과 일관되며 테스트 환경 격리가 전제된다.

---

## 요약

이번 변경의 핵심은 `LlmModelConfigController.testConnection` 에 `@Roles('editor')` 데코레이터를 추가하고 이를 검증하는 테스트·스펙·플랜을 갱신하는 것이다. 전역 변수 도입, 예상치 못한 파일 생성·수정·삭제, 환경 변수 읽기·쓰기, 의도하지 않은 외부 서비스 호출, 이벤트·콜백 흐름 변경은 발견되지 않았다. 함수 시그니처(`testConnection`, `listModels`)는 불변이며 공개 API URL 도 변경이 없다. `listModels` 는 `@Roles` 를 의도적으로 부여하지 않아 Viewer+ 유지가 정확하게 구현됐다. 유일한 동작 변화는 Viewer 의 `POST /api/model-configs/:id/test` 직접 호출이 403 으로 전환되는 것인데, 이는 spec R-7 및 product sign-off 에 의해 명시적으로 승인된 인가 계약 변경이다. 의도하지 않은 부작용은 없다.

---

## 위험도

LOW
