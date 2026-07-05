# Cross-Spec 일관성 검토 — spec-draft-g1-withdraw-ws-start-gate

검토 대상: `plan/in-progress/spec-draft-g1-withdraw-ws-start-gate.md` (spec draft, `--spec` 모드)
영향 파일: `spec/5-system/4-execution-engine.md §11`, `spec/5-system/2-api-convention.md §10.3`, `plan/in-progress/execution-engine-residual-gaps.md` (G1)

## 발견사항

### [INFO] 변경 대상 3개 spec 파일 사실관계는 검증됨 — 실제 충돌 없음

- target 위치: "사실관계 (검증됨)" 절, 변경 1·2·3
- 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.2`(line 197-228, Rationale line 955-958), `spec/3-workflow-editor/3-execution.md §8.2`(line 309-322), `spec/5-system/4-execution-engine.md §11`(line 1222-1247), `spec/5-system/2-api-convention.md §10.3`(line 273-279)
- 상세: 실제 spec 파일을 직접 읽어 대조한 결과, target 이 인용한 모든 line 번호·인용문·cross-ref 오류 서술이 현재 저장소 상태와 정확히 일치한다.
  - `6-websocket-protocol.md §4.2` 는 실제로 `execution.start`/`stop`/`continue`/`step` 을 `_(계획·미구현)_`으로 명시하고 "구현 현실 — 실행 시작/중단은 REST" 안내문을 갖고 있다. Rationale 에도 "삭제하지 않고 본문에서 _(계획·미구현)_ 로 표기 분리" 문구가 그대로 존재한다.
  - `3-execution.md §8.2` 는 실제로 "실행 **시작**은 WS 명령이 아니라 REST … WS 명령은 채널 구독·입력 대기 상호작용에 한정" 문구와 명령 표에 `execution.start` 없음을 그대로 보여준다.
  - `4-execution-engine.md §11` line 1226·1228 은 target 이 지적한 그대로 (a) 활성 gate 대상에 WS `execution.start` 포함, (b) `§8.2(3-execution.md)` 로의 잘못된 cross-ref(실제로는 `6-websocket-protocol.md §4.2` 가 정의처), (c) "Phase 2 에서 WS handler 신설 시 동일 gate 추가 예정" stale forward-ref 를 담고 있다.
  - `api-convention.md §10.3` line 278 은 실제로 `execution.start/stop/continue` 를 Planned 표기 없이 나열한다.
- 제안: 없음 (문제 아님). draft 의 "실제 결함" 진단이 코드베이스/spec 현재 상태와 정합적이므로 Cross-Spec 충돌 관점에서는 안전하게 채택 가능.

### [INFO] 변경 3 (api-convention §10.3) 은 `spec-sync-websocket-protocol-gaps.md` 추적 항목과 중복 소지 — draft 자체가 이미 스코프 분리 명시

- target 위치: "변경 3" 절 주석("api-convention §10 전반의 WS 정합은 `spec-sync-websocket-protocol-gaps.md` 소관 — 본 변경은 execution.start 정합에 직접 관련된 최소 마커만")
- 충돌 대상: `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 미구현 항목 목록 3번째 줄 — "`execution.start` / `execution.stop` WS 명령 + `execution.start.ack`"
- 상세: 두 plan/spec-draft 가 동일한 `execution.start`/`stop` Planned 상태를 별도 경로로 각각 건드리게 된다. 실제로는 충돌이 아니라 스코프가 다르다 — `spec-sync-websocket-protocol-gaps.md` 는 `6-websocket-protocol.md` 자체의 미구현 표면 추적(이미 해당 spec 본문에 반영 완료 상태), draft 의 변경 3 은 `api-convention.md` 쪽 표기 누락만 최소 보정. 다만 두 문서 모두 "execution.start Planned" 를 소재로 삼고 있어 향후 `spec-sync-websocket-protocol-gaps.md` 종결 시 교차 참조 정합성 재확인이 누락되기 쉽다.
- 제안: 문제 삼을 필요는 없음(draft 가 이미 명시적으로 disclaim). 다만 `spec-sync-websocket-protocol-gaps.md` 완료 처리 시점에 "api-convention §10.3 의 execution.start 마커도 함께 재확인" 한 줄을 그 plan 에 덧붙여 두면 향후 양쪽이 서로를 잊고 stale 화되는 것을 방지할 수 있다.

### [INFO] "G1" 라벨이 무관한 다른 spec/plan 문맥에서 이미 사용 중 — 요구사항 ID 충돌 아님(namespace 분리 확인됨)

- target 위치: 전체 draft (제목·plan 변경 4 의 "G1 WITHDRAWN")
- 충돌 대상: `spec/5-system/13-replay-rerun.md` (`RR-PL-07 — AI Assistant 비트리거 (G1)`, line 43·68·132·518), `plan/in-progress/sqitch-poc.md` (`G1 — 대표 샘플 포팅`)
- 상세: 두 곳 모두 "G1" 이라는 동일 라벨을 완전히 다른 의미로 이미 사용 중이다. 그러나 `execution-engine-residual-gaps.md` 의 G1 은 정식 요구사항 ID(`RR-PL-*`, `NAV-*` 류)가 아니라 plan 파일 내부의 로컬 gap 넘버링이고, `replay-rerun.md` 의 진짜 요구사항 ID 는 `RR-PL-07` 이며 "(G1)" 은 그 문서 내부 표(§)의 행 라벨일 뿐이다. 따라서 형식적 ID 충돌은 아니다 — namespace 가 분리돼 있어 실제 파싱/참조 혼동 위험은 낮다.
- 제안: 조치 불필요. 다만 향후 grep 기반 검색 시 "G1" 단독 키워드로는 3개의 서로 다른 문맥이 뒤섞여 나오므로, 커밋 메시지·PR 제목에 항상 "execution-engine G1" 처럼 도메인을 붙이는 관례를 유지할 것을 권장(이미 draft 제목이 "G1 철회 — engine §11 의 stale WS..." 로 이 관례를 따르고 있어 실무상 문제 없음).

### [INFO] `spec_impact` 프런트매터가 `plan/in-progress/execution-engine-residual-gaps.md` 를 명시적으로 포함하지 않음

- target 위치: draft frontmatter `spec_impact:` (line 28-30) — `spec/5-system/4-execution-engine.md`, `spec/5-system/2-api-convention.md` 만 나열
- 충돌 대상: 변경 4 가 실제로 `plan/in-progress/execution-engine-residual-gaps.md` (G1 헤딩·체크박스·진행 상태·완료 조건) 를 수정 대상으로 명시
- 상세: `spec_impact` 는 관례상 `spec/**` 문서를 가리키는 필드이고 plan 파일은 원래 그 목록의 대상이 아니므로 규약 위반은 아니다. 다만 변경 4 가 실질적으로 이 draft 의 핵심 산출물(G1 상태를 BLOCKED→WITHDRAWN 으로 전환)이라는 점에서, 체크리스트("spec 반영 + plan G1 WITHDRAWN")가 이를 이미 별도 항목으로 추적하고 있어 실무상 누락 위험은 낮다.
- 제안: 조치 불필요(정보성 확인).

## 요약

target draft 가 인용하는 4개 spec 위치(`6-websocket-protocol.md §4.2`, `3-execution.md §8.2`, `4-execution-engine.md §11` line 1226·1228, `api-convention.md §10.3` line 278)를 실제 저장소와 직접 대조한 결과, 인용된 문구·line 번호·cross-ref 오류 진단이 모두 현재 spec 상태와 정확히 일치한다. WS `execution.start` 가 이미 `6-websocket-protocol.md` 에서 공식적으로 Planned 로 분리돼 있고 `3-execution.md §8.2` 가 REST-only 를 명시적으로 확정하고 있으므로, engine §11 의 gate 목록에서 WS 항목을 제거하고 stale forward-ref 를 정정하는 draft 의 변경 1·2·3 은 다른 영역과 새로운 모순을 만들지 않는다. `api-convention.md §10.3` 변경은 `spec-sync-websocket-protocol-gaps.md` 추적 항목과 소재가 겹치지만 draft 가 스코프를 명시적으로 disclaim 했고 실제 파괴적 중복은 없다. "G1" 라벨의 타 문맥 재사용, plan 파일에 대한 WITHDRAWN 마킹 등은 모두 INFO 수준의 정보성 관찰이며 채택을 막을 조건이 아니다. Cross-Spec 관점에서 CRITICAL/WARNING 급 발견은 없다.

## 위험도

NONE
