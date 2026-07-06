# 요구사항(Requirement) Review

## 컨텍스트

리뷰 대상은 cafe24 통합 노드의 metadata field-set 대량 확장(G-1-remaining/G-1-P, `plan/in-progress/cafe24-backlog-residual.md`) — 18개 resource(485 operation) 전부를 `spec/conventions/cafe24-api-catalog/<resource>/*.md` 공식 docs 카탈로그와 field 단위로 미러링. `application.ts`/`collection.ts`/`date-descriptions.ts`/`design.ts`/`mileage.ts`/`notification.ts`/`personal.ts`/`privacy.ts`/`product-fields.spec.ts` 등을 직접 diff·spec 대조. `codebase/backend/src/nodes/integration/cafe24/metadata` 전체 unit 105 pass, cafe24 전체 209 pass 확인(런타임 재현).

## 발견사항

- **[CRITICAL]** `requiredFields` 가 docs `필수(✓)` 컬럼과 체계적으로 어긋난다 — field 명/타입/enum/description 은 docs 와 정확히 미러됐지만, 무조건-AND 로 required 인 필드가 `requiredFields` 에 반영되지 않은 사례가 다수 존재.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/mileage.ts:89-128` (`mileage_grant`), `mileage.ts:150-215`(`mileage_autoexpiration_create`), `codebase/backend/src/nodes/integration/cafe24/metadata/notification.ts:8-50`(`sms_send`, 정확한 op id 는 diff 상 `POST sms`).
  - 상세:
    - `mileage_grant`: `spec/conventions/cafe24-api-catalog/mileage/points.md` `POST /points` 표에서 `type` 이 `필수=✓`. 그러나 diff 는 `type` 필드에서 기존 `default: 'increase'` 를 **제거**하면서 `requiredFields`(`['member_id','amount','reason']`) 에는 추가하지 않았다 — 결과적으로 `type` 은 required 도 default 도 없는 상태가 됐다. 이전(default 존재)보다 계약이 더 느슨해진 방향의 회귀.
    - `mileage_autoexpiration_create`: `points-autoexpiration.md` `POST /points/autoexpiration` 표에서 `interval_month`/`target_period_month`/`standard_point` 모두 `필수=✓`. diff 의 `requiredFields` 는 `['expiration_date']` 뿐이다(`mileage.ts:158`).
    - `notification` `POST sms`: `spec/conventions/cafe24-api-catalog/notification/sms.md` 에서 `sender_no` 가 `필수=✓`. diff 의 `requiredFields` 는 `['content']` 뿐 (`notification.ts:8` 부근, diff 라인 1790).
  - 이 gap 은 `catalog-docs-drift.spec.ts`(method/path/scope 만 검증) 도, `metadata.spec.ts`(subset invariant 만 검증) 도, `product-fields.spec.ts` 류 신규 타깃 테스트도 잡지 못한다 — required 여부는 어떤 가드에도 없어 회귀가 조용히 남는다.
  - `mileage.ts` 파일 헤더 주석(`"requiredFields 는 기존 계약을 보존하되 ... fields 에 실재하는 것만 남긴다"`)은 이 스코프 제한을 **의도적으로 문서화**하고 있으나, `spec/conventions/cafe24-api-metadata.md` §2 의 `requiredFields` 정의(AND-semantic, docs 조건부는 constraints 로 별도 구조화)는 "무조건 필수인 필드는 requiredFields 에 반영" 을 전제로 한다 — 즉 "기존 계약 보존" 규칙 자체가 spec 의 암묵적 기대(신규 확장 시 무조건-필수 필드도 미러)와 어긋난다. 코드 코멘트가 스코프를 좁힌 것이지 spec 이 이를 승인한 것은 아니다.
  - 제안: (1) 위 3개 operation 의 `requiredFields` 를 docs `✓` 기준으로 보강(`mileage_grant`→`type` 추가 또는 최소 `default: 'increase'` 복원, `mileage_autoexpiration_create`→`interval_month`/`target_period_month`/`standard_point` 추가, `sms_send`→`sender_no` 추가). (2) 이번 대량 확장 전체(18 resource/485 op)에 대해 "docs 필수(✓) ⊆ requiredFields" 를 검증하는 회귀 가드를 `metadata.spec.ts` 또는 신규 spec 에 추가 — 현재는 field-set 존재 여부만 커버되고 requiredness 는 전수 미검증 상태라 이 CRITICAL 이 다른 resource 에도 잠재할 가능성이 높다(본 리뷰는 표본 검사만 수행, 전수 아님).

- **[WARNING]** `mileage_grant.type` 의 `default: 'increase'` 제거가 문서화된 근거 없이 이루어짐.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/mileage.ts` (diff 상 `type: { type:'enum', enum:['increase','decrease'], description: 'Increase or decrease points' }`, 이전엔 `default: 'increase'` 존재).
  - 상세: docs 에는 `type` 에 대한 기본값 표기가 없다(빈 칸) — 즉 default 제거 자체는 docs 정합화의 자연스러운 결과일 수 있으나, 그 경우 `type` 을 `requiredFields` 로 승격해야 앞뒤가 맞는다. 현재 상태(둘 다 없음)는 위 CRITICAL 의 근본 원인이다.
  - 제안: 위 CRITICAL 수정과 함께 처리.

