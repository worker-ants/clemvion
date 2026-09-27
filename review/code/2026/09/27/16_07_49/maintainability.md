# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 세 DTO 스펙 파일의 JSDoc 주석이 1R 에서 쪼갠 e2e 테스트를 여전히 단수 "E" 로 가리키는 stale 참조가 됐다
  - 위치: `codebase/backend/src/modules/nodes/dto/node-dto-validation.spec.ts:100`, `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts:304`, `codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts:129`
  - 상세: 세 파일 모두 "그 회귀를 여기서 잡는다. 동작(null 이 값을 지운다)은 `test/patch-partial-body.e2e-spec.ts` E 가 본다." 라는 동일 문구를 갖는다. 이 문구는 e2e 에 단일 `it('E. ...')` 가 있던 시점 기준이다. 그런데 1R WARNING #2(review/code/2026/09/27/15_46_38/maintainability.md, RESOLUTION `3cc0d092f`) 처분으로 그 테스트가 `E1`·`E2`·`E3` 세 개로 분리됐다(`codebase/backend/test/patch-partial-body.e2e-spec.ts:255,272,299`). 세 DTO 파일의 주석은 이때 갱신되지 않아, 지금은 존재하지 않는 이름("E")을 가리킨다. 리터럴로 `it('E.` 를 찾으려는 다음 사람은 실패하고, 각 DTO가 실제로 E1/E2/E3 중 어느 것과 짝지어지는지도 더 이상 주석에서 드러나지 않는다 — 이 주석이 원래 하려던 일(스웨거 가드의 사각지대를 어느 e2e가 메우는지 추적 가능하게 하는 것)을 스스로 깨뜨린다.
  - 제안: 세 곳을 각 리소스에 맞게 갱신한다 — `workflow-dto-validation.spec.ts` → "E1", `node-dto-validation.spec.ts` → "E2", `auth-config-ip-whitelist.dto.spec.ts` → "E3". 세 파일이 같은 문구를 복붙한 구조이므로 한 군데만 고쳐서는 안 되고 세 군데 모두 손대야 한다.

- **[INFO]** DTO 옆 "null 캐너리" `describe` 블록이 세 파일에 거의 동일하게 반복된다 — 1R 에서 이미 지적·유예된 사항, 변화 없음
  - 위치: `codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts:126-142`, `codebase/backend/src/modules/nodes/dto/node-dto-validation.spec.ts:97-113`, `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts:301-317`
  - 상세: 1R maintainability 리뷰(`review/code/2026/09/27/15_46_38/maintainability.md` INFO 항목)가 지적한 대로, 3줄 JSDoc + `it('검증기가 null 을 통과시킨다', ...)` / `it('OpenAPI 가 nullable 로 광고한다', ...)` 두 테스트 구조가 클래스명·필드명만 다른 채 세 파일에 반복된다. 처분은 "즉시 조치 불요, 네 번째 nullable 필드 추가 시 공용 헬퍼 고려"였고 이번 라운드에도 그대로다.
  - 제안: 기존 유예 판단 유지. 다만 바로 위 WARNING 처럼 "세 곳을 동시에 고쳐야 하는" 상황이 실제로 발생한 것 자체가 이 복붙 구조의 유지보수 비용을 보여준다 — 다음에 네 번째 nullable 필드가 추가되면 `expectNullClearsAndAdvertised(DtoClass, fieldName, seeE2e)` 류 공용 헬퍼 추출을 실제로 고려할 것.

- **[INFO]** 1R WARNING(e2e 단일 `it` 에 3 리소스 혼재)는 이번 라운드에 해결 확인됨 — 새 결함 아님, 참고용
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts:255-321` (`E1`/`E2`/`E3`)
  - 상세: 1R WARNING #2가 지적한 문제(워크플로 단계 실패 시 노드·인증설정 검증이 그 실행에서 전혀 드러나지 않음)가 각 리소스를 독립된 `it()` 로 분리하면서 해결됐다. 새 구조는 각 `it` 이 자체 생성→PATCH→재조회를 반복해 약간의 중복이 생기지만, 실패 지점을 즉시 드러내기 위한 의도된 트레이드오프로 RESOLUTION.md 에 명시돼 있다.
  - 제안: 없음(정보 제공용, 조치 불요).

## 특이사항 없음으로 확인한 항목

- `UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist` 를 `T | null` + `nullable: true` 로 바꾼 방식은 같은 코드베이스에 이미 있던 `containerId?: string | null` 등 패턴과 동일해 컨벤션 일관성이 좋다.
- `nodes.service.spec.ts` · `auth-configs.service.spec.ts` 에 추가된 "명시적 null 은 로드한 값을 지운다" 단위 테스트는 `workflows.service.spec.ts:491-492` 의 기존 동명 테스트(주석 "§5.4 tri-state 의 나머지 한 칸"까지)와 이름·구조가 정확히 일치해 세 서비스 간 대조가 쉽다.
- `omit-undefined.ts`/`.spec.ts` 변경은 JSDoc·핀 테스트(N1 캐너리) 추가뿐으로 매직 넘버·중첩·긴 함수 문제 없음.
- `verifyWebhookRequest` `it.each` null/`[]` 동치 테스트는 중복 없이 두 케이스를 한 테이블로 압축한 좋은 형태.

## 요약

이번 diff 는 세 요청 DTO 의 nullable 선언을 런타임 동작에 맞추는 좁은 범위 변경으로, 기존 컨벤션을 그대로 따르고 매직 넘버·과도한 중첩·긴 함수 없이 전반적으로 깔끔하다. 1R 에서 지적된 e2e 3-리소스 혼재 WARNING 은 `E1`/`E2`/`E3` 분리로 정확히 해결됐다. 다만 그 분리 작업이 세 DTO 스펙 파일에 복붙돼 있던 "이 회귀는 e2e `E` 가 본다" 주석을 갱신하지 않아, 세 파일 모두 이제 존재하지 않는 테스트 이름을 가리키는 stale 참조가 새로 생겼다 — 1R 이 이미 지적하고 유예했던 복붙(DRY) 구조가 "한 곳을 리팩터하면 나머지 참조가 깨진다"는 형태로 현실화된 사례다. 병합을 막을 사유는 아니지만, 세 줄만 고치면 되는 저비용 수정이라 이번 라운드 안에 반영하길 권한다.

## 위험도
LOW
