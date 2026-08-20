# 보안 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17, 3라운드)

## 검토 범위

이번 diff 는 커밋 `e4a27e5d3` 한 건이며, 앞선 두 라운드(`00_03_57`, `00_39_27`)가 이미 심층
검토(CRITICAL 1건 fix + WARNING 다수 fix)를 마친 기능의 **후속 리팩터+테스트 보강**이다.
실질 프로덕션 코드 변경:

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` — 로컬
  `isPlainRecord` 를 삭제하고 기존 공유 `isRecord`(`to-record.ts`)로 교체, 주석/문서 보강,
  raw 검사 결과를 변수로 분리(`rawHits`)해 가독성 개선. 판정 로직(정확 일치·raw 우선·깊이
  상한·phase 분리) 자체는 이전 라운드 CRITICAL 수정본과 동일하게 유지됨을 실물 코드로 확인.
- `reject-masked-resubmission.spec.ts` (신규 305줄) — 스칼라/중첩/JSON-문자열/깊이 경계
  (`MAX_REDACT_DEPTH`, `+1`)/스택 안전성(depth 5000)/왕복 통합(`deepRedactSecrets` 실산출물)
  / phase 분리 캐너리를 전부 갖춤. 테스트 fixture 에 실제 시크릿·자격증명은 없고 마커
  상수(`VALUE_MASK_MARKER` 등)와 예시 문자열(`'sk-live-abc123'`, `'hunter2'`)만 사용 —
  전부 마스킹 왕복 확인용 더미 값이며 실제 시스템에 존재하지 않는 리터럴이다.
- `spec/*.md` 4곳, `plan/in-progress/*.md` 2곳 — 문서 정정(검사 시점 "직후"→"전후", "재제출
  경로 한정"→"Manual 실행 경로 한정"). 코드 실행 경로와 무관.
- `review/code/2026/08/21/00_39_27/**`, `review/consistency/2026/08/21/00_55_25/**` — 이전
  라운드 리뷰/컨시스턴시 산출물 커밋. 애플리케이션 코드 아님.

실행 경로 코드(`executions.service.ts`, `workflows.controller.ts`, `trigger-parameter.types.ts`,
`sanitize-error-message.ts`)는 이번 커밋에서 **변경되지 않았다** — 이전 라운드에서 이미
검토된 상태 그대로다(`Read` 로 실물 확인).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `isPlainRecord` → `isRecord` 치환은 로직이 완전히 동일해(`v !== null &&
  typeof v === 'object' && !Array.isArray(v)`, 양쪽 함수 바디 비교로 확인) 판정 경계에
  변화가 없다. 다만 `isRecord` 의 doc comment 는 "class 인스턴스(`Date`, `Map` 등)도
  통과시킨다"고 명시적으로 경고한다 — `rawSource`/`values` 가 HTTP JSON body(`JSON.parse`
  산출물)로만 유입되는 현재 두 호출부에서는 class 인스턴스가 실릴 수 없어 실질 영향 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    (`findMaskedResubmissions`, import 문), `codebase/backend/src/modules/execution-engine/utils/to-record.ts`
    (`isRecord`)
- **[INFO]** `rawHits` 를 별도 변수로 분리한 것은 순수 가독성 리팩터로, 값 비교(정확 일치)·
  깊이 상한(`MAX_REDACT_DEPTH`, 값 검사 우선)·phase 분리(raw 우선 → resolve → 재검사) 등
  핵심 방어 로직에는 동작 변화가 없음을 `git show e4a27e5d3 -- .../reject-masked-resubmission.ts`
  로 직접 대조해 확인.
- **[INFO]** 신규 테스트가 방어 경계를 실제로 고정한다: 정확 일치(부분 포함 `a***b`,
  `postgres://***@db/prod` 는 통과), 깊이 상한 정확히 `MAX_REDACT_DEPTH`/`+1` 분기, 스택
  안전성(depth 5000, `RangeError` 미발생), `deepRedactSecrets` 실제 산출물을 그대로 먹이는
  왕복 통합 테스트(마스커↔판정기 발산 방지). 이 테스트들이 통과함은 앞선 라운드가 잡았던
  `boolean` 완전 우회 CRITICAL 이 재발하지 않았음을 코드 레벨로 재확인시킨다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts`
- **[INFO]** 에러 응답 경로(`toTriggerParameterErrorDetails`)는 이번 커밋에서 변경되지
  않았고, 여전히 `field`(스키마 정의 파라미터명)·고정 `code`·고정 `message` 만 반환해
  제출된 실제 값(마커든 원문이든)을 echo 하지 않는다 — 정보 노출 없음 재확인.
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    (`toTriggerParameterErrorDetails`, `REASON_TO_DETAIL`)
- **[INFO]** 두 Manual 실행 진입점(`executions.service.ts` `reRun`, `workflows.controller.ts`
  `execute`) 모두 이번 커밋에서 변경되지 않았으며, 기존 워크스페이스 소유권/권한 검증
  (`findById(id, workspaceId)`, permission check)이 마스킹 재제출 검사보다 먼저 수행되는
  순서도 그대로 유지됨을 실물 코드로 확인 — 인가 우회 신규 표면 없음.

## 요약

이번 diff 는 앞선 두 라운드(CRITICAL 1건 fix, WARNING 다수 fix)가 이미 심층 검증한 EIA
§R17 마스킹 재제출 서버측 거부 기능에 대한 **순수 리팩터(로컬 타입가드→공유 유틸 교체) +
테스트 보강(305줄 신규 spec) + 문서 정정**이다. 판정 로직(정확 일치·raw 우선 검사 순서·
깊이 상한·phase 경계)은 바이트 단위로 동일하게 유지되고, 신규 테스트는 그 경계(특히 이전
CRITICAL 이던 boolean 우회, 깊이 상한 off-by-one, 마스커-판정기 왕복 일치)를 캐너리로
고정해 회귀 위험을 오히려 낮췄다. 인젝션·하드코딩 시크릿·인증/인가 우회·정보 노출·안전하지
않은 암호화 관련 신규 취약점은 발견되지 않았다.

## 위험도

NONE
