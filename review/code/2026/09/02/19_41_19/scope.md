# 변경 범위(Scope) 리뷰 — WS 소켓 수명을 토큰 수명에 종속 (`auth.token_expired`), 5R 누적 diff

## 검토 범위와 방법

`origin/main`(`6ffadb1f4`) 대비 현재 브랜치(`a18376f0c`, `claude/ws-token-expired-impl`)
전체 94개 파일 diff. 5개 커밋:

- `b019d7de3` feat — 핵심 구현
- `a9316a0a6` fix — 1R 리뷰 반영
- `1bd2000d5` fix — 2R 리뷰 반영
- `e5b683d75` fix — 3R 리뷰 반영
- `a18376f0c` fix — 4R 리뷰 반영 (본 리뷰가 새로 보는 커밋)

이전 4라운드(`17_38_12/scope.md`·`18_18_53/scope.md`·`18_45_43/scope.md`·`19_12_36/scope.md`)가
누적分을 이미 상세히 분석했으므로, 본 라운드는 (a) 아직 검증되지 않은 4R fix 커밋
(`a18376f0c`)의 diff 를 `git show`로 직접 열어 4R RESOLUTION 주장과 1:1 대조하고, (b) 이전
라운드들이 반복 지적한 잔존 항목(빈 consistency 재시도 세션·이중 빈 줄)의 현재 상태를 재확인
했다. 저장소 파일은 읽기만 함 — 뮤테이션 없음, `git status --short` 로 변경 없음 확인 완료.

## 발견사항

- **[INFO]** 실패/빈 `--impl-prep` 재시도 consistency 세션 6개(12개 파일)가 diff 에 그대로 남아 있음 — 5라운드 연속 동일 지적, 여전히 미정리
  - 위치: `review/consistency/2026/09/02/17_08_55/`, `17_09_30/`, `17_11_15/`, `17_11_16/`,
    `17_11_33/`, `17_11_34/` (각 `_retry_state.json`·`meta.json`만 트래킹됨 — `ls` 로 재확인).
    성공한 최종 런은 `17_13_02/`(`SUMMARY.md` + checker 5개 전문, 파일 87~94).
  - 상세: `review/consistency/**` 저장 자체는 `CLAUDE.md` 규약("일관성 검토 산출물" 표)에
    맞고, `--impl-prep` 의무화 과정에서 생긴 재시도 잔재로 기능 변경과 무관하다. 1R~4R
    scope 리뷰 모두 같은 항목을 INFO 로 지적했는데 5R 인 지금까지도 정리되지 않고 94개 파일
    중 12개(약 13%)를 차지한다. 차단 사유는 아니며 정보 가치가 없는 것도 이전 판단과 동일 —
    다만 다섯 번째 반복 지적이라는 점, 그리고 이 잔존물이 리뷰 라운드가 늘 때마다(3R 12개→
    4R…→5R 12개, 비율은 파일 총수 증가로 희석) 계속 diff 에 실려 다닌다는 점은 기록해 둔다.
  - 제안: 이전 라운드들과 동일 — 차단 아님. 최종 PR 정리 시점에 성공한 최종 세션만 남기고
    빈 재시도 세션은 별도 커밋으로 걷어내거나, 애초에 이런 재시도 잔재를 `.gitignore` 하는
    관례를 프로젝트 차원에서 검토할 만하다(5회 반복 지적이면 개인 판단보다 관례화가 낫다).

- **[INFO]** 4R fix 커밋(`a18376f0c`)이 3R 이 "정리했다"고 거짓 주장한 이중 빈 줄을 실제로 제거 — 정정 확인
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:131` (현재 상태 — `connect_error`
    핸들러 닫힘과 "정상 경로" 주석 사이 빈 줄 1개만 존재, `Read` 로 직접 확인)
  - 상세: 1R~3R scope 리뷰가 반복 지적했던 이중 빈 줄이 이번 커밋에서 실제로 사라졌다
    (`git show a18376f0c` 에서 해당 hunk 1 deletion 확인). 3R RESOLUTION 이 "정리했다"고
    적었으나 실제 diff 에는 없었던 것을 4R 이 스스로 지적·정정한 것으로, 새로운 범위 이탈이
    아니라 **직전 라운드의 거짓 "조치 완료" 주장을 바로잡는 정상적인 사후 조치**다. 차단
    사유 아님 — 정보로만 남긴다.

## 검토했으나 이상 없음으로 판단한 항목

- **4R fix 커밋(`a18376f0c`) 자체의 범위** — `git show` 로 대조한 결과, 변경분은 4R
  `RESOLUTION.md`(파일 43, `review/code/2026/09/02/18_45_43/RESOLUTION.md`는 3R 대상이고
  실제 4R 대상 SUMMARY 는 `review/code/2026/09/02/19_12_36/`)가 명시한 항목에 정확히 대응한다:
  `websocket-events.types.ts` JSDoc 축소(구현이 payload 를 소비하지 않는다는 사실에 맞춤,
  W3 documentation), `ws-client.ts` 이중 빈 줄 제거(scope·maintainability 중복 지적),
  `ws-token-expired-socket-lifetime-impl.md` 에 flaky 관측을 watch 항목으로 등재(W1). 요청
  이상의 리팩토링·기능 확장·무관한 파일 수정은 없다.
- **핵심 코드 5파일(1~9)** — `AuthEventType`/`AuthTokenExpiredPayload` 신설, `armExpiryTimers`
  arm/disarm, `refreshAndReconnect` 공유 헬퍼(+ in-flight 가드 + 세대 스냅샷), 대응
  backend/frontend 테스트, `EXPECTED_EXPORTS` 갱신, `CHANGELOG.md` 항목 모두
  `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 와 spec Rationale
  `R-ws-socket-lifetime-binds-token` 이 정의한 "backend 타이머 둘 + frontend 구독·재연결"
  범위와 1:1 대응한다(`git diff --stat origin/main..HEAD` 로 전체 94파일 목록 재확인 — 프롬프트에
  없는 파일 없음, `websocket.gateway.ts`/`ws-client.test.ts`/`ws-token-expired-...-impl.md` 3개는
  프롬프트에서 크기 제한으로 diff 가 생략됐으나 `git diff` 로 직접 열어 대조함).
