# 아키텍처(Architecture) Review

## 검토 범위

이번 라운드(20_17_16)는 이전 세 라운드(18_17_44 → 19_07_43 → 19_44_08, 각각 architecture
MEDIUM → MEDIUM → LOW 로 수렴)가 지적한 항목들이 이미 구조적으로 닫힌 상태 위에, 마지막
커밋 `369852b4f`(창 1 삭제-부활 방지 C1 + hooks 대칭 자리 회귀 C2 + 서술 정정)이 얹힌
최종 상태를 본다. 코드는 Read/Grep 만으로 확인했고 저장소에 쓰기는 하지 않았다
(`git status --short` 무흔적 확인).

핵심 실 코드는 `trigger-config-lock.ts`(신규 유틸), `chat-channel-binder.service.ts`,
`triggers.service.ts`(창 1), `hooks.service.ts`(hot path 두 자리), `chat-channel-input-rules.ts`
(`extractInboundSigningRef`), 정적 가드 `endpoint-path-conflict-wrap-guard.ts`, 그리고
테스트 인프라(`trigger-transaction-mock.ts`)다.

## 발견사항

- **[INFO]** 부재(row missing) 처리 계약이 창 1 과 창 2·3·4 사이에서 여전히 다르다 — 이번
  커밋이 대칭을 완성했지만 "무엇을 던지는가"는 갈라진 채 남았다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:592-596`
    (`if (!fresh) { throw new NotFoundException(...); }`) vs
    `codebase/backend/src/modules/triggers/trigger-config-lock.ts:113-114`
    (`if (!fresh) return false;`, 세 호출부 모두 반환값을 버림 — 이미 18_17_44
    architecture INFO 에서 지적).
  - 상세: 이번 커밋(C1)은 "행이 사라졌으면 쓰지 않는다"는 규율을 창 1 에도 적용해 이전
    라운드가 지적한 **동작 비대칭**(창 1 만 되살림)을 닫았다 — 그 자체는 정확한 수정이다.
    다만 그 결과 "행이 없을 때 무엇을 하는가"의 **표현 방식**이 갈라진 채 확정됐다: 창 1(사용자
    PATCH 요청 경로)은 404 로 실패를 드러내고, 창 2·3·4(생성/PATCH 뒤에 이어지는 best-effort
    채널 설정·토큰 회전)는 `false` 를 반환하되 아무도 관측하지 않아 조용히 skip 한다. 두 선택
    모두 호출 맥락(동기 요청 vs 이미 커밋된 트리거에 대한 후속 작업)에 비춰 각각 타당하지만,
    `trigger-config-lock.ts:53-54` 의 "배선" 절은 "창 1 은 인라인으로 락을 잡는다"는
    사실만 못박았을 뿐 "그리고 부재 시 거동도 다르다(하나는 throw, 셋은 false)"는 계약 차이는
    적지 않았다. 다섯 번째 쓰기 지점이 생기면 이 함수 JSDoc만 보고는 어느 쪽을 따라야 하는지
    판단 근거가 없다 — 지난 세 라운드 모두 "다음 자리가 생기면 어떤 패턴을 따를지 판단
    기준을 남겨 두라"고 반복해서 권고한 것과 같은 종류의 간극이다.
  - 제안: `trigger-config-lock.ts` JSDoc 의 `@returns` 절 또는 "배선" 절에 한 줄을 더해
    "창 1 은 부재를 404 로 드러내고(동기 요청이라 사용자에게 알려야 함), 이 함수는 `false`
    로 감춘다(호출부가 이미 커밋된 작업의 후속이라 사용자에게 보고할 요청이 없음)"는 판단
    기준을 명시하면, 다음 확장자가 산문 대신 이 한 줄로 결정할 수 있다.

- **[INFO]** `HooksService` 의 hot-path 두 자리가 동일한 5줄 근거 주석과 `update()` 호출을
  글자 그대로 복제한다 — 이 PR 이 `chatChannel` 조립에서 고친 것과 같은 모양의 drift 위험을
  새로 만들었다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:227-236`(`handleWebhook`)
    과 `:695-704`(chat-channel 인입, `handleChatChannelWebhook` 계열) — 두 블록이 주석
    문구·호출 형태(`triggerRepository.update({ id: trigger.id }, { lastTriggeredAt: ... })`)
    까지 동일하다.
  - 상세: 이 PR 자신이 `chat-channel-binder.service.ts` 에서 "거의 같은 스프레드-조건을
    두 클로저가 각각 들고 있으면 한쪽만 고치고 다른 쪽을 놓친다"(`buildChannel` 추출 근거,
    `/ai-review` 18_17_44 maintainability WARNING#6)는 이유로 중복을 제거했고, 락 획득
    SQL 도 같은 이유(`/ai-review` 19_07_43 architecture WARNING#4)로 `acquireTriggerConfigLock`
    한 곳에 모았다. 그런데 정확히 같은 커밋이 `HooksService` 에는 같은 모양의 복제(주석+호출)를
    두 자리에 남겼다 — 실제로 이 PR 의 커밋 이력(C2)이 "두 자리 중 하나만 고치고 실측했다고
    잘못 적었다"는 사고를 냈는데, 그 사고가 가능했던 구조적 배경이 바로 이 복제(공유 헬퍼가
    없어 각 자리를 따로 찾아 손으로 맞춰야 했던 것)다. 지금은 대칭 테스트로 잠가 뒀지만,
    코드 구조 자체는 "다음에 세 번째 hot path 가 생기면 또 손으로 복제"하게 되어 있다.
  - 제안: `touchLastTriggeredAt(triggerId: string): Promise<void>` 같은 사설 헬퍼(또는
    `trigger-config-lock.ts` 와 대칭되는 자리)로 뽑아 두 호출부가 함수 하나를 공유하게
    하면, 근거 주석도 한 곳에만 남아 다음 회귀 방지 테스트가 "그 함수가 호출됐는가" 하나로
    단순해진다. 지금 당장 막을 사유는 아니다(로직이 한 줄이라 실질 위험은 낮음).

