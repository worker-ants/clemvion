# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
검토일: 2026-05-28

---

## 발견사항

### [WARNING] `spec/data-flow/10-triggers.md` §1.2 의 응답 코드와 ip_whitelist 조건 — target §6.1 과 정합이 필요
- **target 위치**: §6.1 "§1.2 Webhook 진입 sequence — 인증 분기 재작성"
- **충돌 대상**: `spec/data-flow/10-triggers.md` line 59–69
- **상세**:
  - target 은 `data-flow/10-triggers.md §1.2` 의 응답 코드를 `200 → 202` 로 정정한다고 명시한다. 실제 `12-webhook.md §3.1` 에는 이미 WH-RS-01 (`202 Accepted`) 이 정의되어 있고 `12-webhook.md §3.2 응답` 에도 `202 Accepted` 가 기술되어 있다. 따라서 `data-flow/10-triggers.md` line 69의 `200 { executionId }` 는 기존 webhook spec 과 이미 불일치 상태다.
  - 또한 `data-flow/10-triggers.md` line 59 에는 `alt auth_config_id 설정 OR ip_whitelist` 라고 기술되어, `ip_whitelist` 가 `auth_config_id` 없이도 독립적으로 평가되는 것처럼 보인다. target 의 C-3 해소 논리에 따르면 `ip_whitelist` 는 `AuthConfig` 종속이므로 `auth_config_id IS NOT NULL` 일 때만 평가 가능하다. 이 두 불일치는 target 이 §6.1 에서 고치겠다고 명시하지만, 실제 spec 파일에 기재될 새 표현이 `12-webhook.md §2.7 (step 6)` 의 처리 흐름 기술과 일관되어야 한다.
- **제안**: `data-flow/10-triggers.md §1.2` 의 시퀀스 다이어그램에서 (a) `200 → 202` 정정, (b) `OR ip_whitelist` 조건 제거, (c) `last_used_at` fire-and-forget UPDATE 단계 추가를 target spec 갱신 시 함께 반영한다. target 은 이미 §6 에서 해당 갱신을 명시하고 있으므로 실제 파일 수정 시 빠짐없이 반영되었는지 확인 필요.

---

### [WARNING] `spec/data-flow/10-triggers.md` §2.1 Postgres 표 — `auth_config` 행에 `is_active`·`last_used_at` 누락
- **target 위치**: §6.2 "§2.1 Postgres 표 — auth_config 행"
- **충돌 대상**: `spec/data-flow/10-triggers.md` line 120
- **상세**: 현행 `data-flow/10-triggers.md` §2.1 의 `auth_config` 행은 `SELECT type, config (decrypted), ip_whitelist` 만 나열한다. target 은 `is_active` 조회와 `last_used_at` UPDATE (write) 를 별도 행으로 추가하겠다고 기술한다. target 의 표(§6.2)는 기존 SELECT 행에 `is_active` 를 추가하고 UPDATE 행을 신설하므로, 기존 행의 `read/write 컬럼` 열을 덮어쓰는 형태가 된다. 기존 행 보존 + 신규 행 추가라는 target 의 기술이 기존 `SELECT` 행의 컬럼 목록을 어디까지 수정하는지 명확히 기재되어 있지 않아 실제 작성 시 혼선 여지가 있다.
- **제안**: 실제 `data-flow/10-triggers.md §2.1` 갱신 시, 기존 행의 컬럼 목록을 `SELECT type, config (decrypted), ip_whitelist, is_active` 로 수정하는 것과 `last_used_at` UPDATE 행 신설을 명확히 분리하여 작성한다.

---

### [WARNING] `spec/2-navigation/6-config.md §A.2` Bearer Token 표 — "만료 시간 (선택)" 필드가 현행 spec 에 존재
- **target 위치**: §4.2 "§A.2 — Bearer Token sub-section 정리"
- **충돌 대상**: `spec/2-navigation/6-config.md §A.2 Bearer Token` (line 52–54)
- **상세**: 현행 `6-config.md §A.2` 에는 Bearer Token 필드로 "Token: 자동 생성 또는 사용자 입력"과 "만료 시간 (선택)" 두 행이 있다. target 은 "사용자 입력" 옵션 제거 + "만료 시간 (선택)" 행 삭제를 지시한다. 이 삭제는 `spec/1-data-model.md §2.17.1` 의 bearer_token JSONB 스키마 `{ token: string }` 과 정합(만료 필드 없음)을 맞추는 올바른 방향이나, `6-config.md §A.3 인증 사용량/이력` 의 "호출 이력 테이블 (시각, 소스 IP, 대상 트리거, 응답 코드)" 은 만료 시간을 전제하지 않으므로 별 충돌 없음. 다만 삭제 후 Bearer Token 에 `IP Whitelist` 필드가 포함되어야 하는지 target 이 명시하지 않는다 — API Key sub-section 에는 IP Whitelist 가 있고 HMAC 에도 신규 추가되지만, Bearer Token sub-section 갱신안(§4.2)에는 IP Whitelist 행이 언급되지 않는다. `ip_whitelist` 는 모든 type 공통이므로(§4.1 HMAC 표에도 "IP Whitelist | 허용 IP (선택, 모든 type 공통)") Bearer Token 표에서도 명시가 일관성 측면에서 권장된다.
- **제안**: `6-config.md §A.2 Bearer Token` 갱신 시 IP Whitelist 행을 명시적으로 포함하거나, 공통 필드 섹션을 별도 정리해 중복을 방지한다.

