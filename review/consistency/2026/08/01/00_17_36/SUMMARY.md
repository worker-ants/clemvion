# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec, Rationale Continuity, Convention Compliance, Plan Coherence, Naming Collision) 전원이 CRITICAL 급 위배를 보고하지 않았다. 전문 확보 실패(재시도 필요) 항목 없음 — 5개 전원 `status=success` + 인라인 전문 확보, 디스크 파일도 5개 전부 기존재.

## 전체 위험도

**LOW** — target(`plan/in-progress/spec-data-flow-structural-followups.md`)이 실제 적용한 spec 변경 3건(RBAC 섹션 승격, SIGTERM 미결 각주, `data-flow/` 범위 명칭 통일)은 RBAC 권한 값(3개 표)·인바운드 앵커·명칭 통일 범위·문서 구조 템플릿 전 항목에서 실측 검증을 통과했다. 발견된 문제는 전부 상호참조·plan 추적 정합성 차원의 WARNING·INFO 이며, 데이터 모델·API 계약·RBAC 권한 값 자체의 충돌은 없다.

## Critical 위배 (BLOCK 사유)

(해당 없음 — 5개 checker 전원 CRITICAL 0건 보고)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `12-workspace.md` 신규 Rationale 문단이 plan 절 번호를 오인용 — "§3 에서 별도로 처리한다"고 썼으나 식별자/서술 구분 방침을 실제로 규정하는 절은 §4(`## 4. 잔여 — 서술형 "LLM Config" 표기`)이고, §3 은 이미 끝난 data-flow 범위 작업만 다룬다(본 라운드 고유 발견) | `spec/data-flow/12-workspace.md:361` | `plan/in-progress/spec-data-flow-structural-followups.md` §3 vs §4 | `12-workspace.md:361` 의 "§3" 을 "§4" 로 정정 |
| 2 | Convention Compliance(WARNING); Cross-Spec/Rationale Continuity/Plan Coherence(INFO, 동일 지적 3중 교차 확인 → 최강 등급 채택) | `spec_impact` frontmatter 가 실제 `git diff` 대상 파일 중 `spec/data-flow/0-overview.md` 를 누락(2개 파일만 명시) | `plan/in-progress/spec-data-flow-structural-followups.md` frontmatter `spec_impact:` | `spec/data-flow/0-overview.md`(§3.6 신설 + 도메인 인덱스 명칭 정정 포함, 실제 수정됨) | `spec_impact` 리스트에 `spec/data-flow/0-overview.md` 추가 |
| 3 | Convention Compliance + Plan Coherence(양쪽 모두 WARNING, 상세 교차 확인) | target Overview 가 "원 plan 은 완료 처리한다"고 선언했으나 원 plan 자체는 갱신되지 않음 — 3개 bullet 이 여전히 `- [ ]`(미체크)이고 target 으로의 상호참조 0건 | `plan/in-progress/spec-data-flow-structural-followups.md` Overview 두 번째 문단 | `plan/in-progress/review-info-followups.md` §4(이미 `origin/main` 병합·`#1040`, 3개 bullet 이 "planner 턴 필요"로 명시된 채 미착수 상태로 방치) | `review-info-followups.md` §4 의 3개 bullet 에 "→ `spec-data-flow-structural-followups.md` 로 이관·완료(2026-07-31)" 각주 추가 — `project-planner` 권한 내, 이번 PR 범위에서 즉시 처리 가능(별도 세션 대기 불요) |
| 4 | Naming Collision | 신규 plan 파일명이 스코프가 전혀 다른 기존 완료 plan 과 `...structural-followups.md` 접미를 공유 — 부분 문자열 탐색 시 혼동 가능(실제 상호참조는 전부 전체 경로라 현재 깨진 링크 0건) | `plan/in-progress/spec-data-flow-structural-followups.md`(파일명) | `plan/complete/spec-sync-structural-followups.md`(2026-06 spec-sync 감사 파생, 무관 스코프) | 강제 리네임 불필요. target Overview 나 plan 인덱스에 "무관 스코프, 혼동 금지" 각주 추가 권장(선택) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | 신설 `### 3.6 권한 요약 (선택)` 의 배치 근거("§3.4 는 상태 전이 전용이라 권한 매트릭스를 넣지 않는다")가 `## Rationale` 절이 아닌 본문에 서술됨 — target 이 §1 에서 지적한 것과 같은 종류의 구조 이슈가 신설 섹션에서 소규모 재발 | `spec/data-flow/0-overview.md §3.6`(본문) | `## Rationale` 에 "권한 요약 섹션(§3.6) 신설 이유" 항목 추가, 본문은 사실 서술만 남기고 링크 |
| 2 | Cross-Spec | SIGTERM 미결 각주가 `data-flow/3-execution.md` 한 곳에만 있어, 동일 사실을 다루는 `execution-engine.md §11`/`1-data-model.md` 를 먼저 읽는 독자는 분류가 확정된 것으로 오인 가능(사실관계 자체는 세 문서 모두 일치) | `spec/data-flow/3-execution.md §3.3` | 필수 아님. 여력 있으면 `execution-engine.md §11`(또는 그 Rationale)에도 동일 포인터 추가 — 별도 후속으로 남겨도 무방 |
| 3 | Cross-Spec | `spec/data-flow/0-overview.md §3.6` 신규 규약("요약표 아래 SoT 링크 필수")이 `spec/2-navigation/9-user-profile.md §4.2`(제3의 RBAC 요약표)에는 적용되지 않음 — target `spec_impact` 밖이라 강제 아님, 값 자체는 이미 정합 | `spec/data-flow/0-overview.md §3.6` 규약 vs `spec/2-navigation/9-user-profile.md §4.2` | 후속 P3/P4 로 추적 가능. 이번 target 수정 불요 |
| 4 | Convention Compliance | `0-overview.md §3.6` 의 도메인 문서 인용이 `[텍스트](경로)` 하이퍼링크가 아닌 코드텍스트(백틱) — §2 도메인 인덱스 표의 기존 스타일과 사소한 불일치 | `spec/data-flow/0-overview.md §3.6` | `[12-workspace.md §4](./12-workspace.md#4-권한-rbac-요약)` 형태로 통일(선택, `spec-link-integrity` 가드 대상 아님) |
| 5 | Naming Collision | `Model Config`/`LLM Config` 용어 이원화는 target 이 새로 만든 충돌이 아니라 기존 이원화(`unified-model-management` 이후 일부 문서만 갱신)를 target 이 `data-flow/` 스코프만 정확히 축소한 것 — 확인 완료, 조치 불요 | `spec/data-flow/12-workspace.md §4`, `spec/data-flow/0-overview.md` | 후속 작업 시 `spec/5-system/_product-overview.md:27`(NF-SC-02, "LLM Config" 서술형)이 target 자신의 §4 잔여 스코프(`5-system/`)에 포함됨을 재확인하면 충분 — breadcrumb 용 |
| 6 | Naming Collision | `12-workspace.md` 가 형제 문서(4-섹션 패턴) 대비 5번째 섹션(§4 RBAC)을 추가해 섹션 수 발산 — `1-audit.md` 에 이미 5-섹션 선례 존재, 인바운드 앵커 숫자 참조 0건이라 실질 충돌 아님 | `spec/data-flow/12-workspace.md §4/§5` | 조치 불요. 선택: `0-overview.md §3.6` 에 `1-audit.md` 선례를 각주로 덧붙이면 "최초 예외"로 오인 방지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | RBAC 값(3개 표)·인바운드 앵커·명칭 통일 범위(20건 중 잔존 목록) 전부 실측 일치. CRITICAL/WARNING 0건, INFO 3건(모두 비차단·다수가 target 범위 밖) |
| Rationale Continuity | LOW | RBAC 재배치·SIGTERM 각주·명칭 통일 3건 모두 기존 `## Rationale` 의 기각된 대안 재도입·합의 원칙 위반 없음. 명칭 통일은 오히려 번복+신규 Rationale 모범 사례. INFO 2건 |
| Convention Compliance | LOW | 문서 구조 템플릿·명명·frontmatter 면제·링크 무결성 전부 준수. 본 라운드 고유 발견(plan §3/§4 오인용) 포함 WARNING 3건, INFO 1건 |
| Plan Coherence | LOW | 인용된 두 미결 plan(SIGTERM (a)/(b), 취소 가드 갭)에 대해 중립 각주로 정확히 반영, 선점 없음. WARNING 1건(원 plan 미갱신), INFO 1건 |
| Naming Collision | LOW | 신규 요구사항ID·엔티티·API·이벤트·env 없음. plan 파일명 접미 중복 WARNING 1건(실피해 없음), 용어/섹션수 발산 INFO 2건(둘 다 사전 존재·선례 확인) |

## 권장 조치사항

1. **(WARNING #3)** `plan/in-progress/review-info-followups.md` §4 의 3개 bullet 에 "→ `spec-data-flow-structural-followups.md` 로 이관·완료(2026-07-31)" 각주 추가 — `project-planner` 권한 내, 별도 세션 대기 불요, 이번 PR 에서 직접 처리.
2. **(WARNING #2)** `plan/in-progress/spec-data-flow-structural-followups.md` frontmatter `spec_impact` 에 `spec/data-flow/0-overview.md` 추가(4개 checker 중 3개가 독립적으로 지적).
3. **(WARNING #1)** `spec/data-flow/12-workspace.md:361` 의 "§3" 을 "§4" 로 정정.
4. **(WARNING #4, 선택)** target Overview 또는 plan 인덱스에 `plan/complete/spec-sync-structural-followups.md`(무관 스코프)와 혼동 금지 각주 추가.
5. **(INFO #1, 선택)** `spec/data-flow/0-overview.md §3.6` 의 배치 근거를 본문에서 `## Rationale` 절로 이동, 본문은 사실 서술만 유지.