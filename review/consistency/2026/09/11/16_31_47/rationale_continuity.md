# Rationale 연속성 검토 — `impl-chat-channel-binder` (`--impl-done`, scope: `spec/5-system/`)

## 검토 범위에 대한 메모

프롬프트 번들의 `spec/5-system/15-chat-channel.md` · `<git diff origin/main...HEAD -- code_areas>`
등 16개 파일이 컨텍스트 예산으로 절단되어 있어, 지시대로 워킹트리를 절대경로/현재 세션 CWD에서
직접 열어 대조했다:

- `git diff origin/main...HEAD --stat` — 실제 코드 diff는 3개 파일(`chat-channel-input-rules.ts`
  신규 324줄, `chat-channel-input-rules.spec.ts` 신규 268줄, `triggers.service.ts`에서 324줄
  삭제)로 확인. `spec/5-system/**` 델타는 0개 파일 — 프롬프트가 예고한 그대로.
- `spec/5-system/15-chat-channel.md`를 `Read`로 전문 대조 — `## Rationale` 중 `R-CC-21`(PATCH는
  비밀을 쓰지 않는다) 절 전체를 확인.
- `plan/in-progress/impl-chat-channel-binder.md` 및 `plan/in-progress/spec-draft-nullable-notation-followups.md`의
  신규 등재 항목을 대조.
- 3개 코드리뷰 라운드 커밋(`2ae81077c`·`6dc2b7d60`·`81d2a8c18`·`616cae689`)의 diff를 각각
  확인 — `chat-channel-input-rules.ts` 실질 로직에 대한 순수 이동 이후 변경은 JSDoc 주석 추가
  6줄(캐너리 설명)뿐이고, 나머지는 전부 `*.spec.ts`·`plan/**`·`review/**`.

## 사실관계 — 이 PR의 성격

`TriggersService`의 private 메서드 6개(`assertChatChannelInputSafe`(+overload) ·
`assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` ·
`assertInboundSigningPlaintextByProvider` · `translateSetupChannelError`)를 module-level 함수로
그대로 이동한 **순수 리팩터**다. `triggers.service.ts`의 삭제분과 `chat-channel-input-rules.ts`의
신규분을 diff로 직접 대조한 결과 로직 텍스트가 바이트 단위로 일치한다(주석 포함). 유일한 실질
변경은 신규 테스트 파일(`chat-channel-input-rules.spec.ts`, 12케이스)과 `translateSetupChannelError`
JSDoc에 붙은 캐너리 설명 6줄이다.

## Rationale 대조

### R-CC-21 "PATCH는 비밀을 쓰지 않는다" — 기각된 대안 재도입 없음

`15-chat-channel.md` R-CC-21은 다음을 명시적으로 기각했다:
1. `botToken`을 optional로 두고 값이 오면 무시(침묵 폐기)
2. `SecretResolver.rotate`에 빈 값 가드만 넣어 증상을 가림
3. telegram 전용 `rotate-inbound-signing` API 분리
4. adapter가 기존 서명을 재사용해 "값 불변"을 참으로 만듦
5. `chatChannel`이 실린 PATCH에서 `setupChannel` 호출 자체를 생략

이동된 `assertPatchCarriesNoSecrets`·`assertChatChannelInputSafe`의 `mode==='update'` 분기는
여전히 `botToken`·`inboundSigningPlaintext`를 **명시적으로 throw**한다(무시/침묵 없음) —
①과 무관. `SecretResolver.rotate`나 신규 API 엔드포인트, adapter의 서명 재사용 로직에는
이 diff가 손을 대지 않았다 — ②~④와 무관. `setupChatChannel`/`teardownChatChannel` 호출 지점도
`triggers.service.ts` 안에 위치·로직 그대로 남아있다 — ⑤와 무관. 다섯 기각 대안 중 어느 것도
재도입되지 않았다.

### R-CC-21 "구현 시" 경고 — 생성/수정 검증 분리 유지

R-CC-21 본문은 "검증 함수가 생성·수정 경로에 공유돼 있다. 차단을 그 공유 함수에 넣으면
slack/discord 생성이 깨진다 — PATCH 전용 경로를 갈라야 한다"고 명시한다. 이동된 코드는 이
분리(`mode:'create'`→`assertInboundSigningPlaintextByProvider`, `mode:'update'`→
`assertPatchCarriesNoSecrets`)를 오버로드 타입까지 포함해 그대로 보존한다. 원칙 위반 없음.

### 결정 번복 없음 — 새 Rationale이 필요한 지점이 없다

