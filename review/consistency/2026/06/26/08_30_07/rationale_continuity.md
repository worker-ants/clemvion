# Rationale 연속성 검토 결과

검토 대상: `plan/complete/web-chat-loader-iframe-position.md` (구현 완료 후 diff, scope=codebase/packages/web-chat-sdk)
기준 Rationale 소스: `spec/7-channel-web-chat/2-sdk.md ## Rationale`, `spec/7-channel-web-chat/0-architecture.md`, `spec/7-channel-web-chat/5-admin-console.md`

---

## 발견사항

### [INFO] 구현이 spec 본문 명시 원칙을 충실히 따름 — 별도 Rationale 갱신은 선택적
- target 위치: `bridge.ts` `WidgetBridge` 생성자, `index.ts` `boot()`
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §3` 본문 (line 106) — "position/zIndex 는 `appearance` 를 따른다", §4 BootConfig 스키마 (`appearance.position`/`appearance.zIndex`)
- 상세: 본 구현은 spec 본문이 이미 명시한 설계("코너 고정·z-index 는 appearance 를 따른다")를 구현 누락 상태에서 복원한 버그픽스다. `## Rationale` 절에는 position/zIndex 고정 방식에 대한 명시적 기각 대안이 존재하지 않는다. `DEFAULT_Z_INDEX = 2147483000` 도 spec §1 스니펫 예시값과 일치한다. 기각된 대안(srcdoc, per-node offset 등)을 재도입하는 요소는 없다.
- 제안: 현 Rationale 에 코너 고정 구현 방식(bottom:0 + side:0 flush, 위젯 SPA 내부 16px 여백 전제)을 한 항으로 추가하면 향후 "왜 0이고 16px이 아닌가" 의 자명한 의문에 답할 수 있다. 강제 의무는 아니나 권장.

---

### [INFO] `zIndex:0` falsy 처리 — `??` 연산자 사용, spec 명시 없으나 합의 원칙에 부합
- target 위치: `bridge.ts:146` — `String(deps.zIndex ?? DEFAULT_Z_INDEX)`
- 과거 결정 출처: spec §4 BootConfig 스키마 (`zIndex?: number`), spec §3 본문 "zIndex 는 appearance 를 따른다"
- 상세: `??` 는 `undefined`/`null` 만 폴백하고 `0` 을 유효값으로 통과시킨다. spec 은 `zIndex:0` 의 falsy 처리 방식을 명시하지 않으나, `??` 채택은 "appearance 를 그대로 따른다" 원칙의 안전한 쪽이다(spec 이 지정한 값 0을 DEFAULT 로 덮지 않음). 이를 기각 대안 재도입으로 볼 수 없다. test 에서 `zIndex:0` 케이스를 명시 검증하여 동작을 고정한 것은 양호.
- 제안: 필요시 spec §4 BootConfig 스키마 주석에 "0 은 유효값 (z-index 최저)" 한 줄 추가. 현재 필수 아님.

---

### [INFO] `bottom-left` 외 모든 값을 기본 `bottom-right` 로 처리하는 폴백 정책
- target 위치: `bridge.ts:143-145` — `if (deps.position === "bottom-left") iframe.style.left = "0"; else iframe.style.right = "0";`
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §4` BootConfig — `position?: 'bottom-right' | 'bottom-left'`
- 상세: spec 은 두 값 외에 미지정/미지원 값 도착 시 폴백 정책을 명시하지 않는다. 구현은 "bottom-left 외 모든 값(미지정·미지원 포함) = bottom-right" 로 처리한다. 이는 "항상 한 코너에 고정됨을 보장"하는 방어적 선택으로, spec 이 허용하는 두 값 중 기본값을 암묵적으로 정한 것이다. 기각된 대안을 재도입하거나 합의 원칙을 위반하는 요소는 없다.
- 제안: spec §3 또는 §4 에 "미지정·미지원 값은 bottom-right 로 처리" 한 줄 추가하면 문서-구현 정합이 완성된다.

---

## 요약

본 구현(`web-chat-loader-iframe-position`)은 `spec/7-channel-web-chat/2-sdk.md`가 §3·§4에서 명시한 "position/zIndex 는 appearance 를 따른다" 원칙을 구현 누락 상태에서 복원한 버그픽스다. 검토 범위 내 spec Rationale(R2~R5) 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant를 우회하는 설계 요소는 없다. DEFAULT_Z_INDEX 값·두 position 값·`??` 폴백 정책 모두 spec 본문·스니펫 예시·BootConfig 타입과 정합한다. 선택적 개선 사항으로, 코너 flush 고정 방식(bottom:0 + side:0)과 미지정 position 폴백 정책을 spec §3 Rationale 에 한 항 추가하면 "왜 16px이 아닌 0인가" 의문을 문서로 차단할 수 있다.

## 위험도

NONE
