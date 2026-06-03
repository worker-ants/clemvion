# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] `listAllMakeshopOperations` 함수 — 커밋 메시지 미언급
- 위치: `codebase/backend/src/nodes/integration/makeshop/metadata/index.ts` L221-L237
- 상세: 커밋 메시지의 `metadata/index.ts` 항목에 `MAKESHOP_OPERATIONS_BY_RESOURCE`, `findMakeshopOperation`, `scopeForOperation` 만 열거되어 있으나, `listAllMakeshopOperations` 도 함께 추가되었다. 기능 범위 밖의 추가는 아니다 — `MakeshopMcpBridge.listTools` 가 소비하는 헬퍼이며 `metadata.spec.ts` 에서 직접 사용되어 기능 완결에 필요하다. 커밋 메시지 미기재이지만 over-engineering 으로 보기 어렵다.
- 제안: 커밋 메시지에 `listAllMakeshopOperations` 를 명시적으로 포함하면 추적이 명확해진다. 코드 수정은 불필요.

### [INFO] `constraint-validator.ts` — Phase 0 에서 실질 사용처 없음
- 위치: `codebase/backend/src/nodes/integration/makeshop/metadata/constraint-validator.ts`
- 상세: 파일 주석에 "handler(`makeshop.handler.ts`)와 MCP tool provider(`makeshop-mcp-tool-provider.ts`) 가 호출한다"고 명시되어 있으나, 커밋 메시지는 "노드 미등록(Phase 2), 런타임 surface 없음"을 명시한다. 즉 Phase 0 커밋에서 실제 호출자는 아직 존재하지 않는다. 그러나 types.ts 의 `constraints?` 필드와 metadata.spec.ts 의 제약 검증 테스트를 위해 미리 포함하는 것은 Cafe24 패리티 달성 의도와 일치하고 `metadata.spec.ts` 에서 직접 테스트된다. 독립적인 과도 구현이지만 Phase 2 준비 코드로서 범위 선언에 부합한다.
- 제안: 불필요한 코드는 아님. 허용 범위.

### [INFO] `cpik.md` — `post-cpik_member-check` scope 매핑 검토 필요
- 위치: `spec/conventions/makeshop-api-catalog/cpik.md` L9 (표)
- 상세: `post-cpik_member-check`(연동 여부 확인)와 `post-cpik_member-login`(회원 SSO 토큰)이 catalog 표에서 `write` 로 마킹됐다. `cpik.ts` 메타데이터의 `scopeType: 'write'` 와 일치하므로 카탈로그 동기화는 정확하다. 그러나 "확인(check)"과 "로그인(login)"은 의미상 읽기 작업에 가깝다. 이는 MakeShop Shop API 가 GET 이 아닌 POST 를 사용하는 설계상의 특성이며, 커밋 메시지 `types.ts` 주석("CPIK member check/login POSTs are read-style")이 이를 인지하고 있다. `scopeType` 과 카탈로그 표가 일치하므로 sync 일관성에는 문제 없다.
- 제안: Phase 3 OAuth 구현 시 scope 그룹 재분류가 이뤄질 예정이므로 현재 상태는 수용 가능.

## 요약

본 커밋(Phase 0)은 "MakeShop operation metadata 레이어 161 REST op"라는 명시된 범위에 정확히 부합한다. 7개 섹션 메타데이터 파일(benefit/board/cpik/member/order/product/shop), index/types/constraint-validator/public-meta, 테스트 2개(metadata.spec.ts + catalog-sync.spec.ts), catalog 7개 md 파일 컬럼 승격이 모두 커밋 메시지 선언과 일치한다. 기존 파일에 대한 수정은 catalog `.md` 파일의 컬럼 구조 업데이트와 `_overview.md` 주석 1줄 변경으로 한정되며, 이는 sync 승격의 필수 동반 변경이다. 요청 범위를 벗어난 리팩토링, 무관한 파일 수정, 불필요한 포맷팅/임포트 변경은 발견되지 않았다. `listAllMakeshopOperations` 미기재와 `constraint-validator.ts` 의 선제적 포함은 INFO 수준이며 차단 사유가 없다.

## 위험도

NONE
