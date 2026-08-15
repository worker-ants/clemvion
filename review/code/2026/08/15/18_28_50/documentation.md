# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `CHANGELOG.md` 신규 항목이 wire 변화(`retry-turn` cancelled 경로에 `result.cancelledBy` 신규 emit)를 명확히 고지하고 수신자 영향까지 서술 — 직전 라운드(`17_54_32` documentation WARNING#1)가 지적했던 CHANGELOG 누락이 실제로 해소됐음을 확인했다.
  - 위치: `CHANGELOG.md:3`(`## Unreleased — 종결 emit 타입 초크포인트 + retry-turn cancelledBy 누락`)
  - 상세: `Read` 로 파일을 직접 열어 대조한 결과, 저장소가 이 커밋 계열에서 지켜온 스타일(변경 요지 → wire 변화 고지 → 수신자 영향)을 그대로 따랐다. 신규 필드 추가라는 사실, 기존 `chat-channel.dispatcher.ts` 가 `result` 부재를 `{}` 로 방어해 무해하다는 근거도 담겨 있다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/retry-turn-terminal-guard.md` W1 항목의 "절반만 취소선" 결함(`17_54_32` documentation WARNING#2)이 문단 전체를 감싸는 방식으로 실제로 고쳐졌다.
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md:311`~`317` (`> **옛 서술(전문 보존, 전부 해소됨)**` 부터 옛 문단 끝의 `~~...함께 갱신 필요.~~`까지 취소선이 문단 전체를 감쌈)
  - 상세: 직접 파일을 열어 확인 — `~~` 가 라벨 단어가 아니라 인용 문단 전체(마지막 "deep-equality 단언도 함께 갱신 필요" 문장 포함)를 감싸도록 수정됐고, 재발 방지를 위해 그 사실 자체를 문단 안에 메타 설명으로 남겼다.
  - 제안: 조치 불요.

- **[INFO]** 동일 라운드가 지적한 "SoT 표 #2 행 미갱신"(WARNING#3)도 `retry-turn-terminal-guard.md` "코드 — 우선순위 순" 표에서 실제로 "**P2 완료**"로 갱신됐고, `spec/5-system/14-external-interaction-api.md` §6 필드 표의 `result.cancelledBy` 행도 취소선+해소 근거로 함께 갱신됐다(코드-스펙-plan 3자 동기화 확인).
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md:372`(표 #2 행), `spec/5-system/14-external-interaction-api.md:579`
  - 상세: `grep`/`Read` 로 표 행과 spec 행을 대조 — 둘 다 "완료" 상태와 `eia-terminal-emit-facade.md` 참조로 일관되게 갱신되어 있다.
  - 제안: 조치 불요.

- **[INFO]** `ExecutionEventEmitter` 클래스 JSDoc 삭제(`17_54_32` scope WARNING#4)가 원문 그대로 복구되고, 신규 `TerminalEventPayload` 타입 JSDoc은 타입 선언 위로 분리됐다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:51`(클래스 JSDoc, "C-6 strangle step 1" · thin wrapper 서술 보존) 및 `:11`(타입 JSDoc, 별도 블록)
  - 상세: 파일을 직접 열어 두 JSDoc 블록이 모두 존재함을 확인했다. 클래스 JSDoc 끝에 "단, 종결 3종은 thin wrapper 가 아니다" 한 문단만 추가돼 파사드 도입 사실을 반영한다.
  - 제안: 조치 불요.

- **[INFO]** `retry-turn.service.spec.ts` 의 `TYPE_TO_EVENT` 매핑 중복(`17_54_32` maintainability WARNING#5)이 모듈 스코프 단일 선언으로 정리됐다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:49`(단일 선언), `:799`·`:966`(두 헬퍼가 동일 상수 참조)
  - 상세: `grep -n "TYPE_TO_EVENT"` 결과 정의가 1곳뿐이고 두 지점에서 참조만 함을 확인. 주석("한 곳에만 둔다 — 두 describe 에 복제했더니 한쪽만 갱신될 위험이 지적됐다")도 근거를 남겼다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/eia-terminal-emit-facade.md` 설계 절의 메서드명·타입 드리프트(`17_54_32` maintainability/documentation INFO)도 실제 구현과 통일됐다.
  - 위치: `plan/in-progress/eia-terminal-emit-facade.md:71`(`emitTerminalExecution(executionId, payload)`), `:78`(`error: TerminalErrorPayload | null`)
  - 상세: 파일을 직접 열어 확인 — 이전 초안 이름(`emitTerminalExecutionEvent`)과 non-nullable `error` 표기가 실제 구현(`emitTerminalExecution`, `error: TerminalErrorPayload | null`)과 일치하도록 수정됐다.
  - 제안: 조치 불요.

- **[INFO]** 코드 JSDoc 의 SoT 참조(`spec/5-system/14-external-interaction-api.md` §6·§6.5)가 실제 spec 섹션 제목과 일치함을 확인했다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:14`(`TerminalEventPayload` JSDoc), spec 측 `## 6. API 명세 — Outbound Notification`(spec:560), `### 6.4 페이로드 — execution.failed`(spec:769), `### 6.5 페이로드 — execution.cancelled / execution.ai_message`(spec:807)
  - 상세: `grep`으로 spec 섹션 번호·제목을 직접 대조해 참조가 정확함을 확인했다. `retry-turn.service.ts` 의 `cancelledBy: 'user'` 근거 주석이 인용하는 "동일 트리거를 처리하는 자매 `finalizeCancelledExecution` 도 같은 값을 쓴다"도 `execution-engine.service.ts:4945` 에서 실제로 `cancelledBy: 'user'` 를 씀을 확인해 사실과 부합한다.
  - 제안: 조치 불요.

- **[INFO]** README·API 문서·환경변수 문서는 이번 변경 범위 밖(내부 emit 파사드 리팩터 + 기존 결함 흡수, 외부 REST/웹훅 엔드포인트·설정 신규 추가 없음)이라 갱신이 필요 없다고 판단했다 — grep 확인 결과 관련 README 파일 변경 없음, 새 환경변수 없음.
  - 위치: 해당 없음(범위 확인용 grep 결과)
  - 제안: 조치 불요.

## 요약
이 diff 는 직전 리뷰 라운드(`17_54_32`)가 지적한 문서화 WARNING 2건(CHANGELOG 누락, plan 취소선 미완결)과 인접 카테고리 WARNING/INFO(클래스 JSDoc 삭제, SoT 표 미갱신, 테스트 상수 중복, plan 메서드명 드리프트)를 이번 커밋에서 전부 흡수했다. 단순히 RESOLUTION.md 의 "조치 완료" 서술을 신뢰한 것이 아니라 각 항목을 `Read`/`grep` 으로 직접 열어 실제 코드·plan·spec 파일 상태를 대조했고, 전부 주장대로 반영돼 있음을 확인했다. 코드 레벨 JSDoc(`TerminalEventPayload`, `emitTerminalExecution`)은 SoT 링크·과거 결함 번호(#1170/#1171)·순환 import 회피 이유를 정확히 서술하며, 신규 테스트(`execution-event-emitter.service.spec.ts`)의 주석은 스스로 틀렸던 판별력 주장(jest vs tsc)까지 정정해 남겨 정직한 기록을 유지한다. README/API 문서/환경변수 문서는 이번 변경 범위 밖으로 갱신 불요가 타당하다. 새로 발견된 CRITICAL/WARNING 급 문서화 결함은 없다.

## 위험도
NONE
