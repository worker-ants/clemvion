# 신규 식별자 충돌 검토 — `spec-draft-rotate-conflict.md`

## 발견사항

- **[WARNING]** «§3 상세 화면 표» 참조가 실제 섹션과 불일치
  - target 신규 식별자: 변경안 ④ 가 지목하는 위치 `§3 상세 화면 표의 «Rotate credentials (비OAuth)» 행`
  - 기존 사용처: `spec/2-navigation/4-integration.md` 의 실제 `## 3.` 은 **"추가 페이지 (`/integrations/new`)"** — Add Integration 상태 기계·Step 2/3/4 (라인 132~258) 이며 "Rotate credentials" 행이 없다. 그 행은 실제로 `### 4.3 Security 탭` 표 (라인 292~299, 특히 298행)에 있다 — "상세 페이지"는 `## 4.` 다.
  - 상세: draft 가 "§3 상세 화면 표" 라고 쓴 것은 섹션 번호와 섹션 제목("상세 화면")이 서로 다른 실제 섹션을 가리키는 상태다. 번호(§3)를 따라가면 완전히 다른 화면(신규 등록 플로우)에 도달하고, 제목("상세 화면")을 따라가면 §4 에 도달한다 — 구현자가 어느 것을 신뢰해야 할지 모호하며, §3 에는 애초에 해당 테이블 자체가 없으므로 실제로는 혼동보다 "못 찾음"에 더 가깝다.
  - 제안: ④ 항목의 참조를 `§4.3 Security 탭 표의 «Rotate credentials (비OAuth)» 행 (298행)` 으로 정정한다.

