# Rationale 연속성 검토 — spec/2-navigation/ (impl-prep)

## 검토 범위

- **전문 포함(직접 검토)**: `spec/2-navigation/1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md` (각 본문 + `## Rationale`)
- **관련 Rationale 발췌만 검토**: `spec/data-flow/11-workflow.md`, `spec/0-overview.md`, `spec/1-data-model.md`, `spec/3-workflow-editor/{0-canvas,2-edge,3-execution,4-ai-assistant}.md`, `spec/4-nodes/0-overview.md`, `spec/4-nodes/1-logic/9-foreach.md` 의 `## Rationale` 절
- **본문 생략(컨텍스트 예산 초과)**: `spec/2-navigation/` 하위 15개 파일(`4-integration.md`·`6-config.md`·`9-user-profile.md`·`_layout.md` 등) — 아래 판정은 이 15개 파일의 내부 정합은 다루지 못한다.

## 발견사항

- **[INFO]** endpointPath "capability token" 프레이밍과 데이터모델의 "고엔트로피≠복사 방지" 정정 사이의 뉘앙스 차이
  - target 위치: `spec/2-navigation/2-trigger-list.md` R-15 (`외부 노출 webhook 무인증 경고 표시`), §2.5 트리거 생성 (`endpointPath 는 클라이언트가 crypto.randomUUID() 로 생성 — UUID 가 사실상 capability token`)
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → "Webhook `endpoint_path` 전역 유일 (2026-09-18)" — "12-webhook 은 «고엔트로피가 squatting·enumeration 을 막는다» 는 전제만 적었는데, 고엔트로피는 **추측**을 막을 뿐 **복사**는 막지 못한다."
  - 상세: R-15/§2.5는 "URL(UUID)을 아는 사람만 호출할 수 있다"는 capability-token 모델을 그대로 인용한다. 이는 "무단 호출"이라는 원래 위협(맞는 서술)에는 문제가 없으나, 데이터모델 쪽 최신 결정(2026-09-18/19)은 같은 UUID 프레이밍의 이면 — 그 경로를 **아는** 누군가가 다른 워크스페이스에 같은 경로를 등록해 **수신을 가로챌 수 있다**는, capability-token 가정이 깨지는 사례 — 를 이미 반증하고 전역 유일성 + 영구 예약으로 막았다. 두 문서가 서로 다른 위협(무단 실행 vs 경로 가로채기)을 다루므로 모순은 아니지만, R-15가 "capability token" 문구를 그대로 재사용하는 것은 데이터모델이 이미 한 번 정정한 신뢰 가정을 무비판적으로 다시 전제하는 것처럼 읽힐 여지가 있다.
  - 제안: 실제 API 계약(§2.3.1 endpointPath 행)은 이미 "다른 워크스페이스가 예약한 경로" 409 충돌을 정확히 반영하고 있어 동작 자체는 갭이 없다. 다만 R-15 본문에 "capability token 가정은 무단 실행 방지에 한정되며, 경로 가로채기 방지는 [1-data-model.md Rationale "Webhook endpoint_path 전역 유일"]이 별도로 담당한다"는 한 문장 상호참조를 추가하면 다음 독자가 두 Rationale을 하나의 신뢰 모델로 혼동하지 않는다.

- **[INFO]** 커버리지 한계 — 15개 파일 미검토
  - target 위치: `spec/2-navigation/4-integration.md`, `5-knowledge-base.md`, `6-config.md`, `8-marketplace.md`, `9-user-profile.md`, `_product-overview.md`, `0-dashboard.md`, `7-statistics.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `14-execution-history.md`, `15-system-status.md`, `16-agent-memory.md`, `_layout.md`
  - 과거 결정 출처: 해당 없음 (프롬프트 조립 단계의 컨텍스트 예산 절단)
  - 상세: 이 15개 파일은 본문이 프롬프트에 포함되지 않아 각자의 `## Rationale` 대비 본문 정합, 그리고 이 파일들이 1-workflow-list/2-trigger-list/3-schedule 과 상호 참조하는 지점(예: `4-integration.md#rationale`가 `install_token` 형식을 언급하는 부분, `9-user-profile.md`가 avatar 공개 정책을 참조하는 부분)의 연속성은 이번 라운드에서 검증하지 못했다.
  - 제안: impl-prep 대상 코드가 이 15개 파일 중 하나라도 건드린다면, 해당 파일을 개별 `Read`로 열어 본 라운드와 별도로 Rationale 연속성을 재확인할 것.

## 요약

전문 검토가 가능했던 `1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` 세 문서는 자체 `## Rationale`과 본문이 일관되며, 기각된 대안(예: "createdBy≠user" 공유 정의는 뱃지가 아닌 필터로 역할 재배정, `/toggle` 서브경로 미채택, HMAC secret 인라인 입력 폐기 후 R-14로 대체, duplicate의 "메타-only" 서술 철회 후 캔버스 전체 복사로 정정)를 다시 도입하지 않고, 폐기 이력은 취소선 + 정정 날짜 + 대체 Rationale 링크로 명시적으로 남아 있다. 데이터모델(`1-data-model.md`)·캔버스(`0-canvas.md`)·엣지(`2-edge.md`)·실행(`3-execution.md`) 쪽의 관련 Rationale(웹훅 endpoint_path 전역 유일·영구 예약, 트리거 단위 advisory lock, workflowId v1 잠금 등)도 target 본문에 정확히 반영되어 있어 원칙 위반이나 무근거 번복은 발견되지 않았다. 유일한 관찰 사항은 R-15의 "capability token" 표현이 데이터모델 쪽 최신 위협모델 정정과 완전히 정렬되진 않는다는 뉘앙스(INFO)와, 컨텍스트 예산으로 생략된 15개 파일은 이번 라운드 판정 범위 밖이라는 점이다.

## 위험도

NONE
