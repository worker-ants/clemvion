# 보안(Security) 리뷰

## 스코프

이번 diff(`f9d31041d..HEAD` 중 `codebase/**`)는 이미 여러 라운드를 거친 정보 노출 수정의
연속이다: (1) 외부 WS fanout(SSE/webhook/chat-channel)에서 `llmCalls`(raw LLM
요청/응답 — 시스템 프롬프트·대화 이력·사용자 입력)를 depth-1 shallow delete 만 하던 것을
깊이 무관 재귀 strip 으로 교체, (2) 같은 데이터의 **또 다른 출구**인
`InteractionService.getStatus`(REST 스냅샷)가 `deepRedactSecrets`(값 마스킹)만 거쳐
같은 필드를 그대로 돌려주던 것을 발견해 `stripExternalOnlyFields` 를 공유 유틸로 승격,
REST 쪽 waiting/terminal 세 출구(`nodeOutput`/`result`/`error`)를 `redactAndStrip` 헬퍼로
통합. 코드 자체를 직접 열어 실제 병합 상태로 검증했다(프롬프트의 truncate 된 diff 대신).

## 발견사항

- **[WARNING]** REST 경로(`redactAndStrip`)의 strip→redact 순서가 depth 경계에서
  안전한지가 **코드 논증에만 의존**하고, 그 논증을 검증하는 실행 테스트가 없다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` —
    `redactAndStrip` 함수(임포트부 근처, `stripExternalOnlyFields`/`MAX_REDACT_DEPTH`
    사용) / `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts` —
    `'deepRedactSecrets 와의 순서를 바꿔도 결과가 같다'` 테스트
  - 상세: `redactAndStrip` 은 `deepRedactSecrets(stripExternalOnlyFields(value, MAX_REDACT_DEPTH))`
    로 **strip 을 먼저** 돌린다. `stripExternalOnlyFields` 는 `depth > maxDepth` 에서
    멈추고(그 이하 depth 는 필드명 검사), `deepRedactSecrets` 는 `depth >= MAX_REDACT_DEPTH`
    에서 서브트리 전체를 `'***'` 로 wholesale 치환한다 — 두 함수가 서로 다른 경계
    연산자(`>` vs `>=`)를 쓰고, 게다가 REST 경로는 (WS fanout 경로와 반대로) strip 이
    redact **앞에** 온다. 직접 depth 별로 손으로 추적한 결과, 이 조합 자체는 실제로
    안전하다 — `deepRedactSecrets` 가 depth 10 인 노드를 자기 내부를 보기도 전에
    통째로 문자열로 collapse 하므로, strip 이 depth 11+ 에서 검사하지 않고 넘어간
    `llmCalls` 가 있어도 그 노드의 조상(depth 10)이 redact 단계에서 전부 지워진다.
    다만 **이 조합은 이번 diff 에서 처음 도입된 새 호출 순서**이고, WS fanout 쪽
    (`stripDeep`/`sanitizePayloadForWs`)이 정확히 이 클래스의 결함(depth 경계 관련
    리뷰어 간 결론 충돌 → 실행 sweep 으로 해소, 커밋 `b49ee4310`)을 이미 한 번 겪었는데도
    REST 쪽엔 `it.each([0, MAX-5, MAX-3, MAX-2, MAX-1, MAX, MAX+1, MAX+2])` 같은
    깊이 경계 sweep 테스트가 없다. 존재하는 `strip-external-only-fields.spec.ts` 의
    순서-불변 테스트는 top-level·1-depth 수준의 얕은 fixture 만 사용해 이 경계를
    실제로 통과하지 않는다. 이 저장소는 "코드 논증이 실행보다 여러 번 틀렸다" 는
    선례(같은 PR 내 `b49ee4310` 커밋 메시지: "리뷰어 넷이 갈린 깊이 경계를 실행으로
    갈랐다")를 스스로 남긴 만큼, 같은 클래스의 안전 주장이 이번엔 코드 읽기로만
    남아 있는 것은 회귀 위험이다(예: 누군가 `MAX_REDACT_DEPTH` 나 `deepRedactSecrets`
    의 경계 연산자를 바꾸면 이 불변식이 조용히 깨질 수 있는데 그걸 잡을 테스트가 없다).
  - 제안: `websocket.service.spec.ts` 의 depth sweep 테스트(`MAX_SANITIZE_DEPTH` 상대값,
    `0..MAX+2`)와 동형으로 `interaction.service.spec.ts` 또는
    `strip-external-only-fields.spec.ts` 에 `MAX_REDACT_DEPTH` 기준 depth sweep 을 추가해
    "코드 논증"을 "실행 증거"로 바꿔 둔다.

- **[INFO]** 이미 유출된 데이터에 대한 사후 대응이 CHANGELOG 에만 기록되어 있고 운영
  판단(통지 여부)이 plan 항목으로 추적 중임을 확인 — 코드 결함은 아니며 이미
  `spec-draft-eia-62-waiting-payload.md` 체크리스트에 "확인할 것" 항목으로 등재돼 있다.
  추가 조치 불필요, 참고로만 남긴다.

## 검증한 항목 (문제 없음 확인)

- **Prototype pollution (CWE-1321)**: `stripDeep`(`strip-external-only-fields.ts`)의
  object 분기는 `out ??= { ...obj }` (스프레드) 후 `Object.defineProperty` 로만 값을
  쓰고 bracket 대입(`out[k] = v`)을 쓰지 않는다. `JSON.parse` 로 만든 own `__proto__`
  키가 있어도 프로토타입이 갈리지 않고 값도 보존됨을 두 스펙 파일(`strip-external-only-fields.spec.ts`,
  `websocket.service.spec.ts`)이 뮤테이션 테스트(스프레드→`{}` 되돌리는 뮤턴트에서 RED)로
  판별력까지 확인해 뒀다.
- **WS fanout 경로의 depth 경계**: `sanitizePayloadForWs`(`depth > MAX_SANITIZE_DEPTH`)와
  `stripDeep`(같은 `>` 로 통일, 커밋 `b49ee4310`)의 경계가 일치하고, `0..MAX+2` 전 구간
  sweep 테스트로 raw 내용 미노출을 실측 확인했다. 판별력 없는 구간(깊은 쪽)도 그 이유를
  뮤테이션으로 실측해 문서화했다.
- **REST 경로 세 출구(`nodeOutput`/`result`/`error`) 대칭성**: 이전 라운드에 waiting 만
  strip 되고 terminal(`result`/`error`)이 비대칭이던 CRITICAL 이 있었는데, 이번 diff 는
  `redactAndStrip` 공용 헬퍼로 세 출구가 같은 코드를 부르게 해 구조적으로 재발이 어렵게
  만들었다 — 대응 테스트(`it.each(['completed','failed'])`)로 확인.
  `interaction.service.ts` 전체에서 `deepRedactSecrets`/`stripExternalOnlyFields` 를 부르는
  자리 3곳(waiting `nodeOutput`, terminal `result`, terminal `error`) 전부가
  `redactAndStrip` 을 거치는지 grep 으로 확인 — 누락 없음.
- **fanout 소비 경로**: `notification-fanout.service.ts` 는 `event.payload` 를 변환 없이
  싣고, `chat-channel.dispatcher.ts` 는 `WebsocketService.executionEvents$` 구독으로
  이미 strip 이 끝난 payload 만 받는다 — 두 경로 모두 별도의 raw `outputData` 접근이 없음을
  grep 으로 확인, 새 우회 경로 없음.
- **하드코딩 시크릿·인젝션·인증/인가**: 이번 diff 는 순수 JS 객체 트리 변환(필드 삭제/값
  마스킹)이라 SQL/커맨드/경로 인젝션 표면이 없고, 새 자격증명이나 토큰 하드코딩도 없다.
  IEXT 토큰 기반 인증/인가 로직 자체는 이 diff 의 변경 대상이 아니다.
- **재귀 DoS**: `stripDeep`/`deepRedactSecrets` 모두 `maxDepth`/`MAX_REDACT_DEPTH` 를
  함수 진입부에서 먼저 검사해 재귀 깊이가 상수로 유계(최대 ~11)이므로, 공격자가 제어하는
  대화 이력/사용자 입력으로 깊이 폭탄을 넣어도 스택 오버플로 DoS 로 이어지지 않는다.

## 요약

핵심 보안 수정(외부 fanout·REST 두 출구 모두에서 `llmCalls` raw 프롬프트/이력을 깊이
무관으로 제거)은 실제로 존재하던 정보 노출 취약점을 정확히 막는다. 이전 라운드에서 지적된
prototype pollution·비대칭 terminal 분기·깊이 경계 연산자 불일치는 모두 코드 확인 및
실행 테스트(뮤테이션 포함)로 재현·해소가 확인됐다. 유일하게 남는 것은, 이번 diff 가 새로
도입한 REST 경로의 strip-then-redact 순서가 depth 경계에서 안전하다는 주장이 코드
논증으로는 참이지만(직접 검증함) 이 저장소가 같은 클래스의 주장을 실행으로 여러 번
반증해 온 선례에 비해 실행 증거(depth sweep 테스트)가 아직 없다는 테스트 커버리지 갭
하나뿐이다. 이는 현재 살아있는 취약점이 아니라 향후 회귀를 잡아줄 안전망의 부재이므로
WARNING 으로 기록한다.

## 위험도

LOW
