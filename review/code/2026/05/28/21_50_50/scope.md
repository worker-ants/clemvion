# 변경 범위(Scope) 리뷰

## PR 의도

`auth-config-webhook-wiring` — Webhook 인증의 inline auth path (`trigger.config.authType` 등) 를 폐지하고, `trigger.auth_config_id` FK 를 단일 인증 진입점(SoT)으로 격상. 동반하여 Auth Config Reveal 권한 분리 및 audit log 액션 구체화.

---

## 발견사항

### [INFO] 파일 1 — spec/5-system/1-auth.md: Auth Config Reveal 행 + 근거 추가

- 위치: 권한 매트릭스 표 `Auth Config Reveal` 행 신규 추가 (line 35), `§3.3` 아래 blockquote (line 43)
- 상세: `Auth Config Reveal` 액션이 이번 PR 에서 `POST /api/auth-configs/:id/reveal` 엔드포인트 개념을 도입하고, 해당 권한을 Admin+ 로 제한하는 내용이 추가됐다. Webhook 인증 wiring 의 전제 조건 — AuthConfig 에서 평문을 꺼내야 webhook 검증이 가능하므로, 평문 노출 경로의 권한 정의는 이번 범위에 포함된다.
- 감사 로그 액션 열 (`auth_config.*` → `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal, llm_config.*`) 구체화도 `auth_config.reveal` 가 신규로 추가되는 이번 변경과 직결된다.
- 판정: 범위 내 (Reveal 권한 분리는 Webhook 인증 vault 단일화의 연장선).

### [INFO] 파일 2 — spec/5-system/12-webhook.md: 인증 방식 세분화 및 inline auth 폐지

- 위치: §3.2 요구사항 테이블 WH-SC-01~09 (WH-SC-06~09 신규), §2.1 config 테이블 설명, §4.1~4.5 인증 섹션 확장, §7 처리 흐름 step 6 재작성, §8 보안 고려사항 표 갱신, Rationale "inline auth path 폐지" 절 추가
- 상세: `api_key`, `basic_auth` 두 신규 인증 타입 (`WH-SC-06`, `WH-SC-07`) 이 추가됐다. 이 타입들은 `AuthConfig.type` enum 의 일부로, inline auth 를 완전히 제거하고 AuthConfig 로 통합하는 목적상 AuthConfig 가 지원하는 모든 타입을 spec 에 반영한 것이다. 단순 inline→AuthConfig 이관뿐 아니라 지원 타입을 2종 추가하는 변경이 포함되어 있어 기능 범위 측면에서 주목할 만하나, 기존 `api_key` / `basic_auth` 가 AuthConfig 데이터 모델에 이미 정의되어 있었다면 spec 동기화 차원의 기록이다.
- `WH-SC-08` (`last_used_at` fire-and-forget UPDATE), `WH-SC-09` (ip_whitelist allowlist) 도 신규 요구사항이나 AuthConfig 속성의 wiring 일부이므로 범위 내.
- §4.2 HMAC 의 `§구현 §11.3 — main.ts` 하이퍼링크가 제거됐다 (앵커 없는 링크 삭제). 포맷 정리 수준.
- 판정: 범위 내.

### [INFO] 파일 3 — spec/conventions/secret-store.md: AuthConfig 비대상 명시

- 위치: §1 scope 설명 수정 (line 1240), "비대상" blockquote 추가 (line 1248), Changelog 신규 행 추가 (line 1257)
- 상세: AuthConfig 자격증명이 `secret://` URI scheme 이 아닌 모듈 자체의 column transformer 를 사용한다는 점을 명시했다. 이는 개발자가 AuthConfig 를 SecretStore 로 통합하려는 오해를 차단하는 문서화로, webhook wiring 작업 중 혼선을 방지하기 위한 필수 정보다.
- `secret-store` 컨벤션의 인터페이스·scheme 자체 변경은 없다.
- 판정: 범위 내 (wiring 과정의 경계 명확화).

### [INFO] 파일 4 — spec/data-flow/10-triggers.md: Webhook 처리 흐름 다이어그램 동기화

- 위치: §1.2 mermaid sequenceDiagram (inline auth → AuthConfig 분기 재작성), §2.1 Postgres 스키마 매핑 표 `auth_config` 행 분리 (read / write), §4 외부 의존 표 설명 갱신
- 상세: 기존 다이어그램이 `"auth_config_id 설정 OR ip_whitelist"` 와 `"401/403"` 을 다루던 것을 `auth_config_id IS NOT NULL` 분기, `is_active` 확인, `AUTH_FAILED` 단일 응답, `last_used_at` fire-and-forget 로 정확히 재작성했다. 200→202 응답 코드 정정(`Hk-->>Ext: 200` → `202`) 도 포함됐는데, 이는 `WH-RS-01` 과의 정합 수정으로 범위 내 정정.
- `ip_whitelist-only 경로 없음` 설명 추가도 경계 명확화.
- 판정: 범위 내.

---

## 요약

4개 파일의 변경은 모두 `auth-config-webhook-wiring` 의 목적 — inline 인증 키를 AuthConfig FK 로 일원화, 권한 분리, 보안 정책(마스킹·암호화) 문서화 — 에 직접 수렴한다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 전용 변경은 발견되지 않았다. `api_key` / `basic_auth` 두 인증 타입이 신규 추가된 것은 AuthConfig 가 이미 정의한 타입들을 Webhook spec 에 처음으로 노출하는 것으로, over-engineering 보다는 spec 동기화에 가깝다. 임포트 변경, 설정 파일 변경, 주석 전용 변경은 없다. 전반적으로 의도된 범위 내에서 정밀하게 작성된 변경이다.

## 위험도

NONE
