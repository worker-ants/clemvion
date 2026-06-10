# 보안(Security) 리뷰 결과

리뷰 대상: perf 백로그 01 구현 관련 spec/review 문서 6종
(review/consistency/2026/06/10/20_30_25/, spec/4-nodes/1-logic/10-parallel.md, spec/5-system/4-execution-engine.md, spec/data-flow/4-file-storage.md)

---

## 발견사항

### [INFO] S3 키 prefix 기반 워크스페이스 격리 미적용 — DB 권한 검증 의존
- 위치: `spec/data-flow/4-file-storage.md` Rationale "S3 key 패턴: workspace prefix 를 두지 않는 이유"
- 상세: S3 key 패턴이 `kb/<kbId>/<docId>/<filename>` 으로 workspaceId prefix 없이 설계되어, IAM 정책의 key prefix 조건만으로는 워크스페이스 단위 격리를 강제하지 못한다. 워크스페이스 격리는 DB 권한 검증에 전적으로 위임한다는 점이 spec 에 명시돼 있다. 이는 현재 의도된 설계(채택된 옵션 1)이며 별도 Rationale 도 있다. 그러나 미래에 presigned URL이나 클라이언트 직접 다운로드가 도입될 때 DB 권한 검증이 빠진 경로에서 cross-workspace 객체 접근 위험이 있다.
- 제안: presigned URL / 클라이언트 직접 다운로드 도입 시 IAM policy condition 에 kbId·docId 단위 prefix 제약을 추가하거나, 서버 프록시 경유를 의무화하는 설계를 spec 에 명시적으로 선택 항목으로 준비해 두는 것이 좋다. 현재 diff 에는 해당 경로 구현이 없으므로 즉각적인 위험은 없음.

### [INFO] `deleteMany` S3 에러 처리 — 부분 실패 키 로그 노출 주의
- 위치: `spec/data-flow/4-file-storage.md` §3 라이프사이클 + Rationale
- 상세: `DeleteObjectsCommand` 응답의 `Errors[].Key` 를 일괄 warn 으로 기록한다는 정책이 명시됐다. S3 Key 는 `kb/<kbId>/<docId>/<filename>` 형태로 내부 UUID를 포함하므로 외부 노출 위험은 낮지만, 운영 로그에 kbId/docId 가 누적 기록될 수 있다. 파일명(`<filename>`)이 원본 사용자 업로드 파일명에서 파생되는 경우 개인정보성 파일명이 warn 로그에 노출될 수 있다.
- 제안: warn 로그 시 `Errors[].Key` 전체를 그대로 출력하지 말고, key 에서 민감 부분(파일명)을 제거하거나 kbId/docId UUID만 기록하도록 구현 가이드를 spec 또는 코드 주석에 명시하면 좋다. 현재 diff는 spec 문서 변경만이므로 실제 구현 코드는 확인 필요.

### [INFO] env read-once 캐시 패턴 (`??=`) — 환경 변수 검증 부재 가능성
- 위치: `spec/5-system/4-execution-engine.md` §2.1 `MAX_NODE_ITERATIONS` 행, `spec/4-nodes/1-logic/10-parallel.md` `PARALLEL_ENGINE` 서술
- 상세: spec 에 "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영" 이 명시됐다. 이 캐시 패턴은 잘못된 환경 변수 값(음수, 비정수, 악의적 거대 값 등)이 런타임 내내 고정되는 부작용이 있다. `MAX_NODE_ITERATIONS=0` 은 spec 상 "무제한"으로 의도 문서화됐고, EXECUTION_RUN_WORKER_CONCURRENCY 패턴을 준용해 비양수/비정수 fallback 처리한다고 spec §4.3 에 기재돼 있다. 하지만 `MAX_NODE_ITERATIONS` 와 `PARALLEL_ENGINE` 의 명시적 입력 검증/fallback 정책이 본 diff spec 문서에 선명히 기재되지 않는다.
- 제안: spec §2.1 표에 `MAX_NODE_ITERATIONS` 의 허용 범위(예: 0 이상 정수, 비정수·음수 시 기본값 100 fallback) 및 `PARALLEL_ENGINE` 허용 값 집합(`v1`, `off`)을 명시해 구현이 검증 없이 raw 값을 캐시하지 않도록 가이드한다.

### [INFO] `_resumeCheckpoint` / `_retryState` 민감 정보 strip 정책 — credential 경계 보존 확인
- 위치: `spec/5-system/4-execution-engine.md` §1.3 보존 예외 `_resumeCheckpoint` / `_retryState`
- 상세: checkpoint/retryState 저장 시 `maskSensitiveFields` boundary strip으로 credential 필드(`llmConfigId`/`workspaceId` 등)는 미동봉된다고 기술됐다. 이는 기존부터 있던 내용이며 본 diff에서 변경이 없다. 그러나 `_retryState` 의 `expiresAt` TTL 기본값(60분, `AI_RETRY_STATE_TTL_MINUTES` override)이 환경 변수로 제어되는데, 이 변수를 0 또는 매우 큰 값으로 설정했을 때의 보안 함의(무기한 유효한 retry token)가 spec에 명시되지 않았다.
- 제안: `AI_RETRY_STATE_TTL_MINUTES=0` 또는 매우 큰 값에 대한 최소/최대 범위 검증 또는 fallback 정책을 spec 에 병기하면 운영 오설정으로 인한 장기 노출 리스크를 줄일 수 있다.

---

## 요약

이번 diff 는 spec 문서 4종과 consistency/rationale 리뷰 문서 2종의 변경으로 구성되어 있다. 실제 실행 코드 변경은 포함되지 않으므로 직접적인 코드 보안 취약점(인젝션, 하드코딩 시크릿, 인증 우회 등)은 발견되지 않았다. 보안 관점의 주요 사항은 모두 INFO 등급으로, S3 워크스페이스 격리가 DB 권한 검증에 위임된 설계(presigned URL 도입 시 재검토 필요), `deleteMany` warn 로그에 파일명 포함 가능성, env read-once 캐시 시 입력 검증 정책 명시 부재, `_retryState` TTL 범위 검증 미기재 4건이다. 이 중 어느 것도 현재 코드·diff 범위에서 즉각적인 보안 위험을 발생시키지 않으며, 향후 기능 확장 시 주의가 필요한 설계 유의점 수준이다.

---

## 위험도

NONE
