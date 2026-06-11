# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`

변경 파일:
- `spec/conventions/error-codes.md` — §3.1 내부 전용 legacy 분류 코드 섹션 신설
- `spec/conventions/chat-channel-adapter.md` — `HTTP_TIMEOUT(미발행)` 주석 추가
- `spec/conventions/node-output.md` — D4 블록 링크 앵커 보정
- `spec/4-nodes/5-data/2-code.md` — 2단 래퍼·vars copy-out 상세 보강 (주 변경)
- `spec/4-nodes/4-integration/1-http-request.md` — usage log 매트릭스 주석·dry-run 명시 보강
- `spec/5-system/3-error-handling.md` — `HTTP_TIMEOUT(미발행)` 각주 추가

---

## 발견사항

- **[WARNING]** `EXECUTION_TIMEOUT` 이중 지위 — 카탈로그 SoT 와 naming convention 간 충돌
  - target 위치: `spec/conventions/error-codes.md §3.1` (신설 표 1행)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §1.4` "엔진 수준 에러" 표 (변경 없는 행), 해당 섹션은 본 PR 에서 `EXECUTION_TIMEOUT` 행을 수정하지 않음
  - 상세: 신설 `error-codes.md §3.1` 은 `EXECUTION_TIMEOUT` 을 "클라이언트 계약에 영향을 주지 않는 구현 내부 명칭" 으로 분류하며, `output.error.code` 로 직접 발행되지 않고 `CODE_TIMEOUT` 으로 정규화된다고 명시한다. 그러나 카탈로그 SoT 인 `3-error-handling.md §1.4` 의 "엔진 수준 에러" 표는 여전히 `EXECUTION_TIMEOUT` 을 "Code 노드 스크립트 실행 타임아웃" 이라는 독립 공개 코드로 서술한다 (internal-only 또는 deprecated 한정 등의 단서 없음). `error-codes.md §Overview` 는 카탈로그 SoT 를 `3-error-handling.md §1` 로 명시하므로, 두 문서가 동일 코드에 대해 "공개 카탈로그 코드" vs "내부 전용 legacy 코드" 로 상충하는 지위를 부여한다. `error-codes.md` 의 Rationale("왜 SoT 를 분리하는가")도 카탈로그 소유는 `3-error-handling.md` 에 귀속됨을 재확인하므로, `3-error-handling.md §1.4` 의 `EXECUTION_TIMEOUT` 행 갱신 없이 `error-codes.md §3.1` 만 신설한 것은 카탈로그 SoT 와 naming convention 간 불일치를 남긴다.
  - 제안: `spec/5-system/3-error-handling.md §1.4` 의 `EXECUTION_TIMEOUT` 행에 "(내부 분류 전용 — `CODE_TIMEOUT` 으로 정규화, 공개 발행 없음. 상세: [`conventions/error-codes.md §3.1`](../conventions/error-codes.md))" 주석을 추가한다. `EXECUTION_MEMORY_EXCEEDED` / `CODE_RUNTIME_ERROR` 는 현재 §1.4 에 별도 등재가 없어 직접적 충돌은 없으나, 일관성 차원에서 동일 처리 권장.

- **[INFO]** `chat-channel-adapter.md` 의 `HTTP_TIMEOUT(미발행)` 주석 — Rationale 정합
  - target 위치: `spec/conventions/chat-channel-adapter.md §3.1` 분류 표 아래 신설 설명 블록
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §1.4` 기존 `HTTP_TIMEOUT` 미발행 사실 + 이번 PR 동일 파일 각주 추가
  - 상세: 기존 분류 표에 `HTTP_TIMEOUT` 행이 있었으나 도달 불가 여부가 미표기였다. 이번 변경은 `3-error-handling.md` 및 `1-http-request.md` 에서 이미 확인된 사실을 어댑터 쪽에도 대칭 명시한 것이다. Rationale 충돌 없음. 설명 블록이 `spec/5-system/3-error-handling.md §1.4 註` 를 cross-reference 하여 SoT 연결이 충족된다.

- **[INFO]** `node-output.md` D4 링크 앵커 보정 — Rationale 영향 없음
  - target 위치: `spec/conventions/node-output.md` §3.1 D4 인용 블록
  - 상세: `1-http-request.md §5.8` 링크에 앵커 추가만. 서술 내용 무변경. 어떤 합의 원칙도 영향받지 않는다.

---

## 요약

이번 변경의 핵심은 `error-codes.md §3.1` 신설로 Code 노드 내부 분류 코드(`EXECUTION_TIMEOUT` / `EXECUTION_MEMORY_EXCEEDED` / `CODE_RUNTIME_ERROR`)를 public 코드와 명확히 분리한 것이다. 이는 `error-codes.md §2` 의 "rename 안정성" 원칙을 위반하지 않으며 — 내부 명칭 정비는 클라이언트 계약 외부이므로 안전한 변경으로 일관되게 처리된다. 단 카탈로그 SoT 인 `3-error-handling.md §1.4` 의 `EXECUTION_TIMEOUT` 행이 본 PR 에서 갱신되지 않아, 해당 코드가 공개 카탈로그 코드처럼 보이는 상태가 남아있다. 이것이 유일한 Rationale 연속성 문제로, 합의된 SoT 분리 원칙("카탈로그 소유 = `3-error-handling.md`")을 명시적으로 어기지는 않지만 두 문서 독자에게 상충된 신호를 준다는 점에서 WARNING 수준으로 판단한다. 기각된 대안의 재도입이나 합의된 invariant 직접 위반은 발견되지 않았다.

---

## 위험도

LOW
