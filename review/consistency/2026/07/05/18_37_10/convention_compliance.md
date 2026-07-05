# 정식 규약 준수 검토 — V-14 rerun-modal.tsx (typed 입력 폼 + ID 링크)

검토 대상: `codebase/frontend/src/components/executions/rerun-modal.tsx`,
`codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx`
(diff: `git diff origin/main...HEAD`, 커밋 `4b9a3abac`)

대조 규약: `spec/conventions/i18n-userguide.md`, `spec/conventions/error-codes.md`,
`spec/conventions/node-output.md`, `spec/conventions/swagger.md`, 그리고 SoT 인
`spec/5-system/13-replay-rerun.md §10.2`, `spec/4-nodes/7-trigger/0-common.md §1`.

(주: 직전 세션 `review/consistency/2026/07/05/18_21_17/`의 impl-prep 산출물은
orchestrator payload 오배선으로 실제 target(rerun-modal.tsx)이 아닌 무관 파일
(1-auth.md·10-graph-rag.md)을 검토했다 — SUMMARY.md 자체가 이를 명시. 본 검토는
실제 diff 를 직접 읽어 재검토한 결과다.)

---

### 발견사항

- **[INFO]** 내부 라우트 새 탭 이동에 Next.js `<Link>` 대신 raw `<a>` 사용
  - target 위치: `rerun-modal.tsx` L298-306 (`<a href={...} target="_blank" rel="noopener noreferrer">`)
  - 위반 규약: 명시적 conventions 파일에 강제 조항은 없음(참고용 INFO). 다만 동일 개념(원본 실행 딥링크)을 다루는
    자매 코드 `app/(main)/workflows/[id]/executions/[executionId]/page.tsx:407-412` (chain badge 원본 링크)은
    `next/link` 의 `<Link href=...>` 를 사용
  - 상세: 코드베이스 전체에서 `next/link` + `target="_blank"` 조합 사용례는 `docs-link.tsx`(외부 문서 링크) 뿐이며,
    내부 라우트를 새 탭으로 여는 기존 선례가 없다. raw `<a>` 도 Next.js App Router에서 새 탭 오픈 목적에는 기능상
    문제 없으나(클라이언트 사이드 prefetch/네비게이션 최적화를 의도적으로 포기하는 것이 새 탭 목적에 부합),
    "내부 라우트는 `Link` 컴포넌트 경유" 라는 (비명문화된) 관행과는 결이 다르다.
  - 제안: 현행 유지 가능(새 탭이라 `Link`의 클라이언트 네비게이션 이점이 없어 raw `<a>`가 오히려 명확). 다만
    JSDoc 주석에 "새 탭 목적상 `next/link` 대신 raw `<a>` 사용"이라는 한 줄 근거를 남기면 향후 리뷰어의
    "왜 Link 안 쓰나" 재질문을 예방할 수 있다. 필수 수정 아님.

- **[INFO]** `manual_trigger` 스키마 조회에 `node.type` 문자열 리터럴 재사용
  - target 위치: `rerun-modal.tsx` L240 (`workflowNodes.find((n) => n.type === "manual_trigger")`)
  - 위반 규약: 없음(명시적 금지 조항 없음) — `manual-trigger.schema.ts` 의 `manualTriggerMetadata.type = 'manual_trigger'` 와
    코드 상 정확히 일치하며 오탈자·casing 불일치 없음
  - 상세: 프로젝트 전반에 노드 타입 문자열을 상수/enum 으로 중앙화하는 명문 규약은 확인되지 않았고, 기존
    `dryRunDisabled`/`externalCall` 로직도 동일하게 `node.type` 직접 비교 패턴을 쓰고 있어 이번 diff 만의 이탈이 아니다.
  - 제안: 규약 신설 없이는 조치 불요. 코드 위생 관점 제안일 뿐.

---

### 검증됨 — 위반 없음 (참고용)

1. **i18n Principle 1 (TSX 하드코딩 금지)**: 신규 사용자 가시 문자열은 모두 기존 `t("history.rerun.*")` 키를 그대로 재사용
   (`useOriginalInput`·`dryRunToggle`·`confirmButton` 등 신규 키 추가 없음). `field.name`/`field.description` 은
   워크플로 작성자가 `manual_trigger` 노드 config 에 직접 입력하는 **사용자 콘텐츠**(백엔드 SoT 정적 라벨이 아님)이므로
   Principle 1/3/3-B 의 "정적 매핑 의무" 대상이 아니다 — `manual-trigger.schema.ts` 의 `ui.label`(`Name`/`Type`/...)은
   필드 스키마 편집 UI 라벨이지 이번 rerun 폼이 노출하는 값이 아니어서 혼동 소지 없음.
