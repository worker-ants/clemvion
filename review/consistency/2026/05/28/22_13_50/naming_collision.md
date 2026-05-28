# 신규 식별자 충돌 검토 — spec-draft-cafe24-nonce-key-design.md

검토 일시: 2026-05-28
대상: `plan/in-progress/spec-draft-cafe24-nonce-key-design.md`
검색 코퍼스: `spec/`, `plan/in-progress/`, `spec/conventions/`

---

## 발견사항

충돌이 발견된 식별자가 없습니다. 각 점검 관점별 결과는 아래와 같습니다.

### 1. 요구사항 ID 충돌

- target 이 새로 부여하는 요구사항 ID 없음. INFO-6 은 plan 내부 체크박스 레이블로만
  사용되며(`plan/in-progress/cafe24-test-spec-guard-cleanup-followups.md:83`), target 이
  이 ID 를 spec 에 새로 기입하지 않는다.
- 결론: 충돌 없음.

### 2. 엔티티/타입명 충돌

- target 이 도입하는 유일한 엔티티 참조는 기존 `Cafe24InstallNonceCache`이며,
  이 이름은 이미 `spec/4-nodes/4-integration/4-cafe24.md:547` 의 Nonce cache 보호 note
  에서 동일 의미로 사용 중이다. target 은 이 이름을 새로 도입하는 것이 아니라
  기존 이름을 그대로 인용한다.
- 결론: 충돌 없음.

### 3. API endpoint 충돌

- target 은 API endpoint 를 신규 도입하지 않는다.
- 결론: 해당 없음.

### 4. 이벤트/메시지명 충돌

- target 은 이벤트·webhook·queue·SSE 이름을 신규 도입하지 않는다.
- 결론: 해당 없음.

### 5. 환경변수·설정키 충돌

- target 은 환경변수나 설정키를 신규 도입하지 않는다. 표에서 명시적으로
  "(코드 상수)" 로 표기하여 환경변수가 아님을 분명히 한다.
- 결론: 해당 없음.

### 6. 파일 경로 충돌

target 이 수정 대상으로 지목하는 파일은 기존에 이미 존재하는
`spec/4-nodes/4-integration/4-cafe24.md`(§9.8)이다. 새 파일 경로는 신규로 생성되지 않는다.

target 스스로의 plan 파일 경로
`plan/in-progress/spec-draft-cafe24-nonce-key-design.md`가 신규다.
동일 디렉터리에 중복된 파일명이 없음을 확인했다.

- 결론: 충돌 없음.

### 추가 검토 — "관련 코드 상수" 표 내 상수명 충돌

target 이 기존 `관련 코드 상수` 표(line 555–557,
`spec/4-nodes/4-integration/4-cafe24.md`)에 새 행으로 추가하는 상수명은
`nonce key hmac prefix 길이`이다.

기존 표에 등록된 상수명은 `RECOVERY_CANDIDATE_LIMIT` 하나뿐이며,
이는 명명 형식도 의미도 전혀 다르다.
동일 파일 내 다른 절·코드베이스 전체에서 `nonce key hmac prefix 길이`라는
식별자가 사전에 사용된 사례가 없음을 확인했다.

changelog 슬러그 `nonce-key-doc` 도 기존 changelog 행에서 사용된 슬러그와
중복되지 않는다.

- 결론: 충돌 없음.

---

## 요약

target 문서(`spec-draft-cafe24-nonce-key-design.md`)가 도입하는 신규 식별자는
`관련 코드 상수` 표의 행 레이블 `nonce key hmac prefix 길이`와 changelog 슬러그
`nonce-key-doc` 두 가지에 불과하다. 두 식별자 모두 기존 spec 및 plan 코퍼스
어디에서도 사전에 사용된 적이 없으며, 의미·범위가 겹치는 유사 식별자도 없다.
엔티티명·API endpoint·이벤트명·환경변수·파일 경로 중 신규 생성되는 항목이 없고,
기존 이름(`Cafe24InstallNonceCache`)은 동일 의미로 그대로 재인용된다. 신규 식별자
충돌 관점에서 차단 또는 주의를 요하는 발견사항이 없다.

---

## 위험도

NONE
