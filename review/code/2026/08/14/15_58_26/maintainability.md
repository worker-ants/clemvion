# 유지보수성(Maintainability) 리뷰

리뷰 대상 중 가독성/네이밍/함수 길이/중첩/매직 넘버/중복/복잡도 관점이 실질적으로 적용되는
코드 파일은 다음 넷이다:

- `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (신규)
- `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts` (신규)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`stripAndRedact` 추가 + `getStatus` 세 출구 배선 변경)
- `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` (신규 테스트 2건)
- `codebase/backend/src/modules/websocket/websocket.service.ts`(`stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS` 를 공유 유틸로 이관, 호출부만 남김)
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts` (신규 테스트 4건)

`CHANGELOG.md`, `plan/in-progress/*.md`, `review/**/*.md|json` 은 계획·리뷰 산출물 문서라
이 관점의 적용 대상이 아니다(선행 라운드들과 동일 판단).

이번 diff 는 이미 여러 라운드(`10_32_27`→`11_02_16`→`12_06_20`→`14_30_35`→`14_55_29`→…)를
거친 결과물이다. 과거 라운드가 지적한 유지보수성 WARNING 들이 실제로 해소됐는지 코드를
직접 열어 재검증했다.

## 과거 지적 재검증 (참고용 — 새 발견 아님)

- `redactAndStrip`(이름이 실행 순서와 반대, `14_55_29` W3) → **해소 확인**. 현재
  `interaction.service.ts:98` 는 `stripAndRedact` 로 이름이 바뀌어 실제 합성 순서
  (strip 이 안쪽/먼저)와 일치한다.
- `websocket.service.ts` 의 dangling JSDoc(`14_55_29` W4) → **해소 확인**. 현재
  `:294-300` 은 `/** */` 가 아니라 `//` 라인 주석으로, 뒤따르는 KB union 선언에
  잘못 귀속될 여지가 없다.
- 깊이 sweep 테스트의 매직 넘버(`12_06_20` W1) → **해소 확인**.
  `websocket.service.spec.ts` 의 `it.each` 는 `MAX_SANITIZE_DEPTH - 5` 등 상수 상대값을
  쓰고, `strip-external-only-fields.spec.ts` 의 REST 쪽 sweep 도 `MAX_REDACT_DEPTH - 5`
  등으로 동일 관례를 따른다.
- 테스트 JSDoc 의 현재형 서술 stale(`12_06_20` W2) → **해소 확인**. 현재 JSDoc 은
  "종전엔 …였다(이 커밋에서 통일했다)" 식 과거형+정정으로 적혀 있다.
- 경계 연산자 통일(`11_02_16` CRITICAL 1) → **해소 확인**. `websocket.service.ts:252`
  (`sanitizePayloadForWs`)와 `strip-external-only-fields.ts:85`(`stripDeep`) 모두
  `depth > maxDepth` 로 동일 연산자를 쓴다.

## 발견사항

- **[INFO]** `InteractionService.getStatus` 가 단일 함수 안에 "얇은 projection 조회 →
  waiting 분기 재구성(2차 조회·conversationThread·buttonConfig 분기) → terminal 분기
  마스킹" 세 책임을 담고 있어 134줄(`interaction.service.ts:320-454`)로 길다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:320`(`async getStatus`)~`454`
  - 상세: 이번 diff 는 이 함수의 구조를 바꾸지 않았다 — `deepRedactSecrets(...)` 호출을
    `stripAndRedact(...)` 로 교체하고 그 근거 주석을 늘렸을 뿐이다(`:375-378`,
    `:430-438`). 즉 함수 길이 자체는 이 PR 이 새로 만든 문제가 아니라 기존 상태다.
    다만 waiting 분기의 `currentNode`/`context` 조립 로직(`:344-423`, 약 80줄)은
    개념적으로 독립된 단위라, 향후 이 함수를 다시 건드릴 일이 생기면 별도 private
    메서드(`buildWaitingContext` 류)로 추출할 여지가 있다.
  - 제안: 이번 라운드에서 조치할 필요는 없음(스코프 밖). 다음에 `getStatus` 를 다시
    수정할 때 waiting 분기 조립을 추출하면 가독성이 개선된다는 점만 기록.

