# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위 요약

이번 diff(`origin/main...HEAD`)는 실질적으로 다음으로 구성된다:

- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` — 종결 이벤트(`completed`/`failed`/`cancelled`) 전용 판별 union `TerminalEventPayload` + `emitTerminalExecution()` 파사드 신설.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `retry-turn.service.ts` — 기존 11개 `emitExecution(...)` 직접 호출부를 위 파사드 호출로 이관. `retry-turn.service.ts` 의 취소 종결 분기가 `cancelledBy: 'user'` 를 처음으로 채움.
- `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 1행(`result.cancelledBy`) 갱신 — "경로 1곳 누락" → "구현됨(2026-08-15 해소)".
- `plan/in-progress/eia-terminal-emit-facade.md`(신규) · `retry-turn-terminal-guard.md` · `spec-sync-external-interaction-api-gaps.md` 체크박스/서술 갱신.

코드가 실제로 만드는 wire 형태(`emitTerminalExecution` 내부 `wire: Record<string, unknown>` 조립)를 `spec/5-system/14-external-interaction-api.md` §6(종결 이벤트의 필드 집합 / 채널별 봉투 / `execution.cancelled` 행동 계약, 모두 normative)과 `spec/5-system/2-api-convention.md §5.4`(부재 표현 — `null` vs 키 생략)에 대조했다. 함께 커밋된 `execution-event-emitter.service.spec.ts` 의 신규 테스트(`error: null` 이어도 키 유지 / user cancel 은 `error` 키 자체 부재)까지 실제로 그 계약을 고정하고 있음을 확인했다.

## 발견사항

- **[WARNING]** `14-external-interaction-api.md` frontmatter `code:` 가 이번에 집중된 실제 구현 소유 파일을 가리키지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` (파일 상단)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = "본 spec 이 약속한 surface 의 구현 경로") · R-1(글로브는 "영역 단위 책임"을 자연스럽게 표현해야 한다는 취지)
  - 상세: §6 "종결 이벤트의 필드 집합 (normative)"·"채널별 봉투"·"`execution.cancelled` 의 행동 계약 (normative)" 세 절은 이 spec 문서가 SoT 로 명시한 절이다. 이번 PR 로 그 wire 조립 책임이 `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` 한 곳(`emitTerminalExecution`)으로 사실상 집중됐다. 그런데 `14-external-interaction-api.md` 의 `code:` 목록엔 `external-interaction/**` · `hooks/*` · `triggers/*` · 공유 유틸 3종만 있고 `execution-engine/**` 계열은 전혀 없다. `status: partial` 문서의 gate(`spec-code-paths.test.ts`, "≥1 매치 의무")는 다른 항목으로 이미 통과하므로 빌드는 깨지지 않지만(같은 파일이 `4-execution-engine.md` 의 `code: codebase/backend/src/modules/execution-engine/**` 글로브로는 커버된다), §6 을 실제로 구현하는 위치를 이 문서 frontmatter 만 보고는 찾을 수 없다 — R-1 이 명시한 "stale/부정확 글로브는 본 가드로 검출 불가, `/spec-coverage` 가 보완" 케이스에 정확히 해당한다.
  - 제안: `14-external-interaction-api.md` frontmatter `code:` 에 `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` (필요하면 `execution-engine.service.ts`/`retry-turn.service.ts` 도) 를 추가해 §6 normative 절의 구현 소재를 frontmatter 만으로 추적 가능하게 한다. 이 PR 의 diff 가 새로 만든 drift 는 아니고(이전부터 이 문서의 `code:` 는 §6 wire 조립 파일을 가리키지 않았다) 이번 리팩터로 조립 지점이 한 곳으로 좁혀지면서 정정 기회가 뚜렷해졌다는 정도로 이해하면 된다.

## 준수 확인 (참고 — 위반 아님)

다음은 이번 diff 가 규약을 정확히 지킨 지점으로, 별도 조치 불필요:

- `wire.error = payload.error`(failed, `null` 가능) — `null` 이어도 **키를 유지**한다 (`2-api-convention.md §5.4` 의 기본값 "null(키 present)"). 신규 테스트가 `'error' in wire === true` 로 이를 고정.
- cancelled 분기의 `if (payload.error) wire.error = payload.error;` — user cancel 은 `error` **키 자체가 없다**(§6 "`execution.cancelled` 의 행동 계약", `null` 이 아니라 부재). 신규 테스트가 `Object.keys(wire)` 로 키 목록을 직접 검사해 고정.
- `cancelledBy: 'user' | 'system' | 'timeout'` 닫힌 3값 union — §6 "닫힌 3값 union. 확장하지 않는다" 와 타입 수준에서 정확히 일치. `retry-turn.service.ts` 신규 `'user'` 값 근거(자매 `finalizeCancelledExecution` 과 동일 값, `error` 미동행과 자기정합)도 §6 매핑표와 모순 없음.
- `result.cancelledBy` 중첩(`{ result: { cancelledBy } }`) — "필드 집합 안쪽의 중첩을 펴지 않는다"(§6 "채널별 봉투") 준수.
- `status`/이벤트 타입을 `payload.type` 에서 파생 — 손으로 이중 스레딩하던 종전 형태(어긋나도 안 잡힘)를 컴파일 타임 판별 union 으로 대체. 명명(`emitTerminalExecution`/`TerminalEventPayload`)은 기존 `emitExecution`/`emitNodeEvent` 네이밍 패턴과 일관.
- DTO/Swagger 데코레이터 변경 없음 — 이 파사드는 WS/SSE/webhook 내부 wire 조립이라 REST DTO 표면이 아니고, `spec/conventions/swagger.md`(§1-3 optional 필드 데코레이터 규약)의 적용 대상이 아니다. 위반도 아니고 우회도 아니다(애초 대상이 아님).
- 새 에러 코드·문자열을 도입하지 않음 — `spec/conventions/error-codes.md` §1 명명 규율(의미 기반, `UPPER_SNAKE_CASE`)에 저촉될 신규 표면이 없음.
- 신규 plan(`eia-terminal-emit-facade.md`) frontmatter — `worktree`/`started`/`owner`/`branch`/`spec_impact`(리스트) 모두 충족(`.claude/docs/plan-lifecycle.md` §4 · Gate C).

## 요약

이번 diff 는 종결 이벤트(`completed`/`failed`/`cancelled`) emit 을 판별 union 파사드로 초크포인트화하는 리팩터로, `spec/5-system/14-external-interaction-api.md §6`(정식 normative 절)과 `spec/5-system/2-api-convention.md §5.4`(부재 표현 규약)를 코드·신규 테스트 양쪽에서 정확히 재현하고 있다. 새로 도입된 에러 코드·DTO·API 표면이 없어 `error-codes.md`/`swagger.md` 저촉 여지도 없다. 유일하게 지적할 사항은 `14-external-interaction-api.md` frontmatter `code:` 가 이번에 §6 wire 조립을 사실상 전담하게 된 `execution-event-emitter.service.ts` 를 가리키지 않는다는 점인데, 이는 빌드 가드를 깨지 않는 pre-existing 부정확성이고 `spec-impl-evidence.md` R-1 이 이미 "글로브 방식의 알려진 약점, `/spec-coverage` 가 보완"으로 분류한 종류다.

## 위험도
LOW
