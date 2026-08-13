# RESOLUTION — 세션 `09_09_58` (CCH-SE-02 dedup, rebase 후 재검토)

이 라운드는 **#1158 squash 머지로 히스토리가 중복돼 rebase 한 뒤** 새 base 위에서 다시 돌린
검토다. 코드 변경분 자체는 직전 라운드(`02_50_38`, BLOCK:NO)와 동일하고, rebase 충돌은
문서 두 자리(`CHANGELOG.md` 신규 섹션 병치, plan 체크박스 vs main 의 주석 추가)뿐이었다.

rebase 후 재검증: eslint **0/0** · chat-channel + hooks **27 suites / 609 passed**.

## WARNING #1 (SCOPE) — developer 턴의 `spec/` 직접 수정

**처분: 내용 유지 + 기록 정정.**

되돌리지 않는 이유는 직전 라운드와 같다 — 기존 `필수` 요구사항(CCH-SE-02)의 **메커니즘 서술
정정**이지 새 제품 결정이 아니고, `--impl-done` consistency 가 두 라운드 연속 BLOCK:NO 로
내용 자체를 승인했다. 병합 직전에 3개 파일을 되돌렸다가 planner 턴에서 동일 내용을 다시 쓰는
것은 이력만 늘리고 얻는 것이 없다.

**다만 기록이 틀렸던 것은 고쳤다.** plan 완료 노트가 이탈 범위를 `15-chat-channel.md` ·
`providers/telegram.md` **2개**로 적었는데 실제는 **3개**다:

```
$ git diff --name-only origin/main...HEAD -- spec/
spec/4-nodes/7-trigger/providers/telegram.md
spec/5-system/15-chat-channel.md
spec/data-flow/14-chat-channel.md
```

이것이 이 라운드에서 실제로 조치할 값어치가 있는 유일한 항목이다. **위반을 스스로 적으면서
그 크기를 축소한 셈**이고, 그러면 기록의 목적(규약 형해화 방지)이 정확히 무력화된다. 축소된
기록은 없는 기록보다 나쁘다 — 다음 사람이 "2개였구나" 하고 넘어가기 때문이다.

plan 완료 노트에 실측 3개 파일 + 측정 명령 + 종전 기록이 좁았다는 사실을 명시했다.
(INFO #6 도 같은 항목이라 함께 해소된다.)

## 조치하지 않은 INFO 와 그 이유

전부 **트리거 조건이 이미 문서에 고정돼 있는** 유예 항목이거나 기존 관례의 연장이다.
이번 PR 은 rebase 재검토 라운드라 코드를 새로 건드리면 또 한 번의 리뷰 라운드를 요구한다.

| INFO | 처분 |
|---|---|
| #3 fail-open 클래스 3중 복제 | 유예 — **4번째** 유사 클래스가 트리거 (기존 고정) |
| #4 `handleChatChannelWebhook` guard 5단계 누적 | 유예 — **다음 guard 추가 시점**이 트리거. 이번 diff 가 그 조건을 충족시켰으므로 "더 이상 연장 금지" 를 SUMMARY 권장사항에 남김 |
| #1 `idempotencyKey` 길이 상한 | 유예 — 인증 통과 후에만 도달. 다만 `readKey`(EIA)는 200자 상한을 두는데 이쪽은 없다는 **비대칭**이므로 백로그 후보 |
| #5 §9.1 키 네이밍 미준수 | PR #1160 의존 — 그 PR 이 규칙 자체를 고친다. **아직 OPEN 임을 재확인**(이 세션에서 한 번 "이미 해소됐다" 고 잘못 처분한 항목) |
| #7 dedup 선점에 release 경로 없음 | 유예 — spec 요구사항엔 정합. 다음에 R-CC-20 을 만질 때 트레이드오프 한 줄 |
| #9~#11 JSDoc·DI 토큰 주석·모듈 docstring | 유예 — 해당 파일 다음 수정 시 |
| #12~#14 폴백 분기 테스트·리터럴 pin·e2e | 유예 — 형제 서비스 일괄 정리 시점, plan 등재됨 |
| #2 #8 #15 #16 #17 | 조치 불요 (확인 결과 문제 없음 / 기존 유예) |

## 검증

- eslint `src/modules/chat-channel` + `src/modules/hooks`: **0 warning / 0 error**
- jest 동 범위: **27 suites / 609 passed**
- 충돌 마커 잔여: **0** (`CHANGELOG.md`, plan 파일 전수 grep)
