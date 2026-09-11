# 테스트(Testing) 리뷰 — chat-channel-input-rules 커버리지 공백 폐쇄 (3라운드)

## 검토 범위 및 방법

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (변경 — 이전 라운드
  reviewer 가 뮤테이션으로 실측한 W1·W2·INFO1~4 공백을 닫는 신규 케이스 6개 추가)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (변경 — `translateSetupChannelError`
  JSDoc 한 단락 추가만, 로직 무변경)
- `codebase/backend/src/modules/triggers/triggers.service.ts` — 이번 diff 범위 밖(무변경) 확인만
- `plan/in-progress/impl-chat-channel-binder.md`, `spec-draft-nullable-notation-followups.md`,
  `review/code/2026/09/11/15_31_54/**`, `review/code/2026/09/11/15_57_42/**` — plan/이전 라운드
  산출물. 코드가 아니므로 테스트 관점 발견사항 대상 아님(단, 15_57_42/testing.md 의 MEDIUM 지적이
  이번 커밋에서 실제로 해소됐는지 검증하는 데 참조).

**뮤테이션 검증**: 저장소 원본을 `/private/tmp/.../scratchpad/chat-channel-input-rules.ts.orig` 로
`cp` 백업한 뒤, `chat-channel-input-rules.ts` 만 5회 순차 뮤테이션 → `npx jest` 실행 → 매회 `cp` 로
즉시 원복(`git checkout`/`restore` 미사용). 최종 `md5`(`e8db5aa9f0a1aa912a0dea266cf3772b`)가 백업과
일치, `git status --short` 로 확인 시 남은 변경은 `review/code/2026/09/11/16_16_44/`(본 리뷰 산출물)
뿐임을 확인했다.

**관측한 이상 상태(투명성 고지)**: 두 번째 뮤테이션 사이클 직후 `git status --short` 에서 예상치 못하게
`M codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` 가 잠깐 나타났다(diff:
`assertChatChannelInputSafe(cfg({ botToken: '1:a' }) as never, 'update')` 에서 `as never` 가 제거된
상태 — 내가 만든 변경이 아니다, 나는 `.ts` 파일만 건드렸다). 이 저장소에는 병렬 fan-out reviewer 가
동시에 접근 중이라는 사실이 명시돼 있어 다른 세션의 실험적 편집으로 추정된다. 이후 재확인
(`grep -n "as never" chat-channel-input-rules.spec.ts`) 시 원래 상태(`as never` 포함, HEAD 와 일치)로
돌아와 있었고 `git status --short` 도 다시 깨끗했다 — **자체 해소됨, 현재 저장소는 HEAD 와 일치**.
혹시 이 보고 시점 이후 이 파일에 대한 다른 발견사항이 나온다면 이 트랜지언트를 먼저 배제할 것.

## 사실관계 실측 — 이전 라운드(MEDIUM) 지적 6건이 실제로 닫혔는지

`review/code/2026/09/11/15_57_42/testing.md` 가 실측 커버리지(`--coverage`)로 특정한 미달 라인
5곳(`123-124, 149-150, 245, 251-254, 280`)에 대응하는 신규 테스트를 원본 코드에 **뮤테이션을 넣어**
직접 재현했다 — 전부 의도대로 RED 가 됨을 확인:

| 이전 지적 | 뮤테이션 | 결과 |
|---|---|---|
| W1 `inboundSigningPlaintext` PATCH 차단 미검증 | (신규 테스트로 검증됨, 별도 뮤테이션 불요 — 코드 대칭 확인) | 신규 `it('PATCH 는 inboundSigningPlaintext 도 거부한다')` 존재 확인 |
| W2 discord 분기 + 정규식 스왑 미검출 | `SLACK_SIGNING_SECRET_REGEX` ↔ `DISCORD_PUBLIC_KEY_REGEX` 두 분기 스왑 | **3건 RED** (커밋 메시지가 주장한 수치와 일치, 실측 재현 성공) |
| INFO1 필드 부재 분기 미검증 | (신규 `it.each(['slack','discord'])('%s 는 inboundSigningPlaintext 부재를 거부한다')` 로 커버) | 확인 |
| INFO2 `mode==='update'` 디스패치 미검증 | 신규 `it('update 모드는 공개 진입점을 통해서도 값 필드를 막는다')` | 확인 |
| INFO3 `assertChatChannelAlreadySetUp` 양성 경로 미검증 | 신규 `it('provider 가 같으면 통과한다 (양성 경로)')` | 확인 |
| INFO4 `chatChannel === undefined` 조기 반환 미검증 | 신규 `it('chatChannel 이 undefined 면 그냥 통과한다')` | 확인 |

