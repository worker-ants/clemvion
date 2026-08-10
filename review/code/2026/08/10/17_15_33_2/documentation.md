# 문서화(Documentation) Review

대상: `spec/7-channel-web-chat/3-auth-session.md` §3.1 배너 확장(404/401/410 구현 반영) + frontmatter 재판정 대기 노트 신설 + §3.1-2 `401`→`401`·`410` 정정.

지시에 따라 diff 범위를 넘어 저장소 전체를 `SeedOutcome` 반환값 용어 축(`"continue"` → `"stale"` → `"refresh_deferred"`, 3-state → 4-state)으로 교차 확인했다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 에 `SeedOutcome` 을 여전히 **3-state** 로 서술하는 자리가 남아 있다 — 최종 구현은 `"refresh_deferred"` 가 추가된 **4-state**다.
  - 위치: `CHANGELOG.md:199` (`## Unreleased — 웹채팅 위젯: 버퍼 만료 재동기화 + 종료 처리 일원화` 섹션, 4번 항목: `` `seedWaitingFromStatus` 는 3-state(`"ended"`/`"stale"`/`"continue"`) 반환으로... ``)
  - 상세: 이 라인은 2026-07-17(`refresh_deferred` 도입 이전) 이후 한 번도 수정되지 않았다(`git blame` 확인, 커밋 `5de44d4d63`). 같은 파일의 더 최근 섹션(`CHANGELOG.md:166`)은 `404`·복구불가 `401`/`410`·`refresh_deferred` 를 정확히 반영하고 있어, 같은 문서 안에서 오래된 섹션과 최신 섹션의 `SeedOutcome` 상태 개수 서술이 서로 어긋난다. 이 PR 히스토리 자체가 "401→401/410" 축 stale 을 두 라운드(`153791125`, `08bd668a5`)에 걸쳐 CHANGELOG·JSDoc·plan 여러 자리에서 반복 수정했지만, 그 축은 **"3-state → 4-state"** 라는 별도 용어 축까지는 훑지 않았다(두 자리 모두 `401`/`410` 문구만 대상이었고 `3-state` 문구는 grep 패턴 밖이었다).
  - 제안: `CHANGELOG.md:199` 를 `` 4-state(`"ended"`/`"stale"`/`"continue"`/`"refresh_deferred"`) `` 로 갱신하거나, 최소한 이 서술이 2026-07-17 시점(당시엔 사실)의 스냅샷임을 표시. 이후 검색 시 `grep -rn "3-state" .` 같은 축 하나로는 이 클래스가 다시 새고 있는지 못 걸러낸다는 점(이 세션이 이미 6번 겪은 "센 축이 매번 달랐다" 패턴)도 참고.

- **[INFO]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md:40` 도 `` `SeedOutcome` 3-state 는 유지 `` 라고 적는다.
  - 상세: 이 줄은 2026-07-17 시점의 "왜 세대 검사로 대체하지 않았나"를 설명하는 역사적 결정 로그이고 주변 문맥(같은 항목의 다른 줄들이 날짜를 명시)이 그 시점성을 어느 정도 드러낸다. 다만 "3-state 는 유지"라는 문구만 스캔하면 현재도 3-state로 오인할 수 있어 CHANGELOG 건과 같은 근본 원인이다. 별도 수정 의무로 보긴 어렵지만(오래된 plan 항목의 일반적 관례), CHANGELOG 수정 시 같은 grep 축(`3-state`)으로 함께 훑는 편이 재발을 줄인다.

- **[WARNING]** 이번 diff 로 신설된 "frontmatter 재판정 대기" 블록쿼트 노트(§3.1)가, 그 노트 자신이 가리키는 조율 plan 의 완료 체크리스트에는 **자기 자신을 제거하는 항목이 없다**.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:67-70` (신규 4줄), 대조 `plan/in-progress/webchat-auth-session-status-reconcile.md:48-54` (`## 처리 (나중 머지 쪽)` 체크리스트).
  - 상세: 노트는 "절차는 `webchat-auth-session-status-reconcile.md`" 라고 안내하는데, 그 plan 의 체크리스트 3항목(`#1130 이 나중이면...`/`webchat-reload-rest-branches 가 나중이면...`/`plan/complete/ 로 이동`)은 frontmatter 값·`pending_plans` 필드·plan 자신의 이동만 다루고, **`3-auth-session.md` §3.1 에 새로 박아 넣은 이 노트 4줄을 지우는 단계는 어디에도 없다.** 재판정이 끝나도 이 임시 조율 메모가 spec 본문에 영구 잔류할 위험이 있고, plan 이 `plan/complete/` 로 이동하면(이 저장소 라이프사이클 관례상 완료 plan 은 `plan/complete/` 로 옮겨진다) 노트의 상대링크 `../../plan/in-progress/webchat-auth-session-status-reconcile.md` 도 깨진다.
  - 제안: `webchat-auth-session-status-reconcile.md` 의 처리 체크리스트에 "`3-auth-session.md` §3.1 의 'frontmatter 재판정 대기' 노트(및 이 문서 링크) 제거" 항목을 명시적으로 추가할 것.

