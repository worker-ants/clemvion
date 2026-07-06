### 발견사항

- **[INFO]** "Planned" 문구 정합성 — 이미 해소된 항목 재확인
  - target 위치: `spec/5-system/11-mcp-client.md` §6.2 라인 365 ("잔여 (Planned)")
  - 과거 결정 출처: `plan/in-progress/spec-sync-mcp-client-gaps.md` "타입 확장 cluster — 착수 설계" 절 (call-phase errors[] 누적을 "본 PR 범위 밖 — 후속 follow-up" 으로 명시적으로 deferred)
  - 상세: 과거 계획 문서는 call-phase `errors[]` 누적, 에러 message redaction(task_fa96e218), Rationale 섹션 신설(task_947e443e), connect timeout 의 `TimeoutError` 분류를 "잔여(별건 follow-up)"으로 명시적으로 유보했다. 이번 target 문서(및 diff)는 정확히 그 4개 잔여 항목을 완수하고, 남은 Planned 항목을 §3.3 `cached_capabilities` 캐시(진짜 infra 별건) 하나로 정확히 좁혔다. 과거 Rationale 이나 원칙을 뒤집는 것이 아니라, 명시적으로 예정된 후속 스코프를 계획대로 이행한 것으로 확인된다(위반 없음, 참고용으로만 기록).
  - 제안: 조치 불필요. 이번 target 갱신이 plan 문서의 "잔여" 목록과 정확히 대응하는지 최종 병합 전에 plan 문서 완료 요약을 갱신할 필요가 있는지만 developer/planner 가 확인.

- **[INFO]** §2.3 자기모순의 사전 해소 이력 확인
  - target 위치: `spec/5-system/11-mcp-client.md` §2.3 "에러 처리" 단락
  - 과거 결정 출처: 동일 브랜치 내 커밋 `67279fa20` (`fix(spec): §2.3 call-phase errors[] "Planned" 자기모순 정정`)
  - 상세: 이전 --impl-done 회차(00_00_54)에서 cross_spec checker 가 §2.3 이 §6.2/§8.1/§8.2 및 실제 구현과 모순된 "Planned" 문구를 지적했고(CRITICAL), 후속 커밋에서 정확히 해소되어 현재 HEAD 워킹트리에는 반영되어 있다. Rationale 연속성 관점에서 재차 확인한 결과 현재 target 은 이 모순이 이미 제거된 상태이며 재발 징후 없음.
  - 제안: 조치 불필요.

- **[INFO]** 신설 `## Rationale` 섹션이 문서 전체에 산재했던 근거를 성실히 회수
  - target 위치: `spec/5-system/11-mcp-client.md` 신규 `## Rationale` 섹션 (stdio 미지원, Internal Bridge 자가회복 예외, skipReason vs errors[].code 분리, SSRF throw-vs-warn, TimeoutError 분류, redaction 재사용 6개 항목)
  - 과거 결정 출처: 본문 §2.2/§2.3/§6.2/§3.2/§4.4/§8.3 에 inline 으로 흩어져 있던 기존 결정 근거
  - 상세: 이 Rationale 섹션은 기존 결정을 뒤집는 것이 아니라 본문에 이미 존재하던 근거를 요약·재배치한 것으로, 프로젝트 컨벤션("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")에 부합한다. 각 항목이 참조하는 §번호·기존 서술과 diff 를 대조한 결과 새로 주장을 추가하거나 과거 서술과 배치되는 내용은 없었다.
  - 제안: 조치 불필요. 모범 사례로 판단.

다른 spec 문서(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/2-navigation/2-trigger-list.md` 등)의 Rationale 을 전수 대조한 결과, 이번 target 변경(mcp-client 진단 파이프라인 call-phase 확장, timeout 분류, secret redaction, Rationale 섹션 신설)과 충돌하는 기각된 대안·합의 원칙 위반 사례는 발견되지 않았다. `spec/2-navigation/4-integration.md` Rationale 의 "공용 SECRET_LEAK_PATTERNS 재사용" 원칙 등은 이번 변경이 오히려 그대로 계승(공용 유틸 재사용, SoT 파편화 회피)하고 있다.

### 요약
이번 target 문서 변경은 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 사례가 없다. 오히려 `plan/in-progress/spec-sync-mcp-client-gaps.md` 에 명시적으로 "본 PR 범위 밖" 으로 유보됐던 4개 후속 항목(call-phase errors[] 누적, timeout 분류 확장, secret redaction, Rationale 섹션 신설)을 계획대로 이행했으며, 동일 브랜치 내에서 한 차례 발생했던 §2.3/§6.2 자기모순(Planned 문구 잔존)도 이미 별도 커밋(67279fa20)으로 해소된 상태다. 신설된 `## Rationale` 섹션은 새 결정을 발명하지 않고 본문에 산재했던 기존 근거를 프로젝트 컨벤션에 맞게 정합하게 재배치했다. Rationale 연속성 관점에서 문제 삼을 만한 사항은 발견되지 않았다.

### 위험도
NONE
