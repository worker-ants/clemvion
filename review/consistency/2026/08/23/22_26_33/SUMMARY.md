# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음. 전문 확보 못 한 checker 없음(전원 인라인 전문 확보).

## 전체 위험도
**LOW** — 실제 spec 모순·규약 위반·명명 충돌은 없음. WARNING 은 전부 "진행 중 작업(SSE allowlist 확장)이 spec 산문·JSDoc 요약표·트래커 항목보다 앞서 나가는" 동기화 지연 성격이며, planner 턴에서 §R17 갱신 시 함께 해소 가능한 수준.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | 리뷰 하네스(`_prompts/*.md`)가 컨텍스트 예산 초과로 target 이 참조하는 spec/conventions 본문(111개 파일, 및 target 직접 의존 conventions 12개)을 전량 생략 — target 자체의 결함 아니라 검토 프로세스 신뢰도 리스크. 양쪽 checker 모두 저장소 원본을 직접 Read/grep 으로 우회 대조해 이번 라운드 결론에는 영향 제한적이었음 | 해당 없음(하네스 산출물) | orchestrator 페이로드 조립 로직 | target 이 링크하는 spec/conventions 를 우선 적재하는 순서 정책 도입, 또는 절단 시 checker 가 고인용 파일을 자동 Read 하도록 프롬프트 의무화 |
| 2 | rationale_continuity | §R17 "allowlist 집합은 …" 서술이 "위젯 파서가 top-level 로 읽는 wire 키"로만 한정돼 있는데, 코드(`node-output-allowlist.ts`)는 이미 chat-channel(Discord/Telegram/Slack legacy flat shape) 소비처용 4키(`payload`·`title`·`rendered`·`nodeType`)를 별도 그룹으로 추가함. plan 의 planner-턴 체크리스트("§R17 표의 SSE 행 flip + 강도 서술 제거")가 이 구성 문장 갱신을 명시하지 않음 | `spec/5-system/14-external-interaction-api.md` §R17 "nodeOutput 일반 키 allowlist" 마지막 문단 | `codebase/backend/src/shared/utils/node-output-allowlist.ts` (실제 3그룹 배열) | planner 턴 작업 항목에 "allowlist 집합 구성 문장을 `위젯 파서` + `chat-channel 어댑터(legacy flat shape)` 두 그룹으로 갱신" 명시 추가, §R17 표의 SSE 행 근거 열도 함께 갱신 |
| 3 | rationale_continuity, convention_compliance | `node-output-allowlist.ts` 상단 JSDoc "그룹" 요약 표가 여전히 2그룹(`핸들러 계약 공개분`/`wire 전용`)만 나열, 실제 배열은 `wire 전용(위젯)`/`wire 전용(chat-channel)` 로 분리된 3그룹 — 이 파일 자신이 "이 목록은 타입에 결속돼 있다, 산문 주장이 아니다"라 명시해 표가 사실상 정본 열거로 기능하는데 그 표 자체가 배열보다 낡음 | `codebase/backend/src/shared/utils/node-output-allowlist.ts` 상단 JSDoc 표 | 같은 파일 하단 `NODE_OUTPUT_ALLOWED_KEYS` 배열 및 근거 SoT `spec/5-system/15-chat-channel.md` "shape 처리 우선순위" 절 | 표에 3번째 행(`wire 전용(chat-channel) | payload·title·rendered·nodeType | Discord/Telegram/Slack 렌더러 legacy flat shape, SoT: 15-chat-channel.md`) 추가 |
| 4 | plan_coherence | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 미해결 항목("wire-only 4키가 Principle 0 닫힌 레지스트리 밖")이 정확히 4키(`formConfig`·`conversationConfig`·`buttonConfig`·`interactionType`)만 열거하는데, 이번 SSE plan 완료 시 같은 wire-only 그룹이 8키로 늘어남. 두 plan 문서 간 상호 참조 없음 → 트래커 항목이 착수 시점부터 stale | `spec/5-system/14-external-interaction-api.md` §R17 하단 (실 소스: `node-output-allowlist.ts`) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (20_09_38 convention_compliance W3), `plan/in-progress/sse-nodeoutput-allowlist.md` | `sse-nodeoutput-allowlist.md` 작업 목록에 "트래커 W3 항목의 4→8키 갱신 또는 상호 참조 추가"를 넣거나 완료 후 정정 커밋을 남길 것. planner 가 Principle 0 각주 작성 시 이 시점 실제 wire-only 키 전량(8개) 재실측 |
| 5 | naming_collision | 신규 allowlist 키 `nodeOutput.nodeType`(카드 렌더 서브타입, 이번 작업으로 SSE/webhook 에도 명시 노출)이 같은 문서가 이미 "외부 소비 매핑 없음"으로 못박은 wire top-level `waitingNodeType`(=`node.type`)와 이름이 겹침. 런타임 키 충돌은 없으나(다른 객체) §R17 표만 보고 "nodeType 외부 노출 없음"으로 오독할 위험 | `spec/5-system/14-external-interaction-api.md` §R17 표(신규 4키 나열부), §6.2 wire 매핑 blockquote | §6.2 "`node.type` 은 외부 소비 매핑이 없다" 서술 | §6.2 blockquote 의 기존 disambiguation 관례를 따라 "`nodeOutput.nodeType`(외부 노출)은 wire top-level `waitingNodeType`(외부 비노출)과 다른 필드" 한 줄 추가 |
| 6 | naming_collision | 신규 allowlist 키 `nodeOutput.payload` 가 같은 문서 §6 이 SoT 로 정의하는 webhook 봉투 최상위 wrapper 키 `payload` 와 이름이 겹침 — webhook 채널에서는 `<envelope>.payload...nodeOutput.payload` 로 동일 키명이 서로 다른 두 레벨에 중첩. §6 은 이미 "webhook payload vs REST data" 혼동은 경계 지었으나 `nodeOutput.payload` 와의 3중 동명은 미언급 | `spec/5-system/14-external-interaction-api.md` §R17 표(신규 4키 나열부) | §6 "채널별 봉투" (webhook `payload` 래퍼 정의부) | §R17 표 또는 §6 blockquote 에 "`nodeOutput.payload` 는 §6 webhook 봉투 `payload` 와 동일 키명이지만 중첩 레벨이 다른 별개 필드" 한 줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 표본 검사(9건) 밖의 잔여 cross-file 인용(egress-masking.md 깊이 상한 세부, 7-channel-web-chat/2-sdk.md·4-security.md, conventions/redis-keys.md)은 이번 라운드에서 직접 대조 못함. 리스크는 낮게 평가되나 확정적 근거는 아님 | 해당 항목별 spec 문서 | 다음 라운드 또는 `--spec` 정밀 재검토 시 우선 대조 권장, Critical 근거로 쓰지 않음 |
| 2 | plan_coherence | 트래커의 "`node-output-allowlist.ts` 를 `shared/utils/` 밖으로 재배치" 항목이 "소비처가 둘이 되면(이번 SSE 작업) 그때 함께 정하라"고 명시했는데 `sse-nodeoutput-allowlist.md` 작업 목록에 반영(수행 또는 명시적 defer)이 없음 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (19_24_24 architecture INFO 1) | `sse-nodeoutput-allowlist.md`에 "재배치는 이번 라운드에 안 한다(사유)" 한 줄이라도 남길 것 |
| 3 | plan_coherence | (확인 사항, 결함 아님) SSE/fanout 잔여 항목에 대한 3개 문서(트래커·SSE plan·spec-draft-eia-62-waiting-payload.md) 간 cross-plan 참조는 이미 정합 — "§R17 표가 SoT" 단일 진실을 일관되게 가리킴 | 해당 3개 plan 문서 | 없음(정합 확인 기록) |
| 4 | naming_collision | (확인 사항) 신규 4키 중 `title`·`rendered` 는 문서 내 다른 의미로 쓰인 자리가 없어 동명 충돌 없음 | `spec/5-system/14-external-interaction-api.md` 전체(grep 확인) | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 9개 고위험 cross-file 인용(NodeHandlerOutput 5필드, EIA-RL-07↔engine 전이표, 에러코드 매핑, Execution.error 복사, CCH-AD-07 중복방지, webhook 봉투 통일, WS source 폴백, swagger discriminator, TOKEN_* 매핑, widget 3중 방어)을 저장소 원본과 직접 대조해 전부 정합 확인. 유일 WARNING 은 하네스 페이로드 절단(프로세스 이슈) |
| rationale_continuity | LOW | SSE/fanout allowlist 확장은 R17 이 스스로 예고한 계획된 후속 작업, 기각된 대안 재도입·invariant 우회 없음. R17 서술·JSDoc 표가 코드의 chat-channel 확장을 아직 못 따라감(WARNING 2건, 진행 중 성격) |
| convention_compliance | LOW | 실제 conventions 12개(node-output.md·egress-masking.md·swagger.md·error-codes.md·audit-actions.md 등) 직접 대조 결과 CRITICAL 급 위반 없음. 하네스 예산 문제(WARNING)와 JSDoc stale(WARNING, rationale_continuity #3과 동일 사안) |
| plan_coherence | LOW | SSE plan 과 정본 트래커(spec-sync-external-interaction-api-gaps.md)·인접 plan(spec-draft-eia-62-waiting-payload.md) 핵심 축은 정합. wire-only 그룹 확장(4→8키)이 트래커의 다른 미해결 항목과 상호 참조 없이 진행돼 drift 위험(WARNING), 재배치 판단 defer 미기록(INFO) |
| naming_collision | LOW | 신규 요구사항ID·엔티티·endpoint·env var 신규 도입 없음. 신규 allowlist 4키 중 `nodeType`·`payload` 2개가 같은 문서 내 다른 레벨의 동명 필드와 겹쳐 오독 위험(WARNING 2건, 런타임 충돌은 아님) |

## 권장 조치사항
1. **(BLOCK 해소 우선 — 해당 없음, BLOCK:NO)**
2. planner 턴에서 §R17 갱신 시 다음을 한 번에 반영: (a) "allowlist 집합" 구성 문장에 chat-channel 그룹 추가, (b) SSE 행 flip + "강도가 다르다" 서술 제거, (c) `nodeOutput.nodeType`/`nodeOutput.payload` 동명 필드 disambiguation 각주 2건 추가.
3. `node-output-allowlist.ts` JSDoc 상단 표를 실제 배열(3그룹)과 동기화(3번째 행 추가), SoT 로 `15-chat-channel.md` 인용.
4. `spec-sync-external-interaction-api-gaps.md` 의 W3("4키가 Principle 0 밖") 미해결 항목을 8키로 갱신하거나 SSE plan 과 상호 참조 추가.
5. `node-output-allowlist.ts` 재배치 판단을 이번 라운드에 defer 한다면 그 사유를 `sse-nodeoutput-allowlist.md`에 한 줄 기록.
6. (별도 트랙, 낮은 우선순위) consistency-check 하네스의 페이로드 조립 시 target 이 링크하는 conventions/spec 우선 적재 정책 검토.