- **[INFO]** (해소 확인) 이전 라운드들이 지적한 architecture WARNING 은 모두 구조적으로
  닫힌 상태가 이번 라운드에도 유지된다
  - 락 획득 SQL 단일화(`acquireTriggerConfigLock`, `trigger-config-lock.ts:39-46`), 성공/
    실패 클로저 통합(`buildChannel`, `chat-channel-binder.service.ts:226-241`), 인라인 캐스트
    통합(`extractInboundSigningRef`, `chat-channel-input-rules.ts:239-250`) 세 건 모두
    `grep -rn`으로 재확인했고 프로덕션 코드에 리터럴 중복이 남아 있지 않다. 새로 회귀한
    항목은 없다.

- **[INFO]** (carry-forward, 미해결·의도적 유예) `rewriteTriggerConfigLocked` 가 `Trigger`
  엔티티에 하드코딩돼 있어 재사용 시 제네릭화가 필요하다 — 18_17_44 architecture INFO 와
  동일, 이번 커밋으로 변화 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:113`
    (`m.findOne(Trigger, ...)`), `:132`(`m.update(Trigger, ...)`).
  - 상세/제안: 기존 지적과 동일 — plan §D 가 후속 대상(10곳)을 이미 등재해 뒀으므로 지금
    범위를 넓히라는 뜻은 아니고, 후속 착수 시점에 엔티티를 매개변수화할 것을 다시 한번
    상기시키는 차원.

## 긍정적으로 확인한 점

- C1(창 1 삭제-부활 방지)과 C2(hooks 대칭 자리)는 둘 다 "이전 라운드가 만든 비대칭을
  구조로 닫는다"는 동일한 원칙(형제 창들과 같은 규율 적용)을 따랐고, `trigger-config-lock.ts`
  JSDoc 의 "배선" 절이 어느 창이 이 함수를 거치고 어느 창이 인라인인지 3라운드 만에 명문화됐다
  — 문서와 구현의 대응 관계가 최종적으로 일치한다.
- `triggers.service.ts:593` 의 `NotFoundException` 은 `.catch((err) => this.rethrowEndpointPathConflict(err))`
  를 거쳐도 `isEndpointPathUniqueViolation` 분기에 걸리지 않아 `throw err;`(원본 그대로)로
  빠져나간다(`triggers.service.ts:1402-1427` 확인) — 에러 변환 레이어가 이 신규 예외 타입을
  삼키거나 오분류하지 않는다.
- 순환 의존, 레이어 경계 붕괴, 새로운 SOLID 위반은 이번 커밋에서도 발견되지 않았다.

## 요약

이번 라운드는 이전 세 라운드가 수렴시킨 아키텍처(락 프리미티브 단일화, 클로저/캐스트 중복
제거, 순환 의존 회피, 임계 구간 최소화)를 그대로 유지한 채, 마지막 커밋이 두 개의 실질
Critical(삭제된 트리거 부활 경로, hooks 대칭 자리 미수정)을 형제 창들과 같은 "부재 시
쓰지 않는다"는 규율로 닫은 것이다. 그 수정 자체는 구조적으로 건전하지만, 그 과정에서 (1)
"부재를 어떻게 드러내는가"(예외 vs 무시된 boolean)가 창별로 갈린 채 문서화되지 않은 결정으로
남았고, (2) `HooksService` 의 두 hot-path 자리가 이 PR 이 다른 곳에서는 제거한 것과 같은
모양의 주석+호출 복제를 새로 만들었다. 둘 다 지금 당장 동작을 위협하지 않는 INFO 수준의
관찰이며, 차단 사유가 아니다.

## 위험도

LOW
