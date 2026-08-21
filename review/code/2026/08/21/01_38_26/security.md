# 보안 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17, 4라운드 누적)

## 검토 범위 및 방법

이 diff 는 `codebase/` 실질 코드 변경(8개 파일) + 이전 세 리뷰 라운드(`00_03_57`,
`00_39_27`, `01_15_47`)의 산출물/spec·plan 문서를 함께 커밋한 형태다. 프롬프트가 크기
제한으로 생략한 핵심 구현 파일(`reject-masked-resubmission.ts`,
`reject-masked-resubmission.spec.ts`)은 `Read` 로 저장소에서 직접 전문을 열어 확인했고,
호출부 두 곳(`executions.service.ts`의 `reRun`, `workflows.controller.ts`의 `execute`)의
인가 체크 순서, `sanitize-error-message.ts` 전문, `to-record.ts`(`isRecord`),
`GlobalExceptionFilter`(`details` 파싱)까지 실코드로 교차 확인했다. 이전 라운드가 이미
CRITICAL 1건(boolean 파라미터 완전 우회)과 WARNING 다수를 발견·수정했음을 코드 레벨로
재검증했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 핵심 판정 로직은 검사 시점을 raw(coerce 전) → resolve 순으로 두 번 수행해
  타입 우회를 막는다 — 직접 확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    함수 `resolveTriggerParametersRejectingMasked`(56~75행), `hasMaskedLeaf`(132~145행)
  - 상세: `hasMaskedLeaf`는 값 검사(`isMaskedMarker`)를 깊이 검사보다 먼저 수행해(133~135행)
    깊이 상한(`MAX_REDACT_DEPTH`) 자리에 놓인 마커를 놓치지 않고, `findMaskedResubmissions`는
    `Object.prototype.hasOwnProperty.call(rawSource, def.name)`(124행)으로 own-property만
    대상 삼아 `defaultValue` 로 채워진 미제출 필드를 과잉 차단하지 않는다. 정확 일치만 보므로
    (`MASKED_MARKERS.has(v)`) `a***b` 류 정상 값은 통과한다 — 스펙 테스트(`reject-masked-resubmission.spec.ts`
    155~166행, 174~213행)로 경계가 고정돼 있음을 실물로 확인.
- **[INFO]** 에러 응답에 실제 제출 값이 echo 되지 않는다 — 정보 노출 없음 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    (`toTriggerParameterErrorDetails`/`REASON_TO_DETAIL`, 36~81행)
  - 상세: `details[]`에는 스키마에 정의된 `field`명, 고정 `code`(`MASKED_VALUE_RESUBMITTED` 등),
    고정 `message`만 실린다. 마스킹 마커든 사용자가 입력한 원문이든 값 자체는 어디에도
    직렬화되지 않는다.
- **[INFO]** 두 Manual 실행 진입점 모두 인가 체크가 마커 검사보다 먼저 수행된다 —
  실코드로 순서 확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `reRun`
    (워크스페이스 소유권 404 체크 432~443행, RR-PL-06 권한 체크 452~462행이 마커 검사
    499~502행보다 선행), `codebase/backend/src/modules/workflows/workflows.controller.ts`
    `execute`(`workflowsService.findById` 295행이 마커 검사 317행보다 선행)
  - 상세: 마커 재제출 거부 로직 추가가 기존 IDOR/권한 검증 순서를 앞지르지 않는다 —
    인가 우회 신규 표면 없음.
- **[INFO]** `MASKED_MARKERS` 가 `Object.freeze`로 런타임 불변화됨 — 이전 라운드
  side_effect INFO-4 수정 확인
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` 150~152행
  - 상세: `export const MASKED_MARKERS: ReadonlySet<string> = Object.freeze(new Set([...]))`.
    타입 우회(`as Set<string>`)로 변형돼도 런타임에서 막힌다 — `isMaskedMarker`(egress
    마스킹 판정)와 `findMaskedResubmissions`(재제출 거부 판정)가 같은 싱글턴을 공유하므로
    변형 파급 범위가 넓었던 지점이 닫혔다.
- **[INFO]** `findMaskedResubmissions`의 재귀는 깊이 상한(`MAX_REDACT_DEPTH=10`)만 있고
  폭(branching factor)은 무계 — 기존 패턴(`deepRedactCore`) 재사용, 신규 표면 아님
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    `hasMaskedLeaf`(132~145행, 특히 137·140행 `.some()` 순회)
  - 상세: 마커가 없는 최악의 경우 O(요청 본문 크기)이고 지수적 증폭은 없다. 요청 본문
    크기 자체는 이 diff 범위 밖의 전역 body-parser 한도(`main.ts`가 `bodyParser: false`로
    라우트별 파서를 직접 구성)가 담당하는 관심사임을 확인. 순환 참조 우려도 없음 — 입력은
    `JSON.parse` 산출물이라 cycle 이 생길 수 없다.
- **[INFO]** `POST /workflows/:id/nodes/:nodeId/execute`(단일 노드 실행, `executeNode`)는
  이번 가드 대상 밖 — 트리거 파라미터 스키마 경로가 아니므로 스코프 이탈 아님
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` `executeNode`
    (380~437행)
  - 상세: 이 엔드포인트는 `resolveTriggerParametersRejectingMasked`/`resolveTriggerParameters`
    어느 쪽도 거치지 않고 `body?.input`을 그대로 노드 실행 입력에 싣는다(429~432행) — Manual
    트리거 파라미터 스키마 검증 경로 자체가 아니라 노드 단위 디버그/테스트 실행이라 마스킹
    마커 재제출 문제의 대상 표면이 아니다(정상 GUI 에서 마스킹된 `Execution.inputData` 값을
    이 엔드포인트로 프리필하는 경로가 없음). 이전 라운드 판단과 독립적으로 코드를 직접 읽어
    같은 결론 확인.
- **[INFO]** 테스트 fixture 의 예시 문자열(`sk-live-abc123`, `hunter2`, `postgres://***@db/prod`)은
  전부 마스킹 왕복 확인용 더미 값 — 실제 시크릿 아님
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts`
    (163행, 242~244행)

## 요약

핵심 방어 로직(`resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions`/`hasMaskedLeaf`)을
직접 읽어 검증한 결과, 이전 세 라운드가 발견한 CRITICAL(boolean 파라미터 완전 우회)이
raw-우선 2단계 검사 순서로 해소돼 있고, WARNING(호출부 중복·`isPlainRecord` 재구현·
`errors`→`details` 봉투 유실·`MASKED_MARKERS` 미고정)도 실물 코드에서 전부 반영을 확인했다.
이번 diff 에서 인젝션 취약점, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화,
민감 정보 노출 관련 새 결함은 발견되지 않았다. 두 Manual 실행 진입점의 인가 체크가 마커
검사보다 먼저 수행되는 순서도 유지돼 있어 신규 인가 우회 표면이 없다. 유일하게 남는
이론적 여지(재귀 폭 무계)는 요청 본문 크기라는 별도 계층이 이미 담당하는 관심사라 이번
diff 의 결함이 아니다.

## 위험도

NONE
