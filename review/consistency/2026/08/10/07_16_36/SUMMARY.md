# Consistency Check 통합 보고서 (--plan, webchat Rationale 신설)

- 대상: `plan/in-progress/webchat-spec-rationale-followup.md` · diff-base `origin/main`
- checker 2종 실행(rationale_continuity · cross_spec). 이번 변경이 **Rationale 서술 신설**에
  한정돼 그 둘이 본령이다.

## BLOCK: NO

Critical 0 · WARNING 0.

## 전체 위험도

**NONE** — 두 checker 모두 NONE.

## Critical / 경고

없음.

## 참고 (INFO)

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | rationale | **번들이 검토 대상 3파일을 전부 누락**했다 — `spec/7-channel-web-chat/{2-sdk,3-auth-session,4-security}.md` 가 "예산 초과 생략 77개" 에 포함. checker 가 워킹트리 직접 조회로 우회 | **등재.** `harness-review-gate-followups.md` 에 신설 — 기등재 `--spec` 예산 건과 **다른 형태**다(그쪽은 참조 문서가 멀어서, 이쪽은 **diff 가 건드린 파일 자신**이 탈락) |
| 2 | cross_spec | `1-widget-app.md §3.1` 에 apiBase-변경 재부팅이 트리거로 없음 | **조치 불요** — `2-sdk.md` 헤더가 "이 문서가 `wc:boot` 재전송 계약의 SoT" 라 명시하고 `1-widget-app.md` 에 `wc:boot` 언급이 0건이다. 의도된 SoT 분리이지 신규 갭이 아니다 |
| 3 | cross_spec | 신설 상호 링크 3개가 파일-only(절 앵커 없음) | **조치 불요** — 이 문서군의 Rationale 간 참조 다수가 같은 스타일이라 이 셋만 바꾸면 오히려 비일관 |
| 4 | rationale | `3-auth-session §R7` 이 `1-widget-app §R7`(의미 다름)과 번호가 겹침 | 문서 로컬 R-넘버링 + 참조 시 문서명 접두 관행이 확립돼 있어 문제 아님 |

## checker 별 결과

| checker | 위험도 | 핵심 |
|---------|--------|------|
| rationale_continuity | **NONE** | 네 항목 전수 실측 확인 — 코드 서사 충실 이전 · **기각된 대안이 실제 이력**(커밋 SHA 로 확인) · 불변식 2 미착수 판단이 옳음 |
| cross_spec | **NONE** | 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전부 충돌 없음 |

## 이 라운드에서 확인된 것

**1. "기각된 대안" 이 지어낸 것이 아님을 커밋으로 확인했다.**
§R7 의 "boot 세대 비교" 는 `7cfbf2557` → 되돌림 → `77805bd32` 이력이 있고, §R8 의 "레거시
fail-safe" 는 `webchat-session-apibase-binding.md` 에 검토·기각 근거가 남아 있다. 이 저장소는
지어낸 기각 대안을 checker 가 잡는데, 둘 다 실측을 통과했다.

**2. 불변식 2 를 안 쓴 판단이 "보수" 가 아니라 "필수" 였다.**
내 근거는 "미결 결정을 앞지르면 안 된다" 였는데, checker 가 더 강한 근거를 댔다 — A-6 되돌림
이후 **현재 코드의 실제 동작은 여전히 `ERROR` → `ended`** 다. "비-410 실패는 종료가 아니다" 를
Rationale 로 적었으면 **현재 구현과 배치되는 거짓 문서**가 됐을 것이다.

**3. §R8 이 서버 계약을 안 건드린다.**
EIA JWT 는 `{sub, aud, jti}` 만 담고 origin/apiBase 를 인코딩하지 않는다 — "발급 origin
바인딩" 은 **클라이언트 로컬 정책**이다. 위협표 서술이 그 사실과 일치한다.
