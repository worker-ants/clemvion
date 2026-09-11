# 신규 식별자 충돌 검토 — `spec-draft-chat-channel-binder-drift.md`

## 검토 요약

target 은 새 개념·엔티티·엔드포인트를 **새로 도입하지 않는다**. `#1319`(T1)·`#1320`(T2) developer
턴이 이미 구현·머지한 `ChatChannelBinderService` / `chat-channel-binder.service.ts` /
`chat-channel-input-rules.ts` / `chat-channel-rejection-messages.const.ts` /
`trigger-callback-url.ts` 를 SoT(`code:` frontmatter·§7·귀속 3곳)에 **뒤늦게 반영**하는 문서
정정이다. 아래는 그 식별자들이 기존 사용처와 실제로 충돌하는지 코드베이스·spec 전수 grep 으로
검증한 결과다.

## 발견사항

### 1. `ChatChannelBinderService` / `chat-channel-binder.service.ts` — 충돌 없음 (검증됨)

- target 신규 식별자: 없음 — 이미 `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:49`
  에 `export class ChatChannelBinderService` 로 존재하고, `triggers.module.ts` provider 등록·
  `triggers.service.ts:253` DI 주입·`triggers.service.spec.ts`/`triggers.web-chat.spec.ts`/
  `chat-channel-binder.service.spec.ts` 에서 이미 사용 중이다.
- 기존 사용처: 위와 동일 (target 이전에 이미 실재).
- 상세: target 은 이 심볼을 spec 문서 3곳(secret-store.md §2.1, chat-channel-adapter.md §2.4,
  data-flow/14-chat-channel.md §0)의 **귀속 표기만 갱신**한다. 다른 의미로 이미 쓰이는 이름과의
  충돌이 아니라, spec 이 실제 구현을 뒤늦게 따라가는 정정이다. `spec/` 전수 grep 상
  `ChatChannelBinderService` 를 다른 의미로 쓰는 곳은 없다.
- 제안: 없음 (충돌 아님).

### 2. `code:` frontmatter 신규 glob 3줄 — 매칭 집합 정본 재검증, 충돌 없음

- target 신규 식별자:
  ```yaml
  - codebase/backend/src/modules/triggers/chat-channel-*.ts
  - codebase/backend/src/modules/triggers/dto/chat-channel-*.dto.ts
  - codebase/backend/src/modules/triggers/trigger-callback-url*.ts
  ```
- 기존 사용처: `codebase/backend/src/modules/triggers/` 실제 디렉토리 리스팅으로 대조.
- 상세: 위 3개 glob 이 매칭하는 실제 파일을 `ls` 로 재확인했다 — `chat-channel-binder.service.ts`
  ·`.spec.ts`, `chat-channel-input-rules.ts`·`.spec.ts`, `chat-channel-rejection-messages.const.ts`,
  `chat-channel-token-rotator.service.ts`·`.spec.ts`(7개) + `dto/chat-channel-config.dto.ts`(1개)
  + `trigger-callback-url.ts`·`.spec.ts`(2개) = **정확히 10개**, target 이 주장한 "10 = 차집합
  0" 과 일치한다. `chat-channel-*.ts` 접두로 시작하는 파일 중 이 도메인과 무관한 것은
  `modules/triggers/` 안에 **없다** (`notification-secret-rotator.service.ts` 등은 접두가
  달라 매칭되지 않음 — target 이 기각한 `modules/triggers/**` 안(27개, 무관 파일 포함)과는
  다른 결과). 신규 glob 이 의도치 않은 기존 파일을 끌어들이는 충돌은 없다.
- 제안: 없음 (충돌 아님, 실측 일치).

### 3. [INFO] `dto/**` (2-trigger-list.md) 와 `dto/chat-channel-*.dto.ts` (15-chat-channel.md) 의 중복 매칭은 **기존 상태의 연장**이지 target 이 새로 만든 것이 아니다

- target 신규 식별자: `codebase/backend/src/modules/triggers/dto/chat-channel-*.dto.ts` (15-chat-channel.md 신규 glob)
- 기존 사용처: `spec/2-navigation/2-trigger-list.md:13` `- codebase/backend/src/modules/triggers/dto/**`
- 상세: `dto/chat-channel-config.dto.ts` 는 두 spec 의 `code:` 에 동시에 매칭된다. 다만 이 중복은
  **target 이전부터 있었다** — 현재 15-chat-channel.md 는 이미 이 파일을 명시 경로로 갖고
  있었고(target 은 그 명시 줄을 지우고 glob 으로 갈음할 뿐, 매칭 대상 파일 자체는 그대로다).
  한 파일이 복수 spec 에 spec-linked 되는 것 자체는 이 저장소에서 흔한 패턴(예:
  `triggers.service.ts` 도 `12-webhook.md`·`14-external-interaction-api.md`·`15-chat-channel.md`·
  `2-trigger-list.md` 4곳에서 이미 겹친다)이라 CRITICAL/WARNING 대상은 아니다.