- **[WARNING]** "범용 conflict 코드가 없다" 실측 범위가 실제 검색 범위보다 넓게 서술됨
  - target 신규 식별자: `INTEGRATION_ROTATE_CONFLICT` (409) 의 도입 근거로 쓰인 실측 문장 — "**범용 conflict 코드가 없다**: 백엔드의 `code: '...'` 리터럴을 전수 집계해도 409 계열은 도메인 전용 둘뿐이다."
  - 기존 사용처: `codebase/backend/src/common/filters/http-exception.filter.ts` `getCodeFromStatus(409)` → **`RESOURCE_CONFLICT`** 가 코드 미지정 `ConflictException` 전체의 **전역 기본값**이며, 실제로 unique-violation race 케이스에 명시적으로도 쓰인다("race window 에서의 unique constraint 위반은 클라이언트에게 409 가 옳다"). 이 외에도 백엔드 전역에는 409 계열 도메인 코드가 다수 더 있다 — `WORKFLOW_VERSION_CONFLICT`(`spec/5-system/3-error-handling.md:90`, 동시 캔버스 저장 경합·first-committer-wins), `TRIGGER_ENDPOINT_PATH_CONFLICT`(같은 문서 §1.10), `IDEMPOTENCY_KEY_CONFLICT`(`idempotency.interceptor.ts`), `DUPLICATE_NODE_LABEL`(409). "둘뿐"이라는 집계는 **Integration 모듈의 `§9.4` 카탈로그 안에서는** 정확하지만(그 표 안 409 는 실제로 `INTEGRATION_IN_USE`·`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 둘뿐임을 확인했다), 문장이 "백엔드의 code 리터럴을 **전수** 집계해도"라고 적어 범위를 backend 전체로 넓혀 말한다 — 그 넓은 범위에서는 반증된다.
  - 상세: 실질적 결론(신규 도메인 코드 `INTEGRATION_ROTATE_CONFLICT` 신설)은 `spec/5-system/2-api-convention.md` §5.3 "top-level `code` 교체" 규약(사유가 **엔드포인트의 결과 자체**이고 요청당 사유가 하나뿐일 때 신설 — 선례 `WORKFLOW_VERSION_CONFLICT` 등)에 실제로 부합해 뒤집히지 않는다. 문제는 근거 문장이 검증한 범위(Integration 모듈 카탈로그)보다 넓게("백엔드 전체") 서술돼, 정작 가장 가까운 선례(`WORKFLOW_VERSION_CONFLICT` — 동일하게 "동시 쓰기 중 나중 것이 앞선 커밋을 덮으려는" 형태의 409·first-committer-wins)를 놓친 채 "이 형태의 충돌은 프로젝트에 전례가 없다"는 인상을 준다는 점이다. 실무적으로 더 중요한 결과: 후속 구현이 `code` 를 명시하지 않은 `ConflictException` 을 던지면 `GlobalExceptionFilter` 가 **조용히 `RESOURCE_CONFLICT` 로 떨어뜨린다** — draft 의 어떤 절도 "top-level `code` 를 명시적으로 지정해야 한다"는 요구를 §5.3 규약을 인용해 명문화하지 않는다.
  - 제안: 실측 문장의 스코프를 "Integration 모듈(`spec/2-navigation/4-integration.md §9.4`) 카탈로그 안" 으로 좁혀 정정하고, `spec/5-system/2-api-convention.md §5.3`(top-level code 교체 기준)과 그 선례 `WORKFLOW_VERSION_CONFLICT` 를 Rationale ⑤에 인용해 "왜 `RESOURCE_CONFLICT` 재사용이 아니라 신규 top-level 코드인가"를 규약 근거로 명시한다. 아울러 §9.4 변경안 ①에 "구현은 `ConflictException` 생성 시 `code: 'INTEGRATION_ROTATE_CONFLICT'` 를 명시해야 한다(미지정 시 전역 기본값 `RESOURCE_CONFLICT` 로 떨어짐)"를 한 줄 덧붙이면 구현 단계의 누락을 막는다.

## 그 외 확인 — 충돌 없음

- **요구사항 ID**: 이 draft 는 신규 요구사항 ID 체계를 도입하지 않는다.
- **엔티티/DTO/인터페이스명**: 신규 타입 없음 — 기존 `Integration` 엔티티·`last_rotated_at` 컬럼만 참조.
- **API endpoint**: `POST /api/integrations/:id/rotate` 는 기존 `§9.2`(829행)에 이미 정의된 endpoint 를 재사용하며 신규 endpoint 를 만들지 않는다. 응답 계약(409)만 추가.
- **이벤트/메시지명**: webhook·queue·SSE 이벤트 신규 도입 없음.
- **환경변수·설정키**: 신규 ENV/설정 키 없음.
- **파일 경로**: `plan/in-progress/spec-draft-rotate-conflict.md` — `find plan -iname "*rotate*"` 결과 기존 파일과 경로 충돌 없음. 명명 컨벤션(`spec-draft-<slug>.md`)도 다른 `spec-draft-*.md` 파일들과 일치.
- **핵심 신규 식별자 `INTEGRATION_ROTATE_CONFLICT`**: 저장소 전체 grep 결과 이 draft·리뷰 산출물 밖에서 0건 — "grep 0건" 주장은 사실과 일치하며 `UPPER_SNAKE_CASE` + `INTEGRATION_` 도메인 접두 컨벤션도 준수한다. 동일 문자열의 다른 의미 사용처는 없다(진짜 충돌 아님).

## 요약

핵심 신규 식별자 `INTEGRATION_ROTATE_CONFLICT` 자체는 저장소 전체에서 이 draft 밖 사용처가 0건이라 문자 그대로의 "동일 식별자·다른 의미" 충돌은 없다. 다만 두 가지가 걸린다. 첫째, 변경안 ④가 지목한 "§3 상세 화면 표"는 실제로 §4.3(Security 탭)이며 §3(추가 페이지)에는 해당 테이블이 없어 구현자가 위치를 못 찾을 위험이 있다. 둘째, 신규 코드 도입의 근거인 "범용 conflict 코드가 없다(백엔드 전수 집계)"는 실제로는 이미 존재하는 전역 기본 코드 `RESOURCE_CONFLICT`, 그리고 형태가 거의 동일한 선례 `WORKFLOW_VERSION_CONFLICT`(동시 쓰기 lost-update, first-committer-wins, 409)를 놓친 과잉 일반화다 — 결론(신규 top-level 코드 신설)은 `spec/5-system/2-api-convention.md §5.3` 규약상 뒤집히지 않지만, 그 규약과 선례를 인용하지 않아 근거가 실제보다 약하게 보이고, 구현이 `code` 를 명시하지 않으면 조용히 `RESOURCE_CONFLICT` 로 떨어질 위험을 draft 가 경고하지 않는다. 나머지 다섯 관점(요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·파일 경로)에서는 충돌이 발견되지 않았다.

## 위험도

LOW
