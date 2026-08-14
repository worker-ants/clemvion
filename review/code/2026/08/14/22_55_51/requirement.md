# 요구사항(Requirement) Review — EIA 종결 `error` payload 객체화

## 검토 범위

핵심 코드 변경(파일 1~9): `chat-channel.dispatcher.ts`/`.spec.ts`, `chat-channel/types.ts`,
`execution-engine.service.ts`/`.spec.ts`, `retry-turn.service.ts`/`.spec.ts`, 신규
`terminal-error-payload.ts`/`.spec.ts`. 부가 파일(10~22): plan 문서 + 이전 consistency-check
세션 산출물(참고용, `--impl-prep` 스코프). SoT: `spec/5-system/14-external-interaction-api.md`
§6.4(execution.failed payload), `spec/5-system/2-api-convention.md` §5.4(null vs 키 생략),
`spec/5-system/15-chat-channel.md` CCH-ERR-04, `spec/1-data-model.md` §2.14.

검증 방법: 9개 파일 전문을 `Read`, 관련 spec 문서(§6.4/§5.4/CCH-ERR-04/§2.14) 원문 대조,
`toTerminalErrorPayload` 4개 호출부(execution-engine.service.ts ×3, retry-turn.service.ts ×1)
소스 직접 추적, 관련 unit test 3개 스위트 실행(98+43+448 = 589 tests, 전부 pass), 대상 파일
`eslint --max-warnings 0` 통과 확인, `Execution.error` 전체 write-site grep(9곳)으로 `nodeId`
미기록 주장 실측 검증.

## 발견사항

- **[WARNING]** plan 체크리스트가 이 diff 자체가 완료한 작업("구현 + 테스트")을 반영하지 못하고 있다
  - 위치: `plan/in-progress/eia-terminal-payload.md:226` (그리고 `:225`, `:227`, `:228`)
  - 상세: 파일 12(`eia-terminal-payload.md`)의 diff 는 "재판정 ③" 절과 "동반 필수"/"범위" 체크리스트
    재구성만 건드리고, 문서 맨 아래 실행 체크리스트(`:217~228`)는 손대지 않았다. 그런데 그 체크리스트의
    `- [ ] 구현 + 테스트`(`:226`)가 가리키는 작업은 정확히 이번 diff(파일 1~9: `error` 4곳 객체화 +
    `null` 정규화 + `types.ts` companion 동기화 + dispatcher wrap 정리)가 이미 완수한 것이다 — 9개
    파일의 unit test 589건이 전부 통과하고 lint 도 clean 하다. `:227`(`/ai-review` 필요)도 이 리뷰
    자체가 그 단계이므로 사실상 진행 중이다. 이 프로젝트 자체 관례(plan 체크박스 = 실제 상태, 수행
    후에만 체크)에 비추면 이 diff 가 push 되는 시점엔 `:225~226` 이 실제 상태를 반영하지 못한 채
    남는다 — 다음 사람이 이 문서만 보고 "아직 구현 전" 으로 오판할 수 있다. companion plan 3개
    동시 갱신(`:228`)도 미수행.
  - 제안: 이 turn(또는 push 직전)에 `:225~226` 을 체크하고, `:228` 이 지시하는 3개 자매 plan
    (`spec-sync-external-interaction-api-gaps.md` 등)의 관련 체크박스도 동시 갱신. 기능 코드 결함은
    아니므로 CRITICAL 은 아니다.

