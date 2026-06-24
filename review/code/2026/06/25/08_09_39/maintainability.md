# 유지보수성(Maintainability) 리뷰

## 발견사항

### 테스트 파일 (`ai-turn-executor.spec.ts`)

- **[INFO]** 신규 테스트 케이스의 구조가 기존 유사 케이스(`counts only normal tools, not condition tools...` single-turn)와 대칭적으로 잘 작성되었다.
  - 위치: `describe('processMultiTurnMessage (resume loop)')` 블록, line 389-422 (전체 파일 기준)
  - 상세: mock 설정 → `buildExecutor()` → state 구성 → 호출 → assertion 패턴이 single-turn 대응 케이스와 동형(isomorphic)이어서 비교 독해가 용이하다.
  - 제안: 현행 유지.

- **[INFO]** 인라인 타입 단언(`as { toolCalls: number }`, `as Record<string, unknown>`)이 테스트 전반에서 반복된다.
  - 위치: line 94 (`const next = result._resumeState as { toolCalls: number }`), 동일 패턴이 line 368, 464 등
  - 상세: 기존 테스트 전체에서 이미 사용하는 관용구로, 이번 diff 가 새로 도입한 것이 아니다. `_resumeState`의 타입이 `unknown`이기 때문에 불가피한 패턴이다.
  - 제안: 현행 유지. 향후 `_resumeState` 타입을 전용 인터페이스로 좁히면 제거 가능.

- **[INFO]** 테스트 설명 문자열이 한국어 인라인 주석과 영어 `it(...)` 레이블을 혼용한다.
  - 위치: `it('does not count condition tools toward toolCalls in multi-turn, only normal tools', ...)` + 위 한국어 블록 주석(line 386-388)
  - 상세: 프로젝트 전체에서 사용되는 일관된 컨벤션(한국어 설명 주석 + 영어 `it` 레이블)이므로 이번 커밋이 새로 도입한 불일치가 아니다.
  - 제안: 현행 유지.

---

### 구현 파일 (`ai-turn-executor.ts`)

- **[INFO]** `TOOL_BUDGET_EXCEEDED_ERROR` 상수 도입으로 인라인 문자열 리터럴 `'tool_call_budget_exceeded'` 제거.
  - 위치: 상수 선언부(line 1392), `executeProviderToolBatch` 사용부(line 1804), `recordSingleTurnNonProviderToolResults` 사용부(line 2029)
  - 상세: 매직 스트링을 명명된 상수로 교체한 표준적 개선. JSDoc이 "LLM-internal 신호 vs 공개 에러코드" 레이어 차이를 명확히 설명하여 수정 시 혼동을 예방한다.
  - 제안: 현행 유지.

- **[INFO]** `condRouteDurationMs` 변수를 단일 캡처로 통일(single-turn: `handleSingleTurnConditionRoute`, multi-turn: `processMultiTurnMessage` condition 분기).
  - 위치: `handleSingleTurnConditionRoute` line 2143, multi-turn condition 분기 line 2813 대응
  - 상세: `Date.now()` 이중 호출 제거로 `totalDurationMs`와 `turnDebug[].totalDurationMs`가 동일 시각을 참조하게 되어 관측 일관성 향상. 변수명 `condRouteDurationMs`는 용도를 명확히 나타낸다.
  - 제안: 현행 유지.

- **[INFO]** `recordMultiTurnNonProviderToolResults` JSDoc의 잘못된 INVARIANT 블록 제거.
  - 위치: diff `-783~-784` (삭제된 `INVARIANT (03 C-2 review W6/INFO-5)` 주석)
  - 상세: 이전 INVARIANT 주석은 "single-turn 과 의도적으로 다름 — 동기화 금지"라는 잘못된 정보를 문서화하고 있었다. 제거하고 올바른 정책("단일 정책, 동일 동작")으로 교체했다. 잘못된 주석이 유지보수 시 더 큰 위험이었으므로 올바른 변경이다.
  - 제안: 현행 유지.

- **[INFO]** JSDoc 스펙 참조 경로가 짧은 앵커(`§3.f-g`) → 완전 경로(`spec/4-nodes/3-ai/1-ai-agent.md §6.1.f-g`)로 교체되었다.
  - 위치: `recordSingleTurnNonProviderToolResults` JSDoc, `recordMultiTurnNonProviderToolResults` JSDoc, 인라인 주석 등
  - 상세: 짧은 앵커는 파일 맥락 없이는 해독 불가능하다. 완전 경로로 바꾸면 다른 파일에서 참조해도 스펙 위치를 추적할 수 있다. 기존 코드베이스에 두 스타일이 혼재하지만, 완전 경로 방향이 유지보수에 유리하다.
  - 제안: 현행 유지. 향후 나머지 짧은 앵커도 점진적으로 완전 경로로 전환 권장.

- **[INFO]** `recordMultiTurnNonProviderToolResults` 내 condition 루프에서 `toolCallCount++` 단순 제거.
  - 위치: diff `-799` (삭제된 `toolCallCount++`)
  - 상세: 제거된 줄 하나가 버그의 전부였으며, 삭제 후 코드 흐름이 단순해졌다. 나머지 로직(deferral 메시지 push)은 변경 없이 유지되어 의도를 파악하기 쉽다.
  - 제안: 현행 유지.

---

## 요약

이번 변경은 spec 표류(W7 SPEC-DRIFT) 수정을 핵심으로 하며, 유지보수성 관점에서 전반적으로 긍정적이다. `toolCallCount++` 단일 제거라는 최소 수정으로 버그를 해소했고, 이를 뒷받침하는 JSDoc·인라인 주석이 변경 이유와 정책 SoT(spec §7.1 / §6.1.f-g)를 명확히 기록했다. 잘못된 INVARIANT 주석 제거로 코드와 문서의 불일치가 해소되었으며, 매직 스트링의 상수화와 `Date.now()` 이중 호출 단일화는 소규모지만 정확한 개선이다. 신규 테스트 케이스는 기존 단짝 케이스(single-turn)와 완전히 대칭적인 구조를 취해 향후 동작 비교 검증을 용이하게 한다. 발견사항은 모두 INFO 수준이며 현행 코드베이스 컨벤션을 준수한다.

## 위험도

NONE
