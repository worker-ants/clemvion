# 신규 식별자 충돌 검토 — spec/0-overview.md

검토 일시: 2026-05-22  
검토 대상: `spec/0-overview.md`  
검색 코퍼스: `spec/`, `plan/in-progress/`, `spec/conventions/`

---

## 발견사항

### 1. **[WARNING]** §6.3 테이블이 §6.2 를 잘못 참조 — Cafe24 가 이미 §6.1 로 이동됨

- **target 신규 식별자**: `spec/0-overview.md` line 101 의 `§6.2` 섹션 참조  
  ```
  | **Internal MCP Bridge 패턴 확장** | Cafe24 (구현 완료, §6.2) 이후 …
  ```
- **기존 사용처**: 동일 파일 §6.1 (line 72 "#### 6.1 구현 완료 (✅)") + Rationale 절 "Cafe24 통합을 §6.1 (완료) 분류로" (line 398–403)  
- **상세**: Rationale 절은 Cafe24 통합 항목이 §6.2 (🚧 부분 구현) 에서 §6.1 (✅ 완료) 로 이동했음을 명시하고 있다. 그러나 §6.3 로드맵 테이블의 "Internal MCP Bridge 패턴 확장" 행은 여전히 `(구현 완료, §6.2)` 라고 표기하여 이동 전 섹션 번호를 가리키고 있다. §6.2 는 현재 "Parallel 노드 (P1)" 와 "조직 레벨 Integration 공유" 만 남은 🚧 섹션이므로, 독자가 §6.2 를 따라가면 Cafe24 항목을 찾을 수 없다.  
- **제안**: `§6.2` → `§6.1` 로 정정.  
  ```diff
  - | **Internal MCP Bridge 패턴 확장** | Cafe24 (구현 완료, §6.2) 이후 …
  + | **Internal MCP Bridge 패턴 확장** | Cafe24 (구현 완료, §6.1) 이후 …
  ```

---

### 2. **[WARNING]** `U{version}__{description}.sql` undo 스크립트 식별자가 기존 conventions 에 미정의

- **target 신규 식별자**: `spec/0-overview.md` §2.8 (line 290)  
  ```
  | 롤백 지원 | 각 마이그레이션에 대응하는 undo 스크립트 작성 (`U{version}__{description}.sql`) |
  ```
- **기존 사용처**: `spec/conventions/migrations.md` — 마이그레이션 파일 네이밍 규약의 단일 진실. 해당 문서는 `V<번호>__<snake_case_descriptor>.sql` 과 `.conf` 페어만 정의하며 `U__` 형태에 대한 언급이 전혀 없다. 실제 `codebase/backend/migrations/` 디렉터리에도 `U*.sql` 파일은 존재하지 않는다.  
- **상세**: Flyway 의 undo 스크립트(`U__`) 는 유료 Flyway Teams/Enterprise 기능이다. 무료 OSS Flyway 버전에서는 동작하지 않으며, 실제 codebase 에는 해당 파일이 없다. 이 식별자가 target doc 에만 등장하고 conventions 에 없어 신규 도입되는 것처럼 보이지만 실제 구현·규약과 완전히 괴리되어 있다. 독자가 `U__` 파일을 작성해도 실행되지 않고, conventions 검증 테스트(`migrations.spec.ts`)가 잡지도 못한다.  
- **제안**: §2.8 의 "롤백 지원" 행을 삭제하거나, Flyway Community 에서 지원하지 않는 기능임을 명시. `spec/conventions/migrations.md` 에 기준이 없는 식별자이므로 target doc 이 SoT 를 생성하는 것은 부적절하다. 대안으로 "롤백 = 전진 마이그레이션(새 V__ 파일로 ALTER/DROP 반전)" 이라고 기존 conventions 의 Append-only 원칙을 참조하는 방식으로 대체 권장.

---

### 3. **[INFO]** `flyway-{env}.conf` 환경 분리 파일명이 codebase 및 migrations 규약에 미반영

- **target 신규 식별자**: `spec/0-overview.md` §2.8 (line 292)  
  ```
  | 환경 분리 | dev/staging/production 환경별 설정 파일 분리 (`flyway-{env}.conf`) |
  ```
- **기존 사용처**: `spec/conventions/migrations.md` 및 `codebase/backend/migrations/` — `V__.sql` 파일과 `.conf` 페어(동일 base name)만 정의됨. `flyway-{env}.conf` 형식의 환경별 파일은 migrations 규약에도 codebase 에도 존재하지 않는다.  
- **상세**: 기존 conventions 에 없는 파일 네이밍 패턴을 target doc 이 단독으로 도입하고 있다. 구현 뒷받침이 없는 aspirational 기술로, SoT 분열 위험이 있다.  
- **제안**: `spec/conventions/migrations.md` 에 환경별 Flyway 설정 파일 정책을 추가하거나, target doc §2.8 에서 해당 행 삭제 또는 "향후 도입 예정" 으로 표기.

---

### 4. **[INFO]** `S3_BUCKET` 기본값 `workflow-storage` 가 `spec/data-flow/4-file-storage.md` 에 미반영

- **target 신규 식별자**: `spec/0-overview.md` §2.7 (line 282)  
  ```
  버킷 이름은 `S3_BUCKET` 환경변수 (기본 `workflow-storage`, `codebase/backend/.env.example:55`) 로 지정한다.
  ```
- **기존 사용처**: `spec/data-flow/4-file-storage.md` line 73 — `S3_BUCKET` ENV var 를 정의하지만 기본값(`workflow-storage`)을 명시하지 않는다.  
- **상세**: 충돌이 아니라 누락이다. 두 문서가 `S3_BUCKET` 이름을 공유하므로 식별자 충돌은 없지만, 기본값이 target doc 에만 기재되어 단일 진실이 분산되어 있다.  
- **제안**: `spec/data-flow/4-file-storage.md` 의 `S3_BUCKET` 행에 기본값 `workflow-storage` 를 추가하여 두 SoT 를 일치시킨다.

---

## 요약

`spec/0-overview.md` 는 대부분의 식별자를 기존 spec corpus 와 일관되게 사용한다. 신규 충돌은 없다. 그러나 내부 자기 참조 오류 1건(§6.3 에서 Cafe24 가 §6.1 로 이동했는데 §6.2 를 참조)이 WARNING 수준으로 발견되었다. 또한 Flyway undo 스크립트(`U__`) 식별자가 conventions 및 codebase 어디에도 존재하지 않으면서 target doc 에서 처음 도입되는 것처럼 기술되어 있어 실제 구현과 규약 모두와 괴리된 상태로 WARNING 을 부여했다. 환경별 Flyway 설정 파일(`flyway-{env}.conf`)과 S3_BUCKET 기본값 누락은 INFO 수준의 일관성 보완 사항이다.

---

## 위험도

MEDIUM
