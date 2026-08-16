# 변경 범위(Scope) 리뷰

## 검토 방법

`origin/main` 대비 이 브랜치(`claude/eia-masking-followups-3cd512`) 전체 diff(47 파일,
+3179/-107)를 프롬프트 payload + `git log`/`git show`/`git diff origin/main --stat` 로 직접
대조했다. 커밋 4개(`a8b0cbfdd`·`1b8fd5cc7`·`fe6a54c80`·`e5a63abff`, 선행 머지 `f5351e9c2` 제외)로
구성되며, 대부분(`review/code/2026/08/16/23_08_19/**`·`review/consistency/2026/08/16/{22_22_36,23_10_41}/**`)
은 **이번 작업 자체가 이 저장소 표준 워크플로(`developer` 완료 → `/ai-review` 강제 → fix →
`/consistency-check` 강제)에 따라 생성·커밋한 산출물**이다.

## 발견사항

- **[INFO]** 이번 diff 의 최대 파일 수(47개 중 25개)가 `review/code/**`·`review/consistency/**`
  하위의 리뷰/일관성-검토 산출물이다 — 기능 코드(§A/§B/§D) 자체는 13개 파일에 불과하다.
  - 위치: `review/code/2026/08/16/23_08_19/*`(10 파일, `RESOLUTION.md` 포함), `review/consistency/2026/08/16/22_22_36/*`(7 파일), `review/consistency/2026/08/16/23_10_41/*`(7 파일)
  - 상세: `CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 절이 `developer` 완료 직후의 `/ai-review` + Critical/Warning fix, 그리고 `project-planner`/`developer` 착수 전후의 `/consistency-check` 를 이 저장소의 **상시 사전 승인된 강제 단계**로 명시한다. 이 산출물들은 그 강제 단계가 정상 작동한 증거(23_08_19 라운드: CRITICAL 0·WARNING 8 전건 조치, `RESOLUTION.md` 로 처분 기록; 22_22_36/23_10_41 라운드: `--impl-prep`/`--spec` BLOCK:NO)이지, "발견해서 김에 고친" 부수 작업이 아니다. 실제로 이번 스코프 리뷰가 지적하는 항목 자체도 이 워크플로의 다음 라운드 산출물이다.
  - 제안: 조치 불요 — scope 위반 아님. push 게이트/PR 리뷰어가 diff 크기(47 파일)를 곧바로 "기능 범위"로 오독하지 않도록, PR 본문에 "코드 변경은 13파일, 나머지는 이 저장소 표준 review-fix-consistency 루프의 누적 산출물" 임을 한 줄 명시하는 것을 권장한다(비필수).

- **[INFO]** `plan/in-progress/eia-internal-rest-error-masking.md` → `plan/complete/` 이동(git mv) + 링크 2곳 정정이 이번 선언된 작업(§A/§B/§D)과 별개 사유로 같은 브랜치에 묶여 있다. **이전 라운드(`23_08_19/scope.md`)가 이미 INFO 로 지적**했고 이번 라운드에서 추가 변경은 없다(같은 상태 유지).
  - 위치: `plan/complete/eia-internal-rest-error-masking.md`(신규, git mv), `plan/in-progress/spec-sync-external-interaction-api-gaps.md:199`,`:212`(링크 `./` → `../complete/`) — 커밋 `a8b0cbfdd`
  - 상세: 커밋 메시지 자체가 "유일한 미체크 `push 게이트 통과 → PR` 이 실제로는 #1179 로 이미 머지돼 있었다. plan 만 stale 로 남아 있었다" 라고 사유를 명시하며, 내용 변형 없는 순수 상태 정정(frontmatter `status`, 체크박스 1건, 인입 링크)이라 위험은 낮다.
  - 제안: 조치 불요(이미 저위험으로 판정됨, 반복 지적 방지 차 재확인만).

- **[INFO]** `docs(spec)` 커밋(`e5a63abff`)이 이번 작업의 SoT 반영(§R17 카탈로그, WS §4.1 값-마스킹 캐비엇, Rationale 보강) 외에 **이번 diff 와 무관한 기존 spec drift**(`nodeName` → `nodeLabel` 4행 정정, `execution.node.*` 이벤트 표)도 같은 커밋에 정정했다.
  - 위치: `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 표 — `execution.node.started`/`.completed`/`.failed`/`.skipped` 4행 및 그 아래 `> **Note` 캐비엇
  - 상세: 이 drift(spec 은 `nodeName`, 실제 엔진 emit 은 전부 `nodeLabel`)는 이번 마스킹 작업과 무관한 기존 결함이며, `plan/in-progress/eia-fanout-and-internal-data-masking.md`/`spec-sync-external-interaction-api-gaps.md` 어느 체크리스트에도 §A/§B/§D 항목으로 등재돼 있지 않다. 다만 직전 라운드의 `convention_compliance` 검토(`22_22_36`)가 이 항목을 발견하며 "코드 변경 없이 문서만 정정하면 되는 저비용 항목이라, 이번 `eia-fanout-and-internal-data-masking` 작업의 spec 반영 단계에 **곁들여 함께 정정하는 것을 권장**한다" 고 명시적으로 지시했고, 실제로 같은 파일(`6-websocket-protocol.md`)을 같은 커밋에서 편집하는 중이라 한계비용이 0이었다. 코드 변경은 전혀 없고(순수 문서 정정), 트래커에 발견 경위·근거도 남겼다.
  - 제안: 조치 불요 — 검토자가 명시적으로 권장한 "함께 정정" 이라 정책상 예외에 해당한다. 다만 향후 리뷰에서 같은 커밋 diff 만 보는 사람은 "왜 `nodeName`/`nodeLabel` 이 이 마스킹 PR 에 있나" 를 오독할 수 있으니, 커밋 메시지가 이미 그 근거(`22_22_36 convention W1`)를 밝혀 둔 것으로 충분하다고 판단한다.

