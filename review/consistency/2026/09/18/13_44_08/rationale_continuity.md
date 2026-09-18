# Rationale 연속성 검토 — spec-draft-deletion-cascade-indexes

## 발견사항

- **[WARNING]** `integration_usage_log`/`llm_usage_log` 쓰기 비용을 "따로 잰다"던 선행 결정을 추론으로 대체
  - target 위치: target 문서 `## 실측` > `### 쓰기 비용` (V113~V116 대상 두 로그 테이블 부분), 그리고 `## 변경안` S1의 V113·V114·V115·V116 도입부
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` > `### Trigger (workflow_id) 인덱스 (2026-09-18)`의 "같은 클래스 전수" 문단 —
    "특히 `integration_usage_log` 는 로그 테이블이라 행 수가 가장 클 수 있지만, INSERT 가 잦은 테이블에 인덱스를 더하는 것은
    쓰기 비용과 맞바꾸는 판단이라 **따로 잰다**."
  - 상세: 이 문장은 `integration_usage_log`(그리고 성격이 같은 로그 테이블인 `llm_usage_log`)에 인덱스를 추가하려면 실제
    쓰기 비용을 **실측**해야 한다는 방법론적 합의다. target 은 정확히 그 "따로" 작업(별도 PR)에 해당하는데, 실제로 측정한
    쓰기 비용은 `node_execution` INSERT 하나뿐이다(10만 행 5회, +8.7%). 두 로그 테이블에 대해서는 target 스스로
    "두 로그 테이블은 외부 호출(연동 API · LLM) 한 번에 1행이라 상대 비용이 더 작다 — **이것은 추론이고 로그 테이블
    INSERT 는 따로 재지 않았다**" 라고 명시해, 선행 결정이 요구한 실측을 수행하지 않고 유추로 대체했음을 스스로 인정한다.
    추론 자체는 타당해 보이지만(외부 I/O 호출이 인덱스 오버헤드를 압도), 선행 Rationale 이 명시적으로 "잰다"라고 적어 둔
    방법(측정)과 target 이 실제로 한 것(추론) 사이에 간극이 있다.
  - 제안: (a) `integration_usage_log`/`llm_usage_log` INSERT 벤치마크를 `node_execution` 과 같은 방식으로 실측해 표에 추가하거나,
    (b) 실측 대신 추론으로 충분하다고 판단한 근거(외부 I/O 호출 지배)를 `## Rationale`(S3, "삭제 연쇄의 FK 인덱스 다섯")에
    명시적으로 옮겨 적어, 선행 결정의 "따로 잰다" 문구를 이번 PR 이 "측정 대신 추론으로 충족했다"고 갱신하는 문장을 남긴다.
    지금처럼 `## 실측` 절에만 단서를 남기면 `## Rationale` 만 읽는 다음 사람이 이 간극을 놓친다.

- **[INFO]** 새 Rationale 절이 "따로 잰다" 커밋먼트를 닫는다는 사실을 명시적으로 교차 인용하지 않음
  - target 위치: target 문서 `## 변경안` > `### S3`, `## Rationale` > `### 왜 범위를 트래커 항목보다 넓혔나`
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` > `### Trigger (workflow_id) 인덱스` "같은 클래스 전수" 문단
  - 상세: target 은 S3 에서 "바로 아래 절의 «같은 클래스 전수» 가 부모를 둘로 한정했음을 적는다 — 그 절의 문장은 그
    범위에서 참이라 고치지 않고, 새 절이 넓힌 전수를 가리킨다" 라고 명시해 선행 Rationale 을 소급 수정하지 않는 좋은
    관행을 따른다. 다만 그 문단이 `integration_usage_log` 를 "쓰기 비용 트레이드오프라 따로 잰다"고 콕 집어 예고했던
    사실 자체는 인용하지 않는다 — 단지 "부모를 둘로 한정했다"는 스코프 차이만 언급한다.
  - 제안: S3 또는 `## Rationale` 새 절에 "선행 절이 예고한 `integration_usage_log` 별도 검토가 이 PR 이다" 한 문장을
    추가하면, 위 WARNING 항목이 지적하는 실측 여부 판단까지 한 곳에서 추적 가능해진다.

## 요약

target 은 `spec/1-data-model.md` 의 기존 Rationale(Trigger `(workflow_id)` 인덱스, Schedule 인덱스, `User` 민감 컬럼 등)이
세운 방법론 — 단독 컬럼 인덱스는 등치 술어 하나일 때만 정당화, partial index 는 nullable 컬럼일 때만, 대안은 실측으로
기각/채택, 선행 결정을 소급 확장하지 않고 새 절로 스코프를 명시 — 을 대체로 충실히 따른다. 특히 "«workflow`·`workspace`
FK 여섯»의 전제가 좁았다"는 자기 정정과 "그 절의 문장은 그 범위에서 참"이라는 서술은 소급 근거 부여를 피하는 이 저장소의
관행에 정확히 부합한다. 유일한 실질적 간극은 선행 Trigger 절이 `integration_usage_log`(로그 테이블)에 대해 명시적으로
예고한 "쓰기 비용은 따로 잰다"는 방법론을, target 이 실제 측정이 아니라 추론으로 충족했다는 점이다 — 추론 자체는
합리적이나 선행 합의가 요구한 실측 형식과 어긋나고, 이 사실을 `## Rationale` 이 아니라 `## 실측` 절에만 자백해 두어
다음 독자가 놓치기 쉽다. 기각된 대안의 재도입이나 명시적 invariant 위반은 발견되지 않았다.

## 위험도
MEDIUM
