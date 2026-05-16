# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `third-party-oauth.controller.spec.ts` — 타입 캐스팅 정밀화
  - 위치: `파일 3`, L154–160
  - 상세: `Record<string, unknown>` 을 `Record<string, string>` 으로 좁히고, `String(contentType ?? '')` 대신 `contentType ?? ''` 직접 사용. 기능상 동일하지만 본 작업(source 마커 구현)과 무관한 테스트 코드 정밀화다. 범위 이탈이나 위험한 변경은 아니고, 실제로 더 정확한 타입 단언이므로 낮은 등급으로 분류.
  - 제안: 이 변경이 source 마커 PR과 묶일 필요가 없다면 별도 커밋 또는 PR로 분리하는 것이 이상적이다. 단, 실질적 위험은 없다.

- **[INFO]** `review/consistency/2026/05/16/10_01_06/_prompts/convention_compliance.md` — consistency-check 세션 결과물 포함
  - 위치: `파일 14` (diff 에 포함된 신규 파일)
  - 상세: 파일 14는 impl-prep consistency-check 의 orchestrator prompt 파일로, 2688줄에 달하는 spec 전체를 포함한다. 이는 review/consistency/ 아래 시점 기록 성격의 문서이므로 CLAUDE.md 규약상 올바른 위치이며 보존 대상이다. 그러나 이 파일이 source 마커 PR 의 git diff 에 포함된다는 점은 PR 크기를 과도하게 키우는 원인이 될 수 있다. 규약 위반은 아니나, 코드 리뷰어가 핵심 변경을 파악하는 데 노이즈가 된다.
  - 제안: consistency-check 산출물을 별도 커밋으로 분리하거나, PR description 에서 리뷰 대상 외 파일임을 명시하면 충분하다.

- **[INFO]** `withSourceMarker` 헬퍼가 `system` 역할 메시지에도 적용될 수 있는 구조
  - 위치: `파일 2`, `withSourceMarker` 함수 (L96–104)
  - 상세: `withSourceMarker` 는 system 메시지가 아직 걸러지지 않은 배열에 대해서도 호출 가능한 generic 함수다. 실제 호출 지점(L120, L129)에서는 항상 `.filter((m) => m.role !== 'system')` 이후에 호출되므로 runtime 문제는 없다. 다만 함수 시그니처만 보면 system 메시지에 `source: 'live'` 를 붙일 수 있어 의도가 불명확하다. 요청 기능의 범위 이탈은 아니지만 향후 유지보수 혼선 소지가 있다.
  - 제안: JSDoc 또는 파라미터 타입을 `Array<Record<string, unknown> & { role: Exclude<string, 'system'> }>` 등으로 좁히거나, 함수 내부에 `m.role === 'system'` 가드를 추가하면 의도가 명확해진다. 필수 사항은 아니다.

## 요약

이번 변경은 AI 대화 메시지에 `source: 'live' | 'injected'` 마커를 도입하는 단일 목적에 매우 충실하다. 수정된 7개 코드 파일(backend interface, service, handler, 테스트 4건 + frontend store, utils, hook 타입 inline)은 모두 해당 기능과 직접 연결된다. plan 파일(`spec-update-impl-prep-findings.md`)과 consistency-check 산출물(`SUMMARY.md`, `_prompts/convention_compliance.md`)은 CLAUDE.md 규약에 따른 산출물 보관으로, 범위 이탈이 아니다. `third-party-oauth.controller.spec.ts` 의 타입 캐스팅 정밀화(파일 3)는 본 작업과 기능적 연관이 없는 소규모 정리이나, 실질 위험은 없으며 무관한 로직 변경도 아니다. 전체적으로 불필요한 리팩토링, 기능 확장, 무관 파일 수정은 없다.

## 위험도

LOW
