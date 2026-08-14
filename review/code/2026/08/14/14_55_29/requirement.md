# 요구사항(Requirement) 리뷰

## 컨텍스트

이번 diff(HEAD `7fa12301c`, 이전 여러 라운드 `10_32_27`→`11_02_16`→`12_06_21`(consistency)→
`14_30_35`/`14_30_36`(ai-review+consistency)를 거쳐 누적)는 `execution.waiting_for_input`
fanout·EIA REST `getStatus()` 양쪽에서 debug 전용 `llmCalls`(raw LLM 요청/응답 — 시스템
프롬프트·대화 이력)가 **중첩 위치**(`payload.turnDebug.llmCalls.llmCalls[]`,
`payload.nodeOutput.meta.turnDebug[].llmCalls[]`)와 **REST 스냅샷 경로** 양쪽에서 새고
있던 것을 막는다. 세 출구(waiting `nodeOutput`, terminal `result`, terminal `error`)를
`redactAndStrip` 한 헬퍼로 묶어 "한 출구만 고쳐지는" 재발 패턴을 구조적으로 차단했다.

기능적으로는 코드가 의도한 보안 수정을 정확히 구현하고 있고, 테스트(`strip-external-only-
fields.spec.ts`, `websocket.service.spec.ts`, `interaction.service.spec.ts`)가 참조 동일성·
비변형·깊이 경계·`__proto__` 안전·순서 동일성·세 출구 각각의 누출 부재를 모두 커버한다.
이전 라운드들이 이미 CRITICAL(누출 경로 3건)·WARNING(성능/문서/경계연산자) 다수를 잡아
조치했으므로, 본 라운드에서는 **spec 본문과의 line-level 정합**에 집중해 새로 발견된
것만 아래에 적는다.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `spec/5-system/14-external-interaction-api.md` §R17 "표면
  제약(보안)" 이 `getStatus()` 의 실제 동작보다 좁게 서술돼 있다 — `stripExternalOnlyFields`
  (필드 삭제)를 언급하지 않는다
  - 위치: `spec/5-system/14-external-interaction-api.md:1349-1352` (`getStatus 는 nodeOutput
    전체 + terminal result(COMPLETED)/error(FAILED)의 outputData 를 deepRedactSecrets 로
    마스킹한다(REST 는 sanitizePayloadForWs 미적용 경로라 필수). 마스킹은 secret-shape 만
    치환(정상 결과 데이터는 copy-on-change 로 보존).`) ↔ 코드는
    `codebase/backend/src/modules/external-interaction/interaction.service.ts` 의
    `redactAndStrip`(`stripExternalOnlyFields` 로 필드 자체를 삭제 + `deepRedactSecrets` 로
    값 마스킹, 두 단계 병행)를 `nodeOutput`/`result`/`error` 세 출구 모두에 적용한다.
  - 상세: spec 은 "secret-shape 만 치환"(값 마스킹)이라고만 서술하는데, 실제로는 그 전에
    `llmCalls` **필드 자체**를 깊이 무관으로 삭제한다. 이 diff 가 고친 CRITICAL 자체가 바로
    "`deepRedactSecrets` 만으로는 필드가 남아 raw 프롬프트가 샌다"는 문제였으므로, spec 본문이
    이 diff 이전 동작을 그대로 서술하고 있어 코드와 어긋난다. 이는 **코드가 틀린 게 아니라
    spec 이 낡은 경우**다 — `plan/in-progress/spec-draft-eia-62-waiting-payload.md:119-141`
    (항목 `(7) llmCalls strip SoT 가 실제 누출 표면을 안 덮는다`)가 정확히 이 정정
    ("§R17 정정… 코드가 spec 을 앞질러 있다")을 planner 인계 항목으로 이미 등재해 뒀지만,
    이번 diff 는 `spec/` 파일을 건드리지 않아(`git diff origin/main...HEAD -- spec/` 무변경)
    spec 본문 자체는 아직 정정되지 않은 채로 남아 있다.
  - 제안: 코드 변경 불필요 — `project-planner` 턴에서 §R17 을 "`deepRedactSecrets`(값 마스킹) +
    `stripExternalOnlyFields`(필드 삭제) 를 병행하며, 세 출구(waiting `nodeOutput`/terminal
    `result`/terminal `error`) 전부에 적용된다"로 갱신. plan draft 항목 (7)이 이미 이 처방을
    적어 뒀으므로 그대로 반영하면 된다.

