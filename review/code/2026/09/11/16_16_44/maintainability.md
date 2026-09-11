# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위와 방법

이번 라운드(`16_16_44`)의 실제 코드 변경분은 커밋 `81d2a8c18`(`git show 81d2a8c18`) 하나다 —
`git diff origin/main --stat -- codebase/`로 누적 diff 전체(324줄 `chat-channel-input-rules.ts`
신규 + `triggers.service.ts` 축소)를 먼저 확인했으나, 그중 `chat-channel-input-rules.ts` 자체의
구조적 지적(에러 봉투 반복 7회·매직넘버 `256`·이중 캐스팅 등)은 직전 두 라운드
(`review/code/2026/09/11/15_31_54`, `15_57_42`)의 maintainability 리포트가 이미 WARNING/INFO로
적었고 developer 가 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에
유예 등재했다는 것을 확인했다(변경 없음, 재-flag 대상 아님). 이번 라운드가 실제로 건드린 파일은:

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` — 테스트 12건 추가
  (뮤테이션으로 증명된 커버리지 공백 폐쇄: 정규식 스왑·대칭 필드·필드 부재·update 디스패치·
  양성 경로·조기 반환)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `translateSetupChannelError`
  JSDoc 에 "알려진 예외(discord verify_key 불일치 → 502)" 각주 6줄 추가. **로직 변경 없음.**
- `plan/in-progress/impl-chat-channel-binder.md` — 체크리스트의 테스트 통과 수치 1줄 정정
  (`9,568` → `9,580`, 측정 시점 명기). 코드가 아니므로 이 관점 밖.

## 검증용 뮤테이션 (수행함, 원복 완료)

`assertChatChannelInputSafe(cfg({ botToken: '1:a' }) as never, 'update')`(spec.ts:104)의
`as never` 가 실제로 필요한 캐스팅인지 확인하려고, 원본을 스크래치 디렉터리에 `cp` 로 백업한 뒤
저장소 파일에서 그 자리만 `cfg({ botToken: '1:a' }), 'update'`(캐스팅 제거)로 바꿔
`npx tsc --noEmit -p tsconfig.json`(백엔드 typecheck ratchet 이 쓰는 것과 동일 커맨드)을 두 번
돌려 대조했다: 원본 197건, 캐스팅 제거본 197건 — **`diff` 로 두 출력이 바이트 단위로 동일함을
확인**했다(신규 진단도, 사라진 진단도 없음). 확인 직후 백업본을 `cp` 로 즉시 원복했고, `diff` 로
원본과 바이트 단위 동일함을 재확인했다. `git checkout`/`restore` 는 쓰지 않았다.

## 주의 — 리뷰 도중 관측된, 내가 만들지 않은 저장소 오염 (제출 시점엔 자체 해소됨)

위 원복 직후 저장소 상태를 확인했더니 내가 건드리지 않은
`codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 에도 커밋되지 않은 변경이
있었다: `assertInboundSigningPlaintextByProvider` 의 슬랙/디스코드 분기 정규식이 서로 뒤바뀐
상태(`SLACK_SIGNING_SECRET_REGEX` ↔ `DISCORD_PUBLIC_KEY_REGEX` 스왑, :267/:279)였다. 이 파일은
이번 세션에서 내가 `Read` 로만 열람했고 편집한 적이 없다 — 내가 `cp` 로 백업·복원한 대상은
`chat-channel-input-rules.spec.ts` 뿐이며 그 파일은 복원 후 원본과 바이트 단위로 동일함을
확인했다. 이 정규식 스왑은 커밋 메시지(`81d2a8c18`)가 "잡아냈다"고 주장하는 바로 그 뮤턴트와
일치해, 같은 워킹트리를 동시에 읽는 다른 reviewer(테스트/뮤테이션 관점)가 재현 중인 상태로
추정했다. 이 리뷰의 안전 규약("다른 reviewer 의 미커밋 뮤테이션을 되돌리지 말 것")에 따라 나는
이 파일을 원복하지 않고 그대로 두었다 — 위 tsc 실측(타입 진단 197건 비교)은 식별자 스왑이 타입
구조에 영향을 주지 않으므로 이 오염과 무관하게 유효하다.

**후속 확인**: 이 리포트를 제출하기 직전 저장소 상태를 다시 확인하자 이 파일은 더 이상 변경
목록에 없었고, 직접 `Read` 로 :267/:279 를 재확인한 결과 `SLACK_SIGNING_SECRET_REGEX`(slack)/
`DISCORD_PUBLIC_KEY_REGEX`(discord) 가 정상 짝으로 돌아와 있었다 — 다른 reviewer(추정)가 자신의
뮤테이션을 스스로 원복한 것으로 보인다. 즉 이 오염은 **자체 해소됐다**. 그래도 이 라운드의 다른
reviewer 산출물을 종합할 때, orchestrator 는 각 리포트가 이 중간 오염 구간과 겹치는 시점에
작성됐는지(그 결과 해당 리포트가 스왑된 상태를 관찰했을 가능성) 확인해 둘 것을 권한다.

## 발견사항

