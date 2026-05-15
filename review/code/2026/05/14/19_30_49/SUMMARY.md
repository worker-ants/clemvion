# Code Review 통합 보고서

## 전체 위험도
**HIGH** — API Contract 파괴 2건(Critical)·spec-code 충돌·plan-spec 간 상충이 다수 확인. 구현 착수 전 plan 문서 정정과 spec 보강이 선행되어야 한다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C1 | API Contract / Side Effect | **App URL Path Breaking Change** — `/oauth/install/cafe24` → `/oauth/install/cafe24/:installToken` 변경은 Cafe24 Developers에 기등록된 외부 App URL에 대한 즉각적 파괴 변경. 사용자 마이그레이션 플로우(누가 언제 URL 재등록) 및 새 URL 안내 방법이 spec 어디에도 없음 | `spec/4-nodes/4-integration/4-cafe24.md §9.4`, `spec/2-navigation/4-integration.md §9.2` | 릴리스 전 "기존 Private 앱 등록자는 App URL 재등록 필요" 가이드 명시. `cafe24-pending-polish.md`에 배포 전 체크리스트 항목 추가. 운영 중 앱이 없다면 INFO로 강등 가능 |
| C2 | API Contract | **`CAFE24_INSTALL_INVALID_HMAC(403)` 의미 축소** — 기존 계약은 "pending row 미존재 + HMAC 불일치" 모두 403. 신규 404 분리 후 기존 테스트·클라이언트가 "row 미존재" 경로에서 404를 받아 silently fail | `spec/2-navigation/4-integration.md §9.2`, `spec/4-nodes/4-integration/4-cafe24.md §9.8` | `cafe24-pending-polish.md` 변경 5에 "기존 `CAFE24_INSTALL_INVALID_HMAC(403)` 중 '토큰/row 미존재' 경로 → `CAFE24_INSTALL_INVALID_TOKEN(404)` 전환" 체크박스 필수 추가 |
| C3 | Testing | **`statusReason: 'waiting'` 픽스처** — spec 정의에 없는 값이 기존 테스트 픽스처에 사용됨. 구현 완료 시 spec drift를 숨기는 false positive 테스트가 됨 | `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts:449` | 픽스처를 `'oauth_token_exchange_failed'` 등 spec 정의 값으로 즉시 교체 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Plan-Spec 충돌 | **`markIntegrationCallbackError` `connected` 처리 상충** — plan 변경 0은 "status 유지", spec §10.4는 `connected` 재인증 실패 시 `error(auth_failed)` 전이. plan대로 구현하면 기존 reauthorize 실패 경로 회귀. consistency check 3회 지적 후에도 plan 미수정 | `plan/in-progress/cafe24-pending-polish.md 변경 0` vs `spec/2-navigation/4-integration.md §10.4` | plan 변경 0을 "pending_install → status 보존 / connected → error(auth_failed) (§10.4 기준)"으로 분리 기술 |
| W2 | Plan-Spec 충돌 | **`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` HTTP 코드·조건 불일치** — plan 변경 3: `(400)` + 조건 `(workspaceId, mall_id)`, spec §9.4: `(409)` + 조건 `(workspaceId, mall_id, app_type='private')`. 조건 차이로 public/private 앱 간 의도치 않은 충돌 차단 발생 가능. consistency check 3회 지적 후 미해소 | `plan/in-progress/cafe24-pending-polish.md 변경 3` | plan 변경 3: `(400)` → `(409)`, 조건 → `(workspaceId, mall_id, app_type='private')` 즉시 정정 |
| W3 | Architecture / API Contract | **Frontend `credentials.app_type` 접근 경로 미명시** — `credentials`는 AES-256-GCM 암호화 JSONB. Frontend가 Reauthorize 버튼 활성화를 위해 이 값에 접근하려면 Backend API 응답에 복호화된 `appType`을 별도 노출해야 하나, spec §9.1에 해당 필드 없음. 구현자가 credentials 전체를 평문 노출하는 보안 사고 가능 | `spec/2-navigation/4-integration.md §4.2, §9.1` | spec §9.1 Integration 응답 스키마에 `meta.appType: 'public' \| 'private' \| null` 필드 명시 |
| W4 | BullMQ / Deployment | **`integration-expiry` 큐 메시지 스키마 확장 — 소비자 하위 호환 미추적** — `{ integrationId }` → `{ integrationId, reason }` 확장. spec에 `reason ?? 'token_expiring'` fallback 명시됐으나 plan 변경 4 체크리스트에 미반영. rolling 배포 중 구버전 consumer가 silent failure 가능 | `spec/data-flow/integration.md §1.4`, `plan/in-progress/cafe24-pending-polish.md 변경 4` | 변경 4에 "consumer에 `reason ?? 'token_expiring'` 기본값 처리 추가" + "consumer 먼저 배포 후 producer" 순서 체크박스 추가 |
| W5 | Security | **TOCTOU Race Condition — 앱 레벨 mall_id 중복 검사** — `mall_id`가 암호화 JSONB에 있어 DB UNIQUE 인덱스 불가 → 앱 레벨 체크. 동시 요청 두 건이 모두 검사를 통과해 중복 Integration 생성 가능 | `spec/2-navigation/4-integration.md §9.2` | `INSERT ... WHERE NOT EXISTS` 또는 advisory lock으로 원자적 처리. 또는 `mall_id`를 plain 컬럼으로 분리 후 DB partial unique index 적용 방안을 구현 spec에 명시 |
| W6 | Security | **install_token URL path 노출 — 서버 로그 유출 위험** — Nginx/CDN access log, Referer 헤더, 브라우저 히스토리에 token이 평문 기록. TTL 24h 동안 log 유출 = token 탈취 | `spec/4-nodes/4-integration/4-cafe24.md §9.4` | (a) query parameter(`?t=...`)로 이동하거나, (b) nginx log에서 installToken 세그먼트 마스킹 구현 노트를 spec에 추가 |
| W7 | Security | **`CAFE24_INSTALL_INVALID_TOKEN(404)` 분리 — token 존재 오라클** — 404/403 분리로 공격자가 응답 코드만으로 유효 token 존재 여부 판단 가능. rate limiting 부재 시 열거 가능 | `spec/2-navigation/4-integration.md §9.2`, `spec/4-nodes/4-integration/4-cafe24.md §9.8` | install endpoint에 IP 기반 rate limiting 구현을 spec에 명시. Rationale에 "rate limiting 전제"를 명시 |
| W8 | Requirement | **App URL UI 노출 흐름 미명시** — install_token이 박힌 App URL(`/oauth/install/cafe24/:installToken`)을 사용자에게 전달하는 경로(UI 복사 버튼 등)가 spec 어디에도 없음. 사용자가 URL을 알 수 없으면 전체 플로우 불성립 | `spec/4-nodes/4-integration/4-cafe24.md §9.4 step 2` | `spec/2-navigation/4-integration.md §2.2` 또는 §9.4에 "pending_install 생성 직후 App URL을 UI에서 복사 가능한 형태로 노출" 명시 |
| W9 | Requirement | **TTL 경계 처리 미정의** — 생성 후 24h 초과 ~ 스캐너 실행 전 구간에서 Cafe24의 install callback 요청을 정상 처리할지 에러 반환할지 spec에 없음 | `spec/4-nodes/4-integration/4-cafe24.md §9.4 step 7` | §9.2에 "install_token 조회 성공 + created_at 24h 초과 → 404 처리" 또는 "정상 처리 후 스캐너 정리" 중 정책 명시 |
| W10 | Side Effect | **§13 데이터 모델 요약에 `install_token` 누락** — `spec/1-data-model.md §2.10`에 `install_token` 컬럼·인덱스가 추가됐으나 §13 Integration 변경 요약에 미기재. 구현자가 §13만 읽으면 마이그레이션 대상에서 누락 가능 | `spec/2-navigation/4-integration.md §13` | §13에 `install_token (String?, Cafe24 private 전용)` 필드 + partial unique index 행 추가 |
| W11 | Performance | **스캐너 잡 쿼리 2개 확장 — 배치 정책 미명시** — `token_expires_at` 쿼리 외 `pending_install` TTL 만료 쿼리 추가. 두 쿼리의 실행 순서·실패 격리·트랜잭션 경계 미명시 | `spec/data-flow/integration.md §1.4`, `spec/2-navigation/4-integration.md §11.1` | §11.1 또는 §1.4에 "두 쿼리는 독립 실행 (실패 시 서로 영향 없음)" 및 배치 LIMIT 정책 한 줄 명시 |
| W12 | Dependency / Database | **V041 `provider_meta` 컬럼 적용 여부 미확인** — `integration_oauth_state.provider_meta (V041)` 실재 여부가 consistency check 4회 지적 후에도 plan에 선행 확인 체크박스 미추가. V041 미적용 시 변경 2/3 구현에서 런타임 오류 | `spec/data-flow/integration.md §2.1`, `plan/in-progress/cafe24-pending-polish.md` | plan 변경 2 앞에 "선행 확인: `integration_oauth_state.provider_meta` (V041) DB 실재 여부" 체크박스 추가 |
| W13 | Database | **`install_token` UNIQUE 제약 deferred — DB 레벨 보장 없음** — 부분 인덱스만 정의, UNIQUE 제약은 "운영 시점 결정"으로 defer. 이 결정이 plan 어디에도 추적되지 않아 조용히 누락될 위험 | `spec/1-data-model.md §3` | 마이그레이션 계획에 UNIQUE 제약 확정 체크박스 추가. spec §3 Rationale에 "confirm UNIQUE at V0XX" 명시 |
| W14 | Testing | **`install_token` 신규 흐름 테스트 케이스 미명시** — 핵심 경로 변경(mall_id 스캔 → `:installToken` 단일 조회)에 대한 4개 케이스 누락: (a)정상 흐름, (b)성공 후 NULL 전환 상태 재호출→404, (c)TTL 만료 후 NULL 확인, (d)replay 방어 | `plan/in-progress/cafe24-pending-polish.md 변경 5` | 변경 5에 4개 케이스를 체크박스로 추가. (b)는 e2e, (c)는 스캐너 통합 테스트로 작성 |
| W15 | Architecture | **`install_token`이 generic Integration 엔티티에 직접 추가** — Cafe24 Private 전용 필드가 범용 엔티티에 nullable 컬럼으로 추가. 향후 provider 다변화 시 nullable 컬럼 누적 | `spec/1-data-model.md §2.10` | spec §2.10에 "다른 provider에 유사 흐름 추가 시 `IntegrationInstallProcess` 엔티티 분리 검토" Rationale 한 줄 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | Security | **PRNG 품질 미명시** — `install_token` 생성 방식에 CSPRNG 명시 없음. 비암호학적 PRNG 사용 시 256비트 전제 무너짐 | `spec/1-data-model.md §2.10` | spec에 "Node.js `crypto.randomBytes(32).toString('hex')` 또는 동등한 CSPRNG 사용" 명시 |
| I2 | Security | **HMAC 검증 순서 미명시** — timestamp ±5분 검사와 HMAC 검증 순서 불명. HMAC 먼저 수행 시 DoS 방어 비효율 | `spec/4-nodes/4-integration/4-cafe24.md §9.8` | §9.8 의사코드에 "① timestamp 검사 → ② install_token 조회 → ③ HMAC 검증" 순서 명시 |
| I3 | Requirement | **§6 `install_token` 보존 정책 미명시** — `data-flow §1.2.1`은 callback 실패 시 install_token 유지를 명시하나 §6 전이 표에서 누락 | `spec/2-navigation/4-integration.md §6` | §6 해당 전이 행에 "`install_token` 유지 (Cafe24 재시도를 위해 소거하지 않음)" 추가 |
| I4 | Dependency | **V0XX 인덱스 마이그레이션 번호 미확정** — `install_token` 인덱스 마이그레이션이 "V0XX" 플레이스홀더. V042 이후 번호 사용 필요 | `spec/1-data-model.md §3` | 구현 착수 직전 `backend/migrations/` 최대 V번호 확인 후 spec §3 갱신 |
| I5 | Dependency | **`spec/conventions/swagger.md §2-4` 실재 미확인** — 여러 spec에서 인용하나 존재 여부 "확인 불가"로 반복 표기 | `spec/2-navigation/4-integration.md §9.4` | 구현 착수 전 파일 실재 및 §2-4 내용 확인 |
| I6 | Dependency | **`review/consistency/2026-05-14_16-48-25/` dead reference** — Rationale에 존재하지 않는 세션 타임스탬프 참조 | `spec/2-navigation/4-integration.md ## Rationale` | 실재하는 세션(`2026-05-14_17-00-12` 등)으로 교체 또는 링크 제거 |
| I7 | Requirement | **legacy path 영구 폐기 follow-up 미등재** — DRAFT 2I Rationale는 `/oauth/install/cafe24` 영구 폐기를 plan에 추가 예정이라 했으나 미반영 | `plan/in-progress/cafe24-pending-polish.md` | plan 말미에 `[ ] (후속) 레거시 경로 영구 폐기 결정 — 별도 PR` 추가 |
| I8 | Documentation | **review 파일 trailing newline 전체 누락** — 31개 파일 모두 `\No newline at end of file`. git diff 노이즈, 스크립트 파싱 오류 가능 | `review/consistency/**` | 파일 생성 skill/템플릿에 trailing newline 후처리 추가 |
| I9 | Documentation | **리뷰 파일 내 에이전트 내부 과정 서술 노출** — "데이터를 수집했습니다" 등 과정 문장이 산출물 파일 앞에 포함됨 | 다수 checker review.md | 리뷰 생성 프롬프트에 "최종 보고서만 출력" 지침 추가 |
| I10 | Maintainability | **consistency check 5회 연속 실행 — 해소 이력 단일 진실 없음** — 동일 이슈가 3~4개 세션에 중복 기록되어 최신 결론 추적 불가 | `review/consistency/` 5개 세션 | 최종 세션 SUMMARY.md에 "이전 세션 대비 해소 항목" 섹션 추가 또는 `RESOLUTION.md` 신설 |
| I11 | Performance | **`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` mall_id O(N) 조회 위험** — `mall_id`가 암호화 JSONB 내 존재 시 앱 레벨 비교가 O(N) decrypt 반복 가능 | `spec/2-navigation/4-integration.md §9.2` | `mall_id` 저장 방식(plain column 여부) 확인. plain 컬럼이면 인덱스 활용 가능 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| API Contract | **HIGH** | App URL breaking change, HMAC 에러 코드 의미 변경, HTTP 409 vs 400 불일치 |
| Side Effect | **MEDIUM** | App URL 외부 의존성, plan-spec `connected` 처리 충돌, HMAC 테스트 silent breakage |
| Testing | **MEDIUM** | `statusReason: 'waiting'` 픽스처, `connected` 처리 방향 미결정, `install_token` 흐름 테스트 누락 |
| Architecture | **MEDIUM** | `credentials.app_type` 노출 경로 미명시, BullMQ 배포 순서 미명시 |
| Requirement | **MEDIUM** | App URL UI 노출 흐름 없음, `markIntegrationCallbackError` plan-spec 충돌 |
| Security | **LOW** | TOCTOU 경쟁 조건, URL path token 노출, token 존재 오라클 |
| Performance | **LOW** | 스캐너 쿼리 확장 배치 정책 미명시, encrypted JSONB O(N) 조회 위험 |
| Database | **LOW** | `install_token` UNIQUE 제약 미결정, V041 적용 여부 미확인 |
| Dependency | **LOW** | BullMQ 소비자 하위 호환 plan 미반영, App URL 외부 재설정 배포 계획 누락 |
| Documentation | **LOW** | review 파일 trailing newline 누락, 에이전트 과정 서술 노출 |
| Scope | **LOW** | `cafe24-api-metadata.md` 규약 변경이 spec 패치에 혼재 |
| Maintainability | **LOW** | `status_reason` 테이블 셀 과부하, consistency check 해소 이력 분산 |
| Concurrency | **NONE** | 실행 코드 없음 — 해당 없음 |