2. **i18n Principle 3-C (에러 코드 매핑)**: `RERUN_PERMISSION_DENIED`/`RERUN_CHAIN_DEPTH_EXCEEDED`/`RERUN_WORKFLOW_DELETED`/
   `RERUN_DRY_RUN_NOT_APPLICABLE` → `history.rerun.*` 매핑(`ERROR_CODE_TO_KEY`)은 기존 코드 그대로이며 이번 diff 가
   신규로 도입한 코드는 없다. `error-codes.md` 의 명명 규약(UPPER_SNAKE, 도메인 prefix `RERUN_`)에도 이미 부합.
3. **`TriggerParameterDefinition` 스키마 계약 일치**: `ParamType`/`TriggerParameterDefinition` 로컬 타입 정의가
   `spec/4-nodes/7-trigger/0-common.md §1` 의 `interface TriggerParameterDefinition { name, type, required?, defaultValue?, description? }`
   와 필드명·타입 유니온(`'string'|'number'|'boolean'|'object'|'array'`) 모두 정확히 일치. 주석도 spec 앵커
   (`spec/4-nodes/7-trigger/0-common.md §1`)를 명시적으로 인용해 SoT 추적성을 확보.
4. **spec §10.2 필드 동작 표와 구현 1:1 대응**: "ID 클릭 시 새 탭 원본 상세" · "필드 라벨/타입은 워크플로 manual_trigger
   노드 config 에서 도출" 두 요구가 diff 에 정확히 반영됨(`href` 패턴·`fields` 도출 로직). 코드 주석도 `§10.2` 를
   반복 인용해 명명·근거 추적성 규약(각 spec 문서의 `## Rationale`/근거 인용 관행)과 정합.
5. **에러 파싱 계약 정확성**: `parseErrorCode` 의 JSDoc 이 `GlobalExceptionFilter` 의 실제 envelope 형태
   (`{ error: { code, message, requestId } }`) 를 정확히 서술하고 `api-convention §5.3` 에러 응답 포맷과 불일치 없음.
6. **테스트 명명 스타일**: 신규 `it(...)` 설명문("~렌더한다", "~전송한다")이 같은 파일 기존 테스트와 동일한
   서술형 종결 스타일을 유지. 별도 test-naming 정식 규약 파일은 없으나 파일 내부 일관성 유지.
7. **CSS/컬러 토큰 재사용**: `text-[hsl(var(--primary))] underline` 클래스 조합이 `login-form.tsx`·`register-form.tsx`·
   `auth-config-select.tsx` 등 기존 링크 스타일과 동일 — 신규 임의 컬러 하드코딩 없음.
8. **plan lifecycle 체크박스 상태 갱신**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-14 항목이
   `[ ] 잔여` → `[x]` 완료로 정확히 갱신되고 실제 구현 내용·SoT·TEST 절차가 본문에 기록됨 —
   "plan 체크박스 = 실제 상태" 원칙 준수. `spec_impact` 관련 frontmatter 변경은 이번 diff 범위 밖(별도 plan 파일).
9. **CHANGELOG.md 항목 포맷**: `## Unreleased — <제목> (V-14)` + `### 변경 사항` 번호 목록 구조가 바로 위 V-10 항목과
   동일한 기존 포맷을 그대로 따름.
10. **review 산출물 경로**: 이전 세션 산출물이 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 규약 경로에
    정확히 위치.

---

### 요약

이번 diff(`rerun-modal.tsx` typed 폼 전환 + 원본 ID 새 탭 링크)는 `spec/5-system/13-replay-rerun.md §10.2` 와
`spec/4-nodes/7-trigger/0-common.md §1` 의 `TriggerParameterDefinition` 스키마 계약을 정확히 재사용하며, i18n
정식 규약(Principle 1·3·3-B/3-C) 이 요구하는 하드코딩 금지·에러 코드 매핑·정적 라벨 매핑 의무 어디에도 저촉되지
않는다 — 신규 사용자 가시 문자열은 없고(기존 dict 키 재사용), 필드 라벨/설명은 사용자 콘텐츠라 매핑 테이블 대상이
아니다. 신규 에러 코드·엔티티·API 변경도 없어 명명 규약(UPPER_SNAKE `RERUN_*` 등)에 이탈이 없다. CHANGELOG·plan
체크박스 갱신도 기존 포맷·라이프사이클 규약을 그대로 따른다. 발견된 두 항목은 모두 INFO 등급(내부 라우트 새 탭
오픈에 raw `<a>` 사용, node.type 문자열 리터럴 재사용)으로, 정식 규약을 직접 위반하지 않는 코드 스타일 참고 사항이며
필수 수정 대상이 아니다. CRITICAL/WARNING 사항은 발견되지 않았다.

### 위험도

NONE
