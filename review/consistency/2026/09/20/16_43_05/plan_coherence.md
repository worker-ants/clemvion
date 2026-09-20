# Plan 정합성 검토 — `plan/in-progress/spec-draft-rotate-conflict.md`

## 발견사항

- **[WARNING]** Rationale "기각한 대안" 이 이 저장소의 확립된 락 패턴(advisory lock)을 언급하지 않는다
  - target 위치: draft `## 변경안` ⑤ `## Rationale` 새 항목 중 "기각한 대안 — `@VersionColumn` 낙관적 잠금" 단락
  - 관련 plan: `plan/complete/trigger-config-lost-update.md` (완료, 2026-09-15) — 거의 동일한 구조(읽기 → **외부 호출** → merge → 쓰기)의 lost-update 를 "advisory lock (트리거 단위) + 외부 호출은 락 밖 + 락 안에서 재읽기" 로 해소했다. 그 plan 은 스스로 §B "반대 선례와의 대조" 절에서 `spec/2-navigation/4-integration.md` 의 기존 advisory-lock 기각(Cafe24 토큰 갱신, "lock 보유 중 HTTP 요청을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고")을 인용하고, "그 사유가 정확히 이 설계가 지키는 제약이다 — 외부 호출을 락 밖으로 뺐으므로 그 반론이 적용되지 않는다" 고 명시한다.
  - 상세: draft 의 Rationale ⑤ 는 기각한 대안으로 `@VersionColumn` 하나만 적고 advisory lock 은 아예 등장하지 않는다. 그런데 rotate() 자체가 정확히 "읽기 → **연결 테스트(외부 호출, 수 초)** → merge → 부분 update" 구조라, trigger-config-lost-update 가 풀었던 문제와 형태가 같다. 이 draft 가 "이미 있는 컬럼을 조건에 넣는 조건부 update" 쪽으로 계약을 좁히는 것 자체는 무방하지만(계약만 정하고 구현 술어는 후속 PR 이 고른다는 입장과도 부합), Rationale 이 이 저장소에 이미 있는 "advisory lock + 외부호출 락 밖 + 락 안 재읽기" 패턴을 검토·기각한 이력 없이 건너뛰면 두 가지 위험이 생긴다: (1) 후속 developer PR 이 그 확립된 로컬 패턴을 모른 채 조건부 update 만 시도하다가, `logUsage` 의 `@UpdateDateColumn` 부작용(draft 스스로 지적한 "아직 검증하지 않은 의심") 때문에 막히면 그제서야 advisory lock 재검토로 왕복한다. (2) 반대로 리뷰 단계에서 "왜 이미 있는 advisory lock 패턴을 안 쓰나" 라는 질문이 나와 계약 확정 자체가 또 왕복한다.
  - 제안: draft(또는 병합 시 최종 spec Rationale)에 "advisory lock(트리거-config 선례) 도 검토했으나 [이유]로 채택하지 않음" 한 줄을 추가한다. 이유 후보 — rotate 의 임계 구간을 그 패턴처럼 짧게 만들려면 외부 호출(연결 테스트) 이후 락을 잡고 재검증해야 하는데, 연결 테스트 실패는 곧 사용자에게 즉시 보여줘야 하는 동기적 응답이라 "락 밖 재시도" 흐름을 다시 설계해야 해 조건부 update 보다 비용이 크다 — 등. 정확한 채택/기각 판단은 이 draft 가 미루는 구현 세부에 가까우므로, 최소한 이 대안이 "검토됐다" 는 사실과 그 근거 한 줄만 남기면 충분하다. 이 draft 의 체크리스트 "트래커: … developer 항목 재서술" 항목을 실행할 때 함께 반영하는 것을 권한다.

- **[INFO]** §9.4 편집 지점이 같은 절의 다른 미해결 항목과 인접한다
  - target 위치: draft `## 변경안` ① (`spec/2-navigation/4-integration.md §9.4` 새 코드 행 추가)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 열린 항목 "rotate 의 테스트 실패 응답이 400인데 spec은 422 — 두 spec 이 서로도 어긋난다" (같은 §9.4 의 `INTEGRATION_TEST_FAILED` 행을 대상으로 하는 미해결 결정, planner 결정 대기 중)
  - 상세: 두 항목은 서로 다른 코드(`INTEGRATION_TEST_FAILED` 의 상태코드 정정 vs 신규 `INTEGRATION_ROTATE_CONFLICT` 추가)를 다뤄 논리적으로 충돌하지 않는다. 다만 같은 §9.4 목록의 인접 행을 서로 다른 두 plan 이 독립적으로 편집할 예정이라, 어느 한쪽이 먼저 병합되면 다른 쪽 diff 가 그 변경분을 재확인해야 한다.
  - 제안: 조치 불필요 수준이나, 두 plan 항목이 서로를 참조해 두면(“같은 §9.4, 인접 행” 한 줄) 나중 착수자가 diff 충돌 없이 반영하기 쉽다.

## 요약

target draft 는 트래커 항목("동시 rotate 두 건은 나중 저장이 먼저 통과한 교체를 조용히 덮는다")을 정확히 인용하고, 실측(코드 4곳의 `last_rotated_at` 소비 경로, `logUsage` 가 자격증명을 건드리지 않는다는 것)에 근거해 계약만 확정하고 구현 술어 선택은 후속 PR 로 명시적으로 미루는 등 범위를 신중하게 좁혔다. `plan/in-progress/**` 의 다른 열린 결정과 직접 충돌하는 지점은 없고, 전제(연결 테스트가 실제로 수 초 걸리게 된 변경)도 이미 완료된 plan 들로 뒷받침된다. 다만 Rationale 의 "기각한 대안" 이 이 저장소가 최근에 확립한 "advisory lock + 외부호출 락 밖 + 락 안 재읽기" 패턴(같은 성격의 lost-update 를 해소한 완료 plan, 그리고 같은 spec 파일 자신의 기존 advisory-lock 기각 근거)을 언급하지 않는 점은 후속 developer PR 의 왕복 위험이 있어 보강을 권한다. §9.4 를 동시에 건드리는 다른 미해결 항목과의 인접성은 정보 제공 수준이다.

## 위험도
LOW
