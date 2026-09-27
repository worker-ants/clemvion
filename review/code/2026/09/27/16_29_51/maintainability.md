# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 검증 옵션 리터럴 `{ whitelist: true, forbidNonWhitelisted: true }` 가 이제 세 스펙 파일에 동일하게 존재한다
  - 위치: `codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts:8`(신규 추가) — `codebase/backend/src/modules/nodes/dto/node-dto-validation.spec.ts:8`, `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts:12`(기존)
  - 상세: 이번 diff 가 `auth-config-ip-whitelist.dto.spec.ts` 에 `const VALIDATE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };` 를 새로 추가하면서, 이미 두 파일에 있던 동일한 상수 정의가 세 번째로 늘었다. 값 자체는 안정적(class-validator 의 표준 strict 옵션)이라 drift 위험은 낮지만, 세 파일이 같은 리터럴을 복붙하고 있어 이 옵션을 바꿔야 할 미래 시점에 세 곳을 동기화해야 한다.
  - 제안: 즉시 조치 불요. 네 번째 DTO 스펙이 같은 패턴을 필요로 하는 시점에 `shared/testing/` 아래 공용 상수(예: `STRICT_VALIDATE_OPTIONS`)로 추출을 고려.

- **[INFO]** "선언 캐너리"(`... — null 을 받는다`) `describe` 블록이 3파일에 걸쳐 JSDoc 3줄 + `it` 2개 구조까지 거의 토씨 하나 다르지 않게 반복된다 — 직전 리뷰 라운드(`review/code/2026/09/27/15_46_38/maintainability.md`)에서 이미 INFO 로 지적됐고 "테스트 로컬리티 vs DRY 트레이드오프, 즉시 조치 불요"로 처분된 사항이 이번 병합본에도 그대로 남아 있다.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts:131`, `codebase/backend/src/modules/nodes/dto/node-dto-validation.spec.ts:102`, `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts:306`
  - 상세: 새로운 결함은 아니며 재확인 목적의 기재. `contractForDto(DtoClass)` + `schema.properties?.<field>` 로 이어지는 두 번째 `it` 본문 구조가 DTO/필드명만 바뀐 채 동일하다.
  - 제안: 기존 처분(다음 nullable 필드 추가 시 공용 헬퍼 검토)을 유지. 이번 병합에서 추가 조치 불필요.

- **[INFO]** e2e `patch-partial-body.e2e-spec.ts` 의 E1/E2/E3 세 테스트가 "리소스 생성 → PATCH `null` → 응답/저장값 재확인" 구조를 세 번 반복한다
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts:255`(E1), `:272`(E2), `:299`(E3)
  - 상세: 직전 라운드에서 하나의 `it('E. ...')` 로 세 리소스를 몰아넣던 것을 WARNING 으로 지적받아 이번에 E1/E2/E3 로 분리했다(개선 확인). 다만 그 리뷰가 함께 제안했던 공용 헬퍼(`patchAndVerifyNulled(url, createBody, field)` 류) 추출은 적용되지 않아, 3개 테스트가 여전히 거의 동일한 create→patch→verify 뼈대를 각자 손으로 반복한다. 세 리소스가 서로 다른 라우트·응답 스키마(노드는 목록에서 `find`, 워크플로/인증설정은 단건 `GET`)를 갖고 있어 완전한 통합이 부자연스러운 면은 있다.
  - 제안: 차단 사유 아님. 분리로 실패 원인 특정성은 이미 확보됐으므로, 헬퍼 추출은 후속 개선으로 남겨도 무방.

## 특이사항 없음으로 확인한 항목

- `UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist` 를 `T | null` + `nullable: true` 로 바꾼 세 변경은 각 DTO 파일에서 형태·순서가 동일해 예측 가능하고, 같은 파일에 이미 있던 `folderId?: string | null` 류 nullable 패턴과 일치한다.
- `omit-undefined.ts`/`omit-undefined.spec.ts` 변경은 JSDoc·계약 테스트 추가뿐으로 함수 본문·복잡도 변화 없음.
- `auth-configs.service.spec.ts`(380행대)·`nodes.service.spec.ts`(230행대) 에 추가된 "명시적 null 은 로드한 값을 지운다" 테스트는 기존 워크플로 서비스 스펙의 동명 테스트와 이름·구조가 일치해 검색·대조가 쉽다.
- CHANGELOG 항목은 기존 항목들의 서술 톤·형식을 그대로 따른다.
- 매직 넘버·과도한 중첩·긴 함수(30줄 이상 단일 책임 위반)는 이번 diff 범위(코드 파일 12개) 어디에도 없다. 순환 복잡도를 높이는 신규 분기도 없다.
- `review/code/2026/09/27/15_46_38/**`, `review/code/2026/09/27/16_07_49/**`, `review/consistency/2026/09/27/15_19_25/**`, `plan/in-progress/*.md` 는 이전 리뷰·컨시스턴시 라운드의 산출물/추적 문서이며 애플리케이션 코드가 아니다. 유지보수성 관점(가독성·네이밍·함수 길이·중첩·매직 넘버·중복·복잡도)을 적용할 대상이 아니라고 판단해 별도 발견사항으로 다루지 않았다.

## 요약

이번 병합본은 세 요청 DTO 의 `nullable` 선언을 실제 런타임 동작에 맞추는 좁은 범위의 수정이며, 기존 코드베이스 패턴을 그대로 재사용해 일관성이 높다. 직전 리뷰 라운드에서 지적된 e2e 테스트 뭉침(WARNING)은 E1/E2/E3 분리로 해소됐고, 테스트 보일러플레이트 중복(선언 캐너리, 검증 옵션 상수)은 여전히 소폭 남아 있으나 모두 INFO 수준이며 이전 라운드에서 이미 "즉시 조치 불요"로 처분된 트레이드오프의 연장선이다. 새로운 복잡도·중첩·매직 넘버·긴 함수는 도입되지 않았다.

## 위험도

LOW
