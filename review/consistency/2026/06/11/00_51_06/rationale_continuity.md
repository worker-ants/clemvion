# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/` (diff-base: origin/main)
검토 모드: 구현 완료 후 검토 (--impl-done)
실제 변경 파일: `spec/2-navigation/4-integration.md`

---

## 발견사항

### [INFO] `cafe24` passive 알림 정책 기술 방향 반전 — 새 Rationale 동반 작성 확인

- **target 위치**: `spec/2-navigation/4-integration.md` §11 본문 cafe24 주석, §11.1 `connected-expiry` 표, `## Rationale` > `refresh 실패 시 status_reason 통일` 항 마지막 단락
- **과거 결정 출처**: `spec/2-navigation/4-integration.md ## Rationale` > `refresh 실패 시 status_reason 통일` (origin/main 기준) 마지막 단락: `"알림 정책 (§11.2): integration_expired 알림은 expired 전이 중에서도 token_expired 경로에만 발사. ... error(*) 전이는 별도 알림 없이 UI 배지로만 통지. 향후 별도 알림 타입 필요 시 integration_action_required 등 신설 검토."`
- **상세**: origin/main 의 해당 Rationale 항목 끝에 `error(*)` 전이는 "UI 배지로만" 통지하고 `integration_action_required` 는 "신설 검토" 단계라고 기술되어 있었다. 이번 변경은 `error(auth_failed/insufficient_scope/network)` 전이를 active `integration_action_required` 알림으로 통지하는 것을 **결정·구현 완료**로 확정하고 본문에도 반영했다. 변경 자체는 Rationale 내에 "passive/active 분리 원칙으로 결정·구현 완료" 라고 명시하여 번복 사실을 기록했으므로, 무근거 번복은 아니다. 단, origin/main 의 "신설 검토" 문구가 완전히 교체되고 기각된 "UI 배지 전용" 대안에 대한 구체적 기각 이유가 Rationale 에 별도 기술되지는 않았다.
- **제안**: 현 상태로 Rationale 연속성이 큰 위협을 주지는 않는다. 필요 시 `error(*) 전이에 별도 알림 없는 UI 배지 전용 방식을 기각한 이유` (예: "사용자 action 이 필요한 상태임에도 능동 알림이 없어 UX 누락") 를 한 줄 추가하면 완전해진다.

---

### [INFO] `isRefreshCapable` makeshop 포함 — 새 Rationale 항 추가 확인

- **target 위치**: `spec/2-navigation/4-integration.md ## Rationale` > `isRefreshCapable — makeshop 포함 결정` (신규 추가 항)
- **과거 결정 출처**: origin/main 의 §11.1 `connected-expiry` 표: `remain ≤ 0d` 분기를 `service_type='cafe24' AND credentials.refresh_token 존재` 조건만으로 처리하고 있어, makeshop 은 refresh-capable 범주에 명시적으로 포함되지 않았다.
- **상세**: 기존 spec 은 makeshop 의 0d 만료 분기를 정의하지 않았고 사실상 `else` 분기(→ `status=expired` 격하)에 귀속될 수 있는 상태였다. 이번 변경은 makeshop 을 명시적으로 `isRefreshCapable` 에 포함시키는 새로운 결정을 내리면서, 신규 Rationale 항 `isRefreshCapable — makeshop 포함 결정` 에 (a) 거짓양성 격하 방지, (b) makeshop 배경 큐 불필요 이유, (기각 대안) makeshop 을 expired 격하 유지 방식은 왜 기각했는지를 함께 기술했다. 결정·근거·기각 대안이 모두 작성되어 Rationale 연속성 요건을 충족한다.
- **제안**: 이상 없음.

---

### [INFO] `unknown` → `unknown_error` 에러 코드 변경 — Rationale 미기록

- **target 위치**: `spec/2-navigation/4-integration.md §5.4 PostgreSQL` 섹션: `error.code` 정규화 값 `unknown` → `unknown_error` 로 변경
- **과거 결정 출처**: origin/main 동일 위치에 `auth_failed`, `network`, `unknown` 세 값을 정규화 코드로 명시.
- **상세**: `unknown` → `unknown_error` 로 코드 문자열이 변경됐다. 이는 에러 코드 계약 변경(API surface 변경)에 해당하나, 변경 근거가 본 문서의 Rationale 에 기록되지 않았다. 클라이언트나 다른 spec 이 `unknown` 값을 직접 참조할 경우 silent breakage 가 될 수 있다. 다른 spec(예: `spec/5-system/`)에서 이 값을 참조하는지 별도 확인이 필요하다.
- **제안**: `## Rationale` 에 `PostgreSQL 에러 코드 unknown → unknown_error 변경` 항을 추가해 변경 이유(예: 다른 에러 코드와 네이밍 일관성, 기존 소비자 영향 여부)를 기록한다. 혹은 다른 spec 과의 영향이 없는 내부 변경임을 확인하고 INFO 수준으로 처리한다.

---

## 요약

`spec/2-navigation/4-integration.md` 의 이번 변경은 주로 `isRefreshCapable` 개념 도입(makeshop 포함), cafe24 passive 알림 정책 확정, `connected-expiry` 스캐너 로직 명세화로 구성된다. 가장 큰 결정인 `isRefreshCapable` makeshop 포함은 신규 Rationale 항에 기각 대안까지 포함해 충분히 기록했다. cafe24 의 `error(auth_failed)` active 알림 확정도 Rationale 기존 항의 마지막 단락을 갱신하는 형태로 기술했으므로 무근거 번복은 없다. 다만 origin/main 의 "`error(*)` 전이는 UI 배지 전용" 대안이 명시적으로 기각된 이유를 Rationale 에 한 줄 보충하면 이력이 완전해진다. `unknown` → `unknown_error` 에러 코드 변경은 작은 변경이지만 API surface 에 해당하므로 변경 근거 기록이 권장된다.

## 위험도

LOW
