# Rationale 연속성 검토 — spec/2-navigation/

## 검토 범위 및 한계

번들이 컨텍스트 예산 초과로 15개 파일(`4-integration.md` 외 14개)의 본문을 절단했다. 실제로
전문을 검토할 수 있었던 파일은 세 개뿐이다: `1-workflow-list.md`, `2-trigger-list.md`,
`3-schedule.md`. 아래 발견사항은 이 세 파일에 한정된다 — 나머지 15개 파일은 Rationale 연속성
판정 불가(coverage gap)로 남는다.

본 작업(`plan/in-progress/trigger-release-stale-comments.md`)은 `spec_impact: none` 이고
`codebase/**` 의 stale 주석·메서드 이름만 고친다. target 인 `spec/2-navigation/` 자체는 이번 PR
에서 변경되지 않는다(plan 의 "비대상" 표: "spec 문서 | 이미 현재형(#1347) — 이 PR 은
`codebase/**` 만"). 따라서 이 검토는 diff 가 아니라 **현재 baseline spec 이 자기 자신의
Rationale 과 정합한지**를 확인하는 impl-prep 게이트로 수행했다.

## 발견사항

### [INFO] §4.3/§4.4 의 비대칭 실패 정책에 전용 Rationale 항목 부재

- target 위치: `spec/2-navigation/2-trigger-list.md` §4.3 "트리거 행을 없애는 모든 경로는 그
  트리거의 자원을 정리한다" (2026-09-17 결정) 및 §4.4 "락 대기 상한 5초"
- 과거 결정 출처: 같은 문서의 `## Rationale` R-1~R-17 관례 — 이 문서는 유의미한 설계 결정마다
  번호가 붙은 Rationale 항목(R-n)을 문서 말미에 두는 패턴을 일관되게 지켜왔다.
- 상세: §4.3 은 "외부 해제가 실패하면: provider teardown 은 best-effort 라 삭제를 계속하고,
  schedule job 해제가 실패하면 삭제를 멈춘다"는 비대칭 실패 정책을 새로 도입한다. schedule job
  실패가 삭제를 막는 이유("스케줄은 활성인데 발화하지 않는 상태를 남기지 않으려고")는 본문에
  바로 적혀 있으나, provider teardown 이 **왜 best-effort(비차단)인지**의 대칭적 근거는 §4.3 표의
  "teardown 이 secret_store 의 bot token 을 읽는다 / 외부 호출은 락 안에 두지 않는다(§3)" 문장에서
  간접적으로만 추론 가능하고, "실패해도 왜 막지 않아도 되는가"는 명시되지 않는다. 다만 이 인라인
  블록쿼트 서술 방식 자체는 §3 "동시 쓰기 직렬화" 절에서도 이미 쓰인 기존 패턴이라, **원칙 위반은
  아니고** 새 결정의 근거 밀도가 인접 R-n 항목들보다 낮다는 정도의 보완 여지다.
- 제안: §4.3 옆에 R-18 정도로 "provider teardown 은 best-effort, schedule job 해제는
  blocking — 비대칭 이유" 를 명시적으로 추가하면, 다음 사람이 "왜 한쪽만 막는가"를 재질문하지
  않아도 된다. 이번 PR 은 `spec_impact: none` 이므로 즉시 반영 의무는 아니며, 후속 spec 정비
  PR 에서 처리해도 무방하다.

### [INFO] 15개 파일 미검토 (컨텍스트 예산 절단)

- target 위치: `spec/2-navigation/4-integration.md`, `5-knowledge-base.md`, `6-config.md`,
  `8-marketplace.md`, `9-user-profile.md`, `_product-overview.md`, `0-dashboard.md`,
  `7-statistics.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`,
  `14-execution-history.md`, `15-system-status.md`, `16-agent-memory.md`, `_layout.md`
- 상세: 번들 조립기가 "본문 생략됨 — 컨텍스트 예산 초과"로 표시했다. 특히
  `2-trigger-list.md §3` 이 인용하는 `4-integration.md` 의 "cafe24-token-refresh 큐" Rationale(락
  기각 사유의 대조군으로 인용됨)은 원문을 확인하지 못해 그 인용이 지금도 정확한지 검증 불가.
- 제안: 트리거/스케줄 축과 직접 연관된 `4-integration.md`(cafe24 트리거 대조군) 만이라도 별도
  좁은 스코프로 재검토하면 이 인용의 정합성을 닫을 수 있다. 이번 작업 범위(`codebase/**` 만,
  spec 무변경)에서는 필수는 아니다.

## 정합성 확인 (문제 없음으로 판정한 항목)

검토 가능했던 세 파일 안에서 아래 항목들은 Rationale 과 본문이 정합했다 — 참고용으로 기록한다.

- `1-workflow-list.md` Rationale §1 이 명시적으로 기각한 대안 (b) `createdBy ≠ 현재 사용자` 기준의
  "공유" 정의는, §2.3 소유 필터에서 문자 그대로 다시 등장하지만 Rationale §1 자체가 "그 구분은
  §2.3 의 소유 필터가 담당" 이라고 역할 분담을 이미 승인해 두었으므로 재도입이 아니라 설계대로다.
- `2-trigger-list.md` R-2(웹훅 HMAC secret 입력/rotate 분리안)는 R-14 로 명시적으로 폐기·대체됐고,
  원문은 취소선으로 보존되어 있다. 본문 §3 PATCH 표는 R-14 의 단일 경로(`authConfigId`)만
  반영하며, 폐기된 인라인 인증 필드(`hmacSecret` 등)나 `/auth/rotate-secret` 엔드포인트를 다시
  끌어오지 않는다.
- R-4(`/toggle` 서브경로 미채택)와 R-16(drawer 안 `isActive` 는 read-only 배지)은 서로 다른 축(API
  계약 vs UI 표현)임을 R-16 이 명시적으로 구분해 적어, 두 항목이 겹쳐 보이는 지점에서 번복처럼
  읽히지 않게 해 두었다.
- R-17 "기각한 대안 — 음성 케이스를 지우는 것"은 본문 어디에서도 다시 채택되지 않았고, §3 응답
  형태 註가 그대로 음성 케이스 1건을 유지한다.
- §4.3 의 2026-09-17 신규 결정("모든 경로가 자원을 정리한다")은 §3 "동시 쓰기 직렬화" 절의 기존
  불변식("외부 호출은 락 밖", "쓰지 못했으면 되돌린다")과 충돌하지 않고 오히려 그 불변식이
  요구하는 "삭제 쪽이 비밀을 행 삭제 뒤에 지운다"는 짝을 그대로 구현한다.
- `3-schedule.md` Rationale 의 sort/order "Planned 해제"는 "기능 약속의 번복이 아니라 구현 완료에
  따른 문서 동기화"라고 스스로 명시해, 무근거 번복이 아님을 문서가 자체적으로 방어하고 있다.
- `3-schedule.md` §4 "보강 — 지금은 그 폴백에 닿지도 않는다"와 `2-trigger-list.md` R-17 이 서로
  인용하는 "재검토 신호"(optimistic update 도입 시 재논의)는 양쪽 문서에서 문구가 정확히
  대칭적으로 걸려 있어 한쪽만 갱신되고 다른 쪽이 stale 해지는 상황이 아니다.

## 요약

전문을 확인할 수 있었던 세 파일(`1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md`)에서는
기각된 대안의 무단 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 사례를 발견하지
못했다 — 오히려 R-2→R-14 폐기·대체, R-17 기각 대안 명시, §4.3 신규 결정과 §3 기존 불변식의
정합 등 이 문서군은 Rationale 연속성을 의도적으로 잘 관리해 온 편이다. 유일한 보완 여지는 §4.3의
비대칭 실패 정책(provider teardown best-effort vs schedule job blocking)에 대한 근거가 인접 R-n
항목들만큼 명시적이지 않다는 점(INFO)과, 컨텍스트 예산으로 15개 파일이 절단되어 그 파일들의
Rationale 연속성은 이번 회차에서 판정하지 못했다는 커버리지 한계(INFO)뿐이다. 이번 작업은
spec 을 변경하지 않는 codebase-only 작업이므로 이 두 INFO 는 impl-prep 을 막을 사유가 아니다.

## 위험도

LOW