- **[WARNING]** `[SPEC-DRIFT]` `spec/5-system/6-websocket-protocol.md` §4.4 blockquote 의
  "strip 대상은 본 WS 이벤트 필드뿐" 서술이 이제 사실이 아니다 — REST `getStatus()` 도 같은
  헬퍼로 strip 한다
  - 위치: `spec/5-system/6-websocket-protocol.md:519` (`따라서 llmCalls 는 워크스페이스
    인증·ownership 으로 게이트된 내부 WebSocket 채널(execution:{executionId})에만
    전달되고, 모든 외부 fanout 수신자 — external-interaction SSE 스트림(iext_*/itk_* 토큰으로
    인증), notification webhook, chat-channel 아웃바운드 — 에서는 strip 된다. … (strip 대상은
    본 WS 이벤트 필드뿐이며, DB 영속 경로 NodeExecution.output_data.meta.turnDebug[i].llmCalls
    및 그를 출처로 하는 실행 이력 디버그 패널은 영향 없다.)`) ↔ 코드는 REST 스냅샷 응답
    (`InteractionService.getStatus`, WS 이벤트가 아님)도 동일 `stripExternalOnlyFields` 를
    거친다.
  - 상세: 이 blockquote 는 "strip 은 WS 이벤트 전용" 이라고 한정하는데, 이번 diff 로 REST
    엔드포인트도 (DB 영속 컬럼 자체가 아니라 그 컬럼을 읽어 외부로 내보내는 REST 응답 사본에)
    같은 strip 을 적용하게 됐다. CHANGELOG 항목(`CHANGELOG.md` Unreleased 최상단)도 "WS §4.4
    는 이 필드가 '모든 외부 수신자에서 strip 된다' 고 선언하고 있었다 — 선언이 참이 아니었다"
    라고 스스로 이 spec 문구의 불일치를 지적하고 있다. `plan/in-progress/spec-draft-eia-62-
    waiting-payload.md:130-132` 가 정확히 "§4.4 의 'strip 대상은 본 WS 이벤트 필드뿐' 도
    'WS fanout + EIA REST `getStatus()` 양쪽' 으로 확장 — 코드가 이미 그렇게 하고 있다"로
    같은 정정을 planner 인계로 이미 적어 뒀다.
  - 제안: 코드 변경 불필요 — spec 정정은 `project-planner` 턴. plan draft 항목 (7)의 처방을
    그대로 적용(§4.4 Rationale 제목·본문 확장 + `getStatus()` 명시).

