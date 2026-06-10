# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-update-perf-backlog-01.md`
검토 일시: 2026-06-10

---

## 발견사항

### INFO — `§1.6` 섹션 번호 오류 (변경 2)
- **target 위치**: `plan/in-progress/spec-update-perf-backlog-01.md` §2 "대상: §1.6 표의 `MAX_NODE_ITERATIONS` 행"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` 섹션 구조 — `MAX_NODE_ITERATIONS` 표는 `§2.1 토폴로지 정렬 기반 실행 > #### 순환 참조 제한` 에 위치하며, `§1.6` 섹션은 현재 해당 spec 에 존재하지 않음
- **상세**: target 이 언급하는 `§1.6` 는 실제 spec 의 섹션 구조와 불일치한다. `MAX_NODE_ITERATIONS` 는 `§2.1` 의 `#### 순환 참조 제한` 하위 표에 있다. `§11` 의 `EXECUTION_RUN_WORKER_CONCURRENCY` · `EXECUTION_MAX_ACTIVE_RUNNING_MS` 두 env 가 이미 "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영" 문구를 보유하고 있다는 사실 자체는 정확하나, 적용 위치 참조가 틀렸다.
- **제안**: draft 의 "§1.6 표" 참조를 "§2.1 순환 참조 제한 표" 로 수정. project-planner 적용 시 실제 위치를 확인 후 반영.

### INFO — `deleteMany` 전환의 부분 실패 처리 언어와 기존 Rationale 표현 차이 (변경 1)
- **target 위치**: `plan/in-progress/spec-update-perf-backlog-01.md` §1 변경 기술 — "부분 실패는 응답 `Errors[].Key` 를 일괄 warn(best-effort 의미론 불변)"
- **과거 결정 출처**: `spec/data-flow/4-file-storage.md ## Rationale > §§ \`s3Service.delete\` 실패가 warn 처리인 이유` — "S3 삭제는 best-effort 로 둔다 … try/catch warn"; 동 파일 §3 라이프사이클 표 "KB 삭제" 행 — "(best-effort, 실패 시 warn)"
- **상세**: 기존 Rationale 는 *단건* 삭제 실패를 try/catch warn 으로 처리하는 best-effort 정책을 정의했다. target 이 도입하는 `DeleteObjectsCommand` 배치 삭제는 API 특성상 **부분 성공(partial failure)** 이 가능하다 — 응답 `Errors[].Key` 를 통해 실패 키 목록이 반환된다. target draft 는 이를 "일괄 warn" 으로 처리해 best-effort 의미론을 유지한다고 명시하고 있어, 기존 Rationale 의 핵심 원칙(best-effort + warn)은 보존된다. 다만 기존 Rationale 텍스트가 단건 try/catch warn 을 SoT 로 작성되어 있으므로, spec 반영 시 **`deleteMany` 의 partial failure → warn 패턴도 Rationale 에 병기**하지 않으면 Rationale 와 본문 서술이 단건 vs 배치 간 불일치 상태로 남는다.
- **제안**: project-planner 가 §3 라이프사이클 표와 `>` 서술 문구를 `deleteMany` 기반으로 갱신할 때, `## Rationale > §§ s3Service.delete 실패가 warn 처리인 이유` 의 마지막 문장("try/catch warn")도 "`deleteMany` 응답 `Errors[].Key` 를 일괄 warn — best-effort 정책 동일" 로 갱신 또는 보충한다.

---

## 요약

target draft 는 두 가지 code-sync 문구 갱신을 제안하며, 어느 쪽도 기존 Rationale 의 합의된 원칙(best-effort/warn 정책, env read-once 관행)을 명시적으로 기각하거나 역전시키지 않는다. 변경 1(`deleteMany` 전환)은 best-effort 의미론을 불변으로 선언하며 배치 API 의 partial failure 처리에 동일 warn 정책을 연장하는 적합한 설계다. 단, 기존 Rationale 문구가 단건 try/catch warn 을 구현 기준으로 서술하고 있어 배치 전환 후에는 Rationale 도 함께 갱신되어야 Rationale ↔ 본문 정합이 유지된다. 변경 2(env read-once 문구)는 §11 의 다른 env 들과 대칭을 맞추는 적절한 보완이나, target 이 참조하는 `§1.6` 섹션 번호가 현재 spec 구조와 불일치(`MAX_NODE_ITERATIONS` 실제 위치는 `§2.1 순환 참조 제한`)하므로 project-planner 적용 시 위치 확인이 필요하다. CRITICAL 또는 WARNING 수준의 Rationale 위반은 없다.

---

## 위험도

LOW
