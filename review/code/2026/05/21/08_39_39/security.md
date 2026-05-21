# 보안(Security) 리뷰 결과

리뷰 대상: Cafe24 planned operation 전수 구현 (order.ts, product.ts, planned.ts, store.ts, plan md, consistency review md)
리뷰 일시: 2026-05-21

---

## 발견사항

### 발견사항 없음 — CRITICAL

하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 인증 우회, 평문 시크릿 전송 등 즉각적 위협 요소가 없습니다.

---

### [INFO] path 파라미터 타입 불일치 — `memo_no` / `icon_no` / `tag_no` 의 타입 선언

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/product.ts`
  - `product_memos_get` / `product_memos_update` / `product_memos_delete`: `memo_no: { type: 'string', location: 'path' }`
  - `product_icons_delete`: `icon_no: { type: 'string', location: 'path' }`
  - `product_tags_delete`: `tag_no: { type: 'string', location: 'path' }`
- 상세: Cafe24 Admin API 에서 위 id 류 필드는 일반적으로 숫자(정수)다. `type: 'string'` 으로 선언된 경우 상위 레이어가 이 값을 문자열로 받아 URL에 그대로 삽입할 때 `../` 등 경로 조작 시퀀스를 포함한 값이 입력될 경우 경로 탐색(path traversal) 위험이 이론적으로 존재한다. 단, 이 메타데이터 레이어가 단순히 API 경로 템플릿 정의에 그치고 실제 URL 치환 레이어에서 별도 검증이 이루어진다면 위험은 낮다.
- 제안:
  1. 실제 숫자 ID 필드는 `type: 'number'` 로 통일하여 상위 레이어가 정수 강제 변환을 수행하게 한다.
  2. URL 경로 파라미터 치환 레이어에서 path segment 값이 숫자인지, 또는 허용된 문자(영숫자·언더스코어) 만 포함하는지 검증하는 가드를 확인/추가한다.

---

### [INFO] `bundleproducts_create` 의 `requiredFields: []` + `fields: {}` — 임의 바디 전달 가능성

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/product.ts`, `bundleproducts_create` 항목
- 상세: `requiredFields` 가 빈 배열이고 `fields` 도 빈 오브젝트다. 이 구조는 사용자가 임의의 키-값 쌍을 요청 바디에 삽입할 수 있는지 여부가 상위 핸들러의 필드 화이트리스트 정책에 달려 있음을 의미한다. 만약 핸들러가 `fields` 에 없는 키를 그대로 Cafe24 API 에 포워딩한다면 의도하지 않은 파라미터 오염(mass assignment) 위험이 있다.
- 제안: 상위 Cafe24 API 호출 핸들러가 `fields` 맵을 화이트리스트로 사용하여 선언되지 않은 키는 제거하는지 확인한다. 그렇지 않다면 `bundleproducts_create` 의 실제 Cafe24 API 필드를 확인하고 `fields` 에 명시적으로 등록해야 한다.

---

### [INFO] `order_autocalculation_delete` 의 `scopeType: 'write'` — 파괴적 작업 접근 제어 주의

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/order.ts`, `order_autocalculation_delete` 항목
- 상세: 자동 계산 해제 DELETE 작업이 `write` scope 로만 제한되어 있으며, 해당 order에 대한 소유권 검증(예: 해당 쇼핑몰/점포 owner 확인)이 메타데이터 레이어 바깥에서 이루어지는지 확인이 필요하다. 메타데이터 파일 자체에는 인가 로직이 없으므로, 실제 API 호출 레이어에서 요청자가 해당 `order_id` 에 접근 권한이 있는지 검증하는지 확인 필요.
- 제안: 이 레이어(메타데이터 정의)는 scopeType 만 선언하므로 실제 인가 검증은 상위 핸들러에서 이루어져야 한다. 핸들러 레이어의 인가 로직이 `order_id` 소유권을 검증하는지 별도 리뷰를 권장한다.

---

### [INFO] `_retry_state.json` 에 절대 경로 노출

- 위치: `review/consistency/2026/05/21/07_31_53/_retry_state.json`
- 상세: `/Volumes/project/private/clemvion/...` 형태의 로컬 파일 시스템 절대 경로가 커밋된 파일에 포함되어 있다. 이 파일이 공개 저장소에 노출될 경우 개발 환경의 디렉토리 구조 정보가 유출된다.
- 제안: `review/` 산출물 파일은 `.gitignore` 에서 제외하거나, `_retry_state.json` 처럼 내부 오케스트레이션 상태 파일은 커밋 대상에서 제외하는 정책을 검토한다. 최소한 절대 경로 대신 상대 경로 또는 프로젝트 루트 기준 상대 경로를 사용하도록 생성 로직을 수정한다.

---

## 요약

이번 변경은 Cafe24 API 엔드포인트 메타데이터를 TypeScript 상수 배열로 정의하는 순수 데이터 선언 레이어다. 실제 인증·인가 처리, 데이터베이스 접근, 외부 입력 처리 로직이 포함되어 있지 않으므로 직접적인 인젝션 취약점, 하드코딩된 시크릿, 암호화 결함은 발견되지 않는다. 다만 일부 path 파라미터의 타입 선언이 `string`으로 되어 있어 상위 레이어의 경로 파라미터 검증 강도에 따라 이론적 경로 탐색 위험이 존재하고, `bundleproducts_create` 처럼 `fields: {}` 로 선언된 항목은 상위 핸들러의 화이트리스트 정책이 없을 경우 mass assignment 문제가 발생할 수 있다. `_retry_state.json` 에 포함된 로컬 절대 경로는 정보 노출의 소지가 있어 생성 방식 개선이 권장된다. 전반적으로 이 PR의 보안 위험도는 낮으며, 위 INFO 항목은 메타데이터 정의 레이어를 소비하는 상위 레이어의 구현 품질에 달려 있다.

---

## 위험도

LOW
