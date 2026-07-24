# Plan 정합성 검토 — webchat-apibase-binding (target: `spec/7-channel-web-chat/`)

## 사전 확인 사항

- 본 프롬프트의 "진행 중 plan 문서 모음"에는 컨텍스트 예산 초과로 `plan/in-progress/webchat-boot-apibase-scheme-validation.md` ·
  `webchat-command-failure-is-not-termination.md` · `webchat-spec-rationale-followup.md` · `webchat-usewidget-extraction.md`
  **4개(이 diff 와 가장 직접 관련된 plan들)가 생략**돼 있었다. 프롬프트 지시대로 "여기 없다는 사실을 근거로 삼지 않고"
  절대경로로 4개 전부 `Read` 했다.
- 이번 diff(`origin/main...HEAD`, 2 commit: `f70c845f9` 세션↔apiBase 바인딩, `3ae469c1d` naming_collision 해소)는
  `plan/complete/webchat-session-apibase-binding.md`(2026-07-24 완료)의 구현물이며, 그 직전 `--impl-done` 실행
  (`review/consistency/2026/07/24/22_35_51`)이 이미 CRITICAL 1건(naming_collision) + WARNING 2건(plan_coherence
  W1 Gate C stale, W2 후속 미착지)을 냈고 **바로 다음 커밋(`3ae469c1d`)에서 전부 해소**된 상태다. 아래는 그 해소가
  실제로 완결됐는지의 재검증 + 신규 갭 탐색 결과다.

## 발견사항

- **[INFO]** 직전 세션 WARNING 2건(Gate C stale · 후속 미착지) — 코드 확인 결과 모두 해소됨, 재-flag 불필요
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1-1 (변경 없음, 이미 정합)
  - 관련 plan: `plan/complete/webchat-session-apibase-binding.md` frontmatter, `plan/in-progress/webchat-boot-apibase-scheme-validation.md`(신설), `plan/in-progress/webchat-spec-rationale-followup.md`(체크리스트 확장)
  - 상세: (1) frontmatter `spec_impact`가 `none` → `- spec/7-channel-web-chat/3-auth-session.md` 리스트로 교정됨(직접 확인). (2) RESOLUTION이 "PR 범위 밖"으로 미룬 두 항목 — `wc:boot` apiBase 스킴 검증(developer 트랙)은 `webchat-boot-apibase-scheme-validation.md`로 신규 티켓화됐고, `4-security.md §1` 위협표 재전송-origin 축 추가(planner 트랙)는 `webchat-spec-rationale-followup.md` 체크리스트 3번째 항목으로 편입됐다. 둘 다 실제 파일에서 확인.
  - 제안: 조치 불요 — 이미 처리 완료. 다른 sub-agent(`naming_collision`, `rationale_continuity`)의 독립 확인과도 일치.

- **[INFO]** `plan/complete/webchat-session-apibase-binding.md` 본문 상단 "**상태**: 미착수" 서술이 frontmatter/체크리스트와 불일치 (plan 자기-정합성, out-of-primary-scope)
  - target 위치: 해당 없음(target spec 문서와 직접 충돌 아님) — 이 diff 로 함께 갱신된 plan 문서 자체의 내부 모순
  - 관련 plan: `plan/complete/webchat-session-apibase-binding.md` 12행 "**상태**: 미착수. **선행 결함** — 이 PR 이 만든 게 아니다."
  - 상세: frontmatter는 `status: complete`이고 체크리스트 5개 항목이 전부 `[x]`이며 파일이 이미 `plan/complete/`에 있는데, 본문 서두는 여전히 "미착수"라고 선언한다. `3ae469c1d`가 이 파일의 frontmatter(`spec_impact`)와 체크리스트 문구를 고쳤음에도 이 상단 한 줄은 그대로 남았다 — 형제 티켓들(`webchat-boot-apibase-scheme-validation.md` 등, 실제로 미착수인 후속 티켓)의 "선행 결함, 미착수" 보일러플레이트를 복사한 흔적으로 보인다. 기능·spec 정합에는 영향 없으나, 이 파일만 단독으로 읽으면 이미 끝난 작업을 "아직 시작 안 함"으로 오독시킬 수 있다.
  - 제안: 차단 아님(target 문서에 영향 없음). 다음 편집 시 12행을 "**상태**: 완료(2026-07-24)"로 정정 권고.

## 요약

이번 diff(세션 ↔ 발급 `apiBase` 바인딩)는 `plan/in-progress`의 미해결 결정(`webchat-command-failure-is-not-termination.md`의 비-410 명령 실패 처리 등)을 건드리지 않고 우회하지도 않는다. 컨텍스트 예산으로 프롬프트에서 생략됐던 웹챗 계열 4개 plan을 직접 열어 대조한 결과, 가장 직접 관련된 `webchat-boot-apibase-scheme-validation.md`(wc:boot 스킴 검증 비대칭, P3 신규 결정 대기)와 `webchat-spec-rationale-followup.md`(4-security 위협표·R7 Rationale 후속)는 이미 이 diff의 직전 라운드(22_35_51 plan_coherence W2)에서 정확히 이 갭을 지적받아 만들어진 후속 티켓이며, 그 지적 자체는 바로 다음 커밋에서 해소됐다. Gate C(`spec_impact` 리스트화)도 교정 확인됨. 새로 발견된 것은 `plan/complete/`로 이동한 원 plan 문서 본문에 남은 "미착수" 서술 1건뿐이며, 이는 target spec과 무관한 plan 문서 자체의 사소한 자기모순(INFO)으로 병합을 막을 사유가 아니다.

## 위험도
LOW
