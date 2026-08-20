STATUS=success architecture review complete — 0 CRITICAL, 2 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 아키텍처 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17)

## 검토 범위

핵심 코드 변경 8곳(파일 1~8) — 신규 판정 유틸 `reject-masked-resubmission.ts`, 이를 소비하는
두 호출부(`executions.service.ts`, `workflows.controller.ts`), 타입/에러 카탈로그 확장
(`trigger-parameter.types.ts`), `sanitize-error-message.ts` 의 export 승격 — 을 중심으로 보고,
spec 문서(파일 35~41)는 설계 의도 대조용으로만 참조했다. `review/consistency/**` 산출물(파일
11~34)은 이 PR 자체가 이미 반영한 이전 라운드의 검토 결과물이라 별도 아키텍처 이슈로 다루지 않았다.

## 발견사항

- **[WARNING]** 마스커와 판정기가 같은 깊이 상한을 **각자 손으로 재귀 구현**하고 있고, 둘을
  교차 검증하는 라운드트립 테스트가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 의
    `hasMaskedLeaf` 함수, `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의
    `deepRedactCore`/`deepRedactObject` 함수
  - 상세: 두 함수는 `MAX_REDACT_DEPTH` 상수와 "값 검사가 깊이 검사보다 먼저" 라는 순서 불변식을
    **주석으로만** 공유한다. 실제 재귀 순회(카운팅 시작점, credential-key 분기, 배열/객체 처리
    순서)는 두 파일에 독립적으로 존재한다. 직접 역추적한 결과 — 실서비스 마스커는 캡이 걸리는
    노드를 **통째로 대체**하므로 마커가 실제로 놓이는 깊이는 필드값 기준 9회 unwrap 지점인데,
    판정기의 테스트(`atCap = nestObj(MAX_REDACT_DEPTH, VALUE_MASK_MARKER)`)는 10회 unwrap 지점에
    마커를 심는다. 이번엔 판정기의 "먼저 값 검사" 순서 덕에 여유 마진 한 단계가 있어 실제로는
    탐지에 성공하지만(직접 추적 확인), 이 여유는 **의도적으로 설계된 것이 아니라 우연한 산물**이고
    두 재귀 구현 중 하나가(특히 마스커 쪽의 캡 처리 순서·credential-key 우선순위 등) 바뀌면 아무
    경고 없이 깨질 수 있다. 이 저장소 자신이 반복 지적해 온 "미러 발산" 패턴을 상수(`MAX_REDACT_DEPTH`,
    `isMaskedMarker`)는 공유해 피했지만 **재귀 알고리즘 자체**는 여전히 두 벌이다. `reject-masked-resubmission.spec.ts`
    는 `findMaskedResubmissions` 단독으로만 경계를 고정하고, 실제 `deepRedactSecrets`(또는
    `redactStoredDataForResponse`)의 출력물을 그대로 판정기에 넣어 확인하는 통합 테스트는 없다.
  - 제안: (a) 가장 값싼 방어로, `deepRedactSecrets` 로 깊이-캡에 걸리는 값을 실제로 만들어
    (`{p: deeply-nested-secret}` → 마스킹 → 그 출력을 `findMaskedResubmissions` 에 통과) 라운드트립을
    검증하는 캐너리 테스트 1개를 추가한다. (b) 여력이 되면 두 파일이 공유하는 generic tree-walk
    헬퍼(leaf visitor 를 인자로 받는 형태)를 `sanitize-error-message.ts` 에서 export 해 재귀 자체를
    한 곳으로 합친다 — 현재처럼 상수만 공유하고 순회 로직을 이중 구현하는 상태보다 발산 위험이 낮다.

- **[WARNING]** 동일한 "판정 후 throw" 4줄이 두 호출부에 그대로 중복되어 있고, 이 PR 자체가
  그 두 호출부의 미러 발산(에러 봉투 키 `errors` vs `details`)을 이미 한 번 겪었다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`resolveTriggerParameters`
    호출 직후 try 블록), `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute`
    메서드의 동일 try 블록)
  - 상세: 두 곳 모두 `const masked = findMaskedResubmissions(parameters); if (masked.length > 0) throw new TriggerParameterValidationException(masked);`
    를 문자 그대로 반복한다. `findMaskedResubmissions` 자체는 잘 추출돼 있지만 그 호출-후-throw
    래핑까지는 공유되지 않았다. 첨부된 consistency-check 산출물(`19_34_37/naming_collision.md`)이
    보여주듯, 이 PR 의 이전 라운드에서 정확히 이 두 호출부 사이의 에러 봉투 배선(`errors` 키로
    새는 vs `details` 키로 정규화)이 갈렸던 이력이 있다 — 지금은 그 결함을 고쳤지만(파일 5 diff),
    "같은 판정 로직을 두 곳에 복붙"하는 구조 자체는 남아 있어 다음 변경(예: 세 번째 reason 추가,
    로깅 추가)에서 같은 클래스의 드리프트가 재발할 소지가 있다.
  - 제안: `rejectIfMaskedResubmission(parameters: Record<string, unknown>): void` 같은 3줄짜리
    헬퍼로 "판정+throw" 만 추출한다(에러 봉투 조립은 catch 블록에 남겨 두 호출부의 서로 다른 wrapping
    은 그대로 유지). 비용이 낮고, 이미 한 번 실제로 발생한 드리프트 클래스를 구조적으로 줄인다.

- **[INFO]** Manual 트리거 파라미터 검증(스키마 resolve + 이번 마스킹 재제출 거부)이 여전히
  컨트롤러/서비스 레이어에 직접 인라인돼 있다 (이 PR 이 만든 문제는 아님)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` `execute` 메서드,
    `codebase/backend/src/modules/executions/executions.service.ts` `reRun` 메서드
  - 상세: `resolveTriggerParameters` 호출과 그 try/catch 는 이 PR 이전부터 컨트롤러/서비스에
    바로 박혀 있었고, 이번 PR 은 정확히 같은 자리에 새 판정을 얹었을 뿐이다 — 새로운 레이어 위반이
    아니라 기존 구조의 연장이다. 다만 두 진입점(REST 컨트롤러, 서비스)에 검증 로직이 나뉘어 있는
    현재 형태는 "Manual 트리거 파라미터 검증"이라는 하나의 도메인 규칙이 두 계층에 흩어져 있다는
    뜻이라, 세 번째 소비처가 생기면 다시 같은 자리에 손으로 복붙될 가능성이 높다.
  - 제안: 즉시 조치 불요(스코프 밖). 다음에 이 검증 축에 항목을 추가할 일이 생기면(예: 네 번째
    reason) 이 기회에 "trigger parameter 검증 파이프라인"을 하나의 함수(스키마 resolve → 마스킹
    거부 → 반환)로 묶어 두 호출부가 그 파이프라인만 부르게 하는 것을 고려할 만하다.