- **[INFO]** `stripDeep`(`strip-external-only-fields.ts`)와 `sanitizeInner`
  (`websocket.service.ts`)가 "배열이면 원소별 재귀, 객체면 key 별 재귀, 변경 없으면
  원본 참조 반환" 골격을 두 파일에 나눠 중복 구현한 상태가 이번 diff 로도 유지된다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:84-125`
    (`stripDeep`) vs `codebase/backend/src/modules/websocket/websocket.service.ts:266-292`
    (`sanitizeInner`)
  - 상세: `10_32_27`/`14_55_29` 라운드에서 이미 지적·유예된 항목이고,
    `12_06_20` RESOLUTION 에 "의도적 defer. 한쪽 수정 시 짝점검 관례 유지" 로 명시
    기록돼 있다. 실제로 이번 diff 의 경계 연산자 통일이 그 관례대로 양쪽에 반영됐다
    (재검증 항목 참조). 새 결함이 아니라 기존 합의된 트레이드오프이므로 재지적 목적이
    아니라 상태 확인 차원에서만 기록한다.
  - 제안: 없음(추가 조치 불필요, 기록 유지 목적).

## 확인했으나 문제 없음 (positive findings)

- `stripAndRedact`(`interaction.service.ts:98-108`)는 11줄로 짧고, "왜 strip 을 먼저
  하는지"(비용) · "왜 한 함수로 묶었는지"(출구 3개가 각자 조립되면 한 번에 하나씩만
  고쳐진다) 를 함수 바로 위 JSDoc 에 근거와 함께 남겨, 코드베이스의 기존 무거운 주석
  관례와 일치한다.
- `stripDeep`(`strip-external-only-fields.ts:84-125`, 약 42줄)의 순환 복잡도는 낮다 —
  분기는 "상한 초과", "배열", "null/원시값", "strip 대상 key", "재귀 결과 변경" 5갈래뿐이고
  중첩은 최대 2단계(배열 for 안 if, 객체 for 안 if)로 과도하지 않다.
- 신규 테스트(`strip-external-only-fields.spec.ts`, `interaction.service.spec.ts` 의
  두 `it`/`it.each`, `websocket.service.spec.ts` 의 신규 4건)는 모두 기존 파일의 명명
  규약(`describe`/`it` 한국어 서술, 대조군 병기)과 구조를 그대로 따르고, 이전 라운드가
  지적했던 "판별력 없는 fixture" 문제도 뮤턴트 실측을 JSDoc 표로 남겨 재발을 막고 있다.
- `EXTERNAL_STRIPPED_FIELDS` 를 신규 공유 파일 상단에 `export const` 로 노출하고
  `Object.entries` + `includes` 로 조회하는 방식은 종전 `websocket.service.ts` 내부
  구현과 동일 패턴을 유지해, 파일 이동에 따른 스타일 변화가 없다.
- `Object.defineProperty` 를 통한 `__proto__` 이중 방어(`:116-121`)는 코드만 보면
  과잉으로 보일 수 있으나, 바로 위 주석이 "스프레드가 1차 방어, defineProperty 는
  `out` 생성 방식이 바뀌어도 안전하도록 하는 중복 방어" 라고 이유를 명시해 다음
  유지보수자가 "왜 이렇게 방어적인가" 를 재추적할 필요가 없다.

## 요약

이번 diff 의 핵심 코드 변경(`strip-external-only-fields.ts` 신규 + `interaction.service.ts`/
`websocket.service.ts` 배선)은 여러 라운드에 걸쳐 지적된 유지보수성 WARNING(이름-순서
불일치, dangling JSDoc, 매직 넘버 하드코딩, stale 서술, 경계 연산자 불일치)이 전부
실제로 코드에 반영돼 해소돼 있음을 직접 열어 재확인했다. 새로 도입된 코드(`stripDeep`,
`stripAndRedact`)는 함수 길이·중첩·순환 복잡도가 낮고, 근거를 남기는 주석 관례도
일관되게 지켜졌다. 남은 항목은 둘 다 INFO 수준이며 이번 PR 이 만든 문제가 아니라
기존 상태의 연장이다 — `getStatus` 의 다책임 구조(추출 여지는 있으나 diff 가 새로
악화시키지 않음)와, 이미 합의·유예된 `stripDeep`/`sanitizeInner` 트리 순회 골격 중복.
둘 다 정확성에 영향이 없고 조치를 요구하지 않는다.

## 위험도

LOW
