# 문서화(Documentation) Review

대상: `review/code/2026/08/10/17_15_33/` + `review/code/2026/08/10/17_15_33_2/` 라운드 산출물 커밋(전 라운드 리뷰 결과 기록) + `spec/7-channel-web-chat/3-auth-session.md` 갱신(§3.1 배너를 `404`/`401`/`410` 구현 반영으로 확장).

오케스트레이터 지시에 따라, 이 PR 이 CHANGELOG·spec·JSDoc·plan 에 적은 "무엇을 닫았고 무엇을 남겼는지" 서술이 실제 코드 상태(HEAD)와 일치하는지 직접 확인했다 — 특히 **고착 원인 B(`refresh_deferred` 뒤 스트림 부재)가 CHANGELOG 에도 반영돼야 하는가**를 판정 대상으로 삼았다.

## 발견사항

- **[CRITICAL]** CHANGELOG 의 해당 Unreleased 항목이 `refresh_deferred`(및 그로 인한 영구 고착 잔여, "고착 원인 B")를 전혀 언급하지 않는다 — 성공/거부 두 갈래만 있는 것처럼 서술한다.
  - 위치: `CHANGELOG.md:166`(제목 `## Unreleased — 웹채팅 위젯: 재로드 복원의 404·복구불가 401/410 REST 분기`), `CHANGELOG.md:171`(2번 항목: `위젯은 낙관적으로 POST .../refresh-token 1회 시도 → 성공 시 SSE 재연결로 복원, 재차 401·410 이면 종료로 확정한다.`)
  - 상세: 실측 결과 — (1) `git log --oneline -15 -- CHANGELOG.md` 기준 이 파일을 마지막으로 건드린 커밋은 `08bd668a5`(16:51:48)이고, `refresh_deferred` 를 도입한 `fd1075514`(17:11:12)·서술을 정정한 `5693e42ad`(17:06:24)·`고착 원인 B`를 최종 확정해 등재한 `d03deb339`(17:24:25, 이번 라운드 대상 커밋) 중 **어느 것도 CHANGELOG.md 를 건드리지 않았다**(각 커밋의 `--name-only` 로 확인). (2) `grep -n "refresh_deferred" CHANGELOG.md` 는 **0건**이다 — 최종 코드의 4번째 갈래가 CHANGELOG 어디에도 등장하지 않는다. (3) 그런데도 같은 라운드의 이전 documentation 리뷰(`review/code/2026/08/10/17_15_33_2/documentation.md`, 게이트 27)는 `` CHANGELOG.md:171(`08bd668a5` 로 이미 정정됨)... 코드·JSDoc·spec 본문·§R4·CHANGELOG 최신 섹션 5자리 모두 이번 조사 시점에서 정합함을 확인했다 `` 라고 결론지었다 — 이 결론은 **`401`/`410` 문구 정합만 확인한 것이지 `refresh_deferred` 포함 여부는 검증하지 않았다**(grep 축이 "401/410" 이었지 "refresh_deferred" 가 아니었다). 실제로는 정합하지 않는다.
  - 왜 문제인가: `plan/in-progress/webchat-auth-session-status-reconcile.md:181-219`(`## 미해결 — refresh_deferred 는 고착의 절반만 닫는다`)는 `openStream` 호출부 전수(2곳)가 모두 `refresh_deferred` 에서 건너뛰고 `use-token-refresh.ts` 는 `openStream` 을 아예 부르지 않는다는 것을 grep 으로 실증하며, "주기 갱신이 몇 번을 성공하든 스트림은 영영 안 열린다" 고 명시한다. `codebase/channel-web-chat/src/widget/use-widget.ts` 의 `SeedOutcome` JSDoc(94-106줄)도 이를 정확히 문서화하고 있다. 즉 **plan·JSDoc 은 정직하게 남은 갭을 적어 두었는데, CHANGELOG 만 이 갭이 존재한다는 사실 자체를 숨긴다.** CHANGELOG 의 문구("성공 시 SSE 재연결로 복원, 재차 401·410 이면 종료로 확정")는 낙관적 refresh 시도의 결과를 정확히 두 갈래(성공/거부)로만 서술하는데, 실제로는 **세 번째 갈래**(네트워크/5xx 오류 → `refresh_deferred` → 스트림 영구 부재)가 존재하고 이것이 바로 이번 라운드 side_effect reviewer 가 CRITICAL 로 확정한 잔여 결함이다. 이 PR 히스토리 자체가 같은 문서 스테일 클래스를 이미 세 번(`153791125`, `08bd668a5`, `5693e42ad`) 고쳤고 그때마다 "다른 축에서 샜다" 고 자평했는데, 이번이 그 네 번째 재발이다 — 이번엔 용어 축이 아니라 **잔여 결함의 존재 자체**가 누락됐다는 점에서 이전 세 건보다 실질적으로 더 크다.
  - 제안: `CHANGELOG.md:166-173` 항목에 짧은 5번 항목(또는 각주)을 추가해 `refresh_deferred`(네트워크/5xx 로 인한 비확정 실패) 경로에서는 스트림이 재개되지 않아 영구 고착이 남는다는 사실과, 그 처방이 `plan/in-progress/webchat-auth-session-status-reconcile.md` 에 설계 선택 3안으로 등재돼 있다는 점을 명시할 것. `CHANGELOG.md` 의 다른 항목들(예: `172`번째 줄, "그 외 오류는 여전히 soft-fail")도 이미 "남은 경계"를 명시하는 관례를 갖고 있어 이 스타일과 일관된다.

