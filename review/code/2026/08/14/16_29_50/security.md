### 발견사항

- **[INFO]** 이번 라운드(`16_29_50`)의 실제 애플리케이션 코드(`interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts` + 각 spec)는 직전 다수 리뷰 라운드(`10_32_27`→`11_02_16`→`12_06_20`→`14_30_35`→`14_55_29`→`15_58_26`)에서 이미 CRITICAL 0 으로 수렴한 상태이며, 이번 라운드에 새로 추가된 커밋(`d0b6c4136`, `4b13ca5ae`, `5eb12695a`, `dfc63bbb7`, `a78ab029e`)은 전부 `docs`/spec/plan 문서 정정과 회귀 테스트 보강(`interaction.service.spec.ts` null 분기 2건)뿐이고 strip/redact 로직 자체는 변경되지 않았다
  - 위치: `git diff origin/main...HEAD -- codebase/` (파일 6개, `interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts` + spec 3개) — 마지막 로직 변경 커밋은 `7fa12301c`
  - 상세: 직접 소스를 열어 확인한 결과 다음이 성립한다.
    1. `codebase/backend/src/shared/utils/strip-external-only-fields.ts`(`stripDeep`, 함수 시작 `105`행) — 깊이 무관 재귀 strip. `depth > maxDepth` (`106`행)에서 멈추며, 이는 형제 `sanitizePayloadForWs`(`codebase/backend/src/modules/websocket/websocket.service.ts:252` `depth > MAX_SANITIZE_DEPTH`)와 동일 연산자(`>`)로 실측 확인됨(리뷰 라운드 `11_02_16`~`12_06_20`가 리뷰어 넷의 판정 불일치를 실제 파이프라인 실행 + 뮤테이션 테스트로 해소했음).
    2. `__proto__` 오염 방지 — 삭제/치환 분기 모두 `out ??= { ...obj }`(스프레드, CreateDataProperty 시맨틱)로 own data property 를 만든 뒤에만 `delete out[k]`/`Object.defineProperty(out, k, ...)`를 쓰고, bracket 대입(`out[k] = s`)은 명시적으로 금지한다(`strip-external-only-fields.ts:130-142` 주석). `strip-external-only-fields.spec.ts:72-98`, `websocket.service.spec.ts` (`payload 에 __proto__ 키가 있어도 값 손실·프로토타입 오염이 없다`) 양쪽에서 `Object.getPrototypeOf(...) === Object.prototype` 및 전역 `({}).polluted === undefined` 를 직접 단언해 CWE-1321(Prototype Pollution)을 회귀 테스트로 고정했다.
    3. `codebase/backend/src/modules/external-interaction/interaction.service.ts` — REST `GET /api/external/executions/:id` 의 waiting `nodeOutput`(`stripAndRedact(nodeExec.outputData) ?? {}`), terminal `result`/`error`(`stripAndRedact(execution.outputData)`) 세 출구 모두 `stripAndRedact` 헬퍼(`interaction.service.ts:95` 부근 `function stripAndRedact`)를 공유해 strip(필드 삭제)+redact(값 마스킹) 이중 방어를 받는다. null 처리(두 컬럼 모두 nullable)는 헬퍼 1곳으로 집약됐고 `interaction.service.spec.ts`에 terminal 2건(`result`/`error` → `{}` 아닌 `null`)·waiting 1건(`?? {}` 로 graceful) 회귀 테스트가 각 분기를 뮤테이션(`return null`→`return {}`)으로 판별력까지 확인한 상태로 존재한다.
    4. `websocket.service.ts` `emitExecutionEvent`/`emitNodeEvent` 두 fanout 경로 모두 `stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)`를 거친 뒤에만 `executionEventSubject`(SSE 어댑터/notification webhook/chat-channel dispatcher가 구독)로 나가고, 인증된 내부 에디터 WS 채널(`gateway.broadcastToChannel`)은 strip 이전의 `wireEnvelope`(full payload)를 그대로 받는다 — 대조군 테스트(`wire envelope (에디터 WS) 는 llmCalls 를 그대로 포함`, `strip 은 wire envelope 를 변형하지 않는다`)로 두 채널의 분리가 고정돼 있다.
    5. 깊이 경계 sweep(`websocket.service.spec.ts:830-859`, depth 0·`MAX-5`·`MAX-3`·`MAX-2`·`MAX-1`·`MAX`·`MAX+1`·`MAX+2`)과 REST sweep(`strip-external-only-fields.spec.ts:149-170`, `MAX_REDACT_DEPTH` 상대값)이 각각 자기 파이프라인 순서(WS: redact 상한이 뒤에서 collapse / REST: strip 이 먼저)로 raw marker 문자열이 어느 깊이에서도 fanout JSON 에 남지 않음을 실측했고, strip 을 no-op 으로 만든 뮤턴트로 각 표본의 판별력(RED 여부)까지 별도로 검증해 "통과했지만 실제로는 아무것도 안 지키는" 테스트를 판별력 있는 것으로 잘못 세지 않았다.
  - 제안: 조치 불요 — 재확인 목적의 기록.

