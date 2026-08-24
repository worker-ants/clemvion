# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 2건 발견 (convention_compliance 1건, rationale_continuity 1건). 둘 다 planner(호출자) 권한 안에서 직접 정정 가능하므로 §planner 인계 대상 아님 — 착수 전 아래 조치를 target(`plan/in-progress/planner-doc-batch.md`) 자체에 반영할 것.

## 전체 위험도
**HIGH** — B1 을 문자 그대로 집행하면 재판정 기준 커밋(`99b9bd908`)에 이미 존재하는 각주를 중복 생성해 node-output.md 자신의 반-중복 규약을 위반하고, B1/B2/B4/B6 착수 전 확인해야 할 4개 conventions 문서의 `## Rationale` 이 이번 검토 어디에서도 읽히지 않았다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | B1 이 "언급 0건"이라 판정한 wire-only 키 각주가 target 이 스스로 지목한 재판정 기준 커밋(`99b9bd908`)에 **이미 존재**함(`node-output.md` line 31, `12_55_09` convention W2). target 자신의 B6 행("정본 1건 존재")과도 서로 모순. 그대로 집행하면 동일 각주가 중복 생성돼 node-output.md Principle 0 이 막 확립한 반-중복(단일 정본) 원칙을 정면 위반 | `plan/in-progress/planner-doc-batch.md` B1 행 + 체크리스트 `B1 Principle 0 — wire-only 키 각주` | `spec/conventions/node-output.md` Principle 0 각주(99b9bd908 신설) · target 자신의 B6 행 | B1 을 "신설"에서 "이미 존재 확인 — 취소선" 으로 전환하거나 제거. 남는 실질 차이(예: "8키" 구체 나열 누락)만 좁혀 재서술하고 B6 행과의 모순을 함께 해소. planner 착수 전 재판정 근거(grep 대상/범위)를 재현해 확인 |
| 2 | rationale_continuity | `spec_impact` 9건 중 4건(`node-output.md`·`egress-masking.md`·`chat-channel-adapter.md`·`conversation-thread.md`, 정확히 B1/B2/B6/B4 대상)의 `## Rationale` 이 이번 검토 payload 에서 placeholder 조차 없이 통째로 누락 — target 이 스스로 경계했던 `--spec` 예산 절단 실패모드가 실제로 재현됨. B1/B2/B4/B6 각각의 "기각된 대안 재도입 여부"를 이 검토가 확인하지 못한 상태 | `plan/in-progress/planner-doc-batch.md` frontmatter `spec_impact` 9건 전체 (특히 B1/B2/B4/B6 대상 4개 conventions 파일) | 위 4개 conventions 문서 자신의 `## Rationale` (내용 미확인) | B1/B2/B4/B6 착수 **직전** planner 가 4개 문서의 `## Rationale` 을 직접 Read 로 열어 기각된 대안·명시 invariant 유무 확인(특히 B6 은 과거 cafe24/makeshop mirror dedup 철회 선례와 형태가 유사할 수 있어 우선순위 높음). 가능하면 `--spec` 번들러가 `spec_impact` 파일을 예산 절단에서 우선 제외하도록 개선 검토 |

## planner 인계 (권한 밖 Critical)

