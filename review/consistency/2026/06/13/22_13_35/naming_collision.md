# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`

---

## 발견사항

### 1. [INFO] Rationale §2.3.C — 신규 섹션 번호, 충돌 없음

- **target 신규 식별자**: `### 2.3.C — 비밀번호 변경 시 세션 revoke 범위`
- **기존 사용처**: `spec/5-system/1-auth.md` L568 `### 2.3.A`, L572 `### 2.3.B`
- **상세**: 기존에 2.3.A 와 2.3.B 가 사용 중이며, target 은 그 다음 번호 2.3.C 를 새로 도입한다. 번호 체계가 순차적이고 해당 번호는 현재 미사용이므로 충돌이 없다.
- **제안**: 충돌 없음. 추가 조치 불요.

---

### 2. [INFO] `session_revoked` — 기존 이벤트의 의미 확장 (충돌 아님)

- **target 신규 식별자**: `session_revoked` + `familyId=null` (bulk revoke 구분 표기)
- **기존 사용처**:
  - `spec/5-system/1-auth.md` L400: `| session_revoked | 사용자가 활성 세션 목록에서 다른 family 강제 종료 |`
  - `spec/data-flow/2-auth.md` L195: `INSERT login_history (event=session_revoked, family_id=:familyId)`
  - `spec/1-data-model.md` §2.18.2 LoginHistory.event enum
- **상세**: target 은 `session_revoked` enum 값 자체를 신규 도입하는 것이 아니라, 기존 값의 의미를 "강제 종료 **또는** 비밀번호 변경 트리거 bulk revoke"로 **확장**하는 것이다. target draft 의 Rationale 도 "확장하되 enum/스키마 변경은 없다(기존 event 재사용)"로 이를 명시한다. bulk case 의 구분은 `family_id=null` payload 로 표현하므로 기존 단건 revoke (`family_id=<uuid>`) 와 충돌하지 않는다.
- **제안**: 충돌 없음. 다만 spec §4.3 본문 갱신 시 `family_id=null` 이 DB 컬럼의 nullable 의미(`login_history.family_id UUID?`)와 일치하는지 data-flow §1.1 / §2 에서 함께 확인할 것을 권고한다.

---

### 3. [INFO] `ipAddress` 동반 표기 확장 — auth_config 패턴과 동일 키 재사용 (충돌 없음)

- **target 신규 식별자**: `user.*` 행에 `ipAddress` 동반 명시 (`data-flow/1-audit.md §1.1`)
- **기존 사용처**:
  - `spec/data-flow/1-audit.md` L36: `record({..., ipAddress?})` — 이미 optional 필드로 정의
  - `spec/data-flow/1-audit.md` L59: `auth_config 계열은 모두 ipAddress 를 함께 전달`
- **상세**: `ipAddress` 는 이미 `AuditLogsService.record()` 시그니처의 기존 optional 필드다. target 은 이 기존 필드를 `user.*` 경로에도 전달하도록 기존 표에 표기를 추가하는 것으로, 새 식별자 도입이 아니다. `extractClientIp` 함수명(`auth/utils/client-ip.ts`)과 `TRUST_CF_CONNECTING_IP` env var 도 기존 spec(`1-auth.md` §2.3, Rationale 2.3.B)에 이미 정의되어 있다.
- **제안**: 충돌 없음. 추가 조치 불요.

---

### 4. [INFO] `revokeOtherFamilies` — 신규 명세 서비스 메서드명 (코드 충돌 확인 필요)

- **target 신규 식별자**: `SessionsService.revokeOtherFamilies` (spec 본문에서 재사용 근거로 명시)
- **기존 사용처**: `spec/data-flow/2-auth.md` L199: `POST sessions/revoke-others` (컨트롤러 레벨 엔드포인트로 간접 언급됨)
- **상세**: `revokeOtherFamilies` 는 spec 상 새로 명명되는 메서드가 아니라 기존 구현의 서비스 레이어 이름을 Rationale 에서 참조하는 것이다. spec 본문 내 식별자 충돌은 없다. 그러나 target 이 "기존 `SessionsService.revokeOtherFamilies`(현재 family 제외 bulk revoke + `session_revoked` 기록)를 그대로 재사용"한다고 기술하므로, 실제 codebase 에 동일 이름의 메서드가 존재하는지는 구현 단계에서 확인해야 한다.
- **제안**: spec 식별자 충돌은 없음. 구현 착수 시 `SessionsService` 에 해당 메서드가 실재하는지 점검 권고.

---

## 요약

target(`plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`)이 도입하는 식별자는 모두 기존 네임스페이스와 안전하게 공존한다. `session_revoked` 는 기존 enum 값의 의미 확장이고, Rationale `2.3.C` 는 순차적 신규 번호, `ipAddress` 는 기존 optional 필드의 사용처 확장, `revokeOtherFamilies` 는 기존 구현 메서드 참조다. 신규 식별자가 다른 의미로 이미 점유된 사례는 존재하지 않는다.

## 위험도

NONE
