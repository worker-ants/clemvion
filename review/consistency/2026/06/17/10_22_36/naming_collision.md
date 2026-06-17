# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/4-execution-engine.md` (구현 완료 후 검토, diff-base=claude/engine-split-s2-aiturn)

신규 도입 식별자:
- 서비스 클래스: `ButtonInteractionService`, `FormInteractionService`
- 필드명: `formInteraction`, `buttonInteraction` (ExecutionEngineService 주입 프로퍼티)
- 에러 식별자: `MISSING_BUTTON_CONFIG`, `INVALID_BUTTON_ID`
- 로컬 타입: `structuredInteraction` (지역 변수)

---

### 발견사항

*(충돌 없음 — 이하 INFO 레벨 관찰 사항만)*

- **[INFO]** `processFormResumeTurn` / `processButtonResumeTurn` 메서드 이동 후 spec 참조
  - target 신규 식별자: 두 메서드가 `FormInteractionService` / `ButtonInteractionService` 로 이동됨
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/5-system/4-execution-engine.md` 라인 941–942, 959 및 `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/data-flow/3-execution.md` 라인 164 에서 두 메서드 이름이 여전히 `ExecutionEngineService` 소속인 것처럼 서술되어 있음
  - 상세: spec 본문은 "form → `processFormResumeTurn`, button → `processButtonResumeTurn`" 이라고 메서드 이름만 나열하고 서비스 귀속을 명시하지 않아 현재 구현과 사실적으로는 일치한다. 다만 data-flow 시퀀스 다이어그램(`spec/data-flow/3-execution.md` 라인 164)은 `Eng->>Eng: ... → 직접 처리기(processFormResumeTurn / processButtonResumeTurn ...)`로 엔진 자기 호출처럼 표기되어 있어 추출 후 실제 흐름(`Eng->>FormInteraction` / `Eng->>ButtonInteraction`)과 다이어그램이 미묘하게 어긋난다.
  - 제안: 식별자 충돌은 아니나, 추후 spec sync 작업 시 시퀀스 다이어그램의 행위자 표기를 갱신하면 읽는 사람의 혼선을 줄일 수 있다. 현 검토 범위(충돌 검출)에서는 차단 필요 없음.

- **[INFO]** `previousOutput` 필드 중복 가능성 — 충돌 아님, 의도된 레거시 이행
  - target 신규 식별자: `ButtonInteractionService.processButtonResumeTurn` 내 `previousOutput` 필드 삽입
  - 기존 사용처: `loop-executor.ts` 의 지역 변수 `previousOutput`은 다른 스코프의 독립 변수. spec `conventions/node-output.md` 의 CONVENTIONS §4.2 가 "퇴역 대상(Phase 3 precondition)"으로 명시
  - 상세: 코드 주석이 `previousOutput` 을 레거시 이행 필드로 명확히 표시하고 있으므로 신규 의미 충돌은 없다. 기존 `loop-executor.ts` 의 동명 로컬 변수와 네임스페이스가 완전히 분리되어 있다.
  - 제안: 충돌 없음.

---

### 요약

신규 도입된 `ButtonInteractionService` / `FormInteractionService` 클래스명, `ENGINE_DRIVER` 토큰 재사용, `MISSING_BUTTON_CONFIG` / `INVALID_BUTTON_ID` 에러 식별자, 이벤트 이름(`execution.waiting_for_input` / `execution.resumed` / `execution.node.completed`) 모두 기존 코드베이스 및 spec 에서 다른 의미로 사용 중인 식별자와 충돌하지 않는다. 새 서비스 두 개는 `AiTurnOrchestrator` 와 동일한 패턴(ENGINE_DRIVER 토큰, forwardRef 순환 DI)을 그대로 따르고 있어 명명 일관성도 유지된다. spec/data-flow 시퀀스 다이어그램의 행위자 표기가 추출 후 실제 흐름을 즉시 반영하지 못하는 점이 확인됐으나, 이는 메서드 이름 충돌이 아닌 다이어그램 동기화 지연이므로 식별자 충돌 관점의 차단 사항이 아니다.

### 위험도

NONE
