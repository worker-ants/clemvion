# 아키텍처(Architecture) 리뷰 — masking-expression-egress-split (C2 (a))

## 발견사항

- **[INFO]** 어댑터에서 보안 마스킹 책임을 제거한 것은 SRP 관점에서 개선이다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:26-59` (`adaptHandlerReturn`)
  - 상세: 종전 `adaptHandlerReturn` 은 "핸들러 반환 shape 정규화"(Adapter 패턴 본연의 책임)와 "보안 마스킹"(cross-cutting 관심사)을 한 함수에 섞고 있었다. 이번 변경으로 `config: r.config ?? {}` 로 단순화되어 어댑터가 순수하게 shape adaptation 만 담당하게 됐고, `../../common/utils/mask-sensitive-fields.util` import 도 사라져 execution-engine 코어 모듈이 보안 유틸에 대해 갖던 인바운드 의존을 하나 줄였다. 동시에 `config` 마스킹 시점이 egress-only 로 통일되어 `Execution.error`/`outputData` 가 이미 따르던 정책과의 **불일치(특례)** 도 제거됐다 — 시스템 전반의 레이어 책임 분리가 더 일관돼졌다.
  - 제안: 없음(개선 사항으로 기록).

- **[WARNING]** 안전성이 "구조적 단일 관문(choke point)" 에서 "관례 기반 다중 관문" 으로 이동했다 — 신규 egress 소비처가 규율에 의존
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:49` (`config: r.config ?? {}`), `codebase/backend/src/modules/websocket/websocket.service.ts:334`·`:408`(`maskWireEnvelope` 호출부 2곳), `codebase/backend/src/shared/utils/redact-stored-error.ts:107-108`
  - 상세: 종전에는 `NodeHandlerOutput.config` 가 **생성되는 시점**(`adaptHandlerReturn`)에 이미 마스킹되어 있었으므로, 이후 이 값을 어디서 어떻게 소비하든(신규 REST 엔드포인트·신규 WS emit 함수·향후 GraphQL 등) 구조적으로 안전했다. 이번 변경 이후 안전성은 오직 "현재 존재하는 2개의 egress 관문(`redactStoredDataForResponse`, `maskWireEnvelope`)을 반드시 지난다" 는 사실에만 의존한다. `NodeHandlerOutput.config: Record<string, unknown>` 타입에는 raw/masked 를 구분하는 어떤 브랜딩도 없어(`nodes/core/node-handler.interface.ts:305`), 향후 새 egress 경로(예: 새 emit 헬퍼, DB 를 직접 읽는 새 REST 핸들러)가 두 관문을 우회해 이 값을 그대로 내보내도 컴파일러/타입 시스템은 이를 잡지 못한다. 이 PR 자신의 plan 이 인용하는 *"출구 중 하나를 빠뜨린다"* 는 이 저장소가 **반복적으로 겪은** 실패 클래스이고(과거 여러 `plan/complete/eia-*`·`assistant-mask-leak.md` 이력), 이번 변경은 그 위험이 "현재 알려진 두 관문에는 없다" 는 것만 실측·테스트로 못박았을 뿐 "미래의 세 번째 관문에도 없다" 는 것을 구조적으로 보장하지 않는다.
  - 제안: 이미 계획서(`plan/in-progress/masking-expression-egress-split.md`)가 인지하고 mutation 테스트로 현재 2개 관문의 정합성은 검증했으므로 이 PR 을 막을 사유는 아니다. 다만 향후 신규 egress 경로 추가 시 "config 는 항상 `deepRedactSecrets*` 를 거쳐야 한다" 를 타입 수준(예: `Masked<T>` 브랜드 타입으로 REST/WS 응답 DTO 의 `config` 필드를 감싸 컴파일 시점에 마스킹 통과 여부를 강제)으로 승격하는 것을 백로그에 남기길 권한다 — 지금은 discipline(주석·테스트)에만 의존한다.

