# 신규 식별자 충돌 검토 결과

대상: `plan/in-progress/spec-update-perf-backlog-01.md`

---

## 발견사항

### 1. `s3Service.deleteMany` — 신규 메서드명 도입 (충돌 없음, 확인 완료)

- **[INFO]** target 이 도입하려는 `s3Service.deleteMany(keys)` 식별자
  - target 신규 식별자: `s3Service.deleteMany(keys)` (spec/data-flow/4-file-storage.md 서술 갱신 대상)
  - 기존 사용처: `codebase/backend/src/common/services/s3.service.ts:93` — `async deleteMany(keys: string[])` 가 이미 구현되어 있고, `codebase/backend/src/common/services/s3.service.spec.ts:37` 에도 `S3Service.deleteMany` describe 블록이 존재한다.
  - 상세: target 이 spec 문서에 추가하려는 `s3Service.deleteMany` 는 **이미 코드에 존재하는 메서드**를 spec 에 반영하는 code-sync 갱신이다. spec/data-flow/4-file-storage.md 에는 아직 `deleteMany` 언급이 없으므로 spec 내 식별자 충돌은 발생하지 않는다. 코드 측 식별자와 완전히 일치해 의미 충돌도 없다.
  - 제안: 변경 불요. target 의 갱신 방향이 코드와 정합한다.

### 2. `spec/5-system/4-execution-engine.md §1.6` — 존재하지 않는 섹션 참조

- **[WARNING]** target 이 참조하는 섹션 번호 `§1.6`
  - target 신규 식별자: `§1.6` (섹션 앵커로서 사용)
  - 기존 사용처: `spec/5-system/4-execution-engine.md` 의 §1.x 계열은 `### 1.1 Execution 상태`(line 26), `### 1.2 NodeExecution 상태`(line 153), `### 1.3 블로킹/재개 컨트랙트`(line 80) 세 개뿐이며, `### 1.6` 이라는 섹션은 현재 파일에 존재하지 않는다.
  - 상세: target draft 는 "§1.6 표의 `MAX_NODE_ITERATIONS` 행 (+ `PARALLEL_ENGINE` 언급 위치)" 를 갱신 대상으로 적시한다. 그러나 실제 `MAX_NODE_ITERATIONS` 는 `## 2. 그래프 순회 / ### 2.1` 의 표(line 204~206)에 위치하며, `PARALLEL_ENGINE` 은 §2.1 본문(line 213)과 §0-overview.md·§4-nodes/_product-overview.md·§4-nodes/1-logic/10-parallel.md 에 분산돼 있다. "§1.6" 이라는 섹션 번호 자체가 실존하지 않으므로, project-planner 가 실제 적용 시 갱신 위치를 잘못 찾을 수 있다.
  - 제안: target draft 에서 "§1.6 표" → "§2.1 표 (`MAX_NODE_ITERATIONS` 행)" 로 섹션 참조를 수정한다. 또한 `PARALLEL_ENGINE` 언급 위치도 §2.1 본문임을 명시해 모호함을 제거한다.

### 3. `MAX_NODE_ITERATIONS` 및 `PARALLEL_ENGINE` — ENV var 식별자 (충돌 없음)

- **[INFO]** target 이 "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영" 문구를 추가하려는 두 ENV var
  - target 신규 식별자: `MAX_NODE_ITERATIONS`, `PARALLEL_ENGINE` (기존 식별자에 새 문구를 추가하는 것)
  - 기존 사용처: `MAX_NODE_ITERATIONS` — spec/5-system/4-execution-engine.md line 204 표에 이미 정의됨. `PARALLEL_ENGINE` — spec/0-overview.md line 87, spec/4-nodes/_product-overview.md line 135, spec/4-nodes/1-logic/10-parallel.md line 14·68 에 기존 정의 존재.
  - 상세: 두 ENV var 이름 자체는 기존에 정의된 식별자이며, target 은 새로운 이름을 도입하는 것이 아니라 **기존 식별자에 서술 문구를 추가**하는 것이므로 명명 충돌은 없다. 단, §11 에 이미 `EXECUTION_RUN_WORKER_CONCURRENCY`(line 1168), `EXECUTION_MAX_ACTIVE_RUNNING_MS`(line 1169) 에 동일한 "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영" 문구가 있어 target 의 추가 방향과 일관성이 맞다.
  - 제안: 변경 불요.

---

## 요약

target 문서 `plan/in-progress/spec-update-perf-backlog-01.md` 가 도입하는 신규 식별자(`s3Service.deleteMany`, `DeleteObjectsCommand`, 두 ENV var)는 기존 spec 내에서 다른 의미로 사용 중인 식별자와 충돌하지 않는다. `s3Service.deleteMany` 는 코드에 이미 구현된 메서드를 spec 에 동기화하는 것으로 의미 정합성도 일치한다. 유일한 주의점은 target 이 갱신 위치로 지정한 "§1.6" 이 실제 파일에 존재하지 않는 섹션 번호라는 점이다 — `MAX_NODE_ITERATIONS` 실제 위치는 `§2.1` 표(line 204)이므로 project-planner 적용 전 draft 의 섹션 참조를 수정할 것을 권장한다.

---

## 위험도

LOW
