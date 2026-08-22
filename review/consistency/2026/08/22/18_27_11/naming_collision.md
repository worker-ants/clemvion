STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `spec-draft-egress-masking-convention.md`

## 검토 방법

target 이 실제로 새로 발행하는 식별자는 매우 적다(문서 자체가 "새 이름을 만들지 않고 기존
코드 심볼을 좌표계 표로만 정리한다"를 의도적으로 표방). 프롬프트에 포함된 코퍼스는
컨텍스트 예산 초과로 `node-cancellation.md`·`node-output.md` 를 포함해 다수 파일 본문이
생략돼 있었으므로, 해당 파일과 target 이 인용하는 코드 심볼은 리포지토리에서 직접 `Read`/`grep` 으로
재확인했다(대상: `spec/conventions/*.md` id 전수, `spec/5-system/14-external-interaction-api.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/1-data-model.md §2.17`, `spec/conventions/secret-store.md`,
`spec/conventions/error-codes.md`, 및 4개 `code:` 대상 TS 파일). 검토는 target 이 실제로 checkout
한 worktree(`f65ca193c`, `egress-masking-convention-531f5b`) 기준으로 재실행했다.

## 발견사항

### 파일 경로 / 문서 ID — 충돌 없음 (확인됨)
- target 신규 식별자: 신설 파일 `spec/conventions/egress-masking.md`, frontmatter `id: egress-masking`
- 기존 사용처: `spec/conventions/*.md` 전체 51개 파일의 `id:` 프런트매터를 전수 grep
- 상세: `egress-masking` 이라는 `id` 값·파일 basename 은 기존 어떤 convention 문서에도 없다
  (가장 근접한 `secret-store`·`node-output`·`error-codes` 와도 겹치지 않음). 파일명 컨벤션
  (kebab-case, `id:` = basename)도 `node-output.md`/`node-cancellation.md`/`execution-context.md`
  선례와 일치한다.
- 제안: 조치 불필요.

### 코드 심볼 재인용 — 좌표계 표 값이 실제 코드와 정확히 일치 (충돌 없음, 확인됨)
- target 신규 식별자: 없음 — target 은 `MAX_MASK_DEPTH`(=10, `masked-markers/src/index.ts:81`),
  `MAX_REDACT_DEPTH`(= `MAX_MASK_DEPTH` 별칭, `sanitize-error-message.ts:128`),
  `MAX_SANITIZE_DEPTH`(=10 독립 선언, 비교 `depth > N`, `websocket.service.ts:80,119`),
  `stripExternalOnlyFields(value, maxDepth)`(비교 `>`, `strip-external-only-fields.ts:101` 이하)를
  **이름으로만** 재인용하며 값을 새로 발행하지 않는다.
- 기존 사용처: 위 4개 코드 파일(모두 `code:` frontmatter 대상) + 소비처
  `reject-masked-resubmission.ts`(`hasMaskedLeaf`) · `lib/utils/masked-markers.ts`(`hasMaskedMarkerLeaf`) ·
  `interaction.service.ts`.
- 상세: worktree 실측 결과 target 의 좌표계 표(#1~#5 행, 비교 연산자 포함)가 코드와 **1:1 정확히
  일치**한다. 새 의미를 부여하거나 다른 개념에 같은 이름을 재사용하는 곳이 없다 — "신규 식별자
  충돌" 범주에서는 안전.
- 제안: 조치 불필요. (참고: 표의 정확성 자체는 `rationale_continuity`/`cross_spec` checker 관할이며
  본 checker 범위인 "충돌"은 아님.)

### `MASKED_VALUE_RESUBMITTED` / `details[].code` — 충돌 없음, 이미 등록됨 (확인됨)
- target 신규 식별자: 없음 — target 의 "소유하지 않는다" 표가 `details[].code` 정규화의 SoT 를
  `error-codes.md §4.2` 로 명시적으로 위임한다.
- 기존 사용처: `spec/conventions/error-codes.md:129`(`masked_value_resubmitted` →
  `MASKED_VALUE_RESUBMITTED`, SoT 표기 EIA §R17).
- 상세: target 이 이 코드를 재정의하거나 다른 의미로 쓰지 않는다. 정확히 기존 표와 정합.
- 제안: 조치 불필요.

### EIA `§R17` 참조 — 신규 R-번호 미부여, 기존 절 재사용 (확인됨)
- target 신규 식별자: 없음 — "마스킹 정책·범위·잔여 갭"의 주인을 `EIA §R17` 로 지목.
- 기존 사용처: `spec/5-system/14-external-interaction-api.md:1395` (`### R17. getStatus 의
  currentNode/context 실값 노출 …`) — 이미 이 절 본문(1416~1706행 부근)이 egress 마스킹 정책/갭을
  다루고 있다.
- 상세: target 이 새 `R20` 등을 만들지 않고 기존 §R17 을 정확히 가리킨다. ID 재사용 충돌 없음.
- 제안: 조치 불필요.

### `AuthConfig.config` 비대상 콜아웃 — 기존 선례와 표현까지 일치 (확인됨, 정보성)
- target 신규 식별자: 없음 — "비대상" 콜아웃에서 `secret-store.md` 의 "동형 콜아웃 선례를 따른다"
  고 스스로 명시.
- 기존 사용처: `spec/conventions/secret-store.md:40` (`AuthConfig.config` 는 `secret://` 통합
  대상이 아니며 마스킹 정책 SoT 는 `1-data-model.md §2.17.2`), `spec/1-data-model.md §2.17.2`
  (`config` 필드 전체 마스킹 정책, depth/marker 메커니즘과 무관).
- 상세: 두 메커니즘(값-패턴 egress 마스킹 vs 필드 단위 AuthConfig 마스킹)이 이름만 "마스킹"으로
  겹치고 실제 구현·SoT·상수 이름은 완전히 분리돼 있음을 확인. target 이 이미 이 잠재적 혼동을
  선제적으로 콜아웃했고, 실제로도 `MAX_MASK_DEPTH` 계열 상수가 `1-data-model.md`/`secret-store.md`
  어느 쪽에도 존재하지 않아 이름 충돌이 없다.
- 제안: 조치 불필요 — target 의 선제 처리가 정확함을 확인.

### (INFO) bare word "egress" 의 두 가지 의미 공존 — 이미 안전하게 분리됨
- target 신규 식별자: 문서 제목/주제어 "egress 마스킹"(값-패턴 egress masking).
- 기존 사용처: `spec/4-nodes/4-integration/1-http-request.md:105,368` 의 "외부 egress 방화벽"
  (SSRF opt-out 맥락, `ALLOW_PRIVATE_HOST_TARGETS`) — **네트워크 egress**를 가리키는 완전히 다른 개념.
- 상세: 두 사용처 모두 단독 "egress" 가 아니라 항상 복합어("egress 마스킹" vs "egress 방화벽")로
  등장해 실질적 혼동 사례나 CRITICAL 충돌은 없다. 다만 같은 저장소에 "egress" 라는 단어가 서로
  다른 두 도메인(데이터 유출 방지용 값-마스킹 vs 네트워크 SSRF 차단)에서 쓰이고 있다는 점은
  검토자가 향후 grep 할 때 헷갈릴 수 있는 지점이라 정보성으로 남긴다.
- 제안: 조치 불필요(현재 표현으로 충분히 구분됨). 신설 문서 Overview 에 "네트워크 egress 방화벽과
  무관" 이라는 1문장 콜아웃을 추가하면 미래 검색 혼동을 한 단계 더 줄일 수 있으나 필수는 아니다.

### (INFO) `spec-code-paths` 가드 대상 4파일 — 경로 실재 확인
- target 신규 식별자: `code:` frontmatter 4개 경로.
- 기존 사용처: 없음(신규 문서의 frontmatter 이므로 "충돌"이 아니라 "실재성" 확인 대상).
- 상세: worktree 에서 4개 경로 모두 실재를 확인했다 —
  `codebase/packages/masked-markers/src/index.ts`,
  `codebase/backend/src/shared/utils/sanitize-error-message.ts`,
  `codebase/backend/src/shared/utils/strip-external-only-fields.ts`,
  `codebase/backend/src/modules/websocket/websocket.service.ts`. `spec-code-paths.test.ts` 통과
  예상.
- 제안: 조치 불필요.

## 요약

target 문서는 "신규 식별자를 만들지 않는다"를 스스로 설계 원칙(마커 리터럴 0회, 상수는 이름으로만
인용)으로 삼고 있으며, 실측 결과 이 원칙이 실제로 지켜지고 있다. 유일한 신규 식별자는
파일 경로 `spec/conventions/egress-masking.md` 와 frontmatter `id: egress-masking` 인데, 두 값
모두 `spec/conventions/**` 전수 검색에서 기존 사용처가 없어 충돌하지 않는다. 코드 심볼
(`MAX_MASK_DEPTH`/`MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH`/`stripExternalOnlyFields`), 에러 코드
(`MASKED_VALUE_RESUBMITTED`), EIA `§R17` 참조는 전부 재인용일 뿐 재정의가 아니며 worktree 코드와
값·비교연산자까지 정확히 일치함을 직접 확인했다. `AuthConfig.config` 마스킹과의 이름 혼동
가능성은 target 이 이미 선제적으로 콜아웃해 분리해 두었다. CRITICAL/WARNING 급 신규 식별자
충돌은 발견되지 않았다.

## 위험도

NONE
