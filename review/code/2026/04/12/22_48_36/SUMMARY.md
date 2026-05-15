# Code Review 통합 보고서

## 전체 위험도
**HIGH** - `buttonConfig` non-null 단언에 의한 런타임 크래시 위험, DB 저장 형식 변경으로 인한 하위 호환성 파괴, 핵심 변경 로직에 대한 테스트 부재가 복합적으로 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 안전성 | `buttonConfig` non-null assertion(`!`)으로 structured/flat 캐시 모두 없을 경우 `buttonConfig.buttons` 접근 시 런타임 TypeError 발생. 서버 재시작 후 복구 실행 또는 캐시 초기화 타이밍 이슈 시 재현 가능 | `execution-engine.service.ts` ~L1551 | `!` 제거 후 `if (!buttonConfig) throw new Error(...)` 명시적 guard 추가 |
| 2 | 테스트 누락 | `waitForButtonInteraction` 내 structured 캐시 갱신, `nodeExec.outputData` 형식 변경, `interactionType` fallback 경로 등 핵심 변경 로직 전체에 단위 테스트 전무 | `execution-engine.service.ts` | structured/flat cache fallback, `buttonItemMap` selectedItem resolve, `setStructuredOutput` spy 검증 테스트 추가 |
| 3 | 테스트 누락 | `pdf.handler.ts`의 출력 shape가 `{ config, output, status }` 구조로 완전 변경되었으나 `pdf.handler.spec.ts` 부재 | `pdf.handler.ts` | 신규 output shape 및 `requires_playwright` 상태 처리 검증 테스트 작성 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DB 호환성 | `nodeExec.outputData` 저장 형식이 flat shape → `NodeHandlerOutput` structured shape으로 변경. 기존 DB 레코드와 신규 레코드 간 JSON 구조 불일치 발생. 조회 API, 실행 이력, 재개 로직 등 소비처 파손 위험. `as unknown as` 이중 캐스팅으로 컴파일 타임 미검출 | `execution-engine.service.ts` ~L1762 | flat shape 유지 또는 `structuredOutputData` 별도 컬럼 추가; DB 마이그레이션 스크립트 작성; 기존 소비처에 역호환 어댑터 적용 |
| 2 | API 계약 | `interactionType`이 최상위 필드에서 `meta.interactionType`으로 이동. WebSocket 이벤트 페이로드로 flat `nodeOutput`이 전달될 경우 프론트엔드 참조 경로 파괴 | `carousel.handler.ts`, `table.handler.ts`, `chart.handler.ts` | 이벤트 직렬화 시점에 내부 구조 변경이 외부 계약에 노출되지 않도록 정규화 레이어 추가 |
| 3 | 런타임 오류 | Chart 핸들러의 flat output에서 기존 `config.xAxis`, `config.yAxis` 키 소실. `axes: { xAxis, yAxis }`로 이름 변경되어 기존 워크플로우 표현식(`$node["차트노드"].config.xAxis`) 참조 시 `undefined` 반환 | `chart.handler.ts` ~L66, `toEngineFlatShape` | 변경 의도 확인 후 downstream 표현식 참조 grep; 마이그레이션 기간 flat output 병합 처리 또는 호환 테스트 추가 |
| 4 | 보안 | `interactionType` 값이 런타임 whitelist 검증 없이 `NodeHandlerOutput.status`에 할당되어 하위 라우팅 로직에서 의도치 않은 분기 유도 가능 | `execution-engine.service.ts` ~L1754 | `['button_click', 'button_continue', 'button_timeout']` 명시적 whitelist 검사 추가 |
| 5 | 보안/데이터 | `previousOutput`(이전 핸들러 출력 전체)이 `structuredOutputPayload.previousOutput`에 포함되어 DB 저장. API 응답 키로 접근 가능하며, 민감 데이터(API 응답, 개인정보 등) 중복 저장 위험 | `execution-engine.service.ts` ~L1737 | `previousOutput` 필요성 재검토; 필요 시 민감 필드 redact 유틸리티 적용 |
| 6 | 유지보수성 | `status` 필드에 워크플로우 상태(`waiting_for_input`) 대신 인터랙션 타입(`button_click`)을 혼용 저장. 후속 소비 코드에서 의미론적 혼란 유발 | `execution-engine.service.ts` ~L1750 | `status: 'completed'`로 설정하고 인터랙션 타입은 `meta.interactionType`에만 보관; 또는 `interactionStatus` 별도 필드 사용 |
| 7 | 유지보수성 | `interactionType` 추출 폴백 체인이 최소 2곳에 동일하게 복제. `meta` 구조 변경 시 양쪽 모두 수정 필요 | `execution-engine.service.ts` ~L461, ~L845 | `getInteractionType(context, nodeId)` 헬퍼로 추출하여 SSOT 관리 |
| 8 | 유지보수성 | `waitForButtonInteraction` 단일 메서드가 flat/structured 캐시 조회·빌드·미러링·DB 저장·이벤트 발행을 모두 담당. 변경 후 메서드 길이 과다 | `execution-engine.service.ts` | structured 캐시 갱신 블록을 `mirrorInteractionToStructuredCache(...)` 로 분리; 캐시 미러링 책임 `ExecutionContextService`로 이관 |
| 9 | 동시성 | `setNodeOutput`(flat cache)과 `setStructuredOutput`(structured cache) 사이에 `await nodeExecutionRepository.save()` I/O 지점 존재. 두 캐시가 일시적 불일치 상태가 될 수 있으며 WebSocket 이벤트나 다른 코루틴이 구 상태를 읽을 위험 | `execution-engine.service.ts` ~L1711, L1739 | `setOutputs(executionId, nodeId, flat, structured)` 단일 메서드 추가 또는 DB 저장 이전에 구조화 캐시 갱신 완료 |
| 10 | 동시성 | `prevStructured` 읽기 이후 `setStructuredOutput` 쓰기까지 DB I/O 지점 존재 (TOCTOU). 병렬 브랜치나 재시도 로직이 동일 node의 캐시를 갱신 시 stale 값 사용 | `execution-engine.service.ts` ~L1711-1739 | DB 저장 이후 `prevStructured` 재조회 또는 structured cache 갱신을 DB 저장 이전에 완료 |
| 11 | 아키텍처 | `previousOutput` 중첩 저장으로 루프 노드 반복 실행 시 `output.previousOutput.previousOutput...` 체인 누적. 메모리 및 직렬화 비용 무한 성장 위험 | `execution-engine.service.ts` ~L1737 | 깊이 1로 제한하거나 이력은 `nodeExecutionRepository` 별도 레코드로 관리 |
| 12 | 테스트 | `chart-buttons.handler.spec.ts`에서 `result.config.buttonConfig` 내용(buttons, buttonTimeout, buttonTimeoutAction) 미검증 | `chart-buttons.handler.spec.ts` | carousel/table과 동일하게 `buttonConfig` 구조 검증 추가 |
| 13 | 테스트 | carousel `itemButtons` 설정 시 `buttonItemMap` 생성 경로 미검증. `waitForButtonInteraction`의 `selectedItem` resolve에 사용되는 중요 경로 | `carousel-buttons.handler.spec.ts` | `itemButtons` 포함 케이스 추가, `buttonItemMap['approve__item_0'] === 0` 검증 |
| 14 | 아키텍처 | `interactionType` 분기 하드코딩으로 신규 인터랙션 타입 추가 시 엔진 서비스 직접 수정 필요 (OCP 위반) | `execution-engine.service.ts` ~L483, ~L858 | `InteractionHandlerRegistry` 도입 또는 `dispatchInteractionWait(type, ...)` 단일 메서드로 분기 일원화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `NodeHandlerOutput` 인터페이스 필드별 JSDoc 부재. 레거시 flat shape과의 차이 미설명 | `node-handler.interface.ts` | 각 필드(`config`, `output`, `meta`, `status`, `port`) JSDoc 추가 |
| 2 | 문서화 | `buttonItemMap` 키 형식 패턴(`buttonId + "__item_" + itemIndex`)이 타입 정의에 미명시 | `button.types.ts` | JSDoc에 키 형식 패턴 명시 |
| 3 | 문서화 | 두 캐시(`nodeOutputCache` / `structuredOutputCache`) 공존 이유가 클래스 수준에서 미설명 | `execution-engine.service.ts` 클래스 선언부 | 클래스 JSDoc 또는 캐시 선언 인근에 마이그레이션 컨텍스트 설명 추가 |
| 4 | 기술부채 | Phase 3에서 제거 예정인 fallback 코드와 옵셔널 체이닝(`?.`)에 TODO 주석 미부재 | `execution-engine.service.ts` ~L461, ~L845, ~L464, ~L848 | `// TODO(Phase 3): remove fallback after full migration` 주석 추가 |
| 5 | 유지보수성 | `configEcho` 명칭이 목적을 충분히 설명하지 못하며 세 핸들러 간 포함 필드 기준 불일치 | `carousel.handler.ts`, `chart.handler.ts`, `table.handler.ts` | `handlerConfig` 또는 `resolvedConfig`로 통일 및 포함 필드 기준 문서화 |
| 6 | 유지보수성 | `prevOutput`이 `cleanNodeOutput`(delete 연산 후 변형 객체)에 암묵적으로 의존. 순서 변경 시 버그 발생 가능 | `execution-engine.service.ts` ~L1730 | 변수 선언 위치를 `cleanNodeOutput` 생성 직후로 이동 또는 순서 의존 주석 명시 |
| 7 | 아키텍처 | `configEcho` 패턴으로 핸들러가 엔진의 캐시 전략을 인지하는 구조. 핸들러-엔진 결합 증가 | `carousel.handler.ts`, `chart.handler.ts`, `table.handler.ts` | 엔진이 `adaptHandlerReturn` 시점에 원본 `node.config`를 병합하여 핸들러는 순수 `output`과 인터랙션 메타만 반환하도록 개선 고려 |
| 8 | 아키텍처 | `ButtonConfig.buttonItemMap`이 공통 인터페이스에 편입되어 캐러셀/테이블 전용 구현 세부사항이 타입 모듈에 노출 | `button.types.ts` | `CarouselButtonConfig extends ButtonConfig` 확장 타입 분리 또는 JSDoc에 "캐러셀/테이블 전용" 명시 |
| 9 | 성능 | `waitForButtonInteraction` 내 단일 인터랙션 처리당 3~4회 얕은 복사 발생. 대용량 테이블 데이터 처리 시 GC 압력 증가 가능 | `execution-engine.service.ts`, `structuredOutputPayload` 구성 블록 | `cleanNodeOutput` 생성 시 필요 필드만 선택적 추출 또는 `prevStructured?.output`으로만 한정 |
| 10 | 보안 | `console.error`로 `$sourceItem`, `$var` 등 사용자 데이터 포함 가능한 값이 프로덕션 로그에 그대로 출력 | `table.handler.ts` | NestJS `Logger` 사용, PII 필드 `[REDACTED]` 처리 또는 로그 레벨을 `debug`로 낮춤 |
| 11 | 보안 | `buttonItemMap`으로 얻은 인덱스 사용 시 음수 또는 배열 범위 초과 케이스 미처리 | `execution-engine.service.ts` | `>= 0 && index < outputItems.length` 조건 추가 |
| 12 | 테스트 | `table.handler.spec.ts`에서 `result.config`(mode, columns, pageSize 등) 내용 미검증 | `table.handler.spec.ts` | `configEcho` 내 resolved columns 포함 여부 검증 추가 |
| 13 | 테스트 | `outputItems` 3단계 fallback 경로(structured/flat/clean) 미검증 | `execution-engine.service.ts` | 각 fallback 케이스 `selectedItem` resolve 단위 테스트 추가 |
| 14 | 의존성 | 새 외부 패키지 의존성 추가 없음. `NodeHandlerOutput` re-export, `ButtonConfig.buttonItemMap` 공식화, 불필요한 타입 캐스팅 제거 모두 올바른 정리 | 전체 diff | 문제 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | `buttonConfig` non-null 단언 크래시, DB 하위 호환 파괴, PDF 테스트 누락, Chart 출력 구조 변경으로 표현식 참조 파괴 |
| testing | HIGH | `waitForButtonInteraction` 변경 로직 테스트 전무, `pdf.handler.spec.ts` 부재, `interactionType` fallback 미검증 |
| security | MEDIUM | non-null assertion 크래시, `previousOutput` 민감 데이터 저장, `interactionType` whitelist 미검증 |
| maintainability | MEDIUM | `interactionType` 추출 로직 중복, `waitForButtonInteraction` SRP 위반, `as unknown as` 이중 캐스팅, `status` 의미 혼용 |
| api_contract | MEDIUM | `nodeExec.outputData` 형식 변경으로 클라이언트 계약 파괴, `interactionType` 위치 이동 |
| database | MEDIUM | `outputData` JSON 컬럼 이중 형식 공존, 하위 호환 처리 없음 |
| architecture | MEDIUM | 이중 캐시 폴백 로직 산재, `waitForButtonInteraction` 신 메서드화, `nodeExec.outputData` 타입 안전성 상실, `previousOutput` 무한 성장 |
| scope | MEDIUM | Chart `config`→`axes` 이름 변경 downstream 영향, `nodeExec.outputData` 형식 변경 |
| side_effect | MEDIUM | non-null assertion 크래시, DB 소비자 파손, Chart flat output `config` 키 소실 |
| concurrency | LOW | 비원자적 이중 캐시 쓰기, TOCTOU on structuredOutputCache |
| performance | LOW | 얕은 복사 중첩, `interactionType` 추출 로직 중복 |
| documentation | LOW | `NodeHandlerOutput` JSDoc 부재, 이중 캐시 공존 미설명 |
| dependency | NONE | 외부 의존성 변화 없음, 순수 내부 리팩터링 |

