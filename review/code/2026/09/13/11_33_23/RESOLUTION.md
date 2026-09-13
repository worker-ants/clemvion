# RESOLUTION — `/ai-review` 라운드 4 (`review/code/2026/09/13/11_33_23`)

Critical 0 · WARNING 3 · INFO 7 · 위험도 LOW. **전 항목 처분 완료.**

> **이 라운드의 가장 중요한 사실은 여기 적힌 것이 아니다.** 같은 시각에 돌린
> `--impl-done`(`review/consistency/2026/09/13/11_33_51`)이 **CRITICAL 1건**을 냈고, 그것은
> 이 14명의 code reviewer 가 **아무도 못 잡은** 결함이다(`MAKESHOP_UNRESOLVED_PATH_PARAM` 이
> 방출 코드가 아님). 처분은 그쪽 RESOLUTION 에 있다. **두 게이트는 대체재가 아니다** —
> code review 가 LOW 를 냈다고 안전한 것이 아니었다.

## WARNING

| # | 카테고리 | 처분 | 근거 |
|---|---|---|---|
| 1 | side_effect·api_contract | **조치 불요 (고지 완료)** | `error`→`message` rename 의 저장소 밖 3rd-party 영향은 코드로 배제 불가. CHANGELOG 가 *"⚠️ 배포 시 확인"* 으로 명시 고지했고 3라운드 연속 LOW 로 수렴 — 신호로 유지 |
| 2 | testing | **등재** | 형제 `/api/integrations/:id/test` 에 HTTP 와이어-레벨 계약 검증이 없다(서비스 레벨 `assertMatchesContract` 뿐). 기존 "MCP 3종 미선언" 항목은 **서비스 레벨 축**이라 이 와이어 축을 덮지 않는다 — 리뷰가 그 오판 가능성을 짚었고, 별 항목으로 등재 |
| 3 | documentation | **고침** | 신규 가드 2건이 `PROJECT.md` *"자동 가드(build-time 차단)"* 카탈로그에 미등재. **developer 소유 문서**라 이번 PR 에서 바로 닫았다 — 각 한 줄 + `guide-error-code-existence` 에는 *"존재 검사이지 방출 검사가 아니다"* 한계도 병기 |

## INFO — 조치한 것

| # | 처분 |
|---|---|
| 1 | *"가이드→코드 단방향 존재성 가드만 있고 완전성(코드→가이드) 역방향이 없다"* 와 *"DTO 유령 필드"* 가 **같은 근본 원인**(단방향 검사)이라는 연결을 등재 문구에 반영. 리뷰 제안대로 다음 재발 시 하나의 해법으로 두 항목을 동시 종결할 수 있게 |

## INFO — 조치 불요 (사유 기록)

- **2 (maintainability)**: 두 유사 DTO 공용 베이스 — 3번째 유사 DTO 발생 시(현재 2곳).
- **3 (scope)**: 스코프 확장이 주석·CHANGELOG·plan·커밋 메시지 전 층에서 disclosure 됨.
- **4·5 (api_contract·user_guide_sync)**: spec 갭 · 관계표 — 이미 planner 등재분.
- **6 (security)**: `logger.warn` 의 원본 에러는 서버 로그 한정, workspace 노출 경로 미전파 —
  diff 미변경 코드.
- **7 (performance)**: 가드 전량 스캔 — 3라운드 연속 같은 판단(차단 아님).

## 검증

`run-test-all.sh` 재실행(라운드 5 전) · 타입체크 ratchet 둘 baseline 일치 ·
frontend 문서 가드 전량 GREEN.