이 PR은 어떤 과거 결정도 뒤집지 않는다(plan 스스로 "이 PR의 유일한 주장은 동작 보존"이라 선언).
`translateSetupChannelError`의 discord verify_key 502 fallback은 **이동 전부터 존재한 기존
동작**이며, 이 PR은 그것을 고치지 않고 캐너리 테스트로 **현재 동작을 고정**했을 뿐이다(커밋
`81d2a8c18` JSDoc 추가). 근본 처방은 `plan/in-progress/spec-draft-nullable-notation-followups.md`에
별도 항목으로 등재되어 있어, "결정을 뒤집으면서 새 Rationale 없이 넘어간" 사례에 해당하지 않는다
— 애초에 뒤집지 않았다.

### 암묵적 가정(spec 귀속 서술) 우회 없음 — drift를 발생과 동시에 등재

`slack.md:275`·`discord.md:297`이 `TriggersService.assertInboundSigningPlaintextByProvider`라는
클래스-접두 표기로 그 함수를 인용하는데, 이동으로 그 표기가 부정확해진다(실질은 유지 —
`TriggersService`가 여전히 그 규칙을 호출·생성 시점 검증한다). developer는 `spec/` 쓰기 권한이
없고(그 문장은 이전 planner 턴이 작성) 자기-반증형 소정정 조건 1(자신이 쓴 문장)도 불성립하므로,
직접 고치는 대신 `spec-draft-nullable-notation-followups.md`에 planner 턴 항목으로 명시 등재했다
(`grep`으로 실재 확인). `pending_plans`/`spec_impact`도 `none`을 정직하게 유지했다(수정하지 않은
파일을 적지 않음 — `#1316`의 선례를 따름). 이것은 "Rationale에 기록된 invariant를 우회하는
설계"가 아니라, 우회 없이 SoT 경계(developer vs planner)를 존중하면서 drift를 정직하게 기록한
사례다.

### 이전 --impl-prep 라운드(`review/consistency/2026/09/11/14_59_33`)와의 정합

그 라운드는 T1(순수 함수)+T2(provider) 분리 계획 전체를 검토했고 위험도 NONE이었다. 실제 구현은
T1만 완료하고 T2는 이 PR 범위 밖으로 명시 이연했다(plan 체크리스트 `~~T2 이동~~`). 이 축소는
스코프 축소일 뿐 그 라운드가 확인한 Rationale 정합(C-2 순환 해소 선례 존중, R-CC-21 기각 대안
미재도입, R8/R4 무영향)에 영향을 주지 않는다 — T1만으로도 동일한 검증 대상이 그대로 성립한다.

## 발견사항

없음 — CRITICAL/WARNING 급 Rationale 연속성 위반을 발견하지 못했다.

- **[INFO]** spec 귀속 표기 drift(2곳)의 해소는 planner 턴 대기 중
  - target 위치: 코드 diff 자체가 아니라 그 결과로 생기는 `spec/4-nodes/7-trigger/providers/slack.md:275` · `discord.md:297`의 `TriggersService.assertInboundSigningPlaintextByProvider` 표기
  - 과거 결정 출처: 이전 planner 턴이 작성한 spec 귀속 서술(해당 함수가 `TriggersService`의 메서드였던 시절)
  - 상세: 함수가 module-level로 이동해 클래스 접두 표기가 부정확해졌다(실질은 유지). CRITICAL/WARNING이 아닌 이유: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 담당 항목으로 정확한 범위(2곳 한정, 나머지 3곳은 클래스 접두 없이 인용해 여전히 참)까지 실측 등재되어 있어 "무근거 방치"가 아니다.
  - 제안: 다음 planner 턴에서 두 파일의 인용을 "`TriggersService`가 `chat-channel-input-rules`의 X를 호출해 검증"형태로 갈라 적으면 종결. Rationale 재작성은 불필요(순수 귀속 서술 갱신).

## 요약

`impl-chat-channel-binder`는 `TriggersService`의 chat-channel 도메인 검증 로직을 module-level
순수 함수로 옮기는 동작-보존 리팩터이며, `spec/5-system/**`를 전혀 건드리지 않는다. R-CC-21이
명시적으로 기각한 다섯 대안(비밀 무시·rotate 가드만 패치·telegram 전용 API 분리·서명 재사용
사전집행·setupChannel 생략) 중 어느 것도 재도입되지 않았고, "PATCH/생성 경로 분리 유지"라는
R-CC-21의 구현 지침도 오버로드 타입까지 보존됐다. 이동으로 발생한 유일한 spec 정합 이슈(함수
귀속 표기 2곳)는 developer 권한 경계를 존중해 우회하지 않고 durable 트래커에 정확한 범위로
등재했다. 세 라운드의 코드리뷰 수정(테스트 커버리지 보강·JSDoc 캐너리 추가)도 `chat-channel-input-rules.ts`의
실질 로직을 전혀 바꾸지 않아 "동작 보존"이라는 이 PR의 유일한 주장과 Rationale 연속성 모두
일관되게 유지된다.

## 위험도

NONE