- **[INFO]** 신설된 두 블록쿼트 문단이 빈 `>` 줄로 분리되지 않아, 이 파일의 기존 관례(예: §R7 의 "예외" / "근거의 성격" 블록, `168-174`)와 달리 마크다운 렌더링 시 하나의 연속 문단으로 합쳐질 수 있다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:66`→`67` 사이 (경계 없음). 대조: 같은 파일 `168`→`170`→`171` 은 빈 줄로 두 블록쿼트를 분리해 별개 문단으로 렌더링된다.
  - 상세: 66번 줄("v1 구현 현황(부분)")과 67-70번 줄("frontmatter 재판정 대기")은 서로 다른 주제(구현 상태 vs PR 간 조율)인데 CommonMark 규칙상 두 `>` 줄 사이에 빈 `>` 줄이 없으면 하나의 문단으로 합쳐져 렌더링된다. 정보 자체는 정확하지만 가독성이 떨어진다.
  - 제안: 66번과 67번 사이에 `>` 만 있는 빈 줄을 추가해 별도 문단으로 분리.

- **[INFO]** (정합성 확인, 조치 불요) `spec/7-channel-web-chat/3-auth-session.md:89` 의 `401`·`410` 정정은 같은 파일 §R4(`104-108`) 및 `CHANGELOG.md:171`(`08bd668a5` 로 이미 정정됨)과 line-level 로 정확히 일치한다. `use-widget.ts` 의 `SeedOutcome` JSDoc(`78-106`, `463-511`)도 `refresh_deferred` 를 포함해 최종 판과 일치한다 — 코드·JSDoc·spec 본문·§R4·CHANGELOG 최신 섹션 5자리 모두 이번 조사 시점에서 정합함을 확인했다(위 CHANGELOG:199 한 자리만 예외).

## 요약

리뷰 대상 diff 자체(§3.1 배너 확장, `401`→`401`·`410` 정정, frontmatter 재판정 노트)는 코드·§R4·최신 CHANGELOG 섹션과 정확히 정합하며, 이 티켓이 여러 라운드에 걸쳐 반복 지적됐던 "401/410" 축 문서 stale 은 이미 해소되어 있다. 다만 지시받은 대로 반환값 용어 축(3-state → 4-state)을 저장소 전체로 넓혀 보면, `CHANGELOG.md:199` 가 이번 delta 가 손대지 않은 더 오래된 섹션에서 여전히 `SeedOutcome` 을 3-state 로 서술해 최신 코드(4-state, `refresh_deferred` 포함)와 어긋난다 — 이전 자기수정 라운드들이 매번 "다른 축"에서 새는 패턴을 이번에도 반복한 사례다. 추가로 이번에 신설된 "frontmatter 재판정 대기" 노트는 내용은 정확하지만 (a) 자신을 제거할 체크리스트 항목이 조율 plan 에 없어 영구 잔류·링크 부패 위험이 있고 (b) 인접 블록쿼트와 문단 경계가 없어 렌더링이 뭉개진다.

## 위험도

MEDIUM