(없음) — 위 두 Critical 모두 target 을 다루는 주체(planner)의 권한 안에서 직접 정정 가능하다. `plan/in-progress/planner-doc-batch.md` 자체가 이미 planner 소관 문서 정합화 작업이므로 developer-턴 spec drift 같은 권한 밖 상황이 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | B4 remediation target(`websocket.service.ts`)이 `code:` 소유권 시맨틱과 어긋남 — 이 파일은 conversation-thread 도메인 로직이 전무한 passthrough 이고, 실제로 로직을 갖는 `execution-engine`/`ai-turn-orchestrator`/`form-interaction`/`button-interaction` 4개 서비스가 `code:` 에서 빠져 있음 | `plan/in-progress/planner-doc-batch.md` B4 행 + 체크리스트 | `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` 정의) · 위 4개 execution-engine 파일 (실측) | B4 범위를 "websocket.service.ts 1건 추가"에서 "conversation-thread 도메인 로직을 실제로 갖는 파일 전수 재조사"로 확대. 최소 4개 execution-engine 파일 포함 여부 판정 |
| 2 | rationale_continuity | B6 "사본 4곳→정본 링크" 통합이 이 저장소가 과거 철회한 cafe24/makeshop mirror dedup 판단과 같은 형태일 위험 — 근거 문서(chat-channel-adapter.md Rationale) 미확인 상태로 실행하면 오탐/재발 소지 | `plan/in-progress/planner-doc-batch.md` B6 행 + 체크리스트 | `spec/conventions/chat-channel-adapter.md` `## Rationale` (미확인) · `project_cafe24_makeshop_mirror_dedup_withdrawn` 선례 | B6 착수 시 사본 4곳 각각 원 커밋 사유를 `git log -S` 로 역추적, chat-channel-adapter.md Rationale 에 "재진술 필수" 근거가 있는지 확인 후 통합 여부 결정 |
| 3 | convention_compliance | B6 "사본 4곳" 잔존 개수가 과소 산정됨 — 실제로는 WS §4.1-a 한 곳만 node-output.md 를 링크하고, EIA §R17·conversation-thread §9.7 두 곳은 여전히 자체 산문으로 중복 서술 중(chat-channel-adapter §1.3 외 2곳 추가 잔존) | `plan/in-progress/planner-doc-batch.md` B6 행("정본 1건 존재") | `spec/5-system/14-external-interaction-api.md` §R17 · `spec/conventions/conversation-thread.md` §9.7 (링크 없음, 실측) | B6 범위를 "실제 미전환 3곳(EIA §R17·conversation-thread §9.7·chat-channel-adapter §1.3)"으로 재산정하고 각각에 node-output.md Principle 0 앵커 링크 추가 후 중복 산문 축약. WS §4.1-a 는 이미 링크됨 — 손대지 않음 |
| 4 | naming_collision | `nodeType` 이 envelope-level(`payload.nodeType`, 판별자 래퍼 금지 규칙)과 `nodeOutput.nodeType`(wire-only carve-out) 두 계층에서 같은 이름으로 쓰여, WS §4.4 "판별자 래퍼는 두지 않는다" 규칙과 표면 충돌로 오독될 위험 | `plan/in-progress/planner-doc-batch.md` B3 체크리스트("WS §4.4 nodeType carve-out 각주") | `spec/5-system/6-websocket-protocol.md:503` (Principle 1.1.4) · `node-output-allowlist.ts:78-83` · `spec/5-system/14-external-interaction-api.md:1826` | B3 각주에 "동일 이름·다른 계층"임을 명시하고 EIA §R17·node-output.md Principle 0 wire-only 각주(B1 산출물)·chat-channel-adapter.md §(c) 로 3중 교차 참조 |
| 5 | naming_collision | B7 판정 범위가 provider 표의 `template` 행에만 좁혀지면, 같은 표의 `chart`/`carousel`/`table` 행은 여전히 얕은 `output.X` 표기로 남아 같은 표 안에서 `output.X` 표기 깊이가 행마다 달라지는 새 불일치를 만들 위험 | `plan/in-progress/planner-doc-batch.md` "B7 은 판정한다" 절 | `telegram.md:160`·`slack.md:233`·`discord.md:256` 매트릭스 표 (chart/carousel/table 행, 실측) · renderer `extractRendered`/`normalizePresentationNodeOutput` | B7 판정을 표의 4행(chart/carousel/table/template) 전체에 동일 논리로 적용하거나, 표 상단에 "output.X 는 렌더러 진입점에 따라 실제 경로가 달라지는 일반화 표기" 각주를 1회 추가해 4행 전체를 커버 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | B5(`background:run:{id}` 채널 표 추가)는 `background.md` Rationale(WebSocket 채널 격리 결정)과 정합 | `plan/in-progress/planner-doc-batch.md` B5 행 | 조치 불요 |
| 2 | rationale_continuity | B7(provider 3곳 `output.rendered` 판정)은 WS §4.4 wire caveat "판정은 문장 주어에 따라 갈린다" 원칙과 정합 | `plan/in-progress/planner-doc-batch.md` "B7 은 판정한다" 절 | 정정 결과가 wire 기준이면 WS §4.4 의 caveat+오너십 분리 패턴을 provider 문서에도 적용 검토 |
| 3 | convention_compliance | 재판정 방법론(grep 기반 "언급 N건")의 검색어·범위를 target 에 남기면 사후 재현이 쉬움 — B1 반증 원인이 바로 이 재현 불가능성 | `plan/in-progress/planner-doc-batch.md` §"항목" 표 전체 | 각 B 항목에 사용한 검색어·범위를 각주로 남기거나 착수 직전 `git log -1` 로 파일 변경 여부 재확인 절차 추가 |
| 4 | plan_coherence | `egress-masking.md` §2 편집 시 바로 아래(line 77) `ws-event-types-extract.md` 를 참조하는 미해결 캐비엇 문단을 실수로 "확인됨" 처리하지 않도록 주의 | `plan/in-progress/planner-doc-batch.md` B2 행 | B2 는 line 68-75(파이프라인 순서)만 갱신, line 77 캐비엇은 `ws-event-types-extract.md` 해당 항목이 닫히기 전까지 유지 |
| 5 | plan_coherence | `node-output-redesign/*` 26개 파일이 예산 절단으로 프롬프트에서 생략됐으나, 직접 조회 결과 README 가 "conventions 자체는 변경하지 않는다"고 명시해 B1 과 충돌 없음을 확인 | `plan/in-progress/planner-doc-batch.md` frontmatter `spec_impact: spec/conventions/node-output.md` | 조치 불요 — 참고 기록. 이후 유사 배치에서 스코프 문서를 직접 인용하는 plan 파일은 우선 적재 권장 |
| 6 | naming_collision | `spec/5-system/6-websocket-protocol.md` 안에 `### 4.4` 헤딩이 두 번 존재(line 446, 815), 절 번호 순서도 어긋남 — target 원인 아닌 pre-existing 결함 | `spec/5-system/6-websocket-protocol.md` | 이번 PR 책임 아님. 향후 이 절을 열 때 번호 재정리 권장 |
| 7 | naming_collision | B5 택일 판정 대상 두 문서(WS §3.2/3.3 curly-brace `{id}` vs redis-keys.md/background.md §8.5 angle-bracket `<id>`)의 플레이스홀더 표기 스타일이 다름 | `plan/in-progress/planner-doc-batch.md` B5 행 | 최종 판단은 planner 몫이나, 어느 쪽을 택하든 목적지 문서의 기존 브래킷 컨벤션 유지 |
| 8 | naming_collision | B1 "wire-only" 용어는 EIA §R17·`node-output-allowlist.ts` JSDoc 에 이미 정착된 taxonomy 재사용 — 신규 용어 아님 | `plan/in-progress/planner-doc-batch.md` B1 행 | 각주 문구에 동일 그룹 레이블("wire 전용 (위젯 파서)"/"wire 전용 (chat-channel 렌더러)")을 그대로 재사용, 세 번째 표현의 사본 생성 방지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | B1~B7 재판정 수치 대부분 정확히 대조 검증됨. B4 remediation target 오류만 WARNING |
| rationale_continuity | MEDIUM | B1/B2/B4/B6 대상 4개 conventions 문서 Rationale 이 payload 에서 통째로 누락(CRITICAL). B6 mirror dedup 재발 위험(WARNING). B3/B5/B7 은 기존 Rationale 과 정합 |
| convention_compliance | HIGH | B1 이 이미 존재하는 각주를 "0건"으로 오판, 집행 시 중복 생성(CRITICAL). B6 잔존 사본 개수 과소산정(WARNING) |
| plan_coherence | LOW | B1~B7 이 소스 트래커(spec-sync-external-interaction-api-gaps.md 등)와 문장 단위로 정확히 대응, 인접 in-progress plan 과 충돌 없음. egress-masking §2 인접 캐비엇 보존 주의만 INFO |
| naming_collision | MEDIUM | 신규 식별자 도입은 없으나 B3(`nodeType` 동일이름·다른계층)·B7(표 안 `output.X` 표기 깊이 불일치 위험) 범위를 좁게 잡으면 새 불일치를 만들 위험(WARNING 2건) |

