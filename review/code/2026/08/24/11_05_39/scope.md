# 변경 범위(Scope) 검토 — `node-output-envelope`

## 발견사항

- **[INFO]** 한 커밋 세트에 세 종류의 권한 역할(developer 코드 변경 · "(planner 턴)" API 계약 spec 수정 · 자기-반증형 소정정)이 섞여 있다
  - 위치: `plan/in-progress/node-output-envelope.md:8-20` (frontmatter `spec_impact` 두 블록), `spec/5-system/14-external-interaction-api.md:1748-1802`, `spec/5-system/6-websocket-protocol.md:187-188,425`
  - 상세: `websocket.service.ts`/`.spec.ts`(코드·테스트)에 더해 API 계약 문서인 EIA §R17·WS §4.4/§4.1(2개 파일)까지 이번 diff 에 포함돼 있다. CLAUDE.md 의 자기-반증형 소정정 예외는 조건 2(API 계약 제외)로 이 두 파일을 배제하므로, plan 은 이를 "(planner 턴)" 항목으로 별도 명시해 같은 PR 안에서 처리했다고 밝히고 있다(`#1204`·`#1208` 선례 인용). 이 판단 자체는 이미 `/consistency-check --impl-prep`(`review/consistency/2026/08/24/10_44_28/`)가 CRITICAL 로 잡아 검토했고, developer 는 RESOLUTION.md 에서 "예외를 원용한 것은 `conversation-thread.md` 한 파일뿐이며 나머지 둘은 planner 턴으로 문서화된 처리"라고 반박·수용 절충했다. 따라서 이 항목은 이미 별도 게이트(consistency-check)를 거쳤고 스코프 리뷰가 새로 지적할 실질 결함은 아니나, **"developer 작업"이라는 표제 아래 spec 계약 문서 3곳 + plan 3곳 + 코드 2곳 + review 아티팩트 9곳, 총 19개 파일**이 한 diff 에 섞여 있다는 점은 리뷰어가 "요청된 변경"의 경계를 판별하기 어렵게 만드는 요인이라 기록해 둔다.
  - 제안: 조치 불요(이미 consistency-check RESOLUTION 으로 처리됨). 다만 향후 유사 작업에서 "(planner 턴)" 항목을 별도 커밋으로 분리하면 diff 경계가 더 명확해진다.

- **[INFO]** 이번 task 의 좁은 목표(`envelope.output` 허용목록 배선) 범위를 살짝 넘어 인접 문서 오류 2건을 같이 고쳤다
  - 위치: `spec/5-system/6-websocket-protocol.md:188`(`execution.node.failed` 행에 `output` 열 신규 추가), `spec/5-system/6-websocket-protocol.md:187`(`output` 래퍼/도메인값 명명 정정)
  - 상세: `execution.node.failed` 행이 이전에 `output` 필드를 아예 문서화하지 않았던 선재 갭과, `output` 식별자가 래퍼 전체 vs 도메인 값 두 레벨로 혼용되던 서술 오류는 이번 `envelope.output` 배선 작업이 직접 요청한 변경은 아니다. 다만 두 건 모두 `10_44_28` consistency-check 가 같은 세션에서 발견해 "같은 자리를 두 번 열지 않기 위해" 함께 고칠 것을 제안했고, 실제로 같은 §4.1 표·같은 필드(`output`)를 다루는 자매 오류라 이 프로젝트의 기존 관례("자매를 갈라 고치면 다음 라운드에 나머지가 돌아온다")와 일치한다. over-engineering 이 아니라 최소 반경의 문서 정합화로 판단된다.
  - 제안: 조치 불요.

