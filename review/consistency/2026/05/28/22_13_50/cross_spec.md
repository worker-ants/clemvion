# Cross-Spec 일관성 검토 — Cafe24 nonce cache Redis 키 구성 설계 명문화 (INFO-6)

**Target**: `plan/in-progress/spec-draft-cafe24-nonce-key-design.md`
**대상 spec 변경 위치**: `spec/4-nodes/4-integration/4-cafe24.md §9.8`
**검토 일시**: 2026-05-28

---

## 발견사항

### [INFO] Nonce cache note 의 key 형식 표기와 draft 의 key 형식 표기가 경미하게 다름

- **target 위치**: draft §A "Nonce cache 보호 note 보강" — 추가 문장에서 key 형식을 `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac 앞 8자}` 로 표기
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` line 547 기존 note — key 형식을 명시하지 않음 (note 본문에 key 구조가 없음). 단, 코드 SoT (`cafe24-install-nonce-cache.service.ts` line 115) 에서 실제 key 는 `cafe24:install:nonce:{mallId}:{timestamp}:{hmacPrefix}` 이며 필드 이름이 `mallId` (camelCase) 와 `{mall_id}` (snake_case) 로 혼용됨
- **상세**: draft 가 spec note 에 추가하는 key 형식 문자열은 `{mall_id}` (snake_case 플레이스홀더) 를 사용한다. 기존 note 와 다른 spec 영역에서 `mall_id` 는 DB 컬럼명(`spec/1-data-model.md §2.10`)으로 snake_case 가 맞으므로 key 형식 표기상 일관성이 있다. 코드에서도 `params.mallId` → 문자열 `${params.mallId}` 로 runtime 값이므로 표기 차이는 없음. 실질 모순 없음.
- **제안**: draft 내용 그대로 진행해도 무방. 문서 내 플레이스홀더를 `{mall_id}` 로 표기하는 것은 기존 spec 전반의 DB 컬럼명 관례와 일치.

---

### [INFO] "base64 hmac(~44자)" 표현의 정확성

- **target 위치**: draft §A 추가 문장 — "base64 hmac(~44자) 전체 대신 앞 8자"
- **충돌 대상**: 코드 SoT (`verifyHmac` — `createHmac('sha256', ...).digest('base64')`) 및 기존 spec §9.8 HMAC 알고리즘 설명
- **상세**: SHA-256 출력은 32바이트. Node.js `Buffer.digest('base64')` 는 표준 base64 (패딩 포함) 로 인코딩하므로 `ceil(32/3)*4 = 44` 자. draft 의 "~44자" 는 정확하다. 기존 spec 다른 영역에서 Cafe24 hmac 길이를 다르게 기술하는 부분은 발견되지 않았음. 모순 없음.

---

### [INFO] "관련 코드 상수" 표의 상수 이름 형식 — 코드 상수 이름 누락

- **target 위치**: draft §B — 표에 `nonce key hmac prefix 길이` 를 상수명으로 사용
- **충돌 대상**: 기존 "관련 코드 상수" 표 (`spec/4-nodes/4-integration/4-cafe24.md` line 555-557) — 기존 행 `RECOVERY_CANDIDATE_LIMIT` 은 실제 코드 상수 이름(식별자)을 상수명 컬럼에 기재
- **상세**: 기존 표에서 `RECOVERY_CANDIDATE_LIMIT` 은 코드에서 리터럴로 식별 가능한 상수명이다. 반면 draft 가 추가하는 `nonce key hmac prefix 길이` 는 자연어 설명이지 코드 식별자가 아니다. 코드(`buildKey` 메서드)에서 hmac prefix 길이(`8`)는 명명된 상수로 추출되어 있지 않고 리터럴 `8`로 하드코딩되어 있다 (`params.hmac.slice(0, 8)`). 표의 "상수명" 컬럼 관례와 격차가 있으나, draft 이 시점에서 코드 상수가 없음을 인정하고 값(`8`)을 기술하는 것은 INFO-6 의 취지(명문화)에 부합한다. 다만 독자가 "코드 상수" 표에서 코드 식별자를 기대할 수 있으므로, 상수명 컬럼을 자연어(`nonce key hmac prefix 길이`)로 두되 의미 컬럼에서 코드 파일/메서드 참조를 포함하는 것이 충분하다. 기존 표 관례와의 경미한 스타일 차이일 뿐 모순은 아님.
- **제안**: draft 의 "상수명" 컬럼을 `` `nonce key hmac prefix 길이` `` 대신 `` `hmac prefix length` (코드 리터럴: `8`) `` 또는 유사한 형식으로 기재하면 기존 표 관례("코드 상수 이름 또는 매직 넘버 식별")와 더 자연스럽게 정합되나, 필수 수정 사항이 아님.

---

### [INFO] TTL 수치와 기존 spec 기술의 일치 여부

- **target 위치**: draft §A — "10분 TTL" 언급 (기존 note 에서 이미 기술됨)
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` line 547 기존 note — "Redis 에 10분 TTL 로 기록"
- **상세**: draft 는 기존 note 에 문장을 추가하는 것이므로 TTL 값이 달리 기술되는 충돌은 없음. 코드 (`Cafe24InstallNonceCache.TTL_SEC = 10 * 60 = 600`) 와도 일치. 충돌 없음.

---

### [INFO] 충돌 확률 근거의 수식 표기 차이

- **target 위치**: draft §A 추가 문장 — "약 2.8e14 공간"
- **충돌 대상**: 코드 주석 (`cafe24-install-nonce-cache.service.ts` line 22) — "64^8 = 2.8e14", line 113 — "6비트 정보, 8자 = 48비트 = ~2.8e14 공간"
- **상세**: draft 는 "48bit, 약 2.8e14 공간" 으로 두 수치를 함께 표기한다. 코드 주석의 "64^8" 표현도 정확하다(base64 알파벳 64가지 × 8자리 = 2^48 = 281,474,976,710,656 ≈ 2.8e14). 수치 자체의 모순은 없음. draft 는 "48bit" 와 "2.8e14" 를 병기하므로 독자가 더 명확하게 이해할 수 있어 코드 주석보다 상세하다. 기존 spec 의 다른 부분에서 동일 수치를 다르게 기술하는 곳은 없음. 충돌 없음.

---

## 요약

이번 draft 는 `spec/4-nodes/4-integration/4-cafe24.md §9.8` 의 Nonce cache 보호 note 와 "관련 코드 상수" 표에 hmac prefix 8자 설계를 명문화하는 순수 additive 변경이다. 코드 SoT (`Cafe24InstallNonceCache.buildKey`) 와 일치하며 다른 spec 영역(데이터 모델, API 계약, RBAC, 상태 머신)과의 직접 충돌은 발견되지 않는다. 발견된 INFO 항목은 모두 표기 스타일·자연어 선택의 경미한 차이이며 채택을 차단하는 모순이 아니다. 요구사항 ID 는 새로 부여되지 않으므로 ID 충돌도 없다. draft 를 그대로 적용해도 무방하며, "관련 코드 상수" 표의 상수명 컬럼 스타일(자연어 vs 코드 식별자)을 정비하면 기존 표 관례와 더 자연스럽게 정합된다.

## 위험도

NONE