## 권장 조치사항
1. (BLOCK 해소) B1 을 재판정 — `node-output.md` Principle 0 각주가 `99b9bd908`(target 이 지목한 그 기준 커밋)에 이미 존재함을 확인하고, target 표/체크리스트에서 B1 을 "이미 존재 — 취소선" 으로 전환하거나 제거해 B6 행과의 자기모순을 해소한다.
2. (BLOCK 해소) B1/B2/B4/B6 착수 직전 `spec/conventions/{node-output,egress-masking,chat-channel-adapter,conversation-thread}.md` 4개 문서의 `## Rationale` 을 직접 Read 로 열어 기각된 대안 재도입 여부를 확인한다. 특히 B6 은 cafe24/makeshop mirror dedup 철회 선례와의 유사성부터 검토한다.
3. B6 범위를 "사본 4곳"에서 "실제 미전환 3곳(EIA §R17·conversation-thread §9.7·chat-channel-adapter §1.3)"으로 재산정하고, 각 위치에 node-output.md Principle 0 앵커 링크를 추가한다.
4. B4 remediation target 을 `websocket.service.ts` 단일 파일에서 conversation-thread 도메인 로직을 실제로 갖는 execution-engine 계열 4개 파일 전수 재조사로 확대한다.
5. B3 각주 작성 시 `nodeType` 이 envelope-level 판별자와 wire-only carve-out 두 계층에서 동일 이름으로 쓰인다는 점을 명시하고 3중 교차 참조를 단다.
6. B7 판정을 provider 표의 `template` 행에만 국한하지 말고 `chart`/`carousel`/`table` 행까지 동일 논리로 확대하거나 표 상단 일반화 각주로 4행을 함께 커버한다.
7. B5 최종 판단 시 목적지 문서(WS §3.2 curly-brace vs redis-keys.md angle-bracket)의 기존 플레이스홀더 컨벤션을 유지한다.