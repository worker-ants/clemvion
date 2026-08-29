# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위 및 방법 메모

prompt 번들에서 `spec/5-system/14-external-interaction-api.md`(가장 유력한 target — 브랜치명
`eia-idem-resolve-cache-hit` 이 가리키는 Idempotency-Key 캐시 영역의 SoT)를 포함한 15개
`5-system/*` 파일과 `spec/data-flow/**` 등 다수 "관련 spec 본문" 이 **컨텍스트 예산 초과로
본문 생략**되어 있었다 (`⚠️ 본문 생략됨` 마커). "여기 없다 = 문제 없다" 로 간주하지 않고,
해당 파일들을 저장소에서 직접 `Read`/`grep` 하여 실제 내용으로 대조했다:

- `spec/5-system/14-external-interaction-api.md` (§1 EIA-IN-11, §2 EIA-RL-02, §5.1 에러표,
  §9.1 처리흐름, §R8 Rationale "Idempotency-Key 와 캐시 스코프") — 직접 Read
- `spec/data-flow/15-external-interaction.md` §2.2 (Redis 키 인벤토리) — 직접 Read
- `spec/conventions/redis-keys.md` (키 인벤토리 SoT 포인터) — 직접 Read
- `spec/data-flow/14-chat-channel.md` §2.2 (인접 도메인의 유사 용어 대조용) — 직접 Read
- `spec/5-system/1-auth.md`, `2-api-convention.md`, `3-error-handling.md` — prompt 에 전문
  포함되어 있어 그대로 사용

## 발견사항

교차 대조 결과 **CRITICAL/WARNING 급 충돌 없음**. 아래 1건만 INFO 로 기록한다.

- **[INFO]** `idempotencyKey`/`Idempotency-Key` 용어가 서로 다른 두 메커니즘에 재사용됨
  - target 위치: `spec/5-system/14-external-interaction-api.md` §1 EIA-IN-11 · §R8 "캐시 키
    스코프" (`interaction:idempotency:<executionId>:<route>:<key>`, 전체 응답을 24h 캐시)
  - 충돌 대상: `spec/data-flow/14-chat-channel.md` §2.2 의 `cc:dedup:{triggerId}:{idempotencyKey}`
    (provider 재도착 억제용 `SET NX EX 30` 단순 마커, TTL 30초)
  - 상세: 두 값 모두 "idempotencyKey" 라는 이름을 쓰지만 EIA 쪽은 클라이언트가 보내는
    `Idempotency-Key` HTTP 헤더 값을 execution·route 로 스코프한 **전체 응답 캐시**이고,
    chat-channel 쪽은 provider(webhook) 가 보내는 내부 필드를 30초짜리 **중복 도착 억제
    마커**로만 쓴다. 실제 스키마·TTL·목적이 전혀 달라 데이터 모델 충돌은 아니며, 각각
    `spec/conventions/redis-keys.md` 인벤토리에 별도 SoT 포인터로 이미 분리 등재되어 있다
    (혼동을 방지하는 장치가 이미 존재). 다만 두 spec 을 나란히 읽는 개발자가 "같은
    Idempotency-Key 개념" 으로 오인할 여지가 남는다.
  - 제안: 필수 조치 아님. 여유가 있으면 `redis-keys.md` 인벤토리 표의 두 행 사이에 "동명
    이의 — 스키마·TTL 상이" 각주를 추가해 동기화하면 향후 재확인 비용을 줄일 수 있다.

## 상세 대조 근거 (충돌 없음을 확인한 축)

- **캐시 키 형식**: `interaction:idempotency:<executionId>:<route>:<key>` 가
  `spec/5-system/14-external-interaction-api.md` §R8, `spec/data-flow/15-external-interaction.md`
  §2.2, `spec/conventions/redis-keys.md` §3 인벤토리 세 곳에서 문자 그대로 동일하게 반복된다.
- **캐시 대상 정책(닫힌 목록)**: "2xx·409·410 캐시, `400 VALIDATION_ERROR` 만 제외, `5xx` 제외"
  가 EIA §R8 본문과 data-flow §2.2 표에서 동일하게 기술된다.
- **에러 코드 카탈로그**: `IDEMPOTENCY_KEY_CONFLICT`(409)·`STATE_MISMATCH`(409)·
  `EXECUTION_TERMINATED`(410) 가 `spec/5-system/14-external-interaction-api.md` §5.1 본문과
  `spec/5-system/3-error-handling.md` §1.6 "EIA REST 외부 표면 에러 코드" 등재 표에서 상태코드·
  의미 모두 일치한다 (§1.6 은 EIA 를 SoT 로 명시하고 "등재만" 한다고 스스로 밝혀 이중 SoT 위험도
  없다).
- **응답 봉투 형식**: EIA §5.1 이 참조하는 `{ error: { code, message, requestId, details? } }` 는
  `spec/5-system/2-api-convention.md` §5.3 과 동일하며, 문서 내에 "webhook 과의 형식 차이는
  2026-06-28 부로 해소됐다" 는 취소선 처리된 이력 노트까지 남아 있어 stale 서술도 없다.
  비-페이징 고정 컬렉션 표기(`{ data: { items } }`) 등 api-convention 의 다른 규약과도 EIA 응답
  형태가 상충하지 않는다.
- **RBAC/인증 계층 경계**: `spec/5-system/2-api-convention.md` §2 가 `/api/external/*` 를
  "인증 family 전용 네임스페이스" 예외로 명시하고, `spec/5-system/1-auth.md` 는 세션/워크스페이스
  RBAC(§3.2)·JWT 토큰(§2.1~2.2) 만을 다루며 EIA 의 `iext_*`/`itk_*` 토큰을 전혀 언급하지 않는다
  (겹쳐서 정의하지 않음 — 이중 SoT 부재 확인).
- **상태 전이 코드 매핑**: WS `INVALID_EXECUTION_STATE` / REST core `INVALID_STATE`(422) /
  EIA REST `STATE_MISMATCH`(409) 의 3-way 표면별 분리가 `3-error-handling.md` §1.5 근방과
  EIA §5.1 양쪽에서 "의도적 분리" 로 동일하게 설명된다 — 모순이 아니라 명시적으로 조율된 차이.

## 요약

Cross-Spec 관점에서 `spec/5-system/` (특히 이번 작업이 겨냥하는 Idempotency-Key 캐시 영역,
EIA-IN-11/§R8)은 `spec/data-flow/15-external-interaction.md`, `spec/conventions/redis-keys.md`,
`spec/5-system/{2-api-convention,3-error-handling,1-auth}.md` 와 캐시 키 형식·캐시 대상 정책·
에러 코드·응답 봉투·인증 경계·상태 코드 매핑 전 축에서 문자 그대로 일치했다. 각 SoT 는
포인터 참조로만 서로를 인용하고 본문을 중복 정의하지 않아 이중 SoT 위험도 낮다. 발견된 유일한
항목은 인접 도메인(chat-channel)과의 "idempotencyKey" 용어 재사용에 대한 INFO 수준 참고사항
뿐이며, 실질적 데이터 모델·계약 충돌은 아니다. 컨텍스트 예산으로 프롬프트에서 생략된 나머지
`5-system/*`·`data-flow/*` 파일들은 이번 작업과 직접 연관된 범위(EIA 및 그 인접 참조)에 한해
저장소에서 직접 읽어 대조했으며, 그 밖의 영역(예: RAG·MCP·chat-channel 상세, node 카탈로그)은
이번 브랜치의 변경 범위(Idempotency 캐시 로직)와 무관해 보여 별도 조사하지 않았다.

## 위험도

LOW
