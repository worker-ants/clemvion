# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**LOW** — 4개 checker 가 LOW, 1개(naming_collision)가 NONE. WARNING 2건은 모두 "실제 spec 편집 실행 단계"에서 반영해야 할 구체적 주의사항이며, target(plan draft) 자체의 결정·구조를 뒤집을 사유는 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | "§5 선례 3건도 같은 한계에서 같은 판단을 내렸다"는 서술이, 실제 커밋(`27f390700` PR4b·`47282085b` #566)과 `error-codes.md §5` 표 비고에는 없는 근거("제3자 잔여위험을 인지하고도 수용")를 과거 결정에 소급 부여. 과거 3건의 실제 근거는 "자사 코드 grep 으로 하드코딩 분기 없음 확인"뿐이었음 | "이것은 규약의 명시적 예외다 — 근거를 실측했다" 절, "남는 위험을 숨기지 않는다" 콜아웃 | `error-codes.md §5` Rename 이력 표 3행 + 커밋 `27f390700`·`47282085b` | 해당 문장을 "선례가 이미 그렇게 판단했다"가 아니라 target 자신의 새 판단(선례보다 한 단계 엄격)으로 톤 낮춰 서술. `error-codes.md §5` 신규 행 비고에 "제3자 잔여위험을 최초로 명시 인수한 사례"임을 남겨 실제로 재사용 가능한 선례로 만들 것 |
| 2 | convention_compliance | `error-codes.md §4` 표는 본문·열 헤더로 "Code 노드 핸들러 내부 분류"·"정규화 → public 코드 (노드 `output.error.code`)"로 scope 를 명시 선언하는데, 여기에 trigger-parameter reason 코드(별도 파이프라인 `toTriggerParameterErrorDetails`, 목적지는 `output.error.code` 가 아니라 `details[].code`)를 단순 추가하면 표 자신의 scope 선언과 충돌 | "같은 절의 spec 편집 3건" 세 번째 불릿(line 136-138), "동반 개정 표면" 표의 `conventions/error-codes.md` 행 | `error-codes.md §4` 상단 scope 문장 + 표 두 번째 열 헤더 | 실제 spec 편집 시 §4 를 "§4.1 Code 노드 내부 분류"/"§4.2 trigger-parameter 내부 분류"로 분리하거나, scope 문구·열 헤더를 두 파이프라인 포괄하도록 일반화한 뒤 행 추가. target 체크리스트에 이 결정을 명시적으로 적어 실행자가 단순 append 로 처리하지 않게 할 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §8.1 표에서 unify 후 코드가 형제 `RERUN_*` prefix 패턴과 계속 어긋남(기존에도 존재하던 이탈이나, 값 자체가 바뀌는 이 시점에 설명이 없으면 재질문 유발 가능) | `13-replay-rerun.md §8.1` 표 (246행) | 표 각주 또는 인접 Rationale 에 "Manual 실행/저장 경로와 코드를 공유하기 위해 의도적으로 `RERUN_` prefix 미사용" 한 줄 추가 |
| 2 | cross_spec | `data-flow/10-triggers.md`(47,57행)·`data-flow/11-workflow.md`(45행)는 re-run 경로를 언급하지 않아 통일 후에도 낡아 보일 여지(거짓은 아님) | target spec_impact 밖 | 필수 아님, 현행 유지 가능 |
| 3 | rationale_continuity | `POST /executions/:id/re-run`을 "인증된 공개 API"로 서술한 것이 `14-external-interaction-api.md` Rationale R11(내부 API=워크스페이스 JWT·에디터 UI 전용 vs `/api/external/*` 진짜 공개 표면 분리)의 용어와 긴장 | "남는 위험을 숨기지 않는다" 콜아웃 | "워크스페이스 JWT 만 있으면 공식 UI 밖에서도 호출 가능한 API" 식으로, R11 분류와 모순되지 않게 표현만 다듬기(결정 자체는 유지) |
| 4 | convention_compliance | `spec-impl-evidence` "R-1" 인용이 실제 규칙 소재(§4 `spec-code-paths.test.ts`)와 다름 — R-1 은 글로브 허용 배경(Rationale)일 뿐 "≥1 매치" 규칙의 선언 위치가 아님. 동일 유형(절 번호 인용 오류)이 이 프로젝트에서 재발 이력 있어 재발 방지 가치 있음 | "같은 절의 spec 편집 3건" 첫 불릿(line 133) | 실제 spec/plan 편집 시 "R-1" 대신 "§4 `spec-code-paths.test.ts`"로 정정 |
| 5 | convention_compliance | `error-codes.md §5` 진입 조건 "소비자가 자사 클라이언트뿐"이 이번 케이스(공개 API, 제3자 분기 가능성을 코드로 배제 불가)엔 문면대로 완전히 충족되지 않음 — target 은 이미 투명하게 인지·서술했으나 향후 §5 표가 "아무 공개 API 든 안전"으로 과잉 일반화될 위험 | "이것은 규약의 명시적 예외다" 절 전체 | `error-codes.md §5` 신규 행 비고에 "공개 REST 엔드포인트 — 제3자 분기 가능성은 코드로 배제 불가, 관측(grep) 기준으로만 판단, 잔여위험은 사용자 결정으로 수용"임을 명시해 리스크 등급 차이를 남길 것 |
| 6 | plan_coherence | target 이 편집 대상으로 지목한 6곳 중 다수(`3-error-handling.md:80,189`, `13-replay-rerun.md:246,377` 등)가 1~2일 전 완료된 자매 plan(`spec-draft-inputoverride-marker-reject.md`, PR #1188/#1189 계열)이 짜 넣은 다중-관심사 텍스트(details[] 카탈로그 참조·wiring-fix 각주·§2 반대방향 Rationale 혼재)라는 출처가 target 문서에 인용되지 않음 | "동반 개정 표면 (실측)" 절 | 출처로 `plan/complete/spec-draft-inputoverride-marker-reject.md` 1줄 인용 + "코드명 토큰만 치환, details[]-카탈로그 참조·wiring-fix 각주는 보존" 명시 — 다음 실행자(구현 세션)의 실수 여지를 줄임 |
| 7 | naming_collision | `INVALID_TRIGGER_PARAMETERS` 는 신규 식별자가 아니라 이미 두 엔드포인트(`workflows.service.ts:931`,`workflows.controller.ts:324`)에서 쓰이는 값의 3번째 소비처 확장. `error-handling.md` §1.3 카탈로그에는 현재 이 코드의 행이 없어 target 의 rename 이 카탈로그 갭도 우연히 메움 | target "신규 식별자" 절 | 조치 자체는 불요(누락 위험 낮음) — §1.3 표 신규 행 설명에 "세 엔드포인트 공용"임을 명시하도록 실제 편집 시 확인 |
| 8 | naming_collision | `error-codes.md §5` Rename 이력 표 "PR" 컬럼에, target 이 실측 근거 인용으로 쓴 커밋 `7b0e65aa8`(이번 작업과 무관한 이전 PR)이 실수로 그대로 옮겨 적힐 위험 | §5 선례 실측 근거 인용 부분 | 신규 행 "PR" 컬럼엔 이 작업의 실제 PR 번호(머지 시점 결정)를 쓰고, `7b0e65aa8`은 방법론 인용으로만 남길 것을 명시적으로 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 예산 초과로 spec_impact 6파일이 절단돼 저장소 직접 대조로 보완. target 의 3건 자체 식별 공백(wrapper 함수명·§R17 볼드·§4 표 공백) 전부 실측 일치 확인, 신규 충돌 없음. §8.1 RERUN_ prefix 이탈 설명 누락(INFO)만 |
| rationale_continuity | LOW | `error-codes.md §2`(rename=breaking)·§5(Retired) Rationale 을 정확히 인식·구분해 처리. §5 선례 3건에 "제3자 잔여위험 인수" 근거를 소급 부여한 WARNING 1건, R11 internal/external 용어 긴장 INFO 1건 |
| convention_compliance | LOW | 인용한 파일·라인·grep 결과 전수 실측 일치. `error-codes.md §4` 표 scope("Code 노드 내부"·`output.error.code`)와 trigger-parameter 코드 추가가 충돌하는 WARNING 1건, R-1 인용 위치·§5 리스크 등급 명시 INFO 2건 |
| plan_coherence | LOW | 정본 트래커(`spec-sync-external-interaction-api-gaps.md`) 결정과 완전 일치, 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락 전부 없음. 편집 대상 6곳 다수가 1~2일 전 완료 자매 plan 산출물이라는 출처 미인용 INFO 1건 |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·API·이벤트명·env var·spec 파일 경로 신설 없음. `INVALID_TRIGGER_PARAMETERS` 는 기존 값의 의미 통합(충돌 아님). §5 표 PR 컬럼 오기 위험 INFO 1건만 |

## 권장 조치사항
1. (WARNING 우선) `error-codes.md §4` 표 편집 시 scope 분리/일반화를 병행 — trigger-parameter 코드를 "Code 노드 내부" 전용 표에 그대로 append 하지 않는다 (convention_compliance #2).
2. (WARNING) "§5 선례 3건도 같은 판단을 내렸다" 서술을 target 자신의 추론으로 톤 낮추고, §5 신규 행 비고에 이번 사례가 선례보다 엄격한 최초 사례임을 명시 (rationale_continuity #1).
3. `13-replay-rerun.md §8.1` 표에 `RERUN_` prefix 미사용이 의도적임을 각주로 남긴다 (cross_spec #1).
4. spec/plan 편집 시 "R-1" 인용을 "§4 `spec-code-paths.test.ts`"로 정정한다 (convention_compliance #4).
5. `error-codes.md §5` 신규 행 비고에 "공개 API·제3자 분기 배제 불가" 리스크 등급을 명시한다 (convention_compliance #5).
6. "동반 개정 표면" 절에 `spec-draft-inputoverride-marker-reject.md` 출처를 인용하고 details[]-각주 보존 지침을 추가한다 (plan_coherence #1).
7. `error-codes.md §5` 표 "PR" 컬럼에 실측 근거 커밋(`7b0e65aa8`)이 아닌 이번 작업의 실제 PR 번호를 쓰도록 편집 시 재확인한다 (naming_collision #2).
8. `error-handling.md §1.3` 카탈로그 신규 행에 "세 엔드포인트 공용"을 명시한다 (naming_collision #1).
9. `14-external-interaction-api.md` R11 과의 용어 긴장("인증된 공개 API")을 다듬는다 — 결정 자체는 유지 (rationale_continuity #2).