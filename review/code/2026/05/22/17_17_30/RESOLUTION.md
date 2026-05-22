# RESOLUTION — 17_17_30

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (CRITICAL) | 코드 | 09ce5bbe | execution.ai_message WS 이벤트에 presentations 필드 추가 — waiting/terminal 양쪽 emit 경로 |
| #2 (CRITICAL) | 코드+doc | 09ce5bbe | render_form phase 2b 미구현 상태를 ai.mdx / ai.en.mdx 에 명시 |
| #3 (WARNING) | 코드 | 09ce5bbe | presentationSchemaViolation 타입에 toolCallId 추가 — spec §7.10 join 지원 (4곳 갱신) |
| #5 (WARNING) | 코드 | 09ce5bbe | overlayDefaults(payload, null) → null 을 undefined 와 동일 처리, LLM payload 보존 |
| #8 (WARNING) | 코드 | 09ce5bbe | approxByteSize(capped.payload) 이중 호출 → cappedBytes 지역변수로 캐싱 |
| #9 (WARNING) | 테스트 | 09ce5bbe | render-tool-provider.spec: overlayDefaults null, chart 1MB cap, toolCallId 검증 케이스 추가 |
| #10 (WARNING) | 테스트 | 09ce5bbe | conversation-thread.service.spec: appendAiAssistantMessage presentations 파라미터 3케이스 |
| #11 (WARNING) | 테스트 | 09ce5bbe | conversation-utils.test: ai_user turn presentations 무시 검증 케이스 추가 |
| #12 (WARNING) | 테스트 | 09ce5bbe | (포함 — #9와 동일 커밋) |
| S1-S4 | spec | (draft 위임) | `plan/in-progress/spec-fix-presentation-overkill-refs.md` |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4477 passed)
- e2e   : 통과 (98/98)

## 보류·후속 항목

### deferred 코드 항목 (향후 리팩터링 권고)

- WARNING #4: schema 위반 retry 1회 강제 게이트 미구현 — handler tool-call loop 에 per-toolName 재시도 카운터 추가 필요. 복잡한 handler 변경으로 별도 PR 권고.
- WARNING #6: defaults 필드 z.record(z.string(), z.unknown()) 크기 미제한 — ai-agent.schema.ts 의 presentationToolDefSchema.defaults 에 max byte 제한 추가 검토.
- WARNING #7: applyOneMbCap O(n) tail-pop 루프 → 이진 탐색 또는 샘플링 기반 slice 로 교체 권고. 실제 서비스에서 수천 행 table 에 CPU 스파이크 가능성.
- WARNING #13: PresentationType 이중 정의 (backend conversation-thread.types.ts / ai-agent.schema.ts / frontend conversation-utils.ts) → 단일 소스로 통합하는 구조적 리팩터링.
- WARNING #14: render-tool-provider.ts 가 presentation 노드 schema 를 직접 import — 레이어 경계 위반. shared schema 패키지 분리 권고.
- WARNING #15: execution-store.ts re-export 블록 — 실제 legacy 소비자 확인 후 불필요 시 제거.
- WARNING #16: pushAiThreadTurn 시그니처 undefined 플레이스홀더 → options 객체 리팩터링.
- WARNING #17: presentationCalls/violations 인라인 타입 3곳 중복 → PresentationCallTrace / PresentationSchemaViolation 타입 export 통일.
- WARNING #18: applyOneMbCap carousel/table 분기 중복 → tailTruncateArray 헬퍼 추출.
- WARNING #19: execute 메서드 다중 책임 → makeSchemaViolationResult 헬퍼 추출.
- WARNING #20: jsonSchemaCache 모듈 레벨 가변 전역 → RenderToolProvider 인스턴스 필드로 이동.
- WARNING #21: documentation 개선 (applyOneMbCap JSDoc, execute 주석 강화).

### spec draft 위임

- spec 오기재 수정 4건: `plan/in-progress/spec-fix-presentation-overkill-refs.md`
  - S1: 1-ai-agent.md §6.1.d.i `data.presentations[]` → `top-level presentations[]`
  - S2: 0-common.md §10.1 `chartNodeConfigSchema` → `chartConfigSchema`
  - S3: 0-common.md §10.4 `data.presentations[i].truncation` → `presentations[i].truncation`
  - S4: 1-ai-agent.md §12.4 Rationale v1 bullet 동일 수정

### ai-agent.handler.spec.ts 테스트 커버리지 (INFO)

- WARNING #9 에서 render-tool-provider.spec.ts 수준 테스트는 추가했으나, `ai-agent.handler.spec.ts` 에서의 handler 레벨 orchestration 통합 테스트 (presentationPayloads 누적·retry 흐름) 는 handler spec 파일 규모 상 별도 PR 에서 추가 권고.
