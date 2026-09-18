# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 전문 확보 못 한 checker 없음(5/5 인라인 전문 확보). `plan_coherence.md` 는 디스크에 파일이 없어 인라인 전문을 그대로 그 경로에 Write 하여 영속화 완료.

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(두 checker가 같은 사안을 다른 강도로 지적해 강한 등급으로 통합)과 INFO 5건은 모두 문서 완결성·스타일 수준으로 draft 의 처분 결론 자체를 무효화하지 않는다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec (WARNING) / Rationale Continuity (INFO, 동일 사안 — 하향 없이 강한 등급 채택) | `Trigger (workflow_id) 인덱스 (2026-09-18)` 절의 "나머지 여섯" 목록 중 넷(`auth_config.workspace_id`·`knowledge_base.workspace_id`·`integration_oauth_state.workspace_id`·`integration_oauth_preview.workspace_id`)을 이번 draft 가 처분(둘은 V127·V128 인덱스화, 둘은 비대상 "마")하는데, 그 절 자체에는 상호 참조/정정 각주가 추가되지 않는다 — 바로 위 "삭제 연쇄의 FK 인덱스 다섯" 절이 스스로 세운 "관계 addendum" 관례를 비대칭 적용 | `plan/in-progress/spec-draft-fk-remaining-dispositions.md` `## 변경안` S3 (`spec/1-data-model.md` Rationale 정정 세 곳) | `spec/1-data-model.md` `## Rationale` → `### Trigger (workflow_id) 인덱스 (2026-09-18)` 절 "같은 클래스 전수 — 나머지 여섯은 이 결정에 넣지 않았다" 문단 | S3 정정 목록에 네 번째 항목 추가 — 해당 문단 뒤(또는 옆)에 "`auth_config.workspace_id`·`knowledge_base.workspace_id` 는 위 «쓸 인덱스가 없는 FK 서른하나의 처분» 절이 조회 경로 이유로 인덱스를 뒀다(V127·V128). `integration_oauth_state`·`integration_oauth_preview` 의 `workspace_id` 는 같은 절이 비대상(마)으로 남겼다. 이 문장은 V111 시점 결정 범위에서는 그대로 참이다." 각주 삽입 (하드 모순은 아니므로 WARNING — BLOCK 사유는 아니지만 머지 전 반영 권장) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | 취소선(strikethrough) 관례와의 형식 불일치 — 원 서술이 "그 범위 안에서는 여전히 참"인 정정에 각주만 붙이는 기존 관례와 정합하나, "작은 테이블이라 넣지 않았다"는 결론 자체는 90만 행 규모에서 더 이상 참이 아님 | S3 "앞 절 정정 세 곳" (`edge.target_node_id`/`alert_rule.workflow_id`, "전수 37", "나머지 32개" 문장) | 각주 대신 결론 문장 자체에 "(1만 행 기준)" 같은 범위 한정어를 인라인으로 추가하면 각주를 안 읽는 독자에게도 오도 소지 감소. 필수 아님 |
| 2 | Convention Compliance | 변경안(S1·S4) 인용 라인의 단일 backtick 중첩이 draft 자체 렌더링을 깸 — 최종 `spec/1-data-model.md` 반영 내용에는 전이되지 않음(순수 draft 가독성 이슈) | `## 변경안` S1 각 bullet, S4 표 "인덱스 칸에 더할 것" 열 | 다음 draft 작성 시 바깥 인용을 이중 backtick 으로 감싸면 자체 렌더링도 안 깨짐 |
| 3 | Plan Coherence | 「라」 비대상 판정(부모를 지우는 앱 경로 없음, 13개 컬럼 대상)의 재개 트리거가 트래커 어디에도 캐너리로 박혀 있지 않음 — 사용자 탈퇴/계정 삭제 기능이 생기면 조용히 다시 열려야 함 | `## 처분 — 31개` 표, `## Rationale` §처분 기준 「라」 항목 | 이번 draft 범위 밖. 사용자 삭제 기능이 실제 계획될 때 그 plan 이 이 draft(또는 Rationale 「라」 근거)를 참조하도록 하는 것으로 충분 |
| 4 | Naming Collision | 신규 식별자 전수(마이그레이션 V121~V130, 인덱스 이름 10개, Rationale 절 제목, plan 파일 경로) — 저장소 전체(`codebase`/`spec`/`plan`, `origin/main` 포함) grep 0건, 충돌 없음 확인 | 전체 draft | 현 상태 유지, 조치 불필요 |
| 5 | Naming Collision | 트래커에 새로 올리는 항목 제목 둘(「웹훅 트리거 조회 `endpoint_path` 인덱스 전체 스캔」·「`WorkflowAssistantSession` `@Index` 데코레이터 `userId` 누락」)은 텍스트 충돌은 없으나 5,000줄 근접 대형 문서라 배치 확인 필요 — naming 범위 밖 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 신설 예정 항목 | 구조/스코프 검토자에게 배치 확인 위임, naming 관점 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 신규 V121~V130·인덱스명·spec 앵커 전부 원문과 정합. 유일 갭: Trigger 절 상호참조 미갱신(WARNING) |
| Rationale Continuity | LOW | S3 가 과거 결론 번복 지점을 스스로 특정해 정정 각주로 명시 — 무근거 번복 없음. 동일 상호참조 갭(INFO, 위 WARNING 에 통합) + 취소선 스타일 편차 |
| Convention Compliance | NONE | 마이그레이션 명명·버전, §3 표 서식, Rationale 헤딩, plan frontmatter, frontmatter-evidence 제외 영역 전부 규약 부합. INFO 는 draft 자체 렌더링 스타일만 |
| Plan Coherence | LOW | 트래커 28행 잔여 ↔ draft 31행 처분표 1:1 매핑 전수 검증 완료, 인접 미해결 결정 미침범, 버전/line-anchor 충돌 없음. 재개 트리거 미명시만 INFO |
| Naming Collision | NONE | 신규 식별자 전수 grep 0건 재현 확인, 충돌 없음 |

## 권장 조치사항
1. (WARNING 해소 권장, BLOCK 아님) S3 정정 목록에 네 번째 각주 추가 — `spec/1-data-model.md` `### Trigger (workflow_id) 인덱스 (2026-09-18)` 절의 "나머지 여섯" 문단에 `auth_config.workspace_id`·`knowledge_base.workspace_id` 가 V127·V128 로 인덱스화됐고 `integration_oauth_state`/`integration_oauth_preview` 의 `workspace_id` 는 비대상(마)으로 남았음을 명시.
2. (선택) 취소선 대신 인라인 범위 한정어("1만 행 기준") 추가로 향후 오독 방지.
3. (선택) draft 자체 렌더링 개선을 위해 인용 줄의 바깥 backtick 을 이중으로.
4. 사용자 삭제 기능이 실제로 계획되는 시점에 「라」 재개 조건을 그 plan 에서 이 draft 를 참조하도록 연결.