- **[INFO]** `websocket.service.spec.ts` 에 이번 작업 범위를 초과하는 잠재 위험(`nodeOutputCache` flat 폴백)을 다루는 신규 캐너리 테스트가 추가됐으나, 고치지 않고 관찰만 고정한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:963-998`("[잔여 고정] flat 폴백 shape 이 오면 목록 밖 키는 떨어진다")
  - 상세: 이 테스트는 `ai-turn-orchestrator.service.ts` 의 `finalAdapted ?? nodeOutputCache` 폴백이라는, 이번 작업이 직접 겨냥하지 않은 별도 경로의 현재 동작을 캐너리로 고정한다. 코드 수정 없이 assertion 만 추가하는 형태이고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:190-202` 에 파생 항목으로 정식 등재돼 있어 "이번 PR 이 몰래 확장한 기능"이 아니라 "발견했지만 의도적으로 미루고 캐너리로 봉인한" 패턴(이 저장소의 표준 관례)에 해당한다. 기능 확장(over-engineering)으로 볼 근거는 없다.
  - 제안: 조치 불요.

## 확인했지만 문제 없음

- `allowlistFanoutNodeOutput` → `narrowTopLevelNodeOutput` 헬퍼 추출 리팩터(`codebase/backend/src/modules/websocket/websocket.service.ts:182-207`)는 `nodeOutput`/`output` 두 키에 동일한 copy-on-change 좁히기 로직을 재사용하기 위한 최소 범위 리팩터다 — 이번 작업이 두 번째 키를 추가하는 것이 목적이므로 직접 필요한 변경이고, 무관한 코드 정리가 아니다.
- `websocket.service.spec.ts` 의 `[잔여]` 캐너리를 `[캐너리]` 로 뒤집은 것(`906-998` 부근)은 그 테스트 JSDoc 이 "닫히면 이 단언을 뒤집는 것이 그 작업의 일부"라고 명시적으로 예고해 둔 계약을 이행한 것이며, 임의의 테스트 변경이 아니다.
- `CHANGELOG.md`, `plan/complete/sse-nodeoutput-allowlist.md`, `plan/in-progress/spec-draft-eia-62-waiting-payload.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `spec/conventions/conversation-thread.md:392` 의 수정은 전부 동일한 "`envelope.output` 유예 근거가 반증됐다"는 하나의 사실을 취소선-보존 패턴으로 미러링하는 문서 동기화이며, 임의의 문서 손질이 아니다.
- `review/consistency/2026/08/24/10_44_28/**` 9개 신규 파일은 CLAUDE.md 가 강제하는 `/consistency-check --impl-prep` 절차의 정규 산출물(SUMMARY/RESOLUTION/각 checker 리포트/meta.json/_retry_state.json)로, 작업 절차상 필수 증거이며 범위 외 삽입물이 아니다.
- 포맷팅·주석·임포트·설정 파일 변경 중 실질 변경과 무관하게 섞인 항목은 발견되지 않았다. 모든 diff hunk 가 `envelope.output` 배선 또는 그 근거 문서화에 직접 대응한다.

## 요약

이번 diff(19개 파일)는 표면적으로는 넓어 보이지만, 실제 내용은 단일 목표 — `execution.node.completed`/`.failed` 의 `envelope.output` 도 기존 fail-closed allowlist 로 닫는다 — 를 중심으로 코드(리팩터+배선) · 테스트(캐너리 뒤집기+신규 캐너리 3종) · plan/spec 문서(취소선-보존형 동기화) · consistency-check 증거 아티팩트가 유기적으로 엮여 있다. API 계약 문서(EIA/WS)를 developer 턴이 직접 고친 절차적 쟁점은 이미 `/consistency-check` CRITICAL → RESOLUTION 반박·수용으로 별도 처리됐고, 그 밖에 요청 범위를 벗어난 리팩토링·기능 확장·무관한 파일 수정·의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다. 인접 문서 오류 2건을 같이 고친 것과 잠재 위험을 캐너리로만 고정한 것은 모두 이 저장소의 기존 관례(자매 동시 처리·유예는 실측+캐너리)와 일치하는 최소 확장이다.

## 위험도

NONE
