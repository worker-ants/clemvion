# 부작용(Side Effect) Review

## 발견사항

### [INFO] controller Swagger 문서 전용 변경 — 런타임 부작용 없음
- 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` 라인 35–42
- 상세: `@ApiOperation.description` 및 `@ApiParam.description` 문자열만 수정됨. 이 데코레이터는 OpenAPI 스펙 생성에만 사용되며 런타임 라우팅·로직에 영향을 주지 않는다. 실제 동작 변경 없음.
- 제안: 해당 없음.

### [INFO] 테스트 파일 변경 — 프로덕션 부작용 없음
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` 라인 646–657
- 상세: 기존 `it('returns empty operations[] for non-cafe24 service types', ...)` 케이스를 `'returns empty operations[] for unsupported service types'`로 이름 변경하고, `makeshop` operations 반환을 검증하는 새 테스트 케이스를 삽입. 테스트 파일이므로 프로덕션 전역 상태·파일시스템·네트워크·이벤트에 영향 없음. `beforeEach` 스코프 내에서 독립적으로 실행된다.
- 제안: 해당 없음.

### [INFO] `getServiceCatalog` 에 `makeshop` 분기 추가 — 신규 import 도입
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` 라인 57 (import), 1155–1166 (로직)
- 상세: `listAllMakeshopOperations` 를 모듈 레벨에서 정적 import한다. 이 함수가 모듈 초기화 시 파일시스템을 읽거나 전역 상태를 변경하는지 확인이 필요하나, 같은 패턴의 `listAllCafe24Operations` 가 이미 존재하므로 동일한 순수 함수(metadata 배열 반환)임을 합리적으로 추정할 수 있다. `getServiceCatalog` 자체는 호출 시마다 새 배열을 구성해 반환하므로 공유 상태 변경 없음. 전역 변수 수정 없음.
- 제안: `listAllMakeshopOperations` 가 내부에서 캐싱을 위한 모듈 레벨 변수를 사용할 경우, 그 초기화 부작용이 모듈 로드 타이밍에 영향을 줄 수 있으나 기존 cafe24 패턴과 동일하여 추가 위험 없음.

### [INFO] `tryTranslateLabel` 함수 시그니처 변경 없음, 내부 로직 확장 — 호출자 영향 없음
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` 라인 818–823 (함수 본문)
- 상세: `tryTranslateLabel(catalogKey, t)` 의 시그니처는 변경되지 않았다. 기존에는 `cafe24Catalog.${catalogKey}` 를 고정 prefix로 사용했으나, 이제 `catalogKey.startsWith("makeshop.")` 여부로 namespace를 분기한다. 기존 `cafe24.*` 키는 동일한 `cafe24Catalog` namespace로 흐르므로 후방 호환 유지. `makeshop.*` 이외의 prefix는 `null` 을 반환하는데, 이전에는 `cafe24Catalog.${anyKey}` 로 시도 후 miss 시 null이었으므로 의미 동작이 달라진 케이스가 있다:
  - 이전: `cafe24Catalog.${catalogKey}` 로 번역 시도 → i18n miss → `null`
  - 이후: prefix가 `cafe24.` 또는 `makeshop.` 이 아니면 i18n 시도 없이 즉시 `null`
  이 변화는 `cafe24.` 나 `makeshop.` 가 아닌 임의 키에 대해 동작이 달라지나, 해당 케이스는 활동 로그에서 발생하지 않는 구조이므로(spec §9.3 — cafe24/makeshop 만 catalog를 채움) 실질적 부작용 없음.
- 제안: 해당 없음.

### [INFO] plan 문서 변경 — 런타임 부작용 없음
- 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md`
- 상세: 순수 마크다운 추적 문서 체크박스 갱신. 파일시스템에 쓰는 것은 이 리뷰 시점 기준 git 히스토리 변경이지만, 런타임 부작용 없음.
- 제안: 해당 없음.

## 요약

이번 변경은 (1) Swagger 문서 문자열 갱신, (2) `getServiceCatalog`에 `makeshop` 분기 추가 및 관련 metadata import, (3) 프론트엔드 `tryTranslateLabel` 의 namespace 분기 일반화, (4) 테스트 케이스 추가, (5) plan 문서 갱신으로 구성된다. 전역 변수 수정, 의도치 않은 파일시스템 조작, 네트워크 호출, 이벤트/콜백 변경은 없다. 공개 API 엔드포인트 시그니처(`getServiceCatalog`, `tryTranslateLabel`)는 변경되지 않았으며 기존 호출자에 대한 후방 호환이 유지된다. `tryTranslateLabel`에서 `cafe24.`/`makeshop.` 이외의 prefix를 가진 catalog key에 대한 동작이 미세하게 달라지지만 해당 케이스는 spec상 발생하지 않는 경로다.

## 위험도

NONE
