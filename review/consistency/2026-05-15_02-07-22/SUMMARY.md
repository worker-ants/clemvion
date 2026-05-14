# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 단, MEDIUM 위험도의 WARNING 3건은 spec 반영 전 해소를 권고한다.

---

## 전체 위험도

**MEDIUM** — Critical 위배 없음. WARNING 7건 중 3건(V047 충돌·conventions 누락·레거시 경로 처리 불명확)은 developer Phase 2 착수 직전 `--impl-prep` 재검출 가능성이 높아 spec 반영 전 처리 권고.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | plan_coherence + naming_collision | **V047 마이그레이션 entry 포함 여부가 양 plan 간 정반대로 기술** — spec-draft 는 "추가 안 함", 구현 plan(`cafe24-app-url-3rdparty-shorten.md`) Phase 1 은 "V047 신규 entry 추가"로 명시 | `spec-draft` §1 spec/1-data-model.md ※ 노트 | `cafe24-app-url-3rdparty-shorten.md` Phase 1 세 번째 bullet | 둘 중 하나로 통일. 공식 결정 문서(spec-draft) 방향 우선 권고. spec-draft가 "추가 안 함"으로 확정했다면 구현 plan을 수정하고 그 근거를 spec-draft Rationale에 명시. 반대로 "V047 format-change-documented" entry를 남기기로 하면 spec-draft의 해당 문장을 수정. |
| 2 | plan_coherence + naming_collision | **`spec/conventions/` namespace 룰 결정 누락** — 구현 plan Phase 1 에 conventions 갱신 체크박스가 있으나 spec-draft 는 "직접 참조 없음"으로만 처리, 신규 생성·흡수 여부 미결 | `spec-draft` §미수정 항목 | `cafe24-app-url-3rdparty-shorten.md` Phase 1 마지막 bullet | spec-draft에 (a) `spec/conventions/routing-namespaces.md` 신규 생성 + `/api/3rd-party/<provider>/` prefix 규약 내용, (b) 기존 파일에 흡수 + 대상 파일 명시, (c) conventions 갱신 불필요 + 근거 중 하나를 명시해 Phase 1 체크박스를 완결 가능하게 만든다. |
| 3 | plan_coherence | **레거시 410 Gone 핸들러(토큰 없는 `/oauth/install/cafe24`) 처리 방침 불명확** — spec-draft의 "즉시 제거" 범위가 토큰 포함 경로인지 레거시 경로까지인지 불분명. 기존 등록자 App URL 재등록 안내 가이드도 언급 없음 | `spec-draft` §결정 사항 표 "옛 경로 즉시 제거" | `cafe24-pending-polish-followup.md` Group A 항목 1 (미체크) | spec-draft 결정 표와 Rationale에 "즉시 제거 대상은 토큰 포함 경로 (`/api/integrations/oauth/install/cafe24/:installToken`, `/api/integrations/oauth/callback/:provider`)에 한정. 레거시 410 Gone 핸들러는 followup plan Group A에 위임"을 명시. 등록자 안내 가이드는 spec 범위 밖이나 필수 운영 작업임을 Rationale 또는 구현 plan 체크리스트에 한 줄 기재. |
| 4 | convention_compliance | **`spec/4-nodes/4-integration/4-cafe24.md` 본문 내 인라인 개정 blockquote 누적** — `2026-05-14 개정:` 보존 + `2026-05-15 개정:` 추가 방식은 CLAUDE.md "latest state" 원칙과 충돌 | `spec-draft` §3 Line 389 — 개정 노트 | CLAUDE.md §프로젝트 스펙 문서 ("history 가 아닌 latest에 대한 기술") | 본문에서 날짜 기반 blockquote 두 개를 제거. 해당 파일의 `## Rationale` 섹션에 두 변경(2026-05-14·15) 배경을 통합 서술. 본문 step 본체는 최신 경로(`/api/3rd-party/cafe24/install/:installToken`, 16byte base64url 22자)만 기재. |
| 5 | rationale_continuity | **`CAFE24_INSTALL_INVALID_TOKEN(404)` 보안 전제 Rationale 갱신 대상 파일 누락** — 기존 spec의 "예: 토큰 길이 단축 → 403 재통합" 문장이 spec-draft의 새 결정(128-bit는 여전히 전제 유지)과 텍스트 충돌 | `spec-draft` §Rationale 신규 entry | `spec/2-navigation/4-integration.md` Rationale `CAFE24_INSTALL_INVALID_TOKEN(404)의 보안 전제 (2026-05-14)` | spec-draft의 변경 파일 목록에 `spec/2-navigation/4-integration.md` Rationale 해당 항목 갱신을 추가. 기존 "예: 토큰 길이 단축" → "예: 96-bit(12바이트) 미만으로의 단축, PRNG 변경, install_token 노출 사고"로 조건을 한정하는 문구로 교체. |
| 6 | naming_collision | **`google`/`github` OAuth 콘솔 redirect URI 이중 등록 명시 없음** — social login 콜백(`/api/auth/oauth/google/callback`)과 integration 콜백(`/api/3rd-party/google/callback`) 양쪽 모두 등록 필요하나 spec 어디에도 없음 | `spec-draft` §결정 사항 표 Callbacks 행 | `spec/2-navigation/10-auth-flow.md` §8 API 표 | spec-draft Rationale와 Phase 2 배포 체크리스트에 "기존 social login redirect URI(`/api/auth/oauth/google/callback`, `/api/auth/oauth/github/callback`)는 유지하고 integration redirect URI를 **추가** 등록"을 명시. |
| 7 | naming_collision | **callback 경로 표기 방식 혼재** — "결정 사항" 표·Rationale에서는 provider별 명시적 경로 3개(`/api/3rd-party/cafe24/callback` 등), §9.2·§10.1에서는 파라메트릭(`/api/3rd-party/:provider/callback`) | `spec-draft` §결정 사항 표 vs. spec/2-navigation/4-integration.md §9.2·§10.1 변경 내역 | 내부 일관성 문제 | API 표와 Rationale 전체를 파라메트릭 단일 형식(`/api/3rd-party/:provider/callback`, `:provider ∈ {cafe24, google, github}`) 또는 provider별 명시적 형식 3개 중 하나로 통일. spec 반영 전 결정 필요. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `spec/2-navigation/4-integration.md` Rationale "install_token을 App URL path 식별 키로 승격" 항목의 "32바이트 random" 표현이 잔존 | spec-draft §1 Line 253 변경 내역 | 해당 Rationale 항목 말미에 "(2026-05-15: 16바이트 base64url 22자로 변경 — 보안 동등성은 `CAFE24_INSTALL_INVALID_TOKEN` 항 참조)" 각주 한 줄 추가. |
| 2 | cross_spec | 사용자 인증 OAuth 콜백(`/api/auth/oauth/...`)과 통합 연동 OAuth 콜백(`/api/3rd-party/.../callback`)이 별개 경로·자격증명임을 spec 본문에서 명시하지 않음 | `spec/2-navigation/4-integration.md` §10.1 | §10.1 callback 섹션에 "이 엔드포인트는 통합 연동용 OAuth 콜백이며, 사용자 소셜 로그인 콜백(`/api/auth/oauth/:provider/callback`)과 별개다" 한 줄 주석 추가. |
| 3 | cross_spec | `spec/data-flow/integration.md`에 `/api/integrations/oauth/callback/` 잔여 참조 가능성 | spec-draft §미수정 항목 | spec 반영 전 `grep -r "integrations/oauth" spec/data-flow/`로 잔여 참조 최종 확인. |
| 4 | convention_compliance | `spec/1-data-model.md` Rationale 추가 텍스트 미명시 — "Rationale에 명시"로만 표기 | spec-draft §1 Rationale 갱신 | spec-draft에 `spec/1-data-model.md` Rationale 추가 텍스트 최소 1줄 포함("install_token 형식을 32byte hex → 16byte base64url로 변경한 이유 + DB schema 무변경 이유"). `spec/2-navigation/4-integration.md` Rationale에 상세 설명이 있으면 cross-link로 갈음 가능. |
| 5 | convention_compliance | 신규 `/api/3rd-party/` 컨트롤러의 Swagger 데코레이터 요건(`@ApiTags`, `@Public()`, DTO 위치 등)이 spec-draft side-effect 점검에서 누락 | spec-draft §변경 후 Side-effect 점검 | 해당 섹션에 "신규 컨트롤러 Swagger 데코레이터 — `spec/conventions/swagger.md` §2 준수 (developer plan에서 처리)" 한 줄 추가. |
| 6 | plan_coherence | followup Group D `CAFE24_INSTALL_LEGACY_PATH(410)` swagger 문서화 항목은 WARNING #3(레거시 핸들러 처리) 확정 후 유효성 재평가 필요 | `cafe24-pending-polish-followup.md` Group D | WARNING #3 해결 후 해당 항목 닫거나 수정. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec 파일 변경 범위 정확. OAuth 콜백 네임스페이스 분리 명시 권장 (INFO). |
| Rationale Continuity | LOW | 기존 "토큰 길이 단축 → 403 재통합" 문장이 새 결정과 텍스트 충돌 (WARNING). 32바이트 표현 각주 권장 (INFO). |
| Convention Compliance | LOW | `4-cafe24.md` 인라인 개정 blockquote 누적이 "latest state" 원칙 위반 (WARNING). Rationale·Swagger 명시 보완 권장 (INFO). |
| Plan Coherence | **MEDIUM** | V047 충돌·conventions 누락·레거시 경로 처리 불명확 3건 모두 developer Phase 2 착수 전 재검출 가능성. |
| Naming Collision | LOW | callback 경로 표기 혼재·OAuth 콘솔 이중 등록 미명시 (WARNING). conventions 및 V047은 plan_coherence와 중복, 병합 처리. |

