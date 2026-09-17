# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건, WARNING/INFO만 보고)

## 전체 위험도
**LOW** — 5개 checker 모두 LOW 로 판정. draft 는 이미 2회의 `--spec` 검토를 거쳐 이전 Critical(트래커 라벨 `T1~T3` 충돌, `secret-store.md §6` 자기모순 등)을 해소했고, 이번 3차 검토는 새 CRITICAL 없이 잔여 WARNING/INFO 만 낸다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 새 정리 계약(`secret_store` 4경로 적용)이 `data-flow/10-triggers.md §1.4` 의 기존 「Schedule 삭제」행에는 반영되지 않아, 같은 이벤트에 대해 문서 간 결론이 갈린다 | `## 변경안 § S5` (`data-flow/10-triggers.md §1.4` — 행 추가만 지시, 기존 행 미편집) | `secret-store.md §R4`/`§2.1`(S9/S10, 스케줄 삭제 포함 명시) · `2-trigger-list.md §4.3`(S2, 스케줄 화면 삭제도 같은 계약 대상이라고 명문화) | S5 를 확장해 기존 「Schedule 삭제」행 Trigger 열도 `[트리거 목록 §4.3]` 포인터로 갱신하거나, 표 아래에 "Schedule 삭제·Trigger(type=schedule) 직접 삭제 두 행의 자원 정리 계약은 §4.3 로 일원화" 한 줄 추가 |
| 2 | convention_compliance | `secret-store.md §2.1` 확장(S10)이 §2 `SecretResolver` 인터페이스 선언과 계속 어긋난 채로 간다 (`deleteByPrefix` 가 §2.1/§5.3/§6 에는 있으나 §2 선언에는 없음 — draft 이전부터 있던 결함을 "전수 정정" 이라 하면서도 §2는 안 건드림) | `## 변경안 § S10` | `secret-store.md §2` `SecretResolver` 인터페이스 선언 (5개 메서드만, `deleteByPrefix` 부재) | S10 범위에 §2 인터페이스 블록에 `deleteByPrefix(prefix: string): Promise<void>` 시그니처 추가를 포함하거나, Rationale 에 "§2 인터페이스 선언 갱신은 이 draft 범위 밖(선행 결함)" 명시 |
| 3 | naming_collision | D7 의 «창 1/2/3» 번호가 같은 트리거 동시성 도메인의 기존 «창 1~4» 번호(`trigger-config-lost-update.md`)와 형태가 겹친다. 대부분 `D7` 접두로 구분되나 Rationale 끝 "그래서 창 2 로 적고 미룬다" 한 문장은 접두 없이 노출 | `## D7. 남는 창 — 적어 둔다` 표 및 그 직후 Rationale 문단 | `plan/complete/trigger-config-lost-update.md ## A. 착수 전 실측 — 창이 넷이다` (창 1~4 기존 번호 체계, target 자신도 같은 문서 안에서 이 번호를 인용) | D7 표 헤더에 `# | 남는 창(D7) | 남는 것 | 처분` 처럼 소속 명시 또는 `G1/G2/G3` 등 다른 접두 채택. 최소한 누락된 Rationale 문장에 `D7` 접두 복원 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `2-navigation/3-schedule.md §3` 도 같은 이유로 조용히 낡지만(오기는 아님) — 새 secret 정리 계약을 사용자에게 설명할 자리가 없음 | draft `spec_impact` 목록에 이 파일이 빠져 있음 | 위 WARNING #1 처리와 함께 포인터 한 줄 추가하거나, 최소한 "비대상" 표에 왜 안 건드리는지 한 줄 기록 |
| 2 | rationale_continuity | `chat-channel.md R8` 의 «teardownChannel() (또는 TriggersService.remove)» 단일 경로 표기가 새 "모든 경로" 규칙에 비해 문면상 좁다 (D1 원칙과 충돌은 아님) | R8 은 draft 비대상 표에도 없음 | 후속 트래커 항목에 "R8 괄호를 스케줄·워크플로우·워크스페이스 삭제 경로까지 넓히기" 한 줄 추가 |
| 3 | convention_compliance | `status: implemented → partial` 하향 전이가 `spec-impl-evidence.md §3.1` 전이 규칙에 명문화돼 있지 않음 (선례 다수 존재, 가드도 방향 미강제라 차단 아님) | S10 끝 frontmatter 전이 | draft 자체는 무수정. `spec-impl-evidence.md §3.1` 에 "실측으로 오분류 발견 시 방향 무관 즉시 정정" 규칙 추가를 후속 planner 턴에서 검토 |
| 4 | plan_coherence | S1 이 편집하는 `1-workflow-list.md` frontmatter `pending_plans` 배열에 이미 dangling 항목(`plan/complete/workflow-duplicate-nodes-edges.md`, 이미 이동 완료)이 있으나 target 은 추가만 하고 정리하지 않음 | `## 변경안` S1 | 필수 아님 — S1 에 한 줄 추가해 dangling 항목 제거, 또는 정리하지 않는 이유 기록. 근본 처방(dangling 검사 가드)은 `spec-draft-nullable-notation-followups.md` 의 별도 미체크 항목 몫 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 스케줄 삭제 경로에 대한 `10-triggers.md §1.4` vs `secret-store.md`/`2-trigger-list.md §4.3` 서술 불일치 (WARNING), `3-schedule.md` 동기화 누락 (INFO) |
| rationale_continuity | LOW | 과거 Rationale과 대체로 정합. `chat-channel.md R8` 경로 명명이 문면상 좁아짐 (INFO) |
| convention_compliance | LOW | `secret-store.md §2` 인터페이스 선언과 §2.1 확장 간 불일치 지속 (WARNING), status 하향 전이 규칙 미명문화 (INFO) |
| plan_coherence | LOW | 1·2차 `--spec` WARNING 전부 해소 확인. `1-workflow-list.md pending_plans` dangling 항목 미정리 (INFO) |
| naming_collision | LOW | `DRT-1~3` 등 신규 라벨 충돌 없음(2차 CRITICAL 이미 해소). D7 «창 N» 번호가 `trigger-config-lost-update.md` 기존 번호 체계와 형태 충돌 (WARNING) |

## 권장 조치사항
1. (BLOCK 아님, 권장) S5 에서 `data-flow/10-triggers.md §1.4` 기존 「Schedule 삭제」행의 Trigger 열도 함께 갱신 — draft 가 §R4에서 고치는 것과 같은 클래스의 결함이 같은 편집 세트로 재생산되는 것을 막는다.
2. (권장) S10 에 `secret-store.md §2` 인터페이스 선언에 `deleteByPrefix` 시그니처 추가를 포함하거나 스코프 밖임을 명시.
3. (권장) D7 표/Rationale 의 «창 N» 표기에 `D7` 접두 일관 적용, 또는 다른 접두(`G1~G3`)로 교체.
4. (선택) `3-schedule.md` 포인터 추가, `pending_plans` dangling 항목 정리 — 둘 다 병합 차단 사유 아님.
