# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. spec write 진행 가능.

---

## 전체 위험도
**MEDIUM** — Critical 0건, Warning 7건, Info 10건. `last_error.code` 케이싱 불일치(W1)가 API 계약에 실질 영향을 주므로 spec 적용 전 정정 필요.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Convention Compliance | `last_error.code` 저장값이 `snake_case` — 현행 관례(`UPPER_SNAKE_CASE`)와 충돌 | DRAFT 1C·2G·2I·3B·3C 전반 (`last_error.code='oauth_token_exchange_failed'` 등) | `spec/1-data-model.md §2.10`, `spec/data-flow/integration.md §2.1` 의 `INTEGRATION_NOT_FOUND` 등 UPPER_SNAKE_CASE 기존 예시 | `last_error.code` 는 기존 관례대로 `OAUTH_TOKEN_EXCHANGE_FAILED` 등 UPPER_SNAKE_CASE 로 통일. `status_reason` 은 snake_case 유지. DRAFT 1C·2G·2I·3B·3C 의 `last_error.code` 값 전수 교정 |
| W2 | Cross-Spec | data-flow §1.2 부모 다이어그램 엔드포인트가 `GET /api/integrations/oauth/:service/start` — DRAFT 3C 서브다이어그램의 `POST /oauth/begin` 과 공존 충돌 | DRAFT 3C — `spec/data-flow/integration.md §1.2.1` 신규 서브다이어그램 | `spec/data-flow/integration.md §1.2` (line 49) + `spec/2-navigation/4-integration.md §9.2` | DRAFT 3C 적용 시 §1.2 부모 다이어그램의 엔드포인트도 `POST /oauth/begin` 으로 정정하거나, §1.2 상단에 "상세 흐름은 §1.2.1 참고" 주석 추가 |
| W3 | Cross-Spec | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(400)` 발생 지점이 oauth/begin 엔드포인트 설명 및 data-flow 시퀀스 어디에도 없음 | DRAFT 2F — `spec/2-navigation/4-integration.md §9.4` 에러 코드 추가 | `spec/2-navigation/4-integration.md §9.2` (`oauth/begin` 설명), `spec/data-flow/integration.md §1.2` | DRAFT 2F-bis §9.2 에 "동일 `(workspaceId, mall_id, app_type='private')` connected Integration 존재 시 400 즉시 반환" 1줄 추가; data-flow §1.2.1 에도 중복 체크 분기 추가 |
| W4 | Naming Collision | `CAFE24_INSTALL_INVALID_HMAC` 의미가 "HMAC 불일치 **또는** pending 미발견" → "HMAC 불일치만" 으로 축소 — 기존 코드가 token-not-found 분기로도 처리 중일 수 있음 | DRAFT 2E — `CAFE24_INSTALL_INVALID_HMAC(403)` + `CAFE24_INSTALL_INVALID_TOKEN(404)` 분리 | `spec/2-navigation/4-integration.md §9.2` 기존 정의 | DRAFT 2J-2·2F 적용 시 기존 `handleInstall` 핸들러 및 e2e 테스트에서 해당 에러 처리 코드 전수 확인 후 404/403 분기로 분리 |
| W5 | Plan Coherence + Cross-Spec (중복 통합) | `expired + status_reason='install_timeout'` 시 reauthorize 버튼 비활성 규칙이 FE task 로 plan 미기재이며, §4.2 Quick actions 에도 미반영 | DRAFT 2D-pre·2A (§2.2 더보기 메뉴 비활성 명시) | `cafe24-pending-polish.md` 변경 0·1; `spec/2-navigation/4-integration.md §4.2` `Reauthorize(OAuth)` 버튼 비활성 조건 부재 | ① `cafe24-pending-polish.md` 변경 1 끝에 `[ ] FE: expired + status_reason='install_timeout' 시 reauthorize 버튼 비활성 (Cafe24 Private 전용)` 추가. ② §4.2 `Reauthorize(OAuth)` 행에 비활성 조건 1줄 추가 |
| W6 | Plan Coherence | legacy path 영구 폐기 후속 task 가 plan 에 없음 — spec draft 통과 후 추적 경로 단절 위험 | DRAFT 2I Rationale "영구 폐기 시점은 plan 후속 항목으로 추가" 명시 | `cafe24-pending-polish.md` 변경 2 (`/oauth/install/cafe24` 410 Gone) | `cafe24-pending-polish.md` 변경 2에 `[ ] legacy path 영구 폐기 시점 결정 (운영 데이터·외부 URL 잔존 확인 후, CAFE24_INSTALL_LEGACY_PATH 410 응답 제거)` 추가 |
| W7 | Convention Compliance | `install_token` 경로 파라미터 표기가 3가지 혼재 (`:installToken` / `<installToken>` / `<install_token>`) | DRAFT 2E §9.2 API 표 (`:installToken` ✓), DRAFT 2C §3.2 (`<installToken>`), DRAFT 2J-1 §9.4 step 3 + DRAFT 3C mermaid (`<install_token>`) | `spec/2-navigation/4-integration.md §9.2` 기존 콜론-prefix 스타일 (`:id`, `:provider`) | 산문·다이어그램 포함 전 위치에서 `:installToken` (camelCase, 콜론-prefix) 또는 `{installToken}` (OpenAPI 스타일)으로 통일. `install_token` snake_case 는 DB 컬럼명에만 사용 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Naming Collision + Cross-Spec (중복 통합) | DB `status_reason` = snake_case, API `last_error.code` = UPPER_SNAKE_CASE 이중 표기 — 의도적 설계이나 구현 단계 혼용 위험 | DRAFT 1C §2.10, DRAFT 2G §10.4 | `markIntegrationCallbackError` 내부에서 status_reason 을 상수 열거체로 관리; 단위 테스트에서 DB값/API값 동시 assertion 강제 |
| I2 | Rationale Continuity | `mode=reauthorize` 를 초기 install 에도 재사용한 이유가 draft 에 미명시 (신규 mode 신설 검토 여부 불분명) | DRAFT 3C 시퀀스 다이어그램, DRAFT 2G §10.4 | DRAFT 2I Rationale 에 "reauthorize mode 재사용 이유 또는 cafe24_private_install 신규 mode 기각 근거" 1문장 추가 |
| I3 | Rationale Continuity | `integration_oauth_state.provider_meta` 에 client_secret 복사 필요성이 미명시 (`integration_id` FK 로 재조회 가능한데 별도 복사) | DRAFT 3D §2.1 (`provider_meta` V041 추가) | V041 의 provider_meta client_secret 저장 배경을 DRAFT 2I 또는 data-flow Rationale 에 1문장으로 명시. 불필요하면 mall_id/client_id 만 남기고 client_secret 생략 검토 |
| I4 | Plan Coherence | Expiry scanner 의 2-message dispatch 패턴(`reason: 'token_expiring' \| 'pending_install_timeout'`)이 plan 변경 4에 미언급 | DRAFT 3C-bis §1.4, `cafe24-pending-polish.md` 변경 4 | blocking 아님. 구현 착수 시 developer 가 DRAFT 3C-bis §1.4 를 직접 참조해 dispatch 형태 구현 |
| I5 | Plan Coherence | DRAFT 2J-2 §10 CHANGELOG 의 consistency-check 세션 ID(`2026-05-14_17-12-13`)가 현재 실행 세션 전 기록 — 최종 통과 세션이 다를 경우 stale reference | DRAFT 2J-2 §10 CHANGELOG | spec 적용 시 CHANGELOG 의 세션 ID 를 최종 통과 세션으로 교체 |
| I6 | Cross-Spec | data-flow §1.2 에 Cafe24 Private 흐름 forward-reference 없음 — §1.2.1 서브다이어그램 존재를 독자가 알 수 없음 | DRAFT 3C — §1.2.1 신규 추가 | §1.2 다이어그램 직후 `> Cafe24 Private 앱의 install_token 기반 흐름은 §1.2.1 참고.` 1줄 추가 |
| I7 | Cross-Spec | credentials JSONB §5.8 의 `access_token`/`refresh_token` 필수 표기가 `pending_install` 상태 미반영 (pre-existing) | `spec/2-navigation/4-integration.md §5.8` (draft 미수정) | §5.8 마지막에 주석 1줄: `app_type='private' + status='pending_install' 신규 생성 시 두 토큰 NULL; install_token 은 Integration 컬럼에 별도 저장 (§1-data-model §2.10)` |
| I8 | Convention Compliance | `spec/4-nodes/4-integration/4-cafe24.md §9` 기존 Rationale 에 install_token 식별 전략 설계 배경 미추가 | DRAFT 2J (cafe24.md §9.4 수정) | cafe24.md §9 에 `§9.9 install_token 기반 App URL 식별 전략` 1문단 추가, 또는 §9.8 끝에 navigation spec Rationale 포인터 1줄 추가 |
| I9 | Convention Compliance | spec 예시 코드 `verifyHmac` 주석이 WHAT(파라미터 출처) 설명 위주 | DRAFT 2J-2 `verifyHmac` 예시 | production 코드 전환 시 삭제. spec 잔류 원하면 WHY(trial HMAC 방식 폐기 이유) 로 교체 |
| I10 | Naming Collision | UI grouping "카테고리"(한국어)가 `Node.category` Enum 과 맥락 혼동 가능 (실질 충돌 없음) | DRAFT 2H §6, `spec/conventions/cafe24-api-metadata.md §6` | §6 에 추가되는 용어 정의에 "`Node.category` Enum 과 별개 개념" 인라인 주석 1줄 — draft 이미 반영 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | W2(엔드포인트 명칭 공존), W3(에러 발생 지점 미명시), W5(reauthorize 비활성 §4.2 미반영); Critical 0건 |
| Rationale Continuity | LOW | mode=reauthorize 재사용 근거 미명시, provider_meta client_secret 복사 정당성 미명시; 기존 결정 번복은 draft 자체에서 acknowledge |
| Convention Compliance | MEDIUM | **W1: `last_error.code` snake_case — API 계약 실질 충돌 위험. 적용 전 전수 교정 필요** |
| Plan Coherence | LOW | W5(FE 버튼 비활성 task 누락), W6(legacy path 후속 task 누락); plan 문서 갱신으로 즉시 해소 |
| Naming Collision | LOW | W4(`CAFE24_INSTALL_INVALID_HMAC` 의미 축소 — 기존 코드 점검 필요); Critical 신규 충돌 없음 |

---

## 권장 조치사항

1. **[필수, spec 적용 전]** W1 — DRAFT 1C·2G·2I·3B·3C 전반에서 `last_error.code` 값을 `UPPER_SNAKE_CASE` 로 전수 교정 (`oauth_token_exchange_failed` → `OAUTH_TOKEN_EXCHANGE_FAILED` 등). `status_reason` 은 snake_case 유지.

2. **[필수, spec 적용 전]** W7 — `install_token` 경로 파라미터 표기를 DRAFT 전 위치에서 `:installToken` (또는 `{installToken}`)으로 통일. `<install_token>` snake_case 각괄호 형식 제거.

3. **[구현 착수 전, plan 갱신]** W5 — `cafe24-pending-polish.md` 변경 1에 `expired + status_reason='install_timeout'` FE reauthorize 버튼 비활성 task 추가.

4. **[구현 착수 전, plan 갱신]** W6 — `cafe24-pending-polish.md` 변경 2에 legacy path 영구 폐기 시점 결정 task 추가.

5. **[spec 보강, 권장]** W2 — DRAFT 3C 적용 시 `spec/data-flow/integration.md §1.2` 부모 다이어그램 엔드포인트를 `POST /oauth/begin` 으로 함께 정정.

6. **[spec 보강, 권장]** W3 — DRAFT 2F-bis 에 `oauth/begin` 엔드포인트 설명과 §1.2.1 에 중복 체크 분기 추가.

7. **[구현 시 주의]** W4 — DRAFT 2J-2·2F 적용 후 기존 `handleInstall` 핸들러 및 e2e 테스트에서 `CAFE24_INSTALL_INVALID_HMAC` 처리 코드 404/403 분기 분리 확인.

8. **[spec 보강, 선택]** I2·I3 — DRAFT 2I Rationale 에 `mode=reauthorize` 재사용 근거, `provider_meta` client_secret 복사 필요 시점 각 1문장 추가.

9. **[적용 직전 확인]** I5 — spec 파일 실제 반영 시 CHANGELOG 의 consistency-check 세션 ID 를 최종 통과 세션으로 교체.