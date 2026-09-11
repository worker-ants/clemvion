# RESOLUTION — `review/code/2026/09/11/19_06_54` (3라운드, `--route=all`)

**입력**: CRITICAL **0** · WARNING 2 · INFO 17 · RISK **LOW** · reviewer 14/14 ·
forced 누락 0 · unfinished 0.

**주의 — `testing` reviewer 가 하네스 보안 분류기에 차단됐다**(`Blocked by classifier`).
그 reviewer 의 지적(W1)은 **내가 직접 재현해 확인**했고, 아래 실측은 전부 내가 다시 잰 것이다.
차단 사유는 INFO 17 과 같은 뿌리로 보인다 — **공유 워크트리를 직접 뮤테이션**한 것.

---

## WARNING 1 — `remove()` 가 binder 를 부른다는 **배선 자체**를 아무도 안 본다

**분류**: 해소. **직접 재현했다.**

| 뮤턴트 | tsc | jest **전체** (수정 전) | jest 전체 (수정 후) |
|---|---|---|---|
| `remove()` 의 `await this.chatChannelBinder.teardownChatChannel(trigger);` 삭제 | 통과(무검출) | **GREEN — 9,598개 전부 통과** | **RED** |

**사전 존재 갭이다** — 옮기기 전에도 `this.teardownChatChannel(trigger)` 호출을 아무도 단언하지
않았다. 다만 **클래스 경계가 생겨 이제 싸게 닫힌다**: 협력자를 `jest.spyOn` 하면 된다.

자매 호출부(`create`/`update` → `setupChatChannel`)는 adapter mock 값까지 두껍게 단언하는데
이쪽만 비어 있던 **비대칭**을 없앴다. 테스트 1개 추가(트리거 스위트 257 → **258**).

> 이 지적은 **1라운드 W2 의 형제**다. 그때는 binder **안**의 분기(`has()===true` 경로)가 안
> 돌았고, 이번은 binder **로 가는 호출**이 안 걸렸다. 같은 함수를 두 층에서 각각 놓쳤다.

## WARNING 2 — **내 2라운드 RESOLUTION 이 거짓이었다**

**분류**: 해소 + **원 RESOLUTION 정정**.

2라운드에서 plan 의 옛 위치-인자 스케치를 고치고 *"해소"* 라고 적었는데, **옛 시그니처를 쓰는
자리는 둘**이었고 한 곳(§결정의 코드 블록)만 고쳤다. 나머지 한 곳(§W4 설명문 안의 인라인
인용)은 그대로였다. `18_42_05/RESOLUTION.md` 에 정정 블록을 달았다.

**이건 이 저장소에서 반복되는 실패다** — `#1319` 1라운드의 CRITICAL 도 *"등재했다"* 는 거짓
기재였다. 처방을 산문이 아니라 **절차**로 바꾼다: *"해소"* 를 쓰기 전에 **그 패턴을 grep 해
잔여 0을 보인다.** 이번엔 그렇게 했다 —
`grep -rn "buildTriggerCallbackUrl(this\.\|buildTriggerCallbackUrl(baseUrl" codebase/backend/src plan/in-progress`
→ **빈 출력**(review/ 아래 매치는 과거 프롬프트 스냅샷이라 대상이 아니다).

---

## INFO 17건 — 처분

새로 등재할 것 **없음**. 전부 ⑴ 기등재이거나 ⑵ 긍정 관찰이거나 ⑶ 조치 불요다.

| 분류 | INFO |
|---|---|
| **기등재 확인** | 1(adapter 에러 노출) · 3(순차 rotate) · 4(secret-ref 중복) · 5·6(lost update / 비-트랜잭션) · 7(함수 길이) · 8(`getAppBaseUrl` 중복) · 9(plan/complete 경로) · 10(spec 3곳 + OpenAPI) |
| **긍정 관찰** | 2(미export) · 12(직전 라운드 지적 해소 확인) · 13(setup 재커버 안 한 근거 실측 확인) · 15·16(스코프 경계 준수) |
| **조치 불요(저위험)** | 11(`private`→`public` 경계 미세 확장 — 모듈 밖 export 없음) · 14(순수 함수 경계값 2종) |
| **프로세스** | 17 — 아래 |

### INFO 17 — 워크트리 오염 **4회째**, 이번엔 하네스가 잡았다

architecture·requirement·database 3명이 `remove()` 의 teardown 호출이
`// MUTATED-OUT: …` 주석으로 치환된 것을 각각 관측했다. **내 워킹트리는 깨끗하다 — 실측했다**
(`git status --short` 는 신규 세션 디렉토리만, `grep -rn "MUTATED-OUT" codebase/backend/src`
**0건**, 호출부 855행 실재).

**이번엔 `testing` reviewer 가 보안 분류기에 차단됐다** — 즉 이 문제는 이제 *"reviewer 가 유령을
본다"* 를 넘어 **하네스 정책 위반으로 걸리는 단계**다. 2라운드에서 이미 처방을 *"내 규율"* 에서
*"reviewer 프롬프트에 scratch 강제"* 로 옮겨 적었고, 이번 관측을 그 항목에 4회째로 덧붙인다.

---

## 검증

- `remove()` 배선 뮤턴트: **GREEN(9,598 전부) → RED**.
- 옛 시그니처 잔여: **0** (grep 실측, 살아 있는 파일 범위).
- 트리거 스위트 257 → **258**. 4단계 결과는 커밋 본문.
