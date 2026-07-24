# Plan 정합성 검토 — webchat-apibase-binding (target: spec/7-channel-web-chat/)

## 발견사항

- **[WARNING]** `plan/complete/webchat-session-apibase-binding.md` 의 `spec_impact: none` 이 실제 diff 와 어긋남 (Gate C 선언 stale)
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1-1 (`{executionId, token, expiresAt, endpoints, apiBase}` 필드 열거 + 발급 origin 바인딩 서술 추가)
  - 관련 plan: `plan/complete/webchat-session-apibase-binding.md` frontmatter — `spec_impact: none` (근거 주석: "동작 계약이 좁아졌으나 spec 본문이 규정한 표면은 아니다. spec 무변경")
  - 상세: 이 plan 은 이미 첫 커밋(`f70c845f9`)에서 `spec_impact: none` 을 선언하고 `plan/complete/`로 이동했다. 그런데 같은 워킹트리의 **staged(미커밋) 변경**은 `review/code/2026/07/24/22_09_46/documentation.md` W3("SPEC-DRIFT")의 지적을 받아들여 바로 그 `spec/7-channel-web-chat/3-auth-session.md` 를 수정했다(필드 열거 갱신 + 바인딩 규칙 서술). 즉 최종 changeset 기준으로 spec 은 **변경되었는데** 이미 complete 로 이동한 plan 의 frontmatter 는 여전히 `none` 이다. `spec-plan-completion.test.ts`(Gate C)는 형식(list-or-none)만 검사하고 실제 diff 와 대조하지 않으므로 이 drift 는 CI 로 걸러지지 않는다.
  - 제안: 아직 push 전(로컬 branch, 2번째 커밋 미생성)이므로 이번 커밋에 `plan/complete/webchat-session-apibase-binding.md` frontmatter 를 `spec_impact:\n  - spec/7-channel-web-chat/3-auth-session.md` 로 교정하고, 본문에 "review 22_09_46 W3 반영으로 §3.1 필드 열거 사후 동기화" 한 줄을 추가할 것.

- **[WARNING]** RESOLUTION 이 지목한 후속 2건이 어떤 plan/in-progress 티켓에도 안착하지 않음 (산문 이월 증발 위험 — 이 plan 계열이 이미 3번 겪은 패턴)
  - target 위치: `spec/7-channel-web-chat/4-security.md` §1 보안 정책 요약 표 (재전송-origin 축 부재) / `codebase/channel-web-chat/src/widget/use-widget.ts` `wc:boot` 경로의 `apiBase` 스킴 검증(I2)
  - 관련 plan: 없음 — `plan/in-progress/` 에 이 두 항목을 추적하는 문서가 존재하지 않음(확인: `webchat-command-failure-is-not-termination.md`·`webchat-spec-rationale-followup.md`·`webchat-usewidget-extraction.md` 3개 중 어디에도 없고, `4-security`/`threat` 이름의 신규 plan 도 없음)
  - 상세: `review/code/2026/07/24/22_09_46/RESOLUTION.md` "보류·후속 항목" 절이 명시적으로 두 가지를 남긴다 — (1) "`4-security.md` 위협 표에 재전송-origin 축 추가 — 위협 모델 편집은 **planner 트랙**"(developer 는 손댈 수 없다고 스스로 판정), (2) "I2 `wc:boot` 경로의 `apiBase` 스킴 검증(query-param 폴백엔 있음) — 선재 신뢰 경계, 별건". 두 항목 다 "이 PR 범위 밖" 으로 명시적으로 미루면서도 그걸 담을 그릇을 만들지 않았다. 이 PR 이 속한 plan 계열(`webchat-boot-single-flight.md` → 산문 이월 3건 분리)이 정확히 "부모 plan 이 `complete/` 로 가면 산문 이월이 매몰된다" 는 실패를 이미 3번 겪고 그때마다 형제 티켓을 만들어 대응했다(각 plan 서두에 "형제 이월" 상호 링크로 명시). 이번엔 그 학습된 처분이 적용되지 않았다 — RESOLUTION 안에 문장으로만 남아, 이 PR 이 머지되는 순간 파묻힐 위치에 있다.
  - 제안: 최소 위 2건을 각각 (planner 트랙 — `4-security.md` 위협 축 추가) / (developer 트랙 — `wc:boot` apiBase 스킴 검증) 신규 `plan/in-progress/*.md` 티켓으로 분리하거나, 기존 3형제 중 하나(예: `webchat-spec-rationale-followup.md` 또는 새 문서)에 체크리스트 항목으로 편입할 것.

