# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 모두 전문 확보(전원 인라인 전문 authoritative 반영, `plan_coherence` 는 status=`no_status` 였으나 인라인 전문이 있어 정상 반영). Critical 발견 0건.

## 전체 위험도
**LOW** — Critical/Warning 없음. 5개 checker 중 3개(cross_spec/convention_compliance/naming_collision)는 NONE, 2개(rationale_continuity/plan_coherence)는 LOW. 전부 문서 위생(bookkeeping) 성격 INFO.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `15-chat-channel.md` §7 구현 파일 트리가 이미 병합된 요청 DTO 파일(`chat-channel-rotate-bot-token-request.dto.ts`, 커밋 `a3a418ae3`)을 누락 — `code:` glob 은 자동 포함하지만 사람이 읽는 열거는 손으로 채워야 하는데 빠짐 | `spec/5-system/15-chat-channel.md` §7 (`### 7. 구현 파일 구조`) `triggers/dto/` 서브트리 | `dto/chat-channel-rotate-bot-token-request.dto.ts` 한 줄 추가 (형제 응답 DTO 줄과 대응하는 문구). request-body-guard 착수 조건은 아님, 별도 소소한 편집 |
| 2 | rationale_continuity, plan_coherence (중복 통합) | 가드 판정 축이 AST → reflection(`design:paramtypes`)으로 정당하게 번복됐으나(새 Rationale 동반, criterion 3 통과), 전환의 출처인 트래커 원문은 여전히 "AST" 로 남아 다음 세션에 낡은 신호를 줄 수 있음 | `plan/in-progress/spec-draft-nullable-notation-followups.md:5150` (`swagger.md` §5-4 Rationale · `request-body-guard.md` "가드(developer)" 항목과 대조) | 가드 구현 완료·트래커 닫는 커밋에서 5150행 "AST" 를 취소선 처리하고 "~~AST~~ → reflection(`design:paramtypes`) — 사유는 swagger.md §5-4 Rationale·request-body-guard.md 참조" 로 정정. 이번 --impl-prep 단계 BLOCK 사유 아님 |
| 3 | rationale_continuity | 선행 `--spec` 단계 Rationale 검토(18_59_58)의 INFO 2건(`@ApiExcludeController()` 제외 범위 누락, `schema:{}` 와 §1-4 관계 미연결)은 최종 커밋에서 이미 반영 확인됨 — 기록 목적, 새 결함 아님 | `spec/conventions/swagger.md` §5-4 체크리스트 4번째 항목 · 신규 Rationale 절 | 조치 불필요 |
| 4 | convention_compliance | `### 5-4. 새 엔드포인트 체크리스트` 제목과 실제 적용 범위(신규 vs 기존 라우트 소급)의 괴리가 이번 요청 본문 항목으로 세 번째 누적(선행 2건: §2-4 성공 코드, 403 설명 거부 코드) | `spec/conventions/swagger.md` `### 5-4. 새 엔드포인트 체크리스트` 신규 불릿 | 이번 PR 범위 밖. 후속 편집 시 절 제목을 "엔드포인트 체크리스트 (일부 항목은 기존 라우트에도 소급)" 로 조정하거나 도입부에 소급 항목 안내 한 줄 추가 |
| 5 | convention_compliance | `@ApiBody({ schema: {} })` 신규 표기와 §6 "빈 껍데기 스키마 제거" 금지가 시각적으로 유사하나 상호 교차 참조 없음 (실질 충돌은 아님 — 요청 vs 응답, 재량 표기 vs 게으른 누락) | `spec/conventions/swagger.md` 신규 Rationale `### §5-4 요청 본문 스키마 — 왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가` | 단락 끝에 "§6 의 응답 '빈 껍데기' 금지와는 무관 — 그쪽은 형태를 알면서 안 적는 게으름을, 여기는 형태 자체가 발신자 재량인 경우를 가리킨다" 한 줄 추가 |
| 6 | plan_coherence | `spec-draft-swagger-request-body.md` 변경안이 이미 `swagger.md`(커밋 `f71f5df06`)에 전부 반영됐는데 plan 상태(`status: in-progress`)와 `request-body-guard.md` 체크리스트 첫 항목이 여전히 미체크 | `plan/in-progress/spec-draft-swagger-request-body.md` (frontmatter) · `plan/in-progress/request-body-guard.md` 체크리스트 1번 | 차단 사유 아님. 체크리스트 마지막 "트래커 항목 좁히기·닫힌 부분 기록" 단계에서 (a) 첫 체크박스 체크, (b) `spec-draft-swagger-request-body.md` 를 `plan/complete/` 로 이동 |
| 7 | plan_coherence | §1-7 문서 전용 요청 DTO 명명(`<Domain><Action>RequestDto` 접미 여부) 결정을 target 이 의도적으로 유보 상태로 남김 — 정합 확인, 문제 아님 | `plan/in-progress/request-body-guard.md` "3 의 DTO 어순 리네임과 1 의 §1-7 명명 행은 남긴다" | 없음 — 현재 스코핑 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `15-chat-channel.md` §7 파일 트리 갱신 누락 INFO 1건 외 target·구현·인접 spec 전부 정합 |
| rationale_continuity | LOW | 선행 리뷰 INFO 2건 반영 확인 + 트래커 "AST" 미정정 INFO 1건, Rationale 계보(요청 DTO 승격 기각·문서 전용 DTO·소급 분류) 전부 실제 커밋과 정합 |
| convention_compliance | NONE | Critical/Warning 없음. 체크리스트 제목-범위 누적 괴리, schema:{} 시각적 유사성 INFO 2건은 스캔성 개선 제안 |
| plan_coherence | LOW | 트래커 문구 stale(AST), spec-draft plan 체크박스/이동 stale — 둘 다 target 체크리스트가 처리를 이미 예정 |
| naming_collision | NONE | 신규 식별자(`request-body-advertised` 가드·파생 파일·Rationale 절 제목) 저장소 전수 grep 0건, 명명 패턴 기존 형제 가드와 정합 |

## 권장 조치사항
1. (착수 차단 사유 없음 — 가드 구현 진행 가능)
2. 가드 구현·트래커 종결 커밋 시 `spec-draft-nullable-notation-followups.md:5150` "AST" 를 "reflection(`design:paramtypes`)" 으로 취소선 정정 (INFO #2)
3. 같은 커밋에서 `request-body-guard.md` 체크리스트 첫 항목 체크 + `spec-draft-swagger-request-body.md` 를 `plan/complete/` 로 이동 (INFO #6)
4. 여유 있으면 `15-chat-channel.md` §7 파일 트리에 신규 요청 DTO 한 줄 추가 (INFO #1)
5. 여유 있으면 `swagger.md` §5-4 절 제목·§6 교차 참조 문구 보완 (INFO #4, #5)
