# Rationale 연속성 검토 결과

검토 모드: `--spec`
대상 문서: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `bearer_token` 자동 발급 강제 — 기존 "사용자 입력" 옵션 제거의 Rationale 부재
  - target 위치: target §1 `spec/1-data-model.md §2.17.1` + target §4.2 `spec/2-navigation/6-config.md §A.2 Bearer Token sub-section`
  - 과거 결정 출처: `spec/2-navigation/6-config.md` 본문 line 52 — "Token: 자동 생성 **또는 사용자 입력**" (현재 명세)
  - 상세: 현재 `6-config.md` 는 Bearer Token 에 "자동 생성 또는 사용자 입력" 을 모두 허용하는 명세를 담고 있다. target 은 이 옵션을 "자동 발급만" 으로 좁히면서, 이유를 target §1 내 `§2.17 Rationale 추가` 항에 "엔트로피·형식 검증 부담" 과 "일관성" 으로 서술했다. 이것은 번복에 해당하지만, 기각 근거가 target 문서의 **draft 내부 Rationale 추가 항**에만 기술되어 있고, 정식 spec `6-config.md ## Rationale` 에 반영되는 경로가 명시되어 있지 않다. `6-config.md` 에 현재 Rationale 섹션(`R-1`)은 LLM 모델 select-only 변경에만 해당하며, Bearer Token 사용자 입력 제거에 대한 별도 항목은 없다. 번복 사실은 인지됐으나 정식 spec Rationale 갱신 명세가 빠졌다.
  - 제안: target §4.2 에 "spec/2-navigation/6-config.md ## Rationale 에 R-N. bearer_token 자동 발급 강제 항목 추가" 를 명시적으로 포함. 혹은 §Spec 변경 파일 목록에 `6-config.md Rationale` 갱신을 별도 항으로 나열.

---

### 발견사항 2

- **[WARNING]** `bearer_token` 만료 시간 옵션 삭제 — 기존 명세와의 충돌, Rationale 미기록
  - target 위치: target §4.2 "만료 시간 (선택) 행 삭제"
  - 과거 결정 출처: `spec/2-navigation/6-config.md` 본문 line 53 — "만료 시간: 토큰 유효 기간 설정 (선택)"
  - 상세: 현재 spec 은 bearer_token 에 대해 선택적 만료 시간 필드를 명시하고 있다. target 은 이를 "본 PR 은 토큰 만료·rotation 을 다루지 않음 (out-of-scope)" 이라는 한 줄로 제거한다. out-of-scope 판단 자체는 합당하나, 이 결정의 근거가 Rationale 항목으로 spec 에 기록되지 않으면 향후 검토자가 만료 시간을 다시 도입하려 할 때 왜 제거됐는지 추적 불가. 발견사항 1과 동일한 패턴 — 번복은 있으나 정식 Rationale 기록 경로 부재.
  - 제안: `spec/2-navigation/6-config.md ## Rationale` 에 "만료 시간 필드 v1 제외" 항목 추가 필요를 target 에 명시.

---

### 발견사항 3

- **[INFO]** `spec/1-data-model.md §2.17` 의 `none` 타입 부재 — 이미 존재하지 않는 항목 제거 서술
  - target 위치: target §1 "type 행 갱신 — `none` 제거" + target Rationale 추가 항 "none 제거 (I-5/W-12 반영)"
  - 과거 결정 출처: `spec/1-data-model.md §2.17` line 521 — `type | Enum | api_key / bearer_token / basic_auth` (현재 명세에 `none` 없음)
  - 상세: 현재 `spec/1-data-model.md §2.17` 의 `type` Enum 은 이미 `api_key / bearer_token / basic_auth` 세 값만 정의하며 `none` 이 포함되어 있지 않다. target 이 "none 제거" 를 변경 사항으로 기술하고 있으나 실제로는 현재 spec 에 `none` 이 없어 제거 대상 자체가 부재하다. `none` 이 포함된 것은 `spec/5-system/12-webhook.md §2.2` 의 config JSON 예시 (`"authType": "none"`) 에만 남아 있는 inline 필드다. target §1 의 Rationale 추가 항은 이 혼동을 정리하는 의미에서 가치 있으나, "none 제거" 표현이 데이터 모델 변경인 것처럼 오인될 수 있으므로 명확한 표현으로 정정 권장 ("AuthConfig.type 에는 원래 `none` 미포함 — inline trigger.config 의 `authType='none'` 을 AuthConfig IS NULL 로 대체" 로 서술 보완).
  - 제안: target §1 에서 "none 제거" 대신 "AuthConfig.type 정의 확인 (기존 미포함) + webhook inline `authType='none'` 경로의 `auth_config_id IS NULL` 로의 의미 이관" 으로 표현 명확화.

