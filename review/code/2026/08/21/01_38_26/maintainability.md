# 유지보수성(Maintainability) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (4차 재검토, `01_38_26`)

## 검토 범위

실질 프로덕션 코드 변경 8개 파일(`git diff origin/main...HEAD --stat -- codebase/` 기준 +700/-14):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`

나머지(CHANGELOG, `spec/**` 정정, `plan/**`, `review/code/2026/08/21/{00_03_57,00_39_27}/**` 산출물)는
이전 세 라운드(`00_03_57` → `00_39_27` → `01_15_47`)가 이미 검토·처분했고 이번 diff 는 그 결과를
그대로 커밋 이력에 실은 것이라 코드 유지보수성 관점의 재검토 대상에서 제외했다.

이전 두 라운드의 maintainability WARNING 을 실물 코드로 재확인했다:

- `00_03_57` WARNING(find+length체크+throw 3줄이 두 호출부에 복붙) → `resolveTriggerParametersRejectingMasked`
  로 캡슐화돼 두 호출부 모두 함수 호출 한 줄(`executions.service.ts:499`, `workflows.controller.ts:317`)만
  남았다. **해소 확인.**
- `00_39_27` WARNING(`isPlainRecord` 가 같은 디렉터리 `isRecord` 를 재구현) → 로컬 선언이 제거되고
  `import { isRecord } from './to-record';`(`reject-masked-resubmission.ts:11`)로 교체됐다. **해소 확인.**
- `01_15_47` INFO(3건: `MASKED_MARKERS` freeze·혼합 중첩 캐너리·phase 경계 캐비엇) → `Object.freeze`
  (`sanitize-error-message.ts:150`), 혼합 중첩 테스트(`reject-masked-resubmission.spec.ts:207-213`),
  `throwIfAny` 위 phase 경계 docstring(`reject-masked-resubmission.ts:81-89`)으로 전부 반영돼 있다.
  **해소 확인.**

## 발견사항

- **[INFO]** 두 호출부에 판정 로직이 아니라 **동일 주제의 "왜" 설명 주석**이 각각 별도로 붙는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:494-496`,
    `codebase/backend/src/modules/workflows/workflows.controller.ts:312-314`
  - 상세: 로직 자체는 이미 함수 호출 한 줄로 캡슐화돼 중복이 없다(위 확인). 다만 그 직전 3줄
    인라인 주석이 두 파일에서 "왜 여기서 마커를 거부하는가"를 각각 독립적으로 서술한다 —
    문구는 다르지만("되돌아왔는가" vs "재제출됐는가") 요지(EIA §R17 서버측 2층, curl 우회 방지,
    검사 시점 소유권)는 같다. `resolveTriggerParametersRejectingMasked` 자체의 JSDoc
    (`reject-masked-resubmission.ts:13-55`)이 이미 이 설명을 상세히 담고 있어, 호출부 주석은
    "여기서도 이 함수를 쓰는 이유"를 되풀이하는 셈이다. 세 번째 Manual 경로가 생기면 이
    설명도 세 번째로 복붙될 가능성이 있다.
  - 제안: 필수 아님. 호출부 주석을 `// EIA §R17 서버측 2층 — 근거는 resolveTriggerParametersRejectingMasked JSDoc 참고` 정도로 짧게 줄이고, 상세 근거는 함수 JSDoc 한 곳(SoT)에만 두는 것을 다음 편집 기회에 고려.

- **[INFO]** `throwIfAny` 이름이 무엇을 던지는지 시그니처만으로는 여전히 드러나지 않음 (재확인, `00_39_27` 이미 INFO·미강제)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:91` (함수 `throwIfAny`)
  - 상세: 직전 라운드에서 이미 지적됐고 강제 사안이 아니라 미반영 상태로 남아 있다. 현재도
    파일 내부 비공개 헬퍼로 두 곳(라인 66, 72)에서만 쓰이고 호출부마다 의미를 설명하는
    주석이 붙어 있어 문맥상 오독 위험은 낮다. 새로운 문제는 아니며 상태 유지 확인 목적으로만
    재기재한다.
  - 제안: 이전과 동일 — 필수 아님. 이 파일을 다시 열 기회가 있으면 `throwIfMaskedResubmissionErrors`
    류로 구체화 검토.

## 요약

4차 재검토 기준으로 실질 코드는 CRITICAL/WARNING 없이 수렴한 상태다. 핵심 구현
(`reject-masked-resubmission.ts`)은 함수 하나(`resolveTriggerParametersRejectingMasked`)가
raw→resolve 2단계 검사 순서를 캡슐화하고, 헬퍼(`throwIfAny`/`findMaskedResubmissions`/
`hasMaskedLeaf`)가 각각 단일 책임으로 짧게(14~20줄) 분리돼 있다. 중첩 깊이는 최대 3단(`Array.isArray`
→ `.some` → 재귀)으로 낮고, 순환 복잡도도 분기 4~5개 수준으로 관리 가능하다. 매직 넘버 없이
`MAX_REDACT_DEPTH` 상수를 마스커와 공유하며, 이전 라운드가 지적한 판정 로직 중복(호출부 복붙)과
타입가드 재구현(`isPlainRecord`↔`isRecord`)은 실코드로 해소가 확인됐다. `trigger-parameter.types.ts`
의 신규 enum 값·매핑도 기존 3항목과 동일한 네이밍 컨벤션(`snake_case` reason ↔ `UPPER_SNAKE_CASE`
code)·`Record` exhaustive 매핑 패턴을 그대로 따라 향후 reason 추가 시 매핑 누락이 컴파일 타임에
잡히는 구조를 유지한다. 테스트(`reject-masked-resubmission.spec.ts` 및 두 호출부 spec)는 캐너리·경계·
회귀·왕복 통합 테스트를 의도가 드러나는 이름(`[캐너리]`/`[경계]`/`[회귀]`/`[통합]` 태그)으로 조직해
가독성이 높고, `rejectedFields` 헬퍼로 반복 assertion 을 추상화해 스펙 파일 자체의 중복도 적다.
남은 지적은 전부 INFO 2건(호출부 주석 프로즈의 경미한 반복, 헬퍼 명명 재확인)으로 이전 라운드에서
이미 인지·미강제 처리된 것과 신규로 발견한 것이 섞여 있으며 둘 다 이번 diff 의 병합을 막을
사유가 아니다.

## 위험도

NONE
