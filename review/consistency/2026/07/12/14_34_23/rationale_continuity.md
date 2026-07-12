# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-draft-webchat-en-i18n.md` (channel-web-chat 위젯 chrome 문자열 EN 다국어화 — locale 활성)

## 조사 방법 메모

`_prompts/rationale_continuity.md` 의 "관련 Rationale 발췌" 절은 payload 크기 한도로 잘려(`... (truncated due to size limit) ...`,
714행에서 절단) `spec/5-system/*`·`spec/7-channel-web-chat/*`·`spec/conventions/i18n-userguide.md` 의 Rationale 이
누락돼 있었다 — 정작 본 target 이 직접 인용하는 근거 문서들이다. 발췌 누락을 보완하기 위해 아래 원본 파일을 직접
Read 로 확인했다: `plan/complete/webchat-i18n-scope.md`, `spec/7-channel-web-chat/2-sdk.md` §4/Rationale,
`spec/7-channel-web-chat/_product-overview.md` §2/Rationale, `spec/7-channel-web-chat/1-widget-app.md` 구조/Rationale,
`spec/7-channel-web-chat/5-admin-console.md` §4/§6.1, `spec/conventions/i18n-userguide.md` §적용 범위/Rationale.
또한 target §3.5 인벤토리의 파일:라인 인용을 실제 코드(`codebase/channel-web-chat/src/widget/components/*.tsx`)와
대조했다 — 전수 정합(허위/과장 인용 없음).

## 발견사항

### [INFO] "이득 0" 전제 재평가를 신규 Rationale 에 명시적으로 남길 것
- target 위치: §4 "Edit E — `i18n-userguide.md §적용 범위`"
- 과거 결정 출처: `spec/conventions/i18n-userguide.md` `## Rationale` → "왜 channel-web-chat 위젯은 dict-indirection
  스코프 밖인가" — *"사용자 언어가 한 종류뿐인 표면에 dict 키 경유(Principle 1·2)를 강제하면 parity 가드·이중 사전
  유지 비용만 늘고 지역화 이득은 0이다."*
- 상세: 이 "이득 0" 전제는 EN 지원 착수로 명백히 소멸한다(언어가 2종이 되므로). target 은 이를 "메인 앱 dict 시스템의
  구체 기구는 아님" 이라는 구분으로 정확히 처리하지만(별도 정적 번들·물리적 분리 근거는 여전히 유효 — §5 Rationale
  "위젯 로컬 catalog(vs frontend dict import)" 에서 계승), Edit E 서술 계획에는 "이득 0 전제가 더 이상 성립하지 않는다" 는
  명시적 문장이 없다 — "메인 앱 dict 시스템 P1·2 의 구체 기구는 아님" 만으로는 왜 로컬 parity 는 이제 요구되는지가
  독자에게 묵시적으로만 전달된다.
- 제안: Edit E 의 i18n-userguide.md Rationale 갱신 시 "이득 0" 문장을 "위젯 로컬 dict 도입 후 이득 0 전제 폐기 — 단
  메인 앱 dict 시스템(P1·2 의 구체 기구)과의 물리적 분리 근거는 유지" 식으로 명시적으로 갱신해 과거 문장과의 인과
  관계를 남긴다(무근거 번복 방지 원칙에 더 엄격히 부합).

### [INFO] enforcement 현실 서술("가드가 이미 위젯 스캔 밖")의 시점 경과 명시
- target 위치: §3.1 "ko/en leaf key parity 필수 … 위젯 로컬 parity 테스트로 가드"
- 과거 결정 출처: `spec/conventions/i18n-userguide.md` §적용 범위 — *"enforcement 현실과 일치: `hardcoded-korean-ratchet`
  … `doc-sync-matrix` … 둘 다 이미 위젯을 스캔하지 않는다. 본 절은 그 현실의 명문화이지 가드 스캔 범위 변경이 아니다."*
- 상세: 이 문장은 "위젯에는 자동 가드가 없다(=필요 없다)" 는 인상을 준다. target 구현이 완료되면 위젯도 자체 ko/en
  parity 자동 가드를 갖게 되므로(§3.1), 위 문장을 그대로 두면 "위젯은 가드 스캔 밖" 이라는 옛 서술이 "위젯은 전역
  가드 스캔 밖이지만 로컬 가드가 새로 생긴다" 로 갱신돼야 정합이 유지된다. CRITICAL/WARNING 은 아니다 — Edit E 가
  §적용 범위를 어차피 개정하므로 이 갱신도 자연스럽게 포함될 여지가 크지만, plan §4 의 Edit E 항목 설명에 "로컬
  가드 신설" 언급이 없어 누락 가능성이 있다.