- 제안: 없음 — 기록 목적 (target 이 이 중복을 새로 만들지 않았음을 확인).

### 4. [INFO] 신규 `## Rationale` 항목이 `R-CC-*` 번호를 명시하지 않았다

- target 신규 식별자: "그 둘을 `15-chat-channel.md` 의 `## Rationale` 에 `R-CC-*` 항목으로
  남긴다" (구체적 번호 미지정)
- 기존 사용처: `spec/5-system/15-chat-channel.md` 에 이미 `R-CC-10·11·12·13·15·16·17·18·19·20·21`
  이 존재한다 (11개, `R-CC-14` 는 어디에도 없음 — 결번이지 dangling 참조가 있는 폐기 ID는
  아니다. `grep -rn "R-CC-14" spec/ plan/` 0건).
- 상세: 실제 spec 반영 시 다음 사람이 번호를 고를 때 기존 11개 중 하나와 우연히 겹칠 위험은
  낮지만(순차 부여가 관례), draft 자체엔 번호가 없어 검토 시점에 충돌 여부를 확정할 수 없다.
  결번인 `R-CC-14` 를 재사용해도 dangling 참조는 없지만, 순번 스킵 사유를 모르는 채 재사용하면
  "왜 14 만 비었나" 라는 새 혼란을 만들 수 있다.
- 제안: spec 본문 작성 시 `R-CC-22` (다음 순번) 사용을 권장 — `R-CC-14` 재사용은 피할 것.

### 5. [INFO] plan 파일명 유사도 — `spec-draft-chat-channel-drift-3.md`(complete) vs `spec-draft-chat-channel-binder-drift.md`(신규)

- target 신규 식별자: `plan/in-progress/spec-draft-chat-channel-binder-drift.md`
- 기존 사용처: `plan/complete/spec-draft-chat-channel-drift-3.md` (이미 종결된 별개 작업 —
  store()→rotate() 10곳 정정), `plan/complete/impl-chat-channel-binder.md`,
  `plan/complete/impl-chat-channel-binder-t2.md`
- 상세: 네 파일명이 `chat-channel`·`drift`·`binder` 토큰을 공유해 육안으로 구분하기 쉽지 않다.
  다만 실제 내용은 명확히 분리돼 있고(과거 작업은 완료·귀속 문제라 재오픈 대상 아님), 파일명
  자체가 기존 파일과 **동일하지 않다** — 순수 명명 컨벤션 위반은 아니다.
- 제안: 특별한 조치 불요. 향후 이 계열 plan 이 더 늘면 `chat-channel-` 접두 뒤에 더 구체적인
  구분어(예: `-sot-catchup`)를 붙이는 것을 고려.

## 검토하지 않은 영역 (검토 범위 밖으로 판단)

- API endpoint / webhook·queue·SSE 이벤트명: target 은 이 표면을 도입하지 않는다(§5.4 PATCH
  차단 규칙·`details.field` 값은 이전 PR 에서 이미 spec 에 등재됨 — grep 으로 기존 존재 확인).
- 환경변수: target 은 신규 ENV 를 도입하지 않는다.

## 요약

target 이 도입하는 "신규" 식별자는 대부분 **이미 코드베이스에 존재하는 심볼·파일**을 spec
SoT(`code:` glob·§7·귀속 3곳)에 뒤늦게 반영하는 것이며, 정본 매처(`_glob_to_regex` 로직)와
실제 디렉토리 리스팅으로 재검증한 결과 의도치 않은 파일 매칭이나 다른 의미로 이미 쓰이는
이름과의 충돌은 발견되지 않았다. `dto/**` 와 신규 glob 의 중복 매칭은 target 이전부터 있던
상태의 연장이라 새 충돌이 아니다. 유일하게 남는 것은 미확정 `R-CC-*` 번호 선택 시의 잠재적
혼동과, plan 파일명 계열의 육안 유사성으로, 둘 다 CRITICAL/WARNING 이 아닌 INFO 수준이다.

## 위험도

NONE
