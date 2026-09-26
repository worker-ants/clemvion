# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `forbiddenForRole()` 산출 문구와 컨트롤러가 수작업으로 이어붙이는 문구 사이에 구두점(쉼표) 불일치
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts:38`(`forbiddenForRole` 내부는 `${FORBIDDEN_NOT_A_MEMBER} 또는 ...` — 쉼표 없음) vs `codebase/backend/src/modules/workspaces/workspaces.controller.ts:67`(`` `${forbiddenForRole('owner')}, 또는 개인 워크스페이스` `` — 쉼표 있음), `codebase/backend/src/modules/integrations/integrations.controller.ts:95-97`, `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts:39` 도 동일 패턴
  - 상세: 헬퍼가 만드는 기본 2코드 문장은 쉼표 없이 "또는"으로 잇는데, 서비스 판정(추가 거부 사유)을 덧붙이는 4개 지점은 쉼표+"또는"으로 잇는다. `repo-guards`의 `forbidden-response-codes` 가드는 **부분 문자열 포함 여부만** 보므로 이 불일치는 CI 를 통과하며, OpenAPI 문서 텍스트의 표기 일관성만 낮춘다 — 실제 응답 스키마·코드에는 영향 없음
  - 제안: 급하지 않음. 후속 다듬기 때 서비스-판정 접미 문구도 헬퍼(`forbiddenForRole` 확장 인자 등)로 흡수하면 표기가 통일된다

## 요약

이번 변경은 30여 개 컨트롤러의 `@ApiForbiddenResponse({ description })` 문자열을 손으로 쓴 산문(예: "워크스페이스 멤버가 아님", "editor 이상 권한 필요")에서 `RolesGuard` 가 실제로 던지는 오류 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)를 보간하는 공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER`, `forbiddenForRole()`)로 교체하는 순수 API 문서(OpenAPI/Swagger) 일관성 작업이다. 엔드포인트 경로·HTTP 메서드·요청/응답 스키마·페이지네이션·인증 방식은 전혀 바뀌지 않았고, 실제 인가 로직도 `roles.guard.ts` 내 인라인 `reduce` 를 `workspace-roles.ts` 의 `lowestRequiredRole()` 로 추출했을 뿐 `roleLevel`이 `workspaceRoleLevel` 의 별칭 그대로임을 직접 확인해 동작이 100% 보존됨을 검증했다(빈 배열 시 `TypeError` throw 계약도 테스트로 고정). 새로 추가된 저장소 가드(`forbidden-response-codes-guard.ts`/`.spec.ts`)는 가드가 403 을 낼 수 있는 157개 라우트 전수를 reflection 으로 스캔해 설명에 코드가 빠짐없이 실리는지 상시 검증하며, 실제 `RolesGuard` 를 구동하는 "모델 캐너리"로 판정 로직 자체의 정확성도 교차 검증한다 — `spec/conventions/swagger.md` §5-4 개정과도 정합적이다. 클라이언트가 소비하는 것은 사람이 읽는 설명 텍스트뿐이라 하위 호환성 파괴 위험이 없고, 오히려 에러 응답의 코드 계약이 문서와 실제 동작 사이에서 벌어져 있던 129/157건의 갭을 closes한다는 점에서 API 계약 관점의 순수 개선이다. 위에 적은 것은 문구 서식(쉼표 유무)의 경미한 불일치뿐이며 기능적 영향은 없다.

## 위험도

NONE
