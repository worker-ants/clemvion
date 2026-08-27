# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, 전문 확보 완료)

## 전체 위험도
**LOW** — CRITICAL 없음. cross_spec 이 낸 WARNING 1건(R-5 W2 의 HTTP Request/Send Email 자격증명 서술이 그 노드들의 기존 spec 과 어긋남)이 최고 등급이며, 나머지는 리네임 스윕 완결 확인 등 INFO 성격.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | R-5 W2 서술("HTTP Request·Send Email 이 config 에 자격증명을 문자열 그대로 담아 `llmConfigId` 식 간접화가 필요하다")이 그 두 노드 타입 자신의 기존 spec 이 이미 규정한 credential-echo-금지 + `integrationId` 간접화 모델과 어긋남 — 향후 "두 노드에 간접화를 신규 도입해야 한다"는 오판 위험 | `spec/5-system/4-execution-engine.md` §Engine Raw Config Exposure 신규 블록쿼트(인용원: `spec/2-navigation/14-execution-history.md` R-5 W2) | `spec/4-nodes/4-integration/0-common.md` §6 표, `spec/4-nodes/4-integration/3-send-email.md` §1/§4.2, `spec/4-nodes/4-integration/1-http-request.md` §4 | R-5 W2 문단(및 이를 인용하는 4-execution-engine.md 문장)을 실제 위험 표면으로 좁힘 — 예: "HTTP Request 의 `authentication='custom'` 서브모드에서 사용자가 직접 입력한 헤더 값"으로 한정하거나 Send Email 을 예시에서 제거. 이미 존재하는 `integrationId` 간접화를 언급하고, 남는 위험(런타임 주입값의 크로스-노드 relay)을 config 자체와 구분해 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, naming_collision (중복) | 리네임된 용어("boundary masking parity")가 코드 주석에 잔존 — spec 은 "egress masking parity"로 전수 정정됐으나 이 JSDoc 인용만 미동기화 | `codebase/backend/src/modules/websocket/websocket.service.ts:448` | JSDoc 인용구를 "egress masking parity"로 동기화 (기능 변경 없음, 문서 동기화만). spec 외부 코드 주석이라 developer 가 즉시 고칠 수 있는 범위 |
| 2 | rationale_continuity | 원칙명 리네임("boundary masking parity"→"egress masking parity") 전수 스윕이 spec/ 기준 완결됨을 grep 실측 확인 (0건 잔존, 4건 신규 정착) | `spec/5-system/14-external-interaction-api.md:1530`, `spec/5-system/6-websocket-protocol.md:196` | 조치 불필요 — `plan/complete/**` 3건은 완료 스냅샷 관례상 의도적 잔존 |
| 3 | rationale_continuity | "config 저장 시점 마스킹 제거" 결정 번복이 취소선·날짜·재검증된 안전 근거(포함관계 캐너리)를 모두 갖춘 정본 요건 충족 사례임을 확인 | `spec/5-system/4-execution-engine.md` §Engine Raw Config Exposure, `handler-output.adapter.ts` 신규 주석 | 조치 불필요 |
| 4 | rationale_continuity | 직전 라운드(`19_26_06`)가 지적한 "레이어드 마스킹은 경쟁 않고 쌓인다" 원칙과의 프레이밍 충돌("중복 제거"→"예외를 원칙에 정렬"로 교정)이 이미 해소됨을 확인 | `handler-output.adapter.ts` 신규 주석, `spec/conventions/egress-masking.md` 신규 블록쿼트 | 조치 불필요 |
| 5 | convention_compliance | 신규 인용(`4-execution-engine.md`)이 동일 target(node-output.md Principle 7)을 인용하는 자매 문서(EIA, WS)와 달리 anchor-link 를 누락 — 다만 저장소 전체에 이미 혼재된 스타일(강제 규약 아님) | `spec/5-system/4-execution-engine.md` §Engine Raw Config Exposure 신규 블록 | anchor(`#principle-7--config-echo-원칙-nodehandleroutputconfig`) 추가로 동일 파일군 인용 스타일 통일 (선택) |
| 6 | convention_compliance | `execution-context.service.ts` 신규 JSDoc 이 명시한 새 불변식("`adapted.config` 는 이제 핸들러 반환 객체 그 자체 — mutate 시 캐시 오염 가능")이 `node-output.md` 의 기존 mutation-보호 단락(반대 방향인 `context.rawConfig` freeze 만 다룸)에는 미반영 | `spec/conventions/node-output.md` "`context.rawConfig` 의 mutation 보호" 단락 | 향후 node-output.md 개정 시 이 aliasing 계약 한 줄 추가 권장 (선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | R-5 W2 의 HTTP Request/Send Email 자격증명 서술이 그 노드 자신의 spec 과 어긋남(WARNING 1) + 코드 주석 용어 미동기화(INFO 1) |
| rationale_continuity | NONE | 원칙명 리네임 스윕 완결, 결정 번복 rationale 요건 충족, 직전 라운드 프레이밍 충돌 해소 — 전부 확인만(INFO 3) |
| convention_compliance | NONE | anchor-link 스타일 비일관(기존 혼재 연장), config aliasing 불변식의 문서 커버리지 gap — 둘 다 선택적 개선(INFO 2) |
| plan_coherence | NONE | 직전 라운드(`13_25_45`) BLOCK:YES 의 CRITICAL·WARNING 이 `6af73b2c8`로 완전 해소됨을 재확인, 후속 항목 누락·타 plan 충돌 없음 |
| naming_collision | NONE | 신규 엔티티·엔드포인트·이벤트·ENV·파일 도입 없음. 리네임 잔존 인용 1건만 INFO(cross_spec 과 중복) |

## 권장 조치사항
1. (선택, WARNING 해소) `spec/2-navigation/14-execution-history.md` R-5 W2 문단과 이를 인용하는 `spec/5-system/4-execution-engine.md` 문장을 정정 — "HTTP Request·Send Email 전체"가 아니라 "HTTP Request 의 `authentication='custom'` 서브모드 수동 헤더" 등 실제 위험 표면으로 좁히거나, 이미 존재하는 `integrationId` 간접화를 언급해 오독 위험 제거.
2. `codebase/backend/src/modules/websocket/websocket.service.ts:448` JSDoc 의 "boundary masking parity" 인용을 "egress masking parity"로 동기화 (기능 변경 없음).
3. (선택) `spec/5-system/4-execution-engine.md` 신규 Principle 7 인용에 anchor 추가.
4. (선택) `spec/conventions/node-output.md` mutation-보호 단락에 `adapted.config` aliasing 계약 한 줄 추가.