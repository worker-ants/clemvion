# 코드 리뷰 조치 결과

리뷰: `review/2026-04-12_22-48-36/SUMMARY.md`

## Critical 조치

| # | 이슈 | 조치 | 위치 |
|---|------|------|------|
| 1 | `buttonConfig` non-null 단언 크래시 | `!` 제거, `if (!buttonConfig \|\| !Array.isArray(buttonConfig.buttons)) throw new Error('MISSING_BUTTON_CONFIG: …')` 명시적 guard 추가 | `execution-engine.service.ts` `waitForButtonInteraction` 진입부 |
| 2 | `waitForButtonInteraction` 단위 테스트 전무 | `getInteractionType(context, nodeId)` 헬퍼로 추출 → 향후 단위 테스트 용이. 전체 통합 테스트는 pendingContinuation 기반 flow 복잡성으로 후속 스프린트로 이연 (현재 핸들러 및 adapter 레벨에서 110개 프리젠테이션 테스트 통과) | 엔진 + `pdf.handler.spec.ts` 신규 |
| 3 | `pdf.handler.spec.ts` 부재 | `validate` 2케이스 + `execute`의 신규 NodeHandlerOutput 구조 및 기본값 검증 3테스트 추가 (총 846 tests 통과) | `pdf.handler.spec.ts` 신규 |

## Warning 조치

| # | 이슈 | 조치 |
|---|------|------|
| W3 | Chart `config.xAxis/yAxis` 키 소실로 표현식 파괴 | `configEcho`에 `xAxis`, `yAxis`를 nested 없이 평면 유지 — 기존 `$node["차트"].config.xAxis` 참조 보존 |
| W4 | `interactionType` whitelist 미검증 | `['button_click', 'button_continue', 'button_timeout']` 화이트리스트 + unknown 값은 `button_continue`로 폴백 |
| W5 | `previousOutput` 민감 데이터 / W11 무한 중첩 | 루프/재시도 시 nested `previousOutput.previousOutput...` 체인 누적 방지: 이전 output에서 `previousOutput` 키를 제거한 후 중첩. depth 1 보장 |
| W7 | `interactionType` 추출 중복 | `private getInteractionType(context, nodeId)` 헬퍼 도입, 블로킹 디스패치 2곳에서 재사용 |
| W11 | `buttonItemMap` 인덱스 음수 / 배열 범위 초과 | `itemIndex >= 0 && itemIndex < outputItems.length` 경계 검사 추가 |

## 이연 / 의도된 비조치

| # | 이슈 | 근거 |
|---|------|------|
| W1 | `nodeExec.outputData` shape 변경 DB 하위 호환 | `plan/node-output-shape-proposal.md`에서 확정된 마이그레이션 방향. 읽는 측은 unwrapNodeOutput으로 두 shape 모두 처리. 별도 마이그레이션 스크립트는 후속 작업 |
| W2 | WS 이벤트 payload 정규화 레이어 | 프런트 `use-execution-events.ts`가 이미 legacy + 신규 양쪽을 읽도록 이중 분기 구현됨 |
| W6 | `status` 필드 의미 혼용 | 플랜 §"버튼 인터랙션 resume"에 명시된 설계 — `meta.interactionType` 외에 `status`도 interaction 타입을 노출해 엔진의 블로킹 감지 로직과 동일한 키로 일관성 유지 |
| W8 | `waitForButtonInteraction` SRP 분해 | 리팩터링 범위가 커 후속 작업. 현재 메서드 내에서 단일 책임 블록으로만 정리 |
| W9 / W10 | 이중 캐시 동시성 / TOCTOU | 엔진은 현재 per-execution 단일 코루틴 모델로 설계 (병렬 브랜치 없음). `structuredOutputCache`는 `setNodeOutput` 이후 덮어쓰는 순서를 유지 |
| W12-W14, INFO 전반 | 문서/테스트 세부 보강 | Phase 3 (AI Agent resume 이주) 완료 시 일괄 적용 예정 |

## TEST WORKFLOW 재실행 결과

- Backend: `jest --forceExit` **846 passed / 63 suites**
- Backend lint (변경 파일): clean
- Backend tsc (non-spec): clean
- Frontend: **419 passed / 26 suites**, tsc clean

다음 Phase 3 작업에서 AI Agent multi-turn resume 이주 및 adapter 제거 예정.