- **[WARNING]** `CREDENTIAL_KEY_PATTERN` 이 두 파일에 독립 선언되어 있고, 이번 안전 불변식(포함관계)이 그중 하나에만 얹혀 있다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:112`, `codebase/backend/src/modules/websocket/websocket.service.ts:78`
  - 상세: 같은 이름·같은 목적의 정규식이 두 파일에 손으로 각각 선언돼 있고(REST 쪽만 `x[_-]api[_-]?key` 를 추가로 포함, 오늘도 실제로 다름), 두 파일 모두 "한쪽만 고치면 안 된다" 는 주석으로 규율을 강제한다. 이번 PR 이 새로 세운 안전 전제("`DEFAULT_SENSITIVE_KEYS` ⊆ egress 마스커의 키 축")는 `mask-sensitive-fields.util.spec.ts` 의 캐너리가 오직 `shared/utils/sanitize-error-message.ts` 의 `deepRedactSecrets`(REST/WS 공유본, `maskWireEnvelope` 가 실제로 쓰는 그 함수) 하나에 대해서만 검증한다 — 이는 실측(`websocket.service.ts:463` 의 `maskWireEnvelope` 가 `deepRedactSecretsPreserving` 을 호출)과 정확히 일치하므로 **오늘의 정합성은 맞다**. 다만 아키텍처 관점에서 "같은 개념(자격증명 키 이름)을 표현하는 정규식이 한 코드베이스에 두 벌 존재하고, 그중 하나만 신규 불변식의 검증 대상" 이라는 구조 자체는 DRY 위반이자 향후 드리프트 위험(둘 중 하나가 넓어지고 다른 하나는 그대로 남는 사고가 이 저장소에서 이미 여러 번 재발한 패턴, `feedback_defense_defined_one_notch_narrow` 류)이며, 이 PR 은 그 구조를 고치지 않고 그 위에 올라탄다.
  - 제안: 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "chatChannel 라우팅 컨텍스트만 좁은 마스커를 받는다" 로 별건 등재돼 있어 이 PR 의 범위 밖 처리는 타당하다. 장기적으로는 `CREDENTIAL_KEY_PATTERN` 을 단일 모듈에서 export 하고 WS/REST 양쪽이 import 하는 형태로 통합해 "동명이인 상수" 클래스 자체를 없애는 편이 이번처럼 "포함관계를 캐너리로 계속 증명해야 하는" 유지비용을 줄인다.

- **[INFO]** `common/utils` ↔ `shared/utils` — 이름만으로 구분되지 않는 두 병렬 유틸 네임스페이스
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:2` (신규 import), 참고로 `codebase/backend/src/common/utils/` 와 `codebase/backend/src/shared/utils/` 디렉터리 전체
  - 상세: 이번 PR 이 추가한 import(`mask-sensitive-fields.util.spec.ts` → `../../shared/utils/sanitize-error-message`)가 두 디렉터리를 가로지른다. 두 디렉터리 모두 "보안 관련 마스킹/sanitize" 유틸을 담고 있어(`common/utils/mask-sensitive-fields.util.ts`, `common/utils/ssrf-safe-url.util.ts` vs `shared/utils/sanitize-error-message.ts`, `shared/utils/redact-stored-error.ts`) 어떤 기준으로 `common` 과 `shared` 를 나누는지 이름만으로는 알 수 없다. 이번 PR 이 만든 구조는 아니고 프로덕션 코드 의존 방향에 순환은 없음(확인함 — `shared/utils/sanitize-error-message.ts` 는 `@workflow/masked-markers` 만 import), 테스트 전용 cross-import 라 실질 위험은 낮다.
  - 제안: 이 PR 의 스코프는 아니나, 두 네임스페이스의 구분 기준을 `spec/conventions/` 에 명문화하거나 장기적으로 통합하는 것을 백로그로 남길 만하다.

