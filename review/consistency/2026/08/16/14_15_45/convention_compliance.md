# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-eia-error-masking-catalog.md`

## 검토 방법

target 은 `spec/5-system/14-external-interaction-api.md` §R17/§6.4 에 삽입할 문구를 제안하는
spec draft(plan) 문서다. `spec/conventions/**` 중 관련성이 높은 문서(`error-codes.md`,
`secret-store.md`, `node-output.md`, `spec-impl-evidence.md` 관련 조항, `plan-lifecycle.md`
frontmatter 스키마)를 직접 읽고, target 이 인용하는 실제 spec 절(§R17 전문, §6.4 전문)과
구현 코드(`codebase/backend/src/shared/utils/terminal-error-payload.ts`,
`sanitize-error-message.ts`)를 대조해 명명·포맷·문서구조·금지항목 위반 여부를 확인했다.
(번들 파일 상당수가 "컨텍스트 예산 초과"로 절단돼 있어, 해당 컨벤션은 리포지토리 원본을
직접 읽어 보강했다.)

## 발견사항

해당 관점(명명 규약 / 출력 포맷 규약 / 문서 구조 규약 / API 문서 규약 / 금지 항목)에서
**CRITICAL·WARNING 위반은 발견되지 않았다.** 아래는 INFO 수준의 사소한 제안뿐이다.

