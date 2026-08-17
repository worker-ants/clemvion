# 정식 규약 준수 검토 — spec/5-system/ (EIA masking round2)

## 검토 범위

`--impl-done` 모드. diff-base `origin/main`, target `spec/5-system/`. 실제 변경분: `spec/5-system/14-external-interaction-api.md`(§R17 "프리필 왕복" 신설) · `spec/5-system/15-chat-channel.md`(R-CC-15 `nodeName`→`nodeLabel` 정정) · `spec/4-nodes/1-logic/12-background.md`(§8.2 표 셀, 참고용 — target 영역 밖) + 대응 코드(`sanitize-error-message.ts`, `dynamic-form-ui.tsx`, i18n dict, user-guide MDX). 코드 확인은 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-masking-round2-53afc8`) 기준으로 직접 Read/Grep 했다.

## 발견사항

- **[WARNING] frontmatter `code:` 가 이번에 신설된 구현 표면 두 곳을 누락**
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` (파일 상단, id: external-interaction-api)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1/§Overview — "spec 문서가 약속한 surface 와 실제 구현 코드 사이의 정적 증거를 frontmatter 로 명시"
  - 상세: 이번 PR 로 신설된 §R17 "프리필 왕복" 절은 `codebase/backend/src/shared/utils/sanitize-error-message.ts` 를 마커 집합의 SoT 로, `dynamic-form-ui.tsx`(`DynamicFormUI`)를 "그 가드의 첫 조각"으로 명시적으로 지목한다. 그런데 현재 frontmatter `code:` 목록에는 `strip-external-only-fields.ts`·`terminal-duration.ts`·`terminal-error-payload.ts`·`redact-stored-error.ts` 처럼 `shared/utils/` 아래 마스킹 관련 유틸을 개별 등재해 온 기존 패턴이 있음에도 `sanitize-error-message.ts` 는 빠져 있다. 또한 `code:` 전체에 `codebase/frontend/**` 경로가 단 하나도 없어 `dynamic-form-ui.tsx` 도 등재되지 않는다(§R17 본문에 이름으로 인용되는 파일임에도). `spec-code-paths.test.ts` build 가드는 글로브 ≥1 매치만 보므로(다른 backend 글로브가 이미 매치) 이 누락으로 빌드가 깨지진 않는다 — R-1 이 스스로 인정하는 "stale/불완전 글로브는 이 가드만으로 검출 불가" 사각지대에 정확히 해당한다. 다만 이 문서의 기존 관행(마스킹 유틸 개별 등재)과 §R17 본문이 실제로 지목한 구현 파일 사이의 정합이 깨진다.
  - 제안: `code:` 에 `codebase/backend/src/shared/utils/sanitize-error-message.ts` 와 `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` 두 항목을 추가. (참고로 `sanitize-error-message.ts` 는 이미 등재된 `redact-stored-error.ts` 가 import 해 쓰므로 완전히 미검증 상태는 아니지만, R17 이 이 파일을 직접 SoT 로 지목하는 이상 명시적 등재가 이 문서의 기존 개별-등재 관행과 일관적이다.)

- **[INFO] "카브아웃" ↔ "carve-out" 표기 혼용 (신규 텍스트만 영문 표기)**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17, 새로 추가된 "프리필 왕복" 불릿 (`- **폼 경로는 carve-out 으로 풀 수 없다**...`, `...안 나가면 carve-out 이 값싸다`)
  - 위반 규약: 명시적 규약은 없음(spec 본문 표기 글로서리는 `i18n-userguide.md` Principle 6 이 사용자 가시 문자열에만 적용되고 spec 내부 기술 산문에는 적용 대상이 아님) — 문서 자체 내부 일관성 관점의 참고사항
  - 상세: 같은 개념(`Execution.inputData` 재제출 카브아웃)을 같은 §R17 절 안에서 기존 문장들은 전부 "카브아웃"(한글 음역, 1533/1535/1539/1602/1628행)으로 쓰는데, 이번에 새로 추가된 "프리필 왕복" 불릿(1562/1567행) 두 곳만 영문 "carve-out"을 쓴다. 같은 절 안에서 같은 용어의 표기가 갈린다.
  - 제안: 신규 불릿의 "carve-out"을 기존 표기 "카브아웃"으로 통일(또는 반대로 전체를 영문으로 통일). 규약 갱신 사안은 아니고 target 수정으로 충분.

- **[INFO] `nodeLabel` 정정은 실제 코드와 일치 — 정상 반영 (참고, 위반 아님)**
  - target 위치: `spec/5-system/15-chat-channel.md` R-CC-15 (`nodeId` / `nodeLabel` placeholder 문구)
  - 확인: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` 가 실제로 `nodeLabel` 필드를 쓰고 있어(`p.nodeLabel`, `chat-channel.dispatcher.spec.ts` 의 `nodeLabel: '템플릿 2'`), 이번 PR 의 `nodeName`→`nodeLabel` 정정은 명명 규약 위반이 아니라 문서-코드 명명 불일치를 바로잡은 정당한 수정이다. 별도 조치 불필요.

## 요약

이번 라운드의 실제 변경분(§R17 "프리필 왕복" 신설, `nodeLabel` 오탈자 정정, `12-background.md` 마스킹 범위 확장 서술)은 명명 규약·문서 구조(Overview/본문/Rationale)·i18n dict parity(Principle 1·2)·user-guide ko/en sibling 동시 갱신(Principle 5·7)·frontend↔backend 마스킹 마커 이름 완전 일치(`MASKED_MARKERS`/`isMaskedMarker` 양쪽 동일)를 모두 준수한다. API 문서(Swagger) 규약은 이번 diff 에 신규/변경 DTO·엔드포인트가 없어 해당 사항 없음. 유일한 실질 이슈는 `14-external-interaction-api.md` frontmatter `code:` 목록이 §R17 이 새로 지목한 구현 표면(`sanitize-error-message.ts`, `dynamic-form-ui.tsx`) 두 개를 빠뜨린 것으로, `spec-impl-evidence.md` 의 취지(spec 약속 ↔ 구현 증거 정합) 를 약화시키지만 build 가드는 통과한다(R-1 의 알려진 글로브 사각지대). 그 외 발견은 표기 일관성 수준의 INFO 하나뿐이다.

## 위험도

LOW