- **[INFO]** REST 경로(`redactAndStrip` → `stripExternalOnlyFields(value, MAX_REDACT_DEPTH)`)에는
  fanout 경로(`websocket.service.spec.ts` 의 `it.each([0, MAX-5, MAX-3, MAX-2, MAX-1, MAX,
  MAX+1, MAX+2])` 깊이 sweep)와 대칭인 깊이 경계 sweep 테스트가 없다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`
    (신규 테스트 2건 — 고정 얕은 depth 의 `nodeOutput.meta.turnDebug[0].llmCalls[0]`) 대비
    `codebase/backend/src/modules/websocket/websocket.service.spec.ts:830-859`
  - 상세: REST 경로도 fanout 과 동일하게 두 함수(`stripExternalOnlyFields` `>` / `deepRedactSecrets`
    `>=`)의 경계 연산자가 1단 어긋나 있고, 안전 근거("자매가 그 깊이에서 이미 객체를 collapse")도
    동일한 구조다(`strip-external-only-fields.ts:31-40` JSDoc). fanout 쪽은 `11_02_16` CRITICAL 로
    실행 sweep 까지 해서 실증했지만, REST 쪽은 얕은 depth 케이스만 있어 같은 경계 불변식이
    REST 경로에서도 실제로 지켜지는지 직접 실행으로 확인된 적이 없다(구조가 동일하므로 실무
    위험은 낮다고 추정되나, 이 프로젝트가 "논증 대신 실행" 을 반복해서 강조해 온 곳이라
    언급해 둔다).
  - 제안: 필수는 아님(구조적으로 fanout 과 동형이라 위험 낮음) — 여유가 있으면
    `interaction.service.spec.ts` 에도 `MAX_REDACT_DEPTH` 상대값 기반 sweep 1~2건을 추가해
    REST 경로도 동일 수준으로 실증하면 좋음.

## 확인했으나 문제 없음

- 세 출구(waiting `nodeOutput` / terminal `result` / terminal `error`) 모두
  `redactAndStrip`(`interaction.service.ts:95-105`, `:376`, `:438`, `:442`)을 거치며, DTO
  타입(`ExecutionStatusDto.result`/`error`: `Record<string, unknown> | null`)과 반환값이
  일치한다. `null`/`undefined` outputData 는 `redactAndStrip` 이 `null` 로 정규화(엣지케이스
  처리).
- `stripExternalOnlyFields`/`stripDeep` 은 `__proto__` own-property 오염 없이 동작 — 스프레드
  기반 방어를 실제 뮤테이션 테스트(`{}` 로 되돌리는 뮤턴트 RED)로 판별력까지 확인됨
  (`strip-external-only-fields.spec.ts:72-98`, `websocket.service.spec.ts:762-793`).
  TODO/FIXME/HACK/XXX 주석 없음(grep 확인).
- 순서 무관성(strip→redact vs redact→strip 결과 동일)을 대조 테스트로 고정
  (`strip-external-only-fields.spec.ts:105-125`), 실제 코드는 성능상 strip 을 먼저 수행
  (`interaction.service.ts:97-101` 주석 근거).
- `websocket.service.ts` 의 fanout 경로(`emitExecutionEvent`/`emitNodeEvent`)도 동일 헬퍼로
  일원화됐고(`:454-457`, `:528-531`), 내부 WS wire 채널은 strip 되지 않는 대조군 테스트로
  고정됨(`websocket.service.spec.ts:589-601`).
- `turnDebug`(top-level object, AI turn1 스냅샷) vs `nodeOutput.meta.turnDebug`(배열, WS
  §4.4:449 정본) 이름 충돌은 이 diff 의 범위 밖으로 이미 명시적으로 분리·`planner` 인계됐다
  (`plan/in-progress/spec-draft-eia-62-waiting-payload.md:191-197`, `10_32_29`
  naming_collision CRITICAL 1) — 코드 결함이 아니라 추적된 잔여 항목.

## 요약

핵심 기능(waiting/terminal 세 출구 모두에서 `llmCalls` 를 깊이 무관으로 strip + 값 마스킹)은
정확히 구현됐고, 여러 라운드에 걸쳐 실행 기반 검증(깊이 sweep, `__proto__` 뮤테이션, 순서
동일성)으로 판별력까지 확인된 상태다. 반환값·에러 시나리오·엣지 케이스(빈/`null` outputData,
경계 깊이)는 기존 DTO 계약과 일치하며 TODO/FIXME 류 미완성 표식도 없다. 다만 이 보안 수정이
**spec 본문보다 앞서 나갔다** — `spec/5-system/14-external-interaction-api.md` §R17("secret-shape
만 치환")과 `spec/5-system/6-websocket-protocol.md` §4.4 blockquote("strip 대상은 본 WS 이벤트
필드뿐")가 모두 이 diff 이전 동작을 서술한 채로 남아 있다. 둘 다 `plan/in-progress/spec-draft-
eia-62-waiting-payload.md` 에 정확한 처방과 함께 이미 planner 인계 항목으로 등재돼 있어 새로운
미지의 결함은 아니지만, 이번 diff 자체가 `spec/` 파일을 건드리지 않았으므로 그 정정은 아직
반영되지 않은 상태(SPEC-DRIFT)로 남아 있다. 코드를 되돌릴 이유는 없고, 다음 `project-planner`
턴에서 두 spec 문서를 갱신하면 해소된다.

## 위험도

LOW
