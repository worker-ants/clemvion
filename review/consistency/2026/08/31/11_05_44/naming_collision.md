# 신규 식별자 충돌 검토 — `spec-draft-auth-errorcode-drift.md`

## 검토 요약

target 이 다루는 두 항목을 신규 식별자 도입 여부로 재분류하면:

1. **`ACCOUNT_LOCKED` 423→401 정정** — 기존 식별자(`ACCOUNT_LOCKED`)의 **이름은 그대로**이고
   카탈로그 상 HTTP status 필드값만 정정한다. 새 식별자를 도입하지 않는다.
2. **`ALERT_RULE_NOT_FOUND` 카탈로그 등재** — 문자열 자체는 **이미** `alerts.service.ts:49,66`
   (`NotFoundException({ code: 'ALERT_RULE_NOT_FOUND', … })`)과 `spec/2-navigation/9-user-profile.md:387-388`
   양쪽에서 동일한 의미(워크스페이스 스코프 알림 규칙 미존재, 404)로 이미 쓰이고 있다. target 은
   이를 `3-error-handling.md` 중앙 카탈로그로 **미러링**하는 것이지 새 의미를 발명하지 않는다.

즉 이 draft 는 신규 식별자 충돌 관점에서 검토할 "새로 태어나는 이름"이 실질적으로 없다 —
둘 다 기존 코드베이스·기존 spec 에 이미 확정돼 있는 이름을 문서 SoT 로 옮기거나 정정하는
작업이다.

## 점검 관점별 확인 내역

### 1. 요구사항 ID 충돌
target 은 요구사항 ID(`ND-*`, `V0*` 등)를 신규 부여하지 않는다. 해당 없음.

### 2. 엔티티/타입명 충돌
`AlertRule` 엔티티명은 이미 `spec/1-data-model.md` §2.25, `spec/data-flow/9-observability.md`,
`spec/2-navigation/9-user-profile.md` §6.3 에서 일관되게 쓰인다. target 은 새 엔티티명을
도입하지 않는다. 충돌 없음.

### 3. API endpoint 충돌
target 은 `method + path` 조합을 신규 등재하지 않는다 — `PATCH/DELETE /api/alerts/:id` 는
이미 `9-user-profile.md` §6.3 에 정의돼 있고, target 은 그 엔드포인트가 내는 에러 코드를
중앙 카탈로그로 옮기는 것뿐이다. 충돌 없음.

### 4. 이벤트/메시지명 충돌
webhook·queue·sse 이벤트명 신설 없음. 해당 없음.

### 5. 환경변수·설정키 충돌
신규 ENV var·config key 없음. 해당 없음.

### 6. 파일 경로 충돌
- plan 파일 `plan/in-progress/spec-draft-auth-errorcode-drift.md` — 저장소 전수 검색 결과
  동명 파일 없음(자기 자신 1건만 매치), 명명 컨벤션(`spec-draft-*`, kebab-case)과도 부합.
- target 이 수정 대상으로 지정한 `spec/5-system/3-error-handling.md` 는 기존 파일 수정이며
  새 경로를 만들지 않는다.
충돌 없음.

## 부가 확인 (충돌은 아니나 실측 기록)

- `423` 상태 코드는 저장소 전체에서 `3-error-handling.md:48` 단 한 곳에서만 쓰인다(다른
  cafe24 API 카탈로그 문서의 `423` 은 URL/픽셀 코드에 우연히 등장하는 숫자열이라 무관).
  423 → 401 정정이 다른 곳의 423 참조를 고아로 만들 위험은 없다.
- §1.3(유효성 검증 에러) 테이블은 이미 `RESOURCE_NOT_FOUND`(404, generic) ·
  `MODEL_CONFIG_NOT_FOUND`(404, cross-kind 차단 패턴) 형제 행을 갖고 있고, target 이 제안하는
  `ALERT_RULE_NOT_FOUND` 행의 근거(cross-kind 존재 누설 방지)는 `MODEL_CONFIG_NOT_FOUND` 의
  기존 선례와 **동일 패턴**이라 카탈로그 배치 규약과도 충돌하지 않는다.
- `conventions/error-codes.md` §2 rename 안정성 정책은 "코드 **이름**의 rename" 을 breaking
  으로 규정한다. `ACCOUNT_LOCKED` 는 이름이 바뀌지 않으므로 이 정책의 적용 대상이 아니다
  (상태 코드 변경의 API 계약 리스크는 target 본문이 이미 별도로 다루고 있고, 이는 신규
  식별자 충돌이 아니라 계약 변경 리스크 관점이라 본 checker 범위 밖).

## 발견사항

없음.

## 요약

target 이 등재·정정하는 두 식별자(`ACCOUNT_LOCKED` 상태 코드, `ALERT_RULE_NOT_FOUND` 코드)는
모두 **이미 코드베이스·기존 spec 에서 확정된 이름을 SoT 카탈로그로 반영**하는 작업이며, 새
이름을 발명하지 않는다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로
6개 관점 전수 검색 결과 기존 사용처와의 의미 충돌이 발견되지 않았다.

## 위험도

NONE
