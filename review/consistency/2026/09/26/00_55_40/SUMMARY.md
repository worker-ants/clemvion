# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 최고 등급 WARNING)

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(트래커 등재 주장-실제 불일치, RBAC 각주 기호 재사용)과 INFO 다수는 모두 표현·형식·후속 등재 정합성 문제이며 target 의 핵심 서술(구현 동작 반영)은 코드와 정확히 일치함이 5개 checker 모두에서 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, plan_coherence | Rationale 이 "요청자가 더는 볼 수 없는 행에 `last_error` 를 남기는 것이 맞는가" 질문을 트래커(«통합 소유자 강제의 테스트 · 구조 잔여»)에 "등재한다"고 단언하지만, 그 이름의 트래커/항목이 `plan/**` 어디에도 실체화되어 있지 않음(직전 `/ai-review` 4라운드가 "신설한다"고 말한 것과 동일 패턴 반복) | `plan/in-progress/spec-draft-integration-personal-owner-callback.md` `## Rationale` "왜 코드는 그대로인가" 항 (69~71행) | `plan/in-progress/spec-draft-nullable-notation-followups.md` 5781행 트래커 항목(현재 3개 하위 항목만 존재, 이 질문 없음); `review/code/2026/09/26/00_27_56/RESOLUTION.md` 의 "신설한다" 주장 | draft 의 `## 변경안`(또는 `## 동반 산출물` 절)에 `spec-draft-nullable-notation-followups.md` 해당 항목에 이 질문을 실제 하위 항목으로 추가하는 편집을 포함시키거나, Rationale 문구를 "등재한다"(완료형)에서 "등재가 필요하다"(과제형)로 낮춰 실제 상태와 일치시킨다 |
| 2 | naming_collision | `spec/5-system/1-auth.md` §3.2 표에 추가하는 새 각주가 이미 "System Status" 전용으로 쓰이는 기호 `※` 를 표 인라인 마커 없이 재사용 — 문서 자체의 "기호 1개 = 표 행 1개" 각주 관례를 깸 | `spec/5-system/1-auth.md` §3.2, `> ※ **Integration (Personal) 의 «자기 것»**: …` 삽입 위치 | 같은 파일 §3.2 `System Status ※` 행(L393)과 그 각주(L397); `멤버 관리 †`/`†` 각주(L374, L381) | `Integration (Personal)` 행에 새 기호(예: `‡`)를 붙이고 각주도 그 기호로 시작하거나, 기호 없는 별도 인용구 형태로 적어 `※`/`†` 각주 체계와 구분 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | §3.2 삽입 노트가 인라인 마커 없이 표 하단 각주만 추가돼, 마커 있는 "System Status ※" 각주 바로 앞에 놓이면서 두 번째 문단을 System Status 부연으로 오독할 여지 | `spec/5-system/1-auth.md` §3.2, `> ※ **System Status**` 앞 | WARNING #2 와 동일 근본 원인 — 같은 조치로 해소 가능. 표 각주 관례를 문서 자체 또는 SKILL.md 에 한 줄 명문화하는 것도 고려 |
| 2 | convention_compliance | §10.4 신규 행의 "팝업 표시" 컬럼 값이 실제 팝업 리터럴 문구가 아니라 추상적 사유 라벨(`RESOURCE_NOT_FOUND` · `ADMIN_REQUIRED`)이라 형제 행과 표기 성격이 다름 | `spec/2-navigation/4-integration.md` §10.4 신규 행 | 팝업을 거치는 경로면 실제 리터럴 문구로 교체, 팝업 없이 API 에러 응답만 나가는 경로면 "N/A (팝업 없음, API 에러 응답)" 로 명시 |
| 3 | cross_spec | §10.4 신규 행 2번째 컬럼 표현 형식이 다른 행(문구 인용) 과 달리 코드명 나열 — cross-spec 충돌은 아님 | `spec/2-navigation/4-integration.md` §10.4 신규 행 | INFO #2 와 동일 조치로 해소 가능 |
| 4 | naming_collision | 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로 — 신규 도입 없음, 전부 기존 식별자(`RESOURCE_NOT_FOUND`·`ADMIN_REQUIRED`·`assertRequesterStillAllowed`·`markIntegrationCallbackError`·`#8-권한-규칙` 앵커) 재사용 | 3개 target spec 파일 전반 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 3개 변경안 모두 구현(`assertRequesterStillAllowed`, `markIntegrationCallbackError`)과 정확히 일치, 타 영역과 충돌 없음. §10.4 컬럼 표현 형식 편차만 경미 관찰 |
| rationale_continuity | LOW | "커밋 직전 인가 재판정" 서술은 채택된 Rationale 결정 범위 안, 기각 대안 재도입 없음. 유일한 흠은 트래커 등재 주장의 실체 부재(WARNING) |
| convention_compliance | LOW | `project-planner` SKILL.md·error-codes.md·spec-impl-evidence.md·review-citations.md 전부 준수. INFO 2건(§3.2 각주 마커, §10.4 컬럼 성격)만 형식 편차 |
| plan_coherence | LOW | 선행 draft·후속 plan 과 정합, 미해결 결정 우회 없음. rationale_continuity 와 동일한 트래커 등재 갭을 WARNING 으로 재확인 |
| naming_collision | LOW | 신규 식별자 없음(전부 기존 재사용). RBAC §3.2 각주 기호 `※` 재사용이 표기 관례를 깨 WARNING |

## 권장 조치사항
1. `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커 항목에 "요청자가 더는 볼 수 없는 행에 `last_error` 를 남기는 것이 맞는가" 질문을 실제 하위 항목으로 추가하거나, target Rationale 문구를 "등재가 필요하다"로 낮춰 서술-실제 상태 불일치를 해소한다 (WARNING #1).
2. `spec/5-system/1-auth.md` §3.2 신규 각주에 `※` 대신 새 기호(`‡` 등)를 부여하거나 기호 없는 인용구로 바꿔 기존 "System Status ※" 각주와 구분한다 (WARNING #2).
3. (선택) §10.4 신규 행 "팝업 표시" 컬럼을 실제 팝업 리터럴 문구 또는 "N/A" 표기로 정리해 형제 행과의 컬럼 의미 일관성을 맞춘다 (INFO #2·#3, WARNING #2 조치와 함께 처리 가능).