---

## 권장 조치사항

> spec-draft를 `project-planner`가 `spec/`에 반영하기 전에 아래 순서로 처리한다.

1. **[WARNING #1] V047 충돌 해소** — spec-draft("추가 안 함")와 구현 plan("V047 추가")을 하나로 통일. spec-draft가 공식 결정이므로 spec-draft 방향으로 구현 plan 수정 후 Rationale에 근거 명시.

2. **[WARNING #2] `spec/conventions/` namespace 룰 결정** — spec-draft에 (a)/(b)/(c) 중 하나를 명시해 Phase 1 체크박스 완결 가능 상태로 만든다.

3. **[WARNING #3] 레거시 410 Gone 경로 방침 명시** — spec-draft 결정 표에 "즉시 제거 = 토큰 포함 경로만, 레거시 410 핸들러는 followup Group A에 위임" 문장 추가. 등록자 안내 가이드를 구현 plan 체크리스트에 기재.

4. **[WARNING #7] callback 경로 표기 통일** — 파라메트릭 단일 형식 vs. provider별 명시 형식 중 결정 후 spec-draft 전체 통일. (결정 후 WARNING #6 OAuth 콘솔 명시도 함께 처리)

5. **[WARNING #4] `4-cafe24.md` blockquote 제거** — 날짜 기반 개정 blockquote 제거, Rationale 섹션으로 이동.

6. **[WARNING #5] `spec/2-navigation/4-integration.md` Rationale 갱신 파일 목록 추가** — "토큰 길이 단축 → 403 재통합" 조건 문구를 "96-bit 미만으로의 단축, PRNG 변경, install_token 노출 사고"로 한정하는 갱신을 변경 범위에 포함.

7. **[INFO 1~5] 권장 보완** — spec 반영 후 Rationale 각주·OAuth 콜백 주석·Swagger 체크리스트를 순차적으로 보완. `grep -r "integrations/oauth" spec/data-flow/`로 잔여 참조 최종 확인.