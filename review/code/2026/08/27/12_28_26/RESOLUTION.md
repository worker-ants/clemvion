# RESOLUTION — `12_28_26` (4라운드, 타겟 4명) — **수렴**

RISK=**LOW** · **CRITICAL 0** · WARNING 2 (신규 1 + 기등재 1).
4명(security / requirement / testing / documentation) 전원이 앞선 3라운드 지적의 해소를
**독립 재현**으로 확인했다.

## W1 — 신규. 그리고 **내가 직전 라운드에 쓴 JSDoc** 이다

`12_00_05` INFO 6 을 처리하며 `setStructuredOutput` JSDoc 에 이렇게 썼다:

> *"`handler-output.adapter.spec.ts` pins the reference-passing with a `toBe` canary."*

**틀렸다.** 그 캐너리는 `adaptHandlerReturn(...)` 의 반환값만 문다 — 그 파일은
`ExecutionContextService` 를 **import 조차 하지 않는다**(실측). 즉 *"이 메서드의 참조
전달이 고정돼 있다"* 는 내 주장의 근거가 그 주장을 덮지 않았다.

**"문서한 보장이 구현보다 넓다"** 의 교과서 사례이고, 이번엔 그 넓은 보장을 **캐너리
인용**의 형태로 썼다는 게 더 나쁘다 — 읽는 사람은 근거가 있다고 믿는다.

### 리뷰어 서술 중 한 대목은 틀렸다 (실측)

리뷰어는 *"실제로도 `structuredOutputCache[nodeId] = { ...adapted }` 라 top-level 은 새
객체"* 라고 적었다. 실측하면 `:160` 은 `= adapted` 로 **참조 저장이 맞다**. 지적의 본질
(캐너리 미커버)은 유효하므로 그대로 수용하되, 사실관계는 바로잡아 둔다.

### 고친 것

1. **JSDoc 을 두 홉으로 갈랐다** — 하나로 뭉뚱그린 게 오류의 원인이었다.
   - hop 1 `adaptHandlerReturn` 이 핸들러 `config` 객체 자체를 반환 → 어댑터 spec 이 고정.
     **그 캐너리는 이 메서드에 대해 아무 말도 하지 않는다**고 명시.
   - hop 2 이 메서드가 `adapted` 래퍼를 통째로 참조 저장 → **이 모듈 spec 이 고정**.
2. **실제로 hop 2 를 무는 캐너리 2건**을 `execution-context.service.spec.ts` 에 신설
   (identity + "반환 후 변형이 캐시에 보인다").
3. **자매 대조군**(`setEngineResolvedConfig` 는 shallow-copy 하므로 `not.toBe`)을 함께 뒀다.
   둘이 같이 있어야 *"왜 한쪽만 복사하나"* 가 우연이 아니라 계약으로 읽힌다.

### 뮤테이션 — 예측/실측

| | 예측 | 실측 | 판정 |
| --- | --- | --- | --- |
| **M6** `= adapted` → `= { ...adapted }` | 1 failed / 26 passed (래퍼 identity 만) | **1 / 26** | 일치 |
| **M7** `+ config: { ...config }` | 3 failed / 24 passed | **2 failed / 25 passed** | **어긋남** |

**M7 예측이 틀린 이유**: `it` 이 아니라 **단언 수를 셌다**. `expect(cached).toBe(adapted)`
와 `expect(cached?.config).toBe(rawConfig)` 는 **같은 `it` 안**이라 하나의 실패로 집계된다.
실패 케이스 이름을 뽑아 보니 정확히 신설 캐너리 2건 — 관측이 내 가설로만 설명된다.

M6 이 1건만 죽이고 M7 이 2건을 죽이는 **차이 자체**가 두 홉이 갈렸다는 증거다.
원복은 `cp` 백업, `git status` 로 잔여 0 확인.

## W2 — 기등재 트레이드오프, 비차단

storage-time → egress-only 전환의 두 축(DB 원문 저장 · 크로스-노드 릴레이)은 R-5 정정
블록과 트래커에 이미 명시돼 있고, 리뷰어도 *"신규 미문서화 결함 아님, 비차단"* 으로
판정했다. 근본 처방(자격증명을 `llmConfigId` 같은 **참조**로 담기)의 우선순위만 유지한다.

## INFO — 조치 불요

- **#1·#2** 앞선 CRITICAL 1건 + WARNING 4건이 전부 해소됨을 **독립 재현**으로 확인
  (신규 키 추가 → 정확히 그 키만 RED · 22키 전수 정규식 대조 · line-level spec 재대조).
  3라운드 연속 미수정이던 문법 깨진 주석도 **문장 전체 취소선**으로 근본 해소 확인.
- **#7** `plan/complete/**` 4개 문서가 제거된 boundary 를 현재형으로 서술한 채 남아 있다 —
  리뷰어 판단대로 **완료 스냅샷은 소급 수정하지 않는 것이 관례**라 조치하지 않는다.
- **#3**(WS 정규식) · **#6**(egress 진입점 통합 테스트) — 기지 별건, 트래커 유지.

## 수렴 판정

발견의 **성격**으로 판단한다(개수가 아니라):

| 라운드 | 성격 |
| --- | --- |
| `10_53_52` | **동작** — 안전장치가 아무것도 검사하지 않음 (CRITICAL) |
| `11_25_15` | **문서** — 미러 스윕 3곳 + 정정문 자체의 논리 오류 |
| `12_00_05` | **문서 + 테스트 정밀도** — 스윕 3곳 + vacuous 캐너리 |
| `12_28_26` | **테스트 정밀도 1건** — 그것도 직전 라운드가 **새로 만든** 것 |

CRITICAL 0 · 코드 동작 결함 0 · 신규 WARNING 1(그 1건도 이 라운드에서 캐너리 + 뮤테이션
검증으로 닫음). 앞 두 라운드를 지배하던 미러-스윕 클래스가 **이번엔 0** 이다 — 후보집합
방식을 버리고 주장 기반 전수 스윕(35건 육안 판정)으로 바꾼 결과다. **수렴으로 판정한다.**

TEST WORKFLOW 4단계 PASS — backend **9,023 passed** / 433 suites · e2e 285 · ratchet 199/38.