---

### 발견사항 4

- **[WARNING]** `spec/2-navigation/2-trigger-list.md` R-2 번복 — target 의 R-14 에서 명시적으로 처리했으나 `R-2 TBD` 의 EIA 합의 전제 충족 여부 불명확
  - target 위치: target §5.4 "R-14. authConfigId v1 격상 (2026-05-28)"
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md Rationale R-2` — "v1.1 rotate 의 응답 shape (신규 secret 평문 반환 vs masked digest), grace 기간 (24h 표준 vs 가변), 경로 세그먼트 (`/auth/` vs `/webhook-auth/`) 는 본 spec PR 에서 확정하지 않는다. `plan/in-progress/eia-secret-rotation-revoke-api.md` 가 EIA outbound notification secret 의 rotate 응답 형식을 먼저 합의하면 본 spec 의 v1.1 행도 동일 패턴을 차용한다."
  - 상세: R-2 는 `eia-secret-rotation-revoke-api.md` 합의를 선행 조건으로 명시하고 있다. target §5.4 의 R-14 는 "R-2 TBD … 를 번복" 한다고 명시하며 번복 근거도 제공한다. 그러나 R-2 의 선행 조건인 EIA rotate 합의가 완료됐는지, 아니면 미완인 채로 authConfigId v1 격상만 이루어졌는지가 불명확하다. `plan/in-progress/eia-secret-rotation-revoke-api.md` 의 상태 확인 없이 R-2 의 TBD 블록을 해제하면 EIA 와의 rotate 패턴 정합이 이후에 분리될 위험이 있다. target §5.2 에서 `/auth/rotate-secret` 예약 행 자체를 제거하여 "이 endpoint 자체를 없앰" 으로 처리하고 있어 R-2 의 EIA 연계 전제가 사실상 해소됐다고 볼 수 있으나, 이 해소 논리가 target Rationale R-14 에 명시되어 있지 않다.
  - 제안: target §5.4 R-14 에 "R-2 의 EIA 선행 합의 조건은, `/auth/rotate-secret` 예약 행 자체 삭제 (§5.2 C-5) 로 해당 endpoint 가 존재하지 않게 됨으로써 무효화됨" 을 한 문장 추가.

---

### 발견사항 5

- **[INFO]** `spec/data-flow/10-triggers.md §1.2` 기존 `ip_whitelist OR auth_config_id` 분기 — Rationale 문서화 부재
  - target 위치: target §6.1 "C-3 반영"
  - 과거 결정 출처: `spec/data-flow/10-triggers.md` 현재 line 59 — `alt auth_config_id 설정 OR ip_whitelist` 분기
  - 상세: 현재 spec 의 `auth_config_id 설정 OR ip_whitelist` 분기 자체에 대한 Rationale 항목은 `10-triggers.md ## Rationale` 에 없다. target 이 이 분기를 `ip_whitelist 는 AuthConfig 종속이므로 auth_config_id IS NULL 경로에서 ip_whitelist 평가 불가` 로 정정하면서 C-3 핵심 설명을 target 본문에서 제공하고 있다. 이 정정 근거는 target 내 inline 설명으로만 존재하고 정식 spec 파일 `10-triggers.md ## Rationale` 에 반영 계획이 없다. 기존 분기의 오류 배경·정정 사유가 spec Rationale 에 남지 않으면 이후 동일 오해가 재발할 수 있다.
  - 제안: target §6.1 에 `spec/data-flow/10-triggers.md ## Rationale` 에 "ip_whitelist 는 AuthConfig 종속 — auth_config_id IS NULL 경로에서 ip_whitelist 단독 시행 불가" 를 신규 항으로 추가하는 지시를 포함.

