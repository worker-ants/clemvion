# 아키텍처(Architecture) Review

## 범위 요약

본 변경은 **코드 로직 변경이 없는 spec/comment 정직화(drift cleanup)** 다.

- `execution-context.service.ts` / `execution-engine.service.ts`: JSDoc 주석 정정만(Redis 언급 제거, 실제 in-memory segment-local + PostgreSQL durable 모델 명시). 실행 경로·타입·시그니처 변경 0.
- `spec/5-system/4-execution-engine.md`: §6.2 저장 전략 표, §7.5 rehydration 절차, §9.1/§9.2 Redis 키 표에서 **코드 사용 0건으로 확인된** 미구현 Phase-1 Redis 키 6종(`:context`/`:status`/`node:output`/`:heartbeat`/`:lock`/`queue:priority`) 서술을 제거하고 실제 아키텍처(in-memory `ExecutionContextService` + DB durable + §7.5 rehydration)로 정정. 신규 `§Rationale` 블록 추가.
- `plan/**`, `review/**`: 작업 추적·감사 산출물 갱신(추적 문서 자체는 아키텍처 리뷰 대상 코드가 아님).

## 발견사항

- **[INFO]** 문서-코드 드리프트 해소 자체는 아키텍처 건전성에 긍정적
  - 위치: `spec/5-system/4-execution-engine.md` §6.2/§9.2, `execution-context.service.ts` 클래스 JSDoc
  - 상세: 기존 spec 은 Redis-backed 실행 컨텍스트 모델(Phase-1 설계)을 서술하고 있었으나 실제 구현은 segment-local in-memory `Map` + park 시 PostgreSQL durable commit + §7.5 rehydration 으로 수렴해 있었다. 이는 "문서가 코드와 다른 아키텍처를 주장"하는 상태였고, 온보딩/후속 구현자가 존재하지 않는 Redis 키 표를 근거로 잘못된 가정(예: cross-instance 컨텍스트 공유가 Redis 로 보장된다는 착각)을 할 위험이 있었다. 이번 변경은 SoT 문서를 실제 구현과 재정렬한다.
  - 제안: 없음(정합화 자체가 개선). 향후 유사 drift 재발 방지를 위해 "Planned/Phase-N" 성격의 설계 서술과 "구현됨" 서술을 시각적으로 구분하는 컨벤션(예: 배너/표 컬럼)을 유지 권장.

- **[INFO]** 레이어 책임 분리는 기존 구조 그대로 유지됨
  - 위치: `execution-context.service.ts` 전체
  - 상세: `ExecutionContextService` 는 in-memory `Map<contextKey, ExecutionContext>` 를 캡슐화하는 단일 책임 컴포넌트로 유지되고 있고, park 시 durable 컬럼 commit 은 `execution-engine.service.ts`/`rehydration` 경로가 담당하는 기존 분리가 그대로다. 이번 커밋은 이 경계에 대한 서술을 문서화했을 뿐 실제 경계를 바꾸지 않았다.
  - 제안: 해당 없음.

- **[INFO]** Redis context store 미채택 결정의 근거가 Rationale 에 3가지로 명시됨
  - 위치: `spec/5-system/4-execution-engine.md` 신규 `§Rationale "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택"`
  - 상세: (a) park-release 모델과의 이중화(진실 갈림) 위험, (b) cross-instance 재개는 이미 `jobId` dedup + rehydration 아키텍처로 해소, (c) 성능/복잡도. 세 근거 모두 이번 diff 범위 밖 기존 아키텍처(§4.2 jobId dedup, §7.4/§7.5 rehydration, C-2 원자 claim)에 이미 의존하고 있어 새로운 결합을 추가하지 않는다. `MEMORY.md` 의 cafe24/makeshop 미러 사례처럼, 향후 리뷰에서 "Redis 캐시 계층을 도입하자"는 제안이 재등장할 경우 이 Rationale 을 근거로 반려할 수 있다.
  - 제안: 해당 없음 — 참고용 기록.

- **[INFO]** `segmentStartMs` in-memory 잔존 한계는 "미확정 후속 candidate" 로 명시적으로 스코프 아웃됨
  - 위치: `execution-engine.service.ts` 주석, spec §Rationale "Graceful Shutdown … under-count"
  - 상세: 세그먼트 시작 시각이 여전히 인스턴스-로컬 in-memory (`Map`)에만 있어 크래시 시 active-running 누적이 under-count 될 수 있다는 기존 trade-off는 이번 변경으로 해소되지 않으며, 그렇게 주장하지도 않는다. 이전 plan 문서의 "PR3 에서 자연 해소" stale 서술을 "PR4 후속 candidate(미확정)" 로 정정한 것이 이번 diff 의 핵심 내용 중 하나다. 아키텍처 관점에서 이는 정직한 스코프 축소이며 은폐된 부채가 아니다.
  - 제안: 해당 없음.

## 요약

이번 변경은 순수 문서/주석 정직화로, 코드의 SOLID 준수·결합도/응집도·레이어 경계·순환 의존성·확장성에 어떠한 실질적 영향도 주지 않는다. `ExecutionContextService` 의 segment-local in-memory 설계와 PostgreSQL durable + rehydration 조합은 기존에 이미 존재하던 아키텍처이며, 이번 diff는 spec 이 서술하던 미구현 Redis 계층(Phase-1 잔재)을 제거하고 실제 구현·근거(Rationale)를 SoT 문서에 반영했을 뿐이다. 드리프트가 있던 문서를 실코드에 정렬시켰다는 점에서 오히려 장기적 유지보수성(향후 개발자의 잘못된 가정 방지)에 긍정적이다. 코드 변경 2건은 JSDoc 주석 교체뿐이라 리스크가 없다.

## 위험도

NONE