## 확인했으나 문제 없음 (참고)

- 기능 코드 13개 파일(CHANGELOG.md 제외 12개 + CHANGELOG)은 전부 plan(`eia-fanout-and-internal-data-masking.md`) §A(WS emit 값-패턴 마스킹)·§B(`inputData`/`outputData` egress 마스킹 확장)·§D(표면 수치 단일화)로 정확히 추적되며, 새 테스트는 전부 신규 프로덕션 경로를 겨냥한다. 이전 라운드(`23_08_19/scope.md`)의 판정(LOW, INFO 2건)과 이번 라운드의 재확인 결과가 일치한다.
- `sanitize-error-message.ts` 의 `deepRedactCore`/`deepRedactObject` 분리, `MASKED_MARKERS`/`VALUE_MASK_MARKER` 계열 상수 승격, `maskIfPresent` 헬퍼 도입은 모두 이번 마스킹 작업(마커 멱등성·preserveKeys·중복 리터럴 제거)의 직접 파생이며, `build` 가 실제로 타입 결함 2건을 잡아낸 것으로 보아 drive-by 정리가 아니라 필요에 의한 변경으로 확인된다.
- 임포트 변경(`redactStoredDataForResponse`, `deepRedactSecretsPreserving` 추가 import)은 전부 새로 호출되는 함수에 대응하며, 사용하지 않는 임포트 추가·정리는 발견되지 않았다.
- 포맷팅-only 변경이 실질 변경과 섞인 흔적은 없다 — diff 는 신규 라인 추가(문서 JSDoc, 테스트, 마스킹 호출)와 국소적 치환(리터럴 → 상수 참조)으로 구성되고 광범위한 재포맷은 없다.
- `spec/5-system/12-webhook.md`(+9줄), `14-external-interaction-api.md`(+63/-일부), `6-websocket-protocol.md`(+23/-일부)는 전부 이번 작업이 SoT 로 반복 인용하는 문서이며, 위 nodeName 건을 제외하면 전량 §R17/§4.1/Rationale 갱신에 직접 대응한다.

## 요약

47개 변경 파일 중 실제 기능 범위(§A/§B/§D)는 13개 파일에 집중돼 있고, 나머지 대다수(25개)는 이 저장소가 구현 완료 후 상시 강제하는 review-fix-consistency 워크플로의 정규 산출물(`review/code/**`, `review/consistency/**`)로서 scope 이탈이 아니다. 남은 두 항목 — plan-lifecycle stale 상태 정정(git mv, 이전 라운드 기 확인)과 `nodeName`→`nodeLabel` spec drift 정정(직전 검토자가 명시적으로 "함께 정정" 권고, 순수 문서 변경) — 은 둘 다 사유가 diff/커밋 메시지에 명시돼 있고 코드 위험이 없는 저비용 부수 작업이라 INFO 수준으로만 기록한다. 의도하지 않은 기능 확장, 무관한 코드 영역 수정, 드리프트성 리팩터링, 불필요한 포맷팅/주석/임포트 변경은 발견되지 않았다.

## 위험도

LOW
