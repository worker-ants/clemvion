# RESOLUTION — `invitedBy` nullable 정정 리뷰 1R

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **3** · INFO 7
reviewer 9명 실행, forced 7명 전원 결과 확보.

## W1 (testing) — 인자 검증 누락. 조치함

신규 `listInvitations` 테스트 2건이 **결과값만** 보고 `listPending` 호출 인자를 안 봤다.
같은 파일의 다른 5개 describe 는 전부 `toHaveBeenCalledWith` 로 인자를 검증한다.

`expect(invitations.listPending).toHaveBeenCalledWith('ws-1', user.sub)` 추가.
**뮤테이션으로 유효성 확인** — 핸들러의 인자 순서를 스왑하면 예측대로 RED
(실측 1 failed / 13 passed).

## W2 (documentation) — 내가 세운 규칙을 내가 안 지켰다. 조치함

`invitedBy` 는 OpenAPI 계약 변경(`required` 해제 + `nullable`)인데 CHANGELOG 가 없었다.
**바로 앞 커밋(`af1651264`)이 "OpenAPI 계약이 바뀌면 CHANGELOG 를 단다" 는 판단을 스스로
세우고 실제로 항목을 달았는데**, 이번 커밋만 그러지 않았다. 리뷰어가 "자기모순" 이라 적은
것이 정확하다. `ipWhitelist` 항목과 같은 형식으로 추가했다.

## W3 (documentation) — **같은 턴에 내가 쓴 규칙을 다시 어겼다.** 조치함

plan 안에서 두 절이 반대를 말하고 있었다. §할 일 체크리스트는 "48 은 계측 산물, 실결함
1건, 가드는 만들지 않는다" 로 갱신했는데, `### 새로 드러난 축` 절은 **"48건 미해결" ·
"축을 열 때 가드를 함께 만든다"** 를 그대로 두었다.

> **직전 라운드(`18_52_24` W1)가 정확히 이것이었고, 나는 거기서 이렇게 적었다** —
> *"조치로 앞 서술이 거짓이 되면, 그 서술을 찾아 고치는 것까지가 조치다."*
> **그 규칙을 쓴 다음 턴에 같은 자리를 다시 밟았다.** 규칙을 쓰는 것으로는 안 고쳐진다 —
> 이번엔 옛 절에 **폐기 배너 + 전방 포인터**를 박아 두어 문서 구조가 대신 잡게 했다.

옛 서술은 지우지 않고 취소선으로 남기고(당시 판단의 이력), 각 줄에 무엇이 반증했는지 붙였다.

## INFO — 하나만 짚는다

**INFO#5**: 리뷰 도중 reviewer 가 `workspaces.controller.ts:402` 에서 미커밋 변경
(`invitedBy: i.invitedBy ?? ''`)을 **일시 관측**했다. 그건 내가 캐너리 유효성을 확인하려고
넣은 뮤턴트이고 즉시 원복했지만, **리뷰가 도는 중에 공유 워크트리를 뮤테이션한 것**이라
reviewer 를 오염시킬 수 있었다. reviewer 가 "reviewer 본인 것이 아니다" 로 정확히 판정해
사고로 이어지지 않았다.

**교훈**: 뮤테이션 검증은 **리뷰를 띄우기 전에** 끝낸다. 이번엔 순서가 겹쳤다.

나머지 INFO 6건은 조치 불요 — `invitedBy?:` 표기 문제는 이미 planner 턴으로 위임돼 있고
(§5.4 `field?:` 표기 자체가 규약 내부에서 어긋난다), 예외 전파 테스트·e2e cascade 시나리오는
이번 스코프 밖 선재 갭이다.

## 검증

lint PASS · unit backend **9,252**(443 suites) · build PASS · e2e **292** · ratchet **197/36** ·
`tsc` 비-spec **0**.
