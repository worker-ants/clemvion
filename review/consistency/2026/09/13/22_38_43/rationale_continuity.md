# Rationale 연속성 검토

## 전제 (실측)

- 이번 검토의 `scope`(`spec/conventions/`) 델타는 **0개 파일** — 이 브랜치는 spec 을 바꾸지 않았다.
- 실제 구현 diff 는 `codebase/` 4개 파일(846+/11− 줄)이며, 프롬프트 번들은 컨텍스트 예산 초과로 diff 본문과 `spec/conventions/error-codes.md` 를 절단했다. 이에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)에서 `git diff origin/main...HEAD -- codebase/` 및 관련 spec 파일을 직접 읽어 분석했다.
- 실제 변경: (1) `codebase/frontend/src/content/docs/02-nodes/logic.mdx`·`logic.en.mdx` 의 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 서술 정정("전용 에러 코드가 아니라 메시지 접두"), (2) `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`/`.test.ts` 에 "발행 축"(`GUIDE_NON_EMITTED_VOCABULARY`) 신설.

## 발견사항

### [WARNING] "허용목록 없음" 원칙의 2차 번복이 spec `## Rationale` 에 착지하지 않음

- target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의 `GUIDE_NON_EMITTED_VOCABULARY` 선언부 주석 (diff 상 신규 export, `guide-identifier-existence.test.ts` 의 "발행 축" describe 블록 동반)
- 과거 결정 출처: `#1330` 이 세운 "허용목록 없음" 설계 원칙 — 단, 이 원칙은 **`spec/conventions/*.md` 의 어떤 `## Rationale` 에도 존재하지 않는다** (`grep -rn "허용목록 없음\|#1330" spec/` 0건, 확인함). 원칙은 오직 `guide-identifier-scan.ts` 상단 주석("`#1330` 은 *"허용목록 없음"* 을 설계 원칙으로 세웠다")과 `plan/in-progress/error-code-emission-axis.md` 안에서만 서술된다.
- 상세: 이번 diff 는 코드 스스로 "이것이 그 원칙의 **두 번째 부분 번복**이다(첫 번째는 `GUIDE_EXTERNAL_VOCABULARY`)" 라고 명시한다. 두 번째 이유까지 코드 주석에 상세히 남겼고(`where`/`why` 강제, 상한 5건, "죽은 항목" 검사 등 자체 회귀 방지 장치도 갖췄다) — **근거 자체는 충실**하다. 문제는 CLAUDE.md 의 SoT 표("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")를 따르면 이런 설계원칙 번복은 spec 문서(가드 가족의 SoT 인 `spec/conventions/user-guide-evidence.md`, 또는 `error-codes.md`)의 `## Rationale` 에 남아야 하는데, 1차·2차 번복 모두 spec Rationale 에는 흔적이 없다. 실제로 이 가드(`guide-identifier-existence.test.ts`) 자체도 `user-guide-evidence.md §2` 의 가드 3건 표에 아직 등재돼 있지 않다(코드 주석이 스스로 인정 — "이 가드는 아직 그 문서 §2 표에 없다(등재는 planner 트래커 항목)"). 즉 이 축의 설계 결정 전체가 spec 표면에서는 보이지 않고, 코드 주석 + in-progress plan 에만 존재한다. 다음에 세 번째 예외가 필요해질 때, spec Rationale 을 근거로 판단하는 사람(또는 checker)은 이 선례를 볼 수 없다.
- 제안: 두 가지 중 하나. (a) `plan/in-progress/error-code-emission-axis.md` 완료 후 `complete/` 이관 시, "허용목록 없음 원칙의 두 차례 예외(외부 어휘·비발행 어휘)와 그 사유"를 `spec/conventions/user-guide-evidence.md` 의 `## Rationale` 에 R-6 항목으로 옮겨 적는다. (b) 최소한 `user-guide-evidence.md §2` 가드 표에 `guide-identifier-existence.test.ts` 를 등재하는 트래커 항목 처리 시점에 이 원칙-번복 이력도 함께 기입하도록 그 트래커 항목 설명에 명시한다. 이번 PR 범위에서 즉시 처리하라는 뜻은 아니다(가드 미등재는 이미 이전 라운드에서 WARNING 으로 잡혀 별도 트래커에 있다) — 다만 "새 Rationale 없이 원칙을 두 번째로 우회했다"는 사실은 그 트래커 항목이 놓치지 않도록 교차 링크가 필요하다.

### [INFO] `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 정정이 다른 spec 문서에는 아직 미반영

