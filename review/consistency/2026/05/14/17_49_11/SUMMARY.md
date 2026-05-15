# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 NONE/LOW/MEDIUM 위험도 기록.

---

## 전체 위험도
**MEDIUM** — Critical 0건. WARNING 9건(구현 혼동·dead spec 위험). INFO 11건(문서 보완 권고). spec write 차단 기준 미충족이나 아래 WARNING 중 W2·W3·W8을 spec 반영 전 보완 권장.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| W1 | naming_collision | `resource_not_found` — valid status_reason 로 열거되나 DRAFT 2G §10.4에서 해당 케이스는 row 소거로 DB 기록 불가 → dead identifier | DRAFT 1C pending_install 분기, DRAFT 3B §3.2 매핑 표 | DRAFT 2G §10.4 "변경 불가 (row 없음)" 설명 | (a) 1C/3B에서 `resource_not_found` 제거하고 §10.4를 유일 정의로 유지, 또는 (b) §10.4 설명과 1C/3B 의미를 명확히 분리 기술 |
| W2 | rationale_continuity | `OAuthState.mode='reauthorize'`를 초기 Private 앱 install에 재사용하는 이유가 Rationale 어디에도 없음 → callback 핸들러 수정 시 이중 의미 누락 위험 | DRAFT 3C §1.2.1 (`INSERT integration_oauth_state … mode=reauthorize`) | 없음 (암묵적 설계) | DRAFT 2I Rationale에 "왜 전용 `mode=cafe24_private_install`을 만들지 않고 `reauthorize`를 재사용했는지" 한 단락 추가; 또는 `mode` enum에 `cafe24_private_install` 신설 후 status 의존 분기 제거 |
| W3 | rationale_continuity | 앱 레벨 중복 체크(`CAFE24_PRIVATE_APP_ALREADY_CONNECTED`) 구현 경로 미명시 — `mall_id`가 encrypted JSONB 안에 있다면 전체 decrypt 비교가 필요하나 `integration` 테이블의 `mall_id` 저장 방식이 draft 어디에도 없음 | DRAFT 2F §9.4, DRAFT 2F-bis `POST /oauth/begin` 중복 가드 | `spec/1-data-model.md §2.10` credentials 암호화 JSONB | DRAFT 1B 또는 DRAFT 2I Rationale에 "`mall_id`는 [plain column / credentials 내 path]에서 추출" 구현 경로 명시 |
| W4 | rationale_continuity | `CAFE24_INSTALL_INVALID_TOKEN(404)` 분리로 기존 정보 노출 방지 정책 번복 — "32바이트 hex는 추측 불가"라는 전제만 있고 보안 가정 역전 조건 미기록 | DRAFT 2E §9.2, DRAFT 2I Rationale "install_token 승격" 단락 | 기존 spec §9.2 `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함)` | DRAFT 2I 해당 단락에 "이 전제가 깨지면(토큰 길이 단축, PRNG 변경 등) 다시 403으로 통합해야 한다" 역전 조건 명시 |
| W5 | plan_coherence | `credentials_unreadable` status_reason 추가 — commission 문서(spec-update) 미위임. 구현 scope(복호화 실패 경로 처리)가 `cafe24-pending-polish.md` 변경 0–5 어디에도 없어 dead spec 위험 | DRAFT 1C `status_reason` 행 | `spec-update-cafe24-pending-polish.md` C1/C2 위임 범위 | DRAFT 1C에서 `credentials_unreadable` 제거하거나, `cafe24-pending-polish.md`에 "변경 6 — credentials 복호화 실패 시 `status_reason='credentials_unreadable'` 기록" 항목 추가 |
| W6 | plan_coherence | `integration_oauth_state` 스키마 확장(integration_id, mode, requested_scopes, provider_meta V041) — commission 문서 미위임. V041이 미적용이면 이번 PR 범위 외 마이그레이션 의존성 암묵적 추가 | DRAFT 3D 스키마 확장 | `spec-update-cafe24-pending-polish.md` 전체(해당 요청 없음) | V041이 실 DB에 이미 존재하는지 확인. 미적용이면 DRAFT 3D 해당 컬럼 제거하거나 `cafe24-pending-polish.md`에 "변경 6 — V041 마이그레이션 확인/적용" 항목 추가 |
| W7 | cross_spec | §11.1 만료 스캐너 미갱신 — `spec/2-navigation/4-integration.md §11.1` 이 draft 영향 목록에서 누락되어 `pending_install` 24h TTL 스캐너 분기 구현 근거가 data-flow spec에만 존재 | DRAFT 3C-bis `spec/data-flow/integration.md §1.4` 갱신 | `spec/2-navigation/4-integration.md §11.1` (`대상: Integration WHERE token_expires_at IS NOT NULL`) | §11.1 `대상:` 줄에 `pending_install 24h 초과 분기` 설명 추가하거나 §11 서두에 "pending_install TTL 처리는 §1.4 참조" forward-ref 추가 |
| W8 | cross_spec | §10.2 step 4 `reauthorize` 분기가 `pending_install` 예외 동작 미반영 — step 4만 보면 실패 시에도 status=connected로 갱신하는 오류 가능 *(W2와 동일 근인이나 수정 대상 다름)* | DRAFT 2G §10.2 step 6 신규 추가 | `spec/2-navigation/4-integration.md §10.2 step 4` | step 4 `reauthorize` 항에 `※ status=pending_install이면 성공 시 connected, 실패 시 pending_install 유지 — 상세는 step 6` 한 줄 추가 |
| W9 | cross_spec | §1.2 부모 다이어그램 잘못된 경로 노출 — draft가 올바른 §1.2.1 sub-diagram 추가하면서 부모의 `GET /oauth/:service/start` 오표기가 더 눈에 띄게 됨 | DRAFT 3C forward-ref + §1.2.1 추가 | `spec/data-flow/integration.md §1.2` (`GET /oauth/:service/start`) | DRAFT 3C 적용 범위에 §1.2 부모 다이어그램의 `GET /oauth/:service/start` → `POST /oauth/begin` 정정 포함 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | naming_collision | `카테고리` 용어 — Cafe24 API Resource grouping과 `Node.category` enum 양쪽에 사용되어 맥락 없이 혼선 가능 | DRAFT 2H §14.2, `4-cafe24.md §337`, `cafe24-api-metadata.md §6` | `cafe24-api-metadata.md §6` disambiguation note에 "`Node.category`(logic/ai/…)와 무관" 한 줄 추가 |
| I2 | naming_collision | `install_timeout`(DB) ↔ `pending_install_timeout`(큐 메시지) — 동일 TTL 이벤트를 서로 다른 식별자로 표기, 의도적 분리이나 추적 어려움 | DRAFT 3C-bis 큐 메시지 서술 | DRAFT 3C-bis에 "reason='pending_install_timeout' 처리 결과 → DB `status_reason='install_timeout'`" 명시적 매핑 주석 추가 |
| I3 | convention_compliance | 인덱스 마이그레이션 V번호 플레이스홀더 (`V0XX`) — spec 초안 단계에서는 허용이나 굳어지지 않도록 주의 필요 | DRAFT 1D 인덱스 전략 마지막 주석 | 구현 착수 시 `ls backend/migrations \| tail -2`로 실제 번호 확정 후 spec 반영을 plan에 명시 |
| I4 | convention_compliance | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` prefix — `CAFE24_INSTALL_` 그룹과 다른 `CAFE24_PRIVATE_` prefix 사용. spec/conventions 위반은 아님 | DRAFT 2F §9.4, DRAFT 2F-bis | 향후 에러 코드 규약 정식화 시 `CAFE24_{FLOW}_{DESCRIPTION}` 형식 확정에 이 케이스 포함 |
| I5 | rationale_continuity | `install_token UNIQUE` 제약 결정 및 legacy 경로(`/oauth/install/cafe24`) 영구 폐기 시점이 plan에 미추적 | DRAFT 1D 주석, DRAFT 2E deprecated 경로, DRAFT 2I Rationale | `cafe24-pending-polish.md`에 (a) install_token UNIQUE 제약 운영 검토 항목, (b) legacy 410 경로 영구 폐기 검토 항목 체크박스로 추가 |
| I6 | rationale_continuity | `expired --> [*]: manual delete (install_timeout 케이스)` qualifier — install_timeout 외 만료 행도 삭제 가능하여 오해 소지 | DRAFT 3A §3.1 상태 전이 다이어그램 diff | `(install_timeout 케이스)` qualifier 제거 → `expired --> [*]: manual delete`로 단순화 |
| I7 | plan_coherence | DRAFT 2K §4.2 섹션 번호 라벨 오기 — 수정 대상 실제는 §4.3이나 헤더가 §4.2만 표기 *(cross_spec I1과 동일, 통합)* | DRAFT 2K 헤더 | 헤더를 "§4.2 + §4.3 Reauthorize 행 비활성 조건 추가"로 수정 |
| I8 | plan_coherence | `credentials.app_type` FE 노출 방식 미명시 — encrypted JSONB 안 값을 FE가 평가하려면 backend 응답에 별도 노출 필요 | DRAFT 2K §4.2 비활성 조건 | DRAFT 2K에 "※ `credentials.app_type`는 backend 응답에서 `meta.appType` 등으로 별도 노출되어야 한다" 한 줄 추가 |
| I9 | cross_spec | `credentials_unreadable` — §6 상태 전이 트리거 표 및 §10.4 에러 매핑에 해당 케이스 미반영 | DRAFT 1C, DRAFT 3B | §6 노트 또는 §10.4에 `credentials_unreadable` 케이스 한 줄 추가 (W5 해소 후 적용) |
| I10 | cross_spec | `pending_install` 필터 칩 미노출 결정 — §2.3 본문 상태 칩 목록에 언급 없어 독자가 필터 여부 판별 불가 | DRAFT 2I Rationale | §2.3 상태 칩 행에 `pending_install: 필터 칩 미노출 (정상 전환 상태 — Rationale §2I 참조)` 주석 추가 |
| I11 | cross_spec | DRAFT 2I 약속 항목(`/oauth/install/cafe24` 영구 폐기 follow-up)이 plan에 미등록 *(I5와 동일 이슈, 통합)* | DRAFT 2I Rationale | I5 조치와 동일 — `cafe24-pending-polish.md`에 체크박스 추가 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **LOW** | §11.1 만료 스캐너 누락(W7), §10.2 step 4 pending_install 분기 미반영(W8) |
| Rationale Continuity | **MEDIUM** | mode=reauthorize 재사용 Rationale 부재(W2), 앱 레벨 중복 체크 구현 경로 미명시(W3) |
| Convention Compliance | **NONE** | CRITICAL/WARNING 위반 없음. 마이그레이션 V번호 플레이스홀더 허용 수준 |
| Plan Coherence | **LOW** | `credentials_unreadable` 비위임 scope(W5), `integration_oauth_state` V041 의존성 미확인(W6) |
| Naming Collision | **LOW** | `resource_not_found` dead identifier 위험(W1) |

---

## 권장 조치사항

> BLOCK 없음. 아래 순서대로 spec 반영 전 보완 권장.

1. **[필수, W1]** `resource_not_found` 의미 수렴 — DRAFT 1C/3B에서 제거하거나 §10.4 설명과 명확히 분리. dead identifier를 spec에 남기면 구현자가 해당 path를 작성하다 §10.4와 충돌.

2. **[필수, W2+W8 연동]** `mode=reauthorize` 재사용 Rationale 추가 + §10.2 step 4 보완 — 두 수정이 같은 설계 결정을 다른 문서에서 보완하므로 함께 처리. DRAFT 2I Rationale에 단락 추가, §10.2 step 4에 pending_install 예외 동작 한 줄 삽입.

3. **[필수, W3]** `mall_id` 접근 경로 명시 — `integration` 테이블에서 `mall_id`가 plain column인지 JSONB path인지 확정 후 DRAFT 1B 또는 2I에 한 문장 추가. 미명시 시 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 체크 구현이 방향 없이 진행될 위험.

4. **[권고, W5+W6]** 비위임 scope 처리 — (a) `credentials_unreadable`: 제거하거나 변경 6으로 구현 scope 명시; (b) V041 마이그레이션: 실 DB 적용 여부 확인 후 DRAFT 3D 조정. 두 항목 모두 이번 PR 범위 확정에 필요.

5. **[권고, W7]** §11.1 `spec/2-navigation/4-integration.md` pending_install TTL 스캐너 분기 추가 — 구현자가 §11.1만 보고 해당 분기를 누락하는 것을 방지.

6. **[권고, W4]** 보안 가정 역전 조건 기록 — DRAFT 2I에 "토큰 길이 단축·PRNG 변경 시 403 통합 복원" 한 문장. 장기 유지보수 리스크 방지.

7. **[권고, W9]** §1.2 부모 다이어그램 `GET → POST` 정정 — DRAFT 3C 적용 범위에 포함하면 추가 PR 없이 해소 가능.

8. **[이후, I5+I11]** `cafe24-pending-polish.md`에 follow-up 체크박스 2건 등록 — (a) install_token UNIQUE 제약 운영 검토, (b) legacy `/oauth/install/cafe24` 영구 폐기 시점 결정.