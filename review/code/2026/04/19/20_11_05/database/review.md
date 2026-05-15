### 발견사항

- **[INFO]** 마이그레이션 스크립트 DB 경로 미테스트
  - 위치: `migrate-node-output-refs.spec.ts` 주석 ("The DB-touching `main()` path is exercised manually")
  - 상세: 순수 문자열 변환 로직만 단위 테스트로 검증되고, 실제 DB rows를 읽고 쓰는 `main()` 경로는 수동 dry-run에 의존. 트랜잭션 롤백 동작, 부분 실패 시 복구 경로가 자동화된 검증 없음.
  - 제안: `main()` 에 대한 통합 테스트(in-memory SQLite 또는 테스트 DB fixture)를 추가하거나, 최소한 배치 단위 트랜잭션 + 실패 시 중단 로직이 코드에 명시적으로 존재하는지 확인 필요.

- **[WARNING]** 과거 `NodeExecution.output_data` 레코드 마이그레이션 미언급
  - 위치: `memory/node-specs-improvement-progress.md` 후속 3 섹션, `spec/5-system/4-execution-engine.md` §6.2
  - 상세: 스펙 변경은 `NodeExecution.output_data`(JSONB 추정)의 저장 포맷을 대대적으로 변경(`output.type` 제거, `config/output/meta` 분리, `interaction.*` 신설)하지만, 마이그레이션 스크립트는 **워크플로우 노드 설정의 표현식 문자열**만 재작성. 과거 실행 기록(`NodeExecution.output_data`)은 구 포맷 그대로 남음.
  - 제안: 프론트엔드 렌더러와 표현식 리졸버가 구 포맷 fallback을 영구적으로 유지할지, 아니면 `NodeExecution.output_data`도 일괄 backfill할지 명시적으로 결정하고 문서화 필요. 현재 `handler-output.adapter.ts` dual-support 로직이 이 gap을 채우고 있으나 Stage 7에서 제거 예정이므로 타이밍 리스크가 있음.

- **[INFO]** `migrate-node-output-refs.ts` apply 시 배치/트랜잭션 전략 불명확
  - 위치: `memory/node-specs-improvement-progress.md` 후속 3
  - 상세: 대용량 워크플로우 설정 rows를 일괄 UPDATE할 때 테이블 락 또는 장시간 트랜잭션이 발생할 수 있음. 스크립트 본체가 이번 diff에 포함되지 않아 배치 크기, 트랜잭션 범위, 실패 재개 지점 여부를 확인 불가.
  - 제안: 스크립트 코드 리뷰 시 row-by-row UPDATE + 커밋 또는 배치 UPDATE(예: 1000 rows/tx) 방식인지 확인. 롤백 가능한 단위로 분할되어 있는지 검토 필요.

---

### 요약

이번 변경의 대부분은 스펙 문서 및 순수 TypeScript 헬퍼(`error-codes.ts`)로 직접적인 DB 조작이 없다. 핵심 DB 위험은 두 가지다: (1) `migrate-node-output-refs.ts`의 DB 경로가 자동 테스트 범위 밖에 있어 운영 적용 시 silent failure 가능성이 있고, (2) 스펙에서 정의한 출력 포맷 변경이 과거 `NodeExecution.output_data` 레코드에는 반영되지 않아 렌더러/표현식 fallback 로직을 Stage 7 이후까지 유지해야 하는 암묵적 의존성이 생긴다.

### 위험도
**LOW**