- target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx`·`logic.en.mdx` (diff 로 정정됨: "전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요")
- 과거 결정 출처: 없음 — 이번 정정은 새로운 사실 서술이며 기각된 대안을 재도입하는 것이 아니다. 다만 같은 사실을 다르게(코드처럼) 서술하는 spec 문서가 여럿 남아 있다: `spec/4-nodes/1-logic/0-common.md:83`("`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`" 를 괄호로만 인용), `spec/4-nodes/1-logic/9-foreach.md:209-210`(컬럼 헤더 "메시지 / 코드", 백틱 인용만), `spec/4-nodes/1-logic/7-map.md:179-180`(컬럼 헤더 "메시지" 이지만 값은 코드처럼 단독 인용), `spec/3-workflow-editor/0-canvas.md:636`, `spec/3-workflow-editor/2-edge.md:202`, `spec/5-system/4-execution-engine.md:332-333`("`CONTAINER_MISSING_EMIT` 에러로 실행 실패"). 반대로 `spec/4-nodes/1-logic/3-loop.md:189-191` 은 컬럼 헤더가 "메시지" 이고 값도 전체 메시지 문장(코드 접두 포함)이라 이번 정정과 이미 정합적이다.
- 상세: `plan/in-progress/error-code-emission-axis.md:612` 에 "`CONTAINER_*` 를 §1.4 에 backfill 등재" 트래커 항목이 이미 존재해 이 비대칭을 알고 있다. 즉 "결정의 무근거 번복"은 아니고 "의도된 단계적 정정, 후속 등재 예정"에 해당하지만, 현재 상태로는 user-guide 는 "코드 아님"이라 하고 6곳의 spec 문서는 여전히 코드처럼 서술해 **독자가 어느 쪽을 믿어야 할지 모호**하다.
- 제안: 이번 PR 로 정정을 마무리하지 않는다면(스코프 상 타당) 최소한 `spec/4-nodes/1-logic/9-foreach.md`·`7-map.md` 두 곳의 컬럼 헤더("메시지 / 코드")를 "메시지"로만 통일하거나, 정정 완료 시점(§1.4 backfill)까지는 이 6곳에 "정식 `error.code` 아님 — 메시지 접두" 각주를 남겨 mdx 사용자 가이드와의 불일치 창을 좁힐 것을 트래커 항목에 명시적으로 추가 권고.

### [INFO] `collectCatalogCodes` 의 "탈출구" 설계는 기존 §1.4 Rationale 과 정합

- target 위치: `guide-identifier-scan.ts` 의 `collectCatalogCodes` 주석("카탈로그는 «요구 조건» 이 아니라 «탈출구» 다")
- 과거 결정 출처: `spec/5-system/3-error-handling.md §1.4` 상단 note ("이 표는 단일 등재처를 뜻하지 않는다 … 나머지 7종은 앵커 없는 맨 문자열")
- 상세: 확인 목적으로만 기록 — 이 설계는 기존 spec 이 이미 인정한 "카탈로그 불완전성"(에러 코드 78종 중 28종 미등재, 그중 25종은 실제 발행되는 통합 코드)을 그대로 반영한 것으로, 기존 원칙과 충돌하지 않는다. 위반 사례로 볼 근거 없음.

## 요약

이번 diff 는 spec 자체를 건드리지 않고(`spec/conventions/` 델타 0) `codebase/` 의 테스트 가드와 사용자 가이드 문구만 정정한다. 핵심 설계 결정(발행-축 허용목록 `GUIDE_NON_EMITTED_VOCABULARY` 신설)은 `#1330` 이 세운 "허용목록 없음" 원칙의 두 번째 부분 번복이며, 코드 주석과 in-progress plan 에는 충분한 근거·자기 검증 장치와 함께 잘 기록돼 있다 — "무근거 번복"은 아니다. 다만 그 근거가 project 관례상 SoT 인 spec `## Rationale` 에는 한 번도 착지한 적이 없어(1차·2차 모두), 다음에 유사한 예외가 필요할 때 spec 만 보는 사람은 이 선례를 알 수 없는 구조적 갭이 남는다. 또한 이번에 정정한 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 서술과 다른 6개 spec 문서의 기존 서술 사이에 일시적 비대칭이 생겼으나, 이는 이미 트래커에 등재된 후속 작업(§1.4 backfill)으로 알려진 상태다. CRITICAL 수준의 기각 대안 재도입이나 invariant 위반은 발견되지 않았다.

## 위험도

LOW
