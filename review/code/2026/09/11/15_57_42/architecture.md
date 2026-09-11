# 아키텍처(Architecture) 리뷰

## 검증 방법 (요약)

이번 라운드(`6dc2b7d60`)는 직전 라운드(`review/code/2026/09/11/15_31_54`)가 낸 **documentation CRITICAL /
architecture WARNING**(spec 귀속 drift 가 "planner 항목으로 등재했다"는 커밋 주장과 달리 어디에도
실재하지 않음)에 대한 **fix 커밋**이다. 실제 프로덕션 코드 변경은 없다 —
`git show 6dc2b7d60 --stat` 로 확인하면 이 커밋이 건드린 파일은 신규 테스트
(`chat-channel-input-rules.spec.ts`, 185줄) · plan 문서 정정 · 트래커 등재 · 리뷰 산출물 커밋뿐이고,
`chat-channel-input-rules.ts` / `triggers.service.ts` 는 **이 커밋에서 한 글자도 바뀌지 않았다**
(직전 커밋 `2ae81077c` 상태 그대로). 프롬프트에 이 두 파일이 "Review" 로 다시 나열된 것은 diff base
가 두 커밋(`2ae81077c` + `6dc2b7d60`)을 누적하기 때문이며, 그 내용은 직전 라운드 architecture
reviewer(파일 9)가 이미 상세 분석했다(LOW). 이번 라운드에서 직접 `Read`/`grep` 으로 재확인만 했다.

저장소 트리에는 아무것도 쓰지 않았다 — `Read`/`Bash`(grep, git show/status)만 사용. `git status --short`
결과 잔여물 없음(세션 자신의 리뷰 출력 디렉터리 제외).

## 발견사항

- **[INFO]** 직전 라운드 architecture WARNING(모듈 경계 이동이 만든 spec 귀속 drift 미추적)이 이번 커밋으로 해소됨 — 재확인 완료
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2523` (신규 트래커 항목), `plan/in-progress/impl-chat-channel-binder.md`(§`### ~~처방~~ ← 철회됨` 취소선 처리)
  - 상세: `grep -n "TriggersService.assertInboundSigningPlaintextByProvider" plan/in-progress/spec-draft-nullable-notation-followups.md` 로 신규 항목 존재를 직접 확인했다. plan 문서도 철회된 "얇은 delegator" 처방을 취소선으로 남기고 실제 결정(delegator 미보존, drift 는 2곳 — `slack.md:275`/`discord.md:297` 의 `TriggersService.X` 표기만 부정확, 클래스 접두 없이 함수명만 인용하는 3곳은 대상 아님)을 서술로 대체했다. 모듈 경계 이동이 만든 공개 계약(spec 이 가리키는 심볼 경로) 변화가 이제 durable 트래커에 실재한다.
  - 제안: 없음 — 해소 확인.

- **[INFO]** 순환 의존 재확인 — `forwardRef` 잔존 0건, `chat-channel↔triggers` 단방향 유지
  - 위치: `codebase/backend/src/modules/triggers/triggers.module.ts:37`(주석만 잔존, 실제 `forwardRef` 사용 0건 — `grep -rn forwardRef triggers.module.ts codebase/backend/src/modules/chat-channel/` 결과 이 주석 1건뿐)
  - 상세: plan 이 주장하는 "`#676`(`e827ed2a7`)이 끊은 순환이 되살아나지 않는다"는 전제를 직접 재검증했다. `chat-channel-input-rules.ts` 는 `chat-channel/` 하위 모듈을 import 하지 않고, `triggers.service.ts` 만 `chat-channel/channel-adapter.registry` 등을 정방향으로 참조한다 — 역방향 없음.
  - 제안: 없음.

- **[INFO]** 신규 테스트 파일이 T1(순수 함수) 설계 주장을 구조적으로 뒷받침한다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:1-40` (import + `cfg`/`thrown` 헬퍼, `Test.createTestingModule` 부재)
  - 상세: `assertChatChannelInputSafe` 등 6개 함수를 Nest DI/mock 없이 직접 호출해 검증한다 — 이는 "외부 협력자 의존 0" 이라는 T1 분류의 설계 주장을 테스트 구조 자체로 실증한다(이동 전에는 서비스 전체를 `createTestingModule` 로 세워야 이 가드에 닿을 수 있었다). 부수로 직전 라운드 architecture INFO("`assertPatchCarriesNoSecrets` 가 외부 소비자 없이 export 되어 공개 표면이 불필요하게 넓다")도 이번 테스트가 그 함수를 직접 호출·검증함으로써 export 표면의 정당한 소비자가 생겨 해소된다.
  - 제안: 없음 — 좋은 설계 증거로 기록.

- **[INFO]** (재확인, 신규 아님) `translateSetupChannelError` 의 문자열 기반 상태 추론은 여전히 스코프 밖 함수가 파일에 섞여 있고, 근본 원인(에러 분류를 메시지 문자열 패턴 매칭에 의존)도 그대로 — 이미 트래커에 등재됨
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:304-318`(`/\b(401|403)\b/` 판별식), `plan/in-progress/spec-draft-nullable-notation-followups.md:2536-2545`(캐너리 등재 항목)
  - 상세: 직전 라운드 architecture reviewer가 이미 지적한 "입력 규칙" 파일에 출력측 에러 변환이 섞이는 응집도 문제와, 이번 라운드 캐너리 테스트(`chat-channel-input-rules.spec.ts:178-184`)가 고정한 "discord verify_key 불일치가 502 로 떨어진다"는 결함이 같은 근본 원인(상태 코드를 에러 메시지 문자열에서 추측하는 구조)을 공유한다. 두 항목 모두 트래커에 근본 처방("adapter 가 status 를 메시지에 싣게 통일")까지 적혀 있어 새로 등재할 것은 없다.
  - 제안: 없음 — 트래커 추적 확인만, 이 라운드에서 조치 불필요.

## 요약

이번 라운드는 프로덕션 코드(`chat-channel-input-rules.ts`/`triggers.service.ts`)를 건드리지 않고, 직전 라운드가 지적한 **문서-구현 불일치**(spec 귀속 drift 가 "등재했다"는 주장과 달리 트래커에 없던 문제)를 실제로 등재하고 plan 의 철회된 처방을 정정하는 fix 커밋이다. `grep`으로 직접 재검증한 결과 이전 architecture WARNING(drift 미추적)은 해소되었고, 순환 의존 회피(`forwardRef` 0건) 전제도 여전히 유지된다. 신규 전용 단위 테스트 파일은 T1 계층이 "외부 협력자 의존 0"이라는 이동의 설계 근거를 구조적으로(모의 없는 직접 호출) 증명하며, 부수적으로 이전 라운드의 export-표면 INFO도 정당한 소비자 확보로 해소한다. 남은 항목(에러 변환 함수의 파일 스코프 불일치, 문자열 기반 상태 추론)은 이미 durable 트래커에 근본 처방과 함께 등재되어 있어 이 라운드에서 새로 조치할 아키텍처 이슈는 없다.

## 위험도

NONE
