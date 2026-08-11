# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat/4-security.md` (apiBase http(s) 스킴 검증 확장)

## 검토 범위

target 변경: `4-security.md` §1 표 + Rationale R0 — `wc:boot` 경로의 `apiBase` 도 `?apiBase=` 쿼리 폴백과
동일하게 **http(s) 스킴만 허용**(`safeApiBase`)하도록 확장(종전엔 쿼리 폴백에만 적용). 거절 시 그 필드만
버리고(undefined) `console.warn`, 부팅 자체는 막지 않는다.

대조한 관련 spec: `spec/7-channel-web-chat/{2-sdk,3-auth-session,1-widget-app,0-architecture,5-admin-console}.md`
(번들에 전문 포함, 절대경로 확인 불필요 — 순수 spec-vs-spec 대조).

## 발견사항

- **[INFO]** `2-sdk.md` 의 공개 `BootConfig` 타입·`wc:boot` 프로토콜 서술이 apiBase 스킴 검증을 참조하지 않음
  - target 위치: `4-security.md` §1 표 "`apiBase` 입력 검증" 행 + Rationale R0
  - 충돌 대상: `2-sdk.md` §4 `BootConfig` 타입 블록(`apiBase: string;`, 스킴 제약 없는 평범한 `string`)과 §3
    `wc:boot` 프로토콜 표(`전체 boot config` 라고만 서술, 검증 언급 없음)
  - 상세: 직접적인 반대 주장("임의 스킴 허용")은 없다 — TS `string` 타입이 곧 "런타임에서 임의 값을 그대로
    쓴다"는 의미는 아니므로 이는 모순(CRITICAL/WARNING)이 아니라 **문서 간 상호참조 누락**이다. 다만 `2-sdk.md`
    만 읽는 SDK 통합 개발자는 `apiBase` 에 대한 런타임 스킴 제약(http(s) 전용, 위반 시 그 필드만 조용히
    무시)의 존재를 알 방법이 없다 — 특히 §3 "`wc:boot` 재전송(멱등 재설정)" 절이 `apiBase` 가 바뀐 재부팅의
    세션 폐기(§R8 참조)는 명시하면서, 같은 재전송에서 `apiBase` 자체가 검증 대상이라는 사실은 언급하지 않는다.
  - 제안: `2-sdk.md` §4 `BootConfig` 스키마 블록 또는 §3 `wc:boot` 행에 `apiBase` 스킴 검증(`4-security.md`
    §1 "`apiBase` 입력 검증")으로의 상호참조 한 줄 추가. target 자체 수정은 불요 — `2-sdk.md` 쪽 동반 갱신 권장.