- **`plan/in-progress/**` 2건(파일 10·11)** — developer 쓰기 권한 범위, PLAN 라이프사이클 규약
  준수. `spec/` 은 이번 전체 diff 에서 전혀 건드리지 않음(`git diff --stat -- spec/` 결과 없음
  — 직접 실행 확인). plan 체크리스트도 spec 배지 flip·tracker 체크박스를 "developer 권한 밖 →
  머지 후 planner 턴" 으로 명시적으로 등재만 하고 직접 고치지 않아 §자기-반증형 소정정 경계를
  지킨다.
- **`review/code/17_38_12/**`·`18_18_53/**`·`18_45_43/**`·`19_12_36/**`(파일 12~74)** —
  `/ai-review` 실행 결과 자체이며 `CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된
  강제 의무" 조항에 따른 정상 워크플로 산출물. 위험도 궤적(CRITICAL→MEDIUM→MEDIUM→LOW)이
  라운드를 거치며 수렴하고 있어 발산이 아니다.
- **유저 가이드 문서(파일 6·7, `password-and-sessions.{mdx,en.mdx}`)** — 2R `user_guide_sync`
  W5 지적에 대한 조치로, 이 PR 이 만든 "revoke 카브아웃 최대 15분" 이라는 새로 명세된 유계값을
  사용자 표현으로 옮긴 것이라 기능 범위 안. ko/en 양쪽 동시 갱신이라 doc-sync 도 지켜짐.
- **포맷팅/주석/임포트** — `websocket.gateway.ts` import 변경은 신규 심볼(`AuthEventType`,
  `AuthTokenExpiredPayload`) 추가뿐, 미사용 임포트나 무관한 정리는 없다. 신규 주석은 전부 이번
  기능의 설계 근거·범위 경계·기각 대안·이전 라운드에서 드러난 결함의 인과를 설명하며 무관한
  주석 변경은 없다.
- **설정 변경** — `.github/workflows/**`, `package.json`, `tsconfig*.json` 등 설정 파일은 이번
  diff 에 없음(`git diff --stat` 로 확인).

## 요약

5라운드 누적 diff(feat + 1R~4R fix) 전체를 `git diff`/`git show`/`Read` 로 직접 재검증한 결과,
핵심 기능 변경은 plan·spec Rationale 이 정의한 범위와 정확히 일치하고, 각 fix 커밋도 직전 라운드
RESOLUTION.md 가 명시한 항목에만 국한돼 요청 이상의 추가 수정·리팩토링·기능 확장은 발견되지
않았다. 특히 이번에 새로 검증한 4R fix 커밋(`a18376f0c`)은 3R 이 거짓으로 "정리했다"고 주장한
이중 빈 줄을 실제로 제거하고 JSDoc 이 구현보다 넓게 약속하던 부분을 좁혔으며, flaky 관측을
근거 없이 기각하지 않고 watch 항목으로 등재하는 등 — 전부 직전 라운드가 지적한 항목에 국한된
정정이다. 유일한 반복 관찰 사항은 정보 가치 없는 `--impl-prep` 빈 재시도 consistency 세션
6개(12파일)가 5라운드째 diff 에 그대로 남아 있다는 점으로, 기능에 영향이 없는 절차적 부산물이라
차단 사유는 아니지만 반복 횟수가 늘어난 만큼 다음엔 관례화(정리 또는 gitignore)를 고려할 만하다.

## 위험도

NONE