- **[INFO]** 신규 하드윈 불변식(apiBase 세션 바인딩)이 spec `## Rationale` 없이 본문 절차 서술로만 반영 — `webchat-spec-rationale-followup.md` 가 추적 중인 패턴의 3번째 사례
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1-1 (본문에는 반영, `## Rationale` 절엔 신규 R-item 없음 — R3~R6 그대로)
  - 관련 plan: `plan/in-progress/webchat-spec-rationale-followup.md` — "하드윈 불변식이 spec 에 흔적이 없다"(현재 2건: `sessionEstablished()` 단일-진실·비-410 실패 비종료 롤백)를 추적
  - 상세: 이번 diff 는 `session-store.ts`/`use-widget.ts` JSDoc·`plan/complete/webchat-session-apibase-binding.md`·CHANGELOG 에 "왜 레거시 세션도 폐기하는가", "왜 필수 인자로 뒀는가" 등 상세한 설계 근거를 담았지만, spec 본문에는 절차(what)만 추가되고 근거(why — 대안 기각·트레이드오프)를 담을 `## Rationale` 신규 항목은 없다. 이 plan 이 지적한 정확히 같은 종류의 문서화 갭(코드 주석에는 있고 spec Rationale 에는 없음)의 3번째 발생이다.
  - 제안: 우선순위 낮음(P3, 비차단) — 이번 PR 에서 바로 R7 항목을 추가하거나, `webchat-spec-rationale-followup.md` 체크리스트에 3번째 불변식으로 추가해 두면 매몰을 막을 수 있다.

- **[INFO]** `use-widget.ts` 라인 수 추가 성장(1116줄) — `webchat-usewidget-extraction.md` 의 성장 근거 데이터 갱신 권고
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (apiBase 배선 + 주석 추가로 소폭 증가)
  - 관련 plan: `plan/in-progress/webchat-usewidget-extraction.md` — "merge-base 877줄 → 이 PR 후 ~1070줄" 로 성장 추이를 근거로 리팩터 백로그를 정당화
  - 상세: 이번 PR 이후 실측 1116줄로 추가 성장했다(성장 자체를 막는 게이트는 없음 — 리팩터 착수 시점 판단 자료일 뿐). `loadSession`/`sessionEstablished` 호출부는 여전히 2곳(3번째 호출부 신설 아님)이라 그 plan 의 "seed→openStream 게이트 짝" 우려는 이번 diff 로 악화되지 않았다.
  - 제안: 차단 아님. 해당 plan 착수 시 최신 줄 수로 갱신 권고.

## 요약

이번 diff(세션 ↔ 발급 `apiBase` 바인딩)는 `webchat-command-failure-is-not-termination.md` 가 다루는 미해결 결정(비-410 명령 실패 처리)을 건드리지 않고, 그 결정을 우회하는 CRITICAL 성격 충돌은 없다. 다만 같은 changeset 안에서 두 가지 plan 위생 문제가 확인된다 — (1) 이미 `complete/` 로 이동한 자매 plan 의 `spec_impact: none` 선언이 review-fix 로 인한 실제 spec 편집과 어긋난 채 방치돼 있고(Gate C 는 형식만 검사해 못 잡음), (2) RESOLUTION 이 명시적으로 "이 PR 범위 밖" 이라 미룬 후속 2건(4-security 위협 표 갱신, wc:boot apiBase 스킴 검증)이 이 plan 계열이 스스로 세 차례 학습한 "형제 티켓 분리" 관행 없이 그냥 문장으로만 남아 매몰 위험에 놓여 있다. 둘 다 push 전 로컬에서 저비용으로 교정 가능하다.

## 위험도
MEDIUM
