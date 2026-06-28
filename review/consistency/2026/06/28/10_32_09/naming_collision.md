# 신규 식별자 충돌 검토 결과

## 발견사항

해당 diff 가 도입하는 신규 식별자를 아래 6개 관점으로 점검했다.

### 1. 요구사항 ID 충돌

검토 대상 diff 는 spec 파일을 변경하지 않는다. `spec/5-system/12-webhook.md` 는
impl-done scope 로 지정됐으나 diff 에 spec 수정 라인이 없다 (코드·테스트·마이그레이션만
포함). 따라서 새로 부여된 요구사항 ID 가 없으며 WH-MG-02·WH-SC-01 등 기존 ID 를
참조만 하고 있다.

**충돌 없음.**

---

### 2. 엔티티/타입명 충돌

diff 가 도입하는 타입·DTO 변경은 `UpdateTriggerDto` 의 기존 필드 `endpointPath` JSDoc
정정이며 신규 타입/인터페이스/DTO 를 추가하지 않는다.

**충돌 없음.**

---

### 3. API endpoint 충돌

diff 에 신규 endpoint 정의가 없다. 기존 `POST /api/hooks/:endpointPath` 및
`PATCH /api/triggers/:id` 경로를 변경하지 않는다.

**충돌 없음.**

---

### 4. 이벤트/메시지명 충돌

diff 에 신규 webhook 이벤트명·queue 이름·SSE 이벤트 추가가 없다.

**충돌 없음.**

---

### 5. 환경변수·설정키 충돌

diff 에 신규 환경변수·config 키 도입이 없다.

**충돌 없음.**

---

### 6. 파일 경로 충돌

#### 6-a. DB 마이그레이션 버전 번호

- **target 신규 식별자**: `V102__trigger_endpoint_path_uuid_check.sql`
- **origin/main 상태**: `V101__add_user_email_lower_index.sql` 이 최종. `V102` 는 존재하지 않음 (`git ls-tree origin/main codebase/backend/migrations/` 에서 `V102` 파일 없음 확인)
- **상세**: `V102` 버전 슬롯이 origin/main 에 비어 있으므로 Flyway 기준 중복 없음. 파일명 패턴 `V{NNN}__{description}.sql` 도 기존 컨벤션과 일치한다.

**충돌 없음.**

#### 6-b. e2e 테스트 케이스 레이블 "B2"

- **target 신규 식별자**: `it('B2. 비-UUID endpointPath 로 트리거 생성 → 400 VALIDATION_ERROR ...')`
- **origin/main 상태**: `webhook-trigger.e2e-spec.ts` 기존 레이블은 A·B·C·D·E·F·G·H·I 의 단일 문자 시퀀스. `B2` 는 존재하지 않음.
- **상세**: 기존 `B. 미존재 endpointPath → 404 TRIGGER_NOT_FOUND` (line 107) 과 같은 문자 B 를 접두어로 사용하므로 의미적으로 "B 의 파생 케이스"임은 명확하다. 그러나 레이블 시퀀스가 단일 문자 관례(A·B·C…)에서 복합 문자(`B2`)로 변형되는 첫 사례이므로 미래 케이스 추가 시 혼동 가능성이 있다.
- **등급**: **[INFO]** — 기능 충돌은 아니나 일관성 보완 제안.
- **제안**: 팀 컨벤션이 확립되기 전이므로 현재 방식을 유지해도 무방하다. 다만 향후 같은 파일에 케이스가 추가될 때 `B2`, `B3` vs `J`, `K` 중 어느 쪽이 맞는지 명시적으로 결정해 두는 것이 좋다.

---

### 7. DB CHECK 제약명 충돌

- **target 신규 식별자**: `chk_trigger_endpoint_path_uuid` (PostgreSQL 제약 이름)
- **기존 사용처**: `git grep -rn "chk_trigger_endpoint_path_uuid" origin/main` 결과 없음. origin/main 마이그레이션 파일 어디에도 동명 제약이 없다.
- **상세**: 제약명 패턴 `chk_{table}_{column}_{suffix}` 는 기존 마이그레이션 관례와 일치한다. `DROP CONSTRAINT IF EXISTS` 전치로 재실행 안전도 확보됐다.

**충돌 없음.**

---

## 요약

이번 diff 는 DB CHECK 제약 1개(V102 마이그레이션), DTO JSDoc 정정, 테스트 케이스 추가 3건으로 구성된다. 신규로 도입된 식별자 — Flyway 버전 `V102`, 제약명 `chk_trigger_endpoint_path_uuid`, 테스트 레이블 `B2` — 는 모두 origin/main 에서 충돌하는 기존 사용처가 없다. e2e 레이블 `B2` 가 단일 문자 관례에서 벗어나는 첫 사례이나 기능 충돌이 아닌 일관성 수준의 관찰이다. 전반적으로 식별자 충돌 위험이 없는 안전한 변경 집합이다.

## 위험도

NONE
