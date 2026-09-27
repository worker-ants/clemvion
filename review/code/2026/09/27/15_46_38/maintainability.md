# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** e2e 테스트 하나에 서로 독립적인 세 리소스(워크플로 · 노드 · 인증 설정)의 검증이 섞여 있다
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts:254` (`it('E. nullable 필드에 null 을 보내면 값을 지운다 — 워크플로 · 노드 설명, 인증 설정 IP 화이트리스트', ...)`, 254~305)
  - 상세: 하나의 `it()` 안에서 (1) 워크플로 생성→PATCH `description: null`→GET 재확인, (2) 노드 생성→PATCH `description: null`→목록 재확인, (3) 인증 설정 생성→PATCH `ipWhitelist: null`→GET 재확인 을 순차로 수행한다. 세 흐름은 서로 다른 라우트·엔티티를 검증하므로 개념적으로 독립된 케이스인데, 하나로 묶여 있어 (a) 테스트 이름이 실제로 검증하는 3가지를 다 담지 못하고, (b) 앞부분(워크플로)에서 실패하면 뒤(노드·인증 설정)는 실행되지 않아 한 번의 실행으로 세 표면의 상태를 모두 알 수 없다.
  - 제안: 워크플로/노드/인증 설정 세 케이스를 별도의 `it()`(혹은 `it.each`)로 분리하면 실패 시 어느 표면이 깨졌는지 즉시 드러나고, 이름도 각 리소스에 맞게 좁힐 수 있다. 생성→PATCH→검증→재조회 흐름이 세 번 거의 동일하게 반복되므로, 공용 헬퍼(`patchAndVerifyNulled(url, createBody, field)` 류)로 뽑으면 중복도 함께 줄어든다.

- **[INFO]** "null 캐너리" 두 `it()` 블록과 그 설명 주석이 세 스펙 파일에 거의 동일하게 반복된다
  - 위치: `codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts:126-141` (`describe('UpdateAuthConfigDto.ipWhitelist — null 을 받는다', ...)`), `codebase/backend/src/modules/nodes/dto/node-dto-validation.spec.ts:97-112` (`describe('UpdateNodeDto.description — null 을 받는다', ...)`), `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts:301-316` (`describe('UpdateWorkflowDto.description — null 을 받는다', ...)`)
  - 상세: 세 파일 모두 (1) 3줄짜리 설명 JSDoc이 "swagger 가드는 데코레이터와 TS 타입 중 **하나만** 되돌리면 잡지만 **둘을 함께** 되돌리면..." 문구까지 토씨 하나 다르지 않게 반복되고, (2) `it('검증기가 null 을 통과시킨다', ...)` / `it('OpenAPI 가 nullable 로 광고한다', ...)` 두 테스트의 본문 구조가 DTO 클래스명·필드명만 바뀐 채 동일하다. plan(`plan/in-progress/patch-body-followups.md`)의 뮤턴트 표(D4~D6)가 보여주듯 이 캐너리는 의도적으로 각 DTO마다 심어야 하는 회귀 방지 장치라 완전한 통합은 어렵지만, 본문 로직만이라도 `expectNullClearsAndAdvertised(DtoClass, fieldName)` 같은 공용 헬퍼로 뽑으면 새 필드가 추가될 때마다 동일한 보일러플레이트를 복붙하지 않아도 된다.
  - 제안: 즉시 조치가 필요한 수준은 아니다(테스트 로컬리티 vs DRY의 트레이드오프). 다음에 네 번째 nullable 필드가 추가되는 시점에는 공용 헬퍼 추출을 고려할 것을 권한다.

## 특이사항 없음으로 확인한 항목

- `omit-undefined.ts` 는 코드 변경 없이 JSDoc만 보강했고, 새로 추가된 경고("인자 자체가 null 이면 `Object.entries` 가 던진다")는 실제 동작·과거 장애(`settings: null` 500)를 정확히 반영한다.
- `UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist` 를 `T | null` + `nullable: true` 로 바꾼 방식은 같은 파일에 이미 있던 `folderId?: string | null` / `containerId?: string | null` / `toolOwnerId?: string | null` 패턴과 동일해 컨벤션 일관성이 좋다. 매직 넘버·과도한 중첩·긴 함수 없음.
- `auth-configs.service.spec.ts` · `nodes.service.spec.ts` 에 추가된 "명시적 null 은 로드한 값을 지운다" 단위 테스트는 기존 워크플로 서비스 스펙의 동명 테스트와 이름·구조가 일치해 검색·대조가 쉽다.
- CHANGELOG 항목은 기존 항목들의 서술 톤·형식(변경 전/후 동작 요약, 동작 변화 없음 명시)을 그대로 따른다.

## 요약

이번 변경은 세 요청 DTO의 `nullable` 선언을 실제 런타임 동작에 맞추는 좁은 범위의 수정이며, 기존 코드베이스에 이미 있던 `nullable: true` + `T | null` 패턴을 그대로 재사용해 일관성이 높고 새로운 복잡도·중첩·매직 넘버를 들여오지 않았다. 유일하게 눈에 띄는 점은 e2e 테스트 하나가 서로 무관한 세 리소스 검증을 한 테스트에 몰아넣어 실패 시 원인 파악을 어렵게 한다는 것과, DTO별 "null 캐너리" 테스트 보일러플레이트가 세 파일에 반복된다는 것인데 둘 다 차단 사유는 아니며 후속 개선으로 충분하다.

## 위험도
LOW