- **[INFO]** 프로덕션 로그(`websocket.service.ts:407-411`, `:473-475`)는 `executionId`/`triggerId`/`chatChannel.provider`/`chatChannel.conversationKey`/`seq`/`routing` 상태만 기록하고 `llmCalls`/payload 본문은 남기지 않는다 — 에러 메시지·로그를 통한 2차 유출 경로 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:407-411`, `:472-476`
  - 상세: 이번 diff 범위 안에서 새로 추가되거나 변경된 로그 구문이 없으며, 기존 로그도 식별자/상태값만 다룬다. `interaction.service.ts` 쪽도 `stripAndRedact`가 예외를 던지는 경로가 없어(입력 방어적 — null/undefined 조기 반환) 에러 핸들러가 raw payload 를 노출할 새 표면을 만들지 않는다.
  - 제안: 없음(positive finding).

- **[INFO]** 하드코딩된 시크릿·자격증명 없음, 신규 인젝션 벡터(SQL/커맨드/경로탐색/LDAP) 없음
  - 위치: 변경 파일 6개 전수 확인(`interaction.service.ts`/`.spec.ts`, `websocket.service.ts`/`.spec.ts`, `strip-external-only-fields.ts`/`.spec.ts`)
  - 상세: 변경은 순수 in-memory 객체 순회/치환(`stripDeep`, `stripAndRedact`)과 그 배선뿐이며, DB 쿼리·쉘 명령·파일 경로·외부 URL 조합을 새로 만들지 않는다. 테스트의 `__proto__` fixture 는 `JSON.parse` 로 만든 순수 데이터이고 실행 코드(`eval` 등)가 아니다.
  - 제안: 없음.

- **[INFO]** 인증/인가 경로에 변경 없음 — REST `getStatus`/WS fanout 모두 기존 토큰 기반 접근 제어(`iext_*`/`itk_*`, workspace ownership) 하위에서 응답 **내용**만 좁혔다
  - 위치: `interaction.service.ts` `getStatus` 메서드 진입부(가드 로직은 diff 밖, `interaction.guard` import 유지) — 이번 diff 는 가드를 우회하거나 추가하지 않고 이미 인가된 응답의 payload 필드만 제거한다.
  - 상세: 이 결함 자체는 "인가되지 않은 접근" 이 아니라 "인가된 접근자에게 과다 노출"(excessive data exposure, OWASP API3:2023)이었고, 이번 diff 는 정확히 그 축(필드 최소화)만 다룬다. 인증/세션/토큰 검증 로직 자체는 손대지 않았다.
  - 제안: 없음.

- **[INFO]** (운영 판단 필요, 코드 결함 아님) 이미 스트립 이전 코드로 전송된 데이터는 이번 수정으로 회수되지 않는다
  - 위치: `CHANGELOG.md` Unreleased 절 (`> 영향 범위: 두 경로로 나간 데이터는 **이미 전송된 것**이다…`)
  - 상세: 결함이 존재했던 기간 동안 fanout(SSE/webhook/chat-channel)·REST 스냅샷으로 나간 raw 프롬프트/대화 이력은 외부 통합자가 이미 저장했을 수 있다. 코드 리뷰 범위 밖(사후 대응은 운영/보안팀 판단)이나, `CHANGELOG.md`에 이미 명시적으로 기록돼 있어 정보 누락은 아니다.
  - 제안: 코드 조치 불필요. 워크스페이스별 민감도에 따라 키/토큰 로테이션·통합자 통지 등 운영 대응 여부를 별도로 판단할 것(이미 plan에 등재됨, `12_06_20` RESOLUTION INFO 2 참조).

### 요약

핵심 보안 결함(WS fanout·REST 스냅샷 양쪽에서 `waiting_for_input`/terminal `outputData` 의 `turnDebug.llmCalls`가 depth-1 strip 또는 값-마스킹만 거쳐 외부 SSE·webhook·chat-channel·REST 폴링 수신자에게 raw LLM 프롬프트/대화 이력이 노출되던 정보 노출 취약점, OWASP API3 과다 데이터 노출류)는 이번 브랜치 내 다수 라운드(`10_32_27`부터 `15_58_26`까지)를 거치며 이름 기반·깊이 무관 재귀 strip으로 완전히 해소됐고, 이번 최종 라운드(`16_29_50`)에 새로 추가된 커밋은 로직 변경 없이 문서 정합화와 null 분기 회귀 테스트 보강뿐이다. 직접 소스를 열어 확인한 결과 (1) 세 출구(WS fanout emitExecutionEvent/emitNodeEvent, REST waiting/terminal result/error) 모두 공유 헬퍼로 통일돼 있고, (2) `__proto__` 오염 방지가 스프레드+defineProperty 조합과 전용 회귀 테스트로 고정돼 있으며, (3) 깊이 경계는 자매 sanitizer와 연산자까지 일치하고 실제 파이프라인 실행 + 뮤테이션 테스트로 판별력이 검증됐다. 새로운 인젝션 벡터, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 로그 노출은 발견되지 않았다. 유일하게 남은 사안은 코드 결함이 아닌 운영 판단(이미 유출된 과거 데이터에 대한 사후 대응)이며 이미 CHANGELOG에 명시돼 있다.

### 위험도
NONE
