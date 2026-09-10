# Rationale 연속성 검토 — `plan/in-progress/spec-draft-chat-channel-drift-3.md`

## 검토 방법

target 의 각 결정(D-1~D-4)·변경안(A1~C4)·기각한 대안 3건을 실제 소스로 대조했다:

- `codebase/backend/src/modules/triggers/triggers.service.ts` (`assertChatChannelAlreadySetUp` · `assertPatchCarriesNoSecrets` · `assertInboundSigningPlaintextByProvider` · `normalizeNotificationSecretRef`)
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` · `trigger-dto-validation.spec.ts`
- `spec/5-system/15-chat-channel.md` §5.4~§5.5, Rationale R-CC-10/R-CC-12/R-CC-21
- `spec/conventions/secret-store.md` §2.1/§2.2/§5.1/§5.5
- `spec/2-navigation/2-trigger-list.md` Rationale R-2/R-12/R-14
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (이연 항목 4건의 트래커 실존 여부)
- `review/consistency/2026/09/11/{00_21_57,00_45_19,01_10_44,02_06_14}` 및 `2026/09/10/{22_04_23,22_14_27}` (기각한 대안이 인용하는 실제 이력)

전 항목이 실측·실제 코드·실제 이전 리뷰 로 뒷받침됐다 — "지어낸 기각 이력" 은 발견되지 않았다.

## 발견사항

### [INFO] 신규 400 두 분기 표기 — "결정 신설이 아니다" 라는 주장은 코드로 확인됨

- target 위치: "왜 이 턴인가" §(b), 결정 D-2, 변경안 A3/B3
- 과거 결정 출처: `spec/5-system/15-chat-channel.md` Rationale **R-CC-21**("PATCH 는 비밀을 쓰지 않는다"), `spec/2-navigation/2-trigger-list.md` Rationale **R-12**("provider 변경하려면 트리거 삭제·재생성")
- 상세: `triggers.service.ts:722-747` 의 `assertChatChannelAlreadySetUp` 은 이미 두 분기(`details.field='chatChannel'`/`'provider'`) 를 명시적 `BadRequestException` 으로 구현하고 있고, 코드 주석이 R-CC-21/D-1 을 직접 인용한다. target 이 "결정 신설이 아니라 문서화 누락" 이라 서술한 것은 정확하다 — 이 두 분기는 R-CC-10(single-path)·R-CC-21(PATCH 는 비밀을 쓰지 않는다)·R-12(provider 불변) 세 기존 결정의 필연적 귀결이며 새 원칙을 도입하지 않는다.
- 제안: 없음(현행 유지). 다만 §5.4.1 표에 신규 행을 추가할 때 위 세 Rationale 앵커(R-CC-10/R-CC-21/R-12)를 모두 cross-link 하면 다음 사람이 "왜 이 두 분기가 결정 사안이 아닌지"를 spec 자체에서 재구성할 수 있다. target 의 B3 는 R-12 cross-link 만 계획하는데, `15-chat-channel.md` 쪽 신규 두 행에도 R-CC-21 cross-link 을 명시하면 추적성이 더 좋아진다.

### [INFO] `store()` → `rotate()` 정정은 기존 Convention 권고(§2.1)와 정합 — 반전 아님

- target 위치: "왜 이 턴인가" §(c), 결정 D-3, 변경안 A4/C1~C4
- 과거 결정 출처: `spec/conventions/secret-store.md` §2.1 호출 규약 표("Trigger 생성 ... `rotate()` 권장"), §2.2 "멱등성" 표
- 상세: 실제 backend 에는 `secrets.store(` 호출이 전무하다(`grep -rn "secrets\.store\b" codebase/backend/src` 결과 0건). `secret-store.md:301` 의 `store()` 예시 코드는 §2.1 자신의 권고와 이미 모순돼 있었다(문서 내부 drift). target 의 정정은 새 원칙을 세우는 것이 아니라 이미 §2.1 이 채택한 "생성 시점도 rotate() 권장" 방침에 예시·타 스펙 표기를 맞추는 것이므로 Rationale 반전이 아니다.
- 제안: 없음. D-3 가 "근거를 정본 자리 한 번만 남기고 나머지는 표기만 바꾼다"고 명시한 것은 근거 중복 산재를 막는 좋은 관례다.

### [INFO] R-CC-21 "재검토 신호" 3축 표는 target 이 건드리지 않음 — 경계 유지 확인

- target 위치: "손대지 않는 자리" 목록, "이 턴에 하지 않는 것" 목록
- 과거 결정 출처: `15-chat-channel.md` R-CC-21 "재검토 신호"(bot token / slack·discord inboundSigningPlaintext / telegram server-issued 3축 구분), §5.4.1.1 telegram carve-out
- 상세: target 이 명시적으로 배제한 `providers/slack.md:275` · `providers/discord.md:297` (생성 경로 서비스 가드, flat 이 맞음) 는 실제로 `assertInboundSigningPlaintextByProvider` 가 `mode === 'create'` 분기에서만 호출됨(`triggers.service.ts:681-686` 주석 "이 검사를 PATCH 에도 걸면 두 provider 의 카드 편집이 전부 400 이 된다")을 코드로 확인했다 — target 의 층 구분("생성 경로 서비스 가드")이 정확하다. R-CC-21 의 3축 구분(telegram 비대상)도 target 이 그대로 존중해 telegram 서명 자리를 건드리지 않는다.
- 제안: 없음. 형식(flat/중첩)만 보고 일괄 치환하려던 최초 계획을 층 확인 후 철회했다는 target 의 서술은 실제로 정당한 자기 교정이다.

### [INFO] 이연 4항목은 실제로 트래커에 살아있음 — "이 턴에 하지 않는 것"이 은폐가 아님

- target 위치: "이 턴에 하지 않는 것" 4개 항목
- 과거 결정 출처: 직전 라운드 `review/consistency/2026/09/11/02_06_14/SUMMARY.md` 발견사항 #2(rationale_continuity — 동시 PATCH lost update 가 R-CC-21 fail-open invariant 를 재발시킬 위험)
- 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md:2168` 에 "동시 PATCH 가 trigger.config 를 잃을 수 있다(lost update) — 방금 닫은 fail-open 이 이 경로로 재발 가능" 항목이 실제로 등재돼 있고, `:2115` 에 `setupChannel` 멱등 각주 항목도 등재돼 있다. target 이 이 둘을 "이 턴에 하지 않는 것"으로 명시하고 developer/후속 턴으로 넘긴 것은 스코프 밖 code 사안을 문서화 전용 planner 턴에서 떠맡지 않는 정당한 경계다 — R-CC-21 invariant 위험이 조용히 사라지는 것이 아니라 여전히 추적 중이다.
- 제안: 없음(확인 목적 항목).

### [INFO] 기각한 대안 3건 모두 실제 이력에 근거 — 소급 부여 없음

- target 위치: "기각한 대안" 표(D-1~D-3 관련)
- 과거 결정 출처: `review/consistency/2026/09/11/01_10_44/SUMMARY.md`(단순화 시도가 잡힌 라운드), `2026/09/10/{22_04_23,22_14_27}`(telegram carve-out 논의)
- 상세: 세 항목 모두 실존 디렉토리·실제 SUMMARY 문구로 뒷받침된다. 특히 "두 갈래 중 흔한 쪽(중첩)만 적고 단순화 — 직전 턴이 그렇게 했다가 impl-done 이 잡았다"는 `01_10_44`(WARNING: flat/미확정 서술이 실측보다 낡음) 와 `02_06_14`(5차 연속 동일 판정) 두 라운드에 걸쳐 정확히 확인된다. project 메모(`feedback_rationale_rejected_alternatives_need_history.md`)가 경고하는 "지어낸 기각 이력"·"소급 부여된 근거" 패턴은 이 문서에서 발견되지 않았다.
- 제안: 없음.

## 요약

target 은 세 라운드 이상 반복 지적된 문서-실측 drift(`details.field` 표기·신규 400 두 분기·`store()`→`rotate()`)를 planner 권한으로 정정하는 순수 문서 동기화 turn 이며, 새로운 설계 결정을 내리지 않는다. 모든 변경은 R-CC-10(single-path)·R-CC-21(PATCH 는 비밀을 쓰지 않는다)·R-12(provider 불변)·secret-store.md §2.1(rotate 권장)이 이미 확정한 원칙의 **필연적 귀결**을 문서에 반영하는 것이고, 실제 backend 코드(`assertChatChannelAlreadySetUp`·`assertPatchCarriesNoSecrets`·`assertInboundSigningPlaintextByProvider`·전무한 `secrets.store()` 호출)로 전수 대조한 결과 target 의 층 구분("생성 경로는 flat 이 맞다 vs PATCH 경로는 두 갈래")과 기각한 대안 3건의 이력 인용이 모두 정확했다. 손대지 않기로 한 자리(telegram 서명 축, R-CC-21 재검토 신호 3축, 동시 PATCH lost update, `setupChannel` 멱등 각주)도 기존 Rationale·트래커 경계를 그대로 존중한다. Rationale 연속성 관점에서 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE
