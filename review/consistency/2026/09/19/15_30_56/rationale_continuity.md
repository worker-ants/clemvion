# Rationale 연속성 검토 — `plan/in-progress/spec-draft-integration-db-test-waits.md`

## 발견사항

없음. 두 변경(A: §5.4 쿼리 대기, B: §6 절 번호) 모두 기존 `spec/2-navigation/4-integration.md` 의 `## Rationale` 과 충돌하지 않으며, target 문서 자신이 각 변경에 대한 새 Rationale 항목을 명시적으로 갖추고 있다. 상세 검증은 아래 "확인 근거" 참고.

## 확인 근거

### A. §5.4 — "연결 대기 10초" → "연결과 `SELECT 1` 각각 10초"

- 이 문장을 최초로 심은 것은 `plan/in-progress/spec-draft-integration-connection-tests.md`(2026-09-19, 이미 `spec/2-navigation/4-integration.md:499` 로 반영됨)다. 그 draft 의 `## Rationale` 을 확인했으나 "연결만 묶고 쿼리는 안 묶는다"를 **의도적으로 선택했다는 서술은 없다** — 그 draft 는 연결 테스트 자체의 존재 여부(다섯 서비스 중 무엇을 실제 구현할지)에 집중했고, 쿼리 단계의 대기 상한은 아예 논의되지 않은 공백이었다. 따라서 target 의 A 는 **명시적으로 기각된 대안을 되살리는 것이 아니라, 다뤄진 적 없는 공백을 메우는 것**이다 — "기각된 대안의 재도입"(관점 1) 에 해당하지 않는다.
- target 은 이 변경을 "구현을 spec 에 되돌리기"로 처리하지 않고 자체 Rationale 항목("A 를 «구현을 spec 에 맞춰 되돌리기» 로 처리하지 않는 이유")을 작성했다 — 관점 3(무근거 번복) 을 충족한다.
- 인용된 실측(`review/code/2026/09/19/15_02_57` WARNING 4 `[SPEC-DRIFT]`, `SUMMARY.md` L17)을 직접 확인 — 코드(`database-connection-tester.ts`)가 연결과 쿼리 양쪽에 독립 10초 상한을 이미 걸고 있고, 이는 "spec 문장이 구현을 놓쳤다"는 target 의 프레이밍과 일치한다.
- 기존 Rationale 의 관련 invariant("이 일회성 연결은 노드 실행의 커넥션 풀과 별개이며 풀에 남지 않는다", "연결 테스트 실패는 `consecutive_network_failures` 에 합산하지 않는다") 는 이 변경으로 우회되지 않는다 — 쿼리 대기 상한 추가는 이 두 invariant 와 직교한다.

### B. §6 `pending_install` 설명의 괄호 — `§9.3` → `§9.1`

- `spec/2-navigation/4-integration.md` 실제 구조를 확인: `POST /api/integrations/:id/test` 행과 `pending_install` 가드 서술은 L814, `### 9.1 목록·CRUD`(L805~L817) 범위 안에 있다. `### 9.3 사용처·활동`은 L834 부터다. target 의 재배치(§9.1)가 표 행 위치와 일치한다.
- 기존 Rationale "연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식" 의 "§9.1 표 비고에 명시한 이유" 항목이 이미 이 가드가 §9.1 표 비고에 있다고 명시하고 있다 — target 의 수정은 **이 기존 Rationale 과 정합**하며 그것을 뒤집지 않는다.
- 앞선 `--impl-prep`(`review/consistency/2026/09/19/13_21_00`)의 INFO 1 은 "§9.2"를 정답으로 제시했으나(그 리포트 SUMMARY 확인: "§9.3→§9.2 오기재"), target 은 이를 그대로 따르지 않고 표 행 위치로 재검증해 §9.1 이 맞다고 스스로 정정했다 — 그 근거를 Rationale 에 남겼다("B 의 번호를 표 행 위치로 정한 이유"). 이전 검토 결과를 무비판적으로 따르지 않고 실측으로 재확인한 점은 Rationale 연속성 관점에서 바람직하다.
- §9.1 관련 기존 Rationale("§9.1 의 `IntegrationDto` 인벤토리 주장 경계")은 `GET /:id` 응답 DTO 필드 범위에 관한 것으로, `:id/test` 가드 서술과는 다른 화제라 충돌 없음.

### 비대상 처리 (동시 실행 상한 · 닫기 상한을 spec 밖에 둠)

target 은 구현이 도입한 동시 실행 상한(프로세스당 2)과 닫기 상한(1초)을 "구현의 견고성 장치"로 분류해 spec 에 싣지 않고 CHANGELOG·트래커로 미룬다. 이 판단과 명시적으로 배치되는 기존 Rationale 은 발견되지 않았다 — 유사 사례(예: install rate limiting Layer 1/2)는 계약·보안 표면에 해당해 §9.1 비고에 실렸지만, 그것은 "외부 대면 계약 변경 여부"가 갈랐던 경우다. 동시 실행 상한은 API 응답 계약을 바꾸지 않으므로 같은 원칙 위반으로 보기 어렵다. 다만 이 경계("무엇이 계약이라 spec 대상이고 무엇이 견고성 장치라 spec 밖인가")가 아직 하나의 명문 원칙으로 Rationale 에 못박혀 있지 않다는 점은 향후 유사 판단이 반복될 때 참고용으로 남겨둘 만하다 — INFO 성격이며 이번 target 을 막을 사유는 아니다.

- **[INFO]** "계약 vs 견고성 장치" 경계 원칙의 명문화 여지
  - target 위치: `## 비대상` 첫 항목
  - 과거 결정 출처: 없음(신규 판단 — 반대 사례로 install rate limiting Layer 1/2 가 §9.1 비고에 실린 전례와 대비됨)
  - 상세: "동시 실행 상한·닫기 상한은 구현 견고성 장치라 spec 에 싣지 않는다"는 target 의 판단 자체는 합리적이나, 이 판단 기준(응답 계약을 바꾸는가 여부)이 아직 Rationale 에 원칙으로 기록돼 있지 않다. 향후 비슷한 "구현 세부사항을 spec 에 넣을지" 판단이 세션마다 반복 재논의될 여지가 있다.
  - 제안: 이번 draft 가 spec 에 반영될 때, 이 판단 기준 한 줄을 Rationale 에 남겨두면(예: "API 응답 계약을 바꾸지 않는 견고성 장치는 CHANGELOG 로 충분하다") 다음 유사 사례에서 재검토 비용을 줄일 수 있다. 차단 사유는 아니다.

## 요약

target 문서의 두 변경(§5.4 쿼리 대기 명문화, §6 절 번호 정정)은 모두 `spec/2-navigation/4-integration.md` 의 기존 `## Rationale` 과 충돌하지 않는다. §5.4 변경은 과거에 명시적으로 논의·기각된 적 없는 공백(쿼리 단계 타임아웃)을 메우는 것이라 "기각된 대안의 재도입"에 해당하지 않고, target 자신이 그 결정의 새 Rationale("구현을 spec 에 되돌리기로 처리하지 않는 이유")을 작성해 관점 3(무근거 번복) 도 충족한다. §6 변경은 실제 spec 파일 구조(§9.1 표 L805~817 안의 `:id/test` 행)와 기존 Rationale("§9.1 표 비고에 명시한 이유")이 이미 뒷받침하는 정정이며, 심지어 직전 impl-prep 리뷰의 제안(§9.2)조차 무비판 수용하지 않고 재검증해 근거를 남겼다. 두 인용 리뷰 리포트(`review/code/2026/09/19/15_02_57`, `review/consistency/2026/09/19/13_21_00`)는 실재하며 인용 내용과 일치함을 확인했다. Rationale 에 기록된 시스템 invariant(연결 테스트의 카운터 제외, 커넥션 풀 비공유 등) 를 우회하는 설계도 없다. 유일한 코멘트는 "계약 vs 견고성 장치" 경계 판단 기준을 향후 Rationale 에 원칙으로 명문화하면 좋겠다는 INFO 성격의 제안뿐이다.

## 위험도

NONE
