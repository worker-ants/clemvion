# consistency SUMMARY — `16_21_15` (`--impl-done spec/7-channel-web-chat`)

## BLOCK: NO

Critical **0건**. checker 5/5 착지, 전원 BLOCK:NO.

| checker | 위험도 | 발견 |
|---|---|---|
| cross_spec · convention_compliance · naming_collision | **NONE** | 0 |
| rationale_continuity | LOW | INFO 1 (**처분함**) |
| plan_coherence | LOW | INFO 2 (**1건 처분**) |

## rationale_continuity — 이 라운드의 값

"#384 의 결정을 무근거로 번복한 것 아닌가" 를 `git log -S` 로 판정했다:

- 주석과 그것을 반증하는 SDK `resolveIframeTarget` 이 **같은 커밋(`a652f8733`)에서 함께 태어남**
- 그 사이 서술을 바꾼 커밋 **0건** → "SDK 변경으로 낡았다" 가설 **반증**
- 당시 폴백 코드도 **host 유무 미검사** → 코드는 처음부터 그 결정을 구현한 적이 없음

⇒ 번복이 아니라 **PR #384 내부의 주석-구현 불일치를 사후 정정**한 것. 기각된 대안 재도입도
합의 원칙 위반도 아니다. **역사를 지어내지 않고 실측으로 갈랐다.**

그리고 같은 checker 가 **세 번째 복제본**을 찾았다 — `use-widget.test.ts:15` 의
`direct-load 외부 입력 방어`. 내가 직전 커밋에 쓴 "복제본이 정확히 2곳" 은 `샘플` 이라는
**문자열**을 센 결과라 틀렸다. 같은 주장을 다른 말로 적은 곳은 그 grep 을 통과한다.
**처분함** — 주석 정정 + 커밋에 실측 오류 명시.

## cross_spec — 전수로 세었다

영역 7문서(`0-architecture` · `1-widget-app` · `2-sdk` · `3-auth-session` · `4-security` ·
`5-admin-console` · `_product-overview`)에 `apiBase`·"직접 로드"·"샘플"·"배타"·"둘 중 하나" 등
11개 표현을 전수 grep 하고 매치 지점 본문을 확인 → **상호배타 잔존 0**.

특히 `5-admin-console.md §6.1` 은 이번 정정 **이전부터** "쿼리 1차 전달 → `wc:ready` →
`wc:boot` → 머지" 로 정확히 순차 서술돼 있었다. 즉 `4-security.md §1` 만 어긋나 있었던 것이고,
같은 저장소 안에 이미 옳은 서술이 있었다.

## convention · naming — 회귀 없음

`### R0.` 잔존 0 · R1~R7 단조 · 타 문서 5개소 앵커(`12-webhook`×3·`1-auth`·`10-triggers`)
무손상 · 살아있는 `§R0` 참조 0 · 새 주석의 `SoT: 4-security.md §1` 표기가 파일 내·인접 파일
기존 관례와 일치 · 새 식별자 0.

## plan_coherence INFO — 1건 처분, 1건 확인 기록

- **처분**: 라운드 2~5 회고가 plan 본문에 없다(`review/` 는 SoT 아님) → 회고 절 추가.
- **확인 기록**: `plan/in-progress/webchat-auth-session-status-reconcile.md` 의 후속 항목이
  여전히 유효. 그 문서가 인용한 "도달 빈도를 넓혔다" 문구의 출처가 `d8abc7003` 임을
  `git show | grep` 으로 확인 — **오귀속 아님**.
