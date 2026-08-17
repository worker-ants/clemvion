# 정식 규약 준수 검토 — spec/5-system/ (EIA masking round2, 4차 재검)

## 검토 범위·전제

`--impl-done`, diff-base `origin/main`, target `spec/5-system/`. 이 조합(EIA 마스킹 프런트 프리필
가드)에 대한 convention_compliance 검토는 이번이 4번째다 — `11_38_00`(--impl-prep, MEDIUM)
→ `12_06_15`(--impl-done, NONE) → `12_34_24`(round2 코드 반영 후, LOW: WARNING 1 + INFO 2)
→ 본 라운드(`12_57_52`, df708f4f8 이후). 앞 세 라운드의 원문을 모두 읽고, `12_34_24`가 남긴
WARNING/INFO가 직후 커밋 `df708f4f8`("fix(docs): stale 문장을 고치다 죽은 포인터를 만들었다 —
라운드2 게이트 처분")에서 실제로 해소됐는지 저장소 원본(HEAD 워킹트리, 절대경로)을 직접
Read/grep 해 재확인했다. 번들 prompt(`_prompts/convention_compliance.md`)의 conventions 상당수는
컨텍스트 예산 초과로 절단돼 있어(`node-output.md`·`swagger.md`·`error-codes.md`·
`execution-context.md`·`redis-keys.md`·`migrations.md`·`interaction-type-registry.md` 등)
그 부분은 번들 대신 저장소 원본 파일을 직접 열어 대조했다.

## 발견사항

이번 라운드의 실질 diff(`df708f4f8`, target 범위 내 유일한 spec 변경)는 다음 두 줄뿐이다:

1. `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 에
   `sanitize-error-message.ts` / `dynamic-form-ui.tsx` 두 항목 추가
2. 같은 파일 §R17 "프리필 왕복" 신규 불릿의 `carve-out` → `카브아웃` 표기 통일 (2곳)

두 항목 모두 직전 라운드(`12_34_24`)가 낸 WARNING 1건("frontmatter `code:` 가 §R17 이 새로
지목한 구현 표면 2곳을 누락")과 INFO 1건("`carve-out`/`카브아웃` 표기 혼용")을 정확히 겨냥한
수정이다. 저장소 원본을 직접 확인한 결과:

- `spec/5-system/14-external-interaction-api.md` frontmatter `code:` (line 6-22)에
  `codebase/backend/src/shared/utils/sanitize-error-message.ts`(line 13)와
  `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`(line 14)가
  실제로 등재돼 있다 — WARNING 해소 확인.
- `grep -n "carve-out" spec/5-system/14-external-interaction-api.md` 결과 0건, 같은 개념을
  가리키는 6곳(line 1535/1537/1541/1564/1569/1604) 모두 "카브아웃"으로 통일돼 있다 — INFO
  해소 확인.

이번 라운드에서 **새로운 CRITICAL/WARNING 급 정식 규약 위반은 발견하지 못했다.** 점검 관점별
확인 내용은 다음과 같다.

- **명명 규약**: `MASKED_MARKERS`/`isMaskedMarker`가 backend `sanitize-error-message.ts`(내부
  전용 `const`/함수)와 frontend `dynamic-form-ui.tsx`(export)에서 이름·시그니처가 정확히
  동일함을 두 파일 원본 대조로 확인(`typeof v === "string" && MASKED_MARKERS.has(v)` 동일
  구현). backend 주석이 "프런트 미러가 있다"며 명시적으로 그 사실을 선언하고 있어 SoT-미러
  관계가 코드·문서 양쪽에서 일관되게 문서화돼 있다. `spec/5-system/3-error-handling.md`·
  `6-websocket-protocol.md`의 기존 `nodeLabel` 정정과 `15-chat-channel.md`의 이번 정정도
  실제 코드(`chat-channel.dispatcher.ts`의 `nodeLabel` 필드)와 일치. `grep -rn nodeName spec/`
  결과 남은 2곳은 모두 의도적(미구현 `execution.paused` 이벤트 표기 + 정정 이력 서술)이라
  drift 아님.
- **출력 포맷 규약**: 마스킹 마커 리터럴(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 3종이 backend
  SoT·frontend 미러·spec 서술 3곳에서 정확히 일치. `deepRedactSecrets`가 이미 마스킹된
  마커를 재마스킹하지 않는 기존 계약(§R17)과 신규 프런트 가드가 상충하지 않음.
- **문서 구조 규약**: `14-external-interaction-api.md`는 Overview/본문/Rationale 3섹션
  구조를 유지. 신규 불릿은 R17 "잔여 ①②③" 원형숫자 시퀀스를 침범하지 않고 교차-참조로만
  삽입됨(`12_06_15`가 이미 확인). 파일·식별자 명명(`_product-overview.md`, `0-` prefix)은
  이번 diff와 무관.
- **API 문서 규약**: 이번 라운드는 신규 컨트롤러·DTO·Swagger 데코레이터를 추가하지 않음
  (frontend 컴포넌트·i18n dict·문서 MDX·CHANGELOG만 변경) — 해당 사항 없음.
- **금지 항목**: `node-output.md` Principle 7의 "config 절대 echo 금지"·swagger.md의 "빈
  껍데기 스키마 금지" 등 명시적 금지 패턴을 새로 답습한 곳 없음.
- **i18n/사용자 가이드 규약**(`spec/conventions/i18n-userguide.md`, target 범위 밖이지만
  이번 diff의 큰 축이라 함께 대조): 신규 dict 키 `formMaskedDefaultHint`가 ko/en 양쪽에
  동시 추가돼 Principle 2(leaf key parity) 준수, `dynamic-form-ui.tsx`에서 `t()` 경유로만
  노출돼 Principle 1(하드코딩 금지) 준수, 한국어 문구("...가려졌어요. 값을 직접 입력해
  주세요.")가 해요체 · 금지어 없음으로 Principle 6 준수. `run-results.mdx`/`.en.mdx`
  Error 탭 설명 추가도 Principle 6-B(내부 SoT 미노출 — `R17`/`spec/` 경로 등 미언급) 준수.

### [INFO] (참고, 신규 아님) EIA §R17 신규 계약이 여전히 본문(§3~§8)에 요약 pointer 없이 Rationale 전용
- target 위치: `spec/5-system/14-external-interaction-api.md` — §3.2(EIA-IN-10 `submit_form`)·
  §5(`formConfig` shape, line ~486-724)·§8(보안, line 928-1160) 어디에도 "마스킹된 `defaultValue`는
  프리필되지 않는다" 류의 본문 요약이 없다. 관련 계약은 전부 §Rationale R17(line 1605-1616)에만 있다.
- 위반 규약: CLAUDE.md "정보 저장 위치" 표 — 기술 명세는 `spec/<영역>/*.md 본문`, 결정의 배경은
  `## Rationale`. `11_38_00`(1차 라운드)가 이미 이 문서의 구조적 패턴(핵심 계약이 본문 요약 없이
  Rationale에만 존재)을 WARNING으로 지적한 바 있다.
- 상세: 다만 이번 신규 불릿은 **서버-클라이언트 wire 계약을 바꾸지 않는다** — `formConfig`
  payload 자체는 여전히 마스킹된 채로(변경 전과 동일하게) 나가고, 새로 생긴 것은 "프런트가
  그 마커를 프리필하지 않는다"는 **소비 쪽(클라이언트 UI) 동작**이다. §5는 wire shape 문서이지
  클라이언트 렌더 로직 문서가 아니므로, 1차 라운드가 지적한 "서버 마스킹 표면 열거"류 항목보다는
  본문 귀속 근거가 약하다 — `12_06_15`·`12_34_24` 두 후속 라운드도 이 지점을 재지적하지 않고
  수렴했다. 새로 도입된 위반이 아니라 이 문서가 이미 채택한 "R14·R17·§6.4 는 알려진 갭을
  invariant 옆에 적는다"(line 847) 관행의 연장이다.
- 제안: 규약 갱신은 불필요. 다음에 R17을 다시 손댈 기회가 있으면 §5 `formConfig` 서술 옆에
  "프리필 시 마커 감지·미프리필" 1줄 pointer를 추가하는 정도로 충분(강제 아님).

### [INFO] (참고, 신규 아님) `6-websocket-protocol.md` `## Overview` 섹션 여전히 부재
- target 위치: `spec/5-system/6-websocket-protocol.md` line 26 — frontmatter 직후 바로
  `## 1. 연결`로 진입, `## Overview` 헤딩 없음(`## Rationale`은 line 989).
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview/본문/Rationale) 권장".
- 상세: `11_38_00`이 이미 지적한 기존 결함이며 이번 라운드 diff는 이 파일을 건드리지 않았다
  (`git diff origin/main...HEAD -- spec/5-system/6-websocket-protocol.md` 결과 없음).
- 제안: 이번 라운드 범위 밖. 다음에 이 파일을 편집할 기회에 반영 권고.

## 요약

`12_34_24` 라운드가 낸 유일한 WARNING(frontmatter `code:` 누락 2건)과 INFO(carve-out/카브아웃
표기 혼용)는 직후 커밋 `df708f4f8`에서 정확히 해소됐음을 저장소 원본으로 직접 재확인했다.
이번 라운드의 실질 diff(frontmatter 2줄 추가 + 표기 통일 2곳, 그리고 사전 라운드에서 이미
검증된 frontend 가드·i18n dict·user-guide MDX·CHANGELOG 재배치)는 명명·출력 포맷·문서 구조·
API 문서·금지 항목 어느 축에서도 새로운 정식 규약 위반을 만들지 않는다. 남은 것은 이번 라운드가
만든 것이 아니라 이전부터 있던 두 구조적 관찰(§R17 신규 계약의 본문 요약 부재, `6-websocket-
protocol.md`의 Overview 섹션 부재)뿐이며, 둘 다 세 차례의 독립 리뷰가 이미 "신규 위반 아님"으로
수렴한 항목이라 INFO로 하향해 참고용으로만 남긴다.

## 위험도

NONE
