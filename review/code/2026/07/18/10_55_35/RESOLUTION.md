# RESOLUTION — review/code/2026/07/18/10_55_35 (마커-only 전환 수렴 리뷰)

전체 위험도 **MEDIUM, Critical 0**. 락 제거(직전 C1 해소)는 14 reviewer 전원이 올바른 방향으로 확인.
이 change 의 스코프(락 제거) 안에서 **조치가 필요한 코드 결함은 없다.** 처리 내역:

| # | 분류 | 조치 |
|---|---|---|
| W1 | 문서 정정 + 별건 defer | 락 제거로 수용한 잔여 리스크의 **최악이 내 설계 노트 서술보다 나쁘다**(리뷰어 실측): corrupt-but-marked 트리 → `lint-mermaid.mjs` 의 가드 없는 `await import` 크래시 → pre-commit/PostToolUse 가 "malformed mermaid" 로 오판해 매 커밋을 **가짜 메시지로 차단**(fail-open 계약과 반대). **직접 확인**(mjs:75·93 가드 없음, 소비처가 non-zero→차단). → **설계 노트를 정직한 최악으로 정정**(이 커밋). 코드 fix(mjs fail-open + 소비처 배선)는 **선재 결함·change 밖 파일 3곳**이라 plan §A 후속으로 등록. |
| W2 | 수용(코드 무변경) | 콜드스타트 동시 install 중복 — 락 제거의 의도된 트레이드오프. 사용자 2026-07-18 명시 수락, 근본 해법 fcntl.flock 은 §G. 리뷰어도 "코드 변경 불요" 명시. |
| W3 | defer | bash mtime 헬퍼(`_file_mtime`)가 reaper 와 중복. 저우선 위생. plan §A 후속. |
| I1 | 문서 track | hung-install blast radius 가 락 제거로 확대. plan §A 후속(I1)에 기록. |
| I4 | 문서 fix | `_file_mtime` 에 크로스플랫폼(BSD/GNU stat) 의도 주석 1줄 추가. |
| I5 | 문서 fix | 두 신규 테스트의 `import _harness # noqa` 에 "왜 의도적인지" 트레일링 설명 추가(스위트 컨벤션). |
| I2·I3·I6~I12 | track/무변경 | 리뷰어가 "우선순위 낮음"/"조치 불요"/"diff 밖"/"이미 추적" 표기. SUMMARY 유지. |

## 수렴 판정

Critical 0 + **이 change 스코프 내 조치 필요 코드 결함 0**. 남은 것은 (a) 정직성 문서 정정(이 커밋에서
완료), (b) 선재·별건 defer(plan 등록), (c) 사용자 수락 트레이드오프. 무한 doc-루프 방지를 위해 이
지점을 수렴으로 판정한다(edge-gaps 교훈: Critical 0 + 코드 WARNING 0 이면 수렴).

## 테스트
- harness 301 통과, plan-frontmatter 93 통과. e2e 면제(`.claude/**`·`.github/**`·`plan/**`).
