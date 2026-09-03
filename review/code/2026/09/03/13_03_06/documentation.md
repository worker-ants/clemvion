# 문서화(Documentation) 코드 리뷰

## 리뷰 범위 및 방법

이번 diff(`origin/main` 대비)의 실질 코드/문서 변경은 4개 파일뿐이다 — 나머지 50개 파일은
`review/code/2026/09/03/{11_57_58,12_16_24,12_40_10}/**` · `review/consistency/2026/09/03/12_40_11/**`
등 이전 라운드의 리뷰 산출물(신규 커밋됨)이며, 회고적 스냅샷이라 "살아있는 문서"로서의 정합성
기준을 적용하지 않았다.

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING` 상수 신설
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `clearExpiryTimers` 추출, 타이머 쌍 non-optional 화, 선제 해제, `.unref()`
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 회귀 테스트 3~4종 추가
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — 이월 INFO 정리 이력 + 라운드 라벨 범례 추가

`Read` 로 소스 3파일의 **현재(최종) 상태**를 직접 열어 확인했다. 이전 라운드(`11_57_58`)의
`documentation.md`/`maintainability.md`/`scope.md` 가 지적한 "JSDoc 오귀속"(신규 심볼이 기존
JSDoc 과 대상 선언 사이에 끼어들어 `armExpiryTimers`/`AuthTokenExpiredPayload` 가 무문서 상태가
됨) 은 **이번 diff 가 반영하는 최종 상태에서는 이미 해소돼 있다** — `clearExpiryTimers`(147-241줄
부근)는 `armExpiryTimers` **뒤**에 자신의 JSDoc과 함께 배치돼 있고, `MSG_AUTH_TOKEN_EXPIRING`
(307-315줄)도 `AuthTokenExpiredPayload` **뒤**에 있다. `expiryTimers` 필드 JSDoc 중복도 병합돼
한 블록만 남았다(147-155줄). 커밋 이력(`b75e6a76b` 등)과도 일치해 재발 없음을 확인했다.

## 발견사항

- **[WARNING]** plan 문서에 새 인용 링크를 끼워 넣으면서 blockquote 들여쓰기가 깨지고 문장이 부자연스럽게 갈렸다
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:193` (191-194 블록 전체 맥락)
  - 상세: 직전 라운드(`12_40_10` documentation W2 — "리뷰 2R W1 라벨 중복")를 고치는 커밋
    `a1984f196` 이 같은 파일 안에서 또 다른 문서 결함을 만들었다. `git show a1984f196` 으로
    확인한 원문은 한 줄이었다:
    ```
    > 그 자리의 런북 항목 2건은 **다른 주제**(재연결 스파이크·배포 전환 창)였다. 추적한다고
    > 적으면서 추적처를 만들지 않았다.
    ```
    이 커밋이 `상세: [12_16_24/SUMMARY.md](...)` 인용을 "다른 주제였다." 와 "추적한다고" 사이에
    끼워 넣으면서 새 줄로 분리했는데, **그 새 줄에만 앞의 6-스페이스 들여쓰기가 빠졌다**
    (`Read`/`cat -e -t` 로 원본 바이트 직접 확인 — 형제 줄 190-192·194 는 전부 `      > ` 로
    시작하고 193 만 `> ` 로 시작). 이 블록은 `- [ ]` 리스트 항목(183줄) 안에 중첩된
    blockquote 인데, 193번 줄만 리스트 항목의 연속 들여쓰기(6칸)를 잃어 렌더러에 따라
    리스트 밖으로 새거나 별도 인용문으로 쪼개질 수 있다. 내용 면에서도 "상세: [링크]" 인용이
    "…였다." 와, 이 단락의 결론에 해당하는 강조 문장 "**추적한다고 적으면서 추적처를
    만들지 않았다**"(RESOLUTION.md `11_57_58`·`12_16_24` 에도 같은 표현이 등장하는 이
    이력의 핵심 문구) 사이에 끼어들어 문장의 리듬을 깬다.
  - 제안: 인용 링크를 문장 중간이 아니라 문단 끝(또는 시작)으로 옮기고, 새로 추가한 줄에도
    형제 줄과 동일한 `      > ` 접두(6칸 들여쓰기 + `>`)를 맞춘다. 예:
    ```
    > 그 자리의 런북 항목 2건은 **다른 주제**(재연결 스파이크·배포 전환 창)였다.
    > **추적한다고 적으면서 추적처를 만들지 않았다.**
    > 상세: [`12_16_24/SUMMARY.md`](../../review/code/2026/09/03/12_16_24/SUMMARY.md)
    ```

## 그 외 확인한 항목 (문제 없음)

