# Cross-Spec 일관성 검토 — spec-draft-integration-personal-owner-callback

## 발견사항

없음. CRITICAL·WARNING·INFO 모두 미검출.

### 검증 근거

target draft 의 세 변경안을 실제 구현·인접 spec 과 대조했다.

1. **data-flow/5-integration.md §1.2 노트 + 불릿** — `codebase/backend/.../integration-oauth.service.ts`
   `assertRequesterStillAllowed`(L411-433) 를 직접 읽어 확인: `SELECT ... FOR UPDATE` 락 취득 직후, 자격 증명
   `UPDATE` 직전에 (a) `integration.status === 'pending_install'` 이면 조기 return, (b) 아니면
   `isIntegrationVisibleTo` 로 요청자 가시성 확인 → 실패 시 `RESOURCE_NOT_FOUND`, (c) `scope==='organization'`
   이면 같은 트랜잭션 `manager` 로 `getMemberRole` 조회 후 `assertOrgScopeModifiable` → 실패 시 `ADMIN_REQUIRED`.
   삽입 위치(`SELECT ... FOR UPDATE` 다음 줄, `UPDATE` 이전)도 실제 호출 순서(L813→L824→L829)와 일치한다.
   실패 시 `dataSource.transaction` 콜백이 throw 하므로 트랜잭션 롤백 — draft 의 "자격 증명·status 불변" 서술과
   일치.

2. **navigation/4-integration.md §10.4 신규 행** — `markIntegrationCallbackError`(L1009-1065) 를 대조: 코드가
   `RESOURCE_NOT_FOUND`/`ADMIN_REQUIRED` 인 경우 `status==='pending_install'` 분기·`OAUTH_TOKEN_EXCHANGE_FAILED`
   분기·`OAUTH_INVALID_SCOPE` 분기 어디에도 안 걸려 "Otherwise (connected + non-token error): last_error only"
   경로로 떨어진다 — 즉 status 보존 + `last_error` 만 갱신. 이는 이미 표에 있는 "state mismatch / expired" 행과
   같은 규칙이며, draft 의 "connected 행의 다른 비-교환 실패와 같은 규칙" 서술과 부합한다. `status_reason` 도
   갱신되지 않는데, 이는 §3.2 status_reason 매핑 문서의 기존 각주("`resource_not_found` 는 row 자체가 사라진
   케이스라 DB 갱신 불가 → 후보값에서 제외")와도 어긋나지 않는다(신규 실패가 `status_reason` 후보에 추가되지
   않음).

3. **5-system/1-auth.md §3.2 상호 참조 각주** — 삽입 지점(`> ※ **System Status**` 노트 앞) 은 §3.2 표의 마지막
   행(`Audit Log`) 뒤·기존 `※ System Status` 각주 앞이라 표 구조를 깨지 않는다. 링크 anchor
   `../2-navigation/4-integration.md#8-권한-규칙` 은 대상 문서의 실제 heading(`## 8. 권한 규칙`, 현재
   `spec/2-navigation/4-integration.md` L790)과 일치. `spec/` 전체에서 `Integration (Personal)` / `자기 것`
   문자열은 이 두 파일(`5-system/1-auth.md` §3.2, `2-navigation/4-integration.md` §8)에만 존재해 다른 영역과의
   중복 정의 충돌 가능성도 없다.

### 상위 인접 표면 대조 (spec_impact 밖)

- `spec/4-nodes/4-integration/4-cafe24.md`, `5-makeshop.md`, `spec/conventions/raw-query-results.md` 도
  `IntegrationOauthService`/reauthorize 흐름을 언급하지만, 전부 token refresh·TTL 관련 서술이라 이번 "커밋 직전
  인가 재판정" 서술과 겹치는 주장이 없다 — 모순 없음.
- 이 draft 가 닫으려는 두 항목(`review/consistency/2026/09/26/00_43_55/SUMMARY.md` WARNING 1, INFO 1)의 지적
  대상과 target 의 변경안 세 곳이 1:1 대응 — 새로운 표면을 추가로 건드리지 않는다.

### 경미 관찰 (등급 부여 대상 아님)

- §10.4 신규 행의 2번째 컬럼(`거부 사유(RESOURCE_NOT_FOUND · ADMIN_REQUIRED)`) 은 같은 표의 다른 행들이 실제
  팝업 문구 리터럴(예: `` `Failed to connect to {provider}.` ``)을 담는 관례와 표현 형식이 다르다(코드명 나열
  vs 문구 인용). 이는 같은 파일·같은 표 내부의 스타일 편차라 cross-spec 충돌 범주는 아니고, target 이 인용한
  근거(`00_43_55` WARNING 1)의 제안 문구를 그대로 옮긴 결과다 — 채택해도 다른 영역과 모순은 없다.

## 요약

target 이 제안하는 세 곳의 수정(§1.2 시퀀스 노트·불릿, §10.4 표 행, §3.2 상호 참조 각주)은 모두 이미 구현된
`assertRequesterStillAllowed`/`markIntegrationCallbackError` 동작을 정확히 반영하며, 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC·계층 책임 어느 관점에서도 `spec/**` 의 다른 영역과 충돌하지 않는다. 세 파일 모두
`spec_impact` 에 명시돼 있고, 삽입 지점이 실제 문서 구조(heading/anchor/표 컬럼)와 어긋나지 않으며, 같은 개념
(`Integration (Personal)` / `자기 것`)을 언급하는 spec 파일이 이 두 곳뿐이라 중복 정의 충돌 가능성도 없다. 이
draft 는 직전 `--impl-done` cross_spec 검토(WARNING 1)와 그 INFO 1 을 정확히 닫는 범위로 스코프가 좁게
유지되어 있다.

## 위험도

NONE
