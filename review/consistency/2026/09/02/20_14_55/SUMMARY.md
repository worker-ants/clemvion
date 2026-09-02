# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원이 전문을 확보했고(재시도 필요 항목 없음), CRITICAL 급 발견은 없다.

## 전체 위험도
**LOW** — Cross-Spec/Naming Collision 은 NONE, Rationale Continuity/Convention Compliance/Plan Coherence 가 각각 WARNING 을 냈으나 전부 "결정 자체는 타당하나 근거·지시문의 정착 위치·표현이 모호"한 서술 리스크에 그친다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | 결정① (WS spec `implemented` 승격) 의 근거 — "잔존 `_(계획·미구현)_` 배지는 승격을 막지 않는다" 는 선례 실측 논증이 plan 문서 본문에만 남고, 대상 spec(`6-websocket-protocol.md`) 자신의 `## Rationale` 에 정착시킬 표 항목이 없다 | `## 결정 ①` 전체, 변경안 표 `#7`·`#9` (`6-websocket-protocol.md:1101`, Rationale 추가) | `spec/3-workflow-editor/3-execution.md` 의 "partial 강등 → implemented 복귀" Rationale 서브섹션(동형 선례가 이미 명문화되어 있음) | 표 `#7`/`#9` 또는 신설 서브섹션에 3-execution.md 와 동형 구조로 "잔여 미구현 배지는 본 문서 추적 대상(`pending_plans`) 이 아니라 [3-execution.md §6 로드맵] 소유처 미러링" 을 명문화 |
| 2 | Rationale Continuity | 결정② (`§10.4` 위임 한 줄 추가) 가 `#1265` 의 "안 고침" 결정을 정당하게 번복하지만, draft 자신이 이미 쓴 "왜 복제 대신 위임인가" 논증이 `api-convention.md` 자신의 `## Rationale` 에는 정착되지 않는다 | `## 결정 ②` 전체, 변경안 표 `#10` (`2-api-convention.md §10.4`) | 커밋 `6ffadb1f4`(`#1265`) 의 "§10.4 안 고침" 근거, `api-convention.md` 의 기존 Rationale 4항목 패턴 | 변경안 표에 `api-convention.md` `## Rationale` 신설 항목 1줄 추가(`#1265`→`#1266` 전제 갱신 요약), draft 본문 문단을 그대로 이식 |
| 3 | Convention Compliance | `ws-token-expired-socket-lifetime-impl.md` 에 열린 planner 트랙 항목이 `:94`(배지 flip)·`:121`(§10.4) **둘**인데, 처리 지시가 "이 planner 항목 [x]" 로 **단수** 표현되어 있어 한쪽만 체크되고 다른 쪽이 실제로는 해소됐는데도 `[ ]` 로 남을 위험 | 변경안 표 `#14` 행 | `.claude/docs/plan-lifecycle.md §5` "plan 체크박스 = 실제 상태" 원칙 | `#14` 행을 "두 planner 항목 `:94`(배지 flip)·`:121`(§10.4) 모두 `[x]`" 로 복수화 |
| 4 | Convention Compliance | 변경안 헤더 "spec 8곳 · plan 9곳 전수" 가 실제 표 행수(spec `#1~#10`=10행, plan `#11~#16`=6행)와 어긋남 — 자매 문서(`spec-draft-ws-wontdo-maintenance-appping.md`)가 동일 결함 클래스를 이미 한 번 자체 발견·정정한 전례가 있어 반복 위험 신호 | `## 변경안 — spec 8곳 · plan 9곳 전수` 헤더 | 표 자체의 실제 행 수 | 커밋 전 표 행을 재계산해 숫자를 맞추거나, 숫자 대신 "spec 전수 · plan 전수" 로 서술해 드리프트 표면 제거 |
| 5 | Plan Coherence | 변경안 표 row 7·8 이 `:1101`·`:1133`(`spec-sync-websocket-protocol-gaps.md` 경로 문자열)을 "원문 보존" 으로 명시하는데, 이 3개 plan 이 `plan/complete/` 로 이동하면 그 경로는 더 이상 유효하지 않음 — target 이 row 16 에서 같은 §3 을 다른 방향으로 이미 인용하고 있어 두 row 간 우선순위가 target 안에서 명시적으로 풀리지 않음 | 변경안 표 row 7(`:1101`), row 8(`:1115`·`:1133`) | `.claude/docs/plan-lifecycle.md §3` "살아있는 문서(`spec/`)의 plan 링크는 이동과 동시에 갱신" | row 7·8 의 "승격 후속 주석"/"처분 완료 포인터" 에 새 경로(`plan/complete/spec-sync-websocket-protocol-gaps.md`)를 명시적으로 병기 — 원문은 역사 기록으로 보존, 옆의 신규 annotation 이 갱신된 포인터 역할 |

