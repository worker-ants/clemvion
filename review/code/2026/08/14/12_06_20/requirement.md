# 요구사항(Requirement) 리뷰 — `llmCalls` 깊이-무관 strip (4라운드 누적본, 최종 재검증)

이 changeset 은 이미 2라운드 ai-review(`10_32_27`, `11_02_16`) + 3라운드 consistency-check(`07_44_12`,
`10_32_29`, `11_02_18`)를 거쳐 CRITICAL 전부 조치된 상태다. 본 리뷰는 그 결과를 그대로 신뢰하지
않고, 최종 커밋(`b49ee4310`)까지 포함한 현재 소스를 직접 읽고 **독립적으로 재현**해 확인했다.

## 수행한 독립 검증

- `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `stripDeep`/`stripExternalOnlyFields`/
  `sanitizePayloadForWs` 전체를 `Read` 로 직접 열람 (diff 가 아니라 최종 소스).
- `npx jest src/modules/websocket/websocket.service.spec.ts` 전체 실행 — 40/40 통과 확인.
- **`11_02_16` CRITICAL 1 (리뷰어 넷의 결론이 갈렸던 depth 경계)을 직접 뮤테이션으로 재현**: `stripDeep`
  본문을 `return value;` no-op 으로 패치하고 `it.each([0,5,8,9,10,11,12])` depth 테스트만 재실행한 결과:
  - depth 0·5 → **RED** (strip 이 실제로 지운다)
  - depth 8·9·10·11·12 → **GREEN even without strip** (그 깊이의 값은 이미 `sanitizePayloadForWs`
    가 `'[REDACTED_DEPTH]'` 로 치환해 판별력이 없음)
  이는 `RESOLUTION.md`(`11_02_16`)와 테스트 JSDoc 이 주장하는 표와 **정확히 일치**한다 — 문서화된
  실측 주장이 재현 가능한 사실임을 직접 확인했다(재현 후 `git checkout --` 로 즉시 원복, 최종
  `git status`/`git diff` clean 확인 완료).
- 경계 연산자가 형제 함수와 실제로 통일됐는지 grep 으로 확인: `stripDeep` `:393`
  `if (depth > MAX_SANITIZE_DEPTH) return value;` vs `sanitizePayloadForWs` `:251`
  `if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';` — 동일 연산자 확인.
- `attachRoutingContext`(`:667-681`)가 strip **이후**에만 실행되고 `triggerId`/`workflowId`/
  `chatChannel` 만 shallow-merge 함을 확인 — strip 된 `llmCalls` 를 되살릴 경로 없음.
- `grep -n "TODO\|FIXME\|HACK\|XXX"` — diff 범위(`websocket.service.ts`/`.spec.ts`) 내 0건.

## 발견사항

- **[INFO]** WS spec 의 strip 선언 텍스트는 `ai_message`/EIA §6.5 문맥에 고정돼 있고, 실제 누출·수정
  대상이었던 `waiting_for_input`/EIA §6.2 는 어느 SoT 문서에도 텍스트로 명시되지 않는다 — spec
  본문 커버리지가 코드가 실제로 보호하는 범위보다 좁다.
  - 위치: `spec/5-system/6-websocket-protocol.md:519` (`llmCalls` strip 선언, `ai_message` 필드
    표 문맥 안) — 대조: `codebase/backend/src/modules/websocket/websocket.service.ts:293-301`
    (`EXTERNAL_STRIPPED_FIELDS` JSDoc, "이름 기반이라 이벤트 종류 무관하게 보호"라고 명시)
  - 상세: 코드는 `stripDeep` 을 `emitExecutionEvent`/`emitNodeEvent` 의 **모든** 이벤트 타입에
    무조건 적용해(이름 매칭이므로 이벤트 종류 무관) 이미 이 갭을 사실상 메웠고, 방향은 "spec 이
    권위인데 코드가 어긴다"가 아니라 **"코드가 spec 의 좁은 명시 범위보다 넓게, 더 안전하게
    동작한다"**이다. 즉 코드가 틀린 것은 아니다. 다만 spec 본문만 읽는 독자는 `waiting_for_input`
    도 strip 대상이라는 걸 명시적으로 확인할 수 없다.
  - 이미 추적됨 — 새 항목 아님: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의
    "### (7) `llmCalls` strip SoT 가 실제 누출 표면을 안 덮는다" 항목(같은 diff 에 신규 작성)이
    정확히 이 갭을 지적하고 WS §4.4 Rationale 제목 확장 + EIA §6.2 addendum 을 planner 인계
    항목(`[ ]`)으로 이미 등재해 뒀다. **[SPEC-DRIFT]** 로 재분류할 필요도 없다 — 코드가 spec 을
    "의도적으로 확장"했다기보다 이름-기반 설계 자체가 원래 전 이벤트를 덮게 돼 있고, spec 문서만
    아직 그 범위를 명문화하지 못한 상태이기 때문이다. 조치는 코드가 아니라 spec 반영(위 plan 항목이
    이미 지목한 대로 planner 턴)이다.
  - 제안: 별도 조치 불요 (이미 plan 에 planner 인계로 등재됨). 확인 목적으로만 기록.

