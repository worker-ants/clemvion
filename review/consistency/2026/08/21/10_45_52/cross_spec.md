# Cross-Spec 일관성 검토 — masked-marker-shared-package plan draft

## 발견사항

- **[WARNING]** R17 의 "backend SoT / 프런트 미러" 서술이 추출 후 사실과 어긋나게 된다
  - target 위치: `plan/in-progress/masked-marker-shared-package.md` "무엇을 옮기나" 절 및 "작업" 체크리스트 (spec_impact 에는 `spec/5-system/14-external-interaction-api.md` 가 등재돼 있으나, 체크리스트 항목 중 이 spec 문장을 갱신하는 항목은 없음)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` R17, 줄 1624-1625 — `"마커 집합은 backend sanitize-error-message.ts 가 SoT 이고 프런트가 미러한다 — 어긋나면 가드가 조용히 뚫리므로 양쪽을 함께 갱신한다."` 및 code 주석 `codebase/frontend/src/lib/utils/masked-markers.ts:3,11`(`"VALUE_MASK_MARKER/KEY_MASK_MARKER/DEPTH_MASK_MARKER 의 프런트 미러다"`) — 같은 "backend=SoT, frontend=mirror" 프레이밍.
  - 상세: target 은 마커 상수·`isMaskedMarker`·깊이 상한을 `codebase/packages/masked-markers/` 로 이관하고 backend/frontend 양쪽은 재export 만 한다. 이관이 끝나면 실제 SoT 는 backend 파일이 아니라 공유 패키지가 되고, frontend 는 더 이상 "손으로 미러"하는 게 아니라 같은 소스를 재export 할 뿐이다. 즉 R17 의 "backend 가 SoT · 프런트가 미러 · 어긋나면 가드가 뚫린다" 라는 위험 서술 자체가 이관 후에는 성립하지 않는 낡은 아키텍처 서술이 된다(오히려 이관이 그 위험을 구조적으로 없앤다). spec_impact 에 파일은 이미 등재돼 있어 위험 인지는 있지만, 정작 무엇을 어떻게 고칠지 target 본문에 구체 지시가 없다. `developer` 는 `spec/` read-only 이므로, 이 구체 지시가 없으면 코드 이관만 끝내고 이 문장은 그대로 남을 위험이 crystal clear 하다(프로젝트 규약상 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 이지만, 그 트리거가 되려면 developer 가 이 문장의 존재를 알아채야 한다).
  - 제안: target 의 "작업" 체크리스트에 명시적 항목 추가 — 예: "`spec/5-system/14-external-interaction-api.md` R17 의 'backend SoT/프런트 미러' 문장을 'SoT 는 `@workflow/masked-markers`' 로 갱신". 이 저장소에 이미 동일 패턴의 정본 사례가 있다 — `spec/conventions/interaction-type-registry.md:121`, `spec/4-nodes/3-ai/1-ai-agent.md:463`, `spec/4-nodes/3-ai/3-information-extractor.md:462` 가 `@workflow/ai-end-reason` 추출 후 정확히 `"SoT 는 [@workflow/ai-end-reason](../../codebase/packages/ai-end-reason/)"` 형태로 갱신했다. 같은 문구 패턴을 따르면 된다. (부수: 소스 주석 `masked-markers.ts:3,11`·`sanitize-error-message.ts:131` 도 "프런트 미러다" 프레이밍이므로 이관 시 함께 다듬는 편이 낫다 — 이건 code, 즉 code-review 스코프이지만 같은 근거라 여기 같이 적는다.)

## 요약

target 은 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 축에서도 다른 영역과 직접 모순을 만들지 않는다. `MASKED_MARKERS`/`isMaskedMarker`/깊이 상한을 참조하는 spec 은 `spec/5-system/14-external-interaction-api.md` 하나뿐이며(전수 grep 확인), 그 문서는 이번 추출을 그대로 반영해도 R17 의 핵심 불변식(정확 일치 감지·Manual 실행 경로 2층 가드·egress-only 마스킹·`MASKED_VALUE_RESUBMITTED`)과 충돌하지 않는다 — target 스스로 "동작 무변경" 을 검증 기준으로 못박고 있어 이 전제와 일치한다. WS 쪽 `MAX_SANITIZE_DEPTH`(11)를 의도적으로 통합 대상에서 뺀 결정도 spec 의 "boundary masking parity" 원칙(= 마스킹 적용 여부의 parity 이지 깊이 숫자의 parity 가 아님)과 어긋나지 않는다. 유일한 실질 발견은, 추출이 완료되면 R17 의 "backend SoT / 프런트 미러" 서술이 사실과 어긋나게 되는데 target 의 작업 체크리스트가 이를 구체적으로 다루지 않는다는 점이다 — 이 저장소에 이미 `@workflow/ai-end-reason` 이관 시 spec 을 "SoT 는 [패키지]" 형태로 갱신한 정본 선례가 있으므로, 그 문구를 그대로 따라 R17 을 갱신하는 항목을 target 에 추가하는 것으로 해소 가능하다.

## 위험도
LOW
