# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 문서(spec/plan) 배치 PR. `codebase/**` 변경 0줄, 3라운드 `/consistency-check --spec`로 Critical 0 수렴 확인. 코드·spec 상호 대조 재검증 결과 신설 내용은 전부 정확하나, "정본 트래커" 문서(`spec-sync-external-interaction-api-gaps.md`) 2곳과 plan 체크리스트 1곳에 이미 폐기/완료된 근거가 취소선 없이 stale 상태로 남아 있다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | plan 체크리스트 "3회차" 항목이 실제로는 완료(HEAD `3bae8bc33`, `17_04_25` BLOCK: NO)됐는데 미체크(`[ ]`) 상태로 남음 — "체크박스=실제 상태" 규약 위반 | `plan/in-progress/spec-draft-planner-doc-batch.md:160` | `[x]`로 변경하고 "`17_04_25` BLOCK: NO — W2(waitingNodeType 스코프 누락)까지 같은 커밋에서 정정" 결과 요약 추가 |
| 2 | requirement | "정본 트래커"(`spec-sync-external-interaction-api-gaps.md`) B3 항목이 `16_41_05`에서 CRITICAL로 반증되고 `dd8a17207`에서 재작성된 "동일 이름·다른 계층" 근거를 취소선 없이 그대로 "해소" 문구로 들고 있음 — plan 파일 자매 문서는 같은 회차에 정정됐으나(`spec-draft-planner-doc-batch.md:165-168`) 이 트래커는 미반영. 다음 planner 세션이 폐기된 논리로 B3를 오독할 위험 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322` | `spec-draft-planner-doc-batch.md:165-168`과 같은 관례로 취소선 + 정정 주석("`16_41_05` CRITICAL로 반증, 실제 각주는 `dd8a17207`가 재작성") 추가 |
| 3 | requirement | 같은 트래커 B1 항목이 `16_41_05` convention_compliance에서 반증된 "코드 주석과 같은 문구" 표현을 그대로 들고 있음 — 실측(`node-output-allowlist.ts:47-48,73,78`)상 코드 JSDoc은 축약형이라 spec 라벨과 문자 그대로 같지 않고, `node-output.md` 본문은 이미 "EIA §R17과 같은 문구"로 정정돼 있으나 트래커만 stale | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:121` | "라벨은 `NODE_OUTPUT_ALLOWED_KEYS` 주석과 같은 문구를 썼다"를 "라벨은 EIA §R17과 같은 문구를 썼다(코드 JSDoc은 접미어 없는 축약형이라 문자 그대로 같지는 않음, `16_41_05` convention W3)"로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 신설 각주 뒤 빈 줄 2개 연속 — 스타일 사소, 강제 lint 없음 | `spec/5-system/6-websocket-protocol.md:541-542` | 조치 불요(원하면 drive-by로 정리) |
| 2 | scope | provider 3문서(discord/slack/telegram)에 동일 4문장 프레임 각주가 축약 없이 3벌 그대로 복제(triplication) — 다만 이 저장소의 기존 provider-미러 컨벤션(cafe24/makeshop 선례)과 일치해 스코프 위반은 아님 | `spec/4-nodes/7-trigger/providers/discord.md:258-264`, `slack.md:235-241`, `telegram.md:162-168` | 조치 불요. 추후 이 세 파일을 다시 열 때 B6과 같은 링크-only 축약 대상인지 재고 |
| 3 | requirement | 트래커 stale 원인 진단: 3회차 `/consistency-check --spec`의 `target_path`가 매번 plan 파일(`spec-draft-planner-doc-batch.md`) 한 개로만 고정돼, 자매 트래커 문서(`spec-sync-external-interaction-api-gaps.md`)는 어느 라운드에서도 검토 스코프에 든 적이 없음 | `review/consistency/2026/08/24/*/meta.json` (target_path) | 향후 라운드에서 관련 트래커 문서도 target_path에 포함 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | LOW | plan 체크리스트 stale(3회차 미체크), 신설 spec 링크·라벨·키 목록은 코드와 전수 대조 일치 확인 |
| requirement | LOW | "정본 트래커" 문서 2곳(B1·B3)에 반증/폐기된 해소 근거가 취소선 없이 잔존, 라이브 spec 본문·코드 대조는 전부 일치 |
| scope | NONE | 스코프 정밀 통제 — `codebase/**` 0줄, spec 편집이 `spec_impact` 9건과 1:1 대응, B4는 오히려 won't-do로 스코프 축소 |

## 발견 없는 에이전트

없음(3개 에이전트 모두 최소 1건 이상의 발견 또는 검증 기록을 남김. scope는 위험도 NONE이나 INFO 1건 보고).

## 권장 조치사항
1. `plan/in-progress/spec-draft-planner-doc-batch.md:160`의 "3회차" 체크박스를 `[x]`로 갱신하고 결과 요약(BLOCK: NO, `17_04_25`) 추가.
2. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322`(B3)와 `:121`(B1)의 stale/반증된 "해소" 근거를 plan 파일과 동일한 관례(취소선 + 정정 주석)로 동기화.
3. (선택) `spec/5-system/6-websocket-protocol.md:541-542` 중복 빈 줄 정리.
4. (선택, 낮은 우선순위) provider 3문서의 동일 각주 triplication을 B6과 같은 링크-only 축약 대상으로 재검토.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유: prompt에 명시된 대로 router 미호출(모든 reviewer 강제 실행 없이 직접 지정). 전체 reviewer(documentation, requirement, scope) 실행 완료, 3명 모두 success + 전문 확보. skipped/forced 없음.