- **[INFO]** 신규 에러 코드 확장이 닫힌 union + exhaustive `Record` 매핑(개방-폐쇄 원칙을 잘
  지킨 패턴)을 그대로 따른다 — 지적이 아니라 확인
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    `REASON_TO_DETAIL`
  - 상세: `reason`/`code` 를 문자열 리터럴 union 으로 닫아 두고 `Record<Reason, Detail>` 로
    매핑해, 새 reason 을 추가하면 컴파일러가 매핑 누락을 강제한다. 이번 PR 은 기존 항목을
    변경하지 않고 새 case 를 추가하는 방식으로 확장해 Open/Closed 원칙에 부합한다. `resolveTriggerParameters`
    같은 공유 프리미티브 내부에 조건 분기를 넣지 않고 별도 함수(`findMaskedResubmissions`)로
    분리한 것도, 문서에 명시된 대로 "공유 프리미티브를 넓히면 무관한 경로(webhook/schedule)가
    오염된다"는 판단에 부합하는 근거 있는 설계다. `reject-masked-resubmission.ts` 가
    `shared/utils/sanitize-error-message.ts`(cross-module 재사용을 위해 만들어진 "neutral" 레이어,
    2026-05-19 arch-C2 로 이미 순환 의존 회피 목적으로 분리됨)만 의존하는 구조도 방향이 올바르다
    (`execution-engine` → `shared/utils`, 역방향 없음). 조치 불요.

## 요약

이번 PR 은 "마스킹된 값이 그대로 재제출되면 서버가 거부한다"는 단일 도메인 규칙을 새 유틸
(`findMaskedResubmissions`)로 잘 캡슐화했고, 대상 범위(Manual execute·re-run 한정, webhook/schedule
제외)를 공유 프리미티브 오염 없이 지켰으며, 에러 코드 확장은 기존의 닫힌 union + exhaustive
매핑 패턴을 그대로 따라 개방-폐쇄 원칙에 부합한다. `sanitize-error-message.ts` 를 통한 상수 공유로
"마커 집합"의 미러 발산은 막았지만, 그 마커가 놓이는 **깊이를 계산하는 재귀 알고리즘 자체**는
마스커(`deepRedactCore`)와 판정기(`hasMaskedLeaf`)에 독립적으로 두 벌 존재하고 이를 교차 검증하는
통합 테스트가 없다 — 직접 역추적한 결과 현재는 우연한 여유 마진으로 정상 동작하지만, 이 저장소가
반복 겪어 온 "미러 발산" 클래스의 잠재 표면이다. 같은 4줄짜리 "판정 후 throw" 블록이 두 호출부에
중복돼 있는 점도, 바로 이 PR 자체가 그 두 호출부 사이 에러 봉투 드리프트를 한 번 겪은 이력을
감안하면 작은 구조적 리스크로 남는다. 두 지적 모두 즉시 차단할 결함은 아니고 저비용으로 닫을 수
있는 개선 항목이다.

## 위험도

LOW
