# Rationale 연속성 검토 결과

## 검토 대상
- target: `spec/5-system/12-webhook.md` (구현 대상 spec 영역 diff: 없음 — 코드 전용 변경)
- 실제 변경 코드: `codebase/backend/src/modules/hooks/hooks.controller.ts`, `hooks.controller.spec.ts`
- 변경 요지: embed-config 응답의 `Cache-Control` 값(`public, max-age=300`)과 사용자 대면 반영 지연 문구(`5분`)를
  Swagger 문서 문자열·실제 응답 헤더·테스트 단언에 각각 하드코딩하던 것을, 기존 `EMBED_CONFIG_CACHE_SEC` 상수에서
  파생한 `EMBED_CONFIG_CACHE_CONTROL` / `EMBED_CONFIG_CACHE_MAX_MINUTES` 두 상수로 단일화. 값 자체(300초/5분)는
  변경 없음 — 순수 DRY 리팩터.

## 발견사항

없음.

검토 관점 1~4(기각된 대안 재도입/합의 원칙 위반/무근거 번복/암묵적 가정 충돌) 어느 것에도 해당하는 항목을
발견하지 못했다. 근거:

- **기각된 대안 재도입 여부**: `spec/5-system/12-webhook.md` `## Rationale` 의 기존 항목(민감 헤더 마스킹,
  webhook URL base, 본문 크기 분리 임계, throttle fail-open, inline auth 폐지, endpointPath mutable 등) 중
  이번 diff 와 주제가 겹치는 결정은 없다. embed-config 캐싱 정책(`Cache-Control: public, max-age=300`, 5분
  반영 지연) 자체는 `spec/7-channel-web-chat/4-security.md` §3-① 이 SoT 인데, 이번 diff 는 그 값을 그대로
  유지한다 — 폐기·재도입된 대안이 없다.
- **합의된 원칙 위반 여부**: 오히려 이번 diff 는 저장소 전반의 Rationale 이 반복적으로 명시하는 "단일 진실
  (SoT) 원칙"(예: `spec/2-navigation/4-integration.md` "왜 derived 필드인가", `spec/2-navigation/2-trigger-list.md`
  R-14 "AuthConfig 단일 SoT", `hooks.controller.ts` 자체 주석 "실제 응답 헤더와 Swagger 문서 문자열이 공유하는
  Cache-Control 값 — 단일 진실(드리프트 방지)")와 정합적이다. 하드코딩 중복 3곳(Swagger description, Swagger
  example, 실제 `res.set()` 호출)을 상수 1개로 좁혀 향후 오타·단위 실수로 인한 드리프트를 원천 차단한다.
- **결정의 무근거 번복 여부**: 캐시 정책 값(300초/5분)이 바뀌지 않았으므로 "번복"이 아니다. 새 Rationale 이
  필요할 만한 정책 변경도 없다.
- **암묵적 가정 충돌 여부**: 테스트 단언을 `expect.stringContaining('max-age')` → `'public, max-age=300'` 정확
  값 비교로 좁힌 것도 값 불변을 전제로 한 회귀 가드 강화이며, 기존 invariant(`EMBED_CONFIG_CACHE_SEC` 상수가
  캐시 SoT)를 우회하지 않고 오히려 더 엄격히 강제한다.

참고로 컨트롤러 주석의 "I17/I1", "W10" 표기는 spec 본문에서 검색되지 않는(비-정본) 내부 참조 축약으로 보이나,
이번 diff 가 신설한 것이 아니라 기존 코드에 이미 있던 표기를 그대로 유지한 것이므로 본 Rationale 연속성 검토
범위(신규 번복·재도입) 밖이다. (참고용 INFO 로만 남긴다 — 별도 조치 불요.)

## 요약

이번 변경은 `spec/5-system/12-webhook.md` 본문·Rationale 에 아무런 수정도 가하지 않는 순수 코드 리팩터이며,
캐시 정책 값도 그대로 유지한 채 하드코딩 중복을 단일 상수로 좁힌 것이다. 검토한 전 영역(overview, data-model,
navigation 각 화면, webhook, trigger-list, integration 등)의 `## Rationale` 어느 항목과도 충돌하지 않으며,
오히려 저장소 전반에서 반복적으로 채택된 "단일 진실(SoT) / 드리프트 방지" 설계 원칙과 방향이 일치한다. 기각된
대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 것도 관측되지 않았다.

## 위험도

NONE