- **[INFO] 신설 불릿의 상호참조가 서수(ordinal) 기반**
  - target 위치: `### ① §R17 — 5번째 불릿 신설` 본문 — "위 3번째 불릿의 `outputData` 기반
    `error` 와 다른 컬럼" (2회 반복)
  - 위반 규약: 명시적 규약은 없음 — `spec/5-system/14-external-interaction-api.md` 자체의
    관행(예: "아래 참조", 앵커 링크 `[§R17](#r17-…)`, `[API 규약 §5.4](./2-api-convention.md#54-…)`)과
    비교했을 때 이 문서는 지금까지 자기 불릿을 "N번째"로 서수 지칭하는 선례가 없음(grep 0건).
  - 상세: `nodeOutput.conversationConfig` 불릿이 R17 목록에서 실제로 3번째인 것은 맞지만
    (`conversationThread`→`execution.ai_message`→`nodeOutput.conversationConfig`→신설),
    이 카운트는 앵커나 마크다운 구조로 강제되지 않는 **손으로 센 서수**다. 향후 불릿이
    재배열·삽입되면 "3번째"라는 지시어가 조용히 stale 해질 수 있다 — 이 저장소가 반복
    겪은 "문서한 보장이 실제와 어긋난다" 류 결함과 같은 결이다.
  - 제안: "위 3번째 불릿" 대신 불릿 제목을 직접 인용(예: "위 `nodeOutput.conversationConfig` +
    terminal `result`/`error` 불릿의 `outputData` 기반 `error`")하면 재배열에 강건해진다.
    사소한 표현 문제이므로 병합을 막을 사안은 아니다.

- **[INFO] 신설 불릿 제목이 3줄에 걸친 굵게(bold) 처리**
  - target 위치: `### ① §R17 — 5번째 불릿 신설` — `- **종결 이벤트 …(강제됨 — 2026-08-16)**:` 로
    시작하는 불릿
  - 위반 규약: 명시적 규약 없음 — 같은 R17 목록의 형제 불릿들(`conversationThread (강제됨)`,
    `execution.ai_message 라이브 이벤트 (강제됨)`, `nodeOutput.conversationConfig … (강제됨 — bypass 차단)`)은
    모두 굵게 제목이 **한 줄**이다.
  - 상세: 신설 불릿만 제목이 3줄(본문 필드명 + 컬럼 구분 캐비엇 + 강제됨 태그)에 걸쳐 있어
    시각적 일관성이 다소 떨어진다. 마크다운 렌더링 자체는 문제 없다(굵게 범위가 올바르게 닫힘).
  - 제안: 컬럼 구분 캐비엇("위 3번째 불릿의 …와 다른 컬럼")을 굵게 제목 밖으로 빼 본문
    첫 문장으로 옮기면 형제 불릿들과 시각적으로 더 정합적이다. 선택 사항.

## 확인된 준수 사항 (근거 포함, 문제 없음)

교차검증 과정에서 확인된 정식 규약 준수 포인트를 참고용으로 남긴다.

- **명명 규약**: `Execution.error`(PascalCase 엔티티 + 필드) 표기는 `spec/1-data-model.md`
  §2.14 및 `spec/5-system/14-external-interaction-api.md` §6.4 캐비엇에서 이미 쓰이는 형식과
  정확히 일치. 함수명 `toTerminalErrorPayload`/`redactTerminalError`/`deepRedactSecrets`,
  상수 `SECRET_LEAK_PATTERNS` 는 실제 `codebase/backend/src/shared/utils/terminal-error-payload.ts`·
  `sanitize-error-message.ts` 소스와 1:1 대조 확인됨(문자열 오탈자 없음).
- **에러 코드 명명(`error-codes.md`)**: target 은 신규 `error.code` 값을 신설하지 않으며
  기존 `code`/`nodeId` 를 "대상이 아니다"로 명시적으로 제외 — §1 의미기반 명명 원칙과 충돌 없음.
- **문서 구조**: target frontmatter(`worktree`/`started`/`owner` 필수 3필드 + `spec_impact`
  리스트)는 `.claude/docs/plan-lifecycle.md` §4 스키마를 만족(`spec_impact` 가 bare string 이
  아닌 YAML 리스트 — Gate C 통과 형태). `pending_plans:` 확장 필드는 동일 폴더의
  `spec-draft-ws-types-canonical-location.md`·`spec-draft-eia-notification-payload-contract.md`
  에 이미 선례가 있어 신규 관행이 아님. 파일명 `spec-draft-eia-error-masking-catalog.md` 도
  `plan/in-progress/spec-draft-*.md` 기존 4개 문서와 동일 패턴.
  Overview/Rationale 로 여는 문서 구조도 spec 문서 3섹션 권장과 부합.
- **크로스 레퍼런스 링크 형식**: `../../plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  상대경로는 `spec/5-system/14-external-interaction-api.md` 안의 기존 동일 링크(3곳, 827/831/835행)와
  정확히 같은 깊이·형식.
- **§6.4 삽입안**: 기존 두 `>` 블록(`code` nullable / `error` 전 경로 object) 뒤에 세 번째 `>` 블록을
  추가하는 구조는 문서 자체의 반복 패턴과 일치. "JSON 형태 `message` 는 마스킹 후 재직렬화" 캐비엇은
  `deepRedactSecrets`→`looksLikeJson`→`redactSecretsInJsonString` 경로의 실제 동작과 정확히 일치.
- **금지 항목**: `secret-store.md` SS-SE-01/02(마스터키·plaintext 노출 금지, IV 재사용 금지) 등
  명시적 금지 조항과 target 제안 사이에 충돌 없음(대상 도메인이 다름 — target 은 자유 텍스트
  에러 메시지의 egress 마스킹, secret-store 는 자격증명 저장소 자체).

## 요약

target 문서는 `spec/conventions/**` 의 명명·포맷·문서구조·API문서·금지항목 규약을 위반하지
않는다. 인용한 함수명·경로·동작 설명은 실제 코드와 정밀하게 일치했고, frontmatter·파일명·
상대링크 형식은 `plan-lifecycle.md` 및 형제 `spec-draft-*` 문서의 기존 관행과 부합하며,
삽입 대상 spec 절(§R17/§6.4)의 기존 서술 패턴(굵게-불릿, `>` 캐비엇 블록)과도 구조적으로
정합적이다. 발견된 두 건은 모두 INFO 수준의 표현 개선 제안(서수 기반 상호참조의 장기 취약성,
불릿 제목 줄 수)이며 병합을 막을 사안이 아니다.

## 위험도

NONE
