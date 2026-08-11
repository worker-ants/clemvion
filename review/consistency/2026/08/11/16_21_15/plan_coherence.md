# Plan 정합성 검토 — webchat apiBase 스킴 검증 (델타: `df1375208` + `4daeaa534`)

## 검토 범위

- 신규 델타: `df1375208`(`use-widget.ts` 주석 2곳, 실행 코드 0줄) + `4daeaa534`(`review/code/2026/08/11/16_06_02/**` 산출물만)
- 대상 plan: `plan/complete/webchat-boot-apibase-scheme-validation.md`, `plan/in-progress/webchat-auth-session-status-reconcile.md`
- `git diff origin/main...HEAD --stat -- spec/7-channel-web-chat/` 로 spec_impact 대상과 실제 변경 파일 대조, `git log`/`git show` 로 각 라운드 커밋 계보 확인.

## 발견사항

- **[INFO]** `plan/complete/webchat-boot-apibase-scheme-validation.md` 의 수치·체크리스트는 이번 델타 이후에도 정확 — 갱신 불필요
  - target 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md` frontmatter `spec_impact` + `## 완료 (2026-08-11)` 절 "451 passed(신규 9 = 단위 6 + 호출부 통합 3)"
  - 관련 plan: 동일 문서
  - 상세: `df1375208` 은 `use-widget.ts` 의 `configFromQuery` JSDoc 1곳 + 직접 로드 폴백 인라인 주석 1곳만 고쳤고 실행 코드·테스트 파일은 0줄 변경이다(`git show --stat df1375208` 확인). 따라서 plan 이 적은 "451 passed / 신규 9(단위 6 + 통합 3)" 수치는 이번 델타로 바뀔 이유가 없다. `spec_impact`(`4-security.md`, `2-sdk.md`)도 `git diff origin/main...HEAD --stat -- spec/7-channel-web-chat/` 와 정확히 일치한다(두 파일만 변경, 그중 어느 것도 이번 델타 소관이 아니라 이전 라운드 소관). 이번 델타 이후 별도로 실행된 코드 리뷰(`review/code/2026/08/11/16_19_38/requirement.md:12-13`, `39-40`)도 `pnpm exec vitest run` 실측으로 "451 passed" 를 재확인해 plan 수치와 문자 그대로 일치시켰다 — 교차 검증됨.
  - 제안: 갱신 불필요(정보성 확인 기록).

- **[INFO]** 주석 2곳 정정(`df1375208`)이 이 PR 반복 패턴("한 사실을 복제하고 한 곳만 고친다")의 4번째 사례라는 사실이 plan 회고에 없다
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`configFromQuery` JSDoc, 직접 로드 폴백 주석)
  - 관련 plan: `plan/complete/webchat-boot-apibase-scheme-validation.md` — 현재 회고 절은 `## 리뷰 라운드 1 이 잡은 것 (2026-08-11, 15_16_20)` 하나뿐이고 그 뒤 라운드 2~4(`99d3e9000`/`cebc421a7`/`4479e771b`/`1887aaec9`/`df1375208`/`4daeaa534`)에 대한 서술이 전무하다(`grep`으로 해당 커밋 해시·"라운드 2/3/4"·"#384" 0건 확인)
  - 상세: 커밋 계보를 추적하면 같은 형태(spec/코드/plan 중 한 자리만 고치고 자매 자리를 놓침)가 이 PR 안에서 최소 3~4회 반복됐다 — ① `99d3e9000`: spec §R0 은 고치고 코드 SoT JSDoc 은 그대로("documentation CRITICAL — 정정의 자매를 또 놓쳤다") ② `4479e771b`: §R0→§R7 재번호를 spec/plan 은 반영했지만 같은 커밋에서 새로 쓴 코드 JSDoc 이 죽은 `§R0` 를 인용(6명 독립 수렴) ③ `df1375208`: `4-security.md §1` 은 "샘플 전용으로 읽지 마라" 로 고쳤는데 코드 주석 2곳은 여전히 "샘플/개발 대비" 로 서술 — `git log -S` 로 추적하면 원문 출처가 최초 위젯 PR(`a652f8733`, #384)이다. `4daeaa534` 커밋 메시지 자체가 이를 "같은 패턴의 마지막 사례" 로 명명하지만, 그 서술은 리뷰 산출물(`review/code/2026/08/11/16_06_02/security.md` 등)과 커밋 메시지에만 있고 **plan 본문에는 반영되지 않았다** — `review/` 는 SoT 가 아니라는 이 저장소의 반복된 교훈과 같은 결의 갭이다.
  - 제안: CRITICAL 은 아니다 — plan 은 `status: complete` 로 닫혔고 기능적 영향도 없다(주석 전용, 리뷰 라운드 5(`16_19_38`)도 CRITICAL/WARNING 0으로 수렴). 다만 이 반복 패턴이 향후 유사 PR 에서 재발했을 때 참조할 수 있도록, plan 끝에 짧은 회고 절(라운드 2~4 요약 + "#384 유래 · 4회 반복" 한 줄)을 추가할 가치는 있다. 시급하지 않으므로 다음에 이 문서를 편집할 기회에 얹는 정도로 충분하다.

- 검증됨(발견 아님) — `plan/in-progress/webchat-auth-session-status-reconcile.md` 의 `applyConfig` 조용한 early return 후속 항목은 여전히 유효
  - 해당 절은 `d8abc7003`(`wc:boot` 검증 도입 라운드의 call-site 하드닝 커밋)이 이 침묵 분기의 도달 빈도를 넓혔다고 서술한다. `git show d8abc7003 -- use-widget.ts | grep "도달 빈도를 넓혔"` 로 그 문구의 실제 출처가 `d8abc7003` 임을 확인했다(오귀속 아님). `df1375208` 은 `configFromQuery`/직접 로드 폴백 주석만 건드렸고 `applyConfig` 의 early return 로직·도달 경로는 변경하지 않았으므로, 미해결 체크리스트(도달 경로 전수 확인 등 3항목)는 그대로 유효하며 이번 델타로 인해 무효화되거나 새로 필요해진 항목도 없다.

## 요약

이번 델타(`df1375208` + `4daeaa534`)는 `use-widget.ts` 주석 2곳 정정과 리뷰 산출물 커밋뿐으로 실행 코드·테스트 개수에 영향이 없고, `plan/complete/webchat-boot-apibase-scheme-validation.md` 의 수치(451/신규 9)·`spec_impact`·체크리스트는 델타 이후에도 정확하다(리뷰 라운드 5의 독립 실측과도 일치). `plan/in-progress/webchat-auth-session-status-reconcile.md` 로 넘긴 `applyConfig` 조용한 early return 후속 항목도 이번 델타로 손상되지 않고 그대로 유효하다. 유일한 아쉬움은 이 PR 이 4라운드에 걸쳐 반복한 "한 사실을 복제해 놓고 한 곳만 고친다" 패턴의 마지막(4번째) 사례가 커밋 메시지·리뷰 산출물에는 기록됐지만 plan 본문 회고에는 반영되지 않았다는 점 — 기능적 리스크는 없는 추적 메모 수준의 갭이다.

## 위험도

LOW

BLOCK: NO
STATUS: OK
