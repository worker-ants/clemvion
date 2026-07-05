# 부작용(Side Effect) 리뷰

## 리뷰 범위 요약
21개 cafe24 metadata 파일(`application.ts`, `category.ts`, `collection.ts`, `community.ts`,
`customer.ts`, `date-descriptions.ts`, `design.ts`, `mileage.ts`, `notification.ts`,
`order.ts`, `personal.ts`, `privacy.ts`, `product.ts`, `promotion.ts`, `salesreport.ts`,
`shipping.ts`, `store.ts`, `supply.ts`, `translation.ts`) + 2개 spec 테스트 파일
(`product-fields.spec.ts` 신규, `public-meta.spec.ts` 소폭 수정) + `plan/in-progress/cafe24-backlog-residual.md`
진행상태 갱신. 전체 diff 는 22개 파일, +18,496/-1,735 로 대규모이나 **전량 `codebase/backend/src/nodes/integration/cafe24/metadata/` 디렉터리 내부**에 국한된다(핸들러·서비스·컨트롤러·인프라 파일 무변경 확인: `types.ts`, `cafe24.handler.ts` 등 전혀 diff 없음).

## 발견사항

- **[INFO]** 순수 정적 데이터 선언 변경 — 실행 부작용 표면 없음
  - 위치: 전체 21개 metadata 파일
  - 상세: 모든 변경은 `export const xxxOperations: Cafe24OperationMetadata[] = [...]` 형태의 리터럴 배열/객체 데이터 확장(`fields`, `constraints`, `description`)이다. 함수 정의·클로저·클래스·부수효과를 유발하는 코드(파일 I/O, 네트워크 호출, 전역 mutable 상태, `process.env` 접근 등)는 어디에도 도입되지 않았다. `grep`으로 `export function|import fs|process\.|fetch\(|require\(` 패턴을 전 파일에서 확인한 결과 신규로 추가된 것은 `date-descriptions.js` 로부터의 상수 import뿐이다.
  - 제안: 없음 (정보성 확인).

- **[INFO]** `types.ts` (스키마) 및 `cafe24.handler.ts` (소비 로직) 무변경 — 인터페이스/시그니처 영향 없음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/types.ts` (diff 없음), 핸들러 계열 파일 (diff 없음)
  - 상세: `constraints`(`allOrNone`, `impliesValue`) 필드 형태는 이번 diff 이전부터 `Cafe24OperationMetadata` 타입에 이미 존재하던 스키마이며, 이번 변경은 기존 스키마를 채우는 데이터 확장일 뿐 타입/인터페이스 자체를 바꾸지 않았다. 핸들러가 `fields` key 를 그대로 query/body 파라미터명으로 전송하는 소비 로직(diff 코멘트에 언급된 `buildRequest`)도 변경되지 않았으므로, 필드 추가·이름 변경이 핸들러 동작에 미치는 영향은 "요청에 실리는 파라미터가 늘어난다/필드명이 docs 명으로 바뀐다"는 데이터 레벨 효과로 국한된다.
  - 제안: 없음.

- **[WARNING]** 일부 필드의 **타입/이름 변경**은 사실상 "숨은 인터페이스 변경" — 기존 워크플로 노드 설정(저장된 config)과의 호환성 확인 필요
  - 위치: 예) `application.ts`의 `scripttags/{script_no}` 계열 `script_no: number → string`, `design.ts`의 `page_path → path` 필드명 교체, `product-fields.spec.ts`가 검증하는 `since/until → created_start_date/created_end_date`, `category_no → category` (product.ts)
  - 상세: metadata 는 노드 UI 폼 스키마이자 실행 시 파라미터 키로 그대로 쓰이므로, 이미 저장된 워크플로(과거 field 이름/shape 로 저장된 노드 config)가 있다면 실행 시 해당 필드가 "알 수 없는 필드"로 취급되거나 무시될 수 있다. 이는 코드 자체의 부작용이라기보다 **이미 배포되어 사용자 워크플로에 저장된 데이터와의 하위 호환성 이슈**이며, 순수 리뷰 대상 diff 만으로는 마이그레이션 여부를 판단할 수 없다. plan 문서(§G-1-P)에 "비동작 alias 교체"로 명시되어 의도된 변경임은 확인했으나, 회귀 가드(`product-fields.spec.ts`)는 신규 필드 존재만 검증할 뿐 기존 저장된 워크플로에 대한 마이그레이션/하위호환 처리는 diff 범위에 없다.
  - 제안: 이미 배포된 프로덕션 워크플로에 구 필드명(`page_path`, `since`, `category_no` 등)으로 저장된 node config 가 존재하는지 별도로 확인이 필요하면 developer/planner 트랙에서 후속 검토(마이그레이션 필요 여부)를 명시적으로 판단할 것. (본 PR 자체의 코드 부작용은 아니므로 CRITICAL 아닌 WARNING으로 분류)

- **[INFO]** `plan/in-progress/cafe24-backlog-residual.md` 파일 갱신은 계획 문서의 정상적인 진행상태 기록
  - 위치: `plan/in-progress/cafe24-backlog-residual.md`
  - 상세: 코드 실행에 영향 없는 문서성 변경(체크박스·진행상황 서술 갱신)이며 예상된 파일시스템 변경(git 커밋 대상)이다. 부작용 아님.

- **[INFO]** 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 변경 없음
  - 위치: 전체 diff
  - 상세: 8개 점검 관점 중 "의도치 않은 상태 변경", "전역 변수", "파일시스템 부작용(예상 밖)", "환경 변수", "네트워크 호출", "이벤트/콜백" 항목에 해당하는 변경은 발견되지 않았다. 함수 시그니처 변경도 없다(변경된 것은 모두 데이터 리터럴이며 어떤 함수도 재정의되지 않음).

## 요약
이번 변경은 cafe24 통합 노드의 operation metadata(정적 데이터 카탈로그)를 공식 API 문서와 전량 미러링하는 대규모 데이터 확장(+18k/-1.7k 라인, 21개 metadata 파일)으로, 실행 로직·핸들러·타입 스키마·전역 상태·네트워크/파일시스템/환경변수 접근에는 전혀 손대지 않았다. 함수 시그니처나 공개 인터페이스(타입) 변경도 없어 코드 레벨의 부작용 위험은 매우 낮다. 다만 일부 필드의 이름/타입이 docs 정합을 이유로 변경되었는데(`page_path→path`, `since/until→created_*`, `category_no→category`, `script_no: number→string` 등), 이는 노드 설정 스키마의 실질적 변경이므로 이미 저장된 프로덕션 워크플로의 하위 호환성에 영향을 줄 수 있는 잠재 이슈로 별도 확인이 필요하다(코드 자체 결함은 아님).

## 위험도
LOW