- **[INFO]** `chat-channel.dispatcher.ts` 의 §6.4 object hot-path 분기는 필드 타입을 런타임 검증하지 않는다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:551~553`
    (`if (errorRaw && typeof errorRaw === 'object') { error = errorRaw as typeof error; }`)
  - 상세: `toTerminalErrorPayload`(파일 9)는 `code`/`message`/`nodeId` 각 필드를 `typeof` 로 검증해
    타입이 어긋나면 안전한 기본값(`null`/`''`)으로 떨어뜨리는데, dispatcher 의 이 분기는 `errorRaw`가
    object 이기만 하면 필드 검증 없이 그대로 캐스팅한다(예: 배열이 오면 `code`/`nodeId` 가
    `undefined` 로 남아 `EiaFailedEvent.error.code: string | null` 계약과 런타임에 어긋날 수 있다).
    다만 이 패턴은 이번 diff 이전부터 있던 것(주석만 "Spec-정합 object shape (정상 path)" →
    "§6.4 object shape (hot path)" 로 바뀜, 로직 불변)이고, emit 경로가 이제 전부
    `toTerminalErrorPayload` 를 거치며 같은 프로세스 내 EventEmitter2 로 참조가 그대로 전달되므로
    (JSON round-trip 없음) 실질 위험은 낮다. 새 회귀는 아니다 — 참고로만 기록.
  - 제안: 조치 불요(비차단). 향후 별도 프로세스/큐를 경유하게 되면 재검토 권장.

## 교차 확인 — spec §6.4 line-level 일치

| spec §6.4 요구 | 코드 구현 | 일치 |
|---|---|---|
| `error.code: "…" \| null` | `TerminalErrorPayload.code: string \| null`(`terminal-error-payload.ts:31`), `EiaFailedEvent.error.code: string \| null`(`types.ts:400`) | ✅ |
| `error.nodeId: "uuid" \| null` | `TerminalErrorPayload.nodeId: string \| null`, 항상 키 포함(생략 없음) — `toTerminalErrorPayload` 는 절대 `nodeId` 키를 빠뜨리지 않는다 | ✅ |
| `error.message` (non-null string) | `typeof src.message === 'string' ? src.message : ''` — 항상 string | ✅ |
| `error.details?` (optional) | `if (src.details !== undefined) out.details = src.details;` — 없으면 키 자체 생략 | ✅ (§2-api-convention §5.4 "선택적 부가 컨텍스트" 근거와 일치) |
| "부재는 `null`, 키 생략 아님"(§5.4 기본 규칙) | `null`/`undefined`/string/number/boolean/bigint/symbol 입력 전부 `code`·`nodeId` 를 명시적 `null` 로 채움(빈 객체 `{}` 반환 안 함 — `err===null\|\|undefined` 는 전체를 `null` 반환, 이는 "에러 자체가 없음"이라 별개 케이스) | ✅ |
| CCH-ERR-04 "`code===null` → `executionFailedInternal`" | `execution-failure-classifier.ts:105` `event.error?.code ?? ''` → 알려진 코드 미매치 → unknown fallback → `executionFailedInternal` + warn(`code:''`) | ✅ (classifier 자체는 diff 밖이나 소비 계약 확인) |
| DB(`Execution.error`)는 키 생략, wire 는 명시적 null | 4개 emit 지점(`failFirstSegmentSetup`/`finalizeStalledExhausted`/`finalizeFailedExecution`/`failRetryExecution`) 전부 DB write 객체를 그대로 `toTerminalErrorPayload()` 에 통과시켜 emit — 이중 관리 없음 | ✅ |
| `1-data-model.md` §2.14 `Execution.error` 구조에 nullable `nodeId`/`code` | 이미 갱신됨(별도 planner 턴, 커밋 `4b13ca5ae` 계열) | ✅ |
| DB `Execution.error` 에 `nodeId` 를 쓰는 경로 0건(JSDoc 주장) | `Execution.error =` 대입 4곳(`:630`,`:4198`,`:4836`,retry-turn`:938`) 전수 확인 — 전부 `message`(+옵션 `code`)만, `nodeId` 없음 | ✅ 실측 일치 |

## 엣지 케이스 (`toTerminalErrorPayload`, 파일 9)

`null`/`undefined`(→ `null` 반환, 빈 객체 아님) · 레거시 string(→ `message` 승격) · number/boolean/bigint
스칼라(→ `String()`) · symbol/function(→ `message: ''`, 강제 문자열화 안 함, lint `no-base-to-string`
회피와 일치) · `code`/`nodeId` 비-string 타입(→ 각각 `null` 로 드롭, 원값 유출 안 함) · `message` 비-string
(→ `''`) · `details` 부재 시 키 생략 · 입력 비-변형(fresh object 반환) — 13개 테스트 케이스가 이 전부를
커버하며 `it.each` 라벨도 `%s`(필드명)로 정확히 찍힌다(과거 라운드에 status 를 잘못 찍던 결함과 달리
현재는 정상). mutation 방어 주석("code 가드를 지운 뮤턴트가 생존했다")도 실제로 해당 fixture 로 커버됨.

## TODO/FIXME / 의도-구현 괴리

변경된 9개 파일에 TODO/FIXME/HACK/XXX 없음. `chat-channel.dispatcher.ts:540~543` 은 오히려
**존재한 적 없는 plan 이름을 가리키던 죽은 포인터**를 발견해 제거한 개선(`spec-update-execution-failed-payload-shape`
plan 은 `git log --diff-filter=A` 0건이라는 주장은 이 세션의 조사 범위 밖이라 재검증하지 않았으나,
남아 있던 인용 라인 번호 두 개가 현재 코드와 무관한 것은 직접 확인). "종전 `'INTERNAL_ERROR'` 를
지어냈다" 는 것도 `execution-failure-classifier.ts` 전수 확인 결과 그 문자열이 등재 코드 집합에
없음을 검증 — 주석 주장과 실제 일치.

## 반환값 / 에러 시나리오

`toTerminalErrorPayload` 는 모든 분기에서 `TerminalErrorPayload | null` 을 반환(빠지는 경로 없음).
4개 emit 호출부 모두 DB write 직후 같은 객체를 넘기므로 emit 실패와 무관하게 DB 상태와 wire 상태가
갈릴 여지가 구조적으로 줄었다(과거 `finalizeStalledExhausted` 의 `attempts` 문구 drift 를 재발
불가능하게 만든 설계 — plan 재판정 ③-a 주장과 코드가 정확히 일치).

## 요약

`execution.failed` 종결 이벤트의 `error` 필드를 string 에서 EIA §6.4 object 형태로 전환하는 작업으로,
spec §6.4·§5.4(null vs 키 생략)·CCH-ERR-04·data-model §2.14 요구사항을 line-level 로 정확히 구현했다.
핵심 신규 헬퍼(`toTerminalErrorPayload`)는 스칼라/symbol/배열/필드-타입-불일치 등 방대한 엣지 케이스를
커버하고, 4개 DB-write emit 지점이 모두 "DB 에 쓴 객체를 그대로 emit" 패턴으로 통일돼 과거 실재했던
DB-wire 문구 drift(stalled 경로 `attempts` 누락)가 구조적으로 재발 불가능해졌다. 관련 unit test
589건 전부 pass, 대상 파일 lint clean. 유일한 실제 결함성 발견은 기능 코드가 아니라 **plan 문서
자체의 체크리스트가 이 diff 가 이미 완료한 작업을 아직 반영하지 못한 것**(WARNING, 비차단) — push 전
갱신 권장. 그 외 dispatcher hot-path 의 무검증 캐스팅은 기존 패턴을 유지한 것이라 INFO 로만 기록.
CRITICAL 없음.

## 위험도

LOW