- **[INFO]** `application.ts`의 `scripttags_create`/`scripttags_update` 가 `src` 를 `requiredFields` 에 유지(docs 는 `src` 를 optional 로 표시)하는 것은 본 diff 에서 새로 도입된 것이 아니라 기존 계약을 그대로 보존한 것으로 확인(`git show HEAD~1` 대조). 신규 회귀 아님 — 단, 향후 "docs 전량 정합" 목표에서는 이 방향(과잉-strict)도 함께 재검토 대상이 될 수 있음.

- **[INFO]** field type 선택(`skin_no`/`display_location`/`exclude_path` 를 `array` 대신 `string`, comma-separated 규약)은 cafe24 응답 스키마가 array 인 것과 달리 **요청 파라미터**는 콤마-구분 문자열이라는 docs 텍스트("`,(콤마)로 여러 건을 검색할 수 있다`")와 일치 — 의도된 설계로 확인, 문제 없음.

- **[INFO]** `constraints`(`allOrNone`/`impliesValue`)가 `cafe24.handler.ts` 의 `validateCafe24Constraints` 를 통해 실제 런타임에 강제됨을 확인(`cafe24.handler.ts:212-221`) — 장식용 메타데이터가 아니라 기능적으로 작동. `Cafe24FieldConstraint` 타입·invariant(`metadata.spec.ts`)도 `spec/conventions/cafe24-api-metadata.md` §2 와 line-level 일치.

- **[INFO]** plan(`plan/in-progress/cafe24-backlog-residual.md` §G-1-P)의 "전 18 resource(485 op) field-set docs 미러 완료" 및 "unit 7638 pass(cafe24 metadata 105 포함)" 주장은 본 세션에서 `metadata` 스코프(105) 및 `cafe24` 전체 스코프(209) 재실행으로 확인됨(재현 성공). plan 자체는 이번 리뷰 대상 diff 와 별개 문서(리뷰 대상 아님)이나 정황 신뢰도 확인용으로 실행.

## 요약

field 명·타입·enum·description·offset/limit 제외·date-pair `allOrNone` constraint 등 field-set 미러의 대다수 항목은 catalog 문서와 line-level 로 정확히 일치하며, `constraints` 는 장식이 아니라 handler 에서 실제 검증되는 기능이다. 다만 표본 검사에서 `mileage.ts`(`mileage_grant`, `mileage_autoexpiration_create`)와 `notification.ts`(`sms` 발송)에서 docs 가 명시적으로 `필수(✓)` 로 표기한 필드가 `requiredFields` 에 반영되지 않은 CRITICAL 급 누락을 발견했다 — 이 중 `mileage_grant.type` 은 기존 `default` 값까지 제거되어 이전보다 계약이 느슨해지는 방향의 회귀다. 이 클래스의 문제는 어떤 기존/신규 가드(`catalog-docs-drift`, `metadata.spec`, `product-fields.spec`)로도 검출되지 않으므로, "docs 전량 미러 완료"라는 완료 선언에도 불구하고 18 resource 전체에 유사 누락이 잠재할 가능성이 있다(본 리뷰는 표본 검사만 수행). requiredFields 정합성에 대한 전수 회귀 가드 추가와 위 3개 operation 의 즉시 fix 를 권고한다.

## 위험도

MEDIUM — 완전한 미기능(0 케이스)은 아니고 field-set 자체는 정확하나, required 필드 누락은 실사용 시 Cafe24 API 400 에러(또는 `type` 처럼 애매한 동작)로 이어질 수 있는 실질적 계약 결함이며 회귀 가드 부재로 재발/잔존 가능성이 있어 CRITICAL 발견사항 포함.