---

### [WARNING] `spec/5-system/1-auth.md §4.1` 감사 로그 카테고리 — `auth_config.reveal` 및 `auth_config.regenerate` 누락
- **target 위치**: §3.3 "§4.1 감사 로그 카테고리"
- **충돌 대상**: `spec/5-system/1-auth.md` line 328 (현행 `auth_config.*`)
- **상세**: 현행 `1-auth.md §4.1` 의 "설정" 카테고리는 `auth_config.*, llm_config.*` 로 와일드카드 표기한다. target 은 이를 `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal, llm_config.*` 로 구체화한다. 이 변경은 기존 와일드카드 포함 범위를 좁히거나 일치시키는 것이므로 논리적 충돌은 없으나, `data-flow/1-audit.md §1.1` 에서 action naming 패턴 `<resource>.<verb>` 를 자유 문자열로 정의하고 있어 신규 액션 타입 추가가 마이그레이션 없이 가능하다. target 이 지시하는 동시 갱신 대상(`data-flow/1-audit.md` — §3.3에서 언급)이 실제 `data-flow/1-audit.md` 에는 동일 카테고리 목록이 존재하지 않아 (해당 파일은 action naming 원칙만 기술), `1-auth.md §4.1` 단일 위치가 SoT 임이 확인된다. 이 점에서 target 의 "spec/data-flow/1-audit.md 도 cross-check 갱신" 지시는 실제 파일을 확인하면 추가 수정 대상이 없음을 뜻한다.
- **제안**: 실제 `data-flow/1-audit.md` 파일 내에는 action 목록이 없으므로, `1-auth.md §4.1` 만 갱신하면 충분하다. Side-effect 영향 영역에서 `spec/data-flow/1-audit.md (← audit.md 오기 정정)` 의 갱신 지시는 파일 실제 내용과 대조 후 불필요한 수정으로 판명될 가능성이 있음을 확인한다.

---