---

## 발견 없는 에이전트
- **Concurrency** — 변경 파일 전체가 Markdown/JSON 문서로 런타임 동시성 로직 없음

---

## 권장 조치사항

**구현 착수 전 필수 (Blocking)**

1. **plan 문서 즉시 정정** — W1(`markIntegrationCallbackError` `connected` 처리), W2(HTTP 409·uniqueness 조건), W4(BullMQ 배포 순서·fallback) 세 항목을 `cafe24-pending-polish.md`에 반영
2. **C3 해결** — `statusReason: 'waiting'` 픽스처를 spec 정의 값으로 교체
3. **W8 해결** — install_token URL을 사용자에게 전달하는 UI 흐름을 spec에 명시 (없으면 Private 앱 등록 플로우 자체가 불완전)
4. **W3 해결** — `spec/2-navigation/4-integration.md §9.1`에 `meta.appType` 필드 추가 (구현 시 보안 사고 방지)

**릴리스 전 필수**

5. **C1 해결** — 기존 Cafe24 Private 앱 등록자 대상 App URL 재등록 안내 가이드 작성 및 배포 체크리스트 추가
6. **C2 해결** — plan 변경 5에 "기존 403 → 404 전환 테스트 케이스" 명시 추가
7. **W5·W6·W7 해결** — rate limiting 구현 spec 명시, URL path 로그 마스킹 또는 query param 이동, TOCTOU 대응 방안 명시

**구현 중 처리**

8. V041 `provider_meta` 실재 확인 (W12) 및 V0XX 인덱스 마이그레이션 번호 확정 (I4)
9. `install_token` UNIQUE 제약 결정 체크박스 plan에 추가 (W13)
10. §13 `install_token` 필드 누락 보완 (W10), §6 install_token 보존 정책 명시 (I3), TTL 경계 처리 정책 결정 (W9)