- **[WARNING]** 포함관계 캐너리(cross-module contract test)가 `common/utils` 의 유닛 테스트 파일에 얹혀 있어 발견성이 낮다
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:129-173` (`describe('DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets 의 키 축', ...)`)
  - 상세: 이 테스트 블록은 `mask-sensitive-fields.util.ts` 하나만의 단위 테스트가 아니라 `common/utils` 와 `shared/utils` 두 독립 모듈 사이의 **구조적 불변식**(키 집합 포함관계)을 검증하는 계약(contract) 테스트다. 설계 의도(파생 fixture로 자동 확장)는 좋으나, `shared/utils/sanitize-error-message.ts` 를 유지보수하는 사람이 `common/utils/mask-sensitive-fields.util.spec.ts` 라는, 자신의 모듈과 무관해 보이는 파일에 자신이 깨뜨릴 수 있는 불변식이 숨어 있다는 것을 알기 어렵다. 실제로 mutation M3(`CREDENTIAL_KEY_PATTERN` 에서 `[a-z0-9_-]*token` 제거)이 이 파일에서 잡힌다는 사실이 `sanitize-error-message.ts` 쪽 코드에는 전혀 드러나지 않는다.
  - 제안: `sanitize-error-message.ts` 쪽에도 "이 파일을 바꾸면 `mask-sensitive-fields.util.spec.ts` 의 포함관계 캐너리를 확인하라" 는 상호 참조 주석을 남기거나, 두 모듈이 공유하는 위치(예: `shared/` 하위의 별도 `*.contract.spec.ts`)로 옮기는 것을 고려할 수 있다. 이번 PR 을 막을 사유는 아니다.

- **[WARNING]** 이 PR 의 "mirror sweep" 이 spec 문서만 훑어 프로덕션 코드 주석의 동일 문구는 놓쳤다
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3280`, `:3351`
  - 상세: `review/consistency/2026/08/24/19_26_06/RESOLUTION.md` 는 `maskSensitiveFields` 문자열을 주장 기반으로 훑어 "8개 파일" 을 찾았고 그중 spec 6개를 정정했다고 기록한다. 그런데 실제로 `maskSensitiveFields` 문자열을 포함하는 파일을 전수 검색하면 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 의 두 주석(`_retryState` 빌드 함수 근방)이 지금도 "credential 은 포함하지 않으며 `maskSensitiveFields` boundary 와 동일 정책", "same masking policy as `_resumeState` (`maskSensitiveFields` boundary strip)" 이라고 적혀 있다 — 이 문구는 `handler-output.adapter.ts` 가 `config` 에 걸던 바로 그 boundary 마스킹을 안전성의 준거로 인용하는데, 그 메커니즘은 이 PR 로 사라졌다(그리고 애초에 `_resumeState`/`_retryState` 는 `maskSensitiveFields` 호출이 아니라 allow-list 방식 구성으로 credential 을 배제해 왔으므로, 이 주석은 실제 메커니즘을 정확히 서술한 적도 없다). 기능적 회귀는 아니지만(그 필드들의 credential 배제는 이번 변경과 무관하게 여전히 allow-list 로 보장됨), 이 PR 이 전제로 삼는 "이번엔 게이트 목록을 그대로 집행하지 않고 다시 셌다" 는 mirror sweep 의 완결성 주장과 어긋나는 잔여 사례다 — sweep 범위가 암묵적으로 `spec/` 로 좁혀져 있었다.
  - 제안: 두 주석을 "credential 은 포함하지 않으며 — egress(REST/WS)에서 마스킹, `_resumeState`/`_retryState` 자체는 allow-list 로 애초에 배제" 정도로 정정. 코드 리뷰 단계에서 함께 처리 가능한 범위다.

## 요약

핵심 아키텍처 변경(엔진 boundary 의 키-이름 마스킹 제거 → egress-only 로 단일화)은 SRP·레이어 책임 분리 관점에서 명백한 개선이며, `Execution.error`/`outputData` 가 이미 따르던 egress-only 원칙과 시스템 전체 설계가 더 일관돼졌다. 안전 전제(두 마스커의 키 축 포함관계)를 정본 구현 실행 기반 캐너리와 3건의 mutation 테스트로 뒷받침한 점도 견고하다. 다만 이 변경은 "데이터 생성 시점에 구조적으로 보장되던 마스킹" 을 "각 egress 소비처가 개별적으로 규율을 지켜야 하는 마스킹" 으로 바꾸는 트레이드오프이고, 그 규율을 강제하는 타입 수준 장치는 없다 — 이 저장소가 과거 반복적으로 겪은 "출구 중 하나를 빠뜨린다" 실패 클래스를 오늘의 두 관문에 대해서는 닫았지만 미래의 세 번째 관문에 대해서는 구조적으로 열려 있다. 여기에 더해 `CREDENTIAL_KEY_PATTERN` 의 기존 이중 선언(DRY 위반), 신규 계약 테스트의 낮은 발견성, mirror sweep 이 놓친 코드 주석 잔여(`ai-turn-executor.ts`) 등 부수적 구조 부채가 확인된다. 모두 이 PR 을 차단할 사유는 아니며 대부분 이미 문서화·추적되고 있다.

## 위험도
MEDIUM
