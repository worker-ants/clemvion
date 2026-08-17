# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위 확인

`git diff origin/main...HEAD --stat -- spec/` 결과, 이번 라운드에서 실제로 변경된 spec 파일은 3개뿐이다:

- `spec/5-system/14-external-interaction-api.md` (§R17 "프리필 왕복" 불릿 추가, +16/-1)
- `spec/5-system/15-chat-channel.md` (R-CC-15 Rationale 내 `nodeName`→`nodeLabel` 정정, 1줄)
- `spec/4-nodes/1-logic/12-background.md` (`nodeExecutions.data` 설명에 `outputData`/`inputData` 마스킹 확장 반영, 1줄)

동반 코드 diff는 backend `sanitize-error-message.ts`(마커 상수 재배치 + 프런트 미러 안내 주석), frontend `dynamic-form-ui.tsx`(마스킹된 `defaultValue` 프리필 차단 가드 `isMaskedValue`/`MASK_MARKERS`), i18n dict(ko/en `formMaskedDefaultHint`), user-guide MDX(ko/en `run-results` Error 탭 설명 갱신)이다. 아래는 이 변경분을 `spec/conventions/**`(swagger.md·spec-impl-evidence.md·i18n-userguide.md·error-codes.md·node-output.md·frontend-layering.md 등, 저장소 원본을 직접 Read)과 대조한 결과다.

## 발견사항

이번 라운드 diff에서 **CRITICAL/WARNING 급 정식 규약 위반은 발견하지 못했다.** 확인한 점검 관점별 결과는 다음과 같다.

- **명명 규약**: `15-chat-channel.md`의 `nodeName`→`nodeLabel` 정정은 오히려 규약 정합화다. `nodeLabel`은 `6-websocket-protocol.md`(§4.1 이벤트 표)·`conversation-thread.md`·`3-workflow-editor/4-ai-assistant.md`·`3-error-handling.md`(2026-08-17 선행 정정)에서 이미 정본으로 쓰이던 필드명이고, 엔진 emit이 실제로 `nodeLabel`만 발행함이 이미 실측·기록돼 있었다(`3-error-handling.md` §258-259). 이번 변경은 그 사실과 동떨어져 있던 마지막 잔존 `nodeName` 표기 하나를 맞춘 것이라 명명 불일치를 오히려 줄인다. `isMaskedValue`/`MASK_MARKERS`/`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 등 신규·이동 식별자도 기존 컨벤션(UPPER_SNAKE 상수, 서술적 함수명)과 어긋나지 않는다.

- **출력 포맷 규약**: 마스킹 마커 집합(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)의 SoT가 backend `sanitize-error-message.ts`라는 서술과 실제 코드가 일치하고(diff에서 export 위치만 재배치, 값 불변), R17 본문이 이미 "egress 층은 ingestion 층의 마커를 덮지 않는다"(같은 마커 집합 재마스킹 금지)를 규정한 것과 신규 프런트 가드가 어긋나지 않는다. 프런트 `MASK_MARKERS`가 backend와 **동일 리터럴 3종**을 그대로 미러하고 있어 "값 자체를 넓히지 않는다"는 원칙(swagger.md §1-4 열린/닫힌 map 구분과 같은 결의 원칙)과도 부합한다.

- **문서 구조 규약**: `14-external-interaction-api.md`는 Overview(§Overview 제품 정의)/본문(§3~§12)/Rationale(§Rationale, R1~R19+) 3섹션 구조를 유지하며, 신규 불릿은 기존 R17 안의 "잔여 ①②③" 열거 옆에 **번호를 부여하지 않은 채** 삽입됐다(잔여②·잔여③ 사이). 확인해 본 결과 이 불릿은 그 자체가 새로운 "잔여(미해소 갭)" 항목이 아니라 잔여②(Execution.inputData)와 새 폼 defaultValue 케이스를 묶어 설명하는 교차-참조 성격이라, 잔여 ①②③ 시퀀스에 번호로 끼워넣지 않은 편이 오히려 옳다 — 이 절 자신이 "번호 글리프가 섞이면 인용이 섞인다"(line ~1520)고 명시적으로 경계하는 지점이라 더 눈여겨봤으나, 실제로는 시퀀스를 깨지 않는다. `_product-overview.md`·`0-` prefix 등 파일 명명 규칙은 이번 diff가 건드리지 않는다.

- **API 문서 규약**: 이번 라운드는 신규 컨트롤러·DTO를 추가하지 않았다(프런트 컴포넌트·i18n·문서 MDX 변경뿐). `swagger.md`의 DTO/`@ApiProperty` 규약, §3의 "보안·정책 캐비엇 예외"(2026-08-17 규약화)는 이번 diff 범위 밖 커밋(#1180, origin/main에 이미 병합)에서 도입된 것으로, 이번 변경분과는 직접 접점이 없다.

- **금지 항목**: swagger.md §6 "빈 껍데기 스키마 금지", node-output.md "config 절대 echo 금지" 등 명시적 금지 패턴을 새로 답습한 곳은 없다. `node-output.md`가 이미 "egress 값-마스킹이 이 금지를 backstop한다"(2026-08-17 명시, 선행 커밋 #1180)고 선언해 둔 것과 이번 프런트 가드는 같은 방향(egress 마스킹을 무력화하지 않고 오히려 라운드트립 오염을 추가로 차단)이다.

### 참고용 INFO — `code:` frontmatter 커버리지 (완전성 제안, 위반 아님)

- **target 위치**: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 배열 (파일 상단).
- **관련 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 정의, §R-1(글로브 허용의 알려진 한계).
- **상세**: R17 본문이 마스킹 SoT로 반복 인용하는 `codebase/backend/src/shared/utils/sanitize-error-message.ts`와, 이번 라운드에 "닫는 조건"의 첫 구현으로 명시 서술된 `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`가 frontmatter `code:` 목록에 명시돼 있지 않다(단 `triggers/dto/interaction-config.dto.ts` 등 인접 파일은 이미 등재). `spec-code-paths.test.ts` 가드는 glob ≥1 매치만 요구하므로 이미 통과 상태이고, spec-impl-evidence.md §R-1이 "글로브의 stale/불완전성은 `/spec-coverage`가 보완한다"고 명시적으로 수용하고 있어 **규약 위반은 아니다**.
- **제안**: 다음 spec 갱신 시 두 경로를 `code:`에 추가하면 evidence 추적 완전성이 개선된다(강제 아님, INFO).

## 요약

이번 라운드(§R17 "프리필 왕복" 불릿 + `nodeLabel` 정정 + background.md 미러 갱신 + frontend 마스킹-프리필 가드/문서/i18n)는 `spec/conventions/**`가 정의한 명명·출력 포맷·문서 구조·API 문서·금지 항목 어느 축에서도 새로운 위반을 만들지 않았다. 마커 리터럴은 backend SoT와 프런트 미러가 정확히 일치하고, i18n Principle 1/2(dict 키 경유·ko/en parity)·Principle 6(해요체 톤)를 그대로 준수했으며, `nodeLabel` 정정은 기존에 확립된 정본 표기와의 잔존 불일치를 해소하는 방향이다. 유일하게 남는 것은 frontmatter `code:` 완전성에 대한 INFO 수준 제안뿐이다.

## 위험도

NONE
