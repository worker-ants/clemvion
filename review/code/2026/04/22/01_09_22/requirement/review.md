## 요구사항 코드 리뷰

### 발견사항

---

**[WARNING] 스트리밍 중 partial 토큰 노출 가능성**
- 위치: `harmony-filter.ts` 전반 / 스펙 §3.2
- 상세: 스펙은 "사용자에게는 제어 토큰·원시 JSON 이 노출되지 않는다"를 보장으로 명시하나, 스트리밍 중 토큰이 청크 경계에서 잘리면(`<|channel|>comm` 까지만 수신) `CHANNEL_BLOCK_RE`도 `STRAY_TOKEN_RE`도 매칭하지 못해 부분 토큰이 일시적으로 렌더된다. 완성된 메시지 기준으로만 보장이 성립함.
- 제안: 스펙에 "스트리밍 완료 후 최종 렌더 시 보장 (in-flight delta는 brief flicker 허용)" 같은 단서를 추가하거나, `sanitizeAssistantText` 에 불완전 토큰 감지(`/<\|[^|>]*$/`)를 추가해 스트리밍 중에도 안전하게 만들어야 한다.

---

**[WARNING] `replace(m[0], "")` 첫 번째 일치만 제거**
- 위치: `harmony-filter.ts:44` — `out = out.replace(m[0], "")`
- 상세: `String.replace(string, "")` 는 첫 번째 일치만 제거한다. 동일한 채널 블록이 문자열에 두 번 이상 등장하면(edge case지만 모델이 같은 응답을 반복 생성하는 경우) 두 번째 이후는 그대로 남고 `stripHarmonyTokens` 가 `<|message|>body` 형태의 잔여물을 남긴다.
- 제안: `out = out.replaceAll(m[0], "")` 또는 `m[0]`를 `RegExp`로 escape해서 `g` 플래그와 함께 사용.

---

**[WARNING] `CHANNEL_BLOCK_RE` 가 `<|constrain|>` 를 채널명 일부로 오인할 여지**
- 위치: `harmony-filter.ts:26` — `([a-zA-Z_-]+)[\s\S]*?<\|message\|>`
- 상세: `<|channel|>commentary <|constrain|>json<|message|>body` 에서 그룹 1은 `"commentary"` 만 캡처하고 `<|constrain|>json` 은 `[\s\S]*?` 에 흡수된다. 현재는 동작하나, 채널명과 `<|constrain|>` 사이 공백이 없으면(`<|channel|>commentary<|constrain|>...`) `[a-zA-Z_-]+` 가 공백 이전까지만 캡처한다. 실제 토큰 패턴이 확정적이지 않아 취약하다.
- 제안: 채널명 이후 `<|message|>` 사이의 캡처 범위를 명시적으로 정의하거나 `(?:<\|[^|>]*\|>|\s)*?` 같이 inner 토큰을 건너뛰도록 보강.

---

**[INFO] `MarkdownRenderer`에서 sanitize 이중 호출**
- 위치: `markdown-renderer.tsx:27` / `assistant-message.tsx:44`
- 상세: `assistant-message.tsx`가 이미 sanitized 결과(`displayText`)를 `MarkdownRenderer`에 전달하는데, `MarkdownRenderer` 내부에서도 `sanitizeAssistantText`를 다시 호출한다. 기능상 문제는 없으나 불필요한 연산이며, `MarkdownRenderer`가 독립 컴포넌트로 쓰이는 경로가 없다면 이중 호출이 됨.
- 제안: `MarkdownRenderer`의 sanitize는 방어 레이어로 의도적이라면 주석에 "독립 사용 시 방어용"임을 명시. 그렇지 않다면 `markdown-renderer.tsx`의 sanitize 제거.

---

**[INFO] `lastSignature` 내 `.filter()` 매 렌더 실행**
- 위치: `assistant-panel.tsx:74` — `last.plan?.steps.filter((s) => s.status === "done").length`
- 상세: 이 표현식은 `AssistantPanel`이 리렌더될 때마다(메시지 외의 이유로도) 실행된다. 채팅 패널 규모에서는 무시해도 좋지만, `useMemo`나 selector 레벨에서 계산하면 깔끔하다.
- 제안: 간단히 `useMemo` 로 감싸거나, 스토어 selector에서 done count를 미리 계산.

---

**[INFO] 테스트: 스트리밍 partial 토큰 케이스 누락**
- 위치: `harmony-filter.test.ts`
- 상세: 알려진 한계(streaming partial token)에 대한 테스트 또는 주석이 없다. 미래 기여자가 이 케이스를 알 수 없다.
- 제안: `it("does not strip incomplete harmony tokens mid-stream", ...)` 케이스를 추가해 현재 동작(partial token pass-through)을 명시적으로 문서화.

---

### 요약

이번 변경은 실제 관찰된 버그(harmony 제어 토큰이 사용자에게 노출)에 대한 방어 레이어를 적절히 구성했다. 시스템 프롬프트 지침 추가, 클라이언트 측 필터, 테스트, 스펙 문서화까지 일관된 방어 심층 구조를 갖추고 있으며 정상 prose가 손상 없이 통과하는 안전 원칙도 준수된다. 다만, 스트리밍 중 partial 토큰 노출이라는 스펙 보장과 구현 간의 간극이 존재하고, `replace(m[0], "")` 의 first-match-only 동작이 edge case에서 잔여 토큰을 남길 수 있다. 이 두 가지 WARNING을 보완하면 완성도가 높아진다.

### 위험도

**LOW** — 대부분의 실사용 시나리오(완성된 메시지, 단일 블록)에서는 올바르게 동작하며, 사용자가 관찰하는 버그는 실질적으로 차단된다. 스트리밍 partial 토큰 노출은 짧은 순간의 flicker 수준이고, first-match-only 이슈는 동일 블록이 2회 이상 등장하는 매우 희귀한 경우에만 발생한다.