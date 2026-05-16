# 신규 식별자 충돌 Review

대상: `plan/in-progress/spec-draft-cafe24-public-dup-guard.md`
점검 시각: 2026-05-16

---

## 발견사항

### 발견사항 없음 — 충돌 미검출

아래 항목별로 전수 점검하였다.

---

### [INFO] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` — 이름과 의미의 역사적 불일치

- **target 신규 식별자**: 에러 코드 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 의 적용 범위 확장 (Public 흐름에도 동일 코드 반환)
- **기존 사용처**: `spec/2-navigation/4-integration.md` §9.4 errors (line 725) — 2026-05-15 신설 당시 Private 흐름 한정. 코퍼스 내 `spec/1-data-model.md` §2.10.1 등 복수 위치에서 동일 코드 참조.
- **상세**: target 변경 3이 이 코드를 Private/Public 양 흐름에서 동일하게 반환하도록 의미를 확장한다. 코드 이름의 `PRIVATE` 토큰은 신설 당시 역사적 산물(historical artifact)임이 target 내에 명시되어 있고, target 자체가 "클라이언트는 코드 이름이 아닌 의미(mall_id 기준 중복)로 분기" 라고 명확히 기술하고 있다. 타 spec 파일 내에 이 코드를 다른 의미로 정의한 사용처는 코퍼스 내에 없다. 따라서 식별자 충돌은 아니나, 코드 이름이 적용 범위를 오해하게 할 소지가 있어 INFO 등급으로 기록한다.
- **제안**: 장기적으로 `CAFE24_ALREADY_CONNECTED` 또는 `CAFE24_MALL_ALREADY_CONNECTED` 로 명칭을 교체하면 오해 가능성을 줄일 수 있다. 단, 이미 클라이언트·백엔드 양측에 배포된 코드를 포함하므로 마이그레이션 비용이 크다. 현재 단계에서 target 이 "의미 정의 우선, 코드 이름은 artifact" 를 spec에 명시하는 방향으로 해결한 점은 적절하다. 향후 Cafe24 관련 에러 코드를 정비할 기회가 생기면 교체를 검토한다.

---

### [INFO] `GET /api/integrations/cafe24/precheck` — 기존 동적 라우트와의 충돌 가능성 (설계 차원에서 해소 확인)

- **target 신규 식별자**: `GET /api/integrations/cafe24/precheck`
- **기존 사용처**: `spec/2-navigation/4-integration.md` §9.2 API 표 — `GET /api/integrations/:id` (동적 UUID 경로). NestJS controller 에서 `:id` 가 `cafe24` 를 소비해 `ParseUUIDPipe` 위반 400 을 일으킬 수 있다.
- **상세**: target 내 Rationale 절 "라우트 선언 순서 주의 — `@Get('cafe24/precheck')` 는 동적 경로 `@Get(':id')` 보다 앞에 선언" 이 이 충돌을 명시적으로 인지하고 해결 방법을 spec 에 기술하고 있다. 즉, endpoint 경로 자체의 문자열 충돌(`cafe24` vs `:id`)은 실존하나, 라우트 선언 순서로 해소된다는 설계 결정이 이미 target 안에 포함되어 있다. spec 문서 기준으로는 새 endpoint 를 §9.2 표에 별도 행으로 추가하므로 기존 정의와 중복되지 않는다.
- **제안**: `spec/2-navigation/4-integration.md` §9.2 에 신규 행을 추가할 때, 표 주석 또는 해당 행 비고란에 "NestJS 라우트 선언 순서 필수 — `@Get('cafe24/precheck')` 가 `@Get(':id')` 보다 앞이어야 함" 한 줄을 남기면 spec 독자도 구현 시 실수를 줄일 수 있다. Rationale 에만 기술된 내용이 본문 표에도 가시화되면 더 안전하다.

---

### [INFO] `IntegrationOAuthService.findConnectedCafe24MallIntegration` — 신규 헬퍼 메서드명

- **target 신규 식별자**: `IntegrationOAuthService.findConnectedCafe24MallIntegration` (헬퍼 메서드명 — Rationale 에서 언급)
- **기존 사용처**: 코퍼스 내 spec 문서에서 `IntegrationOAuthService` 의 다른 메서드가 이 이름으로 사용되는 사례는 없다. `spec/2-navigation/4-integration.md` §9.2 의 기존 API 표에도 해당 식별자 없음.
- **상세**: target 은 Rationale 에서 이 헬퍼가 Public/Private 두 흐름에서 공유된다고 기술한다. spec 문서 레벨에서는 구현 클래스명·메서드명을 규정하지 않으므로 충돌 검토 대상 외이다. 다만 코퍼스가 코드 기반 식별자를 Rationale 에 노출할 때 명명 일관성 차원에서 기록한다.
- **제안**: 추가 조치 불필요. spec Rationale 레벨 언급이므로 구현 측 명명 컨벤션 준수 여부는 code-review 관할.

---

### 요구사항 ID 충돌 점검 결과

target 이 신규 요구사항 ID를 부여하는 항목은 없다 (기존 §9.2·§9.4·Rationale 의 확장/수정). 코퍼스 내 기존 요구사항 ID (`NAV-*`, `ND-*`, `NF-*`) 와의 충돌 없음.

### 엔티티·타입명 충돌 점검 결과

target 이 신규 도입하는 엔티티·DTO·인터페이스는 없다. precheck 응답 shape `{ conflict, existingIntegrationId?, existingName?, status? }` 는 기존 Integration 엔티티 필드 일부를 재사용하며, 별도 타입명을 부여하지 않는다. 충돌 없음.

### 이벤트·메시지명 충돌 점검 결과

target 은 새 webhook·queue·SSE 이벤트를 도입하지 않는다. 충돌 없음.

### 환경변수·설정키 충돌 점검 결과

target 은 새 환경변수 또는 설정 키를 도입하지 않는다. 충돌 없음.

### 파일 경로 충돌 점검 결과

target 이 지정하는 변경 대상 파일은 `spec/2-navigation/4-integration.md` 단일 파일이다. 이 파일은 기존 spec 트리에 이미 존재하는 파일의 수정이며, 새 파일 경로를 신설하지 않는다. 명명 컨벤션(`N-name.md` 숫자 prefix 규칙) 위반 없음. 충돌 없음.

---

## 요약

target(`spec-draft-cafe24-public-dup-guard.md`)이 도입하는 신규 식별자는 크게 세 가지다: (1) 신규 endpoint `GET /api/integrations/cafe24/precheck`, (2) 에러 코드 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 의 적용 범위 확장, (3) 헬퍼 메서드 `findConnectedCafe24MallIntegration`. 이 중 충돌에 해당하는 항목은 없다. `cafe24/precheck` 경로가 동적 라우트 `:id` 와 충돌할 수 있으나, target 내 Rationale 에서 선언 순서 해소 방안이 이미 명시되어 있다. 에러 코드 이름의 `PRIVATE` 토큰이 Public 흐름에도 반환됨에 따라 이름과 의미 사이의 불일치가 있으나, target 이 spec 정의로 의미를 명확히 기술하고 클라이언트가 이름이 아닌 의미 기준으로 분기하도록 지시하고 있어 실질 혼선은 낮다. 요구사항 ID·엔티티·이벤트·환경변수·파일 경로 차원에서 기존 식별자와의 충돌은 발견되지 않았다.

## 위험도

LOW