- **`clearExpiryTimers`/`armExpiryTimers` JSDoc 배치**: 위에서 서술한 대로 현재 상태는 정상 —
  각 선언 바로 위에 자신의 JSDoc 이 붙어 있다(`websocket.gateway.ts:161-175` = `armExpiryTimers`,
  `:230-234` = `clearExpiryTimers`). 이전 라운드가 지적한 오귀속은 재발하지 않았다.
- **`AuthTokenExpiredPayload`/`MSG_AUTH_TOKEN_EXPIRING` JSDoc 배치**: 마찬가지로 정상 —
  인터페이스(287-305줄)와 상수(307-315줄)가 각자 인접한 JSDoc 을 갖는다.
  `MSG_AUTH_TOKEN_EXPIRING` 의 JSDoc(`'단일 SoT'`)은 승격 근거(리터럴로 두면 `expect.any(String)`
  으로만 테스트할 수 있다)를 정확히 설명하고, 실제로 `websocket.gateway.spec.ts` 신규 테스트가
  상수 참조 + 리터럴 값 이중 단언으로 그 근거를 검증한다.
- **인라인 주석**: `armExpiryTimers` 진입부의 선제 `clearExpiryTimers` 호출 이유(`:180-182`),
  `untilNotice`/`cutoff` 양쪽의 `Math.max(0, …)` 클램프가 "의도적 중복 방어"라는 근거(`:194-197`,
  `:211-213`), `.unref()` 이유(`:222-223`) 모두 무엇을·왜 하는지 구체적으로 설명하며 뮤테이션
  검증 결과(plan 문서)와 1:1 대응한다.
- **테스트 설명/주석**: `websocket.gateway.spec.ts` 신규 4개 테스트(문구 상수 일치, 재무장 시
  해제, `exp` 없는 재무장, `.unref()`, 만료 시 emit→disconnect 순서)는 각각 "왜 이 단언이
  필요한가"를 테스트 이름과 인라인 주석에 함께 남겨 vacuous 여부를 스스로 설명한다 — 특히
  `Math.max(0, …)` clamp 테스트가 "이 테스트는 clamp 자체의 가드가 아니다"라고 명시적으로
  선을 그은 점이 좋다.
- **README/CHANGELOG/API 문서**: 이 diff 는 이미 `CHANGELOG.md`(`## Unreleased — 소켓이 만료된
  토큰으로 무기한 인가돼 있었다`)와 spec `§4.6`에 문서화된 기능의 내부 하드닝일 뿐이며, wire 로
  나가는 `message` 값(`MSG_AUTH_TOKEN_EXPIRING`)은 종전 리터럴과 바이트 단위로 동일하다(직접
  대조 확인). 새 REST 엔드포인트·설정·환경변수는 없다. 별도 CHANGELOG/README/API 문서 갱신은
  불필요하다는 이전 라운드들의 결론에 동의한다.
- **plan 문서의 라운드 라벨 범례(25-33줄) 자체**: `리뷰 NR`/`서브사이클 <타임스탬프>` 두 체계를
  구분한 도입은 실제로 유효했다 — 종전에 두 곳에서 중복 사용되던 `리뷰 2R W1` 라벨 중
  하나(셧다운 콜백 항목, 183줄)는 `서브사이클 12_16_24 W1` 로 재라벨링됐고, 나머지 하나(타이머
  지터 항목, 168줄)만 `리뷰 2R W1` 로 남아 이제 유일한 참조가 됐다. 링크된 세 라운드
  디렉터리(`11_57_58`·`12_16_24`·`12_40_10`)도 모두 diff 안에 실재해 깨진 링크가 아니다.

## 요약

핵심 코드 3파일(`websocket-events.types.ts`/`websocket.gateway.ts`/`websocket.gateway.spec.ts`)은
문서화 품질이 양호하다 — 이전 라운드에서 5명이 독립 발견했던 JSDoc 오귀속 결함은 이번 diff 가
반영하는 최종 상태에서 이미 정정돼 있고 재발하지 않았으며, 인라인 주석·테스트 설명 모두 근거를
구체적으로 남긴다. 유일한 발견은 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 에서
직전 라운드의 라벨 중복 문제(`리뷰 2R W1`)를 고치는 과정에서, 새로 삽입한 인용 링크 한 줄이
blockquote 들여쓰기를 잃고 문장 중간에 어색하게 끼어든 것이다 — 기능에는 영향 없으나 이 plan
문서가 스스로 "이 문서가 트래커 역할을 한다"고 선언한 SoT 이므로, 같은 패턴(끼워넣기 편집이
주변 서식/문맥을 깨는 것)이 이번엔 소스 코드가 아니라 plan 문서에서 재발했다는 점에서 병합 전
정정이 바람직하다.

## 위험도

LOW