> 참고: #1(Rationale 정착)과 #5(경로 갱신)는 같은 위치(row 7, `:1101` 부근)를 가리키지만 서로
> 다른 요구(근거 문장의 존재 vs 참조 경로의 최신성)이므로 통합하지 않고 별도 항목으로 유지했다.
> 실행 시 한 번의 편집으로 두 요구를 함께 충족시킬 수 있다.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | "체크리스트 채움" 지시가 체크박스 없는 문서(`spec-draft-ws-wontdo-maintenance-appping.md`, 번호 매김 표 형식)를 가리켜 다음 실행자가 "없는 체크박스를 채우라"로 오독할 수 있음 | 변경안 표 `#12` | "체크리스트 채움" → "완료 확인 노트 추가"로 표현을 좁힌다 |
| 2 | Plan Coherence | target 이 `6-websocket-protocol.md` 상단부(`:28`,`:52`)를 다시 쓰면서 생기는 순증감 줄 수가, 다른 plan(`spec-update-node-cancellation-shutdown-classification.md:363,476`)이 하드코딩한 `:186`·`:375` 인용을 stale 하게 만들 수 있음 (target 범위 밖, 차단 사유 아님) | 변경안 표 row 2·3 | 실행 후 `grep -n "6-websocket-protocol.md:186\|6-websocket-protocol.md:375"` 로 두 인용이 여전히 맞는 절을 가리키는지 확인 |
| 3 | Naming Collision | `R-ws-socket-lifetime-binds-token`, `auth.token_expired`, `§10.4` 는 모두 target 이전에 이미 정의된 식별자이며 신규 발급이 아님 — `grep -rn` 전수 확인, 이름-유사 혼동(REST `TOKEN_EXPIRED` / DB `status_reason='token_expired'`)도 spec 본문이 이미 "별개 네임스페이스"로 명문화 | 전체 | 재조치 불요 (확인용 기록) |
| 4 | Naming Collision | plan 파일 3건의 `complete/` 이동 — `find plan/complete -iname` 결과 동일 파일명 0건, 경로 충돌 없음 | 변경안 plan 이동 항목 | 재조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 절단됐던 `6-websocket-protocol.md` 원문을 직접 대조. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 충돌 없음 |
| Rationale Continuity | LOW | 결정①·② 모두 근거는 견고(실측 일치)하나, 그 근거가 대상 spec 자신의 `## Rationale` 에 정착할 표 항목이 없음 (WARNING ×2) |
| Convention Compliance | LOW | 인용 수치·frontmatter·체크박스 상태는 전부 정확. "이 planner 항목" 단수 표현(WARNING), 헤더 카운트 드리프트(WARNING), "체크리스트 채움" 모호(INFO) |
| Plan Coherence | LOW | 핵심 전제(#1266 머지, 승격 가드, 선례) 전부 실측 확인. "원문 보존" 지시와 plan-lifecycle §3 "인입참조 동시 갱신" 사이 우선순위 미명시(WARNING) |
| Naming Collision | NONE | 신규 식별자 없음 — 기존 ID/이벤트명 재사용과 plan 파일 이동뿐, 경로·이름 충돌 없음 |

## 권장 조치사항
1. (WARNING #1·#5 동시 해소) 변경안 표 row 7(`:1101` 인근)에 (a) 3-execution.md 동형 Rationale 명문화 + (b) 새 경로(`plan/complete/spec-sync-websocket-protocol-gaps.md`) 병기를 함께 추가.
2. (WARNING #2) 변경안 표에 `api-convention.md` `## Rationale` 신설 항목 1줄 추가 — draft 자신의 "왜 위임인가" 문단을 이식.
3. (WARNING #3) `ws-token-expired-socket-lifetime-impl.md` 변경안 `#14` 행을 "두 planner 항목(:94·:121) 모두 [x]" 로 복수화.
4. (WARNING #4) "spec 8곳 · plan 9곳" 헤더 숫자를 실제 표 행수로 재계산하거나 "전수" 표현으로 대체.
5. (INFO #1) "체크리스트 채움" 표현을 "완료 확인 노트 추가"로 구체화.
6. (INFO #2) 실행 후 `6-websocket-protocol.md:186`·`:375` 를 인용하는 타 plan 의 줄 번호가 여전히 유효한지 `grep -n` 확인.