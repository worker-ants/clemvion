# 요구사항(Requirement) 리뷰 — `impl-chat-channel-binder` (T1: chat-channel 입력 규칙 추출)

## 스코프 확인

대상 커밋은 `2ae81077c` 한 건이며, plan 이 설계한 두 계층(T1 검증·변환 / T2 secret 쓰기) 중 **T1
만** 이번 diff 에 포함됐다(`ChatChannelBinderService` 등 T2 산출물은 저장소에 아직 없음 — `find`
로 확인). PR 의 주장("동작 보존")에 맞춰 다음을 직접 검증했다:

- `git show 2ae81077c` 전문 diff 로 이동 전/후가 **문자 그대로 동일**함을 대조(overload 서명·throw
  payload·주석까지 1바이트도 안 바뀜).
- `grep -rn "this\.assert…|this\.strip…|this\.translate…" triggers.service.ts` → 0건 (구 호출 잔존 없음).
- `grep -rn "ChatChannelConfigDto|ChatChannelUpdateConfigDto|SLACK_SIGNING_SECRET_REGEX|…" triggers.service.ts` → 0건 (미사용 import 잔존 없음).
- `npx tsc -p tsconfig.json --noEmit` → 대상 두 파일(`chat-channel-input-rules.ts`,
  `triggers.service.ts`) 관련 에러 **0건** (baseline 197건과 겹치는 무관 에러만 존재 — 커밋
  메시지의 "타입 진단 197건 = baseline" 주장과 일치).
- `npx jest src/modules/triggers/triggers.service.spec.ts` → 123 passed / 1 skipped.
- `npx jest src/modules/triggers/dto/trigger-dto-validation.spec.ts` → 78 passed.
- 저장소 전체에서 이동된 6개 함수를 부르는 자리를 재검색 → `chat-channel-input-rules.ts` /
  `triggers.service.ts` 외 호출부 0건 (누락된 마이그레이션 없음).

기능·엣지케이스·에러 시나리오·검증 규칙·반환값 관점에서는 **순수 이동**이라 새로 도입된 결함이
없다 — 아래는 이동이 유발한 부수 효과(spec 귀속 drift)와 그 처리 과정 자체의 결함에 관한 것이다.

## 발견사항

- **[SPEC-DRIFT] WARNING** `assertInboundSigningPlaintextByProvider` 가 `TriggersService` 의
  private 메서드에서 module-level 함수로 이동하면서, 두 spec 문서의 문자 그대로의 귀속 표기가
  깨졌다.
  - 위치: `spec/4-nodes/7-trigger/providers/slack.md:275`, `spec/4-nodes/7-trigger/providers/discord.md:297`
    — 둘 다 `"Backend 의 TriggersService.assertInboundSigningPlaintextByProvider 가 …"` 형태로
    클래스 귀속을 명시. 이제 그 식별자는 `TriggersService` 의 메서드가 아니라
    `chat-channel-input-rules.ts` 의 독립 함수이므로 이 문구는 **문법적으로도 더 이상 성립하지
    않는다**(호출자만 `TriggersService` 다).
  - 상세: 코드 쪽 판단은 타당하다 — plan(`plan/in-progress/impl-chat-channel-binder.md:93-108`)이
    처음엔 "얇은 delegator 를 남겨 drift 를 0 으로 만든다"는 처방을 세웠지만, 커밋 메시지가 밝히듯
    실제 구현 중 그 처방이 틀렸음을 발견했다(호출부도 함께 이동해 delegator 를 아무도 안 부름 →
    죽은 코드로 spec 문구만 참으로 만드는 것은 더 나쁘다). delegator 를 안 남긴 결정 자체는
    합리적이다. 즉 **코드는 맞고 spec 표기만 낡았다** — 전형적인 SPEC-DRIFT.
  - 제안: 코드 되돌리기 아님. `slack.md:275`, `discord.md:297` 의 문구를 "Backend 의
    `TriggersService` 가 `chat-channel-input-rules.assertInboundSigningPlaintextByProvider` 를
    호출해 트리거 생성 시점에 검증" 형태로 정정 (planner 턴 필요, developer 는 `spec/` 쓰기 권한
    없음 — 자기-반증형 소정정 조건1 불성립: 이 문장은 이전 planner 턴이 썼다).
  - 참고: 같은 함수를 참조하지만 클래스 접두 없이 **함수명만** 인용하는 3곳
    (`spec/2-navigation/2-trigger-list.md:155`, `spec/4-nodes/7-trigger/providers/discord.md:76`,
    `spec/5-system/15-chat-channel.md:432`)은 이동 후에도 **여전히 참**이라 drift 없음 — 직접
    대조해 확인했다(plan 문서가 "5곳"으로 뭉뚱그린 것과 달리 실제 파손 지점은 2곳뿐이다).

