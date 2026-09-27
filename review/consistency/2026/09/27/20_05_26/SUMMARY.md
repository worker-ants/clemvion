# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 전문 확보 못 한 checker 없음(5/5 전문 인라인 확보, checker 파일 5/5 이미 디스크 존재).

## 전체 위험도
**MEDIUM** — Critical 없이 BLOCK 없음이나, `details` 응답 형태(배열 vs 단일 객체) 불일치가 cross_spec·convention_compliance 두 checker에서 독립적으로 수렴 지적되어 구현 착수 전 정정이 필요.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | 캔버스 저장처럼 한 요청에 여러 필드가 동시 위반될 수 있는 경로에 단수 `details: { field, code: 'INVALID_FIELD' }` 를 채택. generic `VALIDATION_ERROR` 를 top-level 로 유지하기로 한 target 자신의 결정과, `AUTH_CONFIG_NOT_FOUND`(top-level 이 특화 코드일 때만 객체 형태가 성립)에서 형태만 빌려온 것이 서로 어긋남. 두 번째 이후 위반 필드가 응답에서 조용히 사라질 수 있음 | `### A.` §A1 "거부 응답" 문단 및 이를 재인용하는 B1~B4, C1, D1, E 동일 문구 전체 | `spec/5-system/2-api-convention.md` §5.3 (배열 `details:[{field,message,code}]` = "여러 항목이 각각 실패할 수 있을 때" 조건과 매칭), `spec/conventions/error-codes.md`(§5.3/§2.1 위임, 재선언 금지), 선례 `RESERVED_VARIABLE_NAME.details.offenders[]`·`INVALID_TRIGGER_PARAMETERS`(generic top-level + 배열 details) | A1 문구를 `details: [{ field, code: 'INVALID_FIELD' }, …]` 배열로 정정하고 B1~B4·C1·D1·E 동일 문구도 함께 갱신. 단수를 의도했다면(첫 위반 fail-fast) 그 근거를 `## Rationale` 에 명시 |
| 2 | cross_spec | 신설 §1.1 규칙 표가 스코프에 포함시킨 AlertRule `workflow_id`(§2.25) 가 실제 변경 목록 A2~A6 에서 빠짐 — 같은 문서 안에서 "§1.1 이 커버하는 필드"와 "§1.1 을 인용하는 필드" 사이 비대칭 발생. `data-flow/9-observability.md`·`2-navigation/9-user-profile.md` 등 §2.25 를 인용하는 타 문서가 이 갭을 물려받음 | `### A.` 신설 §1.1 표(알림 규칙 `workflowId` 행) vs A2~A6 | `spec/1-data-model.md` §2.25 AlertRule (`workflow_id` FK, NULL=워크스페이스 전역) | A7(가칭) 추가 — §2.25 `workflow_id` 행에 "같은 워크스페이스의 워크플로만(§1.1). NULL = 워크스페이스 전역 규칙" 주석 |
| 3 | plan_coherence | 직전 `--impl-prep`(19_43_46 SUMMARY WARNING #2) 이 이미 지적한 "이 PR 밖으로 넘기는 것" 두 항목(트리거 `config` JSONB 비밀 참조, 이미 저장된 교차 행에 대한 실행 시점 방어선/운영 데이터 점검)이 이번 라운드 재확인(`grep`)에도 여전히 트래커에 미등재 | target §E "남긴 것" 문단 | `plan/in-progress/cross-workspace-refs.md` §"이 PR 밖으로 넘기는 것", `plan/in-progress/spec-draft-nullable-notation-followups.md` "교차 워크스페이스 참조" 불릿(line ~1479, 곁눈 조사 문구 그대로 미갱신) | `--impl-done` 이전에 followups 트래커를 (a) 전수 결과로 갱신 (b) 비밀 참조·실행시점 방어선을 별도 신규 항목으로 등재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "파이프" 용어가 링크 없이 쓰여 `data-flow/12-workspace.md` 의 Nest Pipe 용법과 혼동 가능 | §A1 "(캔버스 저장은 `nodes[i].id` 처럼 파이프와 같은 경로 표기)" | `spec/5-system/2-api-convention.md#53-에러-응답` 로 직접 링크하거나 "중첩 경로 표기"로 대체 |
| 2 | rationale_continuity | 검토용 컨텍스트 번들이 예산 초과로 target 이 가장 많이 손대는 `11-workflow.md`·`12-workspace.md` 의 기존 Rationale 을 생략 — 이번 세션은 워크트리 직접 열람으로 보완했으나 파이프라인 구조적 위험으로 별도 기록 | 검토 입력(`_prompts/rationale_continuity.md`) 자체 | orchestrator 가 `--spec` 번들 예산 산정 시 target `spec_impact` 나열 경로를 우선순위로 포함 검토 |
| 3 | plan_coherence | `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans` 에 이미 complete 인 plan 잔존 + 지금 이 파일을 직접 편집하는 `cross-workspace-refs` 가 미등재(기존 알려진 이슈, 반복) | target B1~B5 가 편집하는 파일의 frontmatter | B1~B5 적용 시 `pending_plans` 정리(필수 아님, 차단 사유 아님) |
| 4 | plan_coherence | `spec-update-node-cancellation-shutdown-classification.md:348` 의 `spec/1-data-model.md:546` 원시 라인 인용이 이미 어긋나 있고(현재 546행은 §2.13.1 부근, 실제 대상은 597행), target 의 §1.1/§2.4~§2.9 삽입이 어긋남 폭을 더 키움 | A1~A6 삽입 지점 | 이 draft 소유 아님 — 해당 plan 다음 편집 시 라인 번호를 섹션 앵커(§2.14)로 교체하도록 메모만 |
| 5 | plan_coherence | target 이 "저장 시점 거부"를 현재형으로 서술하지만 구현 plan 체크리스트는 전부 미체크 — spec 커밋과 구현 커밋 착지 시점 의존성에 명시적 안전장치 없음 | target 전체(A1~D2) | `cross-workspace-refs.md` 또는 draft frontmatter 에 "spec 변경은 구현과 동일 PR 로 병합" 명시(필수 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | AlertRule §1.1 스코프 누락, 캔버스 저장 `details` 배열/단수 불일치, "파이프" 용어 모호 |
| rationale_continuity | NONE | 무근거 결정 번복·원칙 위반 없음. B5/§E 모두 재현 실측·대안 기각 근거 동반. 컨텍스트 번들 예산 누락만 구조적 이슈로 기록 |
| convention_compliance | MEDIUM | `VALIDATION_ERROR`(generic top-level) 유지 결정과 `AUTH_CONFIG_NOT_FOUND`(특화 top-level) 선례의 객체-`details` 형태를 섞어 써 §5.3 선택 기준 위반 |
| plan_coherence | LOW | "PR 밖으로 넘기는 것" 두 항목 트래커 미등재 재확인(2회 연속), 그 외 pending_plans·라인 인용·착지 시점 의존성은 INFO |
| naming_collision | NONE | 신규 식별자·엔티티·endpoint·이벤트·환경변수·파일 경로 충돌 없음. 기존 필드/에러코드 재사용만 |

## 권장 조치사항
1. (WARNING #1) A1 "거부 응답" `details` 를 배열 형태로 정정하고 B1~B4·C1·D1·E 동일 문구 동기화 — 캔버스 저장 다중 위반 시 정보 유실 방지.
2. (WARNING #2) A7 추가로 AlertRule `workflow_id` 를 §1.1 변경 목록에 등재해 문서 내부 완결성 확보.
3. (WARNING #3) `--impl-done` 전 `spec-draft-nullable-notation-followups.md` 에 "PR 밖으로 넘기는 것" 두 항목을 신규 트래커 엔트리로 등재(2회 연속 미등재 — 다음 세션 근거 유실 위험).
4. (INFO) 여력이 되면 "파이프" 용어 링크, `pending_plans` 정리, 라인 인용 메모, spec-구현 동일 PR 착지 명시도 함께 처리.