- **[INFO]** 이번 라운드(`2ef826dc5` → `b49ee4310`)의 실제 diff 는 경계 연산자 통일(`>=`→`>`) +
  depth sweep 테스트 추가뿐이며, 그 결과가 "누출 없음"이라는 RESOLUTION 의 주장을 내가 직접 뮤테이션
  재현으로 검증했다 — 신규 기능 결함 없음.

## 기능 완전성 / 엣지 케이스 / 반환값 (직접 확인)

- `stripDeep` 은 array / null / non-object / object 4개 분기 모두에서 값을 반환한다 — 반환 누락
  경로 없음(`:387-427`).
- `__proto__` own-key 오염 방지: 스프레드(`{ ...obj }`) 로 시작 + `Object.defineProperty` 로 대입,
  bracket 대입 경로 없음 — `websocket.service.spec.ts` 의 전용 테스트가 `__proto__` **값 안에**
  strip 대상을 넣어(대입 분기를 실제로 태움) `hasOwnProperty`/`getPrototypeOf`까지 단언한다(판별력
  있음, 뮤테이션 확인).
- 깊이 상한(`MAX_SANITIZE_DEPTH`=10) 초과 시 조용히 원본을 그대로 반환(strip 시도 안 함) — 이는
  이미 `sanitizePayloadForWs` 가 그 깊이를 `'[REDACTED_DEPTH]'` 로 마스킹한 뒤이므로 실질 위험 없음
  (직접 뮤테이션으로 재확인).
- clone-on-write identity 보장: 제거할 것이 없으면 `out === null` 로 남아 원본 참조 그대로 반환 —
  최상위(`fanout.payload === wire`)·자식(`nodeOutput`) 양쪽 identity 를 테스트가 직접 단언
  (`:729-747` 부근, 자식 필드까지 커버).
- `EXTERNAL_STRIPPED_FIELDS` 매칭은 이름 기반이라 값 타입과 무관하게 삭제된다 — `llmCalls` 가 배열이
  아니어도(또는 존재만 해도) 삭제되는 설계로, "위치가 아니라 이름으로 막는다"는 의도된 동작과 실제
  구현이 일치.

## 비즈니스 로직 / spec fidelity

- WS §4.4(`6-websocket-protocol.md:519`), EIA §6.5, chat-channel CCH-MP-01 이 요구하는 "`llmCalls`
  는 예외 없이 모든 외부 fanout 수신자에서 strip" 요구사항을 이번 구현이 실제로 충족함을 코드 읽기 +
  뮤테이션 재현 양쪽으로 확인했다. 이전 상태(top-level-only depth-1 삭제)는 이 선언에 대한 실제
  spec 위반이었고(코드가 틀림, spec 이 권위), 이번 `stripDeep` 도입으로 해소됐다 — CRITICAL 아님
  (이미 고쳐진 상태).
- CHANGELOG.md 항목(`:3-24`)이 두 누출 경로·수신자·"선언이 참이 아니었다"는 사실·"이미 전송된
  데이터"라는 운영 영향까지 정확히 서술 — 코드/테스트와 line-level 로 어긋나는 부분 없음.
- `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 처분 체크리스트(`:149-191`)는 현재
  실제 구현 상태와 일치한다 — 완료 항목([x]: 실증 테스트·처방 채택·성능 실측)과 미완료 항목([ ]:
  이름 충돌 planner 인계·strip SoT 확장·identity 캐시·대용량 A/B·사후 대응 운영 판단)이 실제로
  구현되지 않은 것과 정확히 대응한다 — stale 체크박스 없음(직전 라운드 documentation WARNING 이
  `2ef826dc5` 로 이미 조치됨을 재확인).
- `plan/in-progress/eia-terminal-payload.md` (정본 종결 payload 작업, `error`/`durationMs`/
  `result.outputs`)는 이번 diff 와 무관하며 여전히 `--impl-prep BLOCK: YES` 로 명시적으로 막혀 있다
  — 이 diff 가 그 작업을 우회하거나 진행시키지 않았음을 직접 파일로 확인.

## 요약

핵심 요구사항("`llmCalls` raw debug payload 는 어느 중첩 위치에 있든 모든 외부 fanout 수신자에서
strip 되어야 한다")을 이번 구현이 실제로 충족한다는 것을 diff 재인용이 아니라 현재 소스 직접 열람 +
`jest` 전체 실행(40/40) + 직접 뮤테이션 재현(depth 0·5 RED, 8+ 판별력 없음 — RESOLUTION 주장과 일치)
으로 독립 검증했다. `__proto__` 오염 방지, 지연 할당, 경계 연산자 통일, identity 보존, 사후 운영
대응 추적까지 4라운드에 걸쳐 지적된 항목이 모두 실제 코드/plan 상태에 반영돼 있다. 유일하게 새로
기록할 만한 것은 spec 본문의 strip 선언이 텍스트상 `ai_message`/§6.5 에 좁게 고정돼 있고
`waiting_for_input`/§6.2 를 아직 명문화하지 않았다는 점인데(INFO), 코드는 이름 기반 설계로 이미 그
갭을 안전하게 덮고 있고 해당 gap 은 같은 diff 가 작성한 plan 문서에 planner 인계 항목으로 이미
등재돼 있어 새로운 조치가 필요하지 않다. 신규 CRITICAL/WARNING 없음.

## 위험도

NONE