- **[CRITICAL]** 이번 라운드(`17_15_33_2`)의 SUMMARY.md/RESOLUTION.md 가 documentation reviewer 의 WARNING 2건을 처분 없이 "확인"으로 뭉개 사실상 유실시켰다 — `RESOLUTION.md` 자신의 "전부 처분" 주장과 어긋난다.
  - 위치: `review/code/2026/08/10/17_15_33_2/RESOLUTION.md:3`(`forced 7명. **Critical 2 · WARNING 2 전부 처분.**`, 이후 §1~§4 어디에도 documentation 항목 없음) / `review/code/2026/08/10/17_15_33_2/SUMMARY.md:9`(`Critical 2 · WARNING 2 — **전부 처분**`), `SUMMARY.md:27`(경고 표: `| documentation | 서술 정합 | 확인 |`).
  - 상세: `review/code/2026/08/10/17_15_33_2/documentation.md`(같은 라운드, 이 커밋에 포함된 파일)는 실제로 **WARNING 2건**을 냈다 — (a) 게이트 9: `CHANGELOG.md:199` 가 여전히 `SeedOutcome` 을 3-state 로 서술(4-state 여야 함), (b) 게이트 17: 신설된 "frontmatter 재판정 대기" 노트(spec §3.1)를 지우는 체크리스트 항목이 조율 plan 에 없음. `SUMMARY.md` 의 "경고" 표는 이 둘을 `documentation | 서술 정합 | 확인` **한 줄**로 뭉개고, `RESOLUTION.md` 는 이 WARNING 들을 아예 논의하지 않는다 — maintainability WARNING(게이팅 헬퍼 추출)은 `RESOLUTION.md §3` 에서 명시적으로 다뤄지는 것과 대조적이다. "확인" 이 정확히 무엇을 의미하는지(반영? 의도적 보류? 근거는?)가 어디에도 없다. 직접 검증한 결과 **둘 다 여전히 미해결**이다:
    - `CHANGELOG.md:199` 는 지금도 `` `seedWaitingFromStatus` 는 3-state(`"ended"`/`"stale"`/`"continue"`) 반환 `` 이라고 적혀 있다(직접 Read 로 확인, HEAD 기준).
    - `plan/in-progress/webchat-auth-session-status-reconcile.md:46-54`(`## 처리 (나중 머지 쪽)`)의 체크리스트 3항목은 frontmatter 값·`pending_plans`·plan 이동만 다루고, `3-auth-session.md` §3.1 의 "frontmatter 재판정 대기" 노트(67-70줄)를 제거하는 단계는 여전히 없다.
  - 왜 문제인가: 이 저장소 관례는 "review/ 는 SoT 가 아니므로 미룬 항목은 그 턴에 plan/ 에 적는다" 이고, 이번 라운드는 side_effect CRITICAL(같은 성격의 미해결 항목)을 `plan/in-progress/webchat-auth-session-status-reconcile.md:181-219` 에 상세히 등재해 이 관례를 정확히 지켰다. 그런데 같은 턴, 같은 파일에 documentation 의 WARNING 2건은 등재되지도, 고쳐지지도 않고 사라졌다 — CRITICAL 은 추적되고 WARNING 은 추적되지 않는 비대칭이 생겼다. `RESOLUTION.md` 헤더의 "WARNING 2 전부 처분" 이라는 주장 자체가 문서화 관점에서 부정확하다(문서화 WARNING 은 처분되지 않았다).
  - 제안: `RESOLUTION.md`/`SUMMARY.md` 를 정정하거나(가능하면 새 커밋으로), 최소한 `plan/in-progress/webchat-auth-session-status-reconcile.md` 에 이 두 WARNING 을 체크리스트 항목으로 등재할 것. `CHANGELOG.md:199` 는 위 CRITICAL 항목과 같은 편집 기회에 함께 고칠 수 있다(같은 파일, 인접 위치).

