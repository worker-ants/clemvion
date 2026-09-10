# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 완주(success, 전문 확보). Critical 발견 0건.

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건(모두 문서 명확화·plan 동기화 성격)과 INFO 다수, 전부 실행 가능한 소정정 수준.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

> Critical 이 없으므로 해당 없음.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | 신규 400 두 분기(D-2) 첫 항목 서술이 "PATCH 실패가 best-effort catch 에 삼켜져 degraded 로 조용히 200 이 된다"와 "details.field='chatChannel' 로 400" 을 한 문장에 뒤섞어, 실제 응답이 400 인지 200(degraded) 인지 모호 — `details` 는 §5.3 상 에러 봉투(4xx/5xx) 전용 필드라 200 표기와 섞이면 스코프 오기재 | `plan/in-progress/spec-draft-chat-channel-drift-3.md` "(b) 신규 400 두 분기" 표 1행 | `spec/5-system/2-api-convention.md §5.3`(details 는 에러 봉투 전용) | A3 반영 전 "가드 도입 전 반사실(200)" 과 "가드 도입 후 실제 응답(400)" 을 문장 두 개로 명확히 분리. 실측이 실제로 200/degraded 라면 이 행은 400 표에서 빼고 `chatChannelHealth: 'degraded'` 서술로 이동 |
| 2 | Plan Coherence / Naming Collision | 체크리스트 "트래커 3항목 종결"이 소유 plan(`spec-draft-nullable-notation-followups.md`, 132,397자 대형 트래커)의 파일명·라인(L2034, L2073/2137-2166)을 지목하지 않아, 마무리 후 그 체크박스가 미체크 상태로 고아화될 위험. 아울러 그 트래커 L2159-2160 의 "정정 대상은 chat-channel 9곳뿐" 문장은 target 이 `secret-store.md:301` 을 10번째로 실측 포함하면서 반영 후 거짓 문장이 됨 | `plan/in-progress/spec-draft-chat-channel-drift-3.md` "체크리스트" 4번째 항목 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2034, :2073, :2137-2166` (미해결 체크박스 3건) | 체크리스트 항목에 위 3개 라인 번호를 명시적으로 cross-link. 완료 시 해당 체크박스를 `[x]` + "✅ 2026-09-11 해소 — spec-draft-chat-channel-drift-3.md 참조" 로 갱신, L2159-2160 "9곳뿐" 문장을 10곳으로 정정하거나 취소선 처리 |
| 3 | Naming Collision | §5.4.1 표에 추가할 신규 행 레이블("chatChannel 이 없는 트리거에 PATCH 로 처음 붙이려 함")이 기존 행(373·390행 "최초 트리거 생성")과 "최초"라는 어휘가 겹쳐, 독자가 POST 생성 성공 케이스와 PATCH 차단(400) 케이스를 같은 시점으로 오독할 위험 | `spec/5-system/15-chat-channel.md` §5.4.1 (target A3 신규 행 예정 위치, 기존 373·390행과 인접) | 기존 373·390행 "최초 트리거 생성 (POST /api/triggers)" | 신규 행 레이블에서 "최초" 대신 "사후(post-hoc) PATCH 로 부착 시도" 또는 "chatChannel 미설정 트리거에 PATCH 로 신규 부착" 등 POST 행과 시각적으로 구분되는 표현 사용 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `3-error-handling.md` 의 도메인별 `VALIDATION_ERROR` 카탈로그에 chat-channel `details.field` 값 목록이 등재되지 않음(기존 관례의 연장, target 결함 아님) | `spec/5-system/3-error-handling.md` (target 변경 범위 밖) | 향후 세션에서 chat-channel 도메인 코드를 이 표에 통합할지는 별도 판단 사안으로 남겨도 무방 |
| 2 | Convention Compliance | 신규 두 400 분기에 `details.code` 값 미기재(기존 형제 행들도 동일 — 이 target 이 새로 만든 갭 아님) | "(b) 신규 400 두 분기" 표, 변경안 A3/B1 | A3/B1 반영 시 `details.code`(재사용 `INVALID_FIELD` 여부) 를 표에 명시 |
| 3 | Convention Compliance | 신규 400 분기의 §1 카탈로그 등재 여부가 명시되지 않음 (top-level code 가 기존 `VALIDATION_ERROR` 재사용이면 추가 조치 불요 가능성 높음) | 결정 D-2, 변경안 A3/B1 | "기존 VALIDATION_ERROR 재사용, 신규 카탈로그 항목 불필요" 한 줄을 명시 |
| 4 | Rationale Continuity | 신규 400 두 분기 표기 시 §5.4.1 신규 행에 R-CC-10/R-CC-21/R-12 세 앵커를 모두 cross-link 하면 추적성 향상(현재 B3 는 R-12 만 계획) | 결정 D-2, 변경안 B3 | `15-chat-channel.md` 신규 두 행에 R-CC-21 cross-link 추가 |
| 5 | Plan Coherence | D-1 의 "두 갈래 병존" 결정이 트래커가 요구한 "SoT 단일화" 질문에 명시적 결론 문장으로 답하지 않아 독자가 "아직 미결정"으로 오독할 여지 | 변경안 A1/A2/B1/B2 | §5.4.1 또는 Rationale 에 "SoT 는 단일하지 않다 — 검증 계층에 따라 갈리며 이것이 확정 설계다" 한 줄 명시 |
| 6 | Naming Collision | `details.field='chatChannel'`/`='provider'` 값은 테스트 코드(`triggers.service.spec.ts:3160,3298`)와 일치하는 기존 필드명의 정합적 재사용 — 확인 완료, 조치 불요 | 결정 D-2 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | `store()` 10곳 카운트·`details.field` 두 갈래·신규 400 분기 전부 실제 코드/spec 원문과 정확히 일치. 새 요구사항·API 계약 도입 없음 |
| Rationale Continuity | NONE | D-1~D-3 모두 R-CC-10/R-CC-21/R-12/secret-store §2.1 의 필연적 귀결. 기각한 대안 3건 전부 실제 이력(과거 SUMMARY) 근거. 지어낸 이력·소급 부여 없음 |
| Convention Compliance | LOW | `details` 두 형태 병존은 §5.3 정식 규약과 정합. 유일 우려는 신규 400 분기 1행의 200/400 서술 혼동(WARNING) |
| Plan Coherence | LOW | 결정 자체는 코드 실측과 정합하나, "트래커 3항목 종결"이 소유 plan 파일명·라인을 지목하지 않아 stale 체크박스 위험 |
| Naming Collision | LOW | 신규 식별자 없음(순수 정정). §5.4.1 신규 행 레이블이 기존 "최초 트리거 생성" 행과 어휘 충돌 소지, 트래커 중복 등재 이중화 위험 |

## 권장 조치사항

1. (WARNING #1) A3 반영 전, "chatChannel 최초 부착 시도" 행의 서술에서 반사실(가드 없었다면 200)과 실제 응답(가드 있는 현재는 400)을 문장 두 개로 분리 — 실측이 200/degraded 라면 그 행을 400 표에서 빼고 `chatChannelHealth: 'degraded'` 서술로 이동.
2. (WARNING #2) 체크리스트 "트래커 3항목 종결"에 `plan/in-progress/spec-draft-nullable-notation-followups.md:2034, :2073, :2137-2166` 라인 번호를 명시적으로 cross-link하고, 마무리 커밋 시 해당 체크박스 `[x]` 전환 + `secret-store.md:301` 10번째 포함으로 인해 거짓이 되는 "정정 대상은 chat-channel 9곳뿐" 문장(L2159-2160) 정정.
3. (WARNING #3) §5.4.1 신규 행 레이블에서 "최초"라는 단어를 기존 373·390행("최초 트리거 생성")과 구분되는 표현("사후 PATCH 부착 시도" 등)으로 교체.
4. (INFO 일괄) A3/B1 반영 시 `details.code` 값과 §1 카탈로그 등재 여부를 한 줄로 명시, `15-chat-channel.md` 신규 행에 R-CC-21 cross-link 추가, §5.4.1/Rationale 에 "SoT 는 검증 계층별로 갈린다"는 결론 문장 명시.