- **[INFO]** `1-widget-app.md` 상태기계가 "config 미적용으로 인한 무통지 정체" 경로를 서술하지 않음
  - target 위치: `4-security.md` Rationale R0 본문 및 diff 주석("거절 시 그 필드만 버린다 — 부팅을 막지
    않는다")
  - 충돌 대상: `1-widget-app.md` §3 상태기계 다이어그램·§3.1 표(`[collapsed]→[panel]→[booting]→[streaming]`)
  - 상세: "거절 시 그 필드만 버리고 부팅은 막지 않는다"는 주장은 `safeApiBase`/`mergeBootConfig` 함수 레벨에서는
    참이다(그 함수는 boot 자체를 중단시키는 어떤 동작도 하지 않는다). 그러나 두 입력 경로(쿼리·boot) 모두에서
    `apiBase` 가 거절/부재로 귀결되면, 병합된 `cfg.apiBase` 가 falsy 가 되고 `applyConfig` 의
    `if (!cfg.apiBase || !cfg.triggerEndpointPath) return;` 가 **경고도 dispatch 도 없이** 조용히 빠져
    config 자체가 전혀 적용되지 않는다 — 즉 `[panel]→[booting]` 전이가 애초에 발동하지 않을 수 있다. 이 경로는
    `1-widget-app.md` §3/§3.1 어디에도 문서화돼 있지 않다(그 문서는 정상 부팅·`blocked`·토큰 만료 등만 다룸).
    다만 이는 **이번 diff 가 새로 만든 결함이 아니다** — target 의 R0 자신이 "이 하드닝은 그 조용한 분기의
    도달 빈도를 넓혔을 뿐 새 침묵을 만들지는 않았다 — 선재 갭이며 별도로 등재했다(ai-review `15_16_20`
    side_effect)"라고 명시적으로 인지·추적 중임을 밝히고 있다. 따라서 이는 target 과 `1-widget-app.md` 의
    "직접 모순"이 아니라, 두 문서 모두가 아직 이 edge case 를 상호참조하지 않는 **기존 문서 갭의 연장**이다.
  - 제안: (target 이 아니라 별도 트래킹 항목의 몫) 그 side-effect 항목이 처리될 때 `1-widget-app.md` §3.1 에도
    "config 미적용(무통지) 정체" 행을 추가해 상태기계 표를 완전하게 할 것을 권고. target 자체는 이 절을
    수정할 필요 없음(R0 가 이미 정직하게 스코프를 한정).

## 점검 관점별 결과

1. **데이터 모델 충돌** — 없음. `apiBase` 는 어느 문서에서도 별도 엔티티/필드로 재정의되지 않는다.
2. **API 계약 충돌** — 없음. endpoint·method·request/response shape 변경 없음(순수 클라이언트측 입력 검증 강화).
3. **요구사항 ID 충돌** — 없음. target 은 신규 요구사항 ID 를 부여하지 않음(Rationale 순번 `R0` 는 문서 내부
   전용이며 타 영역 ID 체계와 무관).
4. **상태 전이 충돌** — 직접 충돌 없음(위 두 번째 INFO 참조 — 서술 갭이지 반대 주장 아님).
5. **권한·RBAC 모델 충돌** — 해당 없음(RBAC 비관여 변경).
6. **계층 책임 충돌** — 없음. 검증 책임(위젯 클라이언트, `use-widget.ts`)은 기존 설계(위젯이 클라이언트
   consumer 로서 자체 방어)와 일치하며 `0-architecture.md §R2`(client-consumer 원칙)와 정합.

## 확인한 정합 지점 (충돌 아님 — 명시 확인)

- `3-auth-session.md §R8`(발급-origin 바인딩): target 의 R0 은 §R8 을 변경 동기로 직접 인용하며, 새 검증은
  §R8 의 fail-closed origin 비교가 항상 유효한(파싱 가능한) `apiBase` 를 대상으로 하도록 보강한다 — 반대
  방향 서술 없음. 정합.
- `0-architecture.md §4`(`<api-base>` = "EIA 가 서빙되는 API origin", `boot.apiBase` 런타임 주입): "origin"
  이라는 정의 자체가 이미 http(s) 스킴을 전제하므로 target 의 제약과 모순 없음.
- `5-admin-console.md §6.1`(iframe `src` 쿼리로 실어 보내는 `<api-base>`): 콘솔이 주입하는 값은
  `getWebhookBaseUrl()` 기반의 항상 http(s) origin이라 거절 케이스 대상이 아님 — 정합.

## 요약

`4-security.md` 의 `wc:boot` apiBase 스킴 검증 확장은 다른 영역 spec 과 직접 모순되는 지점이 없다.
`3-auth-session.md §R8`(발급-origin 바인딩)·`0-architecture.md §4`(`<api-base>` origin 정의)·
`5-admin-console.md`(콘솔이 주입하는 apiBase 는 항상 유효 origin)는 모두 이 변경과 정합하거나 오히려 이
변경의 동기가 된다. 유일하게 발견된 것은 반대 주장이 아닌 **문서 상호참조 누락 2건**(INFO) — `2-sdk.md`
공개 타입 계약이 이 런타임 제약을 언급하지 않는 점, 그리고 `1-widget-app.md` 상태기계가 "config 미적용 무통지
정체" edge case 를 서술하지 않는 점이며, 후자는 target 이 스스로 pre-existing gap 으로 인지·별도 등재했음을
명시하고 있어 이번 diff 의 신규 결함이 아니다.

## 위험도

LOW — Critical/Warning 없음. INFO 2건은 문서 동기화 권장 사항이며 target 자체의 수정을 요구하지 않는다.

STATUS: OK