---

## 발견 없는 에이전트

- **dependency** — 외부 패키지 의존성 변화 없음, 내부 모듈 구조 정리 방향 적절

---

## 권장 조치사항

1. **[즉시]** `buttonConfig` non-null assertion(`!`) 제거 후 명시적 guard 추가 (`if (!buttonConfig) throw new Error(...)`) — 런타임 크래시 직접 원인
2. **[즉시]** `nodeExec.outputData` 저장 형식 결정 및 하위 호환 전략 수립 — flat shape 유지 또는 DB 마이그레이션 스크립트 작성, 소비처 역호환 어댑터 적용
3. **[즉시]** `pdf.handler.spec.ts` 작성 — 신규 output shape 및 `requires_playwright` 상태 검증
4. **[즉시]** `waitForButtonInteraction` 핵심 변경 로직 단위 테스트 추가 — structured/flat cache fallback, `buttonItemMap` selectedItem resolve, `setStructuredOutput` 호출 검증
5. **[단기]** Chart 핸들러 `config`→`axes` 이름 변경으로 인한 downstream 표현식 참조 파괴 여부 확인 및 호환성 처리
6. **[단기]** `status` 필드 의미론적 오용 수정 — `status: 'completed'` 설정, 인터랙션 타입은 `meta.interactionType`에만 보관
7. **[단기]** `interactionType` 추출 로직 중복 제거 — `getInteractionType(context, nodeId)` 헬퍼 추출
8. **[단기]** `interactionType` 값 whitelist 검증 추가
9. **[단기]** `previousOutput` 저장 깊이 제한 (max depth 1) 또는 별도 내부 관리 구조로 분리
10. **[중기]** `waitForButtonInteraction` 책임 분리 — structured 캐시 갱신 로직 별도 메서드 추출
11. **[중기]** 이중 캐시 폴백 패턴에 `// TODO(Phase 3): remove after full migration` 주석 추가
12. **[중기]** `carousel-buttons.handler.spec.ts` `buttonItemMap` 생성 경로 테스트 추가, `chart-buttons.handler.spec.ts` `buttonConfig` 구조 검증 추가