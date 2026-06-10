# 부작용(Side Effect) 리뷰 결과

리뷰 대상: perf 백로그 01 구현 관련 spec 갱신 + consistency 리뷰 산출물
diff-base: origin/main

---

## 발견사항

### [INFO] `S3Service.deleteMany(keys)` — 공개 API 추가, 기존 호출자 영향 없음

- 위치: `spec/data-flow/4-file-storage.md` "코드 진입점" 항목 + §3 라이프사이클 표
- 상세: `S3Service` 에 `deleteMany(keys)` 메서드가 신규 추가됐다. 기존 `delete(key)` 시그니처는 변경되지 않았으며 기존 호출자(`removeDocument` 경로)는 이전과 동일하게 `delete`를 사용한다. `deleteMany`는 `knowledge-base.service.ts`의 `remove(id, workspaceId)` 경로 전용으로 추가됐고, 기존 단건 루프 코드를 대체한다. 신규 메서드이므로 기존 호출자에 대한 파급이 없고, spec 문서도 KB 삭제 전용임을 명시한다.
- 제안: 없음 (정합 완료).

### [INFO] `spec/data-flow/4-file-storage.md` Rationale — best-effort 의미론 확장 서술, 동작 불변

- 위치: `spec/data-flow/4-file-storage.md` Rationale `s3Service.delete 실패가 warn 처리인 이유`
- 상세: 기존 단건 경로(`removeDocument`)에만 언급되던 best-effort/warn 정책이 배치 경로(`deleteMany`)까지 병기됐다. 실제 정책(S3 삭제 실패 시 warn 후 DB row 삭제 진행)은 변경 없이 동일하다. S3 비실존 키의 멱등 의미론(`Deleted` 반환 → warn 비대상) 설명이 추가됐으나 이는 S3 API의 기존 동작을 명시한 것으로 동작 변화가 없다.
- 제안: 없음 (정합 완료).

### [INFO] `spec/5-system/4-execution-engine.md` `MAX_NODE_ITERATIONS` 행 — env read-once 문구 추가, 설명 확장만

- 위치: `spec/5-system/4-execution-engine.md` §2.1 순환 참조 제한 표
- 상세: `MAX_NODE_ITERATIONS` 행 설명에 "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영 (§11 worker env 들과 동일 규약)" 문구가 추가됐다. 기존 기본값(`100`), 무제한(`0`) 의미는 그대로이며 설명 문구만 확장됐다. 이 env 변수를 런타임에 동적으로 읽던 코드가 있었다면 동작 변화가 생기나, 변경은 spec 문서에만 국한되고 실제 코드의 캐싱 도입은 별도 구현 PR에서 이루어진다. spec 문서 변경 자체가 코드 동작을 바꾸지는 않는다.
- 제안: 없음.

### [INFO] `spec/4-nodes/1-logic/10-parallel.md` `PARALLEL_ENGINE` read-once 문구 추가 — rollback card 설명 확장만

- 위치: `spec/4-nodes/1-logic/10-parallel.md` P1 구현 상태 note
- 상세: `PARALLEL_ENGINE=off` rollback card 설명에 "본 env 는 모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영" 문구가 추가됐다. 기존 `PARALLEL_ENGINE` 의 기본값(`v1`) 및 `off` 동작(순차 진행)은 변경 없다. spec 문서 보강이며 코드 동작 변경이 아니다.
- 제안: 없음.

### [INFO] consistency 리뷰 산출물 3건 — 새 파일 생성, 코드베이스·spec에 부작용 없음

- 위치: `review/consistency/2026/06/10/20_30_25/naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`
- 상세: 세 파일은 `review/consistency/` 경로에 신규 생성된 리뷰 산출물이다. 코드나 spec을 수정하지 않으며 어떤 전역 상태, 환경 변수, 네트워크 호출, 이벤트 발행도 없다. 읽기 전용 분석 문서이므로 부작용이 없다.
- 제안: 없음.

---

## 요약

이번 diff의 실질 변경은 spec 문서 3건(data-flow/4-file-storage.md, 5-system/4-execution-engine.md, 4-nodes/1-logic/10-parallel.md) 갱신과 consistency 리뷰 산출물 3건 신규 생성이다. spec 문서 변경은 모두 기존 동작을 변경하지 않는 설명 확장이거나(read-once 문구 추가, Rationale 배치 경로 병기), 신규 메서드 추가(`deleteMany`) 시 기존 시그니처를 보존한 것으로, 기존 호출자에 대한 파급이 없다. 리뷰 산출물 파일은 읽기 전용 산출물이며 코드/상태/네트워크에 어떤 부작용도 없다. 의도치 않은 상태 변경, 전역 변수 도입, 시그니처 변경, 인터페이스 파괴, 환경 변수 조작, 이벤트/콜백 변화는 이번 diff에서 발견되지 않았다.

---

## 위험도

NONE
