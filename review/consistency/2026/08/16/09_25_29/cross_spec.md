# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md`

## 조사 방법 메모 (중요 — 판정에 영향)

`_prompts/cross_spec.md` 번들은 `spec/5-system/` 하위 target 을 제외한 **나머지 17개 파일 전부**
(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`4-execution-engine.md`·
`6-websocket-protocol.md`·`12-webhook.md`·`15-chat-channel.md` 등)가 "컨텍스트 예산 초과"로
**본문 생략**된 채였다 — `related_specs` 로 참조되는 다른 영역(`data-flow/`·`4-nodes/`·
`7-channel-web-chat/`·`conventions/`)도 대부분 동일하게 생략됐다. 번들만으로는 이 target 이 정의상
비교해야 할 대상의 90% 이상이 안 보이는 상태였다(기존에 기록된 "consistency `--spec` 기본 예산이
`5-system/` 를 통째로 떨군다" 문제와 동일 패턴). 아래 발견사항은 번들이 아니라 **저장소의 실제
`spec/5-system/*.md`·`spec/data-flow/15-external-interaction.md`·`spec/conventions/redis-keys.md`
등을 직접 `Read`/`Grep` 하여 얻은 결과**다.

## 발견사항

### 광범위 정합 확인 (참고용 — 문제 없음)

다음은 이번 검토에서 실측 대조했고 **모순 없음**을 확인한 항목들이다. target 이 매우 성숙한 문서
(다수의 과거 consistency 라운드가 이미 반영됨)임을 보여준다:

- `spec/5-system/6-websocket-protocol.md` §4.6 "외부 표면 매핑" 표 ↔ target §11 표 — 명령·이벤트
  매핑 완전 일치(양쪽 다 "정합해야 한다"고 서로 선언).
- `spec/5-system/1-auth.md` §4.1 감사 액션 표 — `trigger.notification_secret_rotated`,
  `trigger.interaction_token_revoked` 등재 확인 (EIA-NX-12·EIA-AU-07 과 일치).
- `spec/conventions/redis-keys.md` §3 인벤토리 — `eia:rl:*`·`eia:notif:rl:*`·
  `interaction:idempotency:<executionId>:<route>:<key>` 전부 등재, target/§R8/§8.4 와 일치.
- `spec/data-flow/15-external-interaction.md` — §R8 "캐시 대상 닫힌 목록(2xx·409·410, 400
  VALIDATION_ERROR 만 제외)" 서술이 target §R8 과 **완전히 정합**(plan
  `spec-draft-eia-r8-alignment.md` 의 diff 가 이미 적용된 상태 확인). `TOKEN_SCOPE_MISMATCH`/
  `TOKEN_AUDIENCE_MISMATCH` 매핑도 일치.
- `spec/5-system/2-api-convention.md` §5.3 에러 응답·§5.4 부재 표현(`null` vs 키 생략) — target
  §5.1/§5.3 의 `currentNode`/`result`/`error`=null, `context.conversationThread`=키 생략 서술과
  선례 표에 상호 인용까지 일치.
- `spec/5-system/3-error-handling.md` §1.2 — `TOKEN_INVALID`/`TOKEN_EXPIRED` 가 워크스페이스
  JWT 계층과 문자열은 같으나 레이어가 다르다는 target 의 "코드 네임스페이스 주석" 과 일치.
- `spec/5-system/4-execution-engine.md` §1.1/§7.4/§8 — `waiting_for_input → cancelled` "타임아웃"
  전이가 이미 예약되어 있고, 그 최초 구현이 EIA-RL-07(§R19)이라는 **양방향 상호 인용** 확인.
- `spec/5-system/12-webhook.md` §4.2 HMAC 화이트리스트(`sha256`/`sha512`) — target EIA-NX-03/R12
  의 inbound 참조와 일치. §3.4/WH-MG-04·06·07 관리 표도 target 을 정확히 가리킴(§R9 근거).
- `spec/conventions/swagger.md` "discriminator 는 sound 할 때만" Rationale — target §5.3 의
  `context` 닫힌 2-variant union(판별자 없음) 서술과 정확히 대응(같은 사례로 서로 인용).
- `spec/4-nodes/6-presentation/4-form.md` §6.2 — publisher `continueExecution` chokepoint 단일
  검증 지점 서술이 target EIA-IN-10/§5.1 과 일치.

### [WARNING] EIA §5.1 이 webhook §5.2 를 "legacy statusCode/errors shape" 로 잘못 서술 (stale)

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.1 "에러 응답" 도입부
  (line 320): `"...12-webhook §5.2 의 statusCode/errors shape 는 webhook 호출 진입점 전용
  legacy 형식 — 본 spec 의 신규 endpoint 는 신컨벤션 채택"`.
- **충돌 대상**: `spec/5-system/12-webhook.md` §5.2 "400 응답 형식" (line 293~313) — 현재
  `{ "error": { "code", "message", "requestId", "details" } }` 로, target 이 자신의 신규
  컨벤션이라 주장하는 것과 **동일한 봉투**를 이미 쓰고 있다. `statusCode`/`errors[]` 형태는
  존재하지 않는다.