- **[WARNING]** `as never` 캐스팅이 이 파일의 자체 방어기제(오버로드 결속)를 우회하는 것처럼 보이지만, 실측상 불필요한 캐스팅이다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:104`
    (`assertChatChannelInputSafe(cfg({ botToken: '1:a' }) as never, 'update')`)
  - 상세: 같은 파일의 다른 모든 타입 이스케이프는 `as unknown as X` 형태(예: :27, :193, :200,
    :211, :220)로 "이 값은 X 모양이다"를 명시하는데, 이 한 곳만 `never` — TS 에서 가장 넓은
    이스케이프 해치(무엇이든 통과시키는 하위 타입 단언)를 쓴다. 더구나 바로 위
    `assertChatChannelInputSafe` 의 JSDoc·인라인 주석(:73-76)은 이 함수의 오버로드가
    "`mode` 와 DTO 타입을 컴파일 타임에 묶어" `('update'인데 생성용 DTO)` 같은 짝 깨짐을
    **막는 것이 이 PR 이 닫은 보안 결함 클래스의 재발 방지 장치**라고 스스로 선언한다. 그런데
    바로 그 결합을 시험하는 테스트가 정확히 그 자리에서 가장 강한 이스케이프로 타입 검사를
    건너뛴다 — 다음 사람이 이 줄만 보면 "`ChatChannelConfigDto` 로 `update` 모드를 부르려면
    타입 시스템을 우회해야 하는구나"라고 오해하기 쉽다. 그런데 실측 결과(`cp` 로 백업 후 그
    자리만 캐스팅 없이 `cfg({ botToken: '1:a' }), 'update'` 로 바꿔 `tsc --noEmit -p
    tsconfig.json` 재실행) **캐스팅을 지워도 진단이 정확히 197건으로 그대로**였다 — 즉
    `ChatChannelConfigDto` 인스턴스는 `ChatChannelUpdateConfigDto`(`OmitType` 으로 두 필드만
    optional 로 재선언한 구조적 부분집합)에 애초에 구조적으로 대입 가능해서, 이 캐스팅은 실제로
    막고 있는 컴파일 에러가 없다. 이 코드베이스에 이미 있는 `as never` 관례(예:
    `truncate-output.util.spec.ts:158`, `condition-evaluator.util.spec.ts:191` — 유니온에
    아예 없는 리터럴을 강제로 넣어 런타임 가드를 시험)와 달리, 여기서는 그 관례를 형식만
    모방했을 뿐 실제로는 불필요한 적용이다.
  - 제안: `as never` 를 지우고 `cfg({ botToken: '1:a' }), 'update'` 로 바꾼다(위 실측대로 컴파일
    통과 확인됨). 굳이 캐스팅 없이 컴파일되는 이유(구조적 서브타이핑)까지 남기고 싶다면 짧은
    주석 한 줄이면 충분하다. 그대로 두면 향후 실제로 타입이 안 맞는 자리에 `as never` 를 습관적으로
    복붙하되 "왜 필요한지" 검증하지 않는 선례가 된다.

## 확인했으나 문제 없음 (참고)

- 신규 테스트 12건은 각각 하나의 관측 가능한 분기(정규식 스왑·대칭 필드·필드 부재·`update`
  디스패치·양성 경로·조기 반환)에 정확히 대응하고, 커밋 메시지가 주장하는 근거(뮤테이션 RED)와
  테스트 이름·인라인 주석이 일치한다. `it.each` 로 `slack`/`discord` 를 대칭 처리한 구조
  (`ownLen`/`otherLen` 네이밍 포함, :127-162)는 명확하고 3중 반복(valid/비-hex/교차) 각각에
  주석이 붙어 있어 가독성이 좋다.
- `chat-channel-input-rules.ts` 에 추가된 JSDoc 6줄(알려진 예외 각주)은 로직 변경이 없고,
  캐너리 테스트·후속 트래커 항목을 정확히 상호 참조한다 — 문서화 품질 개선이며 유지보수성
  감점 요인이 아니다.
- `plan/in-progress/impl-chat-channel-binder.md` 의 수치 1줄 정정은 코드가 아니므로 이 관점
  밖이나, 측정 시점을 함께 적은 것은 이 프로젝트의 "실측은 그 시점 값으로" 관례에 부합한다.
- 리뷰 세션 산출물(`review/code/2026/09/11/15_31_54/**`, `15_57_42/**`, `_retry_state.json`,
  `meta.json`)은 애플리케이션 코드가 아니므로 유지보수성 코드 리뷰 대상에서 제외했다.

## 요약

이번 라운드의 실제 코드 델타는 새 테스트 12건(뮤테이션이 증명한 커버리지 공백 폐쇄)과 프로덕션
파일의 JSDoc 각주 6줄뿐이며, 둘 다 이름·구조·의도 문서화 수준이 높고 이전 라운드 지적을
성실히 반영했다. 유일한 지적은 새로 추가된 테스트 한 곳(`chat-channel-input-rules.spec.ts:104`)의
`as never` 캐스팅이 이 파일이 스스로 강조하는 오버로드 방어기제를 우회하는 것처럼 보이지만,
`tsc --noEmit` 실측 결과 애초에 불필요한 캐스팅이라는 점이다 — 동작에는 영향이 없으나, 다음
사람이 "이 오버로드는 캐스팅 없이는 못 부른다"고 오해하게 만드는 오도성 코드다. 그 외 함수 길이·
중첩 깊이·매직 넘버·순환 복잡도 관점에서 이번 델타가 새로 만든 문제는 없다. 별도로, 리뷰 도중
내가 만들지 않은 저장소 오염(다른 reviewer 의 것으로 추정되는 정규식 스왑 뮤테이션)을
`chat-channel-input-rules.ts` 에서 관측했으나 제출 시점 재확인 결과 자체 해소돼 있었다 — 위
"주의" 절 참고.

## 위험도

LOW
