# RESOLUTION — `review/consistency/2026/09/06/01_38_47`

**원 결과**: BLOCK: NO · Critical 0 · WARNING 1 · 위험도 LOW

## WARNING 1 (plan_coherence) — 후속 항목의 대상이 **한 칸 좁았다**

이 브랜치는 시크릿 응답 노출을 실제로 닫는데, 그 사실을 spec 에 반영할 후속 항목이
`secret-store.md §1` **하나만** 지목하고 있었다. 같은 현재형 서술이
`14-external-interaction-api.md §7.1` 에도 복제돼 있다 — *"현재 이 컬럼은 응답에도 나간다 …
이는 **미해결 결함**"*.

**왜 놓쳤나**: 그 항목이 §7.1 을 *"정정 이력 패턴의 출처"* 로 언급하고 있었다. 읽는 사람은
§7.1 이 이미 옳다고 읽는다 — 인용의 역할이 두 가지로 갈려 있었던 것이다. 이 항목만 따라간
planner 턴은 §7.1 을 거짓인 채로 남긴다.

**수정** — 항목 제목·본문에 두 위치를 **나란히** 적고, 키워드를 넓혀 다시 세지 않아도 되게
**전수 근거**를 함께 실었다:

```
grep -rn "노출 창\|응답에도 나간다\|미해결 결함" spec/
```

→ 이 창을 서술하는 자리는 `secret-store.md §1`(2행)과 `14-external-interaction-api.md §7.1`
(2행) **둘뿐**이다. 나머지 매치는 다른 맥락(`2-navigation/6-config.md` 평문 hide 정책 ·
`5-system/1-auth.md` 초대 만료)이다.

`spec/` 본문 자체는 건드리지 않는다 — **developer 권한 밖**이고, checker 도
*"이번 PR 자체는 조치 불요"* 라고 적었다. 이 브랜치가 할 수 있는 것은 **다음 사람이 두 곳을
함께 보게 만드는 것**이고 그것이 `plan/` 편집이다.

## INFO 4건 — 조치 불요

nav-spec 키-생략 사유 미반영 · `INTERNAL_ERROR` 한/영 drift(직전 라운드에 등재) ·
Ref DTO 명명 유사성(JSDoc 상호 참조로 완화 완료) · `secret-store.md §1` stale 화(위 WARNING
과 자매). 전부 이미 트래커에 있거나 `spec/` 쓰기다.

## 검증

코드 변경 없음 (`plan/**` 단독 편집). 직전 커밋에서 lint/unit/build/e2e 전 단계 PASS.
