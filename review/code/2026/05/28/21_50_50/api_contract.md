# API 계약(API Contract) Review — auth-config-webhook-wiring

## 발견사항

### [INFO] `POST /api/auth-configs/:id/reveal` 엔드포인트가 spec §5 API 엔드포인트 목록에 미등재
- 위치: `spec/5-system/1-auth.md` §5 엔드포인트 표
- 상세: `§3.2 권한 매트릭스` 와 Rationale 에서 `POST /api/auth-configs/:id/reveal` 엔드포인트가 명시되었고, `auth_config.reveal` 감사 로그 이벤트도 §4.1 에 추가되었다. 그러나 §5 "API 엔드포인트" 표에 해당 경로가 누락되어 있다. 클라이언트와 문서 독자가 엔드포인트 존재를 §5 만으로는 파악할 수 없다.
- 제안: §5 표에 다음 행을 추가한다.
  ```
  | POST | /api/auth-configs/:id/reveal | 평문 자격증명 노출 (Admin+, 현재 비밀번호 재확인 필수) |
  ```

### [INFO] Reveal 엔드포인트의 요청/응답 계약 명세 부재
- 위치: `spec/5-system/1-auth.md` §3.2 Rationale 인용
- 상세: `POST /api/auth-configs/:id/reveal` 에 대해 "현재 로그인 비밀번호 재확인 + audit 기록" 조건이 언급되지만, 요청 바디 스키마(password 필드명, 타입), 성공 응답 구조(평문 값 필드명, 마스킹 해제 범위), 실패 시 HTTP 상태코드(비밀번호 불일치 시 400/401/403 중 무엇인지)가 미정의이다.
- 제안: 별도 섹션 또는 §5 테이블 주석에 최소 계약을 명시한다. 예시:
  - 요청: `{ "password": string }`
  - 성공: `200 { data: { id, type, config: { /* plaintext fields */ } } }`
  - 실패(비밀번호 불일치): `400 INVALID_PASSWORD`

### [INFO] `auth_config.regenerate` 감사 이벤트 추가에 대응하는 regenerate 엔드포인트 계약 확인 필요
- 위치: `spec/5-system/1-auth.md` §4.1 감사 로그 테이블
- 상세: `auth_config.regenerate` 이벤트가 감사 로그 대상으로 추가되었다. 해당 이벤트를 발행하는 엔드포인트(`POST /api/auth-configs/:id/regenerate` 또는 유사 경로)가 §5 표 또는 데이터 모델 spec 에 정의되어 있는지 본 변경 범위에서는 확인되지 않는다. 감사 이벤트와 엔드포인트 계약이 분리된 spec 에 있다면 cross-link 가 필요하다.
- 제안: §5 표 또는 참조 링크로 regenerate 엔드포인트 위치를 명시한다.

### [INFO] Webhook 인증 실패 응답 코드가 두 흐름 간 일관성 유지 확인
- 위치: `spec/5-system/12-webhook.md` §3.1 에러 응답, §7 처리 흐름 step 6
- 상세: §3.1 에러 응답 표에는 `401 Unauthorized`만 기재되어 있고, §7 step 6d (ip_whitelist 불일치)도 401로 통일되어 있다. WH-SC-09 는 ip_whitelist 불일치 시 `401 AUTH_FAILED` 를 반환하도록 지정하는데, §3.1 에러 표에는 ip_whitelist 관련 조건 행이 없다. 표의 `401 Unauthorized` 행 설명에 ip_whitelist 포함 여부를 명시하면 계약이 더 명확해진다.
- 제안: §3.1 에러 응답 표의 `401` 행을 "인증 검증 실패 (자격증명 불일치, AuthConfig 비활성, IP 차단 — 모두 단일 `AUTH_FAILED` 메시지)" 로 확장한다.

### [INFO] `AuthConfig.is_active=false` 시 401이 기존 클라이언트에게 신규 조건임을 문서화 권장
- 위치: `spec/5-system/12-webhook.md` §3.1 인증 항목, §7 step 6c
- 상세: 기존에는 inline 인증 경로에 `is_active` 체크가 없었다. 이번 변경에서 AuthConfig.is_active=false 인 경우 401이 추가되었다. 이미 AuthConfig를 연결한 트리거를 사용하던 클라이언트 입장에서는 이전에는 없던 401 케이스가 생긴다. 문서상 breaking change 여부를 Rationale 에 명시하면 좋다(실제로 inline path가 auth_config_id를 미사용하여 방치된 상태였으므로 실질적 breaking은 아니나, 계약 레벨 명확화 차원).
- 제안: Rationale "inline auth path 폐지" 절에 "`is_active=false` 체크는 신규 조건이나, auth_config_id 가 이전에 실제 read되지 않아 실질적 행동 변화 없음" 한 줄 추가.

---

## 요약

이번 변경은 Webhook 인증 경로를 `trigger.config` inline 필드에서 `AuthConfig` FK 단일 경로로 격상하고, Auth Config Reveal 을 별도 권한 액션으로 분리·문서화한 spec 업데이트이다. API 계약 관점에서 핵심 인증 실패 응답(`401 AUTH_FAILED`)의 단일 메시지 원칙, 상수 시간 비교, IP allowlist 포함 조건이 일관되게 기술되어 있다. 다만 `POST /api/auth-configs/:id/reveal` 엔드포인트가 §5 공식 엔드포인트 목록에 누락되어 있고, 해당 엔드포인트의 요청 바디·응답 스키마·실패 코드가 미정의 상태이다. 이는 클라이언트 통합 시 모호성을 유발할 수 있어 조치가 권장된다. 나머지 항목은 참고 수준이다.

## 위험도

LOW
