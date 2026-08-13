# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

target: `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`
(NF-OB-07 메트릭 카탈로그에 `clemvion.redis.fail_open` 1행 등재 — `spec/5-system/_product-overview.md`,
`spec/data-flow/9-observability.md` 대상)

## 전체 위험도
**LOW** — 5개 checker 전원 CRITICAL 0건. Convention Compliance 가 WARNING 1건(`## Rationale`
헤더 대신 `## 판단이 필요한 지점` 사용)을 냈으나 build guard 로 강제되는 hard 규약이 아니며
(기존 완료 draft 53건 중 19% 도 생략) 내용 자체는 실질적으로 Rationale 역할을 수행함.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `## Rationale` 섹션 부재 — 결정 근거가 `## 판단이 필요한 지점` 이라는 다른 이름의 절에 있음. project-planner SKILL 규약("본문 끝 `## Rationale` 로 결정 근거 명시")에 이름이 불일치 | target 문서 전체 | `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3번 · §Spec 문서 구조 표 | `## 판단이 필요한 지점` 을 `## Rationale` 로 개명하거나 문서 맨 끝으로 이동 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `clemvion.queue.depth` 가 NF-OB-07 카탈로그 외 `5-system/4-execution-engine.md` 에서도 부분 인용됨(카탈로그 전체 나열 아니므로 stale 안 됨) | `spec/5-system/4-execution-engine.md:1197,1664` | 조치 불필요 |
| 2 | rationale_continuity | "component: idempotency 단일값" 판단 근거가 현재 plan 문서에만 있고 spec `## Rationale` 에는 미반영(표 갱신 전 단계) | `spec/data-flow/9-observability.md` `## Rationale` | 표 갱신 시 이 스코프 판단을 spec Rationale 에도 남기면 plan 이 `plan/complete/` 이동 후에도 근거 추적 가능 |
| 3 | naming_collision | `component`/`reason` 라벨명이 제네릭 — 무관한 도메인에서 동일 단어 재사용 중이나 OTel 라벨은 인스트루먼트별 네임스페이스 분리로 실충돌 없음 | `spec/conventions/user-guide-evidence.md:60`, `spec/5-system/9-rag-search.md:144`, `spec/5-system/14-external-interaction-api.md:336` | 대응 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 신규 엔티티/API/RBAC 없음. 라벨 값이 코드 호출부와 1:1 일치. `queue.depth` 부분 인용 파일 1건(비충돌) INFO |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복 없음. fail-open 선례·관측 이원화 정책과 정합 |
| convention_compliance | LOW | `## Rationale` 헤더명 불일치 WARNING 1건. frontmatter·명명·표 형식 등 나머지 전 항목 정합 |
| plan_coherence | NONE | `plan/in-progress/**` 전수 스캔 — 미해결 결정 충돌 없음, 선행 조건(카운터 배선) 이미 완료·실측 확인, 후속 항목 중복 없음 |
| naming_collision | NONE | 요구사항 ID·엔티티/타입명·메트릭명·ENV·파일 경로 6축 전수 grep — 실질 충돌 없음 |

## 권장 조치사항
1. (BLOCK 아님) draft 의 `## 판단이 필요한 지점` 절을 `## Rationale` 로 개명·이동.
2. §5(spec 반영) 단계에서 `component: idempotency` 단일값 판단 근거를 `spec/data-flow/9-observability.md` `## Rationale` 에도 반영.
3. 위 2건 모두 완료를 막을 필요는 없다 — CRITICAL 없음, spec 반영 진행 무방.

---

## 이 라운드 처분 (main Claude)

**WARNING 1·INFO 2 둘 다 반영.** draft 의 해당 절을 문서 끝 `## Rationale` 로 옮겼고, INFO 2 가
가리킨 추적성 문제 — plan 은 언젠가 `plan/complete/` 로 옮겨가는데 그때 판단 근거가 spec 에
없으면 "왜 `component` 가 하나뿐인가" 를 되물을 자리가 사라진다 — 를 받아 `9-observability.md`
`## Rationale` 에 절을 신설했다. 표만 갱신하고 근거를 plan 에 두는 것은 이 저장소가
`## Rationale` 을 두는 이유와 어긋난다.

INFO 1·3 은 무조치 — 부분 인용은 카탈로그 전체 나열이 아니라 stale 되지 않고, 라벨명 재사용은
OTel 인스트루먼트별 네임스페이스라 실충돌이 아니다.

**spec 반영 완료**: `_product-overview.md` NF-OB-07 요약 행 + 카탈로그 표 1행,
`9-observability.md` 미러 문장 + Rationale 절.
