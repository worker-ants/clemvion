# 요구사항(Requirement) 리뷰 결과

리뷰 대상: perf 백로그 01 spec 갱신 + consistency 검토 산출물 (6파일)
리뷰 시각: 2026-06-10

---

## 발견사항

### [INFO] consistency 검토 산출물 3건 (파일 1–3) — 기능 완전성 충족, 추가 관찰 없음

- 위치: `review/consistency/2026/06/10/20_30_25/naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`
- 상세: 세 파일은 consistency-checker 의 산출 문서다. 각각 신규 식별자 충돌 검토(NONE), plan 정합 검토(LOW), Rationale 연속성 검토(NONE)를 수행했으며, 발견사항·등급·제안이 내부적으로 일관된다. 이 파일 자체는 요구사항을 구현하는 코드가 아니라 검토 결과 보고서이므로 별도 spec fidelity 적용 대상이 아니다.
- 제안: 없음.

---

### [INFO] `spec/4-nodes/1-logic/10-parallel.md` line 14 — read-once 규약 병기, spec fidelity 충족

- 위치: `spec/4-nodes/1-logic/10-parallel.md` line 14 (P1 구현 상태 callout)
- 상세: 변경 전 문장은 "rollback card" 까지만 기술했고, 해당 env 변수의 읽기 시점 규약이 누락돼 있었다. 변경 후 "rollback card — 본 env 는 모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영" 구문이 추가됐다. `spec/5-system/4-execution-engine.md` §11 표의 `EXECUTION_RUN_WORKER_CONCURRENCY` 행 및 같은 §11 다른 env 행이 동일 표현("모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영")을 사용하므로, 이번 갱신이 §11 규약과 표현 수준까지 일치한다.
- 단, `10-parallel.md` §4 (실행 로직 3번 항목)에는 "PARALLEL_ENGINE=off 명시 시 엔진이 토폴로지 순서로 순차 실행 (rollback card)." 라고 여전히 read-once 규약 언급이 없다. line 14 callout 과 §4 항목 사이에 서술이 불일치한다. 이는 기능 오동작과 무관하지만(행위는 line 14 가 SoT), 문서 독자가 §4 만 읽으면 read-once 규약을 파악하지 못한다.
- 제안: `spec/4-nodes/1-logic/10-parallel.md` §4 실행 로직 3번 항목의 `(rollback card)` 뒤에도 `(read-once: 모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영)` 병기를 추가하면 line 14 와 §4 가 완전히 정합된다. 우선도 INFO.

---

### [INFO] `spec/5-system/4-execution-engine.md` §2.1 표 — read-once 규약 추가, spec fidelity 충족

- 위치: `spec/5-system/4-execution-engine.md` §2.1 "순환 참조 제한" 표, `MAX_NODE_ITERATIONS` 행 (line 206)
- 상세: 기존 행은 `MAX_NODE_ITERATIONS` 의 동작 설명만 있었고, `EXECUTION_RUN_WORKER_CONCURRENCY`·`CONTINUATION_WORKER_CONCURRENCY` 등 §11 표 항목들이 이미 갖고 있는 "모듈 로드 시 1회 읽음" 규약이 없었다. 변경 후 동일 규약과 참조("§11 worker env 들과 동일 규약")가 추가됐다. 이는 §11 기존 서술과 정합하며 실제 구현(`resolveMaxNodeIterations` lazy `??=` 패턴)과 일치한다.
- 제안: 없음 (spec fidelity 충족, 구현·spec 일치 확인됨).

---

### [INFO] `spec/data-flow/4-file-storage.md` — `deleteMany` 배치 경로 갱신, spec fidelity 충족

- 위치: `spec/data-flow/4-file-storage.md` 코드 진입점 목록(line 18), §3 라이프사이클 표(line 100), 설명 callout(lines 102-105), Rationale(lines 139-142)
- 상세: 네 곳이 일관되게 갱신됐다:
  1. 진입점 목록: `deleteMany(keys)` 추가 (DeleteObjects 배치, KB 삭제 cleanup 전용) — 기존 `delete(key)` 와 병기.
  2. 라이프사이클 표: "for 루프" 단건 반복 서술 → "DeleteObjects 배치 삭제 (1000키/요청 청크; best-effort, 부분 실패 warn)" 으로 교체.
  3. callout: 단건 루프 `s3Service.delete()` → `s3Service.deleteMany(keys)` + 1000키/요청 청크 + 부분/전체 실패 warn 서술.
  4. Rationale: best-effort 의미론을 단건·배치 양 경로를 모두 기술하도록 확장. S3 멱등 의미론(비실존 키 `Deleted` 반환) 보충 설명 추가.
- 모든 갱신이 내부적으로 일관되며, 실제 코드가 구현하는 `DeleteObjectsCommand` 청크 배치 동작을 정확히 반영한다.
- 제안: 없음 (spec fidelity 충족).

---

## 요약

이번 변경은 perf 백로그 01 구현을 반영한 세 spec 파일 갱신(파일 4–6)과 consistency-checker 산출물 3건(파일 1–3)으로 구성된다. spec 변경은 `PARALLEL_ENGINE` env 변수의 read-once 규약 병기, `MAX_NODE_ITERATIONS` 의 동일 규약 추가, `S3Service.deleteMany` 배치 경로의 라이프사이클·Rationale 갱신 등 세 항목 모두 실제 구현과 일치하고 내부 일관성도 유지된다. 발견된 유일한 개선 사항은 `10-parallel.md` §4 실행 로직 항목이 line 14 callout 과 달리 read-once 규약을 언급하지 않는 서술 불일치(INFO 수준)다. 이 불일치는 기능 동작에 영향이 없으나 단일 진실 원칙 강화를 위해 §4 에도 동일 규약 병기를 권장한다. 전체적으로 요구사항 충족도는 양호하며 기능 회귀 위험 없음.

---

## 위험도

NONE
