# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 단, WARNING #1(`markIntegrationCallbackError` 충돌)은 구현 착수 전 plan 문서 수정이 선행되어야 한다.

---

## 전체 위험도
**MEDIUM** — Critical 없음. Plan Coherence WARNING #1이 기존 `connected → error(auth_failed)` 전이를 무효화할 수 있는 실질 충돌이며, 나머지 WARNING은 수정 비용이 낮다.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | Plan Coherence | `markIntegrationCallbackError` 설명("status 유지 for both")이 spec draft 및 위임 원본과 역방향 — `connected` 는 status **전이**(→ `error(auth_failed)`), `pending_install` 만 status **보존** | `cafe24-pending-polish.md` 변경 0 | DRAFT 2G §10.4 표 + `spec-update-cafe24-pending-polish.md §B W1` | 변경 0을 "pending_install 전용으로 status 보존" + "`connected` 의 `error(auth_failed)` 전이는 기존 코드 경로"로 분리 기술 |
| 2 | Plan Coherence | 레거시 경로 `/oauth/install/cafe24` **영구 폐기 후속 항목**이 implementation plan에 없음 — 무기한 410 Gone 유지 위험 | `cafe24-pending-polish.md` 변경 2 | DRAFT 2I Rationale ("후속 항목으로 추가 예정" 명시) | 변경 2 하단에 `[ ] (후속) 레거시 경로 영구 폐기 결정 — 운영 데이터·Cafe24 Developers 등록 URL 잔존 여부 확인 후 별도 PR` 추가 |
| 3 | Naming Collision | `CAFE24_INSTALL_INVALID_HMAC(403)` 의미 축소 — "pending 미발견" 케이스를 `CAFE24_INSTALL_INVALID_TOKEN(404)`로 분리하면서 기존 403 기대 e2e 테스트가 실패 | DRAFT 이후 `spec/2-navigation/4-integration.md §9.2` | 기존 e2e/통합 테스트("pending 미발견" 경로가 403을 기대) | `cafe24-pending-polish.md` 변경 5 테스트 보강에 "기존 `CAFE24_INSTALL_INVALID_HMAC(403)` 테스트 중 '토큰 미존재' 경로를 `CAFE24_INSTALL_INVALID_TOKEN(404)`로 전환" 명시 |
| 4 | Convention Compliance | DRAFT 2D mermaid 코드 블록이 ASCII 화살표(`──▶`)를 사용 — mermaid 파서가 diagram type 선언 없어 plain text로 렌더링됨 | `spec/2-navigation/4-integration.md §6` 다이어그램 | DRAFT 3A의 동일 전이를 `stateDiagram-v2`로 정상 작성 | `stateDiagram-v2` 문법으로 재작성하거나 mermaid 블록 제거 후 전이 표만 유지 |
| 5 | Convention Compliance | DRAFT 1D에서 인덱스를 "후속 V0XX로 추가한다"고 플레이스홀더 사용 — migration convention은 확정 V번호를 spec에 명시하도록 요구 | `spec/1-data-model.md §3` blockquote | `spec/conventions/migrations.md §2, §5` | V042에 인덱스 포함 결정 → "V042에 포함" 확정, 또는 "후속 plan에서 V번호 결정" 명시 후 spec에서 V번호 자체 제거 |
| 6 | Cross-Spec | 영향받는 연관 문서에 "`spec/1-data-model.md` §3 인덱스 **미변경**"이라 기재됐으나, DRAFT 1D는 §3 인덱스 테이블에 신규 행(`install_token` 부분 인덱스) 및 기존 행 설명 보강을 실제로 수행 | draft 하단 "영향받는 연관 문서" 섹션 | DRAFT 1D 본문 | 해당 항목을 "`spec/1-data-model.md` §2.10, §3 (install_token 부분 인덱스 추가 + workspace_id,status 설명 보강)"으로 수정 |
| 7 | Cross-Spec | `Resource` → `카테고리` 용어 교정 대상이 3개 파일로 제한되어 있으나 `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/1-data-model.md §2.6` 에도 동일 표현 존재 | DRAFT 2H (`4-integration.md §14.2`, `4-cafe24.md:337`, `cafe24-api-metadata.md §6`) | `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/1-data-model.md §2.6` | 위 3개 파일을 영향받는 연관 문서에 추가하거나, 교정 대상에서 제외한다는 명시적 결정을 draft에 기록 |
| 8 | Cross-Spec (+ Convention, Rationale) | DRAFT 1C가 "`credentials_unreadable`을 §10.4에 동시 명시"라 공약했으나 DRAFT 2G §10.4 에러 매핑 표에 해당 행이 없음 | DRAFT 2G `spec/2-navigation/4-integration.md §10.4` | DRAFT 1C의 공약 기술 | DRAFT 2G §10.4 표에 `credentials_unreadable` 케이스 행 추가, 또는 DRAFT 1C에서 "§10.4 표 범위 외"로 명확히 수정하여 자기 모순 제거 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Naming Collision + Cross-Spec | `oauth_token_exchange_failed`(Integration) vs `token_exchange_failed`(소셜 로그인 URL 파라미터) — 로그·grep 혼동 가능성 | DRAFT 2I Rationale, `spec/2-navigation/10-auth-flow.md §5.4` | Rationale에 이미 도메인 분리 명시됨. 추가 조치 불필요. 운영 알림 필터 구성 시 두 식별자 별도 처리 유의 |
| 2 | Naming Collision + Plan Coherence | BullMQ `integration-expiry` 큐 메시지 `reason` 필드 신설 — 롤링 배포 구간 구버전 소비자 하위 호환 처리 미명시 | DRAFT 3C-bis, `cafe24-pending-polish.md` 변경 4 | 변경 4에 "기존 큐 consumer에 `reason ?? 'token_expiring'` 기본값 처리" 체크박스 추가. 배포 순서: 소비자 먼저, 생산자 나중 |
| 3 | Rationale Continuity | callback popup auto-close 3~5초 지연 선택 근거가 DRAFT 2I Rationale에 없음 | DRAFT 2G §10.2 step 6, §10.4 | DRAFT 2I에 "실패 popup은 3~5초 지연(에러 메시지 독해 시간), 성공은 즉시 close" 1줄 추가 권장 |
| 4 | Rationale Continuity | `install_token` UNIQUE 제약 결정이 "운영 데이터 확인 후"로 defer됐으나 plan에 후속 추적 항목 없음 | DRAFT 1D 인덱스 전략 주석 | `cafe24-pending-polish.md`에 "install_token UNIQUE 제약 — V042 운영 데이터 기준으로 후속 결정" 항목 추가 |
| 5 | Rationale Continuity | `credentials_unreadable` 최초 도입 시점·이유가 spec 어디에도 Rationale 없음 | DRAFT 1C, DRAFT 3B | DRAFT 2I 또는 data-flow §3.2에 "2026-05-XX 기존 코드 분기 파생, 본 개정에서 첫 공식 열거" 1줄 추가 |
| 6 | Convention Compliance | `spec/conventions/swagger.md §2-4` 참조 — 본 검토에서 파일 접근 불가로 준수 여부 미확인 | DRAFT 2F `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` 주석 | swagger.md 존재 및 §2-4 내용 확인. 없으면 "기존 `INTEGRATION_IN_USE(409)` 선례와 통일"로 근거 변경 |
| 7 | Convention Compliance | 경로 파라미터 `:installToken`(camelCase) — 프로젝트 기존 패턴 일치 여부 미확인 | DRAFT 2E, 2F-bis, 2J-1, 2J-2 | 기존 API spec(`:workspaceId`, `:integrationId` 등) 확인 후 camelCase 패턴이면 이슈 없음 |
| 8 | Cross-Spec | `last_error.code` UPPER_SNAKE_CASE 규약이 `spec/1-data-model.md §2.10`에 미명시 — `status_reason`(snake_case)과의 DB 저장 규약 차이 | DRAFT 2G §10.4 `last_error.code='OAUTH_TOKEN_EXCHANGE_FAILED'` | §2.10 Integration `last_error` 설명에 "code는 UPPER_SNAKE_CASE(API 에러 코드와 동일 표기)" 1줄 추가 권장 |
| 9 | Cross-Spec | V042 migration이 이미 존재(`backend/migrations/V042__cafe24_private_app_pending_install.sql`) — `install_token` 컬럼 이미 추가된 상태일 수 있음. `provider_meta`(integration_oauth_state) V번호도 재확인 필요 | DRAFT 1D(V042), DRAFT 3D(V041) | 구현 착수 전 `backend/migrations/` 파일 목록으로 (a) install_token V042 포함 여부, (b) provider_meta 정확한 V번호 확정 |
| 10 | Cross-Spec | `spec/0-overview.md §6.3` Cafe24 spec 날짜가 2026-05-13으로 stale — 본 개정 이후 갱신 필요 | `spec/0-overview.md §6.3` | 영향받는 연관 문서에 `spec/0-overview.md §6.3` 추가, "spec 개정(2026-05-14)"으로 갱신 권장 |
| 11 | Plan Coherence | §4.2 Reauthorize 버튼 비활성화 조건(DRAFT 2K)이 implementation plan 변경 1에 미명시 | DRAFT 2K, `cafe24-pending-polish.md` 변경 1 | 변경 1에 "§4.2 Reauthorize 버튼: `pending_install` 상태 또는 `cafe24 private` 앱에서 비활성화" 체크박스 추가 |
| 12 | Plan Coherence | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` HTTP 상태 코드 — 위임 원본(400) vs. spec draft(409) | DRAFT 2F, `spec-update-cafe24-pending-polish.md §C4` | developer 측 409 채택 동의 확인. 이견 있으면 Rationale에 판단 근거 보강 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 3건(영향 문서 기술 오류, 용어 교정 범위 미완, credentials_unreadable §10.4 누락). Critical 충돌 없음 |
| Rationale Continuity | LOW | INFO 3건(credentials_unreadable 출처 불명, auto-close 지연 근거 없음, UNIQUE 제약 defer 추적 누락). 결정 연속성 Critical 위반 없음 |
| Convention Compliance | LOW | WARNING 2건(mermaid 비표준 문법, V0XX 플레이스홀더). 정식 규약 직접 위반 없음 |
| Plan Coherence | **MEDIUM** | WARNING 2건 중 #1(`markIntegrationCallbackError` connected 처리 역방향)이 기존 동작을 무효화할 수 있는 실질 충돌 |
| Naming Collision | LOW | WARNING 1건(HMAC 에러 코드 의미 축소 → 기존 테스트 수정 필요). 식별자 Critical 충돌 없음 |

---

## 권장 조치사항

1. **[즉시, 구현 착수 전]** `cafe24-pending-polish.md` 변경 0 — `markIntegrationCallbackError` 설명을 "`pending_install` 전용 status 보존" + "`connected` 는 기존 `error(auth_failed)` 전이 경로 위임"으로 수정 (WARNING #1 해소)
2. **[spec 적용 직후]** DRAFT 2G §10.4 표에 `credentials_unreadable` 행 추가, 또는 DRAFT 1C의 "§10.4 동시 명시" 공약 수정 (WARNING #8)
3. **[spec 작성 시]** DRAFT 2D mermaid 블록을 `stateDiagram-v2`로 재작성하거나 제거 (WARNING #4)
4. **[spec 작성 시]** DRAFT 1D `V0XX` 플레이스홀더를 확정 V번호 또는 "V번호 미지정" 명시로 교체 (WARNING #5)
5. **[plan 갱신]** `cafe24-pending-polish.md`에 후속 항목 3건 추가: (a) 레거시 경로 영구 폐기 결정, (b) BullMQ consumer 하위 호환 처리, (c) install_token UNIQUE 제약 결정 (WARNING #2, INFO #2, #4)
6. **[plan 갱신]** `cafe24-pending-polish.md` 변경 5에 "기존 403 테스트 중 '토큰 미존재' 경로를 404로 전환" 추가 (WARNING #3)
7. **[영향 문서 목록 수정]** draft 하단 연관 문서 항목을 `§3 인덱스 변경 포함`으로 수정 + `0-common.md` 2개 파일 추가 또는 교정 제외 명시 (WARNING #6, #7)
8. **[구현 착수 전 확인]** `backend/migrations/` 파일 목록으로 V042 내용 및 `provider_meta` V번호 확정 (INFO #9)