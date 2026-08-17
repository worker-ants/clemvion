# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 CRITICAL 없음으로 보고. 전문 확보 못 한 checker 없음(5/5 인라인 전문 확보, `naming_collision.md` 는 파일 부재를 확인해 인라인 전문을 그대로 영속화 — Write 성공).

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건은 모두 이전 라운드부터 이월된 기지(旣知) 항목(§R17 whack-a-mole 논거 미명기, Swagger DTO description 길이 규약 초과)이며 신규 결함 아님.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | webhook ingestion-마스킹 Rationale 의 "whack-a-mole 원천 차단" 논거(2026-07-07)가 EIA §R17 egress 마스킹에서 이름 붙여 반박되지 않음. 이 브랜치 자체에서 whack-a-mole 패턴(inputData 노드레벨 카브아웃 오확대 → `83436ed45` 되돌림 → `09286d542` 5곳 재동기화)이 재관측되어 우려 유효성 재확인됨. `01_17_49` 라운드 이후 2커밋 더 지나도록 미해소, 4~5라운드 연속 이월 | `spec/5-system/14-external-interaction-api.md` §R17 "언제 가리는가" 절 (라인 1601-1612 부근) | `spec/5-system/12-webhook.md` `## Rationale` "민감 헤더 마스킹 — ingestion 시점 채택(2026-07-07)" (b) whack-a-mole 논거 | §R17 "언제 가리는가" 절에 "표면 발견 자체는 반복되지만, 마스킹은 산발적 호출부 패치가 아니라 소수 공유 관문(`toResponseExecution`/`emitExecutionEvent`/`emitNodeEvent`/`toTerminalErrorPayload`)으로 수렴시켜 새 경로가 관문만 통과하면 마스킹을 구조적으로 상속한다"는 반박 문장 1개 추가 |
| 2 | Convention Compliance | Swagger DTO `description`/JSDoc 이 규약 `spec/conventions/swagger.md` §3 "10~40자 내외"를 크게 초과. 이번 PR 최종 커밋(`09286d542`)이 신규 필드(`NodeExecutionSummaryDto.inputData`, 13줄)를 같은 스타일로 추가해 괴리를 더 키움. 저장소 전역 기존 관행(9개+ DTO)과 동일 패턴이나, `01_17_49` 라운드가 이미 지적했음에도 2라운드 연속 미해결 | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (`ExecutionDto.inputData`/`outputData` 7~9줄, `NodeExecutionSummaryDto.inputData` 13줄 신설, `.output`/`.error` 4~7줄) · `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (`BackgroundRunNodeExecutionDto.inputData`/`outputData` 200~400자) | `spec/conventions/swagger.md` §3 "DTO description 은 10~40자 내외" | 택일: (a) `swagger.md §3` 을 "보안/정책 민감 필드는 요약 1문장+spec 링크, 상세 근거는 spec 본문" 으로 갱신해 기정 관행(9곳+) 을 규약화, 또는 (b) 신규·수정 필드 5곳의 description 을 1~2문장 요약 + `[EIA §R17]` 류 링크로 축약하고 상세는 spec 본문(§R17·13-replay-rerun §10.2·1-data-model §2.13/§2.14)에만 유지. 2라운드 연속 미결이므로 이번 PR 내 결정 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `boundary masking parity` 원칙 인용의 원 출처 표기가 한 홉 생략(WS 문서가 "EIA §R17 의" 원칙으로 인용하나 원 출처는 `2-navigation/14-execution-history.md` R-5) — 결론은 매 단계 타당해 실질 오류 아님 | `spec/5-system/6-websocket-protocol.md` 라인 195 | WS §4.1 캐비엇에 "(원 출처 [실행 내역 R-5](../2-navigation/14-execution-history.md#r-5))" 한 홉 추가 |
| 2 | Convention Compliance | WS 이벤트 카탈로그 표(§4.1)가 blockquote 로 중간 절단되는 기존 렌더링 결함이 이번 PR 누적 삽입으로 23→25줄로 더 커짐. origin/main 부터 존재했던 결함의 증폭이며 정식 규약 위반은 아님 | `spec/5-system/6-websocket-protocol.md` §4.1 표, `execution.node.cancelled`(190줄)~`execution.waiting_for_input`(216줄) 사이 191~215줄 | blockquote 를 표 완결 이후로 이동하거나 `### 4.1.1 값-패턴 마스킹` 하위 섹션으로 분리(`13-replay-rerun.md §10.2` 패턴 참고). 이 PR 을 이 항목만으로 막을 근거 없음 |
| 3 | Plan Coherence | target 이 트래커의 미해결 "결정 항목" 4건(workflow-assistant 마스킹 강도·`SECRET_LEAK_PATTERNS` bare `token=`·연결문자열/스택 패턴 확장·`kb:`/`background:run:` 채널 마스킹)을 하나도 선점하지 않고 범위 밖으로 정확히 유지 | `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ③" | 조치 불요 — 정합 확인 기록 |
| 4 | Plan Coherence | `ie-resume-turn-boundary-cancel.md` 가 target 변경(WS §4.1 값-패턴 마스킹 초크포인트)을 이미 선반영해 자기 후속 항목(USER_MESSAGE 마스킹 비대칭)을 2026-08-17 각주로 해소 처리해 둠 | `plan/in-progress/ie-resume-turn-boundary-cancel.md:391-405` | 조치 불요 |
| 5 | Plan Coherence | `spec-draft-eia-62-waiting-payload.md` 의 미집행 "선택" 인계 항목(strip 깊이 강화 addendum)이 target 이 같은 Rationale 불릿 뒤에 새 문단을 삽입해 놓은 것과 삽입 위치가 달라짐 — 충돌은 아니나 향후 집행 시 위치 재확인 필요 | `spec/5-system/6-websocket-protocol.md` `## Rationale` "기각된 대안" 불릿 직후 | 다음에 그 선택 항목을 집행할 때 target 커밋 이후 Rationale 블록 구조를 다시 읽고 삽입 (선택사항, 비차단) |
| 6 | Naming Collision | 동일 리터럴 `'***'`(`VALUE_MASK_MARKER`, 이번 신설)을 `value-masking.util.ts`·`error-codes.ts`·`auth-configs.service.ts` 등 기존 서브시스템이 각자 독립적으로 사용 — 식별자 이름은 달라 충돌 아니며 target 범위 밖 | `codebase/backend/src/modules/**` 다수 | 현 시점 조치 불요, 향후 마스킹 계층 증가 시 상수 수렴 검토 여지만 기록 |
| 7 | Cross-Spec | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:301-302` 의 "이번엔 Output 탭만 반영" 서술이 브랜치 중간 커밋(`b05756d9e`) 시점 텍스트로, 최종 커밋(`09286d542`)에서 Input 탭도 갱신되어 backstory 문장만 stale — `spec/**` 파일 아니므로 cross-spec 발견사항 아닌 참고 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:301-302` | plan_coherence 관점 후속(급하지 않음) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec/** 간 CRITICAL/WARNING 급 모순 없음. "표면 여섯·컬럼 둘" SoT 단일화, `Execution`/`NodeExecution` 레벨 카브아웃, ingestion/egress 레이어 분리, `nodeLabel` 정정, `llmCalls` wire 예외 5축 모두 문서-문서·문서-코드 정합 확인 |
| Rationale Continuity | LOW | 신규 CRITICAL 없음. WARNING 1건(whack-a-mole 논거 미명기, 4~5라운드 이월) + INFO 1건(원 출처 한 홉 생략) 재확인. 그 외 레벨 축 재정리·config raw-echo 관계·R-5 parity 원용·nodeLabel 정정은 전부 과거 결정을 명시 인용하며 진행 |
| Convention Compliance | LOW | 정식 규약 직접 위반(CRITICAL) 없음. WARNING 1건(Swagger DTO description 10~40자 규약 초과, 2라운드 이월) + INFO 2건(WS 표 blockquote 절단 증폭, 명명/상호참조 일관 확인) |
| Plan Coherence | NONE | target 이 자기-참조 plan(`eia-fanout-and-internal-data-masking.md`) + 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)와 정합. 미해결 결정 항목 4건 모두 비선점. INFO 3건(결정 항목 미선점 확인·자매 plan 선반영·Rationale 삽입 위치 시퀀싱 메모) |
| Naming Collision | NONE | 신규 식별자(함수·상수·필드) 전수 대조 결과 충돌 없음. `nodeLabel` 은 신규 도입 아닌 기존 이름과의 정합화. ID/endpoint/이벤트명/env var/파일 경로 신설 0건. INFO 1건(`'***'` 리터럴 독립 다중 사용, 범위 밖) |

## 권장 조치사항
1. (WARNING 해소 권장, 비차단) `spec/5-system/14-external-interaction-api.md` §R17 "언제 가리는가" 절에 whack-a-mole 반박 문장 1개 추가 — "표면 발견은 반복돼도 마스킹은 소수 공유 관문으로 수렴해 구조적으로 상속된다"는 취지. 4~5라운드 연속 이월된 유일한 named-argument 갭.
2. (WARNING 해소 권장, 비차단) `spec/conventions/swagger.md §3` 갱신(관행 9곳+ 을 규약화) 또는 신규·수정 DTO 필드 5곳의 description 을 요약+링크로 축약하는 것 중 택일 결정 — 2라운드 연속 미결.
3. (선택, 비차단) WS §4.1 표의 blockquote 절단 렌더링 결함을 표 완결 이후로 이동 — 누적 증폭 추세만 기록됐으므로 이번 PR 을 막을 근거는 없음.
4. (선택, 비차단) WS §4.1 boundary masking parity 캐비엇에 원 출처(`2-navigation/14-execution-history.md#r-5`) 링크 한 홉 추가.