- 제안: Edit E 서술에 "위젯 로컬 parity 테스트(신규)가 이 스코프 밖 서술의 backstop 을 대체한다" 한 문장을 추가.

### [INFO] EIA sample payload 의 `"locale": "ko"` 예시는 target 의 spec_impact 밖
- target 위치: 해당 없음 (target 의 5개 Edit 대상 목록에 없음)
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` (§`interaction.appearance` 샘플 JSON, 194행)
- 상세: 이 파일은 `BootConfig`/`WebChatAppearanceDto` 를 미러하는 예시 JSON에 `"locale": "ko"` 를 싣고 있다. Rationale
  본문의 "reserved/inert" 서술은 없고 단순 예시값이라 직접적 충돌은 아니다(reserved→active 전환도 값 자체를 무효화하지
  않음). 참고용으로만 남긴다 — target 은 이미 관련 5개 파일을 spec_impact 로 선언했고 이 파일은 그 범위 밖이라도 무방.

## 종합 판단

target 은 rationale-continuity 관점에서 매우 신중하게 설계됐다. 실제로:

1. **기각된 대안 재도입 여부** — `plan/complete/webchat-i18n-scope.md` 를 직접 대조한 결과, target §1 의 인용
   ("(c) 기각: EN 착수 = 코드 변경, 본 태스크 '코드 변경 없음' 명시. Korean-only 상태에서 dict-indirection 은 이득
   0 → v1 defer.")은 원문과 정확히 일치한다. (c) 의 기각 사유는 merits 가 아니라 "이번 태스크는 코드 변경 없음"
   이라는 스코프 한정이었고, 그 결정 자체가 "코드 변경 마일스톤이 오면 재검토" 를 내포한다 — 재도입이 아니라 예정된
   활성화다. (사용자 메모리 교훈 "Rationale 기각된 대안은 실제 이력 필수" 기준으로도 이 인용은 지어낸 것이 아니라
   실측이다.)
2. **합의된 원칙 위반 여부** — 없음. `spec/7-channel-web-chat/2-sdk.md §R6`("locale 은 reserved(삭제 대신
   정직화)")·`_product-overview.md §2`("EN 지원 착수 시 활성화될 reserved 필드")·`i18n-userguide.md` §적용 범위
   ("EN 위젯 지원을 착수하면 본 제외를 재검토한다.") 세 곳 모두 이 정확한 활성화 경로를 명시적으로 예약해 뒀다.
   target 의 인용은 실제 문구와 축약 없이 일치.
3. **결정의 무근거 번복 여부** — 없음. reserved→active 전환(Edit B/C)·i18n-userguide carve-out 개정(Edit E) 모두
   target §5 "Rationale (결정 근거)" 에 새 근거를 명시하고, 3개 spec 파일의 `## Rationale`(R6 재작성 등)도 함께
   갱신하는 계획이라 결정 번복이 spec 자체에 흔적 없이 사라지지 않는다.
4. **암묵적 가정 충돌 여부** — 없음. "위젯은 별도 정적 번들이라 frontend dict 를 import 할 수 없다"(물리적 분리
   invariant)는 target §3.1·§5 가 그대로 계승해 "위젯 로컬 catalog" 를 택하고, 메인 앱 dict 시스템(P1·2)의
   구체 기구로 편입하지 않도록 정확히 경계를 그었다 — `spec/conventions/i18n-userguide.md §적용 범위` 가 이미
   구축한 "글로벌 규약 + 위젯 carve-out + 명시 Rationale" 구조(`conversation-thread §9` 선례 계승)를 깨지 않는다.
5. **사실 정합성(부가 확인)** — §3.5 인벤토리의 파일:라인 인용(`composer.tsx`·`panel.tsx`·`launcher.tsx`·
   `presentations.tsx`·`dynamic-form.tsx`·`use-widget.ts`)을 실제 코드와 전수 대조한 결과 모두 정확했다 — 근거를
   지어내지 않고 실측에 기반한 draft 다.

발견된 3건은 모두 INFO 수준 — 이미 계획된 Edit E(i18n-userguide.md 개정) 안에 한두 문장을 보강하면 해소되는
정합 보완 제안이며, target 의 채택/설계 자체를 바꾸지 않는다. CRITICAL/WARNING 급 발견은 없었다.

## 위험도

LOW