---

### 발견사항 6

- **[INFO]** `spec/conventions/secret-store.md` 의 `auth-configs` scope 예시 — "향후 확장 여지" 표현의 모호성
  - target 위치: target §7.1 `spec/conventions/secret-store.md §1` 비대상 명시
  - 과거 결정 출처: `spec/conventions/secret-store.md §1` URI Scheme 표 — scope 예시에 `auth-configs` 를 이미 포함 (line 23)
  - 상세: `secret-store.md §1` 의 scope 예시 (`triggers`, `auth-configs`, `oauth-clients`) 에 `auth-configs` 가 포함되어 있어 reader 에게 "auth-configs 가 현재 secret-store 사용처" 로 오인 가능성이 있었다. target §7.1 이 "비대상" 임을 명시하는 방향은 합리적이다. 그러나 target 이 추가하는 한 줄 — "scope 예시의 `auth-configs` 는 향후 확장 여지일 뿐 현재 사용처 아님" — 만으로는 예시 표 자체에 `auth-configs` 가 그대로 남아 있는 한 혼란이 지속된다. secret-store.md 의 Rationale R2 ("URI scheme 의 `<scope>` 분리 — 향후 다른 도메인 자원도 같은 store 공유 가능") 는 예시에 `auth-configs` 를 두는 것이 의도적임을 뒷받침하므로 Rationale 충돌은 아니지만, 비대상 명시와 예시 표 존재의 긴장은 남는다.
  - 제안: `secret-store.md §1` 예시 표에서 `auth-configs` 를 "(향후 확장 예정, 현재 미사용)" 주석으로 표기하거나, 비대상 명시 문장에 "예시 표의 auth-configs 는 미래 예약 항목으로 현재 구현 없음" 으로 명확화.

---

### 발견사항 7

- **[INFO]** `spec/5-system/1-auth.md §4.1` 감사 로그 카테고리 — 기존 `auth_config.*` 와 신규 `auth_config.reveal` 의 관계
  - target 위치: target §3.3 "`auth_config.*` → `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal`"
  - 과거 결정 출처: `spec/5-system/1-auth.md §4.1` line 328 — "설정 | `auth_config.*`, `llm_config.*`"
  - 상세: 기존 spec 은 `auth_config.*` 와일드카드로 모든 auth_config 액션을 포괄하고 있어, target 이 `auth_config.reveal` 을 추가하는 것은 명시적 열거로의 전환이다. 이 자체는 합의 원칙 위반이 아니나, 와일드카드를 명시적 열거로 교체하면서 기존의 다른 action (`auth_config.regenerate` 등) 이 원래 `auth_config.*` 에 포함됐는지 여부가 불명확해진다. 열거가 exhaustive 인지, `auth_config.*` 의 잔여 항목이 있는지에 대한 서술이 없다.
  - 제안: target §3.3 에 "위 열거가 exhaustive — `auth_config.*` 와일드카드를 대체함" 을 명시하거나, 와일드카드를 유지하고 `auth_config.reveal` 만 주석으로 추가.

---

## 요약

target 문서는 전반적으로 Rationale 연속성을 잘 유지하고 있다. 핵심 결정들 — authConfigId v1 격상(R-14), inline auth path 폐지(R-A), `/auth/rotate-secret` 예약 행 제거(C-5), ip_whitelist AuthConfig 종속(C-3), 마스킹 정책 단일 진실(C-4 해소), `none` 타입 처리 — 은 모두 번복 근거 또는 과거 결정과의 정합 설명을 동반한다. 다만 두 건의 WARNING 이 존재한다: `bearer_token` 의 "자동 발급 전용" 강제와 "만료 시간 제거" 가 기존 `6-config.md` 명세를 번복하면서 정식 spec `## Rationale` 갱신 지시가 target 에 누락되어 있다. 또한 `2-trigger-list.md` R-2 의 EIA 선행 합의 조건이 어떻게 해소됐는지가 R-14 내에 명시되지 않아 추적이 불완전하다. 나머지 세 건은 INFO 수준 — 정합 강화 제안으로 차단 사유가 아니다.

---

## 위험도

MEDIUM