- **상세**: webhook §5.2 는 2026-06-28 `7e181ed8e`(#754)에 이미 공식 에러 봉투로 정합화됐다
  (당시 consistency CRITICAL 해소). target 의 이 문구는 그 이전(2026-05-21, #228 최초 작성)에
  적힌 채 동기화되지 않았다 — 두 문서를 나란히 읽으면 target 이 "legacy" 라 부르는 형태가
  실제로는 존재하지 않아, webhook 문서의 현재 상태에 대한 사실 오류가 된다. 기능적으로
  구현이 깨지지는 않지만(구현자는 실제 webhook 파일을 볼 것), spec 상 근거 문장이 stale.
- **이미 추적됨**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  "타 문서가 EIA 의 현재 형태를 못 따라간 서술 (2026-08-15 등재, `09_00_27` cross_spec)"
  항목 2번째 체크박스로 이미 등재되어 있으나 아직 `[ ]`(미해결) 상태.
- **제안**: target §5.1 도입부 문구에서 "legacy" 캐비엇을 제거하거나, "두 endpoint 군 모두
  같은 공식 봉투를 쓴다(webhook 은 2026-06-28 정합화됨)" 로 정정. planner 턴(spec_impact
  발행) 필요 — developer 는 `spec/` 쓰기 권한 밖.

### [WARNING] Chat Channel 문서가 `InteractionRequestContext` 를 구버전(단일 인터페이스+optional
  scope)으로 서술 — target 은 이미 discriminated union

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §3.3.1 (line 140~163) —
  `ExternalInteractionRequestContext` / `InternalInteractionRequestContext` **discriminated
  union** (`scope` 필드는 internal 쪽에만 존재하는 required literal type)으로 정의.
  "v1 구현 완료" 로 명시.
- **충돌 대상**: `spec/5-system/15-chat-channel.md` §5.1 (line ~319) — `InteractionRequestContext`
  의 `scope: 'in_process_trusted'` 를 **"플래그가 set 된 경우"** 로 서술하고, §8 호환성
  (line ~507)에서 `"InteractionRequestContext` 에 `scope?: 'in_process_trusted'` optional
  필드만 추가"` 라고 적는다 — 단일 인터페이스에 optional 필드를 얹은 **구버전 설계**를
  현재형으로 서술한다.
- **상세**: 이 표현 차이는 토큰 검증 우회(EIA-AU-08 in-process trusted caller) 라는 **보안
  민감 표면**을 다룬다. target 의 discriminated union 은 컴파일러가 `scope` 오염을 구조적으로
  차단하는 것이 핵심 설계 의도(§3.3.1 "Guard/DTO 의무 제약")인데, chat-channel 문서가 여전히
  "단일 인터페이스 + optional 필드" 로 서술하면 그 설계 의도(타입으로 강제되는 invariant)가
  이 문서만 읽는 독자에게 전달되지 않는다.
- **이미 추적됨**: 같은 plan 파일에 "체커가 '보안 민감(토큰-우회 타입)이라 우선도 있다'"로
  이미 표시됐고 "문서 stale 이지 런타임 결함은 아님" 으로 확인된 채 여전히 `[ ]` 미해결.
- **제안**: `15-chat-channel.md` §5.1/§8 의 `InteractionRequestContext` 서술을 target §3.3.1 을
  가리키는 포인터로 교체(중복 서술 대신 SoT 인용) — planner 턴.

### [INFO] `data-flow/15-external-interaction.md:119` 가 target 에 없는 `EIA-AU-09` 를 인용

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §3.3 — 인증 요구사항은
  `EIA-AU-01`~`EIA-AU-08` 까지만 정의(line 121~128).
- **충돌 대상**: `spec/data-flow/15-external-interaction.md` line 119: `"...interaction.guard.ts
  EIA-AU-08/09)"` — 존재하지 않는 `EIA-AU-09` 를 병기.
- **상세**: 이미 `spec-sync-external-interaction-api-gaps.md` 에 "(INFO) 정의되지 않은
  `EIA-AU-09` 참조"로 등재, 아직 미해결.
- **제안**: data-flow 문서에서 `EIA-AU-09` 삭제(단순 오타/dangling ID로 보임) — 저비용 정정,
  developer 도 spec 이 아닌 data-flow 자체가 `spec/**` 인지 확인 후 처리(동일하게 planner 턴
  대상일 가능성 높음. `data-flow/` 가 `spec/` 하위이므로 developer 권한 밖).

## 요약

Target 문서(`spec/5-system/14-external-interaction-api.md`)는 매우 성숙하고 이미 다수의
consistency 라운드를 거친 spec 으로, 실행 엔진 상태 머신·WebSocket 프로토콜 매핑·API 응답
봉투/에러 포맷·Redis 키 인벤토리·감사 로그 액션·RBAC(CORS allowlist)·HMAC 알고리즘 화이트리스트
등 핵심 cross-spec 표면에서 다른 영역과 실측 대조 결과 **모순을 찾지 못했다**. 발견된 3건은
모두 target **자신의 정의**가 틀린 것이 아니라, **다른 문서가 target 의 최신 상태를 따라가지
못해 생기는 stale 참조**이며, 셋 다 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
에 이미 등재되어 있고 아직 미해결(`[ ]`) 상태다 — 새로운 정보라기보다 "여전히 열려 있다"는
재확인에 가깝다. 다만 원래 이 검토에 전달된 프롬프트 번들 자체가 컨텍스트 예산 초과로
`spec/5-system/` 의 target 외 전 파일(17개)과 대부분의 관련 spec 을 생략한 채였다는 점은
프로세스 리스크로 별도 기록해 둔다 — 이번엔 직접 파일을 열어 보완했으나, 이 보완이 없었다면
본 cross_spec 검토는 사실상 "동일 파일 내부 일관성 검토" 로 축소됐을 것이다.

## 위험도

LOW