### [WARNING] `spec/2-navigation/2-trigger-list.md §3` PATCH body 키 목록 — `config.hmacAlgorithm` 제거 누락
- **target 위치**: §5.3 "§3 PATCH 노트 정리"
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md` line 138
- **상세**: 현행 `2-trigger-list.md §3` 의 PATCH body deep-merge 키 목록에는 `config.authType`, `config.hmacHeader`, `config.hmacSecret`, `config.bearerToken` 이 포함되어 있다. target §5.3 은 이 4개를 제거한다고 명시하지만, 현행 line 138 의 PATCH 목록에는 `config.hmacAlgorithm` 도 명시적으로 나열되어 있지 않다 — 실제 현행 spec 을 확인하면 `hmacAlgorithm` 은 PATCH 키 목록에는 없어 별도 제거 필요 없음. 다만 line 138 의 기존 나열에 `config.hmacSecret` 는 `hmacSecret` 으로, `config.bearerToken` 은 `bearerToken` 으로 표기되어 있어 target 이 제거 대상으로 나열한 필드명과 대소문자·접두 규칙이 일치하는지 확인이 필요하다.
- **제안**: 실제 `2-trigger-list.md §3` 갱신 시 현행 line 138 의 정확한 필드명을 참조해 일치하는 항목만 제거하고, `authConfigId` 를 top-level PATCH 가능 키로 명시 추가 시 기존 나열 순서와 포맷을 통일한다.

---

### [INFO] `spec/2-navigation/6-config.md §A.2` HMAC sub-section — 기존 Basic Auth 표와 `IP Whitelist` 필드 일관성
- **target 위치**: §4.1, §4.3
- **충돌 대상**: `spec/2-navigation/6-config.md §A.2 Basic Auth` (line 56–61)
- **상세**: 현행 Basic Auth 표에는 IP Whitelist 가 없다. target §4.3 에서 Basic Auth UI 를 보강하면서도 IP Whitelist 명시가 없다. HMAC sub-section (§4.1) 에는 `IP Whitelist | 허용 IP (선택, 모든 type 공통)` 가 포함된다. "모든 type 공통" 이라는 표현이 있으므로, Basic Auth 표에도 동일 행을 추가하거나 공통 필드 설명을 별도 단락으로 분리하는 것이 UI 명세 일관성에 기여한다.
- **제안**: `6-config.md §A.2` 의 기존 API Key·Bearer Token·Basic Auth 표에 `IP Whitelist` 행을 일관되게 추가하거나, "모든 type 에 공통 적용되는 필드" 별도 단락 후 각 type 표에는 제외하는 방식 중 하나를 선택한다.

---

### [INFO] `spec/conventions/secret-store.md §1` — `auth-configs` 스코프 예시 이미 존재
- **target 위치**: §7.1 "§1 URI Scheme — AuthConfig 비대상 명시"
- **충돌 대상**: `spec/conventions/secret-store.md` line 23
- **상세**: 현행 `secret-store.md §1` 표의 `scope` 설명에 이미 `auth-configs` 가 예시로 등장한다 (`lower-case kebab-case (예: triggers, auth-configs, oauth-clients)`). target §7.1 에서 "scope 예시의 auth-configs 는 향후 확장 여지일 뿐 현재 사용처 아님"을 명시하겠다는 계획이 있어 이는 기존 spec 과 모순이 아니라 보완이다. 그러나 해당 예시를 제거하지 않고 비대상 명시만 추가하는 것이므로, 독자가 예시를 실제 사용 중인 것으로 오인할 가능성이 약간 있다.
- **제안**: `secret-store.md §1` 의 `scope` 예시에서 `auth-configs` 를 괄호 안에 `(현재 미사용, 향후 확장 여지)` 주석으로 표기하거나, §7.1 에서 추가하는 "비대상" 문장에 해당 예시를 직접 참조하면 더욱 명확하다.

---

### [INFO] `spec/5-system/12-webhook.md` §7 처리 흐름 step 번호 — §2.7 의 "C-3 반영" step 6 과 현행 §7 step 번호 정합
- **target 위치**: §2.7 "§7 처리 흐름 step 6 재작성"
- **충돌 대상**: `spec/5-system/12-webhook.md` §7 (현행 처리 흐름)
- **상세**: target 은 현행 `12-webhook.md §7` 의 step 6 을 "인증 검증" 단계로 재작성한다. 현행 `12-webhook.md` 의 처리 흐름(line 302–322)에서 step 번호 6은 "인증 검증" (config.authType 분기) 에 실제로 해당하므로 target 이 의도한 위치와 일치한다. 다만 현행 step 6 (`a. config.authType === 'none' → 통과`)이 완전히 대체되는 것이므로, "step 6 재작성" 이라는 표현이 기존 step 6 만 변경하는 것인지 sub-step 전체를 교체하는 것인지 명확히 해야 한다.
- **제안**: 실제 `12-webhook.md §7` 갱신 시 기존 step 6 전체(a–d 포함)를 target §2.7 의 a–g 로 완전 대체함을 명시한다.

---

### [INFO] `spec/2-navigation/2-trigger-list.md` — `plan/in-progress/trigger-drawer-tests.md` 케이스 6번 미해결 의존성 언급
- **target 위치**: §5.4 Rationale R-14, Side-effect 영향 영역 (W-10)
- **충돌 대상**: `plan/in-progress/trigger-drawer-tests.md` (케이스 6번)
- **상세**: target 은 `trigger-drawer-tests.md` 케이스 6번을 developer Phase 5 에서 처리한다고 명시한다. 이는 plan 간 의존성 언급이며 spec 충돌이 아니다. 다만 해당 plan 파일이 spec 과 연관된 테스트 케이스를 포함하므로, spec 갱신 후 plan 업데이트가 누락되면 테스트 케이스가 deprecated 된 authType 기준으로 남게 되어 혼선이 발생할 수 있다.
- **제안**: developer Phase 착수 전에 `trigger-drawer-tests.md` 케이스 6번을 `AuthConfig.type selector` 기준으로 갱신한다. 이를 plan 의 명시적 Phase 항목으로 등재되어 있는지 확인한다.

---

## 요약

target 문서(v2)는 이전 consistency-check 에서 식별된 CRITICAL 5건·WARNING 13건을 대부분 해소하고, 기존 spec 영역들과의 주요 모순을 제거한 방향으로 정리되었다. 잔존하는 발견사항은 모두 WARNING 또는 INFO 등급이며, 대부분 `data-flow/10-triggers.md` 의 기존 불일치(응답 코드 200 대신 202, `ip_whitelist` 독립 조건)를 target 이 명시적으로 고치겠다고 선언하고 있어 실제 파일 갱신 단계에서 반영이 필요한 사항들이다. `Integration.auth_type='none'` 과 `AuthConfig.type` 에서 `none` 을 제거하는 결정이 두 엔티티의 의미 차이(Integration 은 자격증명 불요 MCP 공용 서버, AuthConfig 는 row 자체 부재)를 명확히 구분하여 기술하고 있으므로 데이터 모델 충돌은 없다. WH-SC-01~05 의 기존 ID 의미가 보존되고 cross-ref(15-chat-channel.md §408의 WH-SC-04, §298의 WH-SC-02)와 일치하므로 요구사항 ID 충돌도 없다. `secret-store.md §1` 의 `auth-configs` 스코프 예시와 target §7.1 의 "비대상" 선언 간 표현 정합을 실제 파일 작성 시 보완하면 된다. 전반적으로 spec 채택에 구조적 장벽은 없으며, 위 WARNING 항목들을 실제 파일 수정 시 빠짐없이 반영하면 일관성이 확보된다.

---

## 위험도

LOW

STATUS: OK
