# Resolution — ai-review 2026/06/21 21_26_26 (M-1 2단계 AiMemoryManager)

리뷰 결과: **Critical 0 / Warning 6 / INFO 13, 위험도 LOW**. behavior-preserving
리팩토링이라 기능 결함·보안 취약점 0. 아래는 main 직접 조치 + defer 판정.

## 수정 (이 PR 반영)

### WARNING #3 (Testing) — `ai-memory-manager.spec.ts` 전용 단위 테스트 신설 ✅
- **조치**: `ai-memory-manager.spec.ts` 신설 (14 케이스). #665 `AiConditionEvaluator`
  선례와 동형으로 매니저를 인스턴스 직접 호출해 고정.
  - `resolveMemoryStrategy`: 명시 값 3종 + **미지 문자열 → manual 폴백**(INFO #11) +
    키 부재/undefined → manual.
  - `scheduleMemoryExtraction`: manual/summary_buffer enqueue skip + agentMemoryService
    미주입 graceful no-op + persistent enqueue 수락 시 maxSeq 전진 + dedup drop(false)
    시 watermark 유지(AGM-08).
  - `injectMemoryContext`: 서비스 미주입 graceful(memory shape·recall 0·압축 0) +
    회수 실패 graceful degrade(recalledCount 0) + 회수 성공 recalledCount 반영 +
    scopeKey/topK/threshold/embedding config 호출 인자 + queryText 빈 값 시 systemPrompt
    폴백 + **tailMode=system-only 꼬리 재 prepend 금지**(§6.2 d.5) + **system 메시지
    없는 배열 insertAt 0 폴백**(INFO #12).
- **검증**: 14/14 PASS. 전체 unit 369 suites/7256 tests PASS(+14).

### WARNING #5 (Maintainability) — 이중 서비스 호출 혼동 여지 ✅
- **조치**: `getThreadExcludingNode`(요약·꼬리) vs `getThread`(물리 압축 경계)의 목적
  차이를 `// ── [keepUserExchanges 도출] ──` 섹션 주석으로 명시 (메서드 내 `// ── [5a]
  … ──` 스타일과 일치). "중복 호출 아님" 명문화.

## Defer — 의도된 설계·범위 외 (근거 기록)

### WARNING #1 (Architecture) — `IAiMemoryManager` 인터페이스 부재 → DEFER
- **근거**: 머지된 **#665 `AiConditionEvaluator` 가 정확히 같은 패턴**(인터페이스 없는
  무상태 collaborator)으로 착지했다. 본 2단계만 인터페이스를 도입하면 **방금 머지된
  sibling 과 불일치**하고, plan §M-1 Option A 가 명시한 "무상태 collaborator" 범위를
  넘는 scope creep 이 된다. behavior-preserving 추출과 직교. 리뷰어도 "M-1 완료 후 별도
  후속 이슈로 분리 가능" 으로 LOW·비차단 분류.

### WARNING #2 (Architecture) — 핸들러 생성자 `new AiMemoryManager(...)` (non-DI) → DEFER
- **근거**: `AiAgentHandler` 자체가 NestJS `@Injectable` provider 가 아니라 엔진 node
  bootstrap 이 **수동 인스턴스화**하는 핸들러다 — "NestJS provider 등록"이 직접 적용되지
  않는다. #665 `conditionEvaluator = new AiConditionEvaluator()` (field initializer)와
  동일 패턴 유지. 두 collaborator 의 DI 전환은 M-1 완료 후 일괄 검토가 자연스럽다.

### WARNING #4 (Maintainability) — `injectMemoryContext` 약 205줄 단일 함수 → DEFER
- **근거**: 핸들러에서 **verbatim 이동한 코드**다. private 헬퍼로 단계 분해하는 것은
  behavior-preserving 추출을 넘는 **신규 리팩토링**이며 동작 변경 위험을 새로 들인다(이번
  PR 의 불변식: logic 무변경). 리뷰어도 "현 섹션 주석이 최소 안전선" 으로 인정. 단계
  분해는 3단계(`AiTurnExecutor`) 이후 별도 후속 후보.

### WARNING #6 (Documentation) — spec frontmatter `code:` 미등재 → PLANNER 위임
- **근거**: spec 쓰기 권한은 planner 도메인(developer 는 `spec/` read-only). M-1 전체
  완료 시 `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` +
  `ai-memory-manager.ts` 일괄 등재 + §6.1 단계 1.3/1.5/2.7 구현 참조를 `AiMemoryManager`
  메서드로 갱신. plan "보류 중 별건(M-1 SPEC-DRIFT 누적)" 에 이미 기록됨.

## INFO (비차단 — 처리 메모)

- **#11 (resolveMemoryStrategy 폴백 미테스트)·#12 (no-system-message 경로)**: 신설
  spec 에 **커버 완료**.
- **#8·#9·#13 (SPEC-DRIFT — frontmatter code:·§6.1 구현 참조 stale)**: WARNING #6 과
  동일 planner 위임.
- **#1 (config `as` 캐스팅 런타임 검증 부재)·#3 (thread in-memory mutate TOCTOU)·#5
  (thread mutation vs 무상태 선언)·#6 (selfNodeId pass-through 미사용)**: 전부 핸들러에서
  **verbatim 이동한 기존 패턴** — 신규 위험 아님. 입력 검증 레이어·mutation 위임 분리는
  중장기 개선으로, behavior-preserving 추출 범위를 벗어나 본 PR 미반영.
- **#2 (catch 블록 workspaceId 구조화 로그)**: 로그 메시지 변경은 verbatim 이동 불변식을
  깨므로 미반영(추출 후속 개선 후보). queryText·메모리 내용 미노출은 현행 유지(올바름).
- **#4 (`_retry_state.json` 절대 경로)**: review/ 산출물의 기존 형식(모든 review 세션
  공통). gitignore 변경은 본 PR 범위 밖 — 별도 위생 작업 후보로만 기록.
- **#7 (resolveMemoryStrategy public 가시성)**: 매니저 분리로 메서드가 public 이 된 것은
  collaborator 호출부(핸들러) 접근을 위한 의도된 표면. 동작 무영향, spec 침묵.
- **#10 (review/ 산출물 코드 커밋 동봉)**: 규약(work instruction #7 — review/ 산출물
  커밋)상 허용 범위.

## Fresh review 필요
WARNING #3·#5 fix(test 신설 + 주석) 로 원 리뷰가 stale → fresh `/ai-review --commit HEAD`
재실행으로 0/0 수렴 확인 (production 로직 무변경이라 #1·#2·#4 재발화 없음 예상).