- **[WARNING]** (재확인, 미해결) `CHANGELOG.md:199` 가 `SeedOutcome` 을 여전히 3-state 로 서술한다.
  - 위치: `CHANGELOG.md:199`(`## Unreleased — 웹채팅 위젯: 버퍼 만료 재동기화 + 종료 처리 일원화` 섹션, 4번 항목).
  - 상세: 위 CRITICAL 항목에서 이미 다뤘지만 별도로 등재한다 — 이전 라운드(`17_15_33_2`) documentation reviewer 가 이미 발견했고(`review/code/2026/08/10/17_15_33_2/documentation.md` 게이트 9-12), 이번 조사로 **아직 고쳐지지 않았음**을 재확인했다. 최종 구현은 `"refresh_deferred"` 포함 4-state 다.
  - 제안: `` 4-state(`"ended"`/`"stale"`/`"continue"`/`"refresh_deferred"`) `` 로 갱신. 위 CHANGELOG:166-173 편집과 같은 커밋에서 처리 가능.

- **[WARNING]** (재확인, 미해결) spec 에 신설된 "frontmatter 재판정 대기" 노트가 자신을 제거할 체크리스트 항목 없이 남아 있다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md`(diff 게이트 67-70, `> **frontmatter 재판정 대기 (2026-08-10)**: ...`) / 대조 `plan/in-progress/webchat-auth-session-status-reconcile.md:46-54`.
  - 상세: 노트 자체는 정확하고 근거도 있다(plan 문서의 "왜 커밋 메시지로 부족했나" 절 참조) — 문제는 그 plan 의 "처리 (나중 머지 쪽)" 체크리스트 3항목 어디에도 이 노트 4줄을 제거하는 단계가 없다는 점이다. `#1130` 또는 `webchat-reload-rest-branches` 중 나중 머지 쪽이 frontmatter 를 재판정한 뒤에도, 이 임시 조율 메모가 spec 본문에 영구 잔류하거나(plan 이 `plan/complete/` 로 이동하면) 상대링크가 깨질 위험이 있다.
  - 제안: `plan/in-progress/webchat-auth-session-status-reconcile.md:46-54` 체크리스트에 "`3-auth-session.md` §3.1 의 'frontmatter 재판정 대기' 노트 제거" 항목을 명시적으로 추가.

- **[INFO]** (긍정 확인) side_effect reviewer 가 낸 CRITICAL(`refresh_deferred` 절반만 닫음)은 이번 라운드에서 정확히 plan 에 등재됐고, 서술이 코드와 일치한다.
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:181-219`(`## 미해결 — refresh_deferred 는 고착의 절반만 닫는다`).
  - 상세: `openStream` 호출부 grep 결과(732·1089줄), `use-token-refresh.ts` 의 `openStream` 미호출, `sessionRef` 가 `useRef` 라 effect 재실행 안 됨 — 세 사실 모두 직접 코드로 재확인했고 plan 서술과 정확히 일치한다. 처방 3택(a/b/c)의 트레이드오프 서술도 코드 구조(단일 책임 훼손/phase 확장/종료 회귀 재발)와 부합한다. `use-widget.ts` 의 `SeedOutcome` JSDoc(84-106줄) 도 같은 사실을 정확히 반영한다 — **CHANGELOG 를 제외한 나머지 3개 문서(plan·JSDoc·spec 본문 R4 서술은 갈래를 좁게만 언급)는 정합하다.**

## 요약

이번 라운드가 커밋하는 것은 이전 리뷰 라운드 산출물(SUMMARY/RESOLUTION 포함)과 spec 배너 확장이다. 오케스트레이터가 요청한 핵심 질문 — "고착 원인 B 가 CHANGELOG 에도 반영돼야 하는가" — 에 대한 판정은 **그렇다, 그리고 아직 반영되지 않았다**이다. CHANGELOG 는 `refresh_deferred` 라는 용어도, 그로 인한 영구 고착 잔여도 전혀 언급하지 않으며, 이 사실을 CHANGELOG 최초 언급 시점부터 마지막 편집(`08bd668a5`, `refresh_deferred` 도입 이전)까지 한 번도 반영한 적이 없다 — 이는 plan·JSDoc 이 정직하게 갭을 남긴 것과 대비된다. 더 우려되는 것은 이번 라운드 자신의 SUMMARY/RESOLUTION 이 "WARNING 2 전부 처분" 이라고 주장하면서 실제로는 documentation 의 WARNING 2건(CHANGELOG 3-state 잔존, frontmatter 노트 self-removal 누락)을 논의도 반영도 하지 않고 흘렸다는 점이다 — CRITICAL 은 plan 에 등재됐지만 WARNING 은 추적이 끊겼다. 세 항목 모두 같은 파일(`CHANGELOG.md`) 또는 인접 파일(`plan/...reconcile.md`)의 작은 편집으로 해소 가능하다.

## 위험도

HIGH