6건 전부 실제 테스트 코드로 닫혔음을 텍스트 대조 + 대표 케이스(W2) 뮤테이션 재현으로 확인했다.
**vacuous 아님** — W2 는 실제로 RED 가 나는 조건부 테스트다.

## 발견사항 (이번 라운드 신규)

- **[INFO]** `assertChatChannelInputSafe` 의 세 내부 필드 차단(`botTokenRef`/`inboundSigningRef`/
  `inboundSigning`)이 신규 유닛 스펙에서 `mode: 'update'` 조합으로는 검증되지 않는다 — 단,
  **기존(무편집) 통합 스펙이 이미 이 조합을 덮는다**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:95-117`
    (세 `if` 블록이 `mode` 분기보다 앞서 무조건 실행되는 구조) — 대응 유닛 테스트는
    `chat-channel-input-rules.spec.ts:43-56`(`mode: 'create'` 로만 파라미터화된 `it.each`)뿐이고,
    같은 파일의 `'update' 모드는 공개 진입점을 통해서도 값 필드를 막는다'`(:101-107)는
    `botToken`(→ `assertPatchCarriesNoSecrets` 경로)만 검사해 이 세 내부 필드는 건드리지 않는다.
  - 상세: 세 `if` 블록을 `mode === 'create'` 로 게이팅하는 뮤테이션(“내부 필드 차단이 update 에서는
    빠진다”)을 직접 넣고 `npx jest chat-channel-input-rules.spec.ts` 를 돌렸더니 **19/19 GREEN** —
    이 유닛 스펙 단독으로는 그 회귀를 못 잡는다. 다만 같은 뮤테이션 상태로
    `triggers.service.spec.ts` 의 `BLOCKED_FIELD_CASES`(`botTokenRef`/`inboundSigningRef`/
    `inboundSigning` 3종을 `service.update()` 경유로 검증, :3106-3159)를 함께 돌리면 **3건 RED** —
    즉 통합 레벨에서는 이미 이 회귀가 잡힌다. R-CC-21 표면이 최근 두 차례 CRITICAL(#1314 등)의
    이력이 있는 영역이라, 이 파일이 스스로 내세운 목적("새로 얻은 것" — 서비스 경유로는 비싸서
    아무도 안 썼던 자리를 직접 커버)에 비춰 유닛 레벨에도 이 조합을 채우는 편이 다음 사람이
    통합 스펙 없이 이 파일만 보고 안전하다고 오판하는 것을 막는다.
  - 제안: `it.each(['botTokenRef', 'inboundSigningRef', 'inboundSigning'])` 로 `mode: 'update'`
    조합을 유닛 스펙에도 추가한다(저비용, 통합 스펙과 중복이라도 "직접 호출로 이 표면 전체를
    커버한다"는 파일의 존재 이유와 합치).

- **[INFO]** `assertChatChannelAlreadySetUp` 의 `incoming.provider` falsy-guard(`&&`)가 미검증 —
  단, DTO 타입상 사실상 도달 불가능한 방어 코드로 보임
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:186`
    (`if (incoming.provider && incoming.provider !== current.provider)`)
  - 상세: `incoming.provider &&` 부분을 제거하는 뮤테이션(`if (incoming.provider !== current.provider)`)을
    넣어도 `chat-channel-input-rules.spec.ts` + `triggers.service.spec.ts` 142건 전부 GREEN —
    `incoming.provider` 가 falsy 인 경우를 exercising 하는 테스트가 어디에도 없다. 다만
    `ChatChannelUpdateConfigDto`(`dto/chat-channel-config.dto.ts:384-387`)는 `provider` 필드를
    `OmitType` 대상에서 제외해 `@IsString() @IsIn(...)` 이 그대로 상속되므로, 컨트롤러 경유
    요청에서는 `class-validator` 가 먼저 막아 `incoming.provider` 가 falsy 로 이 함수에 도달하는
    실제 경로가 없어 보인다 — 즉 실전 위험은 낮은 방어적 분기다. 그래도 "값으로 확인된 계약"은
    아니므로 코드만 읽는 다음 사람에게는 사각지대다.
  - 제안: 급하지 않음. 후속 편집 시 `it('incoming.provider 가 없으면 전환 검사를 건너뛴다')` 한 줄로
    저비용 폐쇄 가능.

- **[INFO]** `translateSetupChannelError` 의 `details.reason` 필드 값과 `err instanceof Error`
  분기 구분이 어떤 테스트에서도 단언되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:311`
    (`const message = err instanceof Error ? err.message : String(err);`)와 `:316,322`
    (`details: { reason: message.slice(0, 256) }`) — 대응 테스트
    `chat-channel-input-rules.spec.ts:229-267` 는 4개 케이스 전부 `.code` 만 단언한다.
  - 상세: `err instanceof Error ? err.message : String(err)` 를 `String(err)` 로 축약하는
    뮤테이션(non-Error 입력 구분 제거)을 넣어도 142건 전부 GREEN — 이 함수의 모든 테스트가
    `new Error(...)` 만 입력하고 `.getResponse().code` 만 검사하므로, (a) non-Error 값(문자열/객체
    등)이 넘어오는 경로, (b) `details.reason` 의 실제 내용(트렁케이션 포함) 어느 쪽도 실측 없이
    통과한다. 이 함수가 `catch` 블록에서 임의의 `unknown` 을 받는 함수 시그니처(`err: unknown`)를
    가진 만큼, non-Error throw(예: 문자열 reject)가 이론상 불가능하지 않다.
  - 제안: 우선순위 낮음. `translateSetupChannelError('plain string')` 같은 케이스 1개와
    `details.reason` 값을 `toMatchObject` 로 확인하는 단언을 추가하면 닫힌다.

## 회귀·품질 관점 — 확인된 것

- `npx jest chat-channel-input-rules.spec.ts` 원본 기준 **19/19 GREEN** 실측.
- 세 차례 독립 뮤테이션(내부 필드 mode 게이팅 · `incoming.provider` guard 제거 · `instanceof Error`
  분기 제거) 모두 이 유닛 스펙 단독으로는 못 잡음을 확인했으나, 그중 첫 번째(가장 보안 민감한
  R-CC-21 표면)는 기존 `triggers.service.spec.ts` 가 통합 레벨에서 이미 방어하고 있음을 함께
  확인했다 — 실질 회귀 위험은 이번 라운드가 새로 여는 것이 아니라 "유닛 스펙 단독 커버리지"의
  잔여 갭이다.
- W2(정규식 스왑) 수정이 vacuous 하지 않음을 직접 재현했다 — 뮤테이션 3건 RED, 커밋 메시지의 주장과
  일치.
- `stripChatChannelPlaintext`, 내부 필드 차단 3종(create), `assertChatChannelAlreadySetUp` 음성/양성
  경로, provider 분기 6종(교차 포함)까지 이번 라운드에서 실질적으로 커버리지가 넓어졌다 — 이전
  MEDIUM 판정의 근거가 된 6개 공백이 전부 눈에 보이는 테스트 코드로 폐쇄됐다.
- 격리: `cfg()` 헬퍼가 매 호출 새 객체를 반환하고 테스트 간 공유 가변 상태 없음 — 양호.
- 가독성: 각 신규 테스트에 "왜 이 값을 골랐는가"(교차 길이가 판별자, telegram 대신 slack 선택 이유
  등) JSDoc 주석이 붙어 있어 다음 사람이 fixture 를 실수로 바꿔도 의도를 복원할 수 있다.
- Mock: 여전히 mock 0건 — 의존 0인 순수 함수라 적절한 선택 유지.
- 다만 `assertChatChannelInputSafe(cfg({ botToken: '1:a' }) as never, 'update')`(:104)처럼 `as never`
  로 오버로드 타입 검사를 우회하는 자리가 있다 — 테스트 의도(`ChatChannelUpdateConfigDto` 형태를
  흉내)를 가리는 사소한 가독성 비용이나, 오버로드 특성상 불가피한 절충으로 보여 낮은 우선순위.

## 요약

이전 라운드(MEDIUM)가 `--coverage` 실측으로 특정한 6개 공백(`inboundSigningPlaintext` PATCH 대칭·
discord 정규식·정규식 스왑 검출·필드 부재 분기·update 디스패치·`assertChatChannelAlreadySetUp` 양성
경로)은 이번 커밋에서 전부 실제 테스트 코드로 폐쇄됐고, 대표 케이스(W2 정규식 스왑)는 직접 뮤테이션
재현으로 vacuous 하지 않음을 확인했다. 이번 라운드에서 추가로 발견한 3건은 모두 INFO 수준이다 —
가장 무게 있는 것(내부 필드 차단의 update-mode 조합)도 유닛 스펙 자체의 잔여 갭일 뿐 기존 통합
스펙(`triggers.service.spec.ts`)이 이미 회귀를 잡고 있음을 실측으로 확인했고, 나머지 둘(provider
falsy-guard·non-Error 입력 구분)은 DTO 타입/에러 처리 계층이 사실상 방어하는 저위험 방어적 분기다.
세션 중 저장소에서 관측한 일시적 이상 상태(spec 파일의 순간적 변경)는 원인이 본 리뷰의 작업이
아니며 재확인 시 자체적으로 HEAD 상태로 복원돼 있었다.

## 위험도

LOW
