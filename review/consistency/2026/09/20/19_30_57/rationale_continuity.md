# Rationale 연속성 검토 — spec/2-navigation (--impl-prep, dup-delete-audit)

## 검토 범위와 방법

target 은 `spec/2-navigation` 번들(1-workflow-list.md · 2-trigger-list.md · 3-schedule.md 전문 +
나머지 15개 파일은 컨텍스트 예산으로 생략)과, 여기 걸리는 "관련 Rationale 발췌"(0-overview ·
1-data-model · 3-workflow-editor/* · 이하 다수 spec 의 `## Rationale` 절)다. 실제 작업
(`plan/in-progress/dup-delete-audit.md`)은 `spec_impact: none` — 동시 워크플로우 DELETE 두 건이
`workflow.deleted` 감사 행을 중복 기록하는 결함을 `WorkflowsService.remove()` 코드만 고쳐 닫는
백엔드 전용 수정이다. spec 변경이 없으므로, 본 검토는 (a) target 번들 자체가 자기 Rationale 과
정합한지, (b) 이 코드 수정이 target 이 이미 문서화한 원칙·invariant 와 충돌하지 않는지 두 축으로
확인했다. 예산 초과로 생략된 파일 중 이번 변경과 직접 관련된 두 개(`spec/data-flow/11-workflow.md`,
`spec/data-flow/1-audit.md`)는 `Read` 로 전문을 확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 확인된 사실 관계는 다음과 같다.

- **[INFO] duplicate 관련 과거 기각 결정이 target 에 재도입되지 않았음을 확인**
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.6 (더보기 메뉴 "복제") · §3 API
    (`POST /api/workflows/:id/duplicate`)
  - 과거 결정 출처: `spec/data-flow/11-workflow.md` `## Rationale` "duplicate 는 캔버스 전체를
    복제한다 (메타-only 였던 서술의 철회)" — 한때 "workflow 메타 row 만 복제, nodes/edges 는
    복제하지 않는다" 로 서술됐던 것을 **철회**하고, "spec 을 코드에 맞춰 메타만 복제로 하향
    확정"을 명시적으로 **기각한 대안**으로 적어 두었다. 같은 문서의 "duplicate 가 export/import 를
    재사용하지 않는 이유", "복제가 버전 이력·트리거·데이터셋을 승계하지 않는 이유"(기각한 대안:
    복제본에도 Manual Trigger 자동 생성)도 함께 있다.
  - 상세: target 은 "노드·엣지를 포함한 **캔버스 전체**가 복사되고 ... 버전 이력·트리거·테스트
    데이터셋은 승계하지 않는다"(§2.6), "노드·엣지 포함 캔버스 전체를 한 트랜잭션으로 복사"(§3)로
    적혀 있어 위 세 Rationale 이 확정한 결과와 정확히 일치한다. 기각된 "메타-only" 대안이나
    "export/import 재사용", "복제본에 Manual Trigger 자동 생성" 중 어느 것도 target 에 재도입되어
    있지 않다.
  - 제안: 조치 불요 — 정합 확인용 기록.

- **[INFO] 트리거 "동시 삭제 → 두 번째 404" 선례와 이번 코드 수정의 방향 일치**
  - target 위치: `spec/2-navigation/2-trigger-list.md` §4.4 결과·에러 ("동시 삭제: 두 클라이언트가
    동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`")
  - 과거 결정 출처: 동일 target 문서 §4.4 자체 (트리거 삭제 경합 처리 정책, spec 본문이지
    `## Rationale` 절은 아니나 이미 합의된 동작으로 고정돼 있다)
  - 상세: `plan/in-progress/dup-delete-audit.md` 가 고치려는 것은 워크플로우 DELETE 동시 요청 시
    두 번째가 (없는 행을 조용히 지운 것처럼) 200 + 중복 audit 행을 남기던 결함을, "잠근 뒤 부모
    부재를 감지해 404 로 끝낸다" 로 바꾸는 것이다. 이는 **트리거 삭제가 이미 문서화한 것과 같은
    모양의 동작**(동시 삭제 시 패자는 404)을 워크플로우 삭제에도 갖추는 방향이라, target 이 세운
    원칙과 배치되지 않는다 — 오히려 정합을 높이는 방향이다. `spec/data-flow/11-workflow.md` §3.1
    FK 파급 표·§2.1 삭제 행("트리거 자원 정리: ... 잠금 대기 상한(5초)을 건 뒤 `workflow` 행을
    먼저 잠그고(pessimistic_write)")도 이미 "잠근 뒤 처리" 모델을 전제하고 있어 이번 수정 방향과
    상충하지 않는다.
  - 제안: `spec_impact: none` 그대로 유효 — 이 변경은 기존에 문서화된 "동시 삭제 시 패자는
    409/404" 계열 원칙을 코드 쪽에서 워크플로우까지 넓히는 것뿐이라 spec 본문 변경 의무는 없다.
    다만 향후 `1-workflow-list.md` §2.6 "삭제" 행에 트리거 §4.4 와 대칭되는 한 줄
    ("동시 삭제 시 두 번째 요청은 404")을 추가해 두면 두 리소스의 삭제 정책이 문서 층위에서도
    대칭을 이루게 된다 — 이번 PR 범위 밖의 문서 보강 제안이며 차단 사유는 아니다.
  - 등급을 INFO 로 둔 이유: target 에 이 수정과 **모순되는** 서술이 없고, 오히려 지지하는 선례가
    있다는 점을 확인한 것이라 CRITICAL/WARNING 대상이 아니다.

- **감사 로그 관련 invariant 미충돌 확인**: `spec/data-flow/1-audit.md` `## Rationale` ("기록 실패는
  삼키고, 호출은 await 한다" 등)는 `record()` 의 실패-흡수 계약만 다루며, "동일 리소스에 대해
  같은 액션이 두 번 기록되지 않는다" 류의 idempotency invariant 는 어디에도 선언돼 있지 않다.
  따라서 이번 수정이 "감사 행 중복 방지"를 코드 레벨에서 새로 강제하는 것은 기존에 문서화된 어떤
  결정도 뒤집지 않는다 — 뒤집을 대상 자체가 spec 에 없다.

- 나머지 `spec/2-navigation` 번들 파일(3-schedule.md 전문 및 예산 초과로 생략된 15개 파일 중
  Read 로 직접 연 것 외의 파일)에서, target 이 관련 발췌 Rationale(0-overview·1-data-model·
  3-workflow-editor 각 파일)이 명시적으로 기각한 대안을 재도입하거나, 명시된 설계 원칙(예: FK
  cascade 방향, endpoint_path 전역 유일·영구 예약, trigger `config` advisory lock, `select: false`
  기각 원칙 등)을 위반하는 지점은 발견하지 못했다. 특히 trigger-list.md 는 자체 R-1~R-17 상당수가
  과거 결정의 정정·폐기를 날짜와 함께 명시(R-2 "폐기 — R-14 로 대체" 등)하고 있어 연속성 관리가
  양호하다.

## 요약

이번 `dup-delete-audit` 작업은 `spec_impact: none` 인 코드 전용 동시성 버그 수정이며, target
`spec/2-navigation` 번들(과 직접 관련된 `data-flow/11-workflow.md`·`data-flow/1-audit.md` 전문)을
대조한 결과 과거 Rationale 이 명시적으로 기각한 대안의 재도입이나 합의된 설계 원칙 위반은 발견되지
않았다. 오히려 트리거 삭제에 이미 문서화된 "동시 삭제 시 패자는 404" 정책과 방향이 일치해, 이번
변경이 spec 층위의 새 결정 없이도 기존 원칙의 자연스러운 확장으로 읽힌다. 예산 초과로 프롬프트에서
생략된 `spec/2-navigation` 의 12개 파일(4-integration·6-config·9-user-profile 등)과 다수의 cross-spec
Rationale 발췌는 이번 변경 범위와 관련성이 낮아 전수 대조하지 않았다 — 그 사실을 "문제 없음"의
근거로 삼지 않는다.

## 위험도

NONE