- **WARNING** 커밋 메시지가 주장하는 "planner 항목으로 등재했다"가 저장소 어디에서도 확인되지
  않는다 — 위 SPEC-DRIFT 가 향후 라운드에서 유실될 위험.
  - 위치: 커밋 `2ae81077c` 본문 ("→ 남기지 않았다. … **planner 항목으로 등재했다**." 문단) 및
    `plan/in-progress/impl-chat-channel-binder.md` (프론트매터 `spec_impact: none`, 줄 7).
  - 상세: `git show --stat 2ae81077c` 로 이 커밋이 건드린 파일 전량을 확인했다 — 새 tracker 파일도,
    `spec-sync-*`/`spec-draft-*` 계열 in-progress 문서의 수정도 없다. `grep -rln
    "assertInboundSigningPlaintextByProvider" plan/ review/` 로 전 저장소를 훑어도 이 특정 drift
    (slack.md:275 / discord.md:297 표기 정정)가 별도 액션 아이템으로 등재된 곳은
    `impl-chat-channel-binder.md` 자기 자신의 서술 문단뿐이고, **그 파일의 `## 체크리스트`
    섹션에도 이 항목이 없다**(8개 체크박스 중 관련 항목 부재 — 있는 건 "트래커 종결"·"plan/complete
    이동" 뿐이고 둘 다 이 drift 를 가리키지 않는다). `spec_impact: none` 도 이 PR 이 spec 문서
    2곳을 stale 하게 만든다는 본문 자신의 분석과 모순된다(Gate C 관례상 `spec_impact` 는 실재 spec
    경로 리스트 또는 bare `none` — 영향이 있다고 스스로 적어 놓고 `none` 을 쓴 것은 self-consistency
    위반). 이대로 `plan/complete/` 로 이동하면 "등재했다"는 서술만 역사에 남고 실제 planner 가
    집어들 실행 가능한 항목은 사라진다 — 앞선 세션에서 반복된 "plan 서술은 철회로 거짓이 될 수
    있다" 류 실패 패턴과 같은 모양.
  - 제안: `plan/in-progress/impl-chat-channel-binder.md` 의 `spec_impact` 를
    `[spec/4-nodes/7-trigger/providers/slack.md, spec/4-nodes/7-trigger/providers/discord.md]` 로
    갱신하고 `## 체크리스트`에 "slack.md:275 / discord.md:297 의 `TriggersService.X` 귀속 표기
    정정 — planner 턴" 항목을 명시적으로 추가한 뒤 커밋할 것. `plan/complete/` 이동 전에 반드시
    반영.

- **INFO** `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:36` 의 클래스
  docstring — "provider 별 추가 검증 … 과 inboundSigningPlaintext 의 provider별 요구/금지 분기는
  TriggersService 가 수행" — 도 이번 이동으로 아키텍처적으로 부정확해졌다(실질 로직은 이제
  `chat-channel-input-rules.ts` 에 있고 `TriggersService` 는 호출만 한다). `spec/` 이 아니라
  codebase 내부 comment 라 이번 diff 의 review 범위 밖으로 보아 CRITICAL/WARNING 은 아니지만,
  후속 정리 시 같이 고칠 것을 권한다.

- **INFO (검증 완료, 결함 아님)** T1 함수들을 직접 단위 테스트하는 전용 spec 파일이 없다
  (`chat-channel-input-rules.ts` 를 import 하는 `*.spec.ts` 0건 — `triggers.service.spec.ts` /
  `trigger-dto-validation.spec.ts` 가 `TriggersService.create/update` 경유로만 커버). plan 이
  "테스트 diff 0줄"을 순수 이동의 증거로 의도적으로 선택한 것이므로 이번 PR 범위에서는 정상이지만,
  의존 0개 순수 함수 모듈이 된 지금은 직접 단위 테스트를 붙이는 것이 저비용 고가치 후속 작업이다.

## 요약

이 커밋은 스스로 주장한 대로 **행동 보존 순수 이동**이며, diff 전문 대조·미사용 import 잔존
검사·타입체크·관련 테스트 스위트 재실행으로 그 주장을 직접 재현·확인했다 — 새로 도입된 기능적
결함은 찾지 못했다. 다만 이동의 부수 효과로 발생한 **spec 귀속 drift(2곳, slack.md:275 /
discord.md:297)** 자체는 코드가 맞고 spec 이 낡은 정당한 SPEC-DRIFT 이지만, 커밋이 주장하는
"planner 항목으로 등재"가 실제로는 어디에도 실행 가능한 형태로 남아있지 않아 — `spec_impact: none`
프론트매터와 체크리스트 누락이 겹쳐 — 이 PR 이 `plan/complete/` 로 넘어가는 순간 이 지식이
증발할 위험이 있다. 코드 자체보다 "인지된 것이 실제로 등재됐는가"라는 프로세스 신뢰성 결함이
핵심이다.

## 위험도

LOW — 런타임 동작은 검증된 대로 보존됐고 CRITICAL 급 기능 결함은 없다. 다만 spec 귀속 정정이
실질적으로 유실될 위험이 있어 NONE 이 아니라 LOW.
