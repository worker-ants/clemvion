# 성능(Performance) Review

## 대상
- `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`

변경 성격: M-7 리팩터 — `credentialStripSubsetShape` / `resumeStateSchema` 의 일부 필드를
`z.unknown()` → `z.custom<T>()` 로 sharpen 하고, 소비처(`ai-turn-executor.ts`)의
`(state.xxx as Foo[])` 류 domain 캐스트를 `resumeState.xxx` (타입만 좁힌 참조)로
치환. 런타임 로직·제어 흐름·배열 연산은 변경되지 않은 순수 컴파일타임 리팩터.

## 발견사항

- **[INFO]** `z.custom<T>()` 는 기존 `z.unknown()` 대비 함수 호출 오버헤드가 있으나 재개 경로 전체 비용 대비 무시 가능
  - 위치: `resume-state.schema.ts:48, 64-65` (`messages`/`turnDebugHistory`/`allPresentations` 필드)
  - 상세: `z.custom<T>(fn?)` 는 fn 인자를 생략하면 항상 `true` 를 리턴하는 predicate 로 zod 파서가 매 원소/필드마다 함수 호출을 1회 수행한다. 반면 `z.unknown()` 은 predicate 호출 없이 즉시 통과시킨다. 다만 이 스키마는 파일 상단 주석대로 **`parse`/`safeParse` 를 런타임 경계에서 호출하지 않는다** — 오직 (a) `z.infer` 타입 파생, (b) 단위 테스트의 allow-list drift oracle 용도로만 실제 파싱이 실행된다. multi-turn 프로덕션 실행 경로(`ai-turn-executor.ts`)에서는 이 스키마의 `.parse()`가 호출되지 않으므로 turn 당 오버헤드는 0에 가깝다.
  - 제안: 현재 설계 의도(런타임 미검증)가 유지되는 한 조치 불필요. 향후 누군가 이 스키마에 `.parse()` 호출을 추가한다면(§7.5 graceful-reset 계약 위반이기도 하므로 별도 이슈), `messages` 배열이 긴 멀티턴 대화(수백 턴)에서 `z.custom` predicate 가 원소 수만큼 호출되는 비용을 재검토해야 한다.

- **[INFO]** `ai-turn-executor.ts` 의 캐스트 제거는 런타임에 영향 없는 순수 컴파일타임 변경
  - 위치: `ai-turn-executor.ts:254, 263, 273, 284, 290, 299, 309, 319, 330-377` (다수 `resumeState.xxx` 치환 지점)
  - 상세: diff 전부가 `(state.field as T)` → `resumeState.field` (사전에 `const resumeState = state as ResumeState` 로 1회 좁힌 참조) 형태로, spread(`...prevHistory`, `...resumeState.allPresentations`), 배열 길이 검사, `??` fallback 등 실행 시 동작은 100% 동일하다. `state as ResumeState` 캐스트 자체도 TS 컴파일타임 연산이라 런타임 비용이 없다(V8 은 타입 단언을 완전히 소거).
  - 제안: 조치 불필요. 기존에 우려됐던 "매 turn 마다 새 배열 생성" 패턴(`[...prevHistory, ...]`, `[...(state.allPresentations ?? []), ...presentationPayloads]`)은 이번 diff 이전부터 존재하던 것으로 이번 변경으로 새로 도입되지 않았다 — 참고로만 기록.

- **[INFO]** `turnDebugHistory`/`allPresentations` 배열의 turn-누적 방식은 리뷰 대상 diff 범위 밖의 pre-existing 패턴
  - 위치: `ai-turn-executor.ts:263-266, 273-275` (`prevHistory`/`allPresentations` spread 누적)
  - 상세: 매 turn 마다 `[...prevHistory, newEntry]` 로 배열 전체를 복사해 재생성하므로 turn 수 n 에 비례해 O(n) 복사가 매 turn 마다 발생 → 전체 대화 기준 O(n²) 누적 비용. 다만 이는 이번 diff 로 변경된 로직이 아니라 캐스트만 걷어낸 것이며, 파일 내 주석(`MAX_RESUME_RAG_SOURCES = 200`, `MAX_TURN_DEBUG_HISTORY`)을 보면 이미 상한 cap 정책이 별도로 적용되어 있어 무제한 성장은 아니다. 이번 리뷰의 diff 범위에서 새로 만들어진 회귀는 아니므로 CRITICAL/WARNING 으로 잡지 않는다.
  - 제안: 조치 불필요(범위 밖). 참고로만 남김 — 이미 cap 이 걸려있어 실질 위험 낮음.

## 요약
이번 변경은 zod 스키마의 `z.unknown()` 필드 일부를 `z.custom<T>()` 로 바꿔 `z.infer` 타입만 sharpen 하고, 소비 코드의 `as Foo[]` 도메인 캐스트를 제거한 **behavior-preserving 타입 전용 리팩터**다. 해당 스키마는 런타임 경계에서 `parse`/`safeParse` 를 호출하지 않는다는 설계 계약(파일 상단 주석·§7.5 graceful-reset)이 그대로 유지되므로, `z.custom` predicate 호출 오버헤드는 프로덕션 실행 경로에 유입되지 않는다. `ai-turn-executor.ts` 쪽 변경도 캐스트 표현만 바뀌었을 뿐 배열 spread·조건문·제어 흐름은 1바이트도 달라지지 않아 알고리즘 복잡도, N+1 호출, 메모리 할당, 캐싱, 블로킹 I/O, 데이터 구조 선택 그 어느 관점에서도 새로운 리스크가 없다. 성능 관점에서는 사실상 no-op 리팩터로 판단된다.

## 위험